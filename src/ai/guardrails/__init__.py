"""
AI Guardrails Module - January 2026 Best Practices

This module provides topic filtering, input validation, and security scanning
for the PSScript AI Assistant.

Implements THREE-LAYER GUARDRAIL ARCHITECTURE:
1. INPUT LAYER - Topic validation ensures queries are PowerShell-related
2. CONTEXT LAYER - Security-aware prompt construction with Chain-of-Thought
3. OUTPUT LAYER - Validates generated code before returning to user

Based on 2026 best practices from:
- Guardrails AI framework patterns
- NVIDIA NeMo Guardrails concepts
- AWS Bedrock safety controls
- OWASP secure coding guidelines
- Chain-of-Thought security prompting research
"""

from .topic_validator import (
    TopicValidator,
    TopicValidationResult,
    TopicCategory,
    validate_powershell_topic,
    is_script_generation_request,
    extract_script_requirements
)

from .powershell_security import (
    PowerShellSecurityGuard,
    SecurityScanResult,
    SecurityFinding,
    SecurityLevel,
    SecurityCategory,
    scan_powershell_code,
    sanitize_script_request,
    get_security_prompt_injection,
    validate_generated_output  # NEW: Output layer validation
)

__all__ = [
    # Layer 1: Input validation (Topic)
    'TopicValidator',
    'TopicValidationResult',
    'TopicCategory',
    'validate_powershell_topic',
    'is_script_generation_request',
    'extract_script_requirements',

    # Layer 2 & 3: Security scanning and output validation
    'PowerShellSecurityGuard',
    'SecurityScanResult',
    'SecurityFinding',
    'SecurityLevel',
    'SecurityCategory',
    'scan_powershell_code',
    'sanitize_script_request',
    'get_security_prompt_injection',
    'validate_generated_output'  # NEW: Output validation function
]
