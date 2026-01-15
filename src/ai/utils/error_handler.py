"""
Error Handler Module - January 2026

Provides comprehensive error handling for the PSScript AI service:
1. Custom exception hierarchy
2. Error classification and categorization
3. Retry logic with exponential backoff
4. User-friendly error messages
5. Error logging and tracking

Best practices:
- Specific exceptions for different failure modes
- Graceful degradation with fallbacks
- Structured error responses for API
"""

import logging
import traceback
import functools
import asyncio
from typing import Optional, Dict, Any, Callable, TypeVar, Union
from dataclasses import dataclass, field
from enum import Enum
from datetime import datetime
import json

logger = logging.getLogger("error_handler")

T = TypeVar('T')


class ErrorCategory(Enum):
    """Categories of errors for classification."""
    API_ERROR = "api_error"              # External API failures
    VALIDATION_ERROR = "validation_error" # Input validation failures
    AUTH_ERROR = "auth_error"            # Authentication/authorization
    RATE_LIMIT = "rate_limit"            # Rate limiting
    TIMEOUT = "timeout"                  # Operation timeout
    MODEL_ERROR = "model_error"          # AI model errors
    DATABASE_ERROR = "database_error"    # Database operations
    SECURITY_ERROR = "security_error"    # Security violations
    CONFIG_ERROR = "config_error"        # Configuration issues
    INTERNAL_ERROR = "internal_error"    # Unexpected internal errors
    NETWORK_ERROR = "network_error"      # Network connectivity


class ErrorSeverity(Enum):
    """Severity levels for errors."""
    CRITICAL = "critical"  # System cannot continue
    ERROR = "error"        # Operation failed
    WARNING = "warning"    # Operation succeeded with issues
    INFO = "info"          # Informational


@dataclass
class ErrorContext:
    """Context information for an error."""
    operation: str
    user_id: Optional[str] = None
    session_id: Optional[str] = None
    request_id: Optional[str] = None
    model: Optional[str] = None
    additional_info: Dict[str, Any] = field(default_factory=dict)


@dataclass
class ErrorResponse:
    """Structured error response for API."""
    error_code: str
    message: str
    category: ErrorCategory
    severity: ErrorSeverity
    user_message: str
    details: Optional[Dict[str, Any]] = None
    retry_after: Optional[int] = None
    timestamp: str = field(default_factory=lambda: datetime.utcnow().isoformat())

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON response."""
        return {
            "error": {
                "code": self.error_code,
                "message": self.message,
                "category": self.category.value,
                "severity": self.severity.value,
                "user_message": self.user_message,
                "details": self.details,
                "retry_after": self.retry_after,
                "timestamp": self.timestamp
            }
        }


# Custom Exception Hierarchy
class PSScriptError(Exception):
    """Base exception for PSScript AI service."""

    def __init__(
        self,
        message: str,
        category: ErrorCategory = ErrorCategory.INTERNAL_ERROR,
        severity: ErrorSeverity = ErrorSeverity.ERROR,
        user_message: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None,
        retry_after: Optional[int] = None
    ):
        super().__init__(message)
        self.message = message
        self.category = category
        self.severity = severity
        self.user_message = user_message or self._default_user_message()
        self.details = details or {}
        self.retry_after = retry_after

    def _default_user_message(self) -> str:
        """Default user-friendly message based on category."""
        messages = {
            ErrorCategory.API_ERROR: "We're having trouble connecting to AI services. Please try again.",
            ErrorCategory.VALIDATION_ERROR: "There was an issue with your request. Please check your input.",
            ErrorCategory.AUTH_ERROR: "Authentication failed. Please check your API key.",
            ErrorCategory.RATE_LIMIT: "Too many requests. Please wait a moment and try again.",
            ErrorCategory.TIMEOUT: "The operation took too long. Please try a simpler request.",
            ErrorCategory.MODEL_ERROR: "The AI model encountered an issue. Please try again.",
            ErrorCategory.DATABASE_ERROR: "Database operation failed. Please try again.",
            ErrorCategory.SECURITY_ERROR: "This request was blocked for security reasons.",
            ErrorCategory.CONFIG_ERROR: "Service configuration error. Please contact support.",
            ErrorCategory.INTERNAL_ERROR: "An unexpected error occurred. Please try again.",
            ErrorCategory.NETWORK_ERROR: "Network connection issue. Please check your connection."
        }
        return messages.get(self.category, "An error occurred. Please try again.")

    def to_response(self) -> ErrorResponse:
        """Convert to ErrorResponse for API."""
        return ErrorResponse(
            error_code=f"PS_{self.category.value.upper()}",
            message=self.message,
            category=self.category,
            severity=self.severity,
            user_message=self.user_message,
            details=self.details,
            retry_after=self.retry_after
        )


class OpenAIError(PSScriptError):
    """OpenAI API specific errors."""

    def __init__(self, message: str, status_code: Optional[int] = None, **kwargs):
        # Determine category based on status code
        if status_code == 401:
            category = ErrorCategory.AUTH_ERROR
        elif status_code == 429:
            category = ErrorCategory.RATE_LIMIT
            kwargs.setdefault('retry_after', 60)
        elif status_code == 408 or status_code == 504:
            category = ErrorCategory.TIMEOUT
        else:
            category = ErrorCategory.API_ERROR

        super().__init__(message, category=category, **kwargs)
        self.status_code = status_code


class ModelError(PSScriptError):
    """AI model specific errors."""

    def __init__(self, message: str, model_name: str, **kwargs):
        super().__init__(message, category=ErrorCategory.MODEL_ERROR, **kwargs)
        self.model_name = model_name
        self.details['model'] = model_name


class ValidationError(PSScriptError):
    """Input validation errors."""

    def __init__(self, message: str, field: Optional[str] = None, **kwargs):
        super().__init__(message, category=ErrorCategory.VALIDATION_ERROR, **kwargs)
        if field:
            self.details['field'] = field


class SecurityError(PSScriptError):
    """Security-related errors."""

    def __init__(self, message: str, blocked_pattern: Optional[str] = None, **kwargs):
        super().__init__(
            message,
            category=ErrorCategory.SECURITY_ERROR,
            severity=ErrorSeverity.WARNING,
            **kwargs
        )
        if blocked_pattern:
            self.details['blocked_pattern'] = blocked_pattern


class RateLimitError(PSScriptError):
    """Rate limiting errors."""

    def __init__(self, message: str, retry_after: int = 60, **kwargs):
        super().__init__(
            message,
            category=ErrorCategory.RATE_LIMIT,
            retry_after=retry_after,
            **kwargs
        )


class TimeoutError(PSScriptError):
    """Operation timeout errors."""

    def __init__(self, message: str, timeout_seconds: int, **kwargs):
        super().__init__(message, category=ErrorCategory.TIMEOUT, **kwargs)
        self.timeout_seconds = timeout_seconds
        self.details['timeout_seconds'] = timeout_seconds


# Error tracking
class ErrorTracker:
    """Tracks errors for monitoring and analysis."""

    def __init__(self, max_history: int = 1000):
        self.errors: list = []
        self.max_history = max_history
        self.error_counts: Dict[str, int] = {}

    def track(self, error: PSScriptError, context: Optional[ErrorContext] = None):
        """Track an error occurrence."""
        entry = {
            'timestamp': datetime.utcnow().isoformat(),
            'category': error.category.value,
            'severity': error.severity.value,
            'message': error.message,
            'context': context.__dict__ if context else None
        }

        self.errors.append(entry)
        self.error_counts[error.category.value] = self.error_counts.get(error.category.value, 0) + 1

        # Trim history
        if len(self.errors) > self.max_history:
            self.errors = self.errors[-self.max_history:]

        # Log based on severity
        if error.severity == ErrorSeverity.CRITICAL:
            logger.critical(f"CRITICAL: {error.message}", extra=entry)
        elif error.severity == ErrorSeverity.ERROR:
            logger.error(f"ERROR: {error.message}", extra=entry)
        else:
            logger.warning(f"WARNING: {error.message}", extra=entry)

    def get_stats(self) -> Dict[str, Any]:
        """Get error statistics."""
        return {
            'total_errors': len(self.errors),
            'error_counts': self.error_counts,
            'recent_errors': self.errors[-10:]
        }


# Global error tracker instance
error_tracker = ErrorTracker()


def with_error_handling(
    fallback_value: Any = None,
    reraise: bool = False,
    context_factory: Optional[Callable[[], ErrorContext]] = None
):
    """
    Decorator for comprehensive error handling.

    Args:
        fallback_value: Value to return on error (if not reraising)
        reraise: Whether to reraise the exception
        context_factory: Factory function to create ErrorContext
    """
    def decorator(func: Callable[..., T]) -> Callable[..., T]:
        @functools.wraps(func)
        async def async_wrapper(*args, **kwargs) -> T:
            context = context_factory() if context_factory else ErrorContext(operation=func.__name__)
            try:
                return await func(*args, **kwargs)
            except PSScriptError as e:
                error_tracker.track(e, context)
                if reraise:
                    raise
                return fallback_value
            except Exception as e:
                # Wrap unknown exceptions
                wrapped = PSScriptError(
                    message=str(e),
                    category=ErrorCategory.INTERNAL_ERROR,
                    details={'original_error': type(e).__name__, 'traceback': traceback.format_exc()}
                )
                error_tracker.track(wrapped, context)
                logger.exception(f"Unhandled exception in {func.__name__}")
                if reraise:
                    raise wrapped from e
                return fallback_value

        @functools.wraps(func)
        def sync_wrapper(*args, **kwargs) -> T:
            context = context_factory() if context_factory else ErrorContext(operation=func.__name__)
            try:
                return func(*args, **kwargs)
            except PSScriptError as e:
                error_tracker.track(e, context)
                if reraise:
                    raise
                return fallback_value
            except Exception as e:
                wrapped = PSScriptError(
                    message=str(e),
                    category=ErrorCategory.INTERNAL_ERROR,
                    details={'original_error': type(e).__name__, 'traceback': traceback.format_exc()}
                )
                error_tracker.track(wrapped, context)
                logger.exception(f"Unhandled exception in {func.__name__}")
                if reraise:
                    raise wrapped from e
                return fallback_value

        if asyncio.iscoroutinefunction(func):
            return async_wrapper
        return sync_wrapper

    return decorator


def retry_with_backoff(
    max_retries: int = 3,
    initial_delay: float = 1.0,
    max_delay: float = 30.0,
    exponential_base: float = 2.0,
    retryable_errors: tuple = (OpenAIError, TimeoutError, RateLimitError)
):
    """
    Decorator for retry logic with exponential backoff.

    Args:
        max_retries: Maximum number of retry attempts
        initial_delay: Initial delay in seconds
        max_delay: Maximum delay between retries
        exponential_base: Base for exponential backoff
        retryable_errors: Tuple of exception types to retry
    """
    def decorator(func: Callable[..., T]) -> Callable[..., T]:
        @functools.wraps(func)
        async def async_wrapper(*args, **kwargs) -> T:
            delay = initial_delay
            last_exception = None

            for attempt in range(max_retries + 1):
                try:
                    return await func(*args, **kwargs)
                except retryable_errors as e:
                    last_exception = e
                    if attempt < max_retries:
                        # Use retry_after if available
                        if hasattr(e, 'retry_after') and e.retry_after:
                            wait_time = min(e.retry_after, max_delay)
                        else:
                            wait_time = min(delay, max_delay)

                        logger.warning(
                            f"Retry {attempt + 1}/{max_retries} for {func.__name__} "
                            f"after {wait_time}s: {str(e)}"
                        )
                        await asyncio.sleep(wait_time)
                        delay *= exponential_base
                    else:
                        logger.error(f"All {max_retries} retries exhausted for {func.__name__}")
                        raise

            raise last_exception

        @functools.wraps(func)
        def sync_wrapper(*args, **kwargs) -> T:
            import time
            delay = initial_delay
            last_exception = None

            for attempt in range(max_retries + 1):
                try:
                    return func(*args, **kwargs)
                except retryable_errors as e:
                    last_exception = e
                    if attempt < max_retries:
                        wait_time = min(delay, max_delay)
                        if hasattr(e, 'retry_after') and e.retry_after:
                            wait_time = min(e.retry_after, max_delay)

                        logger.warning(
                            f"Retry {attempt + 1}/{max_retries} for {func.__name__} "
                            f"after {wait_time}s: {str(e)}"
                        )
                        time.sleep(wait_time)
                        delay *= exponential_base
                    else:
                        raise

            raise last_exception

        if asyncio.iscoroutinefunction(func):
            return async_wrapper
        return sync_wrapper

    return decorator


def format_error_for_user(error: Union[PSScriptError, Exception]) -> str:
    """
    Format an error message for display to the user.

    Args:
        error: The error to format

    Returns:
        User-friendly error message
    """
    if isinstance(error, PSScriptError):
        return error.user_message

    # Generic error handling
    error_type = type(error).__name__

    if "timeout" in str(error).lower():
        return "The operation timed out. Please try again with a simpler request."
    elif "connection" in str(error).lower():
        return "Connection error. Please check your network and try again."
    elif "auth" in str(error).lower() or "api key" in str(error).lower():
        return "Authentication failed. Please check your API key configuration."
    else:
        return f"An error occurred: {error_type}. Please try again."


def safe_error_detail(error: Union[PSScriptError, Exception], operation: str = "operation") -> str:
    """
    Create a safe error detail string for HTTP exceptions.
    This prevents sensitive information leakage in API responses.

    Args:
        error: The error that occurred
        operation: Name of the operation that failed

    Returns:
        Safe, sanitized error message for HTTP response
    """
    # Log the full error internally
    logger.error(f"Error in {operation}: {str(error)}", exc_info=True)

    # Return sanitized message to user
    return f"{operation.capitalize()} failed: {format_error_for_user(error)}"
