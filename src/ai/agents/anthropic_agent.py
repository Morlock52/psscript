"""
Anthropic Claude Agent Implementation - January 2026

This module implements AI capabilities using Anthropic's Claude models,
providing an alternative to OpenAI for script analysis, generation, and chat.
"""

import os
import logging
from typing import Dict, List, Any, Optional, AsyncIterator
import asyncio

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("anthropic_agent")

# Try to import anthropic - gracefully handle if not installed
try:
    import anthropic
    from anthropic import AsyncAnthropic
    ANTHROPIC_AVAILABLE = True
except ImportError:
    ANTHROPIC_AVAILABLE = False
    logger.warning("anthropic package not installed. Install with: pip install anthropic")


class AnthropicAgent:
    """
    Claude-based agent for PowerShell script analysis and generation.

    Provides similar capabilities to OpenAI agents but using Anthropic's
    Claude models, which excel at code understanding and generation.
    """

    # System prompts for different tasks
    POWERSHELL_EXPERT_PROMPT = """You are a PowerShell expert assistant specialized in:
- Analyzing PowerShell scripts for functionality, security, and best practices
- Generating efficient, well-documented PowerShell scripts
- Explaining PowerShell concepts and cmdlets clearly
- Identifying security vulnerabilities and suggesting improvements

When analyzing scripts, provide:
1. A clear summary of what the script does
2. Security considerations and potential risks
3. Performance recommendations
4. Best practice suggestions

When generating scripts:
1. Include comprehensive comments
2. Follow PowerShell best practices
3. Handle errors appropriately
4. Use approved verbs and naming conventions

Always format code blocks using markdown with ```powershell syntax."""

    ANALYSIS_PROMPT = """Analyze the following PowerShell script and provide:

1. **Purpose**: What does this script do?
2. **Commands Used**: List the key cmdlets and their purposes
3. **Security Score** (0-100): Rate the security of this script
4. **Quality Score** (0-100): Rate the code quality
5. **Recommendations**: Specific improvements to make

Script to analyze:
```powershell
{script}
```"""

    GENERATION_PROMPT = """Generate a PowerShell script based on this description:

{description}

Requirements:
- Include clear comments explaining each section
- Follow PowerShell best practices
- Handle errors appropriately
- Use approved verbs (Get-, Set-, New-, Remove-, etc.)
- Be secure and avoid common vulnerabilities

Provide only the script code in a markdown code block."""

    def __init__(
        self,
        api_key: Optional[str] = None,
        model: str = "claude-sonnet-4-20250514"
    ):
        """
        Initialize the Anthropic agent.

        Args:
            api_key: Anthropic API key (optional, uses env var if not provided)
            model: Claude model to use (default: claude-sonnet-4-20250514)
        """
        if not ANTHROPIC_AVAILABLE:
            raise ImportError(
                "anthropic package not installed. Install with: pip install anthropic"
            )

        self.api_key = api_key or os.getenv("ANTHROPIC_API_KEY")
        if not self.api_key:
            raise ValueError("Anthropic API key is required")

        self.model = model
        self.client = anthropic.Anthropic(api_key=self.api_key)
        self.async_client = AsyncAnthropic(api_key=self.api_key)

        logger.info(f"Anthropic agent initialized with model: {self.model}")

    def analyze_script(self, script: str) -> Dict[str, Any]:
        """
        Analyze a PowerShell script using Claude.

        Args:
            script: The PowerShell script content to analyze

        Returns:
            Dictionary containing analysis results
        """
        try:
            message = self.client.messages.create(
                model=self.model,
                max_tokens=4096,
                system=self.POWERSHELL_EXPERT_PROMPT,
                messages=[
                    {
                        "role": "user",
                        "content": self.ANALYSIS_PROMPT.format(script=script)
                    }
                ]
            )

            response_text = message.content[0].text

            # Parse the response to extract scores and details
            analysis = self._parse_analysis_response(response_text, script)
            analysis["provider"] = "anthropic"
            analysis["model"] = self.model

            return analysis

        except Exception as e:
            logger.error(f"Error analyzing script with Claude: {e}")
            raise

    def generate_script(self, description: str) -> Dict[str, Any]:
        """
        Generate a PowerShell script based on a description.

        Args:
            description: Natural language description of desired script

        Returns:
            Dictionary containing generated script and metadata
        """
        try:
            message = self.client.messages.create(
                model=self.model,
                max_tokens=4096,
                system=self.POWERSHELL_EXPERT_PROMPT,
                messages=[
                    {
                        "role": "user",
                        "content": self.GENERATION_PROMPT.format(description=description)
                    }
                ]
            )

            response_text = message.content[0].text

            # Extract script from markdown code block
            script = self._extract_code_block(response_text)

            return {
                "script": script,
                "description": description,
                "provider": "anthropic",
                "model": self.model,
                "success": True
            }

        except Exception as e:
            logger.error(f"Error generating script with Claude: {e}")
            raise

    async def chat(
        self,
        message: str,
        context: Optional[str] = None,
        history: Optional[List[Dict[str, str]]] = None
    ) -> str:
        """
        Chat with Claude about PowerShell topics.

        Args:
            message: The user's message
            context: Optional additional context (e.g., current script)
            history: Optional conversation history

        Returns:
            Claude's response text
        """
        try:
            messages = []

            # Add conversation history if provided
            if history:
                for msg in history:
                    messages.append({
                        "role": msg.get("role", "user"),
                        "content": msg.get("content", "")
                    })

            # Build the current message with context
            content = message
            if context:
                content = f"Context:\n```powershell\n{context}\n```\n\nQuestion: {message}"

            messages.append({
                "role": "user",
                "content": content
            })

            response = await self.async_client.messages.create(
                model=self.model,
                max_tokens=4096,
                system=self.POWERSHELL_EXPERT_PROMPT,
                messages=messages
            )

            return response.content[0].text

        except Exception as e:
            logger.error(f"Error in chat with Claude: {e}")
            raise

    async def chat_stream(
        self,
        message: str,
        context: Optional[str] = None,
        history: Optional[List[Dict[str, str]]] = None
    ) -> AsyncIterator[str]:
        """
        Stream a chat response from Claude.

        Args:
            message: The user's message
            context: Optional additional context
            history: Optional conversation history

        Yields:
            Chunks of Claude's response
        """
        try:
            messages = []

            if history:
                for msg in history:
                    messages.append({
                        "role": msg.get("role", "user"),
                        "content": msg.get("content", "")
                    })

            content = message
            if context:
                content = f"Context:\n```powershell\n{context}\n```\n\nQuestion: {message}"

            messages.append({
                "role": "user",
                "content": content
            })

            async with self.async_client.messages.stream(
                model=self.model,
                max_tokens=4096,
                system=self.POWERSHELL_EXPERT_PROMPT,
                messages=messages
            ) as stream:
                async for text in stream.text_stream:
                    yield text

        except Exception as e:
            logger.error(f"Error in streaming chat with Claude: {e}")
            raise

    def explain_script(
        self,
        script: str,
        detail_level: str = "detailed"
    ) -> str:
        """
        Explain a PowerShell script.

        Args:
            script: The script to explain
            detail_level: Level of detail (simple, detailed, security)

        Returns:
            Explanation text
        """
        prompts = {
            "simple": "Explain this PowerShell script in simple terms that a beginner could understand:",
            "detailed": "Provide a detailed explanation of this PowerShell script, including what each section does:",
            "security": "Analyze this PowerShell script from a security perspective, identifying any risks or vulnerabilities:"
        }

        prompt = prompts.get(detail_level, prompts["detailed"])

        try:
            message = self.client.messages.create(
                model=self.model,
                max_tokens=4096,
                system=self.POWERSHELL_EXPERT_PROMPT,
                messages=[
                    {
                        "role": "user",
                        "content": f"{prompt}\n\n```powershell\n{script}\n```"
                    }
                ]
            )

            return message.content[0].text

        except Exception as e:
            logger.error(f"Error explaining script with Claude: {e}")
            raise

    def _parse_analysis_response(
        self,
        response: str,
        original_script: str
    ) -> Dict[str, Any]:
        """
        Parse the analysis response into structured data.
        """
        import re

        # Extract scores using regex
        security_match = re.search(r'Security Score[:\s]*(\d+)', response, re.IGNORECASE)
        quality_match = re.search(r'Quality Score[:\s]*(\d+)', response, re.IGNORECASE)

        security_score = int(security_match.group(1)) if security_match else 75
        quality_score = int(quality_match.group(1)) if quality_match else 75

        # Extract purpose
        purpose_match = re.search(r'Purpose[:\s]*(.+?)(?=\n\n|\n[#*]|Commands|Security)', response, re.IGNORECASE | re.DOTALL)
        purpose = purpose_match.group(1).strip() if purpose_match else "Script analysis completed"

        # Extract commands mentioned
        commands = re.findall(r'\b(Get-|Set-|New-|Remove-|Start-|Stop-|Invoke-|Write-|Read-)\w+', original_script)
        unique_commands = list(set(commands))

        return {
            "summary": purpose,
            "security_score": security_score,
            "quality_score": quality_score,
            "commands": unique_commands,
            "full_analysis": response,
            "recommendations": self._extract_recommendations(response)
        }

    def _extract_recommendations(self, response: str) -> List[str]:
        """Extract recommendations from the analysis response."""
        import re

        # Look for numbered recommendations or bullet points
        recs = re.findall(r'(?:^|\n)[•\-\*\d+\.]\s*(.+?)(?=\n|$)', response)

        # Filter to only include actual recommendations
        recommendations = [
            r.strip() for r in recs
            if len(r) > 10 and any(word in r.lower() for word in
                ['should', 'recommend', 'consider', 'use', 'add', 'remove', 'improve'])
        ]

        return recommendations[:5]  # Return top 5 recommendations

    def _extract_code_block(self, response: str) -> str:
        """Extract code from markdown code block."""
        import re

        # Try to find PowerShell code block
        match = re.search(r'```(?:powershell|ps1)?\s*\n(.*?)\n```', response, re.DOTALL | re.IGNORECASE)

        if match:
            return match.group(1).strip()

        # If no code block, return the whole response (might be just code)
        return response.strip()


def create_anthropic_agent(
    api_key: Optional[str] = None,
    model: Optional[str] = None
) -> Optional[AnthropicAgent]:
    """
    Factory function to create an Anthropic agent.

    Returns None if anthropic package is not available or no API key.
    """
    if not ANTHROPIC_AVAILABLE:
        logger.warning("Cannot create Anthropic agent: package not installed")
        return None

    api_key = api_key or os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        logger.warning("Cannot create Anthropic agent: no API key")
        return None

    model = model or "claude-sonnet-4-20250514"

    try:
        return AnthropicAgent(api_key=api_key, model=model)
    except Exception as e:
        logger.error(f"Failed to create Anthropic agent: {e}")
        return None


# Export for use in other modules
__all__ = ["AnthropicAgent", "create_anthropic_agent", "ANTHROPIC_AVAILABLE"]
