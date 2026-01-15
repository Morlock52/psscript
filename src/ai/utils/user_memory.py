"""
User Memory and Preferences - January 2026

Provides persistent memory for the PowerShell AI Assistant,
allowing it to remember user preferences and past interactions.

Features:
- Session-based short-term memory
- Persistent user preferences
- Skill level tracking
- Common task patterns
- Environment detection
"""

import json
import os
import logging
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, field, asdict
from datetime import datetime, timedelta
from pathlib import Path
from enum import Enum

logger = logging.getLogger(__name__)


class SkillLevel(str, Enum):
    """User's PowerShell skill level."""
    BEGINNER = "beginner"
    INTERMEDIATE = "intermediate"
    ADVANCED = "advanced"
    EXPERT = "expert"


class PowerShellVersion(str, Enum):
    """User's preferred PowerShell version."""
    PS5_1 = "5.1"  # Windows PowerShell
    PS7 = "7"  # PowerShell Core 7.x
    CROSS_PLATFORM = "cross"  # Cross-platform compatible


@dataclass
class UserPreferences:
    """User preferences for the AI assistant."""
    skill_level: SkillLevel = SkillLevel.INTERMEDIATE
    powershell_version: PowerShellVersion = PowerShellVersion.PS7
    preferred_style: str = "verbose"  # verbose, concise, minimal
    include_comments: bool = True
    include_error_handling: bool = True
    prefer_modules: List[str] = field(default_factory=list)
    avoid_patterns: List[str] = field(default_factory=list)
    common_tasks: List[str] = field(default_factory=list)
    environment: str = "windows"  # windows, linux, macos, azure, aws
    response_language: str = "en"


@dataclass
class MemoryEntry:
    """A single memory entry."""
    key: str
    value: Any
    category: str
    created_at: str
    expires_at: Optional[str] = None
    access_count: int = 0


@dataclass
class SessionMemory:
    """Short-term session memory."""
    session_id: str
    created_at: str
    last_accessed: str
    conversation_summary: str = ""
    key_topics: List[str] = field(default_factory=list)
    generated_scripts: List[str] = field(default_factory=list)
    user_corrections: List[Dict[str, str]] = field(default_factory=list)


class UserMemory:
    """
    Manages user memory and preferences.

    Example usage:
        memory = UserMemory(user_id="user123")
        memory.set_preference("skill_level", SkillLevel.ADVANCED)
        memory.remember("last_script_type", "backup")
        prefs = memory.get_preferences()
    """

    def __init__(
        self,
        user_id: str = "default",
        storage_path: Optional[str] = None,
        session_ttl_hours: int = 24
    ):
        """
        Initialize user memory.

        Args:
            user_id: Unique user identifier
            storage_path: Path for persistent storage
            session_ttl_hours: Session expiration time
        """
        self.user_id = user_id
        self.storage_path = storage_path or os.path.join(
            os.path.dirname(__file__), "..", "memory_storage"
        )
        self.session_ttl = timedelta(hours=session_ttl_hours)

        # Ensure storage directory exists
        Path(self.storage_path).mkdir(parents=True, exist_ok=True)

        # Load or create preferences
        self.preferences = self._load_preferences()

        # Short-term memories
        self.memories: Dict[str, MemoryEntry] = {}

        # Session data
        self.sessions: Dict[str, SessionMemory] = {}

    def _get_user_file(self, filename: str) -> str:
        """Get path to user-specific file."""
        user_dir = os.path.join(self.storage_path, self.user_id)
        Path(user_dir).mkdir(parents=True, exist_ok=True)
        return os.path.join(user_dir, filename)

    def _load_preferences(self) -> UserPreferences:
        """Load user preferences from disk."""
        prefs_file = self._get_user_file("preferences.json")
        try:
            if os.path.exists(prefs_file):
                with open(prefs_file, 'r') as f:
                    data = json.load(f)
                    return UserPreferences(
                        skill_level=SkillLevel(data.get("skill_level", "intermediate")),
                        powershell_version=PowerShellVersion(data.get("powershell_version", "7")),
                        preferred_style=data.get("preferred_style", "verbose"),
                        include_comments=data.get("include_comments", True),
                        include_error_handling=data.get("include_error_handling", True),
                        prefer_modules=data.get("prefer_modules", []),
                        avoid_patterns=data.get("avoid_patterns", []),
                        common_tasks=data.get("common_tasks", []),
                        environment=data.get("environment", "windows"),
                        response_language=data.get("response_language", "en")
                    )
        except Exception as e:
            logger.warning(f"Failed to load preferences: {e}")

        return UserPreferences()

    def _save_preferences(self):
        """Save user preferences to disk."""
        prefs_file = self._get_user_file("preferences.json")
        try:
            data = {
                "skill_level": self.preferences.skill_level.value,
                "powershell_version": self.preferences.powershell_version.value,
                "preferred_style": self.preferences.preferred_style,
                "include_comments": self.preferences.include_comments,
                "include_error_handling": self.preferences.include_error_handling,
                "prefer_modules": self.preferences.prefer_modules,
                "avoid_patterns": self.preferences.avoid_patterns,
                "common_tasks": self.preferences.common_tasks,
                "environment": self.preferences.environment,
                "response_language": self.preferences.response_language
            }
            with open(prefs_file, 'w') as f:
                json.dump(data, f, indent=2)
        except Exception as e:
            logger.error(f"Failed to save preferences: {e}")

    def get_preferences(self) -> UserPreferences:
        """Get current user preferences."""
        return self.preferences

    def set_preference(self, key: str, value: Any):
        """Set a user preference."""
        if hasattr(self.preferences, key):
            setattr(self.preferences, key, value)
            self._save_preferences()
        else:
            logger.warning(f"Unknown preference key: {key}")

    def update_preferences(self, **kwargs):
        """Update multiple preferences at once."""
        for key, value in kwargs.items():
            if hasattr(self.preferences, key):
                setattr(self.preferences, key, value)
        self._save_preferences()

    def remember(
        self,
        key: str,
        value: Any,
        category: str = "general",
        ttl_hours: Optional[int] = None
    ):
        """
        Store something in memory.

        Args:
            key: Memory key
            value: Value to remember
            category: Category for organization
            ttl_hours: Time to live in hours (None = permanent)
        """
        now = datetime.now().isoformat()
        expires = None
        if ttl_hours:
            expires = (datetime.now() + timedelta(hours=ttl_hours)).isoformat()

        self.memories[key] = MemoryEntry(
            key=key,
            value=value,
            category=category,
            created_at=now,
            expires_at=expires
        )

        # Persist to disk
        self._save_memories()

    def recall(self, key: str, default: Any = None) -> Any:
        """
        Recall something from memory.

        Args:
            key: Memory key
            default: Default value if not found

        Returns:
            The remembered value or default
        """
        self._load_memories()

        if key not in self.memories:
            return default

        entry = self.memories[key]

        # Check expiration
        if entry.expires_at:
            if datetime.fromisoformat(entry.expires_at) < datetime.now():
                del self.memories[key]
                self._save_memories()
                return default

        # Update access count
        entry.access_count += 1
        return entry.value

    def forget(self, key: str):
        """Remove something from memory."""
        if key in self.memories:
            del self.memories[key]
            self._save_memories()

    def _load_memories(self):
        """Load memories from disk."""
        memories_file = self._get_user_file("memories.json")
        try:
            if os.path.exists(memories_file):
                with open(memories_file, 'r') as f:
                    data = json.load(f)
                    self.memories = {
                        k: MemoryEntry(**v) for k, v in data.items()
                    }
        except Exception as e:
            logger.warning(f"Failed to load memories: {e}")

    def _save_memories(self):
        """Save memories to disk."""
        memories_file = self._get_user_file("memories.json")
        try:
            data = {k: asdict(v) for k, v in self.memories.items()}
            with open(memories_file, 'w') as f:
                json.dump(data, f, indent=2)
        except Exception as e:
            logger.error(f"Failed to save memories: {e}")

    def start_session(self, session_id: str) -> SessionMemory:
        """Start a new conversation session."""
        now = datetime.now().isoformat()
        session = SessionMemory(
            session_id=session_id,
            created_at=now,
            last_accessed=now
        )
        self.sessions[session_id] = session
        return session

    def get_session(self, session_id: str) -> Optional[SessionMemory]:
        """Get an existing session."""
        session = self.sessions.get(session_id)
        if session:
            session.last_accessed = datetime.now().isoformat()
        return session

    def update_session(
        self,
        session_id: str,
        summary: Optional[str] = None,
        topics: Optional[List[str]] = None,
        script: Optional[str] = None,
        correction: Optional[Dict[str, str]] = None
    ):
        """Update session with new information."""
        session = self.sessions.get(session_id)
        if not session:
            session = self.start_session(session_id)

        if summary:
            session.conversation_summary = summary
        if topics:
            session.key_topics.extend(topics)
        if script:
            session.generated_scripts.append(script)
        if correction:
            session.user_corrections.append(correction)

        session.last_accessed = datetime.now().isoformat()

    def get_context_for_prompt(self, session_id: Optional[str] = None) -> str:
        """
        Generate context string for AI prompt based on user memory.

        Returns a formatted string to inject into system prompt.
        """
        context_parts = []

        # Add skill level context
        skill_prompts = {
            SkillLevel.BEGINNER: "The user is a PowerShell beginner. Explain concepts clearly and avoid advanced syntax.",
            SkillLevel.INTERMEDIATE: "The user has intermediate PowerShell knowledge. Balance explanation with efficiency.",
            SkillLevel.ADVANCED: "The user is advanced. Focus on best practices and optimization.",
            SkillLevel.EXPERT: "The user is a PowerShell expert. Be concise, focus on edge cases and performance."
        }
        context_parts.append(skill_prompts[self.preferences.skill_level])

        # Add version preference
        if self.preferences.powershell_version == PowerShellVersion.PS5_1:
            context_parts.append("Target Windows PowerShell 5.1 (avoid PS7+ features).")
        elif self.preferences.powershell_version == PowerShellVersion.PS7:
            context_parts.append("Use PowerShell 7+ features when beneficial.")
        else:
            context_parts.append("Ensure cross-platform compatibility (PS 7 on Windows/Linux/macOS).")

        # Add style preference
        if self.preferences.preferred_style == "concise":
            context_parts.append("Keep explanations brief and to the point.")
        elif self.preferences.preferred_style == "minimal":
            context_parts.append("Minimal explanation, focus on code.")

        # Add environment context
        if self.preferences.environment != "windows":
            context_parts.append(f"User's environment: {self.preferences.environment}")

        # Add common tasks if any
        if self.preferences.common_tasks:
            tasks = ", ".join(self.preferences.common_tasks[:3])
            context_parts.append(f"User commonly works on: {tasks}")

        # Add session context if available
        if session_id and session_id in self.sessions:
            session = self.sessions[session_id]
            if session.conversation_summary:
                context_parts.append(f"Session context: {session.conversation_summary}")
            if session.user_corrections:
                last_correction = session.user_corrections[-1]
                context_parts.append(
                    f"User previously corrected: '{last_correction.get('original')}' → '{last_correction.get('corrected')}'"
                )

        return "\n".join(context_parts)

    def learn_from_feedback(self, feedback_type: str, details: Dict[str, Any]):
        """
        Learn from user feedback to improve future responses.

        Args:
            feedback_type: Type of feedback (correction, preference, task)
            details: Feedback details
        """
        if feedback_type == "correction":
            # Remember corrections to avoid in future
            self.remember(
                f"correction_{len(self.memories)}",
                details,
                category="corrections",
                ttl_hours=720  # 30 days
            )

        elif feedback_type == "preference":
            # Update preferences based on feedback
            if "skill_level" in details:
                self.set_preference("skill_level", SkillLevel(details["skill_level"]))
            if "style" in details:
                self.set_preference("preferred_style", details["style"])

        elif feedback_type == "task":
            # Track common tasks
            task = details.get("task")
            if task and task not in self.preferences.common_tasks:
                self.preferences.common_tasks.append(task)
                if len(self.preferences.common_tasks) > 10:
                    self.preferences.common_tasks = self.preferences.common_tasks[-10:]
                self._save_preferences()


# Singleton instances per user
_memory_instances: Dict[str, UserMemory] = {}


def get_user_memory(user_id: str = "default") -> UserMemory:
    """Get or create a UserMemory instance for a user."""
    if user_id not in _memory_instances:
        _memory_instances[user_id] = UserMemory(user_id=user_id)
    return _memory_instances[user_id]
