const { PowerShellScript, ScriptAnalysis } = require('../../models');
const embeddingService = require('../embedding/embeddingService');

/**
 * Service for analyzing PowerShell scripts
 */
class ScriptAnalysisService {
  /**
   * Analyze a PowerShell script
   * @param {string} scriptId - ID of the script to analyze
   * @returns {Promise<Object>} - Analysis results
   */
  async analyzeScript(scriptId) {
    try {
      // Get the script
      const script = await PowerShellScript.findByPk(scriptId);
      
      if (!script) {
        throw new Error(`Script with ID ${scriptId} not found`);
      }
      
      // Check if analysis already exists
      let analysis = await ScriptAnalysis.findOne({ where: { scriptId } });
      
      // Perform analysis
      const analysisResults = await this.performAnalysis(script.content);
      
      // Update or create analysis record
      if (analysis) {
        await analysis.update({
          ...analysisResults,
          analysisVersion: '1.0.0'
        });
      } else {
        analysis = await ScriptAnalysis.create({
          scriptId,
          ...analysisResults,
          analysisVersion: '1.0.0'
        });
      }
      
      return analysis;
    } catch (error) {
      console.error('Error analyzing script:', error);
      throw error;
    }
  }
  
  /**
   * Perform analysis on a PowerShell script
   * @param {string} scriptContent - Content of the script to analyze
   * @returns {Promise<Object>} - Analysis results
   */
  async performAnalysis(scriptContent) {
    try {
      // Count lines
      const lineCount = scriptContent.split('\n').length;
      
      // Count comments
      const commentCount = (scriptContent.match(/#.*$/gm) || []).length;
      
      // Extract commands
      const commands = this.extractCommands(scriptContent);
      
      // Extract functions
      const functions = this.extractFunctions(scriptContent);
      
      // Extract modules
      const modules = this.extractModules(scriptContent);
      
      // Extract variables
      const variables = this.extractVariables(scriptContent);
      
      // Calculate complexity
      const complexity = this.calculateComplexity(scriptContent, functions.length, commands.length);
      
      // Analyze security risks
      const securityAnalysis = this.analyzeSecurityRisks(scriptContent, commands);
      
      // Analyze performance
      const performanceAnalysis = this.analyzePerformance(scriptContent, commands);
      
      // Analyze maintainability
      const maintainabilityScore = this.analyzeMaintainability(scriptContent, commentCount, lineCount);
      
      // Analyze documentation
      const documentationScore = this.analyzeDocumentation(scriptContent, commentCount, lineCount);
      
      // Analyze best practices
      const bestPracticesAnalysis = this.analyzeBestPractices(scriptContent);
      
      // Generate summary
      const summary = await this.generateSummary(scriptContent);
      
      // Generate recommendations
      const recommendations = this.generateRecommendations(
        securityAnalysis.securityIssues,
        performanceAnalysis.performanceIssues,
        bestPracticesAnalysis.bestPracticeIssues,
        documentationScore
      );
      
      return {
        complexity,
        securityRisk: securityAnalysis.securityRisk,
        performance: performanceAnalysis.performance,
        maintainability: maintainabilityScore,
        documentation: documentationScore,
        bestPractices: bestPracticesAnalysis.bestPractices,
        commandCount: commands.length,
        functionCount: functions.length,
        lineCount,
        commentCount,
        extractedCommands: commands,
        extractedFunctions: functions,
        extractedModules: modules,
        extractedVariables: variables,
        securityIssues: securityAnalysis.securityIssues,
        performanceIssues: performanceAnalysis.performanceIssues,
        bestPracticeIssues: bestPracticesAnalysis.bestPracticeIssues,
        summary,
        recommendations
      };
    } catch (error) {
      console.error('Error performing script analysis:', error);
      throw error;
    }
  }
  
  /**
   * Extract PowerShell commands from script content
   * @param {string} scriptContent - Script content
   * @returns {Array} - Extracted commands
   */
  extractCommands(scriptContent) {
    const commands = [];
    const commandRegex = /\b([A-Z][a-z]+(-[A-Z][a-z]+)+)\b/g;
    let match;
    
    while ((match = commandRegex.exec(scriptContent)) !== null) {
      commands.push(match[0]);
    }
    
    return [...new Set(commands)]; // Remove duplicates
  }
  
  /**
   * Extract PowerShell functions from script content
   * @param {string} scriptContent - Script content
   * @returns {Array} - Extracted functions
   */
  extractFunctions(scriptContent) {
    const functions = [];
    const functionRegex = /function\s+([a-zA-Z0-9_-]+)/g;
    let match;
    
    while ((match = functionRegex.exec(scriptContent)) !== null) {
      functions.push(match[1]);
    }
    
    return functions;
  }
  
  /**
   * Extract PowerShell modules from script content
   * @param {string} scriptContent - Script content
   * @returns {Array} - Extracted modules
   */
  extractModules(scriptContent) {
    const modules = [];
    const moduleRegex = /Import-Module\s+([a-zA-Z0-9_.-]+)/g;
    let match;
    
    while ((match = moduleRegex.exec(scriptContent)) !== null) {
      modules.push(match[1]);
    }
    
    return modules;
  }
  
  /**
   * Extract PowerShell variables from script content
   * @param {string} scriptContent - Script content
   * @returns {Array} - Extracted variables
   */
  extractVariables(scriptContent) {
    const variables = [];
    const variableRegex = /\$([a-zA-Z0-9_]+)/g;
    let match;
    
    while ((match = variableRegex.exec(scriptContent)) !== null) {
      variables.push(match[1]);
    }
    
    return [...new Set(variables)]; // Remove duplicates
  }
  
  /**
   * Calculate script complexity
   * @param {string} scriptContent - Script content
   * @param {number} functionCount - Number of functions
   * @param {number} commandCount - Number of commands
   * @returns {number} - Complexity score (0-10)
   */
  calculateComplexity(scriptContent, functionCount, commandCount) {
    // Count control structures
    const ifCount = (scriptContent.match(/\bif\b/g) || []).length;
    const forCount = (scriptContent.match(/\bfor\b/g) || []).length;
    const foreachCount = (scriptContent.match(/\bforeach\b/g) || []).length;
    const whileCount = (scriptContent.match(/\bwhile\b/g) || []).length;
    const switchCount = (scriptContent.match(/\bswitch\b/g) || []).length;
    
    // Count nested levels
    const nestingLevel = this.calculateNestingLevel(scriptContent);
    
    // Calculate complexity score
    const complexityScore = (
      (functionCount * 0.5) +
      (commandCount * 0.2) +
      (ifCount * 0.3) +
      (forCount * 0.4) +
      (foreachCount * 0.4) +
      (whileCount * 0.4) +
      (switchCount * 0.3) +
      (nestingLevel * 0.5)
    ) / 10;
    
    // Normalize to 0-10 scale
    return Math.min(Math.max(complexityScore, 0), 10);
  }
  
  /**
   * Calculate nesting level of a script
   * @param {string} scriptContent - Script content
   * @returns {number} - Maximum nesting level
   */
  calculateNestingLevel(scriptContent) {
    const lines = scriptContent.split('\n');
    let currentLevel = 0;
    let maxLevel = 0;
    
    for (const line of lines) {
      const openBraces = (line.match(/{/g) || []).length;
      const closeBraces = (line.match(/}/g) || []).length;
      
      currentLevel += openBraces - closeBraces;
      maxLevel = Math.max(maxLevel, currentLevel);
    }
    
    return maxLevel;
  }
  
  /**
   * Analyze security risks in a script
   * @param {string} scriptContent - Script content
   * @param {Array} commands - Extracted commands
   * @returns {Object} - Security analysis results
   */
  analyzeSecurityRisks(scriptContent, commands) {
    const securityIssues = [];
    
    // Check for potentially dangerous commands
    const dangerousCommands = [
      'Invoke-Expression',
      'iex',
      'Invoke-Command',
      'Start-Process',
      'New-Service',
      'Set-ExecutionPolicy',
      'Add-MpPreference',
      'Set-MpPreference',
      'Remove-MpPreference'
    ];
    
    for (const command of commands) {
      if (dangerousCommands.includes(command)) {
        securityIssues.push({
          type: 'dangerous_command',
          command,
          description: `The command ${command} can be potentially dangerous if used with untrusted input.`
        });
      }
    }
    
    // Check for plain text credentials
    if (scriptContent.includes('ConvertTo-SecureString') && scriptContent.includes('-AsPlainText')) {
      securityIssues.push({
        type: 'plain_text_credentials',
        description: 'Plain text credentials are being used with ConvertTo-SecureString -AsPlainText.'
      });
    }
    
    // Check for hardcoded credentials
    const credentialRegex = /\$(password|pwd|pass|credential|cred)\s*=\s*['"][^'"]+['"]/gi;
    if (credentialRegex.test(scriptContent)) {
      securityIssues.push({
        type: 'hardcoded_credentials',
        description: 'Hardcoded credentials detected in the script.'
      });
    }
    
    // Calculate security risk score (0-10)
    const securityRisk = Math.min(securityIssues.length * 2, 10);
    
    return {
      securityRisk,
      securityIssues
    };
  }
  
  /**
   * Analyze performance issues in a script
   * @param {string} scriptContent - Script content
   * @param {Array} commands - Extracted commands
   * @returns {Object} - Performance analysis results
   */
  analyzePerformance(scriptContent, commands) {
    const performanceIssues = [];
    
    // Check for inefficient commands
    const inefficientCommands = {
      'ForEach-Object': 'Consider using the foreach statement instead of ForEach-Object for better performance.',
      'Where-Object': 'Consider using the where method or the -Filter parameter instead of Where-Object for better performance.',
      'Select-Object': 'Consider using calculated properties or direct property access instead of Select-Object for better performance.'
    };
    
    for (const command of commands) {
      if (inefficientCommands[command]) {
        performanceIssues.push({
          type: 'inefficient_command',
          command,
          description: inefficientCommands[command]
        });
      }
    }
    
    // Check for inefficient loops
    if (scriptContent.includes('ForEach-Object') && scriptContent.includes('|')) {
      performanceIssues.push({
        type: 'pipeline_in_loop',
        description: 'Using pipelines inside loops can be inefficient. Consider restructuring the code.'
      });
    }
    
    // Check for large arrays
    if (scriptContent.includes('New-Object System.Collections.ArrayList')) {
      performanceIssues.push({
        type: 'use_arraylist',
        description: 'Using ArrayList for large collections is more efficient than arrays.'
      });
    }
    
    // Calculate performance score (0-10)
    const performanceScore = 10 - Math.min(performanceIssues.length * 2, 10);
    
    return {
      performance: performanceScore,
      performanceIssues
    };
  }
  
  /**
   * Analyze maintainability of a script
   * @param {string} scriptContent - Script content
   * @param {number} commentCount - Number of comments
   * @param {number} lineCount - Number of lines
   * @returns {number} - Maintainability score (0-10)
   */
  analyzeMaintainability(scriptContent, commentCount, lineCount) {
    // Calculate comment ratio
    const commentRatio = lineCount > 0 ? commentCount / lineCount : 0;
    
    // Check for function length
    const functionBlocks = scriptContent.match(/function\s+[a-zA-Z0-9_-]+\s*\{[\s\S]*?\}/g) || [];
    let longFunctionCount = 0;
    
    for (const functionBlock of functionBlocks) {
      const functionLines = functionBlock.split('\n').length;
      if (functionLines > 50) {
        longFunctionCount++;
      }
    }
    
    // Calculate maintainability score
    const maintainabilityScore = (
      (commentRatio * 5) +
      (5 - Math.min(longFunctionCount, 5))
    );
    
    return Math.min(Math.max(maintainabilityScore, 0), 10);
  }
  
  /**
   * Analyze documentation quality of a script
   * @param {string} scriptContent - Script content
   * @param {number} commentCount - Number of comments
   * @param {number} lineCount - Number of lines
   * @returns {number} - Documentation score (0-10)
   */
  analyzeDocumentation(scriptContent, commentCount, lineCount) {
    // Calculate comment ratio
    const commentRatio = lineCount > 0 ? commentCount / lineCount : 0;
    
    // Check for help comments
    const hasHelp = scriptContent.includes('<#') && scriptContent.includes('#>');
    
    // Check for parameter documentation
    const hasParamDocs = scriptContent.includes('[Parameter(');
    
    // Check for example usage
    const hasExamples = scriptContent.includes('EXAMPLE') || scriptContent.includes('Example:');
    
    // Calculate documentation score
    const documentationScore = (
      (commentRatio * 4) +
      (hasHelp ? 2 : 0) +
      (hasParamDocs ? 2 : 0) +
      (hasExamples ? 2 : 0)
    );
    
    return Math.min(Math.max(documentationScore, 0), 10);
  }
  
  /**
   * Analyze best practices in a script
   * @param {string} scriptContent - Script content
   * @returns {Object} - Best practices analysis results
   */
  analyzeBestPractices(scriptContent) {
    const bestPracticeIssues = [];
    
    // Check for proper error handling
    if (!scriptContent.includes('try') || !scriptContent.includes('catch')) {
      bestPracticeIssues.push({
        type: 'missing_error_handling',
        description: 'Script does not use try/catch blocks for error handling.'
      });
    }
    
    // Check for proper parameter validation
    if (scriptContent.includes('param(') && !scriptContent.includes('[ValidateNotNull')) {
      bestPracticeIssues.push({
        type: 'missing_parameter_validation',
        description: 'Script does not validate parameters using validation attributes.'
      });
    }
    
    // Check for proper function naming
    const functionRegex = /function\s+([a-zA-Z0-9_-]+)/g;
    let match;
    while ((match = functionRegex.exec(scriptContent)) !== null) {
      const functionName = match[1];
      if (!functionName.match(/^[A-Z][a-z]+(-[A-Z][a-z]+)+$/)) {
        bestPracticeIssues.push({
          type: 'improper_function_naming',
          function: functionName,
          description: `Function ${functionName} does not follow the Verb-Noun naming convention.`
        });
      }
    }
    
    // Check for proper variable naming
    const variableRegex = /\$([a-zA-Z0-9_]+)\s*=/g;
    while ((match = variableRegex.exec(scriptContent)) !== null) {
      const variableName = match[1];
      if (variableName.length === 1) {
        bestPracticeIssues.push({
          type: 'single_letter_variable',
          variable: variableName,
          description: `Variable $${variableName} is a single letter, which is not descriptive.`
        });
      }
    }
    
    // Calculate best practices score (0-10)
    const bestPracticesScore = 10 - Math.min(bestPracticeIssues.length * 2, 10);
    
    return {
      bestPractices: bestPracticesScore,
      bestPracticeIssues
    };
  }
  
  /**
   * Generate a summary of the script
   * @param {string} scriptContent - Script content
   * @returns {Promise<string>} - Generated summary
   */
  async generateSummary(scriptContent) {
    try {
      // This is a placeholder - in a real implementation, you would use an AI service
      // to generate a summary of the script
      const firstLine = scriptContent.split('\n')[0];
      return `This script appears to be a PowerShell script that ${firstLine.includes('#') ? firstLine.replace('#', '').trim() : 'performs various operations'}.`;
    } catch (error) {
      console.error('Error generating summary:', error);
      return 'Unable to generate summary.';
    }
  }
  
  /**
   * Generate recommendations for improving the script
   * @param {Array} securityIssues - Security issues
   * @param {Array} performanceIssues - Performance issues
   * @param {Array} bestPracticeIssues - Best practice issues
   * @param {number} documentationScore - Documentation score
   * @returns {Array} - Recommendations
   */
  generateRecommendations(securityIssues, performanceIssues, bestPracticeIssues, documentationScore) {
    const recommendations = [];
    
    // Add security recommendations
    for (const issue of securityIssues) {
      recommendations.push({
        category: 'security',
        priority: 'high',
        description: issue.description,
        solution: this.getSecuritySolution(issue.type)
      });
    }
    
    // Add performance recommendations
    for (const issue of performanceIssues) {
      recommendations.push({
        category: 'performance',
        priority: 'medium',
        description: issue.description,
        solution: this.getPerformanceSolution(issue.type)
      });
    }
    
    // Add best practice recommendations
    for (const issue of bestPracticeIssues) {
      recommendations.push({
        category: 'best_practice',
        priority: 'medium',
        description: issue.description,
        solution: this.getBestPracticeSolution(issue.type)
      });
    }
    
    // Add documentation recommendations
    if (documentationScore < 5) {
      recommendations.push({
        category: 'documentation',
        priority: 'medium',
        description: 'Script has insufficient documentation.',
        solution: 'Add more comments, help blocks, parameter documentation, and usage examples.'
      });
    }
    
    return recommendations;
  }
  
  /**
   * Get solution for a security issue
   * @param {string} issueType - Type of security issue
   * @returns {string} - Solution
   */
  getSecuritySolution(issueType) {
    switch (issueType) {
      case 'dangerous_command':
        return 'Avoid using potentially dangerous commands like Invoke-Expression with untrusted input. Consider safer alternatives.';
      case 'plain_text_credentials':
        return 'Avoid using plain text credentials. Use secure string objects or credential objects instead.';
      case 'hardcoded_credentials':
        return 'Avoid hardcoding credentials in scripts. Use secure credential storage or prompt for credentials at runtime.';
      default:
        return 'Review the script for security issues and follow PowerShell security best practices.';
    }
  }
  
  /**
   * Get solution for a performance issue
   * @param {string} issueType - Type of performance issue
   * @returns {string} - Solution
   */
  getPerformanceSolution(issueType) {
    switch (issueType) {
      case 'inefficient_command':
        return 'Replace inefficient cmdlets with more efficient alternatives or direct property access.';
      case 'pipeline_in_loop':
        return 'Avoid using pipelines inside loops. Process the data in bulk before or after the loop.';
      case 'use_arraylist':
        return 'Use ArrayList or generic List<T> for large collections instead of arrays for better performance.';
      default:
        return 'Review the script for performance issues and optimize where possible.';
    }
  }
  
  /**
   * Get solution for a best practice issue
   * @param {string} issueType - Type of best practice issue
   * @returns {string} - Solution
   */
  getBestPracticeSolution(issueType) {
    switch (issueType) {
      case 'missing_error_handling':
        return 'Add try/catch blocks to handle errors gracefully.';
      case 'missing_parameter_validation':
        return 'Add parameter validation attributes like [ValidateNotNull()], [ValidateNotNullOrEmpty()], etc.';
      case 'improper_function_naming':
        return 'Rename functions to follow the Verb-Noun naming convention (e.g., Get-Process, Set-Variable).';
      case 'single_letter_variable':
        return 'Use descriptive variable names instead of single letters to improve readability.';
      default:
        return 'Review the script for best practice issues and follow PowerShell best practices.';
    }
  }
}

module.exports = new ScriptAnalysisService();
