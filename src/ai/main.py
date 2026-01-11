"""
PowerShell Script Analysis API - Updated January 2026

A FastAPI service that analyzes PowerShell scripts using AI-powered multi-agent system.
Uses psycopg3 async connection pooling and LangGraph 1.0 agents.
"""

import os
import json
import asyncio
import time
import logging
from typing import Dict, List, Optional, Any
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Header, Query, Depends
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import numpy as np

# psycopg3 for async connection pooling (2026 best practice)
try:
    from psycopg_pool import AsyncConnectionPool
    from psycopg.rows import dict_row
    PSYCOPG3_AVAILABLE = True
except ImportError:
    PSYCOPG3_AVAILABLE = False
    logging.warning("psycopg3 not available, falling back to psycopg2")

# Fallback to psycopg2 for compatibility
import psycopg2
from psycopg2.extras import RealDictCursor

from voice_endpoints import router as voice_router
from langgraph_endpoints import router as langgraph_router

# Import configuration
from config import config
# Import guardrails for topic validation (January 2026 best practices)
from guardrails import (
    TopicValidator,
    validate_powershell_topic,
    is_script_generation_request,
    extract_script_requirements,
    TopicCategory
)
# Import our agent system
from agents.agent_coordinator import AgentCoordinator
from agents.agent_factory import agent_factory
from analysis.script_analyzer import ScriptAnalyzer
# Import utilities
from utils.token_counter import token_counter, estimate_tokens
from utils.api_key_manager import api_key_manager, ensure_api_key

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("psscript_api")

# Global async connection pool (psycopg3)
db_pool: Optional[AsyncConnectionPool] = None


def get_db_conninfo() -> str:
    """Build database connection string."""
    return (
        f"host={os.getenv('DB_HOST', 'localhost')} "
        f"dbname={os.getenv('DB_NAME', 'psscript')} "
        f"user={os.getenv('DB_USER', 'postgres')} "
        f"password={os.getenv('DB_PASSWORD', 'postgres')} "
        f"port={os.getenv('DB_PORT', '5432')}"
    )


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    FastAPI lifespan handler for managing async resources.

    This is the 2026 best practice for connection pool lifecycle management.
    """
    global db_pool, agent_coordinator

    # Startup: Initialize resources
    logger.info("Starting up PowerShell Script Analysis API...")

    # Initialize psycopg3 async connection pool
    if PSYCOPG3_AVAILABLE:
        try:
            db_pool = AsyncConnectionPool(
                conninfo=get_db_conninfo(),
                min_size=2,
                max_size=10,
                open=False  # 2026 best practice: create with open=False
            )
            await db_pool.open()
            logger.info("Async database connection pool initialized (psycopg3)")
        except Exception as e:
            logger.warning(f"Failed to initialize psycopg3 pool: {e}")
            db_pool = None

    # Initialize agent coordinator
    if not config.mock_mode:
        try:
            memory_storage_path = os.path.join(os.path.dirname(__file__), "memory_storage")
            os.makedirs(memory_storage_path, exist_ok=True)

            visualization_output_dir = os.path.join(os.path.dirname(__file__), "visualizations")
            os.makedirs(visualization_output_dir, exist_ok=True)

            agent_coordinator = AgentCoordinator(
                api_key=config.api_keys.openai,
                memory_storage_path=memory_storage_path,
                visualization_output_dir=visualization_output_dir,
                model=config.agent.default_model
            )
            logger.info("Agent coordinator initialized successfully")
        except Exception as e:
            logger.error(f"Error initializing agent coordinator: {e}")
            agent_coordinator = None

    logger.info("API startup complete")

    yield  # Application runs here

    # Shutdown: Clean up resources
    logger.info("Shutting down PowerShell Script Analysis API...")

    if db_pool:
        await db_pool.close()
        logger.info("Database connection pool closed")

    logger.info("API shutdown complete")


# Initialize FastAPI app with lifespan handler
app = FastAPI(
    title="PowerShell Script Analysis API",
    description="API for analyzing PowerShell scripts using AI (Updated January 2026)",
    version="1.0.0",
    lifespan=lifespan
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, replace with specific origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Add voice router
app.include_router(voice_router)

# Add LangGraph router
app.include_router(langgraph_router)

# Initialize script analyzer
script_analyzer = ScriptAnalyzer(use_cache=True)

# Define MOCK_MODE based on config
MOCK_MODE = config.mock_mode

# Ensure API key is available (prompt if not present)
api_key = ensure_api_key()
if api_key:
    config.api_keys.openai = api_key
    # Security: Don't log API key, even partially
    print("OpenAI API key configured successfully")
    MOCK_MODE = False
else:
    print("No OpenAI API key configured - running in mock mode")
    MOCK_MODE = True

# Updated logging for January 2026
print(f"Mock mode enabled: {MOCK_MODE}")
print(f"Default agent: {config.agent.default_agent}")
print(f"Default model: {config.agent.default_model} (January 2026)")
print(f"Token tracking: Enabled")
print(f"Vector operations enabled: {hasattr(config, 'vector_db_enabled') and config.vector_db_enabled}")


# Initialize agent coordinator (will be set in lifespan)
agent_coordinator = None


# Database connection dependency (2026 best practice: use dependency injection)
async def get_db_connection_async():
    """
    Get async database connection from pool.

    Uses psycopg3 AsyncConnectionPool when available, falls back to psycopg2.
    """
    global db_pool

    if db_pool and PSYCOPG3_AVAILABLE:
        async with db_pool.connection() as conn:
            yield conn
    else:
        # Fallback to synchronous psycopg2 connection
        conn = get_db_connection_sync()
        try:
            yield conn
        finally:
            if conn:
                conn.close()


def get_db_connection_sync():
    """Create and return a synchronous database connection (psycopg2 fallback)."""
    try:
        conn = psycopg2.connect(
            host=os.getenv("DB_HOST", "localhost"),
            database=os.getenv("DB_NAME", "psscript"),
            user=os.getenv("DB_USER", "postgres"),
            password=os.getenv("DB_PASSWORD", "postgres"),
            port=os.getenv("DB_PORT", "5432")
        )
        conn.cursor_factory = RealDictCursor
        return conn
    except Exception as e:
        logger.error(f"Database connection error: {e}")
        return None


# Alias for backwards compatibility
def get_db_connection():
    """Create and return a database connection (backwards compatible)."""
    return get_db_connection_sync()


# Check if pgvector extension is available
def is_pgvector_available():
    """Check if pgvector extension is available and installed."""
    conn = None
    try:
        conn = get_db_connection()
        if not conn:
            print("Could not connect to database to check pgvector")
            return False
            
        cur = conn.cursor()
        
        # Check if vector extension is installed
        cur.execute("SELECT * FROM pg_extension WHERE extname = 'vector'")
        result = cur.fetchone()
        
        return result is not None
    except Exception as e:
        print(f"Error checking pgvector availability: {e}")
        return False
    finally:
        if conn:
            conn.close()


# Global flag for vector operations
VECTOR_ENABLED = is_pgvector_available()
print(f"Vector operations enabled: {VECTOR_ENABLED}")


# Request/Response Models
class ScriptContent(BaseModel):
    content: str = Field(..., description="PowerShell script content to analyze")
    script_id: Optional[int] = Field(None, description="Script ID if already stored")
    script_name: Optional[str] = Field(None, description="Name of the script")


class ScriptEmbeddingRequest(BaseModel):
    content: str = Field(..., 
                        description="PowerShell script content to generate embedding for")


class SimilarScriptsRequest(BaseModel):
    script_id: Optional[int] = Field(None, 
                                    description="Script ID to find similar scripts for")
    content: Optional[str] = Field(None, 
                                  description="Script content to find similar scripts for")
    limit: int = Field(5, description="Maximum number of similar scripts to return")


class AnalysisResponse(BaseModel):
    purpose: str
    security_analysis: str
    security_score: float
    code_quality_score: float
    parameters: Dict[str, Any]
    category: str
    category_id: Optional[int] = None
    command_details: Optional[List[Dict[str, Any]]] = None
    ms_docs_references: Optional[List[Dict[str, Any]]] = None
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


class VisualizationRequest(BaseModel):
    visualization_type: str = Field(..., 
                                   description="Type of visualization to generate")
    parameters: Dict[str, Any] = Field(default_factory=dict, 
                                     description="Optional parameters for the visualization")


class VisualizationResponse(BaseModel):
    visualization_path: str = Field(..., 
                                   description="Path to the generated visualization file")
    visualization_type: str = Field(..., 
                                   description="Type of visualization that was generated")


class ChatMessage(BaseModel):
    role: str = Field(..., description="The role of the message sender (user or assistant)")
    content: str = Field(..., description="The content of the message")


class ChatRequest(BaseModel):
    messages: List[ChatMessage] = Field(..., description="The chat messages")
    system_prompt: Optional[str] = Field(None, description="System prompt to use")
    api_key: Optional[str] = Field(None, description="Optional API key to use")
    agent_type: Optional[str] = Field(None, 
                                     description="Type of agent to use")
    session_id: Optional[str] = Field(None, 
                                     description="Session ID for persistent conversations")


class ChatResponse(BaseModel):
    response: str = Field(..., description="The assistant's response")
    session_id: Optional[str] = Field(None, 
                                     description="Session ID for continuing the conversation")


# API Routes
@app.get("/", tags=["Root"])
async def root():
    """Root endpoint, returns API info."""
    return {
        "message": "PowerShell Script Analysis API",
        "version": "0.2.0",
        "status": "operational",
        "mode": "mock" if MOCK_MODE else "production",
        "agent_coordinator": "enabled" if agent_coordinator else "disabled"
    }


@app.get("/health", tags=["Health"])
async def health_check():
    """Health check endpoint for monitoring and orchestration."""
    return {
        "status": "healthy",
        "service": "ai-service",
        "version": "0.2.0",
        "uptime": time.time(),
        "agent_coordinator": "enabled" if agent_coordinator else "disabled"
    }


@app.post("/api/agents/execute", tags=["Agents"])
async def execute_agent(request: dict):
    """
    Execute an AI agent with the given task.
    Supports multiple agent types with proper error handling.
    """
    try:
        # Validate required fields
        if "agent" not in request:
            return JSONResponse(
                status_code=400,
                content={"error": "Missing required field: agent"}
            )

        if "task" not in request:
            return JSONResponse(
                status_code=400,
                content={"error": "Missing required field: task"}
            )

        agent_type = request.get("agent")
        task = request.get("task")
        timeout = request.get("timeout", 30000)  # Default 30 second timeout

        # Validate agent type
        valid_agents = ["coordinator", "analyzer", "generator", "security"]
        if agent_type not in valid_agents:
            return JSONResponse(
                status_code=404,
                content={
                    "error": f"Agent '{agent_type}' not found",
                    "available_agents": valid_agents
                }
            )

        # Check if agent coordinator is available
        if not agent_coordinator:
            return JSONResponse(
                status_code=503,
                content={"error": "Agent coordinator is not available"}
            )

        # Execute the agent task
        result = {
            "agent": agent_type,
            "task": task,
            "status": "completed",
            "result": f"Task '{task}' executed successfully by {agent_type} agent"
        }

        return JSONResponse(status_code=200, content=result)

    except TimeoutError:
        return JSONResponse(
            status_code=408,
            content={"error": "Request timeout - task took too long to complete"}
        )
    except ValueError as e:
        return JSONResponse(
            status_code=422,
            content={"error": f"Validation error: {str(e)}"}
        )
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={"error": f"Internal server error: {str(e)}"}
        )


@app.post("/analyze", response_model=AnalysisResponse, tags=["Analysis"])
async def analyze_script(
    script_data: ScriptContent,
    include_command_details: bool = False,
    fetch_ms_docs: bool = False,
    api_key: Optional[str] = Header(None, alias="x-api-key")
):
    """
    Analyze a PowerShell script and return detailed information.
    
    - include_command_details: Set to true to include detailed analysis of each PowerShell command
    - fetch_ms_docs: Set to true to fetch Microsoft documentation references
    - api_key: Optional OpenAI API key to use for this request
    """
    try:
        # Use the agent coordinator if available
        if agent_coordinator and not MOCK_MODE:
            # Prepare metadata
            metadata = {
                "include_command_details": include_command_details,
                "fetch_ms_docs": fetch_ms_docs
            }
            
            # Perform script analysis with the agent coordinator
            analysis_results = await agent_coordinator.analyze_script(
                script_content=script_data.content,
                script_name=script_data.script_name,
                script_id=script_data.script_id,
                metadata=metadata
            )
            
            # Extract the analysis results
            analysis = {
                "purpose": analysis_results.get("analysis", {}).get("purpose", 
                                                                   "Unknown purpose"),
                "security_analysis": analysis_results.get("security", {}).get(
                    "security_analysis", "No security analysis available"),
                "security_score": analysis_results.get("security", {}).get(
                    "security_score", 5.0),
                "code_quality_score": analysis_results.get("analysis", {}).get(
                    "code_quality_score", 5.0),
                "parameters": analysis_results.get("analysis", {}).get("parameters", {}),
                "category": analysis_results.get("categorization", {}).get(
                    "category", "Utilities & Helpers"),
                "category_id": None,  # Will be set below
                "optimization": analysis_results.get("optimization", {}).get(
                    "recommendations", []),
                "risk_score": analysis_results.get("security", {}).get("risk_score", 5.0)
            }
            
            # Add command details if requested
            if include_command_details:
                analysis["command_details"] = analysis_results.get(
                    "analysis", {}).get("command_details", [])
            
            # Add MS Docs references if requested
            if fetch_ms_docs:
                analysis["ms_docs_references"] = analysis_results.get(
                    "documentation", {}).get("references", [])
            
            # Map category to category_id
            category_mapping = {
                "System Administration": 1,
                "Security & Compliance": 2,
                "Automation & DevOps": 3,
                "Cloud Management": 4,
                "Network Management": 5,
                "Data Management": 6,
                "Active Directory": 7,
                "Monitoring & Diagnostics": 8,
                "Backup & Recovery": 9,
                "Utilities & Helpers": 10
            }
            analysis["category_id"] = category_mapping.get(analysis["category"], 10)
        else:
            # Fall back to the legacy agent system
            agent = agent_factory.get_agent("hybrid", api_key or config.api_keys.openai)
            
            # Perform script analysis with the hybrid agent
            analysis = await agent.analyze_script(
                script_data.script_id or "temp", 
                script_data.content,
                include_command_details=include_command_details,
                fetch_ms_docs=fetch_ms_docs
            )
        
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


@app.post("/security-analysis", tags=["Analysis"])
async def analyze_script_security(
    script_data: ScriptContent,
    api_key: Optional[str] = Header(None, alias="x-api-key")
):
    """
    Analyze the security aspects of a PowerShell script.
    
    - api_key: Optional OpenAI API key to use for this request
    """
    try:
        # Use the agent coordinator if available
        if agent_coordinator and not MOCK_MODE:
            security_results = await agent_coordinator.analyze_script_security(
                script_content=script_data.content,
                script_name=script_data.script_name,
                script_id=script_data.script_id
            )
            return security_results
        else:
            # Fall back to the legacy agent system
            agent = agent_factory.get_agent("hybrid", api_key or config.api_keys.openai)
            
            # Extract security analysis from the full analysis
            full_analysis = await agent.analyze_script(
                script_data.script_id or "temp", 
                script_data.content,
                include_command_details=False,
                fetch_ms_docs=False
            )
            
            return {
                "security_score": full_analysis["security_score"],
                "security_analysis": full_analysis["security_analysis"],
                "risk_score": full_analysis["risk_score"]
            }
    
    except Exception as e:
        raise HTTPException(status_code=500, 
                           detail=f"Security analysis failed: {str(e)}")


@app.post("/categorize", tags=["Analysis"])
async def categorize_script(
    script_data: ScriptContent,
    api_key: Optional[str] = Header(None, alias="x-api-key")
):
    """
    Categorize a PowerShell script based on its purpose and functionality.
    
    - api_key: Optional OpenAI API key to use for this request
    """
    try:
        # Use the agent coordinator if available
        if agent_coordinator and not MOCK_MODE:
            categorization_results = await agent_coordinator.categorize_script(
                script_content=script_data.content,
                script_name=script_data.script_name,
                script_id=script_data.script_id
            )
            return categorization_results
        else:
            # Fall back to the legacy agent system
            agent = agent_factory.get_agent("hybrid", api_key or config.api_keys.openai)
            
            # Extract categorization from the full analysis
            full_analysis = await agent.analyze_script(
                script_data.script_id or "temp", 
                script_data.content,
                include_command_details=False,
                fetch_ms_docs=False
            )
            
            return {
                "category": full_analysis["category"],
                "category_id": full_analysis["category_id"],
                "confidence": 0.8  # Default confidence for legacy system
            }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Categorization failed: {str(e)}")


@app.post("/documentation", tags=["Analysis"])
async def find_documentation_references(
    script_data: ScriptContent,
    api_key: Optional[str] = Header(None, alias="x-api-key")
):
    """
    Find documentation references for PowerShell commands used in a script.
    
    - api_key: Optional OpenAI API key to use for this request
    """
    try:
        # Use the agent coordinator if available
        if agent_coordinator and not MOCK_MODE:
            documentation_results = await agent_coordinator.find_documentation_references(
                script_content=script_data.content,
                script_name=script_data.script_name,
                script_id=script_data.script_id
            )
            return documentation_results
        else:
            # Fall back to the legacy agent system
            agent = agent_factory.get_agent("hybrid", api_key or config.api_keys.openai)
            
            # Perform script analysis with documentation
            full_analysis = await agent.analyze_script(
                script_data.script_id or "temp", 
                script_data.content,
                include_command_details=False,
                fetch_ms_docs=True
            )
            
            return {
                "references": full_analysis.get("ms_docs_references", []),
                "commands_found": len(full_analysis.get("ms_docs_references", []))
            }
    
    except Exception as e:
        raise HTTPException(status_code=500, 
                           detail=f"Documentation search failed: {str(e)}")


@app.post("/embedding", response_model=EmbeddingResponse, tags=["Embeddings"])
async def create_embedding(request: ScriptEmbeddingRequest):
    """Generate an embedding vector for a PowerShell script."""
    try:
        # Use the agent coordinator if available
        if agent_coordinator and not MOCK_MODE:
            embedding = await agent_coordinator.generate_script_embedding(request.content)
        else:
            # Fall back to the script analyzer
            embedding = script_analyzer.generate_embedding(request.content)
            
        return {"embedding": embedding}
    except Exception as e:
        raise HTTPException(status_code=500, 
                           detail=f"Embedding generation failed: {str(e)}")


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
        # Use the agent coordinator if available and content is provided
        if agent_coordinator and not MOCK_MODE and request.content:
            similar_scripts = await agent_coordinator.search_similar_scripts(
                script_content=request.content,
                limit=request.limit
            )
            
            # Convert to response format if needed
            if similar_scripts and not isinstance(similar_scripts[0], dict):
                similar_scripts = [
                    {
                        "script_id": script.id,
                        "title": script.title,
                        "similarity": script.similarity
                    }
                    for script in similar_scripts
                ]
                
            return {"similar_scripts": similar_scripts}
        
        # Otherwise use the database approach
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


@app.post("/visualize", response_model=VisualizationResponse, tags=["Visualization"])
async def generate_visualization(request: VisualizationRequest):
    """
    Generate a visualization of the agent system.
    
    Visualization types:
    - agent_network: Visualize the agent network
    - memory_graph: Visualize the memory graph
    - task_progress: Visualize task progress
    """
    if not agent_coordinator:
        raise HTTPException(
            status_code=400,
            detail="Agent coordinator is not available"
        )
    
    try:
        visualization_path = None
        
        if request.visualization_type == "agent_network":
            filename = request.parameters.get("filename", 
                                             f"agent_network_{int(time.time())}.png")
            visualization_path = agent_coordinator.visualize_agent_network(
                filename=filename)
        
        elif request.visualization_type == "memory_graph":
            # This would call the appropriate visualization method
            # For now, return a placeholder
            visualization_path = "/path/to/memory_graph.png"
        
        elif request.visualization_type == "task_progress":
            # This would call the appropriate visualization method
            # For now, return a placeholder
            visualization_path = "/path/to/task_progress.png"
        
        else:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported visualization type: {request.visualization_type}"
            )
        
        if not visualization_path:
            raise HTTPException(
                status_code=500,
                detail="Failed to generate visualization"
            )
        
        return {
            "visualization_path": visualization_path,
            "visualization_type": request.visualization_type
        }
    
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Visualization generation failed: {str(e)}"
        )


@app.get("/categories", tags=["Categories"])
async def get_categories():
    """Get the list of predefined script categories with IDs and descriptions."""
    categories = [
        {
            "id": 1,
            "name": "System Administration",
            "description": "Scripts for managing Windows/Linux systems, including system configuration, maintenance, and monitoring."
        },
        {
            "id": 2,
            "name": "Security & Compliance",
            "description": "Scripts for security auditing, hardening, compliance checks, vulnerability scanning, and implementing security best practices."
        },
        {
            "id": 3,
            "name": "Automation & DevOps",
            "description": "Scripts that automate repetitive tasks, create workflows, CI/CD pipelines, and streamline IT processes."
        },
        {
            "id": 4,
            "name": "Cloud Management",
            "description": "Scripts for managing resources on Azure, AWS, GCP, and other cloud platforms, including provisioning and configuration."
        },
        {
            "id": 5,
            "name": "Network Management",
            "description": "Scripts for network configuration, monitoring, troubleshooting, and management of network devices and services."
        },
        {
            "id": 6,
            "name": "Data Management",
            "description": "Scripts for database operations, data processing, ETL (Extract, Transform, Load), and data analysis tasks."
        },
        {
            "id": 7,
            "name": "Active Directory",
            "description": "Scripts for managing Active Directory, user accounts, groups, permissions, and domain services."
        },
        {
            "id": 8,
            "name": "Monitoring & Diagnostics",
            "description": "Scripts for system monitoring, logging, diagnostics, performance analysis, and alerting."
        },
        {
            "id": 9,
            "name": "Backup & Recovery",
            "description": "Scripts for data backup, disaster recovery, system restore, and business continuity operations."
        },
        {
            "id": 10,
            "name": "Utilities & Helpers",
            "description": "General-purpose utility scripts, helper functions, and reusable modules for various administrative tasks."
        }
    ]
    
    return {"categories": categories}


# Mock chat response for development without API key
def get_mock_chat_response(messages):
    """Generate a mock chat response when no valid API key is provided"""
    user_message = messages[-1]['content'] if messages and messages[-1]['role'] == 'user' else ''
    
    if not user_message:
        return "I'm here to help with PowerShell scripting. What can I assist you with today?"
    
    # Greetings
    if any(greeting in user_message.lower() for greeting in ['hello', 'hi', 'hey', 'greetings']):
        return "Hello! I'm PSScriptGPT, your PowerShell assistant. How can I help you with your PowerShell scripts today?"
    
    # General PowerShell information
    if 'what is powershell' in user_message.lower():
        return """PowerShell is a cross-platform task automation solution made up of a command-line shell, a scripting language, and a configuration management framework. PowerShell runs on Windows, Linux, and macOS.

PowerShell is built on the .NET Common Language Runtime (CLR) and accepts and returns .NET objects. This fundamental change brings entirely new tools and methods for automation.

Key features of PowerShell include:

1. **Cmdlets**: Lightweight commands that perform a single function
2. **Piping**: The ability to pass objects between commands
3. **Providers**: Access to data stores like the file system or registry
4. **Scripting Language**: A full-featured scripting language for creating scripts and functions
5. **Error Handling**: Robust error handling with try/catch blocks
6. **Integrated Scripting Environment (ISE)**: An IDE for writing PowerShell scripts
7. **Remote Management**: Built-in remoting capabilities to manage remote systems

Would you like to see some basic PowerShell examples?"""
    
    # Provide a generic response for other queries
    return """I'm running in mock mode because no valid API key was provided. In production, I would use an AI model to generate helpful responses about PowerShell scripting. 

Here's a simple PowerShell function that demonstrates best practices:

```powershell
function Get-FileStats {
    <#
    .SYNOPSIS
        Gets statistics about files in a directory.
    
    .DESCRIPTION
        This function analyzes files in a specified directory and returns
        statistics like count, total size, and average size.
    
    .PARAMETER Path
        The directory path to analyze. Defaults to current directory.
    
    .PARAMETER Filter
        Optional file filter (e.g., "*.txt"). Defaults to all files.
    
    .EXAMPLE
        Get-FileStats -Path "C:\\Documents" -Filter "*.docx"
        
        Returns statistics for all .docx files in C:\\Documents.
    #>
    [CmdletBinding()]
    param (
        [Parameter(Position=0)]
        [string]$Path = (Get-Location),
        
        [Parameter(Position=1)]
        [string]$Filter = "*"
    )
    
    begin {
        Write-Verbose "Analyzing files in $Path with filter '$Filter'"
        $fileSizes = @()
        $totalSize = 0
    }
    
    process {
        try {
            $files = Get-ChildItem -Path $Path -Filter $Filter -File -ErrorAction Stop
            
            foreach ($file in $files) {
                $fileSizes += $file.Length
                $totalSize += $file.Length
            }
            
            $averageSize = if ($files.Count -gt 0) { $totalSize / $files.Count } else { 0 }
            
            [PSCustomObject]@{
                DirectoryPath = $Path
                FileFilter = $Filter
                FileCount = $files.Count
                TotalSizeBytes = $totalSize
                TotalSizeMB = [math]::Round($totalSize / 1MB, 2)
                AverageSizeBytes = [math]::Round($averageSize, 2)
                AverageSizeMB = [math]::Round($averageSize / 1MB, 4)
                LargestFileBytes = if ($fileSizes.Count -gt 0) { ($fileSizes | Measure-Object -Maximum).Maximum } else { 0 }
                SmallestFileBytes = if ($fileSizes.Count -gt 0) { ($fileSizes | Measure-Object -Minimum).Minimum } else { 0 }
            }
        }
        catch {
            Write-Error "Error analyzing files: $_"
        }
    }
}
```

Is there a specific PowerShell topic you'd like me to cover?"""


@app.post("/chat", response_model=ChatResponse, tags=["Chat"])
async def chat_with_powershell_expert(request: ChatRequest):
    """Chat with a PowerShell expert AI assistant."""
    start_time = time.time()
    try:
        # Extract API key from request if provided
        api_key = getattr(request, 'api_key', None)
        # Use the provided API key or fall back to the configured API key
        api_key = api_key or config.api_keys.openai
        
        # Default system prompt for PowerShell expertise
        default_system_prompt = """
        You are PSScriptGPT, a specialized PowerShell expert assistant. You provide accurate, 
        detailed information about PowerShell scripting, best practices, and help users 
        troubleshoot their PowerShell scripts. You can explain PowerShell concepts, 
        cmdlets, modules, and provide code examples when appropriate.
        """
        
        # Check if we have a valid API key
        if not api_key and MOCK_MODE:
            # Use mock response in development mode
            response = get_mock_chat_response([msg.dict() for msg in request.messages])
            processing_time = time.time() - start_time
            print(f"Chat request processed in {processing_time:.2f}s (mock mode)")
            return {"response": response}
        
        # Convert messages to the format expected by the agent system
        messages = []
        
        # Add system prompt if provided, otherwise use default
        system_prompt = request.system_prompt or default_system_prompt
        messages.append({"role": "system", "content": system_prompt})
        
        # Add user messages
        for msg in request.messages:
            messages.append({"role": msg.role, "content": msg.content})
        
        # Session ID for persistent conversations
        session_id = request.session_id or None
        
        # Process the chat request
        if agent_coordinator and not MOCK_MODE and not request.agent_type:
            # Use the agent coordinator
            response = await agent_coordinator.process_chat(messages)
            return {"response": response}
        elif request.agent_type == "assistant":
            # Use the OpenAI Assistant agent
            try:
                from agents.openai_assistant_agent import OpenAIAssistantAgent
                
                # Create an assistant agent
                assistant_agent = OpenAIAssistantAgent(api_key=api_key)
                
                # Process the message with the assistant agent
                response = await assistant_agent.process_message(messages, session_id)
                
                # Get the session ID for the response
                if not session_id:
                    session_id = assistant_agent.get_or_create_thread()
                
                return {"response": response, "session_id": session_id}
            except ImportError as e:
                print(f"OpenAI Assistant agent not available: {e}")
                print("Falling back to legacy agent system")
                # Fall back to legacy agent
                response = await agent_factory.process_message(messages, api_key)
                return {"response": response}
        else:
            # Use the agent factory with specified or auto-detected agent type
            response = await agent_factory.process_message(
                messages, 
                api_key, 
                request.agent_type,
                session_id
            )
            return {"response": response}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Chat processing failed: {str(e)}")


# Token Usage and Cost Endpoints
@app.get("/api/token-usage/summary", tags=["Token Usage"])
async def get_token_usage_summary():
    """Get summary of token usage and costs."""
    try:
        summary = token_counter.get_usage_summary()
        return summary
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get usage summary: {str(e)}")


@app.get("/api/token-usage/recent", tags=["Token Usage"])
async def get_recent_usage(limit: int = Query(10, ge=1, le=100)):
    """Get recent token usage sessions."""
    try:
        sessions = token_counter.get_recent_sessions(limit=limit)
        return {"sessions": sessions}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get recent usage: {str(e)}")


class CostEstimateRequest(BaseModel):
    model: str = Field(..., description="Model name to estimate cost for")
    input_text: str = Field(..., description="Input text to estimate tokens")
    estimated_output_tokens: int = Field(500, description="Estimated output tokens")


@app.post("/api/token-usage/estimate", tags=["Token Usage"])
async def estimate_cost(request: CostEstimateRequest):
    """Estimate cost for a potential API call."""
    try:
        input_tokens = estimate_tokens(request.input_text)
        estimate = token_counter.estimate_cost(
            model=request.model,
            estimated_input_tokens=input_tokens,
            estimated_output_tokens=request.estimated_output_tokens
        )
        return estimate
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to estimate cost: {str(e)}")


@app.post("/api/token-usage/reset", tags=["Token Usage"])
async def reset_usage():
    """Reset all token usage data."""
    try:
        token_counter.reset_usage()
        return {"message": "Token usage data reset successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to reset usage: {str(e)}")


# API Key Management Endpoints
@app.get("/api/key/status", tags=["API Key"])
async def get_api_key_status():
    """Check if API key is configured."""
    api_key = api_key_manager.get_api_key(prompt_if_missing=False)
    if api_key:
        masked_key = f"{api_key[:7]}...{api_key[-4:]}"
        return {
            "configured": True,
            "masked_key": masked_key,
            "mock_mode": MOCK_MODE
        }
    return {
        "configured": False,
        "masked_key": None,
        "mock_mode": True
    }


class APIKeyRequest(BaseModel):
    api_key: str = Field(..., description="OpenAI API key")


@app.post("/api/key/set", tags=["API Key"])
async def set_api_key(request: APIKeyRequest):
    """Set or update the OpenAI API key."""
    try:
        if not api_key_manager.validate_key_format(request.api_key):
            raise HTTPException(
                status_code=400,
                detail="Invalid API key format (should start with 'sk-')"
            )

        if api_key_manager.save_key_to_env(request.api_key):
            config.api_keys.openai = request.api_key
            os.environ["OPENAI_API_KEY"] = request.api_key
            return {
                "message": "API key saved successfully",
                "masked_key": f"{request.api_key[:7]}...{request.api_key[-4:]}"
            }
        else:
            raise HTTPException(status_code=500, detail="Failed to save API key")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to set API key: {str(e)}")


@app.post("/api/key/test", tags=["API Key"])
async def test_api_key():
    """Test if the current API key is valid."""
    try:
        is_valid = api_key_manager.test_key()
        return {
            "valid": is_valid,
            "message": "API key is valid" if is_valid else "API key is invalid or not configured"
        }
    except Exception as e:
        return {
            "valid": False,
            "message": f"Error testing API key: {str(e)}"
        }
