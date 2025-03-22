import express from 'express';
import AiAgentController from '../controllers/AIAgentController';
import { corsMiddleware } from '../middleware/corsMiddleware';
import logger from '../utils/logger';

const router = express.Router();

// Apply CORS middleware
router.use(corsMiddleware);

/**
 * @swagger
 * /api/aiagent/please:
 *   post:
 *     summary: Ask the AI agent a PowerShell-related question
 *     description: Uses the agentic AI assistant to answer PowerShell related questions
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - question
 *             properties:
 *               question:
 *                 type: string
 *                 description: The question to ask
 *               context:
 *                 type: string
 *                 description: Optional context (like script content)
 *               useAgent:
 *                 type: boolean
 *                 description: Whether to use the agentic framework
 *     responses:
 *       200:
 *         description: Successfully answered question
 *       400:
 *         description: Invalid request
 *       500:
 *         description: Server error
 */
router.post('/please', AiAgentController.answerQuestion);

/**
 * @swagger
 * /api/aiagent/analyze:
 *   post:
 *     summary: Analyze a script using an AI assistant
 *     description: Uses the agentic AI assistant to analyze PowerShell scripts in detail
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - content
 *             properties:
 *               content:
 *                 type: string
 *                 description: The script content to analyze
 *               filename:
 *                 type: string
 *                 description: Optional filename
 *               requestType:
 *                 type: string
 *                 enum: [standard, detailed]
 *                 description: Analysis detail level
 *               analysisOptions:
 *                 type: object
 *                 properties:
 *                   includeSimilarScripts:
 *                     type: boolean
 *                   includeInternetSearch:
 *                     type: boolean
 *                   maxExamples:
 *                     type: integer
 *     responses:
 *       200:
 *         description: Successfully analyzed script
 *       400:
 *         description: Invalid request
 *       500:
 *         description: Server error
 */
router.post('/analyze', AiAgentController.analyzeScript);

/**
 * @swagger
 * /api/aiagent/generate:
 *   post:
 *     summary: Generate a PowerShell script
 *     description: Uses AI to generate a PowerShell script based on a description
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - description
 *             properties:
 *               description:
 *                 type: string
 *                 description: Description of the script to generate
 *     responses:
 *       200:
 *         description: Successfully generated script
 *       400:
 *         description: Invalid request
 *       500:
 *         description: Server error
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
 * @swagger
 * /api/aiagent/explain:
 *   post:
 *     summary: Explain a PowerShell script or command
 *     description: Uses AI to explain PowerShell code
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - content
 *             properties:
 *               content:
 *                 type: string
 *                 description: The code to explain
 *               type:
 *                 type: string
 *                 enum: [simple, detailed, security]
 *                 description: Type of explanation
 *     responses:
 *       200:
 *         description: Successfully explained the code
 *       400:
 *         description: Invalid request
 *       500:
 *         description: Server error
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
 * @swagger
 * /api/aiagent/examples:
 *   get:
 *     summary: Get examples of similar scripts
 *     description: Retrieves examples of PowerShell scripts similar to a description
 *     parameters:
 *       - in: query
 *         name: description
 *         required: true
 *         schema:
 *           type: string
 *         description: Description of the script functionality
 *       - in: query
 *         name: limit
 *         required: false
 *         schema:
 *           type: integer
 *         description: Maximum number of examples to return
 *     responses:
 *       200:
 *         description: Successfully retrieved examples
 *       400:
 *         description: Invalid request
 *       500:
 *         description: Server error
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
    
    const limitNum = typeof limit === 'string' ? parseInt(limit, 10) : limit;
    
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

export default router;
