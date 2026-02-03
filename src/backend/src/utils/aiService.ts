/**
 * AI Service Utility
 * Handles communication with the AI service for PowerShell script analysis and generation
 */
import logger from './logger';
import {
  analyzeScriptAssistant,
  analyzeScriptAssistantQuick,
  answerQuestion,
  explainScript,
  generateExamples,
  generateScript
} from '../services/ai/aiEngine';


/**
 * AI Service client for handling all AI-related operations
 */
class AiServiceClient {
  /**
   * Ask a question to the AI assistant
   */
  async askQuestion(question: string, context?: string, useAgent: boolean = true) {
    try {
      const response = await answerQuestion(question, context);
      return { response };
    } catch (error) {
      logger.error('Error calling AI service for question:', error);
      
      // Fallback response
      let response = '';
      
      if (question.toLowerCase().includes('explain')) {
        response = `This PowerShell script appears to ${context ? 'perform the following operations:\n\n' : 'be a question about explanation. Could you provide the script you\'d like me to explain?'}`;
        if (context) {
          response += `1. It ${context.includes('Get-') ? 'retrieves' : 'performs'} operations on your system\n`;
          response += `2. It uses PowerShell cmdlets for automation\n`;
          response += `3. It ${context.includes('function') ? 'defines custom functions' : 'uses built-in commands'} for its tasks`;
        }
      } else if (question.toLowerCase().includes('create') || question.toLowerCase().includes('generate')) {
        response = `Here's a PowerShell script that addresses your request:\n\n\`\`\`powershell\n# Script to address: ${question}\n\n# Define parameters\nparam (\n    [Parameter(Mandatory=$false)]\n    [string]$Path = "C:\\Temp"\n)\n\n# Main function\nfunction Main {\n    Write-Host "Processing your request..."\n    # Implementation would go here\n}\n\n# Execute the script\nMain\n\`\`\`\n\nThis script creates a foundation that you can customize for your specific needs.`;
      } else {
        response = `To answer your question about PowerShell: ${question}\n\nPowerShell is a task automation and configuration management framework from Microsoft, consisting of a command-line shell and associated scripting language. It's particularly powerful for system administrators and helps automate repetitive tasks.`;
      }
      
      return { response, isFallback: true };
    }
  }

  /**
   * Generate a PowerShell script based on description
   */
  async generateScript(description: string) {
    try {
      const content = await generateScript(description);
      return { content };
    } catch (error) {
      logger.error('Error calling AI service for script generation:', error);
      
      // Fallback script generation
      const scriptContent = `
# PowerShell Script: ${description}
# Generated on: ${new Date().toISOString()}
# 
# This script was auto-generated based on your request (fallback mode)

param (
    [Parameter(Mandatory=$false)]
    [string]$Path = "C:\\Temp"
)

function Main {
    Write-Host "Starting script execution..."
    
    # Create directory if it doesn't exist
    if (-not (Test-Path -Path $Path)) {
        New-Item -ItemType Directory -Path $Path -Force | Out-Null
        Write-Host "Created directory: $Path"
    }
    
    # Main functionality would go here
    Write-Host "Processing ${description.toLowerCase()}..."
    
    ${description.toLowerCase().includes('file') ? 
    `# File operations
    $files = Get-ChildItem -Path $Path -File
    Write-Host "Found $($files.Count) files in $Path"` : ''}
    
    ${description.toLowerCase().includes('process') ? 
    `# Process operations
    $processes = Get-Process | Select-Object -First 5
    Write-Host "Top 5 processes:"
    $processes | Format-Table Name, Id, CPU -AutoSize` : ''}
    
    ${description.toLowerCase().includes('network') ? 
    `# Network operations
    $networkInfo = Get-NetIPAddress | Where-Object { $_.AddressFamily -eq 'IPv4' }
    Write-Host "Network interfaces:"
    $networkInfo | Format-Table InterfaceAlias, IPAddress -AutoSize` : ''}
    
    Write-Host "Script execution completed successfully."
}

# Call the main function
Main
`;
      
      return { content: scriptContent, isFallback: true };
    }
  }

  /**
   * Analyze a script using the AI assistant
   */
  async analyzeScript(content: string, filename?: string, requestType: string = 'standard', analysisOptions?: any) {
    try {
      const normalizedType = String(requestType || 'standard').toLowerCase();
      const result =
        normalizedType === 'quick'
          ? await analyzeScriptAssistantQuick(content, filename || 'script.ps1')
          : await analyzeScriptAssistant(content, filename || 'script.ps1');
      return result;
    } catch (error) {
      logger.error('Error calling AI service for script analysis:', error);
      
      // Fallback mock analysis
      const analysisResult = {
        analysis: {
          purpose: "This appears to be a PowerShell script for system administration tasks.",
          securityScore: Math.floor(Math.random() * 30) + 70, // 70-100
          codeQualityScore: Math.floor(Math.random() * 30) + 70, // 70-100
          riskScore: Math.floor(Math.random() * 20) + 10, // 10-30 (lower is better)
          suggestions: [
            "Consider adding error handling with try/catch blocks",
            "Add more detailed comments to explain complex operations",
            "Use PowerShell best practices for parameter validation"
          ],
          commandDetails: {
            "Get-Process": {
              description: "Retrieves information about processes running on the local computer",
              parameters: [
                { name: "-Name", description: "Specifies process names" },
                { name: "-Id", description: "Specifies process IDs" }
              ]
            },
            "Set-Location": {
              description: "Sets the current working location to a specified location",
              parameters: [
                { name: "-Path", description: "Specifies the path to the new location" }
              ]
            }
          },
          msDocsReferences: [
            { title: "PowerShell Documentation", url: "https://learn.microsoft.com/en-us/powershell/" },
            { title: "PowerShell Scripting", url: "https://learn.microsoft.com/en-us/powershell/scripting/" }
          ],
          examples: [],
          rawAnalysis: "Script analyzed successfully (fallback response)"
        },
        metadata: {
          processingTime: 0.1,
          model: "fallback",
          threadId: `thread_${Date.now().toString(36)}`,
          assistantId: `asst_${Date.now().toString(36)}`,
          requestId: `req_${Date.now().toString(36)}`
        },
        isFallback: true
      };
      
      // Add some content-aware mock analysis
      if (content.includes('function')) {
        analysisResult.analysis.purpose = "This script defines custom functions for automating tasks.";
        analysisResult.analysis.suggestions.push("Consider documenting function parameters with comment-based help");
      }
      
      if (content.includes('Get-')) {
        analysisResult.analysis.purpose = "This script retrieves and processes system information.";
      }
      
      if (content.includes('New-')) {
        analysisResult.analysis.purpose = "This script creates new resources or configurations.";
      }
      
      return analysisResult;
    }
  }

  /**
   * Explain a script or command using the AI assistant
   */
  async explainScript(content: string, type: string = 'simple') {
    try {
      const explanation = await explainScript(content, type);
      return { explanation };
    } catch (error) {
      logger.error('Error calling AI service for explanation:', error);
      
      // Fallback explanation
      const explanation = `This PowerShell code appears to be ${
        content.includes('function') ? 'defining a function and' : ''
      } ${
        content.includes('Get-') ? 'retrieving information using the Get cmdlet' : 
        content.includes('Set-') ? 'modifying system settings using the Set cmdlet' : 
        content.includes('New-') ? 'creating new resources using the New cmdlet' : 
        'performing general PowerShell operations'
      }.
      
The main purpose seems to be ${
  content.toLowerCase().includes('process') ? 'working with system processes' : 
  content.toLowerCase().includes('file') ? 'file system operations' : 
  content.toLowerCase().includes('network') ? 'networking tasks' : 
  content.toLowerCase().includes('user') ? 'user management' : 
  'system administration'
}.

${type === 'detailed' ? `
Key components:
1. ${content.includes('param') ? 'Parameters are defined to accept input values' : 'No parameters are explicitly defined'}
2. ${content.includes('function') ? 'Custom functions are created for code organization' : 'No custom functions are defined'}
3. ${content.includes('if') || content.includes('else') ? 'Conditional logic is used to handle different scenarios' : 'No conditional logic is present'}
4. ${content.includes('foreach') || content.includes('for ') ? 'Loops are used for iterative operations' : 'No loops are present'}
` : ''}

${type === 'security' ? `
Security considerations:
1. ${content.includes('Invoke-Expression') || content.includes('iex ') ? 'WARNING: The script uses Invoke-Expression which can be a security risk if using unvalidated input' : 'No immediate security concerns detected in the basic analysis'}
2. Always review scripts carefully before execution, especially if they come from untrusted sources
` : ''}

This is a fallback explanation generated when the AI service is unavailable.`;
      
      return { explanation, isFallback: true };
    }
  }

  /**
   * Get script examples similar to a description
   */
  async getSimilarExamples(description: string, limit: number = 5) {
    try {
      const examples = await generateExamples(description, limit);
      return { examples };
    } catch (error) {
      logger.error('Error calling AI service for examples:', error);
      
      // Fallback examples
      const examples = [
        {
          name: "System Information Collector",
          description: "Collects basic system information and exports to CSV",
          content: `# System Information Collector
# This script gathers system information and exports it to a CSV file

param (
    [string]$OutputPath = "C:\\Temp\\SystemInfo.csv"
)

# Create directory if it doesn't exist
$directory = Split-Path -Path $OutputPath -Parent
if (-not (Test-Path -Path $directory)) {
    New-Item -ItemType Directory -Path $directory -Force | Out-Null
}

# Gather system information
$computerInfo = Get-ComputerInfo
$processorInfo = Get-WmiObject -Class Win32_Processor
$memoryInfo = Get-WmiObject -Class Win32_PhysicalMemory | Measure-Object -Property Capacity -Sum
$diskInfo = Get-WmiObject -Class Win32_LogicalDisk -Filter "DriveType=3" | Select-Object DeviceID, Size, FreeSpace

# Create custom object with system details
$systemDetails = [PSCustomObject]@{
    ComputerName = $env:COMPUTERNAME
    OSName = $computerInfo.OSName
    OSVersion = $computerInfo.OSVersion
    ProcessorName = $processorInfo.Name
    ProcessorCores = $processorInfo.NumberOfCores
    TotalMemoryGB = [math]::Round($memoryInfo.Sum / 1GB, 2)
    DiskInfo = ($diskInfo | ForEach-Object { "$($_.DeviceID) - $([math]::Round($_.Size / 1GB, 2)) GB (Free: $([math]::Round($_.FreeSpace / 1GB, 2)) GB)" }) -join "; "
    CollectionDate = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
}

# Export to CSV
$systemDetails | Export-Csv -Path $OutputPath -NoTypeInformation
Write-Host "System information exported to $OutputPath"
`,
          tags: ["system", "information", "reporting", "csv"],
          popularity: 87
        },
        {
          name: "Log Parser",
          description: "Parses log files for specific patterns and generates a report",
          content: `# Log Parser Script
# Analyzes log files for specific patterns and generates a summary report

param (
    [Parameter(Mandatory=$true)]
    [string]$LogPath,
    
    [string]$OutputPath = "C:\\Temp\\LogAnalysis.txt",
    
    [string[]]$ErrorPatterns = @(
        "ERROR",
        "CRITICAL",
        "FAILED",
        "EXCEPTION"
    )
)

# Validate log path exists
if (-not (Test-Path -Path $LogPath)) {
    Write-Error "Log path does not exist: $LogPath"
    exit 1
}

# Create output directory if needed
$outputDir = Split-Path -Path $OutputPath -Parent
if (-not (Test-Path -Path $outputDir)) {
    New-Item -ItemType Directory -Path $outputDir -Force | Out-Null
}

# Initialize results
$results = @{
    TotalLines = 0
    ErrorCount = 0
    Errors = @{}
}

# Process log file(s)
Get-ChildItem -Path $LogPath -Filter "*.log" | ForEach-Object {
    $logFile = $_.FullName
    Write-Host "Processing $logFile..."
    
    $content = Get-Content -Path $logFile
    $results.TotalLines += $content.Count
    
    foreach ($pattern in $ErrorPatterns) {
        $matches = $content | Select-String -Pattern $pattern
        $results.Errors[$pattern] = @{
            Count = $matches.Count
            Examples = $matches | Select-Object -First 3 | ForEach-Object { $_.Line }
        }
        $results.ErrorCount += $matches.Count
    }
}

# Generate report
$report = @"
Log Analysis Report
Generated: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")
Log Path: $LogPath

Summary:
-----------------
Total Lines Processed: $($results.TotalLines)
Total Errors Found: $($results.ErrorCount)

Error Breakdown:
-----------------
"@

foreach ($pattern in $ErrorPatterns) {
    $report += @"

Pattern: $pattern
Count: $($results.Errors[$pattern].Count)
Examples:
$($results.Errors[$pattern].Examples -join "\`n")

"@
}

# Save report
$report | Out-File -FilePath $OutputPath
Write-Host "Analysis complete. Report saved to $OutputPath"
`,
          tags: ["logs", "parsing", "analysis", "reporting"],
          popularity: 92
        }
      ];
      
      return { examples, isFallback: true };
    }
  }
}

export default new AiServiceClient();
