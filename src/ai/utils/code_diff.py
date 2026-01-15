"""
Code Diff View Generator - January 2026

Generates beautiful side-by-side and unified diffs for PowerShell scripts.
Useful for showing before/after improvements suggested by AI.

Features:
- Side-by-side diff view
- Unified diff format
- Line-by-line change tracking
- Syntax-aware diff highlighting
- Improvement categorization
"""

import difflib
import re
import logging
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass, field
from enum import Enum

logger = logging.getLogger(__name__)


class ChangeType(str, Enum):
    """Type of change in the diff."""
    ADDED = "added"
    REMOVED = "removed"
    MODIFIED = "modified"
    UNCHANGED = "unchanged"


class ImprovementCategory(str, Enum):
    """Categories of code improvements."""
    PERFORMANCE = "performance"
    SECURITY = "security"
    READABILITY = "readability"
    ERROR_HANDLING = "error_handling"
    BEST_PRACTICES = "best_practices"
    STYLE = "style"
    FUNCTIONALITY = "functionality"


@dataclass
class DiffLine:
    """A single line in the diff."""
    line_number_old: Optional[int]
    line_number_new: Optional[int]
    content_old: Optional[str]
    content_new: Optional[str]
    change_type: ChangeType


@dataclass
class DiffHunk:
    """A contiguous section of changes."""
    start_line_old: int
    start_line_new: int
    lines: List[DiffLine]
    context_before: List[str] = field(default_factory=list)
    context_after: List[str] = field(default_factory=list)


@dataclass
class CodeImprovement:
    """Describes a specific improvement made."""
    category: ImprovementCategory
    description: str
    line_range: Tuple[int, int]
    original_code: str
    improved_code: str


@dataclass
class DiffResult:
    """Complete diff result with metadata."""
    original_lines: int
    improved_lines: int
    lines_added: int
    lines_removed: int
    lines_modified: int
    hunks: List[DiffHunk]
    improvements: List[CodeImprovement]
    unified_diff: str
    html_diff: str
    similarity_ratio: float


class CodeDiffGenerator:
    """
    Generates diffs between original and improved PowerShell code.

    Example usage:
        diff_gen = CodeDiffGenerator()
        result = diff_gen.generate_diff(original_code, improved_code)
        print(result.unified_diff)
    """

    # PowerShell improvement patterns for auto-detection
    IMPROVEMENT_PATTERNS = {
        ImprovementCategory.ERROR_HANDLING: [
            (r'try\s*\{', "Added try-catch error handling"),
            (r'\$ErrorActionPreference\s*=', "Set error action preference"),
            (r'catch\s*\{', "Added exception handler"),
            (r'-ErrorAction\s+Stop', "Configured terminating errors"),
        ],
        ImprovementCategory.SECURITY: [
            (r'\[SecureString\]', "Using secure string for sensitive data"),
            (r'Get-Credential', "Using credential object"),
            (r'-Credential\s+\$', "Parameterized credentials"),
            (r'ConvertTo-SecureString', "Converting to secure string"),
        ],
        ImprovementCategory.PERFORMANCE: [
            (r'\.ForEach\(\{', "Using ForEach method for performance"),
            (r'\[System\.Collections\.Generic\.List', "Using generic list"),
            (r'-AsHashTable', "Converting to hashtable for fast lookups"),
            (r'\$null\s*=', "Suppressing output for performance"),
        ],
        ImprovementCategory.BEST_PRACTICES: [
            (r'\[CmdletBinding\(\)\]', "Added CmdletBinding attribute"),
            (r'\[Parameter\(', "Using parameter attributes"),
            (r'#Requires', "Added module requirements"),
            (r'\.SYNOPSIS', "Added help documentation"),
            (r'Set-StrictMode', "Enabled strict mode"),
        ],
        ImprovementCategory.READABILITY: [
            (r'Write-Verbose', "Added verbose output"),
            (r'#\s*\w+', "Added comments"),
            (r'\$PSCmdlet\.WriteProgress', "Added progress reporting"),
            (r'@\{', "Using splatting for readability"),
        ],
    }

    def __init__(self, context_lines: int = 3):
        """
        Initialize the diff generator.

        Args:
            context_lines: Number of context lines around changes
        """
        self.context_lines = context_lines

    def generate_diff(
        self,
        original: str,
        improved: str,
        detect_improvements: bool = True
    ) -> DiffResult:
        """
        Generate a comprehensive diff between original and improved code.

        Args:
            original: The original PowerShell code
            improved: The improved PowerShell code
            detect_improvements: Whether to auto-detect improvement categories

        Returns:
            DiffResult with all diff information
        """
        original_lines = original.splitlines(keepends=True)
        improved_lines = improved.splitlines(keepends=True)

        # Generate unified diff
        unified = list(difflib.unified_diff(
            original_lines,
            improved_lines,
            fromfile='original.ps1',
            tofile='improved.ps1',
            lineterm=''
        ))
        unified_diff = ''.join(unified)

        # Generate HTML diff for rich display
        html_diff = self._generate_html_diff(original_lines, improved_lines)

        # Calculate statistics
        stats = self._calculate_stats(original_lines, improved_lines)

        # Generate hunks
        hunks = self._generate_hunks(original_lines, improved_lines)

        # Detect improvements
        improvements = []
        if detect_improvements:
            improvements = self._detect_improvements(original, improved)

        # Calculate similarity
        similarity = difflib.SequenceMatcher(
            None, original, improved
        ).ratio()

        return DiffResult(
            original_lines=len(original_lines),
            improved_lines=len(improved_lines),
            lines_added=stats['added'],
            lines_removed=stats['removed'],
            lines_modified=stats['modified'],
            hunks=hunks,
            improvements=improvements,
            unified_diff=unified_diff,
            html_diff=html_diff,
            similarity_ratio=similarity
        )

    def _calculate_stats(
        self,
        original: List[str],
        improved: List[str]
    ) -> Dict[str, int]:
        """Calculate diff statistics."""
        matcher = difflib.SequenceMatcher(None, original, improved)
        opcodes = matcher.get_opcodes()

        added = 0
        removed = 0
        modified = 0

        for tag, i1, i2, j1, j2 in opcodes:
            if tag == 'insert':
                added += j2 - j1
            elif tag == 'delete':
                removed += i2 - i1
            elif tag == 'replace':
                modified += max(i2 - i1, j2 - j1)

        return {
            'added': added,
            'removed': removed,
            'modified': modified
        }

    def _generate_hunks(
        self,
        original: List[str],
        improved: List[str]
    ) -> List[DiffHunk]:
        """Generate diff hunks with context."""
        matcher = difflib.SequenceMatcher(None, original, improved)
        opcodes = matcher.get_opcodes()
        hunks = []

        for tag, i1, i2, j1, j2 in opcodes:
            if tag == 'equal':
                continue

            lines = []

            if tag == 'replace':
                # Modified lines
                max_len = max(i2 - i1, j2 - j1)
                for k in range(max_len):
                    old_idx = i1 + k if k < (i2 - i1) else None
                    new_idx = j1 + k if k < (j2 - j1) else None
                    lines.append(DiffLine(
                        line_number_old=old_idx + 1 if old_idx is not None else None,
                        line_number_new=new_idx + 1 if new_idx is not None else None,
                        content_old=original[old_idx].rstrip() if old_idx is not None else None,
                        content_new=improved[new_idx].rstrip() if new_idx is not None else None,
                        change_type=ChangeType.MODIFIED
                    ))
            elif tag == 'delete':
                # Removed lines
                for k in range(i1, i2):
                    lines.append(DiffLine(
                        line_number_old=k + 1,
                        line_number_new=None,
                        content_old=original[k].rstrip(),
                        content_new=None,
                        change_type=ChangeType.REMOVED
                    ))
            elif tag == 'insert':
                # Added lines
                for k in range(j1, j2):
                    lines.append(DiffLine(
                        line_number_old=None,
                        line_number_new=k + 1,
                        content_old=None,
                        content_new=improved[k].rstrip(),
                        change_type=ChangeType.ADDED
                    ))

            # Get context
            context_before = []
            context_after = []

            start_ctx = max(0, i1 - self.context_lines)
            for k in range(start_ctx, i1):
                context_before.append(original[k].rstrip())

            end_ctx = min(len(original), i2 + self.context_lines)
            for k in range(i2, end_ctx):
                context_after.append(original[k].rstrip())

            hunks.append(DiffHunk(
                start_line_old=i1 + 1,
                start_line_new=j1 + 1,
                lines=lines,
                context_before=context_before,
                context_after=context_after
            ))

        return hunks

    def _generate_html_diff(
        self,
        original: List[str],
        improved: List[str]
    ) -> str:
        """Generate HTML side-by-side diff."""
        differ = difflib.HtmlDiff(wrapcolumn=80)
        html = differ.make_table(
            original,
            improved,
            fromdesc='Original',
            todesc='Improved',
            context=True,
            numlines=self.context_lines
        )

        # Add custom styling
        styled_html = f"""
<style>
.diff-table {{ font-family: 'Consolas', 'Monaco', monospace; font-size: 13px; border-collapse: collapse; width: 100%; }}
.diff-table td {{ padding: 2px 8px; border: 1px solid #ddd; vertical-align: top; }}
.diff-table .diff_header {{ background-color: #f7f7f7; text-align: center; }}
.diff-table .diff_next {{ background-color: #f7f7f7; }}
.diff-table .diff_add {{ background-color: #e6ffec; }}
.diff-table .diff_chg {{ background-color: #fff3cd; }}
.diff-table .diff_sub {{ background-color: #ffebe9; }}
</style>
{html}
"""
        return styled_html

    def _detect_improvements(
        self,
        original: str,
        improved: str
    ) -> List[CodeImprovement]:
        """Auto-detect improvement categories."""
        improvements = []

        for category, patterns in self.IMPROVEMENT_PATTERNS.items():
            for pattern, description in patterns:
                # Check if pattern is in improved but not in original
                in_original = bool(re.search(pattern, original, re.IGNORECASE))
                matches_in_improved = list(re.finditer(pattern, improved, re.IGNORECASE))

                if matches_in_improved and not in_original:
                    for match in matches_in_improved:
                        # Find line number
                        line_start = improved[:match.start()].count('\n') + 1
                        line_end = improved[:match.end()].count('\n') + 1

                        # Extract context
                        lines = improved.split('\n')
                        start_idx = max(0, line_start - 2)
                        end_idx = min(len(lines), line_end + 1)
                        code_context = '\n'.join(lines[start_idx:end_idx])

                        improvements.append(CodeImprovement(
                            category=category,
                            description=description,
                            line_range=(line_start, line_end),
                            original_code="",  # Context from original not available here
                            improved_code=code_context
                        ))

        return improvements

    def get_change_summary(self, result: DiffResult) -> str:
        """Generate a human-readable summary of changes."""
        summary_parts = []

        summary_parts.append(f"Code Comparison Summary")
        summary_parts.append(f"=" * 40)
        summary_parts.append(f"Original: {result.original_lines} lines")
        summary_parts.append(f"Improved: {result.improved_lines} lines")
        summary_parts.append(f"")
        summary_parts.append(f"Changes:")
        summary_parts.append(f"  + {result.lines_added} lines added")
        summary_parts.append(f"  - {result.lines_removed} lines removed")
        summary_parts.append(f"  ~ {result.lines_modified} lines modified")
        summary_parts.append(f"")
        summary_parts.append(f"Similarity: {result.similarity_ratio:.1%}")

        if result.improvements:
            summary_parts.append(f"")
            summary_parts.append(f"Detected Improvements:")
            for imp in result.improvements:
                summary_parts.append(f"  [{imp.category.value}] {imp.description}")

        return '\n'.join(summary_parts)


# Convenience functions
def generate_diff(original: str, improved: str) -> DiffResult:
    """Generate a diff between original and improved code."""
    generator = CodeDiffGenerator()
    return generator.generate_diff(original, improved)


def get_unified_diff(original: str, improved: str) -> str:
    """Get a simple unified diff string."""
    result = generate_diff(original, improved)
    return result.unified_diff


def get_diff_summary(original: str, improved: str) -> str:
    """Get a human-readable diff summary."""
    generator = CodeDiffGenerator()
    result = generator.generate_diff(original, improved)
    return generator.get_change_summary(result)
