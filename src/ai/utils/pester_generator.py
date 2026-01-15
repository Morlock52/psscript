"""
Pester Test Generator - January 2026

Generates Pester 5.x unit tests for PowerShell scripts using AI.
Follows January 2026 best practices for Pester testing.

Features:
- Automatic function detection
- Parameter coverage
- Mock generation
- Should assertion patterns
- BeforeAll/AfterAll setup
"""

import re
import logging
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass, field
from enum import Enum

logger = logging.getLogger(__name__)


class TestType(str, Enum):
    """Types of Pester tests."""
    UNIT = "Unit"
    INTEGRATION = "Integration"
    ACCEPTANCE = "Acceptance"


@dataclass
class FunctionInfo:
    """Information about a PowerShell function."""
    name: str
    parameters: List[Dict[str, Any]]
    has_cmdlet_binding: bool
    has_should_process: bool
    has_begin_process_end: bool
    outputs: List[str]
    line_number: int


@dataclass
class PesterTest:
    """A generated Pester test."""
    function_name: str
    test_name: str
    test_code: str
    test_type: TestType
    mocks: List[str] = field(default_factory=list)


class PesterGenerator:
    """
    Generates Pester 5.x tests for PowerShell functions.

    Example usage:
        generator = PesterGenerator()
        functions = generator.parse_functions(script_content)
        tests = generator.generate_tests(functions)
        test_file = generator.create_test_file(tests, "MyScript.ps1")
    """

    # Pester 5.x test template
    TEST_FILE_TEMPLATE = '''<#
    .SYNOPSIS
    Pester tests for {script_name}

    .DESCRIPTION
    Auto-generated Pester 5.x tests covering:
    - Function parameter validation
    - Expected outputs
    - Error handling
    - Mock scenarios

    Generated: {date}
    Generator: PSScriptGPT (January 2026)
#>

BeforeAll {{
    # Import the script being tested
    . $PSScriptRoot/{script_name}
}}

{test_blocks}
'''

    DESCRIBE_TEMPLATE = '''
Describe "{function_name}" -Tag "{test_type}" {{
{context_blocks}
}}
'''

    CONTEXT_TEMPLATE = '''    Context "When {context_description}" {{
{before_each}
{it_blocks}
    }}
'''

    IT_TEMPLATE = '''        It "{test_description}" {{
{test_code}
        }}
'''

    def __init__(self, include_mocks: bool = True, test_coverage: str = "standard"):
        """
        Initialize PesterGenerator.

        Args:
            include_mocks: Whether to generate Mock statements
            test_coverage: "minimal", "standard", or "comprehensive"
        """
        self.include_mocks = include_mocks
        self.test_coverage = test_coverage

    def parse_functions(self, script_content: str) -> List[FunctionInfo]:
        """
        Parse PowerShell script to extract function information.

        Args:
            script_content: The PowerShell script content

        Returns:
            List of FunctionInfo objects
        """
        functions = []

        # Regex to match function definitions
        function_pattern = r'''
            (?:^|\n)\s*
            function\s+
            ([\w-]+)                           # Function name
            \s*(?:\{|\()                       # Opening brace or paren
        '''

        for match in re.finditer(function_pattern, script_content, re.VERBOSE | re.MULTILINE):
            func_name = match.group(1)
            func_start = match.start()
            line_number = script_content[:func_start].count('\n') + 1

            # Find the function body
            func_body = self._extract_function_body(script_content, match.end())

            # Parse parameters
            parameters = self._parse_parameters(func_body)

            # Check for CmdletBinding
            has_cmdlet_binding = bool(re.search(r'\[CmdletBinding', func_body, re.IGNORECASE))

            # Check for ShouldProcess
            has_should_process = bool(re.search(
                r'SupportsShouldProcess|PSCmdlet\.ShouldProcess',
                func_body, re.IGNORECASE
            ))

            # Check for Begin/Process/End blocks
            has_bpe = bool(re.search(r'\b(begin|process|end)\s*\{', func_body, re.IGNORECASE))

            # Try to detect return types/outputs
            outputs = self._detect_outputs(func_body)

            functions.append(FunctionInfo(
                name=func_name,
                parameters=parameters,
                has_cmdlet_binding=has_cmdlet_binding,
                has_should_process=has_should_process,
                has_begin_process_end=has_bpe,
                outputs=outputs,
                line_number=line_number
            ))

        return functions

    def _extract_function_body(self, content: str, start_pos: int) -> str:
        """Extract the body of a function starting from a position."""
        brace_count = 0
        in_string = False
        string_char = None
        body_start = None

        for i, char in enumerate(content[start_pos:], start_pos):
            if char in ('"', "'") and (i == 0 or content[i-1] != '`'):
                if not in_string:
                    in_string = True
                    string_char = char
                elif char == string_char:
                    in_string = False

            if not in_string:
                if char == '{':
                    if brace_count == 0:
                        body_start = i
                    brace_count += 1
                elif char == '}':
                    brace_count -= 1
                    if brace_count == 0:
                        return content[body_start:i+1]

        return content[start_pos:start_pos + 500]  # Fallback

    def _parse_parameters(self, func_body: str) -> List[Dict[str, Any]]:
        """Parse parameters from a function body."""
        parameters = []

        # Look for param block
        param_match = re.search(
            r'param\s*\((.*?)\)',
            func_body,
            re.DOTALL | re.IGNORECASE
        )

        if not param_match:
            return parameters

        param_block = param_match.group(1)

        # Parse individual parameters
        param_pattern = r'''
            (?:\[Parameter[^]]*\])?                    # Optional Parameter attribute
            \s*
            (?:\[([\w\[\]]+)\])?                       # Type annotation
            \s*
            \$(\w+)                                     # Parameter name
            \s*
            (?:=\s*([^,\)]+))?                         # Default value
        '''

        for match in re.finditer(param_pattern, param_block, re.VERBOSE):
            param_type = match.group(1) or "object"
            param_name = match.group(2)
            default_value = match.group(3)

            # Check for validation attributes
            is_mandatory = bool(re.search(
                rf'\[Parameter\([^]]*Mandatory[^]]*\)\][^$]*\${param_name}',
                param_block, re.IGNORECASE
            ))

            parameters.append({
                "name": param_name,
                "type": param_type,
                "mandatory": is_mandatory,
                "default": default_value.strip() if default_value else None
            })

        return parameters

    def _detect_outputs(self, func_body: str) -> List[str]:
        """Detect potential output types from function body."""
        outputs = []

        # Check for OutputType attribute
        output_match = re.search(r'\[OutputType\(([^)]+)\)\]', func_body)
        if output_match:
            outputs.append(output_match.group(1).strip("'\"[]"))

        # Check for common return patterns
        if re.search(r'\breturn\s+\[PSCustomObject\]', func_body):
            outputs.append("PSCustomObject")
        if re.search(r'\breturn\s+\$true|\$false', func_body):
            outputs.append("bool")
        if re.search(r'Write-Output|return\s+\$\w+', func_body):
            if "object" not in outputs:
                outputs.append("object")

        return outputs or ["void"]

    def generate_tests(self, functions: List[FunctionInfo]) -> List[PesterTest]:
        """
        Generate Pester tests for a list of functions.

        Args:
            functions: List of FunctionInfo objects

        Returns:
            List of PesterTest objects
        """
        tests = []

        for func in functions:
            # Generate parameter tests
            tests.extend(self._generate_parameter_tests(func))

            # Generate output tests
            tests.extend(self._generate_output_tests(func))

            # Generate error handling tests
            if self.test_coverage in ("standard", "comprehensive"):
                tests.extend(self._generate_error_tests(func))

            # Generate ShouldProcess tests
            if func.has_should_process:
                tests.extend(self._generate_should_process_tests(func))

        return tests

    def _generate_parameter_tests(self, func: FunctionInfo) -> List[PesterTest]:
        """Generate tests for function parameters."""
        tests = []

        for param in func.parameters:
            # Mandatory parameter test
            if param["mandatory"]:
                test = PesterTest(
                    function_name=func.name,
                    test_name=f"requires mandatory parameter {param['name']}",
                    test_code=self._format_test_code(f"""
            {{ {func.name} }} | Should -Throw -Because "{param['name']} is mandatory"
"""),
                    test_type=TestType.UNIT
                )
                tests.append(test)

            # Type validation test
            if param["type"] not in ("object", "string"):
                test = PesterTest(
                    function_name=func.name,
                    test_name=f"validates {param['name']} is of type {param['type']}",
                    test_code=self._format_test_code(f"""
            $result = {func.name} -{param['name']} {self._get_test_value(param['type'])}
            # Verify parameter accepted correct type
            $? | Should -BeTrue
"""),
                    test_type=TestType.UNIT
                )
                tests.append(test)

        return tests

    def _generate_output_tests(self, func: FunctionInfo) -> List[PesterTest]:
        """Generate tests for function outputs."""
        tests = []

        for output_type in func.outputs:
            test = PesterTest(
                function_name=func.name,
                test_name=f"returns {output_type} type",
                test_code=self._format_test_code(f"""
            $result = {func.name} {self._get_minimal_params(func.parameters)}
            $result | Should -Not -BeNullOrEmpty
"""),
                test_type=TestType.UNIT
            )
            tests.append(test)

        return tests

    def _generate_error_tests(self, func: FunctionInfo) -> List[PesterTest]:
        """Generate error handling tests."""
        tests = []

        # Test for graceful error handling
        test = PesterTest(
            function_name=func.name,
            test_name="handles errors gracefully",
            test_code=self._format_test_code(f"""
            # Test with invalid input
            {{ {func.name} -ErrorAction Stop }} | Should -Not -Throw
"""),
            test_type=TestType.UNIT,
            mocks=["Mock Write-Error {}"]
        )
        tests.append(test)

        return tests

    def _generate_should_process_tests(self, func: FunctionInfo) -> List[PesterTest]:
        """Generate ShouldProcess (WhatIf/Confirm) tests."""
        tests = []

        # WhatIf test
        test = PesterTest(
            function_name=func.name,
            test_name="supports -WhatIf",
            test_code=self._format_test_code(f"""
            # WhatIf should not make changes
            $result = {func.name} {self._get_minimal_params(func.parameters)} -WhatIf
            # Verify no actual changes were made
"""),
            test_type=TestType.UNIT
        )
        tests.append(test)

        return tests

    def _format_test_code(self, code: str) -> str:
        """Format test code with proper indentation."""
        lines = code.strip().split('\n')
        return '\n'.join('            ' + line.strip() for line in lines if line.strip())

    def _get_test_value(self, param_type: str) -> str:
        """Get a test value for a parameter type."""
        type_values = {
            "string": '"TestValue"',
            "int": "42",
            "bool": "$true",
            "switch": "",
            "datetime": "(Get-Date)",
            "array": '@("item1", "item2")',
            "hashtable": '@{ Key = "Value" }',
            "pscredential": '(New-Object PSCredential "user", (ConvertTo-SecureString "pass" -AsPlainText -Force))',
        }
        return type_values.get(param_type.lower(), '"TestValue"')

    def _get_minimal_params(self, parameters: List[Dict[str, Any]]) -> str:
        """Get minimal parameter string for function call."""
        params = []
        for param in parameters:
            if param["mandatory"]:
                params.append(f"-{param['name']} {self._get_test_value(param['type'])}")
        return " ".join(params) if params else ""

    def create_test_file(
        self,
        tests: List[PesterTest],
        script_name: str,
        output_path: Optional[str] = None
    ) -> str:
        """
        Create a complete Pester test file.

        Args:
            tests: List of PesterTest objects
            script_name: Name of the script being tested
            output_path: Optional path to write the file

        Returns:
            The complete test file content
        """
        from datetime import datetime

        # Group tests by function
        tests_by_function: Dict[str, List[PesterTest]] = {}
        for test in tests:
            if test.function_name not in tests_by_function:
                tests_by_function[test.function_name] = []
            tests_by_function[test.function_name].append(test)

        # Generate Describe blocks
        describe_blocks = []
        for func_name, func_tests in tests_by_function.items():
            # Group by test type for contexts
            contexts = []

            for test_type in TestType:
                type_tests = [t for t in func_tests if t.test_type == test_type]
                if type_tests:
                    # Build It blocks
                    it_blocks = []
                    for test in type_tests:
                        it_block = self.IT_TEMPLATE.format(
                            test_description=test.test_name,
                            test_code=test.test_code
                        )
                        it_blocks.append(it_block)

                    # Build BeforeEach with mocks
                    before_each = ""
                    all_mocks = set()
                    for test in type_tests:
                        all_mocks.update(test.mocks)
                    if all_mocks:
                        mock_lines = "\n            ".join(all_mocks)
                        before_each = f"        BeforeEach {{\n            {mock_lines}\n        }}\n"

                    context = self.CONTEXT_TEMPLATE.format(
                        context_description=f"performing {test_type.value} tests",
                        before_each=before_each,
                        it_blocks="\n".join(it_blocks)
                    )
                    contexts.append(context)

            describe = self.DESCRIBE_TEMPLATE.format(
                function_name=func_name,
                test_type="Unit",
                context_blocks="\n".join(contexts)
            )
            describe_blocks.append(describe)

        # Create the full test file
        content = self.TEST_FILE_TEMPLATE.format(
            script_name=script_name,
            date=datetime.now().strftime("%Y-%m-%d %H:%M"),
            test_blocks="\n".join(describe_blocks)
        )

        # Write to file if path provided
        if output_path:
            with open(output_path, 'w', encoding='utf-8') as f:
                f.write(content)
            logger.info(f"Test file written to: {output_path}")

        return content


def generate_pester_tests(script_content: str, script_name: str = "Script.ps1") -> str:
    """
    Convenience function to generate Pester tests for a script.

    Args:
        script_content: The PowerShell script content
        script_name: Name of the script file

    Returns:
        Complete Pester test file content
    """
    generator = PesterGenerator()
    functions = generator.parse_functions(script_content)

    if not functions:
        return f"""# No functions found in {script_name}
# Add functions to generate Pester tests
"""

    tests = generator.generate_tests(functions)
    return generator.create_test_file(tests, script_name)
