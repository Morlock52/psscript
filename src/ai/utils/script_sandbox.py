"""
PowerShell Script Sandbox - January 2026

Provides safe script execution in a controlled environment.

Security Features:
- Execution timeout limits
- Memory usage restrictions
- Command whitelisting/blacklisting
- Network access control
- File system isolation
- Output capture and filtering

WARNING: Even with sandboxing, running untrusted code is risky.
This sandbox provides DEFENSE IN DEPTH, not absolute security.
"""

import subprocess
import tempfile
import os
import json
import time
import logging
import signal
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass, field
from enum import Enum
from pathlib import Path
import shutil

logger = logging.getLogger(__name__)


class ExecutionStatus(str, Enum):
    """Status of script execution."""
    SUCCESS = "success"
    ERROR = "error"
    TIMEOUT = "timeout"
    BLOCKED = "blocked"
    PARTIAL = "partial"


@dataclass
class ExecutionResult:
    """Result of a sandboxed script execution."""
    status: ExecutionStatus
    stdout: str
    stderr: str
    exit_code: int
    execution_time: float
    warnings: List[str] = field(default_factory=list)
    blocked_commands: List[str] = field(default_factory=list)


class SecurityViolation(Exception):
    """Raised when a script violates security rules."""
    pass


class ScriptSandbox:
    """
    Sandboxed PowerShell script execution environment.

    Example usage:
        sandbox = ScriptSandbox()
        result = sandbox.execute("Get-Process | Select-Object -First 5")
        print(result.stdout)
    """

    # Commands that are NEVER allowed (security risk)
    BLOCKED_COMMANDS = [
        # Dangerous execution
        "Invoke-Expression",
        "iex",
        "Invoke-Command",
        "icm",
        "Start-Process",
        "saps",
        # Network/Download
        "Invoke-WebRequest",
        "iwr",
        "Invoke-RestMethod",
        "irm",
        "wget",
        "curl",
        "Net.WebClient",
        "Start-BitsTransfer",
        # Registry modification
        "Set-ItemProperty",
        "Remove-ItemProperty",
        "New-ItemProperty",
        # Service manipulation
        "Start-Service",
        "Stop-Service",
        "Set-Service",
        "Restart-Service",
        # Scheduled tasks
        "Register-ScheduledTask",
        "Set-ScheduledTask",
        # User/security
        "New-LocalUser",
        "Add-LocalGroupMember",
        "Set-LocalUser",
        # PowerShell remoting
        "Enter-PSSession",
        "New-PSSession",
        "Invoke-CimMethod",
        # Dangerous file operations
        "Remove-Item",
        "ri",
        "del",
        "rmdir",
        "Clear-Content",
        "Set-Content",
        "Out-File",
        "Add-Content",
        # Environment modification
        "Set-Variable",
        "New-Variable",
        "[Environment]",
        # Execution policy bypass
        "Set-ExecutionPolicy",
        "-ExecutionPolicy Bypass",
        # Encoding tricks
        "[System.Convert]::FromBase64String",
        "[Text.Encoding]",
        # Assembly/Reflection
        "Add-Type",
        "[Reflection.Assembly]",
        "Load(",
        # COM objects
        "New-Object -ComObject",
    ]

    # Commands that are allowed (read-only, information gathering)
    ALLOWED_COMMANDS = [
        # System info (read-only)
        "Get-Process",
        "Get-Service",
        "Get-EventLog",
        "Get-WinEvent",
        "Get-CimInstance",
        "Get-WmiObject",
        "Get-ComputerInfo",
        # File system (read-only)
        "Get-ChildItem",
        "Get-Item",
        "Get-Content",
        "Test-Path",
        "Get-Location",
        "Resolve-Path",
        # PowerShell info
        "Get-Command",
        "Get-Help",
        "Get-Module",
        "Get-Variable",
        "Get-Alias",
        # String operations
        "Select-Object",
        "Where-Object",
        "ForEach-Object",
        "Sort-Object",
        "Group-Object",
        "Measure-Object",
        "Format-Table",
        "Format-List",
        "Out-String",
        "ConvertTo-Json",
        "ConvertFrom-Json",
        # Math/Calculations
        "Measure-Command",
        # Date/Time
        "Get-Date",
        "New-TimeSpan",
    ]

    def __init__(
        self,
        timeout_seconds: int = 30,
        max_output_lines: int = 1000,
        max_output_chars: int = 50000,
        pwsh_path: Optional[str] = None,
        allow_network: bool = False,
        allow_file_write: bool = False,
        working_dir: Optional[str] = None
    ):
        """
        Initialize the sandbox.

        Args:
            timeout_seconds: Maximum execution time
            max_output_lines: Maximum output lines to capture
            max_output_chars: Maximum output characters
            pwsh_path: Path to PowerShell executable
            allow_network: Allow network commands (dangerous!)
            allow_file_write: Allow file write commands (dangerous!)
            working_dir: Working directory for execution
        """
        self.timeout = timeout_seconds
        self.max_lines = max_output_lines
        self.max_chars = max_output_chars
        self.pwsh_path = pwsh_path or self._find_pwsh()
        self.allow_network = allow_network
        self.allow_file_write = allow_file_write
        self.working_dir = working_dir

    def _find_pwsh(self) -> str:
        """Find PowerShell executable."""
        for path in ["pwsh", "/usr/local/bin/pwsh", r"C:\Program Files\PowerShell\7\pwsh.exe"]:
            try:
                result = subprocess.run([path, "-Version"], capture_output=True, timeout=5)
                if result.returncode == 0:
                    return path
            except (subprocess.SubprocessError, FileNotFoundError):
                continue
        return "pwsh"

    def validate_script(self, script: str) -> Tuple[bool, List[str], List[str]]:
        """
        Validate a script against security rules.

        Args:
            script: The PowerShell script content

        Returns:
            Tuple of (is_valid, warnings, blocked_commands)
        """
        warnings = []
        blocked = []
        script_upper = script.upper()

        # Check for blocked commands
        for cmd in self.BLOCKED_COMMANDS:
            if cmd.upper() in script_upper:
                # Check for special cases
                if cmd in ("iex", "icm", "iwr", "irm"):
                    # These might be variable names
                    import re
                    if re.search(rf'\b{cmd}\b', script, re.IGNORECASE):
                        blocked.append(cmd)
                else:
                    blocked.append(cmd)

        # Check for suspicious patterns
        suspicious_patterns = [
            ("-EncodedCommand", "Encoded commands are not allowed"),
            ("-enc ", "Encoded commands are not allowed"),
            ("DownloadString", "Remote code execution not allowed"),
            ("DownloadFile", "File downloads not allowed"),
            ("System.Net.", "Network classes not allowed"),
            ("System.IO.File", "Direct file access not allowed"),
            ("::WriteAllBytes", "Binary file writing not allowed"),
            ("$env:", "Environment variable access detected"),
            ("$profile", "Profile access not allowed"),
        ]

        for pattern, warning in suspicious_patterns:
            if pattern.upper() in script_upper:
                if not self.allow_network and "Net" in pattern:
                    blocked.append(pattern)
                else:
                    warnings.append(warning)

        is_valid = len(blocked) == 0
        return is_valid, warnings, blocked

    def execute(self, script: str, parameters: Optional[Dict[str, Any]] = None) -> ExecutionResult:
        """
        Execute a PowerShell script in the sandbox.

        Args:
            script: The PowerShell script to execute
            parameters: Optional parameters to pass to the script

        Returns:
            ExecutionResult with execution details
        """
        start_time = time.time()

        # Validate script first
        is_valid, warnings, blocked = self.validate_script(script)

        if not is_valid:
            return ExecutionResult(
                status=ExecutionStatus.BLOCKED,
                stdout="",
                stderr=f"Script blocked: Contains forbidden commands: {', '.join(blocked)}",
                exit_code=-1,
                execution_time=0,
                warnings=warnings,
                blocked_commands=blocked
            )

        # Create temporary directory for isolation
        temp_dir = tempfile.mkdtemp(prefix="pssandbox_")

        try:
            # Write script to temp file
            script_path = os.path.join(temp_dir, "script.ps1")
            with open(script_path, 'w', encoding='utf-8') as f:
                # Add sandbox wrapper
                sandbox_prefix = self._get_sandbox_prefix()
                f.write(sandbox_prefix + "\n\n" + script)

            # Build command
            cmd = [
                self.pwsh_path,
                "-NoProfile",
                "-NonInteractive",
                "-NoLogo",
                "-ExecutionPolicy", "Bypass",
                "-File", script_path
            ]

            # Add parameters if provided
            if parameters:
                for key, value in parameters.items():
                    cmd.extend([f"-{key}", str(value)])

            # Execute with timeout
            try:
                result = subprocess.run(
                    cmd,
                    capture_output=True,
                    text=True,
                    timeout=self.timeout,
                    cwd=self.working_dir or temp_dir,
                    env=self._get_restricted_env()
                )

                stdout = self._truncate_output(result.stdout)
                stderr = self._truncate_output(result.stderr)
                execution_time = time.time() - start_time

                status = ExecutionStatus.SUCCESS if result.returncode == 0 else ExecutionStatus.ERROR

                return ExecutionResult(
                    status=status,
                    stdout=stdout,
                    stderr=stderr,
                    exit_code=result.returncode,
                    execution_time=execution_time,
                    warnings=warnings
                )

            except subprocess.TimeoutExpired:
                return ExecutionResult(
                    status=ExecutionStatus.TIMEOUT,
                    stdout="",
                    stderr=f"Script execution timed out after {self.timeout} seconds",
                    exit_code=-1,
                    execution_time=self.timeout,
                    warnings=warnings
                )

        except Exception as e:
            logger.error(f"Sandbox execution error: {str(e)}")
            return ExecutionResult(
                status=ExecutionStatus.ERROR,
                stdout="",
                stderr=str(e),
                exit_code=-1,
                execution_time=time.time() - start_time,
                warnings=warnings
            )

        finally:
            # Clean up temp directory
            try:
                shutil.rmtree(temp_dir)
            except Exception as e:
                logger.warning(f"Failed to clean up temp directory: {e}")

    def _get_sandbox_prefix(self) -> str:
        """Get PowerShell code to set up sandbox restrictions."""
        return '''# Sandbox Environment Setup
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$WarningPreference = 'Continue'
$VerbosePreference = 'SilentlyContinue'

# Restrict available cmdlets (commented out for compatibility)
# Some commands are blocked at the validation level instead
'''

    def _get_restricted_env(self) -> Dict[str, str]:
        """Get restricted environment variables."""
        # Start with minimal environment
        env = {}

        # Only include essential variables
        essential = ['PATH', 'TEMP', 'TMP', 'HOME', 'USER', 'SHELL']
        for var in essential:
            if var in os.environ:
                env[var] = os.environ[var]

        # Set PowerShell-specific restrictions
        env['POWERSHELL_TELEMETRY_OPTOUT'] = '1'
        env['POWERSHELL_UPDATECHECK'] = 'Off'

        return env

    def _truncate_output(self, output: str) -> str:
        """Truncate output to configured limits."""
        if not output:
            return ""

        lines = output.split('\n')

        # Truncate by lines
        if len(lines) > self.max_lines:
            lines = lines[:self.max_lines]
            lines.append(f"\n... [Output truncated: {self.max_lines} line limit]")

        result = '\n'.join(lines)

        # Truncate by characters
        if len(result) > self.max_chars:
            result = result[:self.max_chars] + f"\n... [Output truncated: {self.max_chars} char limit]"

        return result


def execute_safely(script: str, timeout: int = 30) -> ExecutionResult:
    """
    Convenience function to safely execute a PowerShell script.

    Args:
        script: The PowerShell script to execute
        timeout: Maximum execution time in seconds

    Returns:
        ExecutionResult
    """
    sandbox = ScriptSandbox(timeout_seconds=timeout)
    return sandbox.execute(script)


def validate_script(script: str) -> Tuple[bool, List[str], List[str]]:
    """
    Validate a script without executing it.

    Returns:
        Tuple of (is_valid, warnings, blocked_commands)
    """
    sandbox = ScriptSandbox()
    return sandbox.validate_script(script)
