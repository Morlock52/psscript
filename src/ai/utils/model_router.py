"""
Multi-Model Router - January 2026

Intelligently routes requests to the most appropriate AI model
based on task complexity, cost optimization, and performance needs.

Routing Strategy:
- Simple queries → Fast model (gpt-4.1-mini)
- Code generation → Code-specialized model (gpt-4.1)
- Complex reasoning → Reasoning model (o4-mini or o3)
- Complex multi-step → Flagship model (gpt-5.4)

Supports:
- Automatic complexity detection
- Cost-aware routing
- Latency optimization
- Fallback handling
"""

import re
import logging
from typing import Dict, List, Optional, Tuple, Any
from dataclasses import dataclass
from enum import Enum

logger = logging.getLogger(__name__)


class TaskComplexity(str, Enum):
    """Task complexity levels."""
    SIMPLE = "simple"
    MODERATE = "moderate"
    COMPLEX = "complex"
    EXPERT = "expert"


class TaskType(str, Enum):
    """Types of tasks for routing."""
    CHAT = "chat"
    CODE_GENERATION = "code_generation"
    CODE_REVIEW = "code_review"
    EXPLANATION = "explanation"
    DEBUGGING = "debugging"
    ARCHITECTURE = "architecture"
    SECURITY_ANALYSIS = "security_analysis"
    DOCUMENTATION = "documentation"


@dataclass
class ModelConfig:
    """Configuration for an AI model."""
    name: str
    model_id: str
    max_tokens: int
    cost_per_1k_input: float  # USD
    cost_per_1k_output: float  # USD
    avg_latency_ms: int
    strengths: List[str]
    weaknesses: List[str]


@dataclass
class RoutingDecision:
    """Result of model routing decision."""
    model_id: str
    model_name: str
    reason: str
    task_type: TaskType
    complexity: TaskComplexity
    estimated_cost: float
    estimated_latency_ms: int
    alternative_model: Optional[str] = None


class ModelRouter:
    """
    Routes requests to the most appropriate AI model.

    Example usage:
        router = ModelRouter()
        decision = router.route("Write a script to backup files to Azure")
        print(f"Using {decision.model_name}: {decision.reason}")
    """

    # Model configurations (2 April 2026 pricing)
    # gpt-4o and gpt-4o-mini deprecated Feb 2026; replaced with gpt-4.1 family
    # Claude 4.6 models added February 2026
    MODELS = {
        # --- OpenAI Models ---
        "gpt-4.1-mini": ModelConfig(
            name="GPT-4.1 Mini",
            model_id="gpt-4.1-mini",
            max_tokens=1000000,
            cost_per_1k_input=0.0004,
            cost_per_1k_output=0.0016,
            avg_latency_ms=400,
            strengths=["fast", "cheap", "1M context", "good for simple tasks"],
            weaknesses=["less accurate on expert-level tasks"]
        ),
        "gpt-4.1": ModelConfig(
            name="GPT-4.1 (Code Specialist)",
            model_id="gpt-4.1",
            max_tokens=1000000,
            cost_per_1k_input=0.002,
            cost_per_1k_output=0.008,
            avg_latency_ms=1500,
            strengths=["code generation", "1M context", "instruction following", "technical accuracy"],
            weaknesses=["higher cost than mini"]
        ),
        "gpt-5.4": ModelConfig(
            name="GPT-5.4 (Flagship)",
            model_id="gpt-5.4",
            max_tokens=128000,
            cost_per_1k_input=0.0025,
            cost_per_1k_output=0.015,
            avg_latency_ms=2000,
            strengths=["best overall quality", "complex reasoning", "multi-step tasks"],
            weaknesses=["most expensive OpenAI model", "slower"]
        ),
        "o4-mini": ModelConfig(
            name="O4 Mini (Reasoning)",
            model_id="o4-mini",
            max_tokens=200000,
            cost_per_1k_input=0.0011,
            cost_per_1k_output=0.0044,
            avg_latency_ms=3000,
            strengths=["complex reasoning", "step-by-step", "math", "cost-effective reasoning"],
            weaknesses=["slower", "verbose"]
        ),
        # --- Anthropic Claude Models ---
        "claude-sonnet-4-6-20260217": ModelConfig(
            name="Claude Sonnet 4.6 (Balanced)",
            model_id="claude-sonnet-4-6-20260217",
            max_tokens=1000000,
            cost_per_1k_input=0.003,
            cost_per_1k_output=0.015,
            avg_latency_ms=1200,
            strengths=["balanced speed/quality", "1M context", "strong code understanding", "adaptive thinking"],
            weaknesses=["higher cost than Haiku"]
        ),
        "claude-opus-4-6-20260205": ModelConfig(
            name="Claude Opus 4.6 (Most Capable)",
            model_id="claude-opus-4-6-20260205",
            max_tokens=1000000,
            cost_per_1k_input=0.005,
            cost_per_1k_output=0.025,
            avg_latency_ms=2500,
            strengths=["most capable Claude", "complex reasoning", "1M context", "extended thinking"],
            weaknesses=["most expensive Claude model", "slower"]
        ),
        "claude-haiku-4-5-20251001": ModelConfig(
            name="Claude Haiku 4.5 (Fast)",
            model_id="claude-haiku-4-5-20251001",
            max_tokens=200000,
            cost_per_1k_input=0.001,
            cost_per_1k_output=0.005,
            avg_latency_ms=300,
            strengths=["fastest Claude", "cheapest Claude", "good for simple tasks"],
            weaknesses=["200K context limit", "less capable than Sonnet/Opus"]
        ),
    }

    # Task detection patterns
    CODE_GENERATION_PATTERNS = [
        r'\b(write|create|generate|make|build)\b.*\b(script|function|module|code)\b',
        r'\bscript\s+(?:to|that|for)\b',
        r'\bpowershell\s+(?:to|that|for)\b',
        r'\bfunction\s+(?:to|that|for)\b',
    ]

    CODE_REVIEW_PATTERNS = [
        r'\b(review|check|analyze|improve|optimize)\b.*\b(script|code|function)\b',
        r'\bwhat\'s\s+wrong\b',
        r'\bfind\s+(?:bugs|issues|problems)\b',
    ]

    DEBUGGING_PATTERNS = [
        r'\b(debug|fix|error|exception|not\s+working)\b',
        r'\bwhy\s+(?:is|does|doesn\'t|isn\'t)\b',
        r'\bhelp\s+(?:with|me)\s+(?:debug|fix)\b',
    ]

    EXPLANATION_PATTERNS = [
        r'\b(what\s+is|what\s+are|explain|how\s+does|what\s+does)\b',
        r'\bwhat\'s\s+the\s+difference\b',
        r'\bcan\s+you\s+explain\b',
    ]

    ARCHITECTURE_PATTERNS = [
        r'\b(design|architect|structure|organize)\b',
        r'\bbest\s+(?:way|practice|approach)\b',
        r'\bhow\s+should\s+I\b',
    ]

    SECURITY_PATTERNS = [
        r'\b(security|secure|safe|vulnerability|exploit)\b',
        r'\bcredential|password|secret\b',
        r'\battack|malicious\b',
    ]

    # Mapping from OpenAI model tiers to Claude equivalents
    CLAUDE_EQUIVALENTS = {
        "gpt-4.1": "claude-sonnet-4-6-20260217",
        "gpt-4.1-mini": "claude-haiku-4-5-20251001",
        "gpt-5.4": "claude-opus-4-6-20260205",
        "o4-mini": "claude-sonnet-4-6-20260217",
    }

    def __init__(self, default_model: str = "gpt-4.1", cost_sensitive: bool = False):
        """
        Initialize the model router.

        Args:
            default_model: Default model to use if no specific routing
            cost_sensitive: Prefer cheaper models when possible
        """
        self.default_model = default_model
        self.cost_sensitive = cost_sensitive

    @staticmethod
    def infer_provider(model_id: str) -> str:
        """Infer the AI provider from a model ID."""
        return "anthropic" if model_id.startswith("claude-") else "openai"

    def analyze_task(self, query: str, context: Optional[List[Dict]] = None) -> Tuple[TaskType, TaskComplexity]:
        """
        Analyze a query to determine task type and complexity.

        Args:
            query: The user's query
            context: Optional conversation context

        Returns:
            Tuple of (TaskType, TaskComplexity)
        """
        query_lower = query.lower()

        # Detect task type
        task_type = TaskType.CHAT

        for pattern in self.CODE_GENERATION_PATTERNS:
            if re.search(pattern, query_lower):
                task_type = TaskType.CODE_GENERATION
                break

        if task_type == TaskType.CHAT:
            for pattern in self.CODE_REVIEW_PATTERNS:
                if re.search(pattern, query_lower):
                    task_type = TaskType.CODE_REVIEW
                    break

        if task_type == TaskType.CHAT:
            for pattern in self.DEBUGGING_PATTERNS:
                if re.search(pattern, query_lower):
                    task_type = TaskType.DEBUGGING
                    break

        if task_type == TaskType.CHAT:
            for pattern in self.EXPLANATION_PATTERNS:
                if re.search(pattern, query_lower):
                    task_type = TaskType.EXPLANATION
                    break

        if task_type == TaskType.CHAT:
            for pattern in self.ARCHITECTURE_PATTERNS:
                if re.search(pattern, query_lower):
                    task_type = TaskType.ARCHITECTURE
                    break

        if task_type == TaskType.CHAT:
            for pattern in self.SECURITY_PATTERNS:
                if re.search(pattern, query_lower):
                    task_type = TaskType.SECURITY_ANALYSIS
                    break

        # Detect complexity
        complexity = self._assess_complexity(query, context)

        return task_type, complexity

    def _assess_complexity(self, query: str, context: Optional[List[Dict]]) -> TaskComplexity:
        """Assess the complexity of a task."""
        # Length-based heuristic
        word_count = len(query.split())

        # Complexity indicators
        complex_keywords = [
            'enterprise', 'production', 'scale', 'distributed',
            'multi-tenant', 'high-availability', 'fault-tolerant',
            'microservices', 'kubernetes', 'azure devops', 'ci/cd',
            'authentication', 'authorization', 'encryption',
            'performance', 'optimization', 'concurrent', 'parallel',
        ]

        expert_keywords = [
            'architecture', 'design pattern', 'best practices',
            'security audit', 'compliance', 'hipaa', 'gdpr',
            'disaster recovery', 'business continuity',
            'zero trust', 'penetration test',
        ]

        query_lower = query.lower()

        # Count complexity indicators
        complex_count = sum(1 for kw in complex_keywords if kw in query_lower)
        expert_count = sum(1 for kw in expert_keywords if kw in query_lower)

        # Context also adds complexity
        context_length = len(context) if context else 0

        if expert_count >= 2 or (complex_count >= 3 and word_count > 50):
            return TaskComplexity.EXPERT
        elif complex_count >= 2 or word_count > 100 or context_length > 10:
            return TaskComplexity.COMPLEX
        elif word_count > 30 or context_length > 5:
            return TaskComplexity.MODERATE
        else:
            return TaskComplexity.SIMPLE

    def route(
        self,
        query: str,
        context: Optional[List[Dict]] = None,
        preferred_provider: Optional[str] = None,
        preferred_model: Optional[str] = None,
    ) -> RoutingDecision:
        """
        Route a query to the most appropriate model.

        Args:
            query: The user's query
            context: Optional conversation context
            preferred_provider: Force a provider ('openai' or 'anthropic')
            preferred_model: Force a specific model ID (skips routing logic)

        Returns:
            RoutingDecision with selected model and reasoning
        """
        # If a specific model was requested and we know it, use it directly
        if preferred_model and preferred_model in self.MODELS:
            model = self.MODELS[preferred_model]
            task_type, complexity = self.analyze_task(query, context)
            estimated_cost = (0.5 * model.cost_per_1k_input) + (1.0 * model.cost_per_1k_output)
            return RoutingDecision(
                model_id=model.model_id,
                model_name=model.name,
                reason=f"User-selected model: {model.name}",
                task_type=task_type,
                complexity=complexity,
                estimated_cost=estimated_cost,
                estimated_latency_ms=model.avg_latency_ms,
            )

        task_type, complexity = self.analyze_task(query, context)

        # Route based on task type and complexity (selects OpenAI model first)
        if task_type == TaskType.CODE_GENERATION:
            if complexity in (TaskComplexity.COMPLEX, TaskComplexity.EXPERT):
                model = self.MODELS["gpt-4.1"]
                reason = "Complex code generation requires GPT-4.1 for best practices"
            elif self.cost_sensitive:
                model = self.MODELS["gpt-4.1-mini"]
                reason = "Simple code generation, using cost-effective model"
            else:
                model = self.MODELS["gpt-4.1"]
                reason = "Code generation benefits from GPT-4.1's technical accuracy"

        elif task_type == TaskType.CODE_REVIEW:
            model = self.MODELS["gpt-4.1"]
            reason = "Code review requires technical accuracy of GPT-4.1"

        elif task_type == TaskType.DEBUGGING:
            if complexity >= TaskComplexity.COMPLEX:
                model = self.MODELS["o4-mini"]
                reason = "Complex debugging benefits from O4-mini's reasoning capabilities"
            else:
                model = self.MODELS["gpt-4.1"]
                reason = "Standard debugging with GPT-4.1"

        elif task_type == TaskType.EXPLANATION:
            if complexity == TaskComplexity.SIMPLE and self.cost_sensitive:
                model = self.MODELS["gpt-4.1-mini"]
                reason = "Simple explanation, using fast model"
            else:
                model = self.MODELS["gpt-5.4"]
                reason = "Explanations benefit from GPT-5.4's clarity"

        elif task_type == TaskType.ARCHITECTURE:
            model = self.MODELS["o4-mini"]
            reason = "Architecture decisions benefit from O4-mini's step-by-step reasoning"

        elif task_type == TaskType.SECURITY_ANALYSIS:
            model = self.MODELS["gpt-4.1"]
            reason = "Security analysis requires GPT-4.1's technical precision"

        else:  # General chat
            if complexity == TaskComplexity.SIMPLE and self.cost_sensitive:
                model = self.MODELS["gpt-4.1-mini"]
                reason = "Simple chat query, using fast model"
            elif complexity >= TaskComplexity.COMPLEX:
                model = self.MODELS["gpt-5.4"]
                reason = "Complex query benefits from GPT-5.4"
            else:
                model = self.MODELS.get(self.default_model, self.MODELS["gpt-4.1"])
                reason = f"Using default model for moderate complexity"

        # If Anthropic was requested, swap to the Claude equivalent
        if preferred_provider == "anthropic":
            equiv_id = self.CLAUDE_EQUIVALENTS.get(model.model_id)
            if equiv_id and equiv_id in self.MODELS:
                openai_name = model.name
                model = self.MODELS[equiv_id]
                reason = f"Anthropic provider requested — {model.name} (equivalent to {openai_name})"

        # Estimate cost (rough, based on ~500 token query, ~1000 token response)
        estimated_cost = (0.5 * model.cost_per_1k_input) + (1.0 * model.cost_per_1k_output)

        # Determine alternative
        alternative = None
        if self.infer_provider(model.model_id) == "openai":
            if model.model_id != "gpt-4.1-mini" and self.cost_sensitive:
                alternative = "gpt-4.1-mini"
            elif model.model_id == "gpt-4.1-mini" and complexity >= TaskComplexity.MODERATE:
                alternative = "gpt-5.4"
        else:
            # Offer OpenAI alternative when using Claude
            equiv = {v: k for k, v in self.CLAUDE_EQUIVALENTS.items()}
            alternative = equiv.get(model.model_id)

        return RoutingDecision(
            model_id=model.model_id,
            model_name=model.name,
            reason=reason,
            task_type=task_type,
            complexity=complexity,
            estimated_cost=estimated_cost,
            estimated_latency_ms=model.avg_latency_ms,
            alternative_model=alternative
        )

    def get_model_for_task(self, task_type: TaskType, complexity: TaskComplexity) -> str:
        """
        Get the recommended model ID for a specific task type and complexity.
        """
        decision = self.route(f"Task: {task_type.value} with {complexity.value} complexity")
        return decision.model_id


# Singleton instance
_router: Optional[ModelRouter] = None


def get_router(cost_sensitive: bool = False) -> ModelRouter:
    """Get or create the model router instance."""
    global _router
    if _router is None:
        _router = ModelRouter(cost_sensitive=cost_sensitive)
    return _router


def route_query(
    query: str,
    context: Optional[List[Dict]] = None,
    preferred_provider: Optional[str] = None,
    preferred_model: Optional[str] = None,
) -> RoutingDecision:
    """Convenience function to route a query."""
    return get_router().route(query, context, preferred_provider, preferred_model)
