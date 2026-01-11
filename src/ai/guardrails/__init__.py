"""
AI Guardrails Module - January 2026 Best Practices

This module provides topic filtering and input validation for the PSScript AI Assistant.
Implements a layered approach: fast checks first, then LLM-based validation if needed.

Based on 2026 best practices from:
- Guardrails AI framework patterns
- NVIDIA NeMo Guardrails concepts
- AWS Bedrock safety controls
"""

from .topic_validator import (
    TopicValidator,
    TopicValidationResult,
    validate_powershell_topic,
    is_script_generation_request,
    extract_script_requirements
)

__all__ = [
    'TopicValidator',
    'TopicValidationResult',
    'validate_powershell_topic',
    'is_script_generation_request',
    'extract_script_requirements'
]
