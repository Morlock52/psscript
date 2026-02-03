import OpenAI from 'openai';
import dotenv from 'dotenv';

// Initialize environment variables
dotenv.config();

// Set up OpenAI API client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
});

/**
 * Generate a PowerShell script based on user requirements
 * 
 * @param requirements The requirements for the script
 * @returns Generated PowerShell script as a string
 */
export async function generatePowerShellScript(requirements: string): Promise<string> {
  try {
    const model = process.env.OPENAI_SMART_MODEL || process.env.OPENAI_MODEL || 'gpt-5.2-codex';

    const request = {
      model,
      messages: [
        {
          role: 'system' as const,
          content: `You are an expert PowerShell script generator. Your task is to create well-structured, secure, and efficient PowerShell scripts that meet user requirements.

Guidelines for generating scripts:
1. Follow PowerShell best practices and style conventions
2. Include proper error handling with try/catch blocks
3. Use parameter validation attributes
4. Add clear comments and documentation
5. Follow the principle of least privilege
6. Create modular, reusable functions
7. Include script help (comment-based help)
8. Use secure coding patterns
9. Avoid deprecated cmdlets and syntax
10. Prioritize PowerShell 7+ compatible code unless otherwise specified

CRITICAL - Remote Execution and Credential Handling:
When scripts involve remote computers (Invoke-Command, Enter-PSSession, remoting), address the "double-hop" authentication problem:

11. NEVER rely on -UseDefaultCredentials for remote sessions accessing network resources
12. For remote execution needing network access, use one of these patterns:

    Pattern A - Explicit Credential Passing (Recommended):
    \`\`\`powershell
    param([PSCredential]$Credential = (Get-Credential))
    Invoke-Command -ComputerName $Server -Credential $Credential -ScriptBlock {
        param($RemoteCred)
        # Use $RemoteCred for nested resource access
    } -ArgumentList $Credential
    \`\`\`

    Pattern B - CredSSP Authentication (requires pre-configuration):
    \`\`\`powershell
    # Requires: Enable-WSManCredSSP -Role Client/Server
    Invoke-Command -ComputerName $Server -Credential $Cred -Authentication Credssp -ScriptBlock { }
    \`\`\`

    Pattern C - CIM Sessions with Credentials:
    \`\`\`powershell
    $session = New-CimSession -ComputerName $Server -Credential $Credential
    Get-CimInstance -CimSession $session -ClassName Win32_Service
    \`\`\`

13. Always include a -Credential parameter for scripts that may run remotely
14. Add comments explaining authentication requirements
15. Include prerequisite checks for CredSSP if used

Format your response as a complete, ready-to-run PowerShell script.`
        },
        {
          role: 'user' as const,
          content: `Generate a PowerShell script that satisfies these requirements:\n\n${requirements}`
        }
      ],
      max_tokens: 2048,
    };

    const response = await openai.chat.completions
      .create(request)
      .catch(async (err: any) => {
        // Some newer models/endpoint variants may reject max_tokens; retry with the minimal payload.
        const msg = String(err?.message || err);
        if (msg.includes('max_tokens')) {
          const { max_tokens: _maxTokens, ...fallback } = request as any;
          return openai.chat.completions.create(fallback);
        }
        throw err;
      });

    const script = response.choices[0]?.message?.content || 'Script generation failed.';
    
    // Analyze the script for security issues before returning
    const securityAnalysis = await analyzeScriptSecurity(script);
    
    return formatScriptWithAnalysis(script, securityAnalysis);
  } catch (error) {
    console.error('Error generating PowerShell script:', error);
    return `Error generating PowerShell script: ${error}`;
  }
}

/**
 * Simple security analysis for generated scripts
 * This is a simplified version of the full SecurityAnalyzer
 */
async function analyzeScriptSecurity(script: string): Promise<string> {
  // Define basic security patterns to check
  const securityPatterns = [
    {
      pattern: /(Invoke-Expression|IEX)\s*\(\s*.*\$.*\s*\)/i,
      description: 'Dynamic execution with Invoke-Expression (IEX) using variables',
    },
    {
      pattern: /Start-Process\s+.*\$(?!PSScriptRoot|PSCommandPath)/i,
      description: 'Starting processes with user-controlled input',
    },
    {
      pattern: /ConvertTo-SecureString.*\s+-AsPlainText/i,
      description: 'Converting plain text to secure string',
    },
    {
      pattern: /Set-ExecutionPolicy\s+Unrestricted|Set-ExecutionPolicy\s+Bypass/i,
      description: 'Lowering execution policy security settings',
    },
    // Remote credential handling patterns
    {
      pattern: /-UseDefaultCredentials.*(-ComputerName|Invoke-Command|Enter-PSSession)/i,
      description: 'WARNING: -UseDefaultCredentials may fail on remote computers due to double-hop authentication. Use explicit -Credential parameter instead.',
    },
    {
      pattern: /(Invoke-Command|Enter-PSSession).*-ComputerName(?!.*-Credential)(?!.*-Authentication)/i,
      description: 'Remote command without explicit credential - may fail accessing network resources. Consider adding -Credential parameter.',
    },
    {
      pattern: /Invoke-WebRequest.*-UseDefaultCredentials.*-Session|New-PSSession.*(?!-Credential)/i,
      description: 'Web request or session with default credentials in remote context may fail. Use explicit credential passing.',
    },
  ];
  
  // Check for security issues
  const issues = [];
  for (const pattern of securityPatterns) {
    if (pattern.pattern.test(script)) {
      issues.push(pattern.description);
    }
  }
  
  if (issues.length > 0) {
    return `
## Security Notice
This script includes the following potential security concerns:
${issues.map(issue => `- ${issue}`).join('\n')}

Please review the script carefully before execution.`;
  }
  
  return '';
}

/**
 * Format the final script output with security analysis
 */
function formatScriptWithAnalysis(script: string, securityAnalysis: string): string {
  if (securityAnalysis) {
    return `# Generated PowerShell Script
${script}

${securityAnalysis}`;
  }
  
  return script;
}
