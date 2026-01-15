"""
Token Counter and Price Estimator

Tracks token usage and estimates costs for OpenAI API calls.
"""

import logging
from typing import Dict, Tuple
from datetime import datetime
import json
from pathlib import Path

logger = logging.getLogger("token_counter")

# OpenAI Pricing as of January 2026 (per 1M tokens)
PRICING = {
    # GPT-4 Series - Updated January 2026
    "gpt-4o": {
        "input": 2.50,
        "output": 10.0,
    },
    "gpt-4o-mini": {
        "input": 0.15,
        "output": 0.60,
    },
    "o3": {
        "input": 10.0,  # Reasoning model - higher cost
        "output": 40.0,
    },
    "gpt-4-turbo": {  # Legacy - kept for backwards compatibility
        "input": 10.0,
        "output": 30.0,
    },
    "gpt-4": {
        "input": 30.0,
        "output": 60.0,
    },
    "gpt-3.5-turbo": {
        "input": 0.50,
        "output": 1.50,
    },
    # Embeddings
    "text-embedding-3-large": {
        "input": 0.13,
        "output": 0.0,  # No output cost for embeddings
    },
    "text-embedding-3-small": {
        "input": 0.02,
        "output": 0.0,
    },
    "text-embedding-ada-002": {
        "input": 0.10,
        "output": 0.0,
    },
}


class TokenCounter:
    """Tracks token usage and calculates costs."""

    def __init__(self, usage_file: str = "token_usage.json"):
        """
        Initialize the token counter.

        Args:
            usage_file: Path to the JSON file storing usage data
        """
        self.usage_file = Path(usage_file)
        self.usage_data = self._load_usage()

    def _load_usage(self) -> Dict:
        """Load usage data from file."""
        if self.usage_file.exists():
            try:
                with open(self.usage_file, 'r') as f:
                    return json.load(f)
            except Exception as e:
                logger.error(f"Error loading usage data: {e}")
                return self._create_empty_usage()
        return self._create_empty_usage()

    def _create_empty_usage(self) -> Dict:
        """Create empty usage data structure."""
        return {
            "total_tokens": 0,
            "total_cost": 0.0,
            "by_model": {},
            "sessions": [],
            "last_updated": datetime.now().isoformat()
        }

    def _save_usage(self):
        """Save usage data to file."""
        try:
            self.usage_data["last_updated"] = datetime.now().isoformat()
            with open(self.usage_file, 'w') as f:
                json.dump(self.usage_data, f, indent=2)
        except Exception as e:
            logger.error(f"Error saving usage data: {e}")

    def track_usage(
        self,
        model: str,
        input_tokens: int,
        output_tokens: int,
        operation: str = "unknown"
    ) -> Tuple[int, float]:
        """
        Track token usage and calculate cost.

        Args:
            model: The model name
            input_tokens: Number of input tokens
            output_tokens: Number of output tokens
            operation: Description of the operation

        Returns:
            Tuple of (total_tokens, cost)
        """
        total_tokens = input_tokens + output_tokens
        cost = self.calculate_cost(model, input_tokens, output_tokens)

        # Update totals
        self.usage_data["total_tokens"] += total_tokens
        self.usage_data["total_cost"] += cost

        # Update by model
        if model not in self.usage_data["by_model"]:
            self.usage_data["by_model"][model] = {
                "total_tokens": 0,
                "total_cost": 0.0,
                "input_tokens": 0,
                "output_tokens": 0,
                "calls": 0
            }

        model_data = self.usage_data["by_model"][model]
        model_data["total_tokens"] += total_tokens
        model_data["total_cost"] += cost
        model_data["input_tokens"] += input_tokens
        model_data["output_tokens"] += output_tokens
        model_data["calls"] += 1

        # Add session entry
        self.usage_data["sessions"].append({
            "timestamp": datetime.now().isoformat(),
            "model": model,
            "operation": operation,
            "input_tokens": input_tokens,
            "output_tokens": output_tokens,
            "total_tokens": total_tokens,
            "cost": cost
        })

        # Keep only last 1000 sessions
        if len(self.usage_data["sessions"]) > 1000:
            self.usage_data["sessions"] = self.usage_data["sessions"][-1000:]

        self._save_usage()

        logger.info(
            f"Token usage tracked - Model: {model}, Tokens: {total_tokens}, "
            f"Cost: ${cost:.4f}, Operation: {operation}"
        )

        return total_tokens, cost

    def calculate_cost(
        self,
        model: str,
        input_tokens: int,
        output_tokens: int
    ) -> float:
        """
        Calculate cost for token usage.

        Args:
            model: The model name
            input_tokens: Number of input tokens
            output_tokens: Number of output tokens

        Returns:
            Cost in dollars
        """
        # Normalize model name (handle variations)
        model_key = model.lower()
        for key in PRICING.keys():
            if key in model_key:
                model_key = key
                break

        if model_key not in PRICING:
            logger.warning(f"Unknown model for pricing: {model}, using gpt-4o pricing")
            model_key = "gpt-4o"

        pricing = PRICING[model_key]

        # Calculate cost (pricing is per 1M tokens)
        input_cost = (input_tokens / 1_000_000) * pricing["input"]
        output_cost = (output_tokens / 1_000_000) * pricing["output"]

        return input_cost + output_cost

    def estimate_cost(
        self,
        model: str,
        estimated_input_tokens: int,
        estimated_output_tokens: int
    ) -> Dict:
        """
        Estimate cost before making API call.

        Args:
            model: The model name
            estimated_input_tokens: Estimated input tokens
            estimated_output_tokens: Estimated output tokens

        Returns:
            Dictionary with cost breakdown
        """
        cost = self.calculate_cost(model, estimated_input_tokens, estimated_output_tokens)

        return {
            "model": model,
            "estimated_input_tokens": estimated_input_tokens,
            "estimated_output_tokens": estimated_output_tokens,
            "estimated_total_tokens": estimated_input_tokens + estimated_output_tokens,
            "estimated_cost": cost,
            "formatted_cost": f"${cost:.4f}"
        }

    def get_usage_summary(self) -> Dict:
        """
        Get summary of token usage.

        Returns:
            Dictionary with usage statistics
        """
        return {
            "total_tokens": self.usage_data["total_tokens"],
            "total_cost": self.usage_data["total_cost"],
            "formatted_cost": f"${self.usage_data['total_cost']:.2f}",
            "by_model": self.usage_data["by_model"],
            "last_updated": self.usage_data["last_updated"],
            "session_count": len(self.usage_data["sessions"])
        }

    def get_recent_sessions(self, limit: int = 10) -> list:
        """
        Get recent sessions.

        Args:
            limit: Number of recent sessions to return

        Returns:
            List of recent sessions
        """
        return self.usage_data["sessions"][-limit:]

    def reset_usage(self):
        """Reset all usage data."""
        self.usage_data = self._create_empty_usage()
        self._save_usage()
        logger.info("Usage data reset")


# Create singleton instance
token_counter = TokenCounter()


def estimate_tokens(text: str) -> int:
    """
    Estimate the number of tokens in a text.

    Uses a simple heuristic: ~4 characters per token for English text.
    For more accurate counting, use tiktoken library.

    Args:
        text: The text to estimate tokens for

    Returns:
        Estimated number of tokens
    """
    return len(text) // 4


if __name__ == "__main__":
    # Example usage
    counter = TokenCounter()

    # Track some usage
    tokens, cost = counter.track_usage(
        model="gpt-4o",
        input_tokens=1000,
        output_tokens=500,
        operation="PowerShell analysis"
    )
    print(f"Tracked: {tokens} tokens, ${cost:.4f}")

    # Estimate cost
    estimate = counter.estimate_cost(
        model="gpt-4o",
        estimated_input_tokens=2000,
        estimated_output_tokens=1000
    )
    print(f"Estimate: {estimate}")

    # Get summary
    summary = counter.get_usage_summary()
    print(f"Summary: {summary}")
