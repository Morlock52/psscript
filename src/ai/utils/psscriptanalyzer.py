"""
PSScriptAnalyzer Integration Module - January 2026

This module provides integration with PowerShell's PSScriptAnalyzer
for real-time script linting and best practices validation.

Requires PowerShell 7+ and PSScriptAnalyzer module to be installed:
  Install-Module -Name PSScriptAnalyzer -Scope CurrentUser

Features:
- Real-time script analysis
- Configurable rule sets
- Severity-based filtering
- Auto-fix suggestions where available
"""

import subprocess
import json
import tempfile
import os
import logging
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass
from enum import Enum

logger = logging.getLogger(__name__)


class Severity(str, Enum):
    """PSScriptAnalyzer severity levels."""
    ERROR = "Error"
    WARNING = "Warning"
    INFORMATION = "Information"
    PARSEWARNING = "ParseError"


@dataclass
class AnalyzerResult:
    """Represents a single PSScriptAnalyzer finding."""
    rule_name: str
    severity: Severity
    message: str
    line: int
    column: int
    script_name: str
    suggested_corrections: Optional[List[str]] = None


class PSScriptAnalyzerError(Exception):
    """Exception raised when PSScriptAnalyzer fails."""
    pass


class PSScriptAnalyzer:
    """
    Wrapper for PowerShell's PSScriptAnalyzer.

    Example usage:
        analyzer = PSScriptAnalyzer()
        results = analyzer.analyze_script(script_code)
        for result in results:
            print(f"{result.severity}: {result.message} at line {result.line}")
    """

    # Default rules to exclude (noisy or less useful for AI-generated scripts)
    DEFAULT_EXCLUDED_RULES = [
        "PSUseSingularNouns",  # Often too restrictive for utility functions
        "PSAvoidGlobalVars",   # Sometimes necessary in scripts
    ]

    # Recommended rules for modern PowerShell
    RECOMMENDED_RULES = [
        "PSAvoidUsingCmdletAliases",
        "PSAvoidUsingWriteHost",
        "PSProvideCommentHelp",
        "PSUseApprovedVerbs",
        "PSReservedCmdletChar",
        "PSReservedParams",
        "PSUseShouldProcessForStateChangingFunctions",
        "PSUseDeclaredVarsMoreThanAssignments",
        "PSAvoidUsingInvokeExpression",
        "PSAvoidUsingPlainTextForPassword",
        "PSAvoidUsingConvertToSecureStringWithPlainText",
        "PSUsePSCredentialType",
        "PSAvoidUsingWMICmdlet",  # Deprecated in favor of CIM
        "PSUseCompatibleCmdlets",
        "PSUseCompatibleSyntax",
        "PSUseConsistentWhitespace",
        "PSAlignAssignmentStatement",
        "PSUseCorrectCasing",
    ]

    def __init__(
        self,
        pwsh_path: Optional[str] = None,
        excluded_rules: Optional[List[str]] = None,
        settings_path: Optional[str] = None,
        severity_filter: Optional[List[Severity]] = None
    ):
        """
        Initialize PSScriptAnalyzer wrapper.

        Args:
            pwsh_path: Path to PowerShell 7 executable (defaults to 'pwsh')
            excluded_rules: Rules to exclude from analysis
            settings_path: Path to custom PSScriptAnalyzer settings file
            severity_filter: Only return results with these severities
        """
        self.pwsh_path = pwsh_path or self._find_pwsh()
        self.excluded_rules = excluded_rules or self.DEFAULT_EXCLUDED_RULES
        self.settings_path = settings_path
        self.severity_filter = severity_filter
        self._analyzer_available = None

    def _find_pwsh(self) -> str:
        """Find PowerShell 7 executable."""
        # Common paths for PowerShell 7
        possible_paths = [
            "pwsh",  # In PATH
            "/usr/local/bin/pwsh",  # macOS/Linux
            "/opt/microsoft/powershell/7/pwsh",  # Linux alternative
            r"C:\Program Files\PowerShell\7\pwsh.exe",  # Windows
        ]

        for path in possible_paths:
            try:
                result = subprocess.run(
                    [path, "-Version"],
                    capture_output=True,
                    text=True,
                    timeout=5
                )
                if result.returncode == 0:
                    return path
            except (subprocess.SubprocessError, FileNotFoundError):
                continue

        return "pwsh"  # Default, may fail later

    def is_available(self) -> Tuple[bool, str]:
        """
        Check if PSScriptAnalyzer is available.

        Returns:
            Tuple of (is_available, status_message)
        """
        if self._analyzer_available is not None:
            return self._analyzer_available

        try:
            # Check if pwsh is available
            result = subprocess.run(
                [self.pwsh_path, "-Version"],
                capture_output=True,
                text=True,
                timeout=10
            )
            if result.returncode != 0:
                self._analyzer_available = (False, "PowerShell 7 not found")
                return self._analyzer_available

            ps_version = result.stdout.strip()

            # Check if PSScriptAnalyzer is installed
            check_script = "Get-Module -ListAvailable -Name PSScriptAnalyzer | Select-Object -First 1 -ExpandProperty Version"
            result = subprocess.run(
                [self.pwsh_path, "-NoProfile", "-Command", check_script],
                capture_output=True,
                text=True,
                timeout=15
            )

            if result.returncode != 0 or not result.stdout.strip():
                self._analyzer_available = (
                    False,
                    f"PSScriptAnalyzer not installed. Run: Install-Module PSScriptAnalyzer -Scope CurrentUser"
                )
                return self._analyzer_available

            analyzer_version = result.stdout.strip()
            self._analyzer_available = (
                True,
                f"PSScriptAnalyzer {analyzer_version} available ({ps_version})"
            )
            return self._analyzer_available

        except subprocess.TimeoutExpired:
            self._analyzer_available = (False, "PowerShell check timed out")
            return self._analyzer_available
        except Exception as e:
            self._analyzer_available = (False, f"Error checking PSScriptAnalyzer: {str(e)}")
            return self._analyzer_available

    def analyze_script(
        self,
        script_content: str,
        include_rules: Optional[List[str]] = None,
        custom_rules_path: Optional[str] = None
    ) -> List[AnalyzerResult]:
        """
        Analyze PowerShell script content.

        Args:
            script_content: The PowerShell script code to analyze
            include_rules: Specific rules to include (None = all rules)
            custom_rules_path: Path to custom rule modules

        Returns:
            List of AnalyzerResult objects
        """
        available, msg = self.is_available()
        if not available:
            logger.warning(f"PSScriptAnalyzer not available: {msg}")
            return []

        # Create temporary file for the script
        with tempfile.NamedTemporaryFile(
            mode='w',
            suffix='.ps1',
            delete=False,
            encoding='utf-8'
        ) as f:
            f.write(script_content)
            temp_path = f.name

        try:
            # Build the analyzer command
            ps_command = self._build_analyzer_command(
                temp_path,
                include_rules,
                custom_rules_path
            )

            # Run the analysis
            result = subprocess.run(
                [self.pwsh_path, "-NoProfile", "-Command", ps_command],
                capture_output=True,
                text=True,
                timeout=60
            )

            if result.returncode != 0 and result.stderr:
                # Some errors are expected (like syntax errors in the script)
                logger.debug(f"PSScriptAnalyzer stderr: {result.stderr}")

            # Parse the results
            return self._parse_results(result.stdout, temp_path)

        except subprocess.TimeoutExpired:
            logger.error("PSScriptAnalyzer timed out")
            raise PSScriptAnalyzerError("Analysis timed out after 60 seconds")
        except Exception as e:
            logger.error(f"PSScriptAnalyzer error: {str(e)}")
            raise PSScriptAnalyzerError(str(e))
        finally:
            # Clean up temp file
            try:
                os.unlink(temp_path)
            except OSError:
                pass

    def _build_analyzer_command(
        self,
        script_path: str,
        include_rules: Optional[List[str]],
        custom_rules_path: Optional[str]
    ) -> str:
        """Build the PowerShell command to run the analyzer."""
        parts = [
            f"Invoke-ScriptAnalyzer -Path '{script_path}'"
        ]

        # Add settings if specified
        if self.settings_path:
            parts.append(f"-Settings '{self.settings_path}'")

        # Add rule filters
        if include_rules:
            rules_str = ",".join(f"'{r}'" for r in include_rules)
            parts.append(f"-IncludeRule @({rules_str})")

        if self.excluded_rules:
            rules_str = ",".join(f"'{r}'" for r in self.excluded_rules)
            parts.append(f"-ExcludeRule @({rules_str})")

        # Add custom rules
        if custom_rules_path:
            parts.append(f"-CustomRulePath '{custom_rules_path}'")

        # Output as JSON for parsing
        parts.append("| ConvertTo-Json -Depth 10")

        return " ".join(parts)

    def _parse_results(self, output: str, script_path: str) -> List[AnalyzerResult]:
        """Parse JSON output from PSScriptAnalyzer."""
        if not output.strip():
            return []

        try:
            data = json.loads(output)
        except json.JSONDecodeError:
            logger.warning(f"Failed to parse PSScriptAnalyzer output: {output[:200]}")
            return []

        # Ensure data is a list
        if isinstance(data, dict):
            data = [data]

        results = []
        for item in data:
            try:
                severity = Severity(item.get("Severity", "Warning"))

                # Apply severity filter
                if self.severity_filter and severity not in self.severity_filter:
                    continue

                result = AnalyzerResult(
                    rule_name=item.get("RuleName", "Unknown"),
                    severity=severity,
                    message=item.get("Message", "No message"),
                    line=item.get("Line", 0),
                    column=item.get("Column", 0),
                    script_name=os.path.basename(script_path),
                    suggested_corrections=self._extract_corrections(item)
                )
                results.append(result)
            except Exception as e:
                logger.warning(f"Failed to parse result item: {e}")
                continue

        return results

    def _extract_corrections(self, item: Dict[str, Any]) -> Optional[List[str]]:
        """Extract suggested corrections from analyzer result."""
        corrections = item.get("SuggestedCorrections")
        if not corrections:
            return None

        if isinstance(corrections, list):
            return [c.get("Text", str(c)) for c in corrections if c]
        return None

    def format_results(
        self,
        results: List[AnalyzerResult],
        format_type: str = "markdown"
    ) -> str:
        """
        Format analysis results for display.

        Args:
            results: List of AnalyzerResult objects
            format_type: 'markdown', 'text', or 'json'

        Returns:
            Formatted string
        """
        if not results:
            return "No issues found. Script passes PSScriptAnalyzer checks."

        if format_type == "json":
            return json.dumps([{
                "rule": r.rule_name,
                "severity": r.severity.value,
                "message": r.message,
                "line": r.line,
                "column": r.column
            } for r in results], indent=2)

        # Group by severity
        errors = [r for r in results if r.severity == Severity.ERROR]
        warnings = [r for r in results if r.severity == Severity.WARNING]
        info = [r for r in results if r.severity == Severity.INFORMATION]

        if format_type == "markdown":
            lines = ["## PSScriptAnalyzer Results\n"]

            if errors:
                lines.append("### Errors")
                for r in errors:
                    lines.append(f"- **Line {r.line}**: {r.message}")
                    if r.suggested_corrections:
                        lines.append(f"  - *Suggestion*: `{r.suggested_corrections[0]}`")
                lines.append("")

            if warnings:
                lines.append("### Warnings")
                for r in warnings:
                    lines.append(f"- **Line {r.line}**: {r.message}")
                lines.append("")

            if info:
                lines.append("### Information")
                for r in info:
                    lines.append(f"- Line {r.line}: {r.message}")

            return "\n".join(lines)

        else:  # text format
            lines = [f"PSScriptAnalyzer found {len(results)} issue(s):\n"]
            for r in results:
                lines.append(f"[{r.severity.value}] Line {r.line}: {r.rule_name}")
                lines.append(f"    {r.message}")
            return "\n".join(lines)


# Singleton instance for convenience
_analyzer: Optional[PSScriptAnalyzer] = None


def get_analyzer() -> PSScriptAnalyzer:
    """Get or create the singleton PSScriptAnalyzer instance."""
    global _analyzer
    if _analyzer is None:
        _analyzer = PSScriptAnalyzer()
    return _analyzer


def analyze_script(script_content: str) -> List[AnalyzerResult]:
    """Convenience function to analyze a script."""
    return get_analyzer().analyze_script(script_content)


def format_analysis(script_content: str, format_type: str = "markdown") -> str:
    """Analyze script and return formatted results."""
    analyzer = get_analyzer()
    results = analyzer.analyze_script(script_content)
    return analyzer.format_results(results, format_type)


def check_availability() -> Tuple[bool, str]:
    """Check if PSScriptAnalyzer is available."""
    return get_analyzer().is_available()
