"""
PowerShell Script Analysis API
A FastAPI service that analyzes PowerShell scripts using OpenAI APIs.
"""

import os
import json
from typing import Dict, List, Optional, Any

from fastapi import FastAPI, HTTPException, Depends, Body
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import psycopg2
from psycopg2.extras import RealDictCursor
import numpy as np
import openai
import tiktoken
from tenacity import retry, stop_after_attempt, wait_exponential

from analysis.script_analyzer import ScriptAnalyzer

# Initialize FastAPI app
app = FastAPI(
    title="PowerShell Script Analysis API",
    description="API for analyzing PowerShell scripts using AI",
    version="0.1.0"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, replace with specific origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize script analyzer
script_analyzer = ScriptAnalyzer()

# Database connection
def get_db_connection():
    """Create and return a database connection."""
    conn = psycopg2.connect(
        host=os.getenv("DB_HOST", "localhost"),
        database=os.getenv("DB_NAME", "psscript"),
        user=os.getenv("DB_USER", "postgres"),
        password=os.getenv("DB_PASSWORD", "postgres"),
        port=os.getenv("DB_PORT", "5432")
    )
    conn.cursor_factory = RealDictCursor
    return conn

# Request/Response Models
class ScriptContent(BaseModel):
    content: str = Field(..., description="PowerShell script content to analyze")
    script_id: Optional[int] = Field(None, description="Script ID if already stored")

class ScriptEmbeddingRequest(BaseModel):
    content: str = Field(..., description="PowerShell script content to generate embedding for")

class SimilarScriptsRequest(BaseModel):
    script_id: Optional[int] = Field(None, description="Script ID to find similar scripts for")
    content: Optional[str] = Field(None, description="Script content to find similar scripts for")
    limit: int = Field(5, description="Maximum number of similar scripts to return")

class AnalysisResponse(BaseModel):
    purpose: str
    security_analysis: str
    security_score: float
    code_quality_score: float
    parameters: Dict[str, Any]
    category: str
    optimization: List[str]
    risk_score: float

class EmbeddingResponse(BaseModel):
    embedding: List[float]

class SimilarScript(BaseModel):
    script_id: int
    title: str
    similarity: float

class SimilarScriptsResponse(BaseModel):
    similar_scripts: List[SimilarScript]
    
class ChatMessage(BaseModel):
    role: str = Field(..., description="The role of the message sender (user or assistant)")
    content: str = Field(..., description="The content of the message")

class ChatRequest(BaseModel):
    messages: List[ChatMessage] = Field(..., description="Chat history")
    system_prompt: Optional[str] = Field(None, description="Optional system prompt to override default")
    
class ChatResponse(BaseModel):
    response: str = Field(..., description="The assistant's response")

# API Routes
@app.get("/", tags=["Root"])
async def root():
    """Root endpoint, returns API info."""
    return {
        "message": "PowerShell Script Analysis API",
        "version": "0.1.0",
        "status": "operational"
    }

@app.post("/analyze", response_model=AnalysisResponse, tags=["Analysis"])
async def analyze_script(script_data: ScriptContent):
    """Analyze a PowerShell script and return detailed information."""
    try:
        # Perform script analysis
        analysis = script_analyzer.analyze_script(script_data.content)
        
        # If script_id is provided, store the analysis result in the database
        if script_data.script_id:
            try:
                conn = get_db_connection()
                cur = conn.cursor()
                
                # Check if analysis exists for this script
                cur.execute(
                    "SELECT id FROM script_analysis WHERE script_id = %s",
                    (script_data.script_id,)
                )
                existing = cur.fetchone()
                
                if existing:
                    # Update existing analysis
                    cur.execute(
                        """
                        UPDATE script_analysis
                        SET purpose = %s, security_score = %s, quality_score = %s, 
                            risk_score = %s, parameter_docs = %s, suggestions = %s,
                            updated_at = CURRENT_TIMESTAMP
                        WHERE script_id = %s
                        RETURNING id
                        """,
                        (
                            analysis["purpose"],
                            analysis["security_score"],
                            analysis["code_quality_score"],
                            analysis["risk_score"],
                            json.dumps(analysis["parameters"]),
                            json.dumps(analysis["optimization"]),
                            script_data.script_id
                        )
                    )
                else:
                    # Insert new analysis
                    cur.execute(
                        """
                        INSERT INTO script_analysis
                        (script_id, purpose, security_score, quality_score, risk_score, 
                         parameter_docs, suggestions)
                        VALUES (%s, %s, %s, %s, %s, %s, %s)
                        RETURNING id
                        """,
                        (
                            script_data.script_id,
                            analysis["purpose"],
                            analysis["security_score"],
                            analysis["code_quality_score"],
                            analysis["risk_score"],
                            json.dumps(analysis["parameters"]),
                            json.dumps(analysis["optimization"])
                        )
                    )
                
                conn.commit()
            
            except Exception as e:
                print(f"Database error: {e}")
                # Continue even if database operation fails
            finally:
                if conn:
                    conn.close()
        
        return analysis
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")

@app.post("/embedding", response_model=EmbeddingResponse, tags=["Embeddings"])
async def create_embedding(request: ScriptEmbeddingRequest):
    """Generate an embedding vector for a PowerShell script."""
    try:
        embedding = script_analyzer.generate_embedding(request.content)
        return {"embedding": embedding}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Embedding generation failed: {str(e)}")

@app.post("/similar", response_model=SimilarScriptsResponse, tags=["Search"])
async def find_similar_scripts(request: SimilarScriptsRequest):
    """Find scripts similar to a given script using vector similarity."""
    # Validate that either script_id or content is provided
    if request.script_id is None and request.content is None:
        raise HTTPException(
            status_code=400, 
            detail="Either script_id or content must be provided"
        )
    
    try:
        conn = get_db_connection()
        
        # Get the embedding for the query script
        query_embedding = None
        
        if request.script_id:
            # Fetch embedding for existing script
            cur = conn.cursor()
            cur.execute(
                "SELECT embedding FROM script_embeddings WHERE script_id = %s",
                (request.script_id,)
            )
            result = cur.fetchone()
            
            if not result:
                raise HTTPException(
                    status_code=404,
                    detail=f"No embedding found for script ID {request.script_id}"
                )
            
            query_embedding = result["embedding"]
        
        elif request.content:
            # Generate embedding for provided content
            query_embedding = script_analyzer.generate_embedding(request.content)
        
        # Convert query embedding to numpy array
        query_embedding_np = np.array(query_embedding)
        
        # Fetch all script embeddings from database
        cur = conn.cursor()
        cur.execute("""
            SELECT se.script_id, se.embedding, s.title
            FROM script_embeddings se
            JOIN scripts s ON se.script_id = s.id
            WHERE se.script_id != %s
        """, (request.script_id or 0,))
        
        script_embeddings = cur.fetchall()
        
        # Calculate similarities
        similarities = []
        for script in script_embeddings:
            script_embedding = np.array(script["embedding"])
            similarity = np.dot(query_embedding_np, script_embedding) / (
                np.linalg.norm(query_embedding_np) * np.linalg.norm(script_embedding)
            )
            similarities.append({
                "script_id": script["script_id"],
                "title": script["title"],
                "similarity": float(similarity)
            })
        
        # Sort by similarity (highest first) and return top matches
        similarities.sort(key=lambda x: x["similarity"], reverse=True)
        top_similarities = similarities[:request.limit]
        
        return {"similar_scripts": top_similarities}
    
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to find similar scripts: {str(e)}"
        )
    finally:
        if conn:
            conn.close()

@app.get("/categories", tags=["Categories"])
async def get_categories():
    """Get the list of predefined script categories."""
    categories = [
        "System Administration",
        "Network Management",
        "Active Directory",
        "Security Tools",
        "Backup & Recovery",
        "Monitoring Scripts",
        "Automation Workflows",
        "Cloud Management",
        "Virtualization",
        "Development Tools",
        "Database Management",
        "Reporting Scripts",
        "File Operations",
        "User Management",
        "Configuration Management",
        "Deployment Scripts",
        "Troubleshooting Tools",
        "Data Processing",
        "Integration Scripts",
        "Documentation Generators"
    ]
    
    return {"categories": categories}

@app.post("/chat", response_model=ChatResponse, tags=["Chat"])
async def chat_with_powershell_expert(request: ChatRequest):
    """Chat with a PowerShell expert AI assistant."""
    try:
        # Default system prompt for PowerShell expertise
        default_system_prompt = """
        You are PSScriptGPT, a specialized PowerShell scripting assistant with expertise in Windows system administration, automation, and scripting best practices.
        
        Your primary goal is to help users write, understand, and improve PowerShell scripts.
        
        When providing answers:
        1. Offer complete, runnable code examples when appropriate
        2. Explain the "why" behind your recommendations, not just the "how"
        3. Highlight security considerations and best practices
        4. Consider performance implications of your suggestions
        5. Structure solutions to be modular and maintainable
        6. Respect PowerShell conventions and style guidelines
        7. When you don't know something, acknowledge it rather than guessing
        
        You have extensive knowledge about:
        - PowerShell language features up to PowerShell 7.3
        - Windows system administration and management
        - Common PowerShell modules (ActiveDirectory, Azure, etc.)
        - Error handling and debugging techniques
        - PowerShell security considerations
        - Script optimization and performance
        
        Your responses will be displayed in a code-focused environment, so markdown formatting for code blocks is appropriate.
        """
        
        # Prepare the messages
        messages = [
            {
                "role": "system", 
                "content": request.system_prompt if request.system_prompt else default_system_prompt
            }
        ]
        
        # Add user conversation history
        for msg in request.messages:
            messages.append({"role": msg.role, "content": msg.content})
            
        # Make the API call with retry logic
        @retry(
            stop=stop_after_attempt(3),
            wait=wait_exponential(min=1, max=10)
        )
        def get_chat_completion():
            return openai.ChatCompletion.create(
                model="gpt-4o",  # Use a capable model for PowerShell expertise
                messages=messages,
                temperature=0.7,
                max_tokens=4000,
                top_p=1.0,
                frequency_penalty=0.0,
                presence_penalty=0.0
            )
        
        response = get_chat_completion()
        assistant_response = response.choices[0].message.content
        
        # Save the chat history to the database for future reference
        try:
            conn = get_db_connection()
            cur = conn.cursor()
            
            # Store the chat conversation in a structured format
            # This assumes you have a chat_history table in your database
            cur.execute(
                """
                INSERT INTO chat_history
                (user_id, messages, response, timestamp)
                VALUES (%s, %s, %s, CURRENT_TIMESTAMP)
                RETURNING id
                """,
                (
                    1,  # Use a default user ID or extract from request
                    json.dumps([{"role": m.role, "content": m.content} for m in request.messages]),
                    assistant_response
                )
            )
            
            conn.commit()
        except Exception as e:
            print(f"Database error while saving chat history: {e}")
            # Continue even if database operation fails
        finally:
            if conn:
                conn.close()
        
        return {"response": assistant_response}
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Chat completion failed: {str(e)}"
        )

# Create a new table for chat history if it doesn't exist
def init_db():
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        # Create chat_history table if it doesn't exist
        cur.execute("""
        CREATE TABLE IF NOT EXISTS chat_history (
            id SERIAL PRIMARY KEY,
            user_id INTEGER,
            messages JSONB NOT NULL,
            response TEXT NOT NULL,
            timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            embedding vector(1536) NULL,
            FOREIGN KEY (user_id) REFERENCES users(id)
        );
        """)
        
        conn.commit()
        print("Database initialized with chat_history table")
    except Exception as e:
        print(f"Database initialization error: {e}")
    finally:
        if conn:
            conn.close()

# Initialize database when starting up
@app.on_event("startup")
async def startup_event():
    init_db()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)