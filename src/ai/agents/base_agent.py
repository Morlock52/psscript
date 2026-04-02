"""
Base Agent - Abstract base class for all AI agents.

Provides a common interface for agent initialization and message processing.
"""

import os
import logging
from typing import Dict, List, Optional
from abc import ABC, abstractmethod

logger = logging.getLogger(__name__)


class BaseAgent(ABC):
    """Abstract base class for AI agents."""

    def __init__(self, api_key: Optional[str] = None):
        """
        Initialize the base agent.

        Args:
            api_key: API key for the AI provider (uses env var if not provided)
        """
        self.api_key = api_key or os.getenv("OPENAI_API_KEY")
        if not self.api_key:
            logger.warning("No API key provided for agent initialization")

    @abstractmethod
    async def process_message(self, messages: List[Dict[str, str]], *args, **kwargs) -> str:
        """
        Process a list of messages and return a response.

        Args:
            messages: List of message dicts with 'role' and 'content' keys

        Returns:
            The agent's response string
        """
        ...
