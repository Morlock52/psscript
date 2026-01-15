/**
 * AI Agent Routes
 * Handles AI agent interactions including question answering, script generation, and analysis
 */
import express from 'express';
import { corsMiddleware } from '../middleware/corsMiddleware';
import logger from '../utils/logger';

const router = express.Router();

// Apply CORS middleware
router.use(corsMiddleware);

/**
 * Answer a question about PowerShell using the AI agent
 */
router.post('/please', async (req, res) => {
  try {
    const { question, context, useAgent: _useAgent = false } = req.body;
    
    if (!question) {
      return res.status(400).json({ 
        message: 'Question is required', 
        status: 'error' 
      });
    }
    
    logger.info(`Processing AI agent question: "${question.substring(0, 50)}..."`);
    
    // Generate a response based on the question type
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
    
    return res.json({ response });
  } catch (error) {
    logger.error('Error in AI agent question endpoint:', error);
    return res.status(500).json({ 
      message: 'Failed to process your question', 
      status: 'error' 
    });
  }
});

/**
 * Generate a PowerShell script based on a description
 */
router.post('/generate', async (req, res) => {
  try {
    const { description } = req.body;
    
    if (!description) {
      return res.status(400).json({ 
        message: 'Description is required', 
        status: 'error' 
      });
    }
    
    logger.info(`Processing script generation request: "${description.substring(0, 50)}..."`);
    
    // Generate a simple PowerShell script based on the description
    const scriptContent = `
# PowerShell Script: ${description}
# Generated on: ${new Date().toISOString()}
# 
# This script was auto-generated based on your request

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
    
    return res.json({ content: scriptContent });
  } catch (error) {
    logger.error('Error in script generation endpoint:', error);
    return res.status(500).json({ 
      message: 'Failed to generate script', 
      status: 'error' 
    });
  }
});

/**
 * Explain a PowerShell script or command
 */
router.post('/explain', async (req, res) => {
  try {
    const { content, type = 'simple' } = req.body;
    
    if (!content) {
      return res.status(400).json({ 
        message: 'Script content is required', 
        status: 'error' 
      });
    }
    
    logger.info(`Processing script explanation request (${type})`);
    
    // Generate explanation based on content
    let explanation = "This PowerShell script ";
    
    if (content.includes('Get-')) {
      explanation += "retrieves information from your system. ";
    }
    
    if (content.includes('Set-')) {
      explanation += "modifies system settings or properties. ";
    }
    
    if (content.includes('New-')) {
      explanation += "creates new resources or objects. ";
    }
    
    if (content.includes('Remove-')) {
      explanation += "removes resources or objects from your system. ";
    }
    
    if (content.includes('function')) {
      explanation += "defines custom functions for reusable code blocks. ";
    }
    
    if (content.includes('foreach') || content.includes('for ') || content.includes('while')) {
      explanation += "uses loops to iterate through collections or repeat operations. ";
    }
    
    if (content.includes('if ') || content.includes('else')) {
      explanation += "contains conditional logic to handle different scenarios. ";
    }
    
    if (content.includes('try') || content.includes('catch')) {
      explanation += "implements error handling to gracefully manage exceptions. ";
    }
    
    // Add more detailed explanation based on the type
    if (type === 'detailed') {
      explanation += "\n\nThe script can be broken down into these main components:\n\n";
      
      if (content.includes('param')) {
        explanation += "1. Parameter declaration: Defines input parameters that can be passed to the script.\n";
      }
      
      if (content.includes('function')) {
        explanation += "2. Function definitions: Creates reusable code blocks that can be called multiple times.\n";
      }
      
      explanation += `3. Main execution: The primary logic of the script that carries out its intended purpose.\n`;
      
      // Add example usage
      explanation += "\n\nExample usage:\n```powershell\n";
      explanation += "# Assuming this script is saved as Script.ps1\n";
      explanation += ".\\Script.ps1";
      
      if (content.includes('param')) {
        explanation += " -Path 'C:\\Example'";
      }
      
      explanation += "\n```";
    }
    
    // Add security considerations for security type
    if (type === 'security') {
      explanation += "\n\nSecurity considerations:\n\n";
      
      if (content.includes('Remove-') || content.includes('Delete')) {
        explanation += "⚠️ WARNING: This script contains commands that delete resources. Ensure you have proper backups before execution.\n";
      }
      
      if (content.includes('New-') || content.includes('Set-')) {
        explanation += "⚠️ CAUTION: This script modifies system state. Review changes carefully before execution.\n";
      }
      
      if (content.includes('Invoke-WebRequest') || content.includes('Invoke-RestMethod')) {
        explanation += "⚠️ NETWORK ACCESS: This script makes external network requests. Ensure you trust the endpoints it's connecting to.\n";
      }
      
      if (content.includes('Invoke-Expression') || content.includes('Invoke-Command') || content.includes('ScriptBlock')) {
        explanation += "⚠️ DYNAMIC EXECUTION: This script dynamically executes code, which could pose security risks if the input is not properly validated.\n";
      }
      
      explanation += "\nBest practices:\n";
      explanation += "1. Always run scripts with least privilege necessary.\n";
      explanation += "2. Use Set-ExecutionPolicy to control PowerShell script execution policy.\n";
      explanation += "3. Consider signing scripts for production environments.\n";
    }
    
    return res.json({ explanation });
  } catch (error) {
    logger.error('Error in script explanation endpoint:', error);
    return res.status(500).json({ 
      message: 'Failed to explain the script', 
      status: 'error' 
    });
  }
});

/**
 * Get examples of similar scripts
 */
router.get('/examples', async (req, res) => {
  try {
    const { description, limit = 10 } = req.query;
    
    if (!description) {
      return res.status(400).json({ 
        message: 'Description is required', 
        status: 'error' 
      });
    }
    
    logger.info(`Processing script examples request: "${description.toString().substring(0, 50)}..."`);
    
    // Generate mock examples
    const examples = [];
    const titles = [
      "File System Backup Script",
      "Process Monitor and Logger",
      "Network Configuration Manager",
      "System Health Reporter",
      "User Account Management",
      "Security Compliance Checker",
      "Event Log Parser",
      "Active Directory Query Tool",
      "Scheduled Task Automation",
      "Exchange Server Management"
    ];
    
    const descString = description.toString().toLowerCase();
    
    // Prioritize examples that match the description
    const priorityTypes = [];
    if (descString.includes('file') || descString.includes('backup')) priorityTypes.push('File');
    if (descString.includes('process') || descString.includes('monitor')) priorityTypes.push('Process');
    if (descString.includes('network') || descString.includes('config')) priorityTypes.push('Network');
    if (descString.includes('user') || descString.includes('account')) priorityTypes.push('User');
    if (descString.includes('security') || descString.includes('compliance')) priorityTypes.push('Security');
    
    const limitNum = typeof limit === 'string' ? parseInt(limit, 10) : (typeof limit === 'number' ? limit : 10);
    
    for (let i = 0; i < Math.min(limitNum, titles.length); i++) {
      const titleIndex = priorityTypes.length > 0 && i < priorityTypes.length
        ? titles.findIndex(t => t.includes(priorityTypes[i]))
        : i;
      
      const finalIndex = titleIndex >= 0 ? titleIndex : i;
      
      examples.push({
        id: `ex_${Date.now().toString(36)}_${i}`,
        title: titles[finalIndex],
        snippet: `# ${titles[finalIndex]}
# This PowerShell script demonstrates ${titles[finalIndex].toLowerCase()}

param (
    [Parameter(Mandatory=$false)]
    [string]$Path = "C:\\Temp",
    [switch]$Force
)

# Main function
function Main {
    Write-Host "Starting ${titles[finalIndex]}..."
    # Script implementation would go here
}

# Call the main function
Main
`,
        downloadUrl: `#example-${i+1}`,
        rating: Math.floor(Math.random() * 5) + 1,
        complexity: ['Low', 'Medium', 'High'][Math.floor(Math.random() * 3)]
      });
    }
    
    return res.json({ examples });
  } catch (error) {
    logger.error('Error in script examples endpoint:', error);
    return res.status(500).json({ 
      message: 'Failed to retrieve script examples', 
      status: 'error' 
    });
  }
});

/**
 * Analyze a script using the AI assistant
 */
router.post('/analyze/assistant', async (req, res) => {
  try {
    const { content, filename, requestType: _requestType = 'standard', analysisOptions: _analysisOptions } = req.body;
    
    if (!content) {
      return res.status(400).json({ 
        message: 'Script content is required', 
        status: 'error' 
      });
    }
    
    logger.info(`Processing AI assistant analysis request: ${filename || 'unnamed script'}`);
    
    // Generate mock analysis
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
        rawAnalysis: "Script analyzed successfully"
      },
      metadata: {
        processingTime: 0.85,
        model: "gpt-4o",
        threadId: `thread_${Date.now().toString(36)}`,
        assistantId: `asst_${Date.now().toString(36)}`,
        requestId: `req_${Date.now().toString(36)}`
      }
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
    
    return res.json(analysisResult);
  } catch (error) {
    logger.error('Error in AI assistant analysis endpoint:', error);
    return res.status(500).json({ 
      message: 'Failed to analyze the script', 
      status: 'error' 
    });
  }
});

export default router;
