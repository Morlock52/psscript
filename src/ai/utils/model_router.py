"""
Multi-Model Router - January 2026

Intelligently routes requests to the most appropriate AI model
based on task complexity, cost optimization, and performance needs.

Routing Strategy:
- Simple queries → Fast model (gpt-4o-mini)
- Code generation → Code-specialized model (gpt-4.1)
- Complex reasoning → Reasoning model (o3-mini or gpt-4o)
- Creative tasks → Creative model (gpt-4o)

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

    # Model configurations (January 2026 pricing)
    MODELS = {
        "gpt-4o-mini": ModelConfig(
            name="GPT-4o Mini",
            model_id="gpt-4o-mini",
            max_tokens=16384,
            cost_per_1k_input=0.00015,
            cost_per_1k_output=0.0006,
            avg_latency_ms=500,
            strengths=["fast", "cheap", "good for simple tasks"],
            weaknesses=["less accurate on complex tasks"]
        ),
        "gpt-4o": ModelConfig(
            name="GPT-4o",
            model_id="gpt-4o",
            max_tokens=128000,
            cost_per_1k_input=0.0025,
            cost_per_1k_output=0.01,
            avg_latency_ms=1500,
            strengths=["multimodal", "creative", "balanced"],
            weaknesses=["higher cost"]
        ),
        "gpt-4.1": ModelConfig(
            name="GPT-4.1 (January 2026)",
            model_id="gpt-4.1",
            max_tokens=128000,
            cost_per_1k_input=0.003,
            cost_per_1k_output=0.012,
            avg_latency_ms=2000,
            strengths=["code generation", "technical accuracy", "best practices"],
            weaknesses=["slower", "higher cost"]
        ),
        "o3-mini": ModelConfig(
            name="O3 Mini (Reasoning)",
            model_id="o3-mini",
            max_tokens=100000,
            cost_per_1k_input=0.0015,
            cost_per_1k_output=0.006,
            avg_latency_ms=3000,
            strengths=["complex reasoning", "step-by-step", "math"],
            weaknesses=["slower", "verbose"]
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

    def __init__(self, default_model: str = "gpt-4.1", cost_sensitive: bool = False):
        """
        Initialize the model router.

        Args:
            default_model: Default model to use if no specific routing
            cost_sensitive: Prefer cheaper models when possible
        """
        self.default_model = default_model
        self.cost_sensitive = cost_sensitive

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

    def route(self, query: str, context: Optional[List[Dict]] = None) -> RoutingDecision:
        """
        Route a query to the most appropriate model.

        Args:
            query: The user's query
            context: Optional conversation context

        Returns:
            RoutingDecision with selected model and reasoning
        """
        task_type, complexity = self.analyze_task(query, context)

        # Route based on task type and complexity
        if task_type == TaskType.CODE_GENERATION:
            if complexity in (TaskComplexity.COMPLEX, TaskComplexity.EXPERT):
                model = self.MODELS["gpt-4.1"]
                reason = "Complex code generation requires GPT-4.1 for best practices"
            elif self.cost_sensitive:
                model = self.MODELS["gpt-4o-mini"]
                reason = "Simple code generation, using cost-effective model"
            else:
                model = self.MODELS["gpt-4.1"]
                reason = "Code generation benefits from GPT-4.1's technical accuracy"

        elif task_type == TaskType.CODE_REVIEW:
            model = self.MODELS["gpt-4.1"]
            reason = "Code review requires technical accuracy of GPT-4.1"

        elif task_type == TaskType.DEBUGGING:
            if complexity >= TaskComplexity.COMPLEX:
                model = self.MODELS["o3-mini"]
                reason = "Complex debugging benefits from O3's reasoning capabilities"
            else:
                model = self.MODELS["gpt-4.1"]
                reason = "Standard debugging with GPT-4.1"

        elif task_type == TaskType.EXPLANATION:
            if complexity == TaskComplexity.SIMPLE and self.cost_sensitive:
                model = self.MODELS["gpt-4o-mini"]
                reason = "Simple explanation, using fast model"
            else:
                model = self.MODELS["gpt-4o"]
                reason = "Explanations benefit from GPT-4o's clarity"

        elif task_type == TaskType.ARCHITECTURE:
            model = self.MODELS["o3-mini"]
            reason = "Architecture decisions benefit from O3's step-by-step reasoning"

        elif task_type == TaskType.SECURITY_ANALYSIS:
            model = self.MODELS["gpt-4.1"]
            reason = "Security analysis requires GPT-4.1's technical precision"

        else:  # General chat
            if complexity == TaskComplexity.SIMPLE and self.cost_sensitive:
                model = self.MODELS["gpt-4o-mini"]
                reason = "Simple chat query, using fast model"
            elif complexity >= TaskComplexity.COMPLEX:
                model = self.MODELS["gpt-4o"]
                reason = "Complex query benefits from GPT-4o"
            else:
                model = self.MODELS.get(self.default_model, self.MODELS["gpt-4.1"])
                reason = f"Using default model for moderate complexity"

        # Estimate cost (rough, based on ~500 token query, ~1000 token response)
        estimated_cost = (0.5 * model.cost_per_1k_input) + (1.0 * model.cost_per_1k_output)

        # Determine alternative
        alternative = None
        if model.model_id != "gpt-4o-mini" and self.cost_sensitive:
            alternative = "gpt-4o-mini"
        elif model.model_id == "gpt-4o-mini" and complexity >= TaskComplexity.MODERATE:
            alternative = "gpt-4o"

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


def route_query(query: str, context: Optional[List[Dict]] = None) -> RoutingDecision:
    """Convenience function to route a query."""
    return get_router().route(query, context)
