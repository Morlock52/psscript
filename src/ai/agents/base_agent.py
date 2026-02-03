"""
Base Agent

This repo has multiple agent implementations (LangChain, LangGraph, OpenAI Assistants, etc.).
Some agents expect a shared base class for common concerns like API key resolution.

Keep this class intentionally small and dependency-free so importing agent modules
doesn't fail at startup in environments where optional stacks aren't installed.
"""

from __future__ import annotations

import os
from typing import Optional


class BaseAgent:
    """Minimal base class shared by agent implementations."""

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or os.getenv("OPENAI_API_KEY")
        if not self.api_key:
            raise ValueError("OpenAI API key is required")

