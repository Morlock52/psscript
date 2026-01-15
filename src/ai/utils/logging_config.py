"""
Structured Logging Configuration - January 2026

Provides comprehensive logging setup for the PSScript AI service:
1. Structured JSON logging for production
2. Colored console output for development
3. Log rotation and retention
4. Request/response logging
5. Performance metrics logging
6. Security event logging

Best practices:
- Use structured logging for better searchability
- Include correlation IDs for request tracing
- Separate logs by level and category
- Mask sensitive data in logs
"""

import logging
import logging.handlers
import json
import sys
import os
import re
from typing import Optional, Dict, Any
from datetime import datetime
from dataclasses import dataclass, asdict
from enum import Enum
import uuid
from contextvars import ContextVar

# Context variable for request correlation
request_id_var: ContextVar[str] = ContextVar('request_id', default='')
session_id_var: ContextVar[str] = ContextVar('session_id', default='')


class LogLevel(Enum):
    """Log levels with numeric values."""
    DEBUG = logging.DEBUG
    INFO = logging.INFO
    WARNING = logging.WARNING
    ERROR = logging.ERROR
    CRITICAL = logging.CRITICAL


@dataclass
class LogContext:
    """Context information for structured logs."""
    request_id: str = ''
    session_id: str = ''
    user_id: str = ''
    operation: str = ''
    model: str = ''
    duration_ms: Optional[float] = None
    tokens_used: Optional[int] = None
    extra: Dict[str, Any] = None

    def __post_init__(self):
        if self.extra is None:
            self.extra = {}


# Sensitive patterns to mask in logs
SENSITIVE_PATTERNS = [
    (r'(api[_-]?key["\s:=]+)["\']?[\w\-]+["\']?', r'\1[REDACTED]'),
    (r'(password["\s:=]+)["\']?[^"\']+["\']?', r'\1[REDACTED]'),
    (r'(secret["\s:=]+)["\']?[\w\-]+["\']?', r'\1[REDACTED]'),
    (r'(token["\s:=]+)["\']?[\w\-]+["\']?', r'\1[REDACTED]'),
    (r'(bearer\s+)[\w\-\.]+', r'\1[REDACTED]'),
    (r'(sk-[a-zA-Z0-9]{20})[a-zA-Z0-9]*', r'\1...'),  # OpenAI key pattern
]


def mask_sensitive_data(message: str) -> str:
    """Mask sensitive data in log messages."""
    masked = message
    for pattern, replacement in SENSITIVE_PATTERNS:
        masked = re.sub(pattern, replacement, masked, flags=re.IGNORECASE)
    return masked


class StructuredFormatter(logging.Formatter):
    """JSON formatter for structured logging."""

    def format(self, record: logging.LogRecord) -> str:
        log_data = {
            'timestamp': datetime.utcnow().isoformat() + 'Z',
            'level': record.levelname,
            'logger': record.name,
            'message': mask_sensitive_data(record.getMessage()),
            'module': record.module,
            'function': record.funcName,
            'line': record.lineno,
        }

        # Add request context if available
        request_id = request_id_var.get()
        session_id = session_id_var.get()
        if request_id:
            log_data['request_id'] = request_id
        if session_id:
            log_data['session_id'] = session_id

        # Add extra fields from record
        if hasattr(record, 'context') and isinstance(record.context, LogContext):
            context_dict = {k: v for k, v in asdict(record.context).items() if v}
            log_data['context'] = context_dict

        # Add exception info if present
        if record.exc_info:
            log_data['exception'] = {
                'type': record.exc_info[0].__name__ if record.exc_info[0] else None,
                'message': str(record.exc_info[1]) if record.exc_info[1] else None,
                'traceback': self.formatException(record.exc_info)
            }

        # Add any extra attributes
        for key in ['duration_ms', 'tokens', 'model', 'operation', 'status_code', 'user_id']:
            if hasattr(record, key):
                log_data[key] = getattr(record, key)

        return json.dumps(log_data)


class ColoredFormatter(logging.Formatter):
    """Colored formatter for console output in development."""

    COLORS = {
        'DEBUG': '\033[36m',     # Cyan
        'INFO': '\033[32m',      # Green
        'WARNING': '\033[33m',   # Yellow
        'ERROR': '\033[31m',     # Red
        'CRITICAL': '\033[35m',  # Magenta
    }
    RESET = '\033[0m'
    BOLD = '\033[1m'

    def format(self, record: logging.LogRecord) -> str:
        color = self.COLORS.get(record.levelname, self.RESET)

        # Format timestamp
        timestamp = datetime.fromtimestamp(record.created).strftime('%H:%M:%S')

        # Get context info
        request_id = request_id_var.get()
        req_str = f" [{request_id[:8]}]" if request_id else ""

        # Format the message
        message = mask_sensitive_data(record.getMessage())

        # Build the log line
        log_line = (
            f"{self.BOLD}{timestamp}{self.RESET} "
            f"{color}{record.levelname:8}{self.RESET}"
            f"{req_str} "
            f"{record.name}: {message}"
        )

        # Add extra info if present
        extras = []
        for key in ['duration_ms', 'tokens', 'model', 'operation']:
            if hasattr(record, key):
                extras.append(f"{key}={getattr(record, key)}")
        if extras:
            log_line += f" ({', '.join(extras)})"

        return log_line


class PSScriptLogger(logging.Logger):
    """Enhanced logger with structured logging support."""

    def __init__(self, name: str, level: int = logging.NOTSET):
        super().__init__(name, level)

    def with_context(self, context: LogContext):
        """Return a logger adapter with context."""
        return LoggerWithContext(self, context)

    def log_request(
        self,
        method: str,
        path: str,
        status_code: int,
        duration_ms: float,
        **kwargs
    ):
        """Log an HTTP request."""
        self.info(
            f"{method} {path} - {status_code}",
            extra={
                'operation': 'http_request',
                'status_code': status_code,
                'duration_ms': duration_ms,
                **kwargs
            }
        )

    def log_ai_call(
        self,
        model: str,
        operation: str,
        tokens: int,
        duration_ms: float,
        success: bool = True,
        **kwargs
    ):
        """Log an AI model call."""
        level = logging.INFO if success else logging.WARNING
        self.log(
            level,
            f"AI call: {operation} using {model}",
            extra={
                'operation': operation,
                'model': model,
                'tokens': tokens,
                'duration_ms': duration_ms,
                'success': success,
                **kwargs
            }
        )

    def log_security_event(
        self,
        event_type: str,
        details: str,
        severity: str = 'warning',
        **kwargs
    ):
        """Log a security-related event."""
        level = getattr(logging, severity.upper(), logging.WARNING)
        self.log(
            level,
            f"Security event: {event_type} - {details}",
            extra={
                'operation': 'security_event',
                'event_type': event_type,
                **kwargs
            }
        )


class LoggerWithContext(logging.LoggerAdapter):
    """Logger adapter that includes context in all log messages."""

    def __init__(self, logger: logging.Logger, context: LogContext):
        super().__init__(logger, {})
        self.context = context

    def process(self, msg, kwargs):
        kwargs['extra'] = kwargs.get('extra', {})
        kwargs['extra']['context'] = self.context
        return msg, kwargs


def setup_logging(
    level: str = 'INFO',
    json_format: bool = False,
    log_file: Optional[str] = None,
    max_bytes: int = 10 * 1024 * 1024,  # 10MB
    backup_count: int = 5
) -> None:
    """
    Configure logging for the application.

    Args:
        level: Log level (DEBUG, INFO, WARNING, ERROR, CRITICAL)
        json_format: Use JSON format for logs (recommended for production)
        log_file: Optional file path for log output
        max_bytes: Maximum log file size before rotation
        backup_count: Number of backup files to keep
    """
    # Set custom logger class
    logging.setLoggerClass(PSScriptLogger)

    # Get root logger
    root_logger = logging.getLogger()
    root_logger.setLevel(getattr(logging, level.upper(), logging.INFO))

    # Clear existing handlers
    root_logger.handlers.clear()

    # Console handler
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(logging.DEBUG)

    if json_format:
        console_handler.setFormatter(StructuredFormatter())
    else:
        console_handler.setFormatter(ColoredFormatter())

    root_logger.addHandler(console_handler)

    # File handler with rotation
    if log_file:
        os.makedirs(os.path.dirname(log_file), exist_ok=True)

        file_handler = logging.handlers.RotatingFileHandler(
            log_file,
            maxBytes=max_bytes,
            backupCount=backup_count,
            encoding='utf-8'
        )
        file_handler.setLevel(logging.DEBUG)
        file_handler.setFormatter(StructuredFormatter())
        root_logger.addHandler(file_handler)

    # Security log (separate file for security events)
    if log_file:
        security_log = log_file.replace('.log', '_security.log')
        security_handler = logging.handlers.RotatingFileHandler(
            security_log,
            maxBytes=max_bytes,
            backupCount=backup_count,
            encoding='utf-8'
        )
        security_handler.setLevel(logging.WARNING)
        security_handler.setFormatter(StructuredFormatter())
        security_handler.addFilter(SecurityLogFilter())

        security_logger = logging.getLogger('security')
        security_logger.addHandler(security_handler)

    logging.getLogger('psscript').info(
        f"Logging configured: level={level}, json={json_format}, file={log_file}"
    )


class SecurityLogFilter(logging.Filter):
    """Filter to capture only security-related logs."""

    def filter(self, record: logging.LogRecord) -> bool:
        # Check if it's a security event
        if hasattr(record, 'operation') and record.operation == 'security_event':
            return True
        # Check logger name
        if 'security' in record.name.lower():
            return True
        # Check message content
        if any(kw in record.getMessage().lower() for kw in ['security', 'blocked', 'violation']):
            return True
        return False


def get_logger(name: str) -> PSScriptLogger:
    """
    Get a configured logger instance.

    Args:
        name: Logger name (usually __name__)

    Returns:
        Configured PSScriptLogger instance
    """
    return logging.getLogger(name)


def set_request_context(request_id: Optional[str] = None, session_id: Optional[str] = None):
    """
    Set request context for the current async context.

    Args:
        request_id: Unique request identifier
        session_id: User session identifier
    """
    if request_id:
        request_id_var.set(request_id)
    else:
        request_id_var.set(str(uuid.uuid4()))

    if session_id:
        session_id_var.set(session_id)


def clear_request_context():
    """Clear request context."""
    request_id_var.set('')
    session_id_var.set('')


# Middleware helper for FastAPI
class LoggingMiddleware:
    """Middleware for request/response logging."""

    def __init__(self, app, logger_name: str = 'psscript_api'):
        self.app = app
        self.logger = get_logger(logger_name)

    async def __call__(self, scope, receive, send):
        if scope['type'] != 'http':
            await self.app(scope, receive, send)
            return

        import time

        # Generate request ID
        request_id = str(uuid.uuid4())
        set_request_context(request_id=request_id)

        start_time = time.time()

        # Capture response status
        status_code = 500

        async def send_wrapper(message):
            nonlocal status_code
            if message['type'] == 'http.response.start':
                status_code = message['status']
            await send(message)

        try:
            await self.app(scope, receive, send_wrapper)
        finally:
            duration_ms = (time.time() - start_time) * 1000

            # Log request
            path = scope.get('path', '')
            method = scope.get('method', 'UNKNOWN')

            self.logger.log_request(
                method=method,
                path=path,
                status_code=status_code,
                duration_ms=round(duration_ms, 2)
            )

            clear_request_context()
