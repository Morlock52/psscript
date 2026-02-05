"""
LangGraph 1.0 Production Orchestrator

This module implements a production-grade LangGraph 1.0 workflow that consolidates
the functionality of multiple specialized agents into a single, efficient orchestrator.

Key Features:
- StateGraph for explicit state management
- Checkpointing for durability and recovery
- Human-in-the-loop capabilities
- Streaming support for real-time updates
- Production-ready error handling
- Comprehensive observability

Based on LangGraph 1.0.5 best practices (2026).
"""

import os
import json
import logging
from typing import Dict, List, Any, Optional, TypedDict, Annotated, Sequence, Literal
from datetime import datetime
import asyncio

# LangGraph 1.0 imports
from langgraph.graph import StateGraph, END
from langgraph.checkpoint.memory import MemorySaver
# Try to import PostgresSaver, fall back to MemorySaver if not available
try:
    from langgraph.checkpoint.postgres import PostgresSaver
    POSTGRES_AVAILABLE = True
except ImportError:
    PostgresSaver = None
    POSTGRES_AVAILABLE = False
from langgraph.prebuilt import ToolNode
from langgraph.graph.message import add_messages

# LangChain imports
from langchain_core.messages import BaseMessage, HumanMessage, SystemMessage, ToolMessage
from langchain_openai import ChatOpenAI
from config import ensure_chat_model
from langchain_core.tools import tool
from langchain_core.runnables import RunnableConfig

# Local imports (after path manipulation)
import sys
sys.path.append(os.path.dirname(os.path.dirname(__file__)))
from analysis.script_analyzer import ScriptAnalyzer  # noqa: E402

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("langgraph_production")


# ============================================================================
# State Definition
# ============================================================================

class PowerShellAnalysisState(TypedDict):
    """
    Production-grade state schema for PowerShell script analysis workflow.

    Uses TypedDict for type safety and LangGraph's add_messages for
    automatic message deduplication and ordering.
    """
    # Message history with automatic deduplication
    messages: Annotated[Sequence[BaseMessage], add_messages]

    # Script content being analyzed
    script_content: Optional[str]

    # Analysis results from various stages
    analysis_results: Dict[str, Any]

    # Current workflow stage
    current_stage: str

    # Security findings
    security_findings: List[Dict[str, Any]]

    # Code quality metrics
    quality_metrics: Dict[str, float]

    # Optimization recommendations
    optimizations: List[Dict[str, Any]]

    # Error tracking
    errors: List[Dict[str, Any]]

    # Metadata
    workflow_id: str
    started_at: str
    completed_at: Optional[str]

    # Human-in-the-loop flags
    requires_human_review: bool
    human_feedback: Optional[str]

    # Final output
    final_response: Optional[str]


# ============================================================================
# Tools Definition
# ============================================================================

@tool
def analyze_powershell_script(script_content: str) -> str:
    """
    Analyze a PowerShell script for its purpose, functionality, and basic metrics.

    Args:
        script_content: The PowerShell script code to analyze

    Returns:
        JSON string containing analysis results including purpose, complexity, and parameters
    """
    try:
        analyzer = ScriptAnalyzer(use_cache=True)
        result = analyzer.analyze_script_content(script_content)

        analysis = {
            "purpose": result.get("purpose", "Unknown"),
            "complexity": result.get("complexity", "Medium"),
            "parameters": result.get("parameters", {}),
            "functions": result.get("functions", []),
            "line_count": len(script_content.split('\n')),
            "timestamp": datetime.utcnow().isoformat()
        }

        return json.dumps(analysis, indent=2)
    except Exception as e:
        logger.error(f"Error in analyze_powershell_script: {e}")
        return json.dumps({"error": str(e)})


@tool
def security_scan(script_content: str) -> str:
    """
    Perform comprehensive security analysis on PowerShell script.

    Checks for:
    - Code injection vulnerabilities
    - Dangerous cmdlets
    - Execution policy bypasses
    - Network operations
    - File system access patterns

    Args:
        script_content: The PowerShell script code to scan

    Returns:
        JSON string with security findings and risk score
    """
    try:
        script_lower = script_content.lower()
        findings = []
        risk_score = 0

        # Critical security checks
        dangerous_patterns = {
            "invoke-expression": ("Code Injection Risk", 10, "Avoid using Invoke-Expression with untrusted input"),
            "iex ": ("Code Injection Risk", 10, "IEX is alias for Invoke-Expression - potential code injection"),
            "downloadstring": ("Remote Code Execution", 9, "Downloads and executes remote code"),
            "downloadfile": ("Untrusted Download", 7, "Downloads files from internet"),
            "bypass": ("Security Control Bypass", 8, "Attempts to bypass execution policy"),
            "-encodedcommand": ("Obfuscation", 8, "Uses encoded commands - possible obfuscation"),
            "hidden": ("Stealth Execution", 7, "Uses hidden window - stealth behavior"),
            "invoke-webrequest": ("Network Activity", 5, "Makes web requests"),
            "start-process": ("Process Creation", 6, "Spawns new processes"),
            "add-type": ("Code Compilation", 6, "Compiles and loads C# code"),
        }

        for pattern, (category, severity, description) in dangerous_patterns.items():
            if pattern in script_lower:
                findings.append({
                    "category": category,
                    "severity": severity,
                    "pattern": pattern,
                    "description": description
                })
                risk_score += severity

        # Best practices checks
        best_practices = []
        if "try" in script_lower and "catch" in script_lower:
            best_practices.append("Implements error handling")
        if "[cmdletbinding()]" in script_lower:
            best_practices.append("Uses advanced function features")
        if "validateset" in script_lower or "validatenotnull" in script_lower:
            best_practices.append("Uses parameter validation")

        # Calculate final risk level
        if risk_score > 30:
            risk_level = "CRITICAL"
        elif risk_score > 20:
            risk_level = "HIGH"
        elif risk_score > 10:
            risk_level = "MEDIUM"
        else:
            risk_level = "LOW"

        result = {
            "risk_level": risk_level,
            "risk_score": risk_score,
            "findings": findings,
            "findings_count": len(findings),
            "best_practices": best_practices,
            "timestamp": datetime.utcnow().isoformat()
        }

        return json.dumps(result, indent=2)
    except Exception as e:
        logger.error(f"Error in security_scan: {e}")
        return json.dumps({"error": str(e)})


@tool
def quality_analysis(script_content: str) -> str:
    """
    Analyze PowerShell script code quality and adherence to best practices.

    Evaluates:
    - Coding standards compliance
    - Documentation quality
    - Function organization
    - Error handling
    - Performance patterns

    Args:
        script_content: The PowerShell script code to analyze

    Returns:
        JSON string with quality metrics and recommendations
    """
    try:
        script_lower = script_content.lower()
        lines = script_content.split('\n')

        metrics = {
            "total_lines": len(lines),
            "comment_lines": sum(1 for line in lines if line.strip().startswith('#')),
            "empty_lines": sum(1 for line in lines if not line.strip()),
            "code_lines": 0
        }

        metrics["code_lines"] = metrics["total_lines"] - metrics["comment_lines"] - metrics["empty_lines"]
        metrics["comment_ratio"] = metrics["comment_lines"] / max(metrics["code_lines"], 1)

        # Quality indicators
        quality_score = 5.0
        issues = []
        recommendations = []

        # Positive indicators
        if "[cmdletbinding()]" in script_lower:
            quality_score += 1.0
        else:
            recommendations.append("Add [CmdletBinding()] for advanced function features")

        if "param(" in script_lower:
            quality_score += 0.5
        else:
            recommendations.append("Define parameters using param() block")

        if metrics["comment_ratio"] > 0.1:
            quality_score += 0.5
        else:
            recommendations.append("Add more comments to improve code documentation")

        if "try" in script_lower and "catch" in script_lower:
            quality_score += 1.0
        else:
            recommendations.append("Implement try/catch error handling")

        # Negative indicators
        if metrics["code_lines"] > 500:
            quality_score -= 0.5
            issues.append("Script is very long - consider breaking into modules")

        # Long lines check
        long_lines = sum(1 for line in lines if len(line) > 120)
        if long_lines > 5:
            quality_score -= 0.5
            issues.append(f"{long_lines} lines exceed 120 characters")

        quality_score = max(0.0, min(10.0, quality_score))

        result = {
            "quality_score": round(quality_score, 1),
            "metrics": metrics,
            "issues": issues,
            "recommendations": recommendations,
            "timestamp": datetime.utcnow().isoformat()
        }

        return json.dumps(result, indent=2)
    except Exception as e:
        logger.error(f"Error in quality_analysis: {e}")
        return json.dumps({"error": str(e)})


@tool
def generate_optimizations(script_content: str, quality_metrics: str) -> str:
    """
    Generate optimization recommendations based on script analysis.

    Args:
        script_content: The PowerShell script code
        quality_metrics: JSON string of quality analysis results

    Returns:
        JSON string with optimization recommendations
    """
    try:
        optimizations = []

        # Parse quality metrics if provided
        metrics = {}
        if quality_metrics:
            try:
                metrics = json.loads(quality_metrics)
            except (json.JSONDecodeError, TypeError):
                pass

        script_lower = script_content.lower()

        # Performance optimizations
        if "foreach" in script_lower and "%" in script_lower:
            optimizations.append({
                "category": "Performance",
                "priority": "Medium",
                "recommendation": "Consider using .ForEach() method instead of ForEach-Object for better performance",
                "impact": "Can improve loop performance by 2-3x"
            })

        if "where-object" in script_lower or "?" in script_lower:
            optimizations.append({
                "category": "Performance",
                "priority": "Medium",
                "recommendation": "Consider using .Where() method instead of Where-Object",
                "impact": "Faster filtering for large datasets"
            })

        # Code organization
        code_lines = metrics.get("metrics", {}).get("code_lines", 0)
        if code_lines > 200:
            optimizations.append({
                "category": "Maintainability",
                "priority": "High",
                "recommendation": "Break script into smaller, reusable functions",
                "impact": "Improves readability and maintainability"
            })

        # Error handling
        if "try" not in script_lower:
            optimizations.append({
                "category": "Reliability",
                "priority": "High",
                "recommendation": "Add try/catch blocks for error handling",
                "impact": "Prevents script failures and improves debugging"
            })

        # Documentation
        comment_ratio = metrics.get("metrics", {}).get("comment_ratio", 0)
        if comment_ratio < 0.1:
            optimizations.append({
                "category": "Documentation",
                "priority": "Medium",
                "recommendation": "Add comment-based help and inline comments",
                "impact": "Improves code understanding and maintenance"
            })

        result = {
            "total_optimizations": len(optimizations),
            "optimizations": optimizations,
            "timestamp": datetime.utcnow().isoformat()
        }

        return json.dumps(result, indent=2)
    except Exception as e:
        logger.error(f"Error in generate_optimizations: {e}")
        return json.dumps({"error": str(e)})


# Tool collection for the graph
tools = [
    analyze_powershell_script,
    security_scan,
    quality_analysis,
    generate_optimizations
]


# ============================================================================
# Graph Nodes
# ============================================================================

async def analyze_node(state: PowerShellAnalysisState, config: RunnableConfig) -> PowerShellAnalysisState:
    """
    Initial analysis node - determines what analysis to perform.
    """
    logger.info(f"Entering analyze_node for workflow {state.get('workflow_id')}")

    # Get the LLM with tools
    llm = ChatOpenAI(
        model=config.get("configurable", {}).get("model", "gpt-5-mini"),
        temperature=0,
        streaming=True
    )
    llm_with_tools = llm.bind_tools(tools)

    # Create the system prompt
    system_prompt = """You are an expert PowerShell script analyzer. Your job is to:

1. Analyze PowerShell scripts for their purpose and functionality
2. Identify security vulnerabilities and risks
3. Assess code quality and best practices
4. Generate optimization recommendations

Always use the available tools to perform thorough analysis. Work step by step:
- First, analyze the script purpose and structure
- Then, perform security scanning
- Next, analyze code quality
- Finally, generate optimization recommendations

Provide clear, actionable insights."""

    # Prepare messages
    messages = [SystemMessage(content=system_prompt)] + list(state["messages"])

    # Invoke LLM
    response = await llm_with_tools.ainvoke(messages, config)

    # Update state
    return {
        **state,
        "messages": state["messages"] + [response],
        "current_stage": "analysis"
    }


async def tool_execution_node(state: PowerShellAnalysisState, config: RunnableConfig) -> PowerShellAnalysisState:
    """
    Execute tools requested by the LLM.
    Uses LangGraph's ToolNode for automatic tool execution.
    """
    logger.info(f"Executing tools for workflow {state.get('workflow_id')}")

    # Create tool node
    tool_node = ToolNode(tools)

    # Execute tools
    result = await tool_node.ainvoke(state, config)

    return {
        **state,
        "messages": result["messages"],
        "current_stage": "tool_execution"
    }


async def synthesis_node(state: PowerShellAnalysisState, config: RunnableConfig) -> PowerShellAnalysisState:
    """
    Synthesize all analysis results into a final response.
    """
    logger.info(f"Synthesizing results for workflow {state.get('workflow_id')}")

    llm = ChatOpenAI(
        model=config.get("configurable", {}).get("model", "gpt-5-mini"),
        temperature=0.3,
        streaming=True
    )

    # Create synthesis prompt
    synthesis_prompt = """Based on all the analysis performed, provide a comprehensive summary that includes:

1. **Script Purpose**: What the script does
2. **Security Assessment**: Risk level and key findings
3. **Quality Evaluation**: Code quality score and main issues
4. **Optimization Opportunities**: Top recommendations for improvement

Format your response in clear sections with actionable insights."""

    messages = list(state["messages"]) + [HumanMessage(content=synthesis_prompt)]

    response = await llm.ainvoke(messages, config)

    return {
        **state,
        "messages": state["messages"] + [response],
        "final_response": response.content,
        "completed_at": datetime.utcnow().isoformat(),
        "current_stage": "completed"
    }


async def human_review_node(state: PowerShellAnalysisState, config: RunnableConfig) -> PowerShellAnalysisState:
    """
    Node for human-in-the-loop review.
    Pauses workflow if human review is required.
    """
    logger.info(f"Human review requested for workflow {state.get('workflow_id')}")

    if state.get("requires_human_review"):
        # In production, this would trigger a notification/webhook
        logger.warning("Human review required - workflow paused")

        # If human feedback is provided, incorporate it
        if state.get("human_feedback"):
            feedback_message = HumanMessage(
                content=f"Human reviewer feedback: {state['human_feedback']}"
            )
            return {
                **state,
                "messages": state["messages"] + [feedback_message],
                "requires_human_review": False,
                "current_stage": "human_reviewed"
            }

    return state


# ============================================================================
# Routing Logic
# ============================================================================

def should_continue(state: PowerShellAnalysisState) -> Literal["tools", "synthesis", "human_review", END]:
    """
    Determines the next node based on current state.

    This is the core routing logic for the graph.
    """
    messages = state["messages"]
    last_message = messages[-1] if messages else None

    # Check if human review is required
    if state.get("requires_human_review") and not state.get("human_feedback"):
        return "human_review"

    # If the last message has tool calls, execute them
    if last_message and hasattr(last_message, "tool_calls") and last_message.tool_calls:
        return "tools"

    # If we have tool results but no final response, continue analysis
    tool_messages = [m for m in messages if isinstance(m, ToolMessage)]
    if tool_messages and not state.get("final_response"):
        # If we have at least 3 tool executions, move to synthesis
        if len(tool_messages) >= 3:
            return "synthesis"
        # Otherwise, continue analysis
        return "analyze"

    # If we have a final response, we're done
    if state.get("final_response"):
        return END

    # Default: continue to synthesis
    return "synthesis"


def route_after_human_review(state: PowerShellAnalysisState) -> Literal["analyze", "synthesis"]:
    """Route after human review node."""
    if state.get("human_feedback"):
        return "analyze"  # Re-analyze with human feedback
    return "synthesis"


# ============================================================================
# Graph Construction
# ============================================================================

def create_production_graph(checkpointer=None) -> StateGraph:
    """
    Create the production-grade LangGraph workflow.

    Args:
        checkpointer: Optional checkpointer for persistence

    Returns:
        Compiled StateGraph ready for execution
    """
    # Create the graph
    workflow = StateGraph(PowerShellAnalysisState)

    # Add nodes
    workflow.add_node("analyze", analyze_node)
    workflow.add_node("tools", tool_execution_node)
    workflow.add_node("synthesis", synthesis_node)
    workflow.add_node("human_review", human_review_node)

    # Set entry point
    workflow.set_entry_point("analyze")

    # Add conditional edges from analyze node
    workflow.add_conditional_edges(
        "analyze",
        should_continue,
        {
            "tools": "tools",
            "synthesis": "synthesis",
            "human_review": "human_review",
            END: END
        }
    )

    # After tool execution, go back to analyze
    workflow.add_edge("tools", "analyze")

    # After synthesis, end
    workflow.add_edge("synthesis", END)

    # After human review, route based on feedback
    workflow.add_conditional_edges(
        "human_review",
        route_after_human_review,
        {
            "analyze": "analyze",
            "synthesis": "synthesis"
        }
    )

    # Compile with optional checkpointer
    if checkpointer:
        return workflow.compile(checkpointer=checkpointer)
    return workflow.compile()


# ============================================================================
# Production Orchestrator Class
# ============================================================================

class LangGraphProductionOrchestrator:
    """
    Production-ready PowerShell script analysis orchestrator using LangGraph 1.0.

    Features:
    - Durable execution with checkpointing
    - Streaming responses
    - Human-in-the-loop support
    - Comprehensive error handling
    - Production observability
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        model: str = "gpt-5-mini",
        use_postgres_checkpointing: bool = False,
        postgres_connection_string: Optional[str] = None
    ):
        """
        Initialize the orchestrator.

        Args:
            api_key: OpenAI API key
            model: Model to use for analysis
            use_postgres_checkpointing: Whether to use PostgreSQL for checkpointing
            postgres_connection_string: PostgreSQL connection string
        """
        self.api_key = api_key or os.environ.get("OPENAI_API_KEY")
        if not self.api_key:
            raise ValueError("OpenAI API key is required")

        os.environ["OPENAI_API_KEY"] = self.api_key

        self.model = ensure_chat_model(model)

        # Setup checkpointing
        if use_postgres_checkpointing and postgres_connection_string and POSTGRES_AVAILABLE:
            logger.info("Using PostgreSQL checkpointing for production durability")
            self.checkpointer = PostgresSaver(postgres_connection_string)
        else:
            if use_postgres_checkpointing and not POSTGRES_AVAILABLE:
                logger.warning("PostgreSQL checkpointing requested but PostgresSaver not available, falling back to MemorySaver")
            logger.info("Using in-memory checkpointing")
            self.checkpointer = MemorySaver()

        # Create the graph
        self.graph = create_production_graph(checkpointer=self.checkpointer)

        logger.info(f"LangGraph Production Orchestrator initialized with model: {self.model}")

    async def analyze_script(
        self,
        script_content: str,
        thread_id: Optional[str] = None,
        require_human_review: bool = False,
        stream: bool = False,
        model: Optional[str] = None
    ):
        """
        Analyze a PowerShell script using the LangGraph workflow.

        Args:
            script_content: The PowerShell script to analyze
            thread_id: Optional thread ID for conversation continuity
            require_human_review: Whether to require human review
            stream: Whether to stream responses (returns async generator if True)

        Returns:
            If stream=True: Async generator yielding events
            If stream=False: Dict[str, Any] with complete analysis results
        """
        # Generate workflow ID
        workflow_id = thread_id or f"analysis_{datetime.utcnow().timestamp()}"

        # Initialize state
        initial_state: PowerShellAnalysisState = {
            "messages": [
                HumanMessage(
                    content=f"Please analyze this PowerShell script:\n\n```powershell\n{script_content}\n```"
                )
            ],
            "script_content": script_content,
            "analysis_results": {},
            "current_stage": "initialized",
            "security_findings": [],
            "quality_metrics": {},
            "optimizations": [],
            "errors": [],
            "workflow_id": workflow_id,
            "started_at": datetime.utcnow().isoformat(),
            "completed_at": None,
            "requires_human_review": require_human_review,
            "human_feedback": None,
            "final_response": None
        }

        # Configuration
        # NOTE: We pass the model per request via LangGraph's configurable config
        # instead of mutating self.model (which is shared when the orchestrator is global).
        config = {
            "configurable": {
                "thread_id": workflow_id,
                "model": ensure_chat_model(model or self.model)
            }
        }

        try:
            if stream:
                # Return async generator for streaming
                return self._stream_analysis(initial_state, config, workflow_id)
            else:
                # Non-streaming execution
                final_state = await self.graph.ainvoke(initial_state, config)
                return self._format_response(final_state)

        except Exception as e:
            logger.error(f"Error in analyze_script: {e}", exc_info=True)
            return {
                "error": str(e),
                "workflow_id": workflow_id,
                "status": "failed"
            }

    async def _stream_analysis(self, initial_state, config, workflow_id):
        """
        Async generator that yields workflow events for streaming.
        """
        try:
            final_state = None
            async for event in self.graph.astream(initial_state, config):
                logger.info(f"Stream event: {event}")

                # Format and yield the event
                # LangGraph events are dicts with node names as keys
                for node_name, node_state in event.items():
                    event_data = {
                        "node": node_name,
                        "stage": node_state.get("current_stage", "unknown"),
                        "workflow_id": workflow_id,
                        "timestamp": datetime.utcnow().isoformat()
                    }

                    # Include relevant state information
                    if node_state.get("final_response"):
                        event_data["final_response"] = node_state.get("final_response")
                    if node_state.get("analysis_results"):
                        event_data["analysis_results"] = node_state.get("analysis_results")
                    if node_state.get("current_stage"):
                        event_data["current_stage"] = node_state.get("current_stage")

                    yield event_data
                    final_state = node_state

            # Yield final completion event
            if final_state:
                yield {
                    "node": "complete",
                    "stage": "completed",
                    "workflow_id": workflow_id,
                    "final_response": final_state.get("final_response"),
                    "analysis_results": final_state.get("analysis_results", {}),
                    "timestamp": datetime.utcnow().isoformat()
                }

        except Exception as e:
            logger.error(f"Error in stream_analysis: {e}", exc_info=True)
            yield {
                "node": "error",
                "stage": "failed",
                "workflow_id": workflow_id,
                "error": str(e),
                "timestamp": datetime.utcnow().isoformat()
            }

    def _format_response(self, state: PowerShellAnalysisState) -> Dict[str, Any]:
        """Format the final state into a response."""
        # Extract tool results from messages
        tool_results = {}
        for msg in state.get("messages", []):
            if isinstance(msg, ToolMessage):
                try:
                    result = json.loads(msg.content)
                    tool_results[msg.name] = result
                except (json.JSONDecodeError, TypeError):
                    tool_results[msg.name] = {"raw": msg.content}

        return {
            "workflow_id": state.get("workflow_id"),
            "status": "completed" if state.get("final_response") else "in_progress",
            "final_response": state.get("final_response"),
            "analysis_results": tool_results,
            "current_stage": state.get("current_stage"),
            "started_at": state.get("started_at"),
            "completed_at": state.get("completed_at"),
            "requires_human_review": state.get("requires_human_review", False)
        }

    async def continue_with_feedback(
        self,
        thread_id: str,
        human_feedback: str
    ) -> Dict[str, Any]:
        """
        Continue a paused workflow with human feedback.

        Args:
            thread_id: The workflow thread ID
            human_feedback: Feedback from human reviewer

        Returns:
            Updated analysis results
        """
        # Get current state
        config = {
            "configurable": {
                "thread_id": thread_id,
                "model": self.model
            }
        }

        # Update state with human feedback
        update = {
            "human_feedback": human_feedback,
            "requires_human_review": False
        }

        try:
            # Continue execution with updated state
            final_state = await self.graph.ainvoke(update, config)
            return self._format_response(final_state)
        except Exception as e:
            logger.error(f"Error continuing workflow: {e}", exc_info=True)
            return {
                "error": str(e),
                "thread_id": thread_id,
                "status": "failed"
            }


# ============================================================================
# Convenience Functions
# ============================================================================

async def analyze_powershell_script_simple(
    script_content: str,
    api_key: Optional[str] = None,
    model: str = "gpt-5-mini"
) -> Dict[str, Any]:
    """
    Simple convenience function for analyzing PowerShell scripts.

    Args:
        script_content: The PowerShell script to analyze
        api_key: OpenAI API key
        model: Model to use

    Returns:
        Analysis results
    """
    orchestrator = LangGraphProductionOrchestrator(
        api_key=api_key,
        model=model
    )

    return await orchestrator.analyze_script(script_content)


if __name__ == "__main__":
    # Test the orchestrator
    async def test():
        test_script = """
        param(
            [Parameter(Mandatory=$true)]
            [string]$Path
        )

        Get-ChildItem -Path $Path -Recurse | Where-Object { $_.Extension -eq '.log' }
        """

        result = await analyze_powershell_script_simple(test_script)
        print(json.dumps(result, indent=2))

    asyncio.run(test())
