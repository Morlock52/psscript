"""
PowerShell Security Guardrails - January 2026

Implements security checks for PowerShell script generation and analysis:
1. Dangerous command detection
2. Credential/secret exposure prevention
3. System-critical operation warnings
4. Malware pattern detection
5. Best practice enforcement

These guardrails ensure safe script generation while maintaining functionality.
"""

import re
import logging
from typing import List, Dict, Optional, Tuple, Set
from dataclasses import dataclass, field
from enum import Enum

logger = logging.getLogger("powershell_security")


class SecurityLevel(Enum):
    """Security risk levels for detected issues."""
    CRITICAL = "critical"  # Must block - destructive/malicious
    HIGH = "high"          # Should warn - potentially dangerous
    MEDIUM = "medium"      # Recommend caution
    LOW = "low"            # Informational
    SAFE = "safe"          # No issues detected


class SecurityCategory(Enum):
    """Categories of security concerns."""
    DESTRUCTIVE_OPERATION = "destructive_operation"
    CREDENTIAL_EXPOSURE = "credential_exposure"
    SYSTEM_MODIFICATION = "system_modification"
    NETWORK_OPERATION = "network_operation"
    EXECUTION_RISK = "execution_risk"
    PRIVILEGE_ESCALATION = "privilege_escalation"
    DATA_EXFILTRATION = "data_exfiltration"
    OBFUSCATION = "obfuscation"
    PERSISTENCE = "persistence"
    SAFE = "safe"


@dataclass
class SecurityFinding:
    """Represents a security finding in code."""
    level: SecurityLevel
    category: SecurityCategory
    message: str
    line_number: Optional[int] = None
    code_snippet: Optional[str] = None
    recommendation: Optional[str] = None


@dataclass
class SecurityScanResult:
    """Result of a security scan."""
    is_safe: bool
    overall_level: SecurityLevel
    findings: List[SecurityFinding] = field(default_factory=list)
    blocked_operations: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)
    recommendations: List[str] = field(default_factory=list)


# Dangerous commands that should be blocked or heavily warned
DANGEROUS_COMMANDS: Dict[str, Tuple[SecurityLevel, str]] = {
    # Destructive file operations
    r'Format-Volume': (SecurityLevel.CRITICAL, "Formats entire disk volumes - data loss"),
    r'Clear-Disk': (SecurityLevel.CRITICAL, "Clears entire disk - data loss"),
    r'Remove-Item\s+.*-Recurse.*[/\\](Windows|System32|Program Files)': (
        SecurityLevel.CRITICAL, "Recursive deletion of system folders"
    ),
    r'Remove-Item\s+.*\$env:(SystemRoot|windir)': (
        SecurityLevel.CRITICAL, "Deletion of Windows system directory"
    ),
    r'Stop-Computer\s*-Force': (SecurityLevel.HIGH, "Forces immediate shutdown"),
    r'Restart-Computer\s*-Force': (SecurityLevel.HIGH, "Forces immediate restart"),

    # Registry dangers
    r'Remove-Item\s+.*HKLM:\\': (SecurityLevel.CRITICAL, "Deleting system registry keys"),
    r'Remove-ItemProperty\s+.*HKLM:\\': (SecurityLevel.HIGH, "Removing system registry values"),
    r'Set-ItemProperty\s+.*HKLM:\\.*\\Run': (SecurityLevel.HIGH, "Modifying startup registry"),

    # Service manipulation
    r'Stop-Service\s+.*wuauserv': (SecurityLevel.MEDIUM, "Stopping Windows Update service"),
    r'Stop-Service\s+.*WinDefend': (SecurityLevel.HIGH, "Stopping Windows Defender"),
    r'Set-Service\s+.*-StartupType\s+Disabled': (SecurityLevel.MEDIUM, "Disabling services"),

    # Firewall/Security
    r'Set-NetFirewallProfile\s+.*-Enabled\s+False': (SecurityLevel.HIGH, "Disabling firewall"),
    r'Disable-WindowsOptionalFeature': (SecurityLevel.MEDIUM, "Disabling Windows features"),

    # Execution policy bypass
    r'-ExecutionPolicy\s+Bypass': (SecurityLevel.MEDIUM, "Bypassing execution policy"),
    r'Set-ExecutionPolicy\s+Unrestricted': (SecurityLevel.MEDIUM, "Setting unrestricted execution"),
}

# Credential/secret patterns to detect
CREDENTIAL_PATTERNS: Dict[str, str] = {
    r'password\s*=\s*["\'][^"\']+["\']': "Hardcoded password detected",
    r'ConvertTo-SecureString\s+.*-AsPlainText': "Plain text password conversion",
    r'api[_-]?key\s*=\s*["\'][^"\']+["\']': "Hardcoded API key detected",
    r'secret\s*=\s*["\'][^"\']+["\']': "Hardcoded secret detected",
    r'token\s*=\s*["\'][^"\']+["\']': "Hardcoded token detected",
    r'\$cred\s*=\s*.*password': "Credential with embedded password",
    r'Authorization.*Bearer\s+[A-Za-z0-9\-_]+': "Hardcoded bearer token",
}

# Obfuscation patterns (potential malware indicators)
OBFUSCATION_PATTERNS: Dict[str, str] = {
    r'-[Ee]ncoded[Cc]ommand': "Base64 encoded command execution",
    r'\[System\.Convert\]::FromBase64String': "Base64 decoding (review content)",
    r'-join\s*\(\s*\[char\[\]\]': "Character array joining (obfuscation)",
    r'\$\{[^}]+\}': "Variable obfuscation with braces",
    r'`\w': "Backtick character escaping (potential obfuscation)",
    r'IEX\s*\(': "Invoke-Expression (dynamic code execution)",
    r'Invoke-Expression': "Dynamic code execution",
    r'\(\s*\[char\]\s*\d+': "ASCII character code usage",
}

# Network/exfiltration patterns
NETWORK_PATTERNS: Dict[str, Tuple[SecurityLevel, str]] = {
    r'Invoke-WebRequest.*-OutFile': (SecurityLevel.MEDIUM, "Downloading file from web"),
    r'Invoke-RestMethod': (SecurityLevel.LOW, "REST API call - verify endpoint"),
    r'Start-BitsTransfer': (SecurityLevel.MEDIUM, "BITS file transfer"),
    r'Net\.WebClient.*DownloadFile': (SecurityLevel.MEDIUM, "WebClient file download"),
    r'Net\.WebClient.*DownloadString': (SecurityLevel.MEDIUM, "WebClient string download"),
    r'Send-MailMessage': (SecurityLevel.MEDIUM, "Sending email - verify recipient"),
    r'\[System\.Net\.Sockets': (SecurityLevel.HIGH, "Raw socket operations"),
}

# Persistence mechanisms
PERSISTENCE_PATTERNS: Dict[str, str] = {
    r'New-ScheduledTask': "Creating scheduled task",
    r'Register-ScheduledTask': "Registering scheduled task",
    r'HKCU:\\.*\\Run': "Modifying user startup registry",
    r'HKLM:\\.*\\Run': "Modifying system startup registry",
    r'Startup\\.*\.lnk': "Creating startup shortcut",
    r'New-Service': "Creating new Windows service",
}

# Best practices to recommend (Updated January 2026)
BEST_PRACTICES: Dict[str, str] = {
    # Legacy patterns to modernize
    r'Write-Host': "Use Write-Output for pipeline data, Write-Verbose for debug info, or $PSStyle for colors (PS7+)",
    r'\$error\[0\]': "Use try/catch/finally blocks for structured error handling",
    r'Out-Null': "Use [void] cast or $null = for better performance: [void]$result or $null = $command",
    r'Get-WmiObject': "DEPRECATED: Use Get-CimInstance for better performance and cross-platform support",
    r'\| ForEach-Object \{': "For large collections, consider foreach() statement or ForEach-Object -Parallel (PS7+)",

    # Modern PowerShell 7+ patterns
    r'if\s*\(\s*\$null\s*-eq': "Consider null-coalescing operator (PS7+): $value ?? 'default'",
    r'if\s*\(.+\)\s*\{\s*\$.+\s*\}\s*else\s*\{\s*\$.+\s*\}': "Consider ternary operator (PS7+): $result = $condition ? $trueVal : $falseVal",

    # Security improvements
    r'ConvertFrom-SecureString': "Consider SecretManagement module for secure credential storage",
    r'Invoke-Expression': "Avoid Invoke-Expression when possible - use direct cmdlet calls or splatting",

    # Performance patterns
    r'\+=\s*\[array\]': "Avoid array concatenation in loops - use ArrayList or generic List<T>",
    r'Select-Object\s+-First\s+1': "Use array indexing [0] for single items - faster than Select-Object",

    # Testing/Quality
    r'function\s+\w+-\w+\s*\{[^}]*\}(?![^{]*\[CmdletBinding)': "Add [CmdletBinding()] to enable common parameters like -Verbose, -Debug",

    # Remote execution credential handling (Double-hop problem - January 2026)
    r'-UseDefaultCredentials': "CAUTION: -UseDefaultCredentials fails on remote computers (double-hop). Use explicit -Credential parameter with Get-Credential",
    r'Invoke-Command\s+-ComputerName(?!.*-Credential)': "Remote command without -Credential may fail accessing network resources. Add -Credential $cred parameter",
    r'Enter-PSSession\s+-ComputerName(?!.*-Credential)': "Remote session without credentials - may fail for nested resource access. Use -Credential parameter",
    r'New-PSSession(?!.*-Credential)': "Consider adding -Credential parameter for consistent authentication in remote sessions",
    r'Invoke-WebRequest.*-UseDefaultCredentials.*Invoke-Command': "UseDefaultCredentials inside remote session will fail. Pass credentials explicitly via -ArgumentList",
}

# PSScriptAnalyzer rule hints (January 2026)
PSSCRIPTANALYZER_HINTS: Dict[str, str] = {
    r'Set-StrictMode': "Good practice! Consider 'Set-StrictMode -Version Latest' for strictest checking",
    r'#Requires\s+-Version': "Excellent! Version requirements help ensure compatibility",
    r'#Requires\s+-Modules': "Great! Explicit module dependencies improve portability",
    r'\$PSDefaultParameterValues': "Nice! Default parameter values can improve script usability",
    r'\[Parameter\(Mandatory': "Good parameter validation! Ensures required inputs are provided",
    r'SupportsShouldProcess': "Excellent! -WhatIf and -Confirm support for safe testing",
}


def scan_powershell_code(
    code: str,
    strict_mode: bool = False,
    context: Optional[str] = None
) -> SecurityScanResult:
    """
    Scan PowerShell code for security issues.

    Args:
        code: PowerShell code to scan
        strict_mode: If True, treat warnings as blockers
        context: Optional context about the script's purpose

    Returns:
        SecurityScanResult with findings and recommendations
    """
    findings: List[SecurityFinding] = []
    blocked: List[str] = []
    warnings: List[str] = []
    recommendations: List[str] = []

    lines = code.split('\n')
    overall_level = SecurityLevel.SAFE

    logger.info(f"Scanning {len(lines)} lines of PowerShell code")

    # Check each line for patterns
    for line_num, line in enumerate(lines, 1):
        line_stripped = line.strip()

        # Skip comments
        if line_stripped.startswith('#'):
            continue

        # Check dangerous commands
        for pattern, (level, message) in DANGEROUS_COMMANDS.items():
            if re.search(pattern, line, re.IGNORECASE):
                finding = SecurityFinding(
                    level=level,
                    category=SecurityCategory.DESTRUCTIVE_OPERATION,
                    message=message,
                    line_number=line_num,
                    code_snippet=line_stripped[:100],
                    recommendation=f"Review necessity of this operation. Consider adding -WhatIf for testing."
                )
                findings.append(finding)

                if level == SecurityLevel.CRITICAL:
                    blocked.append(f"Line {line_num}: {message}")
                    overall_level = SecurityLevel.CRITICAL
                elif level == SecurityLevel.HIGH and overall_level not in [SecurityLevel.CRITICAL]:
                    overall_level = SecurityLevel.HIGH
                    warnings.append(f"Line {line_num}: {message}")

                logger.warning(f"Security finding at line {line_num}: {message}")

        # Check credential patterns
        for pattern, message in CREDENTIAL_PATTERNS.items():
            if re.search(pattern, line, re.IGNORECASE):
                finding = SecurityFinding(
                    level=SecurityLevel.HIGH,
                    category=SecurityCategory.CREDENTIAL_EXPOSURE,
                    message=message,
                    line_number=line_num,
                    code_snippet=line_stripped[:50] + "...",
                    recommendation="Use Get-Credential, environment variables, or Azure Key Vault instead"
                )
                findings.append(finding)
                warnings.append(f"Line {line_num}: {message}")

                if overall_level == SecurityLevel.SAFE:
                    overall_level = SecurityLevel.HIGH

                logger.warning(f"Credential exposure at line {line_num}")

        # Check obfuscation patterns
        for pattern, message in OBFUSCATION_PATTERNS.items():
            if re.search(pattern, line, re.IGNORECASE):
                finding = SecurityFinding(
                    level=SecurityLevel.MEDIUM,
                    category=SecurityCategory.OBFUSCATION,
                    message=message,
                    line_number=line_num,
                    code_snippet=line_stripped[:80],
                    recommendation="Review obfuscated content. Ensure it's not hiding malicious code."
                )
                findings.append(finding)

                if overall_level in [SecurityLevel.SAFE, SecurityLevel.LOW]:
                    overall_level = SecurityLevel.MEDIUM

        # Check network patterns
        for pattern, (level, message) in NETWORK_PATTERNS.items():
            if re.search(pattern, line, re.IGNORECASE):
                finding = SecurityFinding(
                    level=level,
                    category=SecurityCategory.NETWORK_OPERATION,
                    message=message,
                    line_number=line_num,
                    code_snippet=line_stripped[:80]
                )
                findings.append(finding)

        # Check persistence patterns
        for pattern, message in PERSISTENCE_PATTERNS.items():
            if re.search(pattern, line, re.IGNORECASE):
                finding = SecurityFinding(
                    level=SecurityLevel.MEDIUM,
                    category=SecurityCategory.PERSISTENCE,
                    message=message,
                    line_number=line_num,
                    code_snippet=line_stripped[:80],
                    recommendation="Ensure persistence mechanism is intentional and documented"
                )
                findings.append(finding)

        # Check best practices
        for pattern, recommendation in BEST_PRACTICES.items():
            if re.search(pattern, line, re.IGNORECASE):
                recommendations.append(f"Line {line_num}: {recommendation}")

    # Determine if code is safe to execute
    is_safe = overall_level not in [SecurityLevel.CRITICAL]

    if strict_mode and overall_level in [SecurityLevel.HIGH, SecurityLevel.CRITICAL]:
        is_safe = False

    result = SecurityScanResult(
        is_safe=is_safe,
        overall_level=overall_level,
        findings=findings,
        blocked_operations=blocked,
        warnings=warnings,
        recommendations=recommendations[:10]  # Limit recommendations
    )

    logger.info(f"Scan complete: {len(findings)} findings, safe={is_safe}, level={overall_level.value}")

    return result


def sanitize_script_request(request: str) -> Tuple[str, List[str]]:
    """
    Sanitize a script generation request, removing potentially dangerous asks.

    Args:
        request: User's script generation request

    Returns:
        Tuple of (sanitized_request, removed_items)
    """
    removed: List[str] = []
    sanitized = request

    # Dangerous request patterns to filter
    dangerous_requests = [
        (r'delete\s+(all|everything|system)', "bulk deletion request"),
        (r'disable\s+(security|antivirus|firewall|defender)', "security disabling"),
        (r'bypass\s+(security|authentication|uac)', "security bypass"),
        (r'steal\s+(password|credential|data)', "credential theft"),
        (r'exfiltrate', "data exfiltration"),
        (r'ransomware|encrypt\s+all\s+files', "ransomware-like behavior"),
        (r'keylogger|capture\s+keystrokes', "keylogging"),
        (r'hide\s+(from|process|malware)', "hiding/evasion"),
        (r'rootkit', "rootkit functionality"),
        (r'reverse\s+shell|backdoor', "backdoor/reverse shell"),
    ]

    for pattern, description in dangerous_requests:
        if re.search(pattern, request, re.IGNORECASE):
            removed.append(description)
            sanitized = re.sub(pattern, '[REMOVED]', sanitized, flags=re.IGNORECASE)
            logger.warning(f"Removed dangerous request pattern: {description}")

    return sanitized, removed


def get_security_prompt_injection() -> str:
    """
    Get security-focused system prompt additions for PowerShell generation.

    Returns:
        String to inject into system prompts for safe script generation
    """
    return """
SECURITY REQUIREMENTS FOR POWERSHELL SCRIPTS:

1. NEVER generate scripts that:
   - Delete system files or directories
   - Disable security features (firewall, antivirus, UAC)
   - Store passwords or secrets in plain text
   - Create backdoors or reverse shells
   - Implement keylogging or credential theft
   - Use excessive obfuscation

2. ALWAYS include:
   - -WhatIf support for destructive operations
   - Proper error handling with try/catch
   - Parameter validation with [ValidateScript()]
   - Clear comments explaining sensitive operations
   - Confirmation prompts for dangerous actions

3. USE secure practices:
   - Get-Credential for password input
   - SecureString for sensitive data
   - Environment variables for configuration
   - Proper logging without exposing secrets
   - Least-privilege principle

4. WARN the user when generating scripts that:
   - Modify registry
   - Create scheduled tasks
   - Change service configurations
   - Access network resources
   - Require elevated privileges
"""


def validate_generated_output(
    generated_code: str,
    original_request: str,
    context: Optional[str] = None
) -> Tuple[bool, str, List[str]]:
    """
    Three-Layer Guardrail: OUTPUT VALIDATION (January 2026)

    Validates AI-generated PowerShell code before returning to user.
    This is the final safety check in the guardrail architecture.

    Args:
        generated_code: The AI-generated PowerShell code
        original_request: The original user request for context
        context: Optional additional context

    Returns:
        Tuple of (is_safe, possibly_modified_code, warnings)
    """
    warnings: List[str] = []
    modified_code = generated_code

    # Check 1: Scan for security issues
    scan_result = scan_powershell_code(generated_code, strict_mode=False)

    if scan_result.overall_level == SecurityLevel.CRITICAL:
        # Block critical issues
        logger.warning(f"Output validation blocked critical code: {scan_result.blocked_operations}")
        return False, "", [
            "Generated code was blocked due to critical security issues.",
            f"Issues found: {', '.join(scan_result.blocked_operations)}"
        ]

    # Check 2: Validate the output matches the request (prevent injection)
    request_lower = original_request.lower()
    dangerous_mismatch_keywords = [
        ('delete', 'Format-Volume'),
        ('delete', 'Clear-Disk'),
        ('read', 'Remove-Item'),
        ('list', 'Stop-Computer'),
        ('get', 'Set-ExecutionPolicy'),
    ]

    for safe_word, dangerous_cmd in dangerous_mismatch_keywords:
        if safe_word in request_lower and dangerous_cmd.lower() in generated_code.lower():
            warnings.append(
                f"Generated code contains '{dangerous_cmd}' but request mentioned '{safe_word}'. "
                "Please review carefully."
            )

    # Check 3: Add safety comments to dangerous operations
    if '-Force' in generated_code and '-WhatIf' not in generated_code:
        warnings.append(
            "Script uses -Force flag. Consider testing with -WhatIf first."
        )

    # Check 4: Verify good practices are included for complex scripts
    if len(generated_code.split('\n')) > 30:
        # Longer scripts should have error handling
        if 'try' not in generated_code.lower() or 'catch' not in generated_code.lower():
            warnings.append(
                "Complex script without try/catch. Consider adding error handling."
            )

    # Check 5: Ensure no hardcoded credentials
    for pattern, message in CREDENTIAL_PATTERNS.items():
        if re.search(pattern, generated_code, re.IGNORECASE):
            # Remove or mask the credential
            modified_code = re.sub(
                pattern,
                '<# REMOVED: Hardcoded credential detected. Use Get-Credential instead. #>',
                modified_code,
                flags=re.IGNORECASE
            )
            warnings.append(f"Removed hardcoded credential: {message}")

    is_safe = scan_result.is_safe and scan_result.overall_level != SecurityLevel.CRITICAL

    # Log the validation result
    if warnings:
        logger.info(f"Output validation completed with {len(warnings)} warnings")
    else:
        logger.debug("Output validation passed cleanly")

    return is_safe, modified_code, warnings


class PowerShellSecurityGuard:
    """
    Security guard class for PowerShell operations.
    Implements Three-Layer Guardrail Architecture (January 2026):
    1. Input validation (validate_request)
    2. Context construction (integrated in main.py)
    3. Output validation (validate_output)
    """

    def __init__(self, strict_mode: bool = False):
        """
        Initialize the security guard.

        Args:
            strict_mode: If True, be more restrictive with warnings
        """
        self.strict_mode = strict_mode
        self.scan_history: List[SecurityScanResult] = []
        self.blocked_count = 0
        self.warning_count = 0
        self.output_validations = 0
        logger.info(f"PowerShellSecurityGuard initialized, strict_mode={strict_mode}")

    def scan(self, code: str, context: Optional[str] = None) -> SecurityScanResult:
        """
        Scan code and track history.

        Args:
            code: PowerShell code to scan
            context: Optional context about the code

        Returns:
            SecurityScanResult
        """
        result = scan_powershell_code(code, self.strict_mode, context)

        self.scan_history.append(result)
        if not result.is_safe:
            self.blocked_count += 1
        self.warning_count += len(result.warnings)

        # Keep only last 100 scans
        if len(self.scan_history) > 100:
            self.scan_history = self.scan_history[-100:]

        return result

    def get_stats(self) -> Dict:
        """Get scanning statistics."""
        return {
            "total_scans": len(self.scan_history),
            "blocked_count": self.blocked_count,
            "warning_count": self.warning_count,
            "output_validations": self.output_validations,
            "strict_mode": self.strict_mode
        }

    def validate_output(
        self,
        generated_code: str,
        original_request: str,
        context: Optional[str] = None
    ) -> Tuple[bool, str, List[str]]:
        """
        Validate AI-generated output before returning to user.
        This is Layer 3 of the three-layer guardrail architecture.

        Args:
            generated_code: The AI-generated PowerShell code
            original_request: The original user request
            context: Optional context

        Returns:
            Tuple of (is_safe, possibly_modified_code, warnings)
        """
        self.output_validations += 1
        return validate_generated_output(generated_code, original_request, context)

    def validate_request(self, request: str) -> Tuple[bool, str, List[str]]:
        """
        Validate a script generation request before processing.

        Args:
            request: User's script request

        Returns:
            Tuple of (is_valid, sanitized_request, removed_items)
        """
        sanitized, removed = sanitize_script_request(request)
        is_valid = len(removed) == 0 or not self.strict_mode

        if removed:
            logger.warning(f"Request validation removed {len(removed)} dangerous patterns")

        return is_valid, sanitized, removed
