"""
Multi-Model Router - February 2026

Routes requests to an OpenAI model based on task type + complexity.
This repo is a coding/PowerShell-first app, so we bias toward strong coding models.

Routing Strategy (performance-leaning by default):
- Simple chat/explanations → GPT-5 Mini
- Very simple/high-throughput → GPT-5 Nano (only when cost_sensitive=True)
- Code generation/review/debugging/security → GPT-5.2-Codex for complex; GPT-5 Mini for simpler cases
- Architecture/complex reasoning → GPT-5.2 (or GPT-5.2-Codex when code-heavy)
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

    # Model configurations (February 2026 pricing; USD per 1K tokens).
    # NOTE: "input" roughly maps to prompt tokens; "output" maps to completion tokens.
    MODELS = {
        "gpt-5-nano": ModelConfig(
            name="GPT-5 Nano",
            model_id="gpt-5-nano",
            max_tokens=128000,
            cost_per_1k_input=0.00005,   # $0.05 / 1M input
            cost_per_1k_output=0.00040,  # $0.40 / 1M output
            avg_latency_ms=350,
            strengths=["fast", "high throughput", "cheap", "simple tasks"],
            weaknesses=["weaker at complex code and multi-step reasoning"]
        ),
        "gpt-5-mini": ModelConfig(
            name="GPT-5 Mini",
            model_id="gpt-5-mini",
            max_tokens=128000,
            cost_per_1k_input=0.00025,  # $0.25 / 1M input
            cost_per_1k_output=0.00200, # $2.00 / 1M output
            avg_latency_ms=800,
            strengths=["fast", "strong coding", "great default for UX"],
            weaknesses=["less capable than GPT-5.2 on hardest problems"]
        ),
        "gpt-5.2": ModelConfig(
            name="GPT-5.2",
            model_id="gpt-5.2",
            max_tokens=128000,
            cost_per_1k_input=0.00175,  # $1.75 / 1M input
            cost_per_1k_output=0.01400, # $14.00 / 1M output
            avg_latency_ms=1800,
            strengths=["best general reasoning", "agentic workflows", "code-heavy tasks"],
            weaknesses=["higher cost than GPT-5 Mini"]
        ),
        "gpt-5.2-codex": ModelConfig(
            name="GPT-5.2-Codex",
            model_id="gpt-5.2-codex",
            max_tokens=128000,
            cost_per_1k_input=0.00175,  # same as GPT-5.2
            cost_per_1k_output=0.01400, # same as GPT-5.2
            avg_latency_ms=2200,
            strengths=["agentic coding", "long-horizon changes", "deep code review"],
            weaknesses=["higher latency/cost than GPT-5 Mini for small tasks"]
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

    def __init__(self, default_model: str = "gpt-5-mini", cost_sensitive: bool = False):
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
                model = self.MODELS["gpt-5.2-codex"]
                reason = "Complex code generation benefits from GPT-5.2-Codex long-horizon agentic coding strength"
            elif self.cost_sensitive and complexity == TaskComplexity.SIMPLE:
                model = self.MODELS["gpt-5-nano"]
                reason = "Simple code generation (cost-sensitive), using GPT-5 Nano"
            else:
                model = self.MODELS["gpt-5-mini"]
                reason = "Code generation with GPT-5 Mini for strong quality + fast latency"

        elif task_type == TaskType.CODE_REVIEW:
            if complexity >= TaskComplexity.COMPLEX:
                model = self.MODELS["gpt-5.2-codex"]
                reason = "Complex code review benefits from GPT-5.2-Codex"
            else:
                model = self.MODELS["gpt-5-mini"]
                reason = "Code review with GPT-5 Mini (fast + strong technical accuracy)"

        elif task_type == TaskType.DEBUGGING:
            if complexity >= TaskComplexity.COMPLEX:
                model = self.MODELS["gpt-5.2-codex"]
                reason = "Complex debugging benefits from GPT-5.2-Codex"
            else:
                model = self.MODELS["gpt-5-mini"]
                reason = "Standard debugging with GPT-5 Mini"

        elif task_type == TaskType.EXPLANATION:
            if complexity == TaskComplexity.SIMPLE and self.cost_sensitive:
                model = self.MODELS["gpt-5-nano"]
                reason = "Simple explanation (cost-sensitive), using GPT-5 Nano"
            elif complexity >= TaskComplexity.COMPLEX:
                model = self.MODELS["gpt-5.2"]
                reason = "Complex explanation benefits from GPT-5.2"
            else:
                model = self.MODELS["gpt-5-mini"]
                reason = "Explanation with GPT-5 Mini"

        elif task_type == TaskType.ARCHITECTURE:
            if complexity >= TaskComplexity.COMPLEX:
                model = self.MODELS["gpt-5.2"]
                reason = "Architecture decisions benefit from GPT-5.2"
            else:
                model = self.MODELS["gpt-5-mini"]
                reason = "Architecture guidance with GPT-5 Mini"

        elif task_type == TaskType.SECURITY_ANALYSIS:
            if complexity >= TaskComplexity.MODERATE:
                model = self.MODELS["gpt-5.2-codex"]
                reason = "Security analysis benefits from GPT-5.2-Codex depth and coding focus"
            else:
                model = self.MODELS["gpt-5-mini"]
                reason = "Quick security analysis with GPT-5 Mini"

        else:  # General chat
            if complexity == TaskComplexity.SIMPLE and self.cost_sensitive:
                model = self.MODELS["gpt-5-nano"]
                reason = "Simple chat query (cost-sensitive), using GPT-5 Nano"
            elif complexity >= TaskComplexity.COMPLEX:
                model = self.MODELS["gpt-5.2"]
                reason = "Complex query benefits from GPT-5.2"
            else:
                model = self.MODELS.get(self.default_model, self.MODELS["gpt-5-mini"])
                reason = "Using default model for moderate complexity"

        # Estimate cost (rough, based on ~500 token query, ~1000 token response)
        estimated_cost = (0.5 * model.cost_per_1k_input) + (1.0 * model.cost_per_1k_output)

        # Determine alternative
        alternative = None
        if model.model_id != "gpt-5-mini":
            alternative = "gpt-5-mini"
        elif model.model_id == "gpt-5-nano" and complexity >= TaskComplexity.MODERATE:
            alternative = "gpt-5-mini"

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
