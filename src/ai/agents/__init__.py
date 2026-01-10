"""
Agents Package

This package contains the AI agent coordination system for PowerShell script analysis.
Uses AgentCoordinator for LangGraph-based multi-agent workflows.

Legacy agents (LangChain, AutoGPT, etc.) have been archived to agents/archived/
"""

from .agent_coordinator import AgentCoordinator

__all__ = [
    'AgentCoordinator'
]
