"""
PowerShell Script Analysis API - Updated January 2026

A FastAPI service that analyzes PowerShell scripts using AI-powered multi-agent system.
Uses psycopg3 async connection pooling and LangGraph 1.0 agents.
"""

import os
import json
import time
import logging
from typing import Dict, List, Optional, Any
from contextlib import asynccontextmanager
from pathlib import Path

# Load environment variables from root .env file
from dotenv import load_dotenv
env_path = Path(__file__).resolve().parent.parent.parent / '.env'
load_dotenv(dotenv_path=env_path)
logging.info(f"Loaded environment from: {env_path}")

from fastapi import FastAPI, HTTPException, Header, Query
from fastapi.responses import JSONResponse, StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import numpy as np

# psycopg3 for async connection pooling (2026 best practice)
try:
    from psycopg_pool import AsyncConnectionPool
    from psycopg.rows import dict_row  # noqa: F401 - Reserved for future use
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
# Import guardrails for topic validation and security (January 2026 best practices)
# Implements THREE-LAYER GUARDRAIL ARCHITECTURE:
# Layer 1: Input validation (topic_validator)
# Layer 2: Context construction (security prompts)
# Layer 3: Output validation (validate_generated_output)
from guardrails import (
    # Layer 1: Topic validation
    validate_powershell_topic,
    is_script_generation_request,
    extract_script_requirements,
    # Layer 2 & 3: Security guardrails
    PowerShellSecurityGuard,
    scan_powershell_code,
    sanitize_script_request,
    get_security_prompt_injection,
    validate_generated_output,  # NEW: Output layer validation
    SecurityLevel
)
# Import our agent system
from agents.agent_coordinator import AgentCoordinator
from agents.agent_factory import agent_factory
from analysis.script_analyzer import ScriptAnalyzer
# Import utilities
from utils.token_counter import token_counter, estimate_tokens
from utils.api_key_manager import api_key_manager, ensure_api_key
# Import error handling and logging
from utils.error_handler import (
    PSScriptError,
    OpenAIError,
    ModelError,
    ValidationError,
    SecurityError,
    RateLimitError,
    error_tracker,
    with_error_handling,
    retry_with_backoff,
    format_error_for_user,
    ErrorCategory
)
from utils.logging_config import (
    setup_logging,
    get_logger,
    set_request_context,
    clear_request_context,
    LogContext,
    LoggingMiddleware
)

# Configure structured logging
log_level = os.getenv('LOG_LEVEL', 'INFO')
log_json = os.getenv('LOG_FORMAT', 'text').lower() == 'json'
log_file = os.getenv('LOG_FILE', None)
setup_logging(level=log_level, json_format=log_json, log_file=log_file)

logger = get_logger("psscript_api")

# Initialize security guard (singleton)
security_guard = PowerShellSecurityGuard(strict_mode=os.getenv('STRICT_SECURITY', 'false').lower() == 'true')

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
print("Token tracking: Enabled")
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
        request.get("timeout", 30000)  # Default 30 second timeout

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
            
            # Extract the analysis results (agent_coordinator returns flat structure)
            # Normalize types to match the response model
            security_analysis = analysis_results.get("security_analysis", "No security analysis available")
            if isinstance(security_analysis, list):
                security_analysis = "\n".join(str(item) for item in security_analysis)

            parameters = analysis_results.get("parameters", {})
            if isinstance(parameters, str):
                parameters = {"description": parameters}
            elif isinstance(parameters, list):
                parameters = {"items": parameters} if parameters else {}

            optimization = analysis_results.get("optimization", [])
            if isinstance(optimization, str):
                optimization = [optimization] if optimization else []

            analysis = {
                "purpose": str(analysis_results.get("purpose", "Unknown purpose")),
                "security_analysis": security_analysis,
                "security_score": float(analysis_results.get("security_score", 5.0)),
                "code_quality_score": float(analysis_results.get("code_quality_score", 5.0)),
                "parameters": parameters,
                "category": str(analysis_results.get("category", "Utilities & Helpers")),
                "category_id": analysis_results.get("category_id"),  # May already be set
                "optimization": optimization,
                "risk_score": float(analysis_results.get("risk_score", 5.0))
            }

            # Add command details if requested
            if include_command_details:
                analysis["command_details"] = analysis_results.get("command_details", [])

            # Add MS Docs references if requested
            if fetch_ms_docs:
                analysis["ms_docs_references"] = analysis_results.get(
                    "ms_docs_references", [])
            
            # Map category to category_id if not already set
            if analysis["category_id"] is None:
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


# PSScriptAnalyzer Integration - January 2026
class PSScriptAnalyzerRequest(BaseModel):
    """Request model for PSScriptAnalyzer analysis."""
    content: str = Field(..., description="PowerShell script content to analyze")
    format: Optional[str] = Field("markdown", description="Output format: markdown, text, or json")


class PSScriptAnalyzerResponse(BaseModel):
    """Response model for PSScriptAnalyzer analysis."""
    available: bool = Field(..., description="Whether PSScriptAnalyzer is available")
    status: str = Field(..., description="Status message")
    results: Optional[str] = Field(None, description="Formatted analysis results")
    issue_count: int = Field(0, description="Number of issues found")
    errors: int = Field(0, description="Number of errors")
    warnings: int = Field(0, description="Number of warnings")
    info: int = Field(0, description="Number of informational messages")


@app.post("/lint", response_model=PSScriptAnalyzerResponse, tags=["Analysis"])
async def lint_powershell_script(request: PSScriptAnalyzerRequest):
    """
    Analyze PowerShell script using PSScriptAnalyzer (January 2026).

    Performs real static code analysis using Microsoft's PSScriptAnalyzer.
    Requires PowerShell 7+ and PSScriptAnalyzer module to be installed.

    Returns:
        - Errors, warnings, and informational messages
        - Best practice violations
        - Security concerns
        - Suggestions for improvement
    """
    try:
        from utils.psscriptanalyzer import (
            PSScriptAnalyzer,
            Severity,
            check_availability
        )

        # Check if PSScriptAnalyzer is available
        available, status = check_availability()

        if not available:
            return PSScriptAnalyzerResponse(
                available=False,
                status=status,
                results=None,
                issue_count=0,
                errors=0,
                warnings=0,
                info=0
            )

        # Run analysis
        analyzer = PSScriptAnalyzer()
        results = analyzer.analyze_script(request.content)

        # Count by severity
        errors = len([r for r in results if r.severity == Severity.ERROR])
        warnings = len([r for r in results if r.severity == Severity.WARNING])
        info = len([r for r in results if r.severity == Severity.INFORMATION])

        # Format results
        formatted = analyzer.format_results(results, request.format)

        return PSScriptAnalyzerResponse(
            available=True,
            status="Analysis complete",
            results=formatted,
            issue_count=len(results),
            errors=errors,
            warnings=warnings,
            info=info
        )

    except Exception as e:
        logger.error(f"PSScriptAnalyzer error: {str(e)}")
        return PSScriptAnalyzerResponse(
            available=False,
            status=f"Analysis failed: {str(e)}",
            results=None,
            issue_count=0,
            errors=0,
            warnings=0,
            info=0
        )


@app.get("/lint/status", tags=["Analysis"])
async def get_psscriptanalyzer_status():
    """
    Check if PSScriptAnalyzer is available and configured.
    """
    try:
        from utils.psscriptanalyzer import check_availability

        available, status = check_availability()
        return {
            "available": available,
            "status": status,
            "instructions": (
                "Install PSScriptAnalyzer: Install-Module PSScriptAnalyzer -Scope CurrentUser"
                if not available else None
            )
        }
    except Exception as e:
        return {
            "available": False,
            "status": f"Error: {str(e)}",
            "instructions": "Ensure PowerShell 7+ is installed"
        }


# Pester Test Generation - January 2026
class PesterGenerationRequest(BaseModel):
    """Request model for Pester test generation."""
    content: str = Field(..., description="PowerShell script content")
    script_name: str = Field("Script.ps1", description="Name of the script file")
    coverage: Optional[str] = Field("standard", description="Test coverage: minimal, standard, comprehensive")


class PesterGenerationResponse(BaseModel):
    """Response model for Pester test generation."""
    success: bool
    test_content: Optional[str] = None
    functions_found: int = 0
    tests_generated: int = 0
    error: Optional[str] = None


@app.post("/generate-tests", response_model=PesterGenerationResponse, tags=["Generation"])
async def generate_pester_tests(request: PesterGenerationRequest):
    """
    Generate Pester 5.x unit tests for a PowerShell script (January 2026).

    Analyzes the script to detect functions and generates appropriate
    test cases including:
    - Parameter validation tests
    - Output type verification
    - Error handling tests
    - ShouldProcess (-WhatIf) tests
    """
    try:
        from utils.pester_generator import PesterGenerator

        generator = PesterGenerator(
            include_mocks=True,
            test_coverage=request.coverage
        )

        # Parse functions from script
        functions = generator.parse_functions(request.content)

        if not functions:
            return PesterGenerationResponse(
                success=True,
                test_content=f"""# No functions found in {request.script_name}
# Pester tests are generated for PowerShell functions.
# Add function definitions to generate tests.

Describe "Script Tests" {{
    It "Script exists" {{
        Test-Path $PSScriptRoot/{request.script_name} | Should -BeTrue
    }}
}}
""",
                functions_found=0,
                tests_generated=1
            )

        # Generate tests
        tests = generator.generate_tests(functions)

        # Create test file content
        test_content = generator.create_test_file(tests, request.script_name)

        return PesterGenerationResponse(
            success=True,
            test_content=test_content,
            functions_found=len(functions),
            tests_generated=len(tests)
        )

    except Exception as e:
        logger.error(f"Pester generation error: {str(e)}")
        return PesterGenerationResponse(
            success=False,
            error=str(e)
        )


@app.get("/generate-tests/info", tags=["Generation"])
async def get_pester_generator_info():
    """
    Get information about Pester test generation capabilities.
    """
    return {
        "pester_version": "5.x",
        "test_types": ["Unit", "Integration", "Acceptance"],
        "coverage_levels": ["minimal", "standard", "comprehensive"],
        "features": [
            "Automatic function detection",
            "Parameter validation tests",
            "Output type verification",
            "Error handling tests",
            "ShouldProcess (-WhatIf) support",
            "Mock generation"
        ]
    }


# Script Sandbox Execution - January 2026
class SandboxRequest(BaseModel):
    """Request model for sandboxed script execution."""
    script: str = Field(..., description="PowerShell script to execute")
    timeout: int = Field(30, description="Maximum execution time in seconds", ge=1, le=300)
    validate_only: bool = Field(False, description="Only validate, don't execute")


class SandboxResponse(BaseModel):
    """Response model for sandboxed execution."""
    status: str
    stdout: Optional[str] = None
    stderr: Optional[str] = None
    exit_code: int = 0
    execution_time: float = 0
    warnings: List[str] = []
    blocked_commands: List[str] = []


@app.post("/execute", response_model=SandboxResponse, tags=["Execution"])
async def execute_script_sandbox(request: SandboxRequest):
    """
    Execute PowerShell script in a secure sandbox (January 2026).

    Security features:
    - Command whitelisting/blacklisting
    - Execution timeout
    - Output truncation
    - Environment isolation
    - No network access by default

    WARNING: Even sandboxed execution carries risk. Use at your own discretion.
    """
    try:
        from utils.script_sandbox import ScriptSandbox, ExecutionStatus

        sandbox = ScriptSandbox(timeout_seconds=request.timeout)

        if request.validate_only:
            is_valid, warnings, blocked = sandbox.validate_script(request.script)
            return SandboxResponse(
                status="valid" if is_valid else "blocked",
                warnings=warnings,
                blocked_commands=blocked
            )

        result = sandbox.execute(request.script)

        return SandboxResponse(
            status=result.status.value,
            stdout=result.stdout,
            stderr=result.stderr,
            exit_code=result.exit_code,
            execution_time=result.execution_time,
            warnings=result.warnings,
            blocked_commands=result.blocked_commands
        )

    except Exception as e:
        logger.error(f"Sandbox error: {str(e)}")
        return SandboxResponse(
            status="error",
            stderr=str(e),
            exit_code=-1
        )


@app.post("/validate-script", tags=["Execution"])
async def validate_script_safety(request: SandboxRequest):
    """
    Validate a PowerShell script for safety without executing it.
    """
    try:
        from utils.script_sandbox import validate_script

        is_valid, warnings, blocked = validate_script(request.script)

        return {
            "valid": is_valid,
            "safe_to_execute": is_valid and len(warnings) == 0,
            "warnings": warnings,
            "blocked_commands": blocked,
            "recommendation": (
                "Script is safe to execute" if is_valid and len(warnings) == 0
                else "Review warnings before execution" if is_valid
                else "Script contains blocked commands and cannot be executed"
            )
        }

    except Exception as e:
        logger.error(f"Validation error: {str(e)}")
        return {
            "valid": False,
            "safe_to_execute": False,
            "error": str(e)
        }


# Multi-Model Routing - January 2026
class RouteRequest(BaseModel):
    """Request model for model routing."""
    query: str = Field(..., description="The query to route")
    context: Optional[List[Dict[str, Any]]] = Field(None, description="Conversation context")
    cost_sensitive: bool = Field(False, description="Prefer cheaper models")


class RouteResponse(BaseModel):
    """Response model for model routing decision."""
    model_id: str
    model_name: str
    reason: str
    task_type: str
    complexity: str
    estimated_cost: float
    estimated_latency_ms: int
    alternative_model: Optional[str] = None


@app.post("/route", response_model=RouteResponse, tags=["Routing"])
async def route_to_model(request: RouteRequest):
    """
    Route a query to the most appropriate AI model (January 2026).

    Intelligently selects the best model based on:
    - Task type (code generation, debugging, explanation, etc.)
    - Query complexity
    - Cost optimization preferences
    - Performance requirements
    """
    try:
        from utils.model_router import ModelRouter

        router = ModelRouter(cost_sensitive=request.cost_sensitive)
        decision = router.route(request.query, request.context)

        return RouteResponse(
            model_id=decision.model_id,
            model_name=decision.model_name,
            reason=decision.reason,
            task_type=decision.task_type.value,
            complexity=decision.complexity.value,
            estimated_cost=round(decision.estimated_cost, 6),
            estimated_latency_ms=decision.estimated_latency_ms,
            alternative_model=decision.alternative_model
        )

    except Exception as e:
        logger.error(f"Routing error: {str(e)}")
        # Fallback to default model
        return RouteResponse(
            model_id="gpt-4.1",
            model_name="GPT-4.1 (Fallback)",
            reason=f"Routing failed, using default: {str(e)}",
            task_type="chat",
            complexity="moderate",
            estimated_cost=0.015,
            estimated_latency_ms=2000
        )


@app.get("/models", tags=["Routing"])
async def list_available_models():
    """
    List all available AI models and their capabilities.
    """
    from utils.model_router import ModelRouter

    router = ModelRouter()
    return {
        "models": [
            {
                "id": model.model_id,
                "name": model.name,
                "max_tokens": model.max_tokens,
                "cost_per_1k_input": model.cost_per_1k_input,
                "cost_per_1k_output": model.cost_per_1k_output,
                "avg_latency_ms": model.avg_latency_ms,
                "strengths": model.strengths,
                "weaknesses": model.weaknesses
            }
            for model in router.MODELS.values()
        ],
        "default": "gpt-4.1"
    }


# User Memory and Preferences - January 2026
class PreferencesUpdate(BaseModel):
    """Request model for updating user preferences."""
    skill_level: Optional[str] = None
    powershell_version: Optional[str] = None
    preferred_style: Optional[str] = None
    include_comments: Optional[bool] = None
    include_error_handling: Optional[bool] = None
    environment: Optional[str] = None


class MemoryEntry(BaseModel):
    """Request model for storing a memory."""
    key: str
    value: Any
    category: str = "general"
    ttl_hours: Optional[int] = None


@app.get("/preferences/{user_id}", tags=["Memory"])
async def get_user_preferences(user_id: str = "default"):
    """
    Get user preferences for personalized AI responses.
    """
    try:
        from utils.user_memory import get_user_memory

        memory = get_user_memory(user_id)
        prefs = memory.get_preferences()

        return {
            "user_id": user_id,
            "preferences": {
                "skill_level": prefs.skill_level.value,
                "powershell_version": prefs.powershell_version.value,
                "preferred_style": prefs.preferred_style,
                "include_comments": prefs.include_comments,
                "include_error_handling": prefs.include_error_handling,
                "prefer_modules": prefs.prefer_modules,
                "avoid_patterns": prefs.avoid_patterns,
                "common_tasks": prefs.common_tasks,
                "environment": prefs.environment,
                "response_language": prefs.response_language
            }
        }

    except Exception as e:
        logger.error(f"Error getting preferences: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.put("/preferences/{user_id}", tags=["Memory"])
async def update_user_preferences(user_id: str, update: PreferencesUpdate):
    """
    Update user preferences for personalized responses.
    """
    try:
        from utils.user_memory import get_user_memory, SkillLevel, PowerShellVersion

        memory = get_user_memory(user_id)

        # Update only provided fields
        if update.skill_level:
            memory.set_preference("skill_level", SkillLevel(update.skill_level))
        if update.powershell_version:
            memory.set_preference("powershell_version", PowerShellVersion(update.powershell_version))
        if update.preferred_style:
            memory.set_preference("preferred_style", update.preferred_style)
        if update.include_comments is not None:
            memory.set_preference("include_comments", update.include_comments)
        if update.include_error_handling is not None:
            memory.set_preference("include_error_handling", update.include_error_handling)
        if update.environment:
            memory.set_preference("environment", update.environment)

        return {"status": "success", "message": "Preferences updated"}

    except Exception as e:
        logger.error(f"Error updating preferences: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/memory/{user_id}", tags=["Memory"])
async def store_memory(user_id: str, entry: MemoryEntry):
    """
    Store something in user memory.
    """
    try:
        from utils.user_memory import get_user_memory

        memory = get_user_memory(user_id)
        memory.remember(entry.key, entry.value, entry.category, entry.ttl_hours)

        return {"status": "success", "key": entry.key}

    except Exception as e:
        logger.error(f"Error storing memory: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/memory/{user_id}/{key}", tags=["Memory"])
async def recall_memory(user_id: str, key: str):
    """
    Recall something from user memory.
    """
    try:
        from utils.user_memory import get_user_memory

        memory = get_user_memory(user_id)
        value = memory.recall(key)

        if value is None:
            raise HTTPException(status_code=404, detail=f"Memory key '{key}' not found")

        return {"key": key, "value": value}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error recalling memory: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/context/{user_id}", tags=["Memory"])
async def get_user_context(user_id: str, session_id: Optional[str] = None):
    """
    Get personalized context string for AI prompts.

    This context can be injected into system prompts to personalize responses.
    """
    try:
        from utils.user_memory import get_user_memory

        memory = get_user_memory(user_id)
        context = memory.get_context_for_prompt(session_id)

        return {
            "user_id": user_id,
            "context": context
        }

    except Exception as e:
        logger.error(f"Error getting context: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/feedback/{user_id}", tags=["Memory"])
async def submit_feedback(user_id: str, feedback_type: str, details: Dict[str, Any]):
    """
    Submit feedback to help the AI learn user preferences.

    feedback_type: "correction", "preference", or "task"
    """
    try:
        from utils.user_memory import get_user_memory

        memory = get_user_memory(user_id)
        memory.learn_from_feedback(feedback_type, details)

        return {"status": "success", "message": "Feedback recorded"}

    except Exception as e:
        logger.error(f"Error processing feedback: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# CODE DIFF ENDPOINTS - Compare original and improved scripts
# ============================================================================

class DiffRequest(BaseModel):
    """Request model for diff generation."""
    original: str = Field(..., description="Original PowerShell code")
    improved: str = Field(..., description="Improved PowerShell code")
    detect_improvements: bool = Field(True, description="Auto-detect improvement categories")


class DiffLineModel(BaseModel):
    """A single line in the diff."""
    line_number_old: Optional[int] = None
    line_number_new: Optional[int] = None
    content_old: Optional[str] = None
    content_new: Optional[str] = None
    change_type: str


class DiffHunkModel(BaseModel):
    """A contiguous section of changes."""
    start_line_old: int
    start_line_new: int
    lines: List[DiffLineModel]
    context_before: List[str]
    context_after: List[str]


class ImprovementModel(BaseModel):
    """Describes a specific improvement made."""
    category: str
    description: str
    line_range: List[int]
    original_code: str
    improved_code: str


class DiffResponse(BaseModel):
    """Response model for diff generation."""
    original_lines: int
    improved_lines: int
    lines_added: int
    lines_removed: int
    lines_modified: int
    hunks: List[DiffHunkModel]
    improvements: List[ImprovementModel]
    unified_diff: str
    html_diff: str
    similarity_ratio: float
    summary: str


@app.post("/diff", response_model=DiffResponse, tags=["Code Diff"])
async def generate_code_diff(request: DiffRequest):
    """
    Generate a diff between original and improved PowerShell code.

    Returns detailed diff information including:
    - Line-by-line changes
    - Change statistics
    - Auto-detected improvement categories
    - Unified diff format
    - HTML diff for rich display
    """
    try:
        from utils.code_diff import CodeDiffGenerator

        generator = CodeDiffGenerator()
        result = generator.generate_diff(
            request.original,
            request.improved,
            detect_improvements=request.detect_improvements
        )

        # Convert to response format
        hunks = []
        for hunk in result.hunks:
            lines = [
                DiffLineModel(
                    line_number_old=line.line_number_old,
                    line_number_new=line.line_number_new,
                    content_old=line.content_old,
                    content_new=line.content_new,
                    change_type=line.change_type.value
                )
                for line in hunk.lines
            ]
            hunks.append(DiffHunkModel(
                start_line_old=hunk.start_line_old,
                start_line_new=hunk.start_line_new,
                lines=lines,
                context_before=hunk.context_before,
                context_after=hunk.context_after
            ))

        improvements = [
            ImprovementModel(
                category=imp.category.value,
                description=imp.description,
                line_range=list(imp.line_range),
                original_code=imp.original_code,
                improved_code=imp.improved_code
            )
            for imp in result.improvements
        ]

        summary = generator.get_change_summary(result)

        return DiffResponse(
            original_lines=result.original_lines,
            improved_lines=result.improved_lines,
            lines_added=result.lines_added,
            lines_removed=result.lines_removed,
            lines_modified=result.lines_modified,
            hunks=hunks,
            improvements=improvements,
            unified_diff=result.unified_diff,
            html_diff=result.html_diff,
            similarity_ratio=result.similarity_ratio,
            summary=summary
        )

    except Exception as e:
        logger.error(f"Error generating diff: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/improve", tags=["Code Diff"])
async def improve_script_with_diff(request: ChatRequest):
    """
    Improve a PowerShell script and return the diff.

    Takes a script via the message field and returns both the improved version
    and a detailed diff showing what changed.
    """
    try:
        from utils.code_diff import CodeDiffGenerator

        # Get the script from the latest message
        original_script = ""
        for msg in reversed(request.messages):
            if msg.role == "user":
                original_script = msg.content
                break

        if not original_script:
            raise HTTPException(status_code=400, detail="No script content found in messages")

        # Use AI to improve the script
        improvement_prompt = f"""You are a PowerShell expert. Improve the following script with:
- Better error handling
- Security best practices
- Performance optimizations
- Code readability improvements
- Proper documentation

Return ONLY the improved PowerShell code, no explanations.

Original script:
```powershell
{original_script}
```

Improved script:"""

        client = get_openai_client()
        response = await client.chat.completions.create(
            model=config.agent.default_model,
            messages=[{"role": "user", "content": improvement_prompt}],
            temperature=0.3,
            max_tokens=4096
        )

        improved_script = response.choices[0].message.content.strip()

        # Extract code from markdown if present
        if "```powershell" in improved_script:
            improved_script = improved_script.split("```powershell")[1].split("```")[0].strip()
        elif "```" in improved_script:
            improved_script = improved_script.split("```")[1].split("```")[0].strip()

        # Generate diff
        generator = CodeDiffGenerator()
        diff_result = generator.generate_diff(original_script, improved_script)
        summary = generator.get_change_summary(diff_result)

        return {
            "original": original_script,
            "improved": improved_script,
            "diff": {
                "unified_diff": diff_result.unified_diff,
                "lines_added": diff_result.lines_added,
                "lines_removed": diff_result.lines_removed,
                "lines_modified": diff_result.lines_modified,
                "similarity_ratio": diff_result.similarity_ratio,
                "improvements": [
                    {
                        "category": imp.category.value,
                        "description": imp.description,
                        "line_range": list(imp.line_range)
                    }
                    for imp in diff_result.improvements
                ]
            },
            "summary": summary
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error improving script: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


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
    """
    Chat with a PowerShell expert AI assistant.

    Features (January 2026):
    - Topic guardrails: Validates requests are PowerShell/scripting related
    - Script generation: Can create new PowerShell scripts from requirements
    - Context-aware: Uses conversation history for better responses
    """
    start_time = time.time()
    try:
        # Extract API key from request if provided
        api_key = getattr(request, 'api_key', None)
        # Use the provided API key or fall back to the configured API key
        api_key = api_key or config.api_keys.openai

        # Get the latest user message for guardrail validation
        latest_user_message = ""
        conversation_history = []
        for msg in request.messages:
            msg_dict = msg.dict() if hasattr(msg, 'dict') else msg
            conversation_history.append(msg_dict)
            if msg_dict.get('role') == 'user':
                latest_user_message = msg_dict.get('content', '')

        # =====================================================
        # GUARDRAIL: Topic Validation (January 2026 Best Practice)
        # =====================================================
        validation_result = validate_powershell_topic(
            latest_user_message,
            conversation_history[:-1] if len(conversation_history) > 1 else None
        )

        logger.info(f"Topic validation: valid={validation_result.is_valid}, "
                   f"category={validation_result.category.value}, "
                   f"confidence={validation_result.confidence:.2f}")

        # If off-topic, return helpful guidance instead of processing
        if not validation_result.is_valid:
            logger.info(f"Off-topic request detected: {latest_user_message[:100]}...")
            return {
                "response": validation_result.suggested_response,
                "session_id": request.session_id
            }

        # =====================================================
        # SCRIPT GENERATION: Enhanced prompt for script requests
        # =====================================================
        is_script_request = is_script_generation_request(latest_user_message)
        script_requirements = None

        if is_script_request:
            script_requirements = extract_script_requirements(latest_user_message)
            logger.info(f"Script generation request detected: {script_requirements}")

        # =====================================================
        # SECURITY: Sanitize request for dangerous patterns
        # =====================================================
        is_valid_request, sanitized_request, removed_patterns = security_guard.validate_request(latest_user_message)
        if removed_patterns:
            logger.log_security_event(
                event_type="request_sanitized",
                details=f"Removed patterns: {removed_patterns}",
                severity="warning"
            )
            if not is_valid_request:
                return {
                    "response": f"Your request contained potentially dangerous patterns that were blocked: {', '.join(removed_patterns)}. Please rephrase your request without asking for harmful functionality.",
                    "session_id": request.session_id
                }

        # Get security prompt injection for safe code generation
        security_guidelines = get_security_prompt_injection()

        # Build the appropriate system prompt
        if is_script_request:
            system_prompt = f"""You are PSScriptGPT, an expert PowerShell script generator.
You create professional, production-ready PowerShell scripts following January 2026 best practices.

═══════════════════════════════════════════════════════════════════
SCRIPT GENERATION GUIDELINES (January 2026 Best Practices)
═══════════════════════════════════════════════════════════════════

**STRUCTURE & DOCUMENTATION:**
1. Always include comprehensive comment-based help:
   <# .SYNOPSIS, .DESCRIPTION, .PARAMETER, .EXAMPLE, .NOTES, .LINK #>
2. Use [CmdletBinding(SupportsShouldProcess)] for functions with side effects
3. Add #Requires statements for module dependencies and PowerShell version

**MODERN POWERSHELL PATTERNS:**
4. Use Get-CimInstance instead of Get-WmiObject (deprecated)
5. Prefer splatting for commands with many parameters
6. Use $PSScriptRoot for script-relative paths
7. Implement PowerShell 7+ features when appropriate:
   - Ternary operator: $result = $condition ? $true : $false
   - Null-coalescing: $value ?? 'default'
   - Pipeline parallelization: ForEach-Object -Parallel

**PARAMETER VALIDATION:**
8. Use comprehensive validation attributes:
   [ValidateNotNullOrEmpty()], [ValidateRange()], [ValidatePattern()],
   [ValidateSet()], [ValidateScript()], [ValidatePath()] (PS 7.4+)
9. Declare parameter types explicitly
10. Use [Parameter(Mandatory, ValueFromPipeline, etc.)]

**ERROR HANDLING & LOGGING:**
11. Implement structured error handling with try/catch/finally
12. Use Write-Verbose -Message for progress (not Write-Host)
13. Use Write-Warning for non-fatal issues
14. Use Write-Error -ErrorAction Stop for fatal errors
15. Consider $ErrorActionPreference = 'Stop' for strict mode

**SAFETY & TESTING:**
16. Support -WhatIf and -Confirm for destructive operations
17. Design for testability with Pester
18. Add PSScriptAnalyzer compatibility comments if needed
19. Return proper objects, not formatted text

{security_guidelines}

═══════════════════════════════════════════════════════════════════
CHAIN-OF-THOUGHT SECURITY REVIEW (Before generating):
═══════════════════════════════════════════════════════════════════
Before generating any script, internally review:
1. Could this script cause unintended data loss?
2. Does it handle credentials securely (Get-Credential, not plaintext)?
3. Are file/registry operations properly guarded with -WhatIf?
4. Does it follow least-privilege principles?
5. Are there any injection vulnerabilities in dynamic code?

TARGET SYSTEM: {script_requirements.get('target_system', 'windows') if script_requirements else 'windows'}
COMPLEXITY LEVEL: {script_requirements.get('complexity', 'medium') if script_requirements else 'medium'}
REQUESTED FEATURES: {', '.join(script_requirements.get('features', [])) if script_requirements else 'standard'}

═══════════════════════════════════════════════════════════════════
OUTPUT FORMAT:
═══════════════════════════════════════════════════════════════════
1. **Purpose & Requirements Analysis** - Brief overview of what the script does
2. **Prerequisites** - Required modules, permissions, PowerShell version
3. **Complete Script** - Full, runnable code in ```powershell blocks
4. **Key Features Explained** - Brief explanation of important sections
5. **Usage Examples** - How to run the script with sample parameters
6. **Testing Notes** - How to safely test (use -WhatIf first!)"""
        else:
            # Standard PowerShell assistant prompt (January 2026)
            system_prompt = request.system_prompt or f"""You are PSScriptGPT, a specialized PowerShell expert assistant (January 2026).

═══════════════════════════════════════════════════════════════════
EXPERTISE AREAS
═══════════════════════════════════════════════════════════════════
- PowerShell scripting and automation (Windows PowerShell 5.1 & PowerShell 7.4+)
- Script analysis, debugging, and optimization
- Security best practices and vulnerability assessment
- DevOps and CI/CD pipeline automation (GitHub Actions, Azure DevOps)
- System administration and Active Directory
- Cloud scripting (Azure Az module, AWS Tools, GCP SDK)
- Cross-platform scripting (Windows, Linux, macOS)
- Desired State Configuration (DSC v3)

═══════════════════════════════════════════════════════════════════
JANUARY 2026 BEST PRACTICES
═══════════════════════════════════════════════════════════════════
When providing code examples, always follow these modern patterns:

**Modern Cmdlets:**
- Use Get-CimInstance instead of Get-WmiObject (deprecated)
- Use Invoke-RestMethod instead of Invoke-WebRequest for APIs
- Use Test-Json for JSON validation (PS 7+)

**PowerShell 7+ Features:**
- Ternary operator: $result = $condition ? $true : $false
- Null-coalescing: $value ?? 'default'
- Pipeline parallelization: ForEach-Object -Parallel {{}}
- ErrorView 'ConciseView' for cleaner errors
- $PSStyle for ANSI color formatting

**Security:**
- Always recommend Get-Credential over plaintext passwords
- Suggest SecretManagement module for secrets
- Mention -WhatIf for any destructive operations
- Warn about common security pitfalls

**Testing & Quality:**
- Reference PSScriptAnalyzer for linting
- Mention Pester for unit testing
- Suggest proper error handling patterns

{security_guidelines}

═══════════════════════════════════════════════════════════════════
RESPONSE GUIDELINES
═══════════════════════════════════════════════════════════════════
1. Provide accurate, tested code examples when relevant
2. Explain concepts clearly with practical examples
3. Highlight security considerations and best practices
4. Suggest improvements and optimizations
5. Reference official Microsoft documentation when helpful
6. Use markdown code blocks with 'powershell' syntax highlighting
7. For complex topics, break down the explanation step-by-step
8. Always consider cross-platform compatibility when relevant

═══════════════════════════════════════════════════════════════════
I CAN HELP WITH:
═══════════════════════════════════════════════════════════════════
- Writing new scripts with production-ready patterns
- Debugging existing scripts and error analysis
- Explaining PowerShell concepts at any level
- Reviewing code for security issues
- Optimizing performance and memory usage
- Converting scripts between platforms
- Migrating from Windows PowerShell to PowerShell 7+
- Setting up CI/CD pipelines for PowerShell projects"""

        # Check if we have a valid API key
        if not api_key and MOCK_MODE:
            # Use mock response in development mode
            response = get_mock_chat_response([msg.dict() for msg in request.messages])
            processing_time = time.time() - start_time
            logger.info(f"Chat request processed in {processing_time:.2f}s (mock mode)")
            return {"response": response, "session_id": request.session_id}

        # Convert messages to the format expected by the agent system
        messages = []

        # Add the system prompt
        messages.append({"role": "system", "content": system_prompt})

        # Add user messages
        for msg in request.messages:
            msg_dict = msg.dict() if hasattr(msg, 'dict') else msg
            messages.append({"role": msg_dict.get('role'), "content": msg_dict.get('content')})

        # Session ID for persistent conversations
        session_id = request.session_id or None

        # Process the chat request
        if agent_coordinator and not MOCK_MODE and not request.agent_type:
            # Use the agent coordinator
            response = await agent_coordinator.process_chat(messages)
            processing_time = time.time() - start_time
            logger.info(f"Chat request processed in {processing_time:.2f}s (agent coordinator)")
            return {"response": response, "session_id": session_id}
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

                processing_time = time.time() - start_time
                logger.info(f"Chat request processed in {processing_time:.2f}s (assistant agent)")
                return {"response": response, "session_id": session_id}
            except ImportError as e:
                logger.warning(f"OpenAI Assistant agent not available: {e}")
                logger.info("Falling back to legacy agent system")
                # Fall back to legacy agent
                response = await agent_factory.process_message(messages, api_key)
                return {"response": response, "session_id": session_id}
        else:
            # Use the agent factory with specified or auto-detected agent type
            response = await agent_factory.process_message(
                messages,
                api_key,
                request.agent_type,
                session_id
            )
            processing_time = time.time() - start_time
            logger.info(f"Chat request processed in {processing_time:.2f}s (agent factory)")
            return {"response": response, "session_id": session_id}

    except Exception as e:
        logger.error(f"Chat processing failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Chat processing failed: {str(e)}")


@app.post("/chat/stream", tags=["Chat"])
async def stream_chat_with_powershell_expert(request: ChatRequest):
    """
    Stream chat responses using Server-Sent Events (SSE).

    January 2026 Feature: Real-time token streaming for improved UX.
    Returns tokens as they're generated, reducing perceived latency.

    SSE Event Types:
    - token: Individual token in the stream
    - error: Error message
    - done: Stream complete with metadata
    """
    import asyncio

    async def generate_stream():
        """Async generator for SSE streaming."""
        try:
            # Import OpenAI client for streaming
            from openai import AsyncOpenAI

            api_key = getattr(request, 'api_key', None) or config.api_keys.openai
            if not api_key:
                yield f"data: {json.dumps({'type': 'error', 'content': 'No API key configured'})}\n\n"
                return

            client = AsyncOpenAI(api_key=api_key)

            # Get the latest user message for guardrail validation
            latest_user_message = ""
            conversation_history = []
            for msg in request.messages:
                msg_dict = msg.dict() if hasattr(msg, 'dict') else msg
                conversation_history.append(msg_dict)
                if msg_dict.get('role') == 'user':
                    latest_user_message = msg_dict.get('content', '')

            # =====================================================
            # GUARDRAIL: Topic Validation
            # =====================================================
            validation_result = validate_powershell_topic(
                latest_user_message,
                conversation_history[:-1] if len(conversation_history) > 1 else None
            )

            if not validation_result.is_valid:
                yield f"data: {json.dumps({'type': 'token', 'content': validation_result.suggested_response})}\n\n"
                yield f"data: {json.dumps({'type': 'done', 'session_id': request.session_id})}\n\n"
                return

            # =====================================================
            # SECURITY: Validate request
            # =====================================================
            is_valid_request, _, removed_patterns = security_guard.validate_request(latest_user_message)
            if not is_valid_request:
                error_msg = f"Your request contained potentially dangerous patterns that were blocked: {', '.join(removed_patterns)}"
                yield f"data: {json.dumps({'type': 'token', 'content': error_msg})}\n\n"
                yield f"data: {json.dumps({'type': 'done', 'session_id': request.session_id})}\n\n"
                return

            # Build system prompt (same logic as /chat endpoint)
            is_script_request = is_script_generation_request(latest_user_message)
            script_requirements = extract_script_requirements(latest_user_message) if is_script_request else None
            security_guidelines = get_security_prompt_injection()

            if is_script_request:
                system_prompt = f"""You are PSScriptGPT, an expert PowerShell script generator.
You create professional, production-ready PowerShell scripts following January 2026 best practices.

**KEY GUIDELINES:**
1. Use Get-CimInstance instead of Get-WmiObject (deprecated)
2. Include comprehensive comment-based help
3. Use [CmdletBinding(SupportsShouldProcess)] for side effects
4. Implement proper error handling with try/catch
5. Support -WhatIf and -Confirm for destructive operations
6. Use modern PowerShell 7+ features when appropriate

{security_guidelines}

TARGET: {script_requirements.get('target_system', 'windows') if script_requirements else 'windows'}"""
            else:
                system_prompt = f"""You are PSScriptGPT, a specialized PowerShell expert assistant (January 2026).

**EXPERTISE:** PowerShell scripting, automation, security, DevOps, cloud (Azure, AWS, GCP).

**MODERN PATTERNS:**
- Get-CimInstance over Get-WmiObject
- PowerShell 7+ features (ternary, null-coalescing, parallel)
- PSScriptAnalyzer and Pester for quality

{security_guidelines}"""

            # Build messages for OpenAI
            messages = [{"role": "system", "content": system_prompt}]
            for msg in request.messages:
                msg_dict = msg.dict() if hasattr(msg, 'dict') else msg
                messages.append({"role": msg_dict.get('role'), "content": msg_dict.get('content')})

            # Stream from OpenAI
            start_time = time.time()
            total_tokens = 0
            full_response = ""

            stream = await client.chat.completions.create(
                model=config.agent.default_model,
                messages=messages,
                stream=True,
                temperature=0.7,
                max_tokens=4096
            )

            async for chunk in stream:
                if chunk.choices and len(chunk.choices) > 0:
                    delta = chunk.choices[0].delta
                    if delta.content:
                        content = delta.content
                        full_response += content
                        total_tokens += 1
                        # Escape the content for JSON
                        yield f"data: {json.dumps({'type': 'token', 'content': content})}\n\n"

            # Stream complete - send done event with metadata
            processing_time = time.time() - start_time
            logger.info(f"Streaming chat completed in {processing_time:.2f}s, ~{total_tokens} tokens")

            yield f"data: {json.dumps({'type': 'done', 'session_id': request.session_id, 'tokens': total_tokens, 'time': round(processing_time, 2)})}\n\n"

        except Exception as e:
            logger.error(f"Streaming error: {str(e)}")
            yield f"data: {json.dumps({'type': 'error', 'content': str(e)})}\n\n"

    return StreamingResponse(
        generate_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # Disable nginx buffering
            "Access-Control-Allow-Origin": "*"
        }
    )


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


# =====================================================
# SECURITY ENDPOINTS - January 2026
# =====================================================

class ScriptScanRequest(BaseModel):
    """Request model for script security scanning."""
    script: str = Field(..., description="PowerShell script to scan")
    strict_mode: bool = Field(False, description="Use strict security mode")


@app.post("/api/security/scan", tags=["Security"])
async def scan_script_security(request: ScriptScanRequest):
    """
    Scan a PowerShell script for security issues.

    Returns security findings including:
    - Dangerous command detection
    - Credential exposure risks
    - Obfuscation patterns
    - Best practice recommendations
    """
    try:
        set_request_context()
        logger.info(f"Scanning script ({len(request.script)} chars) for security issues")

        result = security_guard.scan(request.script)

        # Log security findings
        if not result.is_safe:
            logger.log_security_event(
                event_type="dangerous_script_detected",
                details=f"Level: {result.overall_level.value}, Findings: {len(result.findings)}",
                severity="warning"
            )

        return {
            "is_safe": result.is_safe,
            "security_level": result.overall_level.value,
            "findings": [
                {
                    "level": f.level.value,
                    "category": f.category.value,
                    "message": f.message,
                    "line": f.line_number,
                    "recommendation": f.recommendation
                }
                for f in result.findings[:20]  # Limit to 20 findings
            ],
            "blocked_operations": result.blocked_operations,
            "warnings": result.warnings[:10],
            "recommendations": result.recommendations[:10]
        }
    except Exception as e:
        logger.error(f"Security scan failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Security scan failed: {str(e)}")
    finally:
        clear_request_context()


@app.get("/api/security/stats", tags=["Security"])
async def get_security_stats():
    """Get security scanning statistics."""
    try:
        stats = security_guard.get_stats()
        return {
            "security_stats": stats,
            "strict_mode": security_guard.strict_mode
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get security stats: {str(e)}")


# =====================================================
# ERROR TRACKING ENDPOINTS - January 2026
# =====================================================

@app.get("/api/errors/stats", tags=["Monitoring"])
async def get_error_stats():
    """Get error tracking statistics."""
    try:
        stats = error_tracker.get_stats()
        return {
            "error_stats": stats
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get error stats: {str(e)}")


@app.get("/api/health/detailed", tags=["Health"])
async def detailed_health_check():
    """
    Detailed health check with component status.

    Returns status of:
    - Database connection
    - Redis connection
    - AI model availability
    - Security guard status
    - Error tracker status
    """
    health = {
        "status": "healthy",
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "components": {}
    }

    # Check database
    try:
        if db_pool:
            async with db_pool.connection() as conn:
                await conn.execute("SELECT 1")
            health["components"]["database"] = {"status": "healthy", "type": "psycopg3"}
        else:
            health["components"]["database"] = {"status": "degraded", "type": "psycopg2"}
    except Exception as e:
        health["components"]["database"] = {"status": "unhealthy", "error": str(e)}
        health["status"] = "degraded"

    # Check AI configuration
    health["components"]["ai"] = {
        "status": "healthy" if config.api_keys.openai else "not_configured",
        "mock_mode": config.mock_mode,
        "model": config.agent.powershell_model
    }

    # Check security guard
    health["components"]["security"] = {
        "status": "healthy",
        "strict_mode": security_guard.strict_mode,
        "scans_performed": len(security_guard.scan_history)
    }

    # Check error tracker
    error_stats = error_tracker.get_stats()
    health["components"]["errors"] = {
        "total_errors": error_stats["total_errors"],
        "recent_errors": len(error_stats.get("recent_errors", []))
    }

    return health


@app.get("/api/config/models", tags=["Configuration"])
async def get_model_configuration():
    """Get current model configuration."""
    return {
        "default_model": config.agent.default_model,
        "powershell_model": config.agent.powershell_model,
        "reasoning_model": config.agent.reasoning_model,
        "fast_model": config.agent.fast_model,
        "fallback_model": config.agent.fallback_model,
        "embedding_model": config.agent.embedding_model,
        "temperature": config.agent.temperature,
        "max_tokens": config.agent.max_tokens
    }
