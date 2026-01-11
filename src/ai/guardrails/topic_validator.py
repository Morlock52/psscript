"""
Topic Validator for PowerShell AI Assistant - January 2026

Implements a layered guardrail approach:
1. Fast keyword-based validation (first pass)
2. Intent classification (second pass)
3. Helpful redirection for off-topic requests

This ensures the AI assistant stays focused on PowerShell and scripting topics
while providing a good user experience.
"""

import re
from typing import List, Dict, Optional, Tuple
from dataclasses import dataclass
from enum import Enum


class TopicCategory(Enum):
    """Categories of allowed topics for the PowerShell assistant."""
    POWERSHELL_SCRIPTING = "powershell_scripting"
    SCRIPT_ANALYSIS = "script_analysis"
    SCRIPT_GENERATION = "script_generation"
    SCRIPTING_LANGUAGES = "scripting_languages"
    DEVOPS_AUTOMATION = "devops_automation"
    SYSTEM_ADMINISTRATION = "system_administration"
    GENERAL_GREETING = "general_greeting"
    OFF_TOPIC = "off_topic"


@dataclass
class TopicValidationResult:
    """Result of topic validation check."""
    is_valid: bool
    category: TopicCategory
    confidence: float
    message: Optional[str] = None
    is_script_request: bool = False
    suggested_response: Optional[str] = None


# Keywords that indicate PowerShell/scripting related topics
POWERSHELL_KEYWORDS = {
    # PowerShell specific
    'powershell', 'ps1', 'pwsh', 'cmdlet', 'cmdlets', 'get-', 'set-', 'new-',
    'remove-', 'invoke-', 'out-', 'write-host', 'write-output', 'param',
    'function', 'module', 'import-module', 'export-modulemember', 'pipeline',
    'psobject', 'pscustomobject', 'scriptblock', 'psscriptroot', 'pscommandpath',
    'erroractionpreference', 'verbosepreference', 'progresspreference',
    'foreach-object', 'where-object', 'select-object', 'sort-object',
    'group-object', 'measure-object', 'format-table', 'format-list',
    'convertto-json', 'convertfrom-json', 'convertto-xml', 'export-csv',
    'import-csv', 'get-content', 'set-content', 'add-content', 'test-path',
    'get-childitem', 'copy-item', 'move-item', 'remove-item', 'new-item',
    'get-process', 'stop-process', 'start-process', 'get-service',
    'start-service', 'stop-service', 'restart-service', 'get-wmiobject',
    'get-ciminstance', 'invoke-command', 'enter-pssession', 'new-pssession',
    'try', 'catch', 'finally', 'throw', 'trap', '-erroraction', '-verbose',

    # Windows scripting
    'batch', 'bat', 'cmd', 'command prompt', 'vbscript', 'wsh', 'cscript',
    'wscript', 'windows script',

    # General scripting
    'script', 'scripting', 'automation', 'automate', 'scheduled task',
    'task scheduler', 'cron', 'shell', 'bash', 'command line', 'cli',
    'terminal', 'console', 'parameter', 'argument', 'variable', 'loop',
    'conditional', 'function', 'module', 'library', 'api call',

    # DevOps/Automation
    'azure', 'aws', 'gcp', 'cloud', 'ci/cd', 'pipeline', 'deployment',
    'infrastructure', 'configuration', 'provisioning', 'terraform', 'ansible',
    'docker', 'kubernetes', 'container', 'virtualization', 'hyper-v', 'vmware',

    # System administration
    'registry', 'active directory', 'ad', 'ldap', 'group policy', 'gpo',
    'iis', 'web server', 'dns', 'dhcp', 'file server', 'share', 'permission',
    'security', 'firewall', 'antivirus', 'backup', 'restore', 'log', 'event log',
    'performance', 'monitoring', 'wmi', 'cim', 'dsc', 'desired state',

    # Code/programming context
    'code', 'debug', 'error', 'exception', 'syntax', 'best practice',
    'optimize', 'refactor', 'test', 'unit test', 'pester', 'validate'
}

# Keywords that indicate script generation requests
SCRIPT_GENERATION_KEYWORDS = {
    'create', 'generate', 'write', 'make', 'build', 'design', 'develop',
    'help me write', 'help me create', 'can you write', 'can you create',
    'i need a script', 'i want a script', 'script that', 'script to',
    'script for', 'new script', 'custom script', 'automate this',
    'automation for', 'how to automate', 'how do i script'
}

# Greeting patterns
GREETING_PATTERNS = [
    r'^(hi|hello|hey|greetings|good\s+(morning|afternoon|evening))[\s!?.]*$',
    r'^(how are you|what\'?s up|sup)[\s!?.]*$',
    r'^(thanks?|thank you|ty)[\s!?.]*$'
]

# Off-topic keywords (should redirect)
OFF_TOPIC_KEYWORDS = {
    'recipe', 'cooking', 'weather', 'sports', 'movie', 'music', 'game',
    'dating', 'relationship', 'medical', 'health', 'legal', 'lawyer',
    'investment', 'stock', 'crypto', 'bitcoin', 'lottery', 'gambling',
    'politics', 'election', 'religion', 'philosophy', 'astrology',
    'celebrity', 'gossip', 'fashion', 'beauty', 'makeup', 'diet',
    'exercise', 'workout', 'travel', 'vacation', 'hotel', 'flight'
}


def _normalize_text(text: str) -> str:
    """Normalize text for keyword matching."""
    return text.lower().strip()


def _check_keywords(text: str, keywords: set) -> Tuple[bool, float]:
    """
    Check if text contains any keywords from the set.
    Returns (match_found, confidence_score).
    """
    normalized = _normalize_text(text)
    words = set(re.findall(r'\b[\w\-]+\b', normalized))

    # Check for exact matches
    matches = words & keywords

    # Also check for partial matches (e.g., "get-process" matches "get-")
    partial_matches = sum(1 for kw in keywords if kw in normalized)

    total_matches = len(matches) + partial_matches

    if total_matches == 0:
        return False, 0.0

    # Calculate confidence based on number of matches
    confidence = min(1.0, 0.3 + (total_matches * 0.15))
    return True, confidence


def _check_patterns(text: str, patterns: List[str]) -> bool:
    """Check if text matches any regex patterns."""
    normalized = _normalize_text(text)
    return any(re.match(pattern, normalized, re.IGNORECASE) for pattern in patterns)


def is_script_generation_request(text: str) -> bool:
    """
    Check if the user is requesting script generation.

    Args:
        text: User's input message

    Returns:
        True if the user wants to generate/create a new script
    """
    normalized = _normalize_text(text)

    # Check for generation keywords combined with script-related context
    has_generation_keyword, _ = _check_keywords(normalized, SCRIPT_GENERATION_KEYWORDS)
    has_script_context, _ = _check_keywords(normalized, POWERSHELL_KEYWORDS)

    # Also check for explicit patterns
    generation_patterns = [
        r'(create|generate|write|make|build)\s+(a\s+)?(powershell\s+)?script',
        r'script\s+(that|to|for|which)',
        r'(i\s+)?need\s+(a\s+)?script',
        r'can\s+you\s+(write|create|make|generate)',
        r'help\s+(me\s+)?(write|create|make|generate)',
        r'how\s+(to|do\s+i)\s+(write|create|make)\s+(a\s+)?script'
    ]

    has_explicit_pattern = any(
        re.search(pattern, normalized) for pattern in generation_patterns
    )

    return has_explicit_pattern or (has_generation_keyword and has_script_context)


def extract_script_requirements(text: str) -> Dict[str, any]:
    """
    Extract script requirements from a generation request.

    Args:
        text: User's input message

    Returns:
        Dictionary with extracted requirements
    """
    requirements = {
        'description': text,
        'features': [],
        'target_system': 'windows',
        'complexity': 'medium'
    }

    normalized = _normalize_text(text)

    # Detect target system
    if any(kw in normalized for kw in ['linux', 'ubuntu', 'centos', 'redhat', 'bash']):
        requirements['target_system'] = 'linux'
    elif any(kw in normalized for kw in ['mac', 'macos', 'osx', 'darwin']):
        requirements['target_system'] = 'macos'
    elif any(kw in normalized for kw in ['cross-platform', 'cross platform', 'pwsh']):
        requirements['target_system'] = 'cross-platform'

    # Detect complexity hints
    if any(kw in normalized for kw in ['simple', 'basic', 'quick', 'easy']):
        requirements['complexity'] = 'simple'
    elif any(kw in normalized for kw in ['complex', 'advanced', 'comprehensive', 'full']):
        requirements['complexity'] = 'complex'

    # Extract feature keywords
    feature_keywords = [
        'error handling', 'logging', 'progress', 'verbose', 'parameters',
        'help', 'documentation', 'validation', 'retry', 'parallel',
        'async', 'remote', 'credential', 'secure', 'encrypted'
    ]

    requirements['features'] = [
        kw for kw in feature_keywords if kw in normalized
    ]

    return requirements


def validate_powershell_topic(
    user_message: str,
    conversation_history: Optional[List[Dict]] = None
) -> TopicValidationResult:
    """
    Validate if a user message is related to PowerShell/scripting topics.

    This implements a layered guardrail approach:
    1. Quick greeting check
    2. Off-topic keyword detection
    3. PowerShell/scripting keyword matching
    4. Context-based inference

    Args:
        user_message: The user's input message
        conversation_history: Optional list of previous messages for context

    Returns:
        TopicValidationResult with validation status and details
    """
    normalized = _normalize_text(user_message)

    # Layer 1: Check for greetings (always valid)
    if _check_patterns(user_message, GREETING_PATTERNS):
        return TopicValidationResult(
            is_valid=True,
            category=TopicCategory.GENERAL_GREETING,
            confidence=0.95,
            message="Greeting detected"
        )

    # Layer 2: Check for script generation requests (high priority)
    if is_script_generation_request(user_message):
        requirements = extract_script_requirements(user_message)
        return TopicValidationResult(
            is_valid=True,
            category=TopicCategory.SCRIPT_GENERATION,
            confidence=0.9,
            message="Script generation request detected",
            is_script_request=True
        )

    # Layer 3: Check for explicit PowerShell/scripting keywords
    has_ps_keywords, ps_confidence = _check_keywords(normalized, POWERSHELL_KEYWORDS)

    if has_ps_keywords:
        # Determine specific category
        category = TopicCategory.POWERSHELL_SCRIPTING

        if any(kw in normalized for kw in ['analyze', 'review', 'check', 'explain']):
            category = TopicCategory.SCRIPT_ANALYSIS
        elif any(kw in normalized for kw in ['azure', 'aws', 'docker', 'kubernetes', 'ci/cd']):
            category = TopicCategory.DEVOPS_AUTOMATION
        elif any(kw in normalized for kw in ['bash', 'shell', 'python', 'cmd', 'batch']):
            category = TopicCategory.SCRIPTING_LANGUAGES
        elif any(kw in normalized for kw in ['server', 'admin', 'system', 'registry', 'service']):
            category = TopicCategory.SYSTEM_ADMINISTRATION

        return TopicValidationResult(
            is_valid=True,
            category=category,
            confidence=ps_confidence,
            message="PowerShell/scripting topic detected"
        )

    # Layer 4: Check for off-topic content
    has_off_topic, off_topic_confidence = _check_keywords(normalized, OFF_TOPIC_KEYWORDS)

    if has_off_topic and off_topic_confidence > 0.5:
        return TopicValidationResult(
            is_valid=False,
            category=TopicCategory.OFF_TOPIC,
            confidence=off_topic_confidence,
            message="Off-topic request detected",
            suggested_response="""I'm PSScript AI, specialized in PowerShell and scripting topics. I can help you with:

- **PowerShell scripting** - Writing, debugging, and optimizing scripts
- **Script analysis** - Security reviews, code quality checks
- **Automation** - DevOps, CI/CD, scheduled tasks
- **System administration** - Active Directory, Windows Server, services
- **Script generation** - Creating new PowerShell scripts from requirements

What PowerShell or scripting challenge can I help you with today?"""
        )

    # Layer 5: Check conversation context if available
    if conversation_history:
        # If recent messages were about PowerShell, assume continuity
        recent_topics = []
        for msg in conversation_history[-3:]:
            if msg.get('role') == 'user':
                content = msg.get('content', '')
                has_kw, conf = _check_keywords(content, POWERSHELL_KEYWORDS)
                if has_kw:
                    recent_topics.append(conf)

        if recent_topics:
            avg_confidence = sum(recent_topics) / len(recent_topics)
            if avg_confidence > 0.3:
                return TopicValidationResult(
                    is_valid=True,
                    category=TopicCategory.POWERSHELL_SCRIPTING,
                    confidence=avg_confidence * 0.7,  # Reduce confidence for context-based
                    message="Assumed relevant based on conversation context"
                )

    # Layer 6: Ambiguous - could be relevant, allow with lower confidence
    # This provides a better UX by not being overly restrictive
    word_count = len(normalized.split())

    if word_count < 5:
        # Short messages might be follow-ups, allow them
        return TopicValidationResult(
            is_valid=True,
            category=TopicCategory.POWERSHELL_SCRIPTING,
            confidence=0.4,
            message="Short message - assuming relevance"
        )

    # Default: Off-topic but with helpful guidance
    return TopicValidationResult(
        is_valid=False,
        category=TopicCategory.OFF_TOPIC,
        confidence=0.6,
        message="Could not determine PowerShell/scripting relevance",
        suggested_response="""I'm PSScript AI, your PowerShell scripting assistant. I didn't quite understand how your request relates to PowerShell or scripting.

Here's what I can help you with:

- **Write scripts** - "Create a PowerShell script that backs up files to Azure"
- **Debug code** - "Why is my Get-ChildItem command not working?"
- **Explain concepts** - "How do parameters work in PowerShell functions?"
- **Review scripts** - "Can you analyze this script for security issues?"
- **Automate tasks** - "How do I schedule a PowerShell script?"

Could you rephrase your question with more PowerShell context?"""
    )


class TopicValidator:
    """
    Topic validator class for integration with the chat endpoint.

    Provides stateful validation with conversation tracking.
    """

    def __init__(self, strict_mode: bool = False):
        """
        Initialize the topic validator.

        Args:
            strict_mode: If True, reject all ambiguous messages.
                        If False, be more permissive (better UX).
        """
        self.strict_mode = strict_mode
        self.conversation_history: List[Dict] = []

    def add_message(self, role: str, content: str) -> None:
        """Add a message to conversation history."""
        self.conversation_history.append({
            'role': role,
            'content': content
        })
        # Keep only last 10 messages for context
        if len(self.conversation_history) > 10:
            self.conversation_history = self.conversation_history[-10:]

    def validate(self, user_message: str) -> TopicValidationResult:
        """
        Validate a user message.

        Args:
            user_message: The user's input

        Returns:
            TopicValidationResult with validation status
        """
        result = validate_powershell_topic(
            user_message,
            self.conversation_history if self.conversation_history else None
        )

        # In strict mode, reject ambiguous messages
        if self.strict_mode and result.confidence < 0.5 and result.is_valid:
            result.is_valid = False
            result.suggested_response = result.suggested_response or \
                "Please provide more context about how this relates to PowerShell scripting."

        return result

    def clear_history(self) -> None:
        """Clear conversation history."""
        self.conversation_history = []
