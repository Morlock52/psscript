"""
LangGraph API Endpoints

FastAPI endpoints for the LangGraph 1.0 production orchestrator.
Provides REST API access to PowerShell script analysis using LangGraph workflows.
"""

import logging
import json
from typing import Dict, Any, Optional, List, AsyncIterator
from fastapi import APIRouter, HTTPException, BackgroundTasks, Body
from fastapi.responses import StreamingResponse, JSONResponse
from pydantic import BaseModel, Field

from agents.langgraph_production import LangGraphProductionOrchestrator
from config import config

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("langgraph_endpoints")

# Create router
router = APIRouter(prefix="/langgraph", tags=["LangGraph"])

# Global orchestrator instance (initialized lazily)
_orchestrator: Optional[LangGraphProductionOrchestrator] = None


def get_orchestrator(api_key: Optional[str] = None) -> LangGraphProductionOrchestrator:
    """Get or create the global orchestrator instance."""
    global _orchestrator
    if _orchestrator is None:
        _orchestrator = LangGraphProductionOrchestrator(api_key=api_key)
    return _orchestrator


# ============================================================================
# Request/Response Models
# ============================================================================

class LangGraphAnalysisRequest(BaseModel):
    """Request model for LangGraph script analysis."""
    script_content: str = Field(..., description="PowerShell script content to analyze")
    thread_id: Optional[str] = Field(None, description="Thread ID for conversation continuity")
    require_human_review: bool = Field(False, description="Whether to require human review")
    stream: bool = Field(False, description="Whether to stream responses")
    model: Optional[str] = Field(config.agent.default_model, description="Model to use for analysis (default: configured best coding model)")
    api_key: Optional[str] = Field(None, description="Optional OpenAI API key")


class LangGraphAnalysisResponse(BaseModel):
    """Response model for LangGraph script analysis."""
    workflow_id: str = Field(..., description="Unique workflow identifier")
    status: str = Field(..., description="Workflow status (completed, in_progress, failed)")
    final_response: Optional[str] = Field(None, description="Final analysis summary")
    analysis_results: Dict[str, Any] = Field(default_factory=dict, description="Detailed analysis results")
    current_stage: str = Field(..., description="Current stage of workflow")
    started_at: str = Field(..., description="Workflow start timestamp")
    completed_at: Optional[str] = Field(None, description="Workflow completion timestamp")
    requires_human_review: bool = Field(False, description="Whether human review is required")


class HumanFeedbackRequest(BaseModel):
    """Request model for providing human feedback."""
    thread_id: str = Field(..., description="Thread ID of the workflow")
    feedback: str = Field(..., description="Human feedback to incorporate")


class WorkflowStatusRequest(BaseModel):
    """Request model for checking workflow status."""
    thread_id: str = Field(..., description="Thread ID of the workflow")


# ============================================================================
# API Endpoints
# ============================================================================

@router.post("/analyze")
async def analyze_script(request: LangGraphAnalysisRequest):
    """
    Analyze a PowerShell script using LangGraph 1.0 production orchestrator.

    This endpoint uses a state-of-the-art LangGraph workflow that:
    - Performs comprehensive script analysis
    - Conducts security scanning
    - Evaluates code quality
    - Generates optimization recommendations
    - Supports human-in-the-loop review
    - Provides durable execution with checkpointing

    **Example Request:**
    ```json
    {
        "script_content": "Get-Process | Where-Object CPU -gt 100",
        "model": "gpt-4",
        "require_human_review": false,
        "stream": true
    }
    ```

    **Returns:**
    - If streaming: Server-Sent Events stream with real-time updates
    - If not streaming: Complete analysis results with security findings, quality metrics, and recommendations
    """
    try:
        logger.info(f"Received LangGraph analysis request (stream={request.stream}) for thread_id: {request.thread_id}")

        # Get orchestrator
        orchestrator = get_orchestrator(api_key=request.api_key)

        # Handle streaming mode
        if request.stream:
            async def event_generator() -> AsyncIterator[str]:
                """Generate SSE events for streaming analysis."""
                try:
                    # Send connection event
                    yield f"data: {json.dumps({'type': 'connected', 'message': 'Stream started'})}\n\n"

                    # Call orchestrator with streaming enabled
                    # The orchestrator's analyze_script method returns events when stream=True
                    result = await orchestrator.analyze_script(
                        script_content=request.script_content,
                        thread_id=request.thread_id,
                        require_human_review=request.require_human_review,
                        stream=True,
                        model=request.model
                    )

                    # Stream the events from the orchestrator
                    # The orchestrator should yield events from the LangGraph workflow
                    if hasattr(result, '__aiter__'):
                        # If result is an async iterator, stream it
                        async for event in result:
                            event_data = {
                                'type': 'workflow_event',
                                'data': event
                            }
                            yield f"data: {json.dumps(event_data)}\n\n"
                    else:
                        # If result is a dict (non-streaming fallback), send as single event
                        yield f"data: {json.dumps({'type': 'completed', 'data': result})}\n\n"

                    # Send completion event
                    yield f"data: {json.dumps({'type': 'completed', 'message': 'Analysis complete'})}\n\n"

                except Exception as e:
                    logger.error(f"Streaming error: {e}", exc_info=True)
                    error_event = {
                        'type': 'error',
                        'message': str(e)
                    }
                    yield f"data: {json.dumps(error_event)}\n\n"

            return StreamingResponse(
                event_generator(),
                media_type="text/event-stream",
                headers={
                    "Cache-Control": "no-cache",
                    "Connection": "keep-alive",
                    "X-Accel-Buffering": "no"
                }
            )

        # Non-streaming mode: return JSON response
        result = await orchestrator.analyze_script(
            script_content=request.script_content,
            thread_id=request.thread_id,
            require_human_review=request.require_human_review,
            stream=False,
            model=request.model
        )

        logger.info(f"Analysis completed for workflow: {result.get('workflow_id')}")

        return JSONResponse(content=result)

    except Exception as e:
        logger.error(f"Error in analyze_script: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Script analysis failed: {str(e)}"
        )


@router.post("/feedback", response_model=LangGraphAnalysisResponse)
async def provide_human_feedback(request: HumanFeedbackRequest):
    """
    Provide human feedback to continue a paused workflow.

    When a workflow requires human review, it pauses and waits for feedback.
    Use this endpoint to provide that feedback and continue the workflow.

    **Example Request:**
    ```json
    {
        "thread_id": "analysis_1234567890",
        "feedback": "The security findings look accurate. Please proceed with generating optimizations."
    }
    ```

    **Returns:**
    - Updated analysis results after incorporating human feedback
    """
    try:
        logger.info(f"Received human feedback for thread: {request.thread_id}")

        # Get orchestrator
        orchestrator = get_orchestrator()

        # Continue with feedback
        result = await orchestrator.continue_with_feedback(
            thread_id=request.thread_id,
            human_feedback=request.feedback
        )

        logger.info(f"Workflow continued for: {request.thread_id}")

        return LangGraphAnalysisResponse(**result)

    except Exception as e:
        logger.error(f"Error in provide_human_feedback: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to process feedback: {str(e)}"
        )


@router.get("/health", tags=["Health"])
async def health_check():
    """
    Health check endpoint for LangGraph service.

    Returns the current status of the LangGraph orchestrator and
    information about available features.
    """
    try:
        orchestrator = get_orchestrator()

        return {
            "status": "healthy",
            "service": "LangGraph Production Orchestrator",
            "version": "1.0.5",
            "features": {
                "checkpointing": True,
                "human_in_the_loop": True,
                "streaming": True,
                "durable_execution": True
            },
            "model": orchestrator.model,
            "checkpointer_type": type(orchestrator.checkpointer).__name__
        }

    except Exception as e:
        logger.error(f"Health check failed: {e}")
        return {
            "status": "unhealthy",
            "error": str(e)
        }


@router.get("/info", tags=["Info"])
async def orchestrator_info():
    """
    Get detailed information about the LangGraph orchestrator.

    Returns information about:
    - Available tools
    - Workflow stages
    - Supported models
    - Configuration options
    """
    return {
        "orchestrator": "LangGraph Production Orchestrator",
        "version": "1.0.5",
        "description": "Production-grade PowerShell script analysis using LangGraph 1.0",
        "workflow_stages": [
            "analyze",
            "tools",
            "synthesis",
            "human_review"
        ],
        "available_tools": [
            {
                "name": "analyze_powershell_script",
                "description": "Analyze script purpose, functionality, and metrics"
            },
            {
                "name": "security_scan",
                "description": "Comprehensive security analysis and vulnerability detection"
            },
            {
                "name": "quality_analysis",
                "description": "Code quality evaluation and best practices compliance"
            },
            {
                "name": "generate_optimizations",
                "description": "Generate optimization recommendations"
            }
        ],
        "supported_models": [
            "gpt-5.2-codex",  # Best agentic coding model
            "gpt-5.2",        # Best general complex reasoning
            "gpt-5-mini",     # Fast interactive UX
            "gpt-5-nano"      # Fastest/high throughput
        ],
        "features": {
            "checkpointing": {
                "description": "Durable execution with state persistence",
                "backends": ["memory", "postgresql"]
            },
            "human_in_the_loop": {
                "description": "Pause workflows for human review and feedback",
                "enabled": True
            },
            "streaming": {
                "description": "Real-time streaming of workflow execution",
                "enabled": True
            },
            "error_recovery": {
                "description": "Automatic error handling and recovery",
                "enabled": True
            }
        },
        "migration": {
            "status": "available",
            "description": "LangGraph orchestrator consolidates 17 legacy agents into a single efficient workflow",
            "benefits": [
                "Simplified architecture",
                "Better state management",
                "Improved reliability",
                "Easier maintenance",
                "Production-ready checkpointing"
            ]
        }
    }


@router.post("/batch-analyze", tags=["Batch"])
async def batch_analyze_scripts(
    scripts: List[str] = Body(..., description="List of PowerShell scripts to analyze"),
    background_tasks: BackgroundTasks = None
):
    """
    Analyze multiple PowerShell scripts in batch.

    This endpoint accepts multiple scripts and processes them concurrently
    using the LangGraph orchestrator.

    **Note:** For large batches, consider using background tasks or
    a job queue system.

    **Example Request:**
    ```json
    {
        "scripts": [
            "Get-Process",
            "Get-Service | Where-Object Status -eq 'Running'"
        ]
    }
    ```
    """
    try:
        logger.info(f"Received batch analysis request for {len(scripts)} scripts")

        orchestrator = get_orchestrator()

        # Process scripts concurrently
        import asyncio
        tasks = [
            orchestrator.analyze_script(script_content=script)
            for script in scripts
        ]

        results = await asyncio.gather(*tasks, return_exceptions=True)

        # Format results
        successful = []
        failed = []

        for idx, result in enumerate(results):
            if isinstance(result, Exception):
                failed.append({
                    "index": idx,
                    "error": str(result)
                })
            else:
                successful.append({
                    "index": idx,
                    "workflow_id": result.get("workflow_id"),
                    "status": result.get("status")
                })

        return {
            "total": len(scripts),
            "successful": len(successful),
            "failed": len(failed),
            "results": successful,
            "errors": failed
        }

    except Exception as e:
        logger.error(f"Batch analysis failed: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Batch analysis failed: {str(e)}"
        )


# ============================================================================
# Utility Endpoints
# ============================================================================

@router.post("/test", tags=["Testing"])
async def test_orchestrator():
    """
    Test the LangGraph orchestrator with a simple example script.

    Useful for verifying that the orchestrator is working correctly.
    """
    try:
        test_script = """
        # Simple PowerShell script
        param(
            [Parameter(Mandatory=$true)]
            [string]$Path
        )

        Get-ChildItem -Path $Path -Recurse |
            Where-Object { $_.Extension -eq '.log' } |
            Select-Object Name, Length, LastWriteTime
        """

        orchestrator = get_orchestrator()
        result = await orchestrator.analyze_script(script_content=test_script)

        return {
            "test_status": "passed",
            "result": result
        }

    except Exception as e:
        logger.error(f"Test failed: {e}", exc_info=True)
        return {
            "test_status": "failed",
            "error": str(e)
        }
