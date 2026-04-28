/**
 * Script Analysis Controller
 *
 * Handles AI-powered analysis operations for scripts.
 * Includes standard analysis, LangGraph integration, and streaming.
 * Migrated from the original ScriptController for better modularity.
 */
import {
  Request,
  Response,
  NextFunction,
  Script,
  ScriptAnalysis,
  sequelize,
  Transaction,
  logger,
  axios,
  AI_SERVICE_URL,
  TIMEOUTS,
  CACHE_TTL,
  fetchScriptAnalysis,
  getCache,
  crypto
} from './shared';

import type { AuthenticatedRequest } from './types';
import { openai, anthropic, MODELS } from '../../services/openaiClient';

/**
 * Direct OpenAI analysis fallback.
 * Used when the Python AI service is unavailable.
 * Calls GPT-4.1 directly for script analysis.
 */
async function analyzeWithOpenAIDirect(content: string): Promise<Record<string, unknown>> {
  const response = await openai.chat.completions.create({
    model: MODELS.CODE,
    messages: [
      {
        role: 'system',
        content: `You are a PowerShell script security and quality analyzer. Analyze the given script using criteria version 2026-04-26 and return a JSON object with these fields:
- purpose (string): Brief description of what the script does
- security_score (number 0-10): Higher is more secure
- code_quality_score (number 0-10): Higher is better quality
- risk_score (number 0-10): Higher means more risky
- optimization (string[]): List of optimization suggestions
- command_details (object): Key PowerShell commands found and their purpose
- ms_docs_references (string[]): Relevant Microsoft documentation URLs
- security_issues (object[]): Each with {severity, description, remediation}
- best_practice_violations (object[]): Each with {rule, description, suggestion}
- parameters (object): Detected script parameters with descriptions
- criteria_version (string): Use "2026-04-26"
- analysis_criteria (object[]): Six weighted criteria with {name, weight, score, summary}: Security 35, Operational safety 20, Reliability 15, Maintainability 15, Compatibility 10, Performance 5
- prioritized_findings (object[]): Each with {id, severity, category, title, evidence, impact, recommendation}
- remediation_plan (object[]): Each with {priority, action, rationale, effort}
- test_recommendations (string[]): Concrete validation tests to run before production
- confidence (number 0-1): Confidence in the static review

Base the criteria on Microsoft PSScriptAnalyzer/PowerShell conventions, ShouldProcess/WhatIf/Confirm safety for changing commands, OWASP secure coding practices, and NIST SSDF review-and-test expectations. Return ONLY valid JSON, no markdown or explanation.`
      },
      {
        role: 'user',
        content: `Analyze this PowerShell script:\n\n${content.substring(0, 8000)}`
      }
    ],
    response_format: { type: 'json_object' },
    temperature: 0.2,
    max_tokens: 4096,
  });

  const text = response.choices[0]?.message?.content || '{}';
  try {
    return JSON.parse(text);
  } catch {
    return {
      purpose: 'Analysis completed (parse error)',
      security_score: 5,
      code_quality_score: 5,
      risk_score: 5,
      optimization: [],
      command_details: {},
      ms_docs_references: [],
      model_used: MODELS.CODE,
      provider: 'openai-direct'
    };
  }
}

/**
 * Anthropic Claude analysis fallback.
 * Used when both AI service and OpenAI are unavailable.
 */
async function analyzeWithClaudeDirect(content: string): Promise<Record<string, unknown>> {
  if (!anthropic) {
    throw new Error('Anthropic client not initialized (ANTHROPIC_API_KEY not set)');
  }

  const response = await anthropic.messages.create({
    model: MODELS.CLAUDE_SONNET,
    max_tokens: 4096,
    messages: [
      {
        role: 'user',
        content: `You are a PowerShell script security and quality analyzer. Analyze this script using criteria version 2026-04-26 and return ONLY a JSON object (no markdown, no explanation) with these fields:
- purpose (string): Brief description of what the script does
- security_score (number 0-10): Higher is more secure
- code_quality_score (number 0-10): Higher is better quality
- risk_score (number 0-10): Higher means more risky
- optimization (string[]): List of optimization suggestions
- command_details (object): Key PowerShell commands found and their purpose
- ms_docs_references (string[]): Relevant Microsoft documentation URLs
- security_issues (object[]): Each with {severity, description, remediation}
- best_practice_violations (object[]): Each with {rule, description, suggestion}
- parameters (object): Detected script parameters with descriptions
- criteria_version (string): Use "2026-04-26"
- analysis_criteria (object[]): Six weighted criteria with {name, weight, score, summary}: Security 35, Operational safety 20, Reliability 15, Maintainability 15, Compatibility 10, Performance 5
- prioritized_findings (object[]): Each with {id, severity, category, title, evidence, impact, recommendation}
- remediation_plan (object[]): Each with {priority, action, rationale, effort}
- test_recommendations (string[]): Concrete validation tests to run before production
- confidence (number 0-1): Confidence in the static review

Base the criteria on Microsoft PSScriptAnalyzer/PowerShell conventions, ShouldProcess/WhatIf/Confirm safety for changing commands, OWASP secure coding practices, and NIST SSDF review-and-test expectations.

Script to analyze:

${content.substring(0, 8000)}`
      }
    ],
  });

  const text = response.content[0]?.type === 'text' ? response.content[0].text : '{}';
  // Strip markdown code fences if Claude wraps the JSON
  const cleaned = text.replace(/^```(?:json)?\s*\n?/m, '').replace(/\n?```\s*$/m, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    return {
      purpose: 'Analysis completed via Claude (parse error)',
      security_score: 5,
      code_quality_score: 5,
      risk_score: 5,
      optimization: [],
      command_details: {},
      ms_docs_references: [],
      model_used: MODELS.CLAUDE_SONNET,
      provider: 'anthropic-direct'
    };
  }
}

/**
 * Get script analysis by script ID
 */
export async function getScriptAnalysis(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void | Response> {
  try {
    const scriptId = req.params.id;

    // Use the shared utility to fetch analysis
    const analysis = await fetchScriptAnalysis(scriptId);

    if (!analysis) {
      const script = await Script.findByPk(scriptId, {
        attributes: ['id']
      });

      if (!script) {
        return res.status(404).json({ message: 'Script not found' });
      }

      return res.status(404).json({
        message: 'Analysis not found for this script',
        error: 'analysis_not_found',
        scriptId: parseInt(scriptId, 10)
      });
    }

    return res.json(analysis);
  } catch (error) {
    logger.error('Error fetching script analysis:', error);
    next(error);
  }
}

/**
 * Analyze a script without saving
 */
export async function analyzeScript(
  req: Request,
  res: Response,
  _next: NextFunction
): Promise<void | Response> {
  try {
    // eslint-disable-next-line camelcase -- API request body uses snake_case
    const { content, script_id } = req.body as { content?: string; script_id?: string };

    if (!content) {
      return res.status(400).json({ message: 'Script content is required' });
    }

    try {
      // Get OpenAI API key from request headers if available
      const openaiApiKey = req.headers['x-openai-api-key'] as string;

      const analysisConfig: { headers: Record<string, string>; timeout: number } = {
        headers: {},
        timeout: TIMEOUTS.STANDARD
      };

      if (openaiApiKey) {
        analysisConfig.headers['x-api-key'] = openaiApiKey;
      }

      // eslint-disable-next-line camelcase -- API request/response uses snake_case
      logger.info(`Sending script for analysis${script_id ? ` (ID: ${script_id})` : ''}`);

      // Set a timeout for the analysis request
      const analysisPromise = axios.post(
        `${AI_SERVICE_URL}/analyze`,
        {
          script_id, // eslint-disable-line camelcase
          content,
          include_command_details: true,
          fetch_ms_docs: true
        },
        analysisConfig
      );

      // Create a timeout promise
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Analysis request timed out')), TIMEOUTS.STANDARD);
      });

      // Race the analysis against the timeout
      const analysisResponse = await Promise.race([analysisPromise, timeoutPromise]);
      const analysis = (analysisResponse as { data: unknown }).data;

      return res.json(analysis);
    } catch (analysisError) {
      logger.error('AI analysis failed:', analysisError);

      if (axios.isAxiosError(analysisError) && analysisError.response) {
        return res.status(502).json({
          message: 'Analysis service returned an error',
          error: 'analysis_service_error',
          status: analysisError.response.status
        });
      }

      if (analysisError instanceof Error && analysisError.message === 'Analysis request timed out') {
        return res.status(504).json({
          message: 'Analysis request timed out',
          error: 'analysis_timeout'
        });
      }

      // FALLBACK: Try direct OpenAI analysis
      logger.warn('AI service unavailable for ad-hoc analysis, falling back to direct OpenAI');
      try {
        const directResult = await analyzeWithOpenAIDirect(content || '');
        return res.json({ ...directResult, provider: 'openai-direct', model: MODELS.CODE });
      } catch (directError) {
        logger.error('Direct OpenAI analysis also failed:', directError);
        return res.status(503).json({
          message: 'Analysis service is unavailable',
          error: 'analysis_unavailable'
        });
      }
    }
  } catch (error) {
    logger.error('Error in analyzeScript:', error);
    return res.status(500).json({
      message: 'Analysis failed',
      error: 'analysis_failed'
    });
  }
}

/**
 * Analyze a script and save the analysis to the database
 */
export async function analyzeScriptAndSave(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void | Response> {
  let transaction: Transaction | undefined;

  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ message: 'Script ID is required' });
    }

    // Find the script
    const script = await Script.findByPk(id);

    if (!script) {
      return res.status(404).json({ message: 'Script not found' });
    }

    // Get script content
    const content = script.content;

    if (!content) {
      return res.status(400).json({ message: 'Script has no content' });
    }

    try {
      // Get OpenAI API key from request headers if available
      const openaiApiKey = req.headers['x-openai-api-key'] as string;

      const analysisConfig: { headers: Record<string, string>; timeout: number } = {
        headers: {},
        timeout: TIMEOUTS.FULL_ANALYSIS
      };

      if (openaiApiKey) {
        analysisConfig.headers['x-api-key'] = openaiApiKey;
      }

      // Start transaction for database operations
      transaction = await sequelize.transaction();

      // Call AI service to analyze the script
      const analysisResponse = await axios.post(
        `${AI_SERVICE_URL}/analyze`,
        {
          content,
          include_command_details: true,
          fetch_ms_docs: true
        },
        analysisConfig
      );

      const analysisData = analysisResponse.data as {
        purpose?: string;
        security_score?: number;
        code_quality_score?: number;
        risk_score?: number;
        complexity_score?: number;
        reliability_score?: number;
        parameters?: Record<string, unknown>;
        optimization?: string[];
        security_concerns?: string[];
        best_practices?: string[];
        performance_suggestions?: string[];
        command_details?: Record<string, unknown>;
        ms_docs_references?: string[];
      };

      // Check if analysis already exists for this script
      let analysis = await ScriptAnalysis.findOne({
        where: { scriptId: id },
        transaction
      });

      const analysisRecord = {
        scriptId: parseInt(id),
        purpose: analysisData.purpose || '',
        securityScore: analysisData.security_score || 0,
        codeQualityScore: analysisData.code_quality_score || 0,
        riskScore: analysisData.risk_score || 0,
        parameters: analysisData.parameters || {},
        optimizationSuggestions: analysisData.optimization || [],
        commandDetails: analysisData.command_details || {},
        msDocsReferences: analysisData.ms_docs_references || []
      };

      if (analysis) {
        // Update existing analysis
        await analysis.update(analysisRecord, { transaction });
      } else {
        // Create new analysis
        analysis = await ScriptAnalysis.create(analysisRecord, { transaction });
      }

      // Commit transaction
      await transaction.commit();

      // Return the analysis data
      return res.json(analysisData);
    } catch (analysisError) {
      // Rollback transaction if it exists
      if (transaction) await transaction.rollback();

      const err = analysisError as { response?: { data: unknown; status: number }; message?: string };
      if (err.response) {
        logger.error('AI analysis error:', err.response.data);
        return res.status(err.response.status).json({
          message: 'Analysis failed',
          error: err.response.data
        });
      }

      // FALLBACK: If AI service is unavailable, try direct OpenAI analysis
      logger.warn('AI service unavailable, falling back to direct OpenAI analysis');
      try {
        const directResult = await analyzeWithOpenAIDirect(content);

        // Start a new transaction for the fallback
        const fallbackTx = await sequelize.transaction();

        const fallbackRecord = {
          scriptId: parseInt(id),
          purpose: (directResult.purpose as string) || '',
          securityScore: (directResult.security_score as number) || 5,
          codeQualityScore: (directResult.code_quality_score as number) || 5,
          riskScore: (directResult.risk_score as number) || 5,
          parameters: (directResult.parameters as Record<string, unknown>) || {},
          optimizationSuggestions: (directResult.optimization as string[]) || [],
          commandDetails: (directResult.command_details as Record<string, unknown>) || {},
          msDocsReferences: (directResult.ms_docs_references as string[]) || [],
          securityIssues: (directResult.security_issues as unknown[]) || [],
          bestPracticeViolations: (directResult.best_practice_violations as unknown[]) || [],
        };

        let fallbackAnalysis = await ScriptAnalysis.findOne({
          where: { scriptId: id },
          transaction: fallbackTx
        });

        if (fallbackAnalysis) {
          await fallbackAnalysis.update(fallbackRecord, { transaction: fallbackTx });
        } else {
          fallbackAnalysis = await ScriptAnalysis.create(fallbackRecord, { transaction: fallbackTx });
        }

        await fallbackTx.commit();
        logger.info(`Direct OpenAI analysis complete for script ${id}`);

        return res.json({
          ...directResult,
          provider: 'openai-direct',
          model: MODELS.CODE
        });
      } catch (directError) {
        logger.error('Direct OpenAI analysis failed:', directError);

        // FALLBACK 2: Try Anthropic Claude
        if (anthropic) {
          try {
            logger.warn('OpenAI direct failed, trying Anthropic Claude fallback');
            const claudeResult = await analyzeWithClaudeDirect(content);

            const claudeTx = await sequelize.transaction();
            const claudeRecord = {
              scriptId: parseInt(id),
              purpose: (claudeResult.purpose as string) || '',
              securityScore: (claudeResult.security_score as number) || 5,
              codeQualityScore: (claudeResult.code_quality_score as number) || 5,
              riskScore: (claudeResult.risk_score as number) || 5,
              parameters: (claudeResult.parameters as Record<string, unknown>) || {},
              optimizationSuggestions: (claudeResult.optimization as string[]) || [],
              commandDetails: (claudeResult.command_details as Record<string, unknown>) || {},
              msDocsReferences: (claudeResult.ms_docs_references as string[]) || [],
            };

            let claudeAnalysis = await ScriptAnalysis.findOne({ where: { scriptId: id }, transaction: claudeTx });
            if (claudeAnalysis) {
              await claudeAnalysis.update(claudeRecord, { transaction: claudeTx });
            } else {
              claudeAnalysis = await ScriptAnalysis.create(claudeRecord, { transaction: claudeTx });
            }
            await claudeTx.commit();
            logger.info(`Claude analysis complete for script ${id}`);

            return res.json({ ...claudeResult, provider: 'anthropic-direct', model: MODELS.CLAUDE_SONNET });
          } catch (claudeError) {
            logger.error('Anthropic Claude analysis also failed:', claudeError);
          }
        }

        return res.status(503).json({
          message: 'All analysis providers unavailable (AI service, OpenAI, Anthropic)',
          error: 'analysis_unavailable'
        });
      }
    }
  } catch (error) {
    // Rollback transaction if it exists
    if (transaction) await transaction.rollback();
    next(error);
  }
}

/**
 * Analyze a script using OpenAI Assistant API with agentic workflows
 */
export async function analyzeScriptWithAssistant(
  req: Request,
  res: Response,
  _next: NextFunction
): Promise<void | Response> {
  const requestId = Math.random().toString(36).substring(2, 10);

  try {
    logger.info(`[${requestId}] Starting script analysis with agentic AI Assistant`);

    const { content, filename, requestType = 'standard' } = req.body as {
      content?: string;
      filename?: string;
      requestType?: string;
    };

    if (!content) {
      return res.status(400).json({ error: 'Script content is required' });
    }

    // Get OpenAI API key from request headers or environment variable
    const openaiApiKey = (req.headers['x-openai-api-key'] as string) || process.env.OPENAI_API_KEY;

    if (!openaiApiKey) {
      return res.status(400).json({
        error:
          'OpenAI API key is required. Please provide an API key in the x-openai-api-key header or configure it in the server environment.'
      });
    }

    // Get AI service URL from environment or use default
    const aiServiceUrl = process.env.AI_SERVICE_URL || 'http://localhost:8000';

    // Prepare headers for AI service
    const analysisConfig: { headers: Record<string, string>; timeout: number } = {
      headers: {
        'Content-Type': 'application/json',
        'X-Request-ID': requestId,
        'x-api-key': openaiApiKey
      },
      timeout: TIMEOUTS.AGENTIC_WORKFLOW
    };

    // Determine analysis mode based on request type
    const analysisEndpoint =
      requestType === 'detailed'
        ? `${aiServiceUrl}/analyze/assistant/detailed`
        : `${aiServiceUrl}/analyze/assistant`;

    // Call AI service to analyze the script with Assistant API
    logger.info(`[${requestId}] Sending request to agentic AI service at ${analysisEndpoint}`);
    const analysisResponse = await axios.post(
      analysisEndpoint,
      {
        content,
        filename: filename || 'script.ps1',
        analysis_options: {
          include_internet_search: true,
          include_similar_scripts: true,
          max_examples: 20
        }
      },
      analysisConfig
    );

    // If analysis is successful, return the results
    if (analysisResponse && analysisResponse.data) {
      logger.info(`[${requestId}] Script analysis with agentic AI completed successfully`);

      // Parse the response to extract structured data
      const analysisData = (analysisResponse.data as { analysis?: Record<string, unknown> }).analysis || {};

      // Format the response for the client
      const result = {
        analysis: {
          purpose: analysisData.purpose || 'Purpose not identified',
          securityScore: analysisData.securityScore || 0,
          codeQualityScore: analysisData.codeQualityScore || 0,
          riskScore: analysisData.riskScore || 100,
          suggestions: analysisData.suggestions || [],
          commandDetails: analysisData.commandDetails || {},
          msDocsReferences: analysisData.msDocsReferences || [],
          examples: analysisData.examples || [],
          rawAnalysis: analysisData.rawAnalysis || ''
        },
        metadata: {
          processingTime: (analysisResponse.data as { processingTime?: number }).processingTime,
          model: (analysisResponse.data as { model?: string }).model,
          threadId: (analysisResponse.data as { threadId?: string }).threadId,
          assistantId: (analysisResponse.data as { assistantId?: string }).assistantId,
          requestId
        }
      };

      // Cache analysis results if enabled
      if (process.env.ENABLE_ANALYSIS_CACHE === 'true') {
        try {
          const contentHash = crypto.createHash('sha256').update(content).digest('hex');
          getCache().set(`analysis_${contentHash}`, result, CACHE_TTL.STANDARD);
          logger.debug(`[${requestId}] Cached analysis results for future use`);
        } catch (cacheError) {
          logger.warn(`[${requestId}] Failed to cache analysis results: ${(cacheError as Error).message}`);
        }
      }

      return res.json(result);
    } else {
      logger.warn(`[${requestId}] Script analysis with AI Assistant returned unexpected response format`);
      return res.status(500).json({
        error: 'Analysis failed',
        details: 'The analysis service returned an unexpected response format',
        requestId
      });
    }
  } catch (error) {
    logger.error(`[${requestId}] Error analyzing script with AI Assistant:`, error);

    const err = error as { response?: { status: number; data?: { error?: string } }; message?: string; code?: string };

    // Format error response
    const statusCode = err.response?.status || 500;
    const errorMessage = err.response?.data?.error || err.message || 'An unexpected error occurred';

    // Special handling for common errors
    if (err.code === 'ECONNREFUSED' || err.code === 'ECONNABORTED') {
      return res.status(503).json({
        error: 'AI service unavailable',
        details: 'Could not connect to the AI analysis service. Please try again later.',
        requestId
      });
    }

    if (err.response?.status === 401 || err.response?.status === 403) {
      return res.status(statusCode).json({
        error: 'API key error',
        details: 'The provided OpenAI API key was rejected. Please verify your API key and try again.',
        requestId
      });
    }

    // Return a standardized error response
    return res.status(statusCode).json({
      error: 'Script analysis failed',
      details: errorMessage,
      requestId
    });
  }
}

/**
 * Analyze script using LangGraph 1.0 production orchestrator
 */
export async function analyzeLangGraph(
  req: AuthenticatedRequest,
  res: Response,
  _next: NextFunction
): Promise<void | Response> {
  try {
    const scriptId = req.params.id;
    // eslint-disable-next-line camelcase -- API request body uses snake_case
    const { require_human_review = false, thread_id, model = 'gpt-4.1' } = req.body as {
      require_human_review?: boolean;
      thread_id?: string;
      model?: string;
    };

    logger.info(`[LangGraph] Starting analysis for script ${scriptId}`);

    // Get the script
    const script = await Script.findByPk(scriptId);
    if (!script) {
      return res.status(404).json({ message: 'Script not found' });
    }

    // Get OpenAI API key from request headers if available
    const openaiApiKey = req.headers['x-openai-api-key'] as string;

    // Prepare request for LangGraph service
    const analysisConfig: { headers: Record<string, string>; timeout: number } = {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: TIMEOUTS.EXTENDED // 2 minute timeout for full analysis
    };

    if (openaiApiKey) {
      analysisConfig.headers['x-api-key'] = openaiApiKey;
    }

    // Call LangGraph analysis endpoint
    // eslint-disable-next-line camelcase -- API request uses snake_case
    const langgraphResponse = await axios.post(
      `${AI_SERVICE_URL}/langgraph/analyze`,
      {
        script_content: script.content,
        thread_id: thread_id || `script_${scriptId}_${Date.now()}`, // eslint-disable-line camelcase
        require_human_review, // eslint-disable-line camelcase
        stream: false, // Non-streaming for this endpoint
        model,
        api_key: openaiApiKey
      },
      analysisConfig
    );

    type LangGraphResponse = {
      workflow_id: string;
      status: string;
      current_stage: string;
      final_response: string;
      analysis_results?: {
        security_scan?: string;
        quality_analysis?: string;
        generate_optimizations?: string;
      };
      requires_human_review: boolean;
      started_at: string;
      completed_at: string;
    };

    const analysisResult = langgraphResponse.data as LangGraphResponse;

    logger.info(
      `[LangGraph] Analysis completed for script ${scriptId}, workflow: ${analysisResult.workflow_id}`
    );

    // Save analysis results to database if workflow completed
    if (analysisResult.status === 'completed' && analysisResult.analysis_results) {
      try {
        const results = analysisResult.analysis_results;

        // Extract scores and findings from tool results
        const securityData = results.security_scan ? JSON.parse(results.security_scan) : {};
        const qualityData = results.quality_analysis ? JSON.parse(results.quality_analysis) : {};
        const optimizationData = results.generate_optimizations
          ? JSON.parse(results.generate_optimizations)
          : {};

        // Upsert analysis record
        await ScriptAnalysis.upsert({
          scriptId: parseInt(scriptId),
          purpose: analysisResult.final_response || 'Analysis completed',
          securityScore: securityData.risk_score || 5.0,
          codeQualityScore: qualityData.quality_score || 5.0,
          riskScore: securityData.risk_score || 5.0,
          parameters: {},
          optimizationSuggestions: optimizationData.optimizations || [],
          commandDetails: {},
          msDocsReferences: []
        });

        logger.info(`[LangGraph] Saved analysis results for script ${scriptId}`);
      } catch (saveError) {
        logger.error(`[LangGraph] Error saving analysis: ${saveError}`);
        // Continue - don't fail the request if save fails
      }
    }

    // Return the full LangGraph response
    return res.json({
      success: true,
      workflow_id: analysisResult.workflow_id,
      thread_id: analysisResult.workflow_id, // Use workflow_id as thread_id for consistency
      status: analysisResult.status,
      current_stage: analysisResult.current_stage,
      final_response: analysisResult.final_response,
      analysis_results: analysisResult.analysis_results,
      requires_human_review: analysisResult.requires_human_review,
      started_at: analysisResult.started_at,
      completed_at: analysisResult.completed_at
    });
  } catch (error) {
    logger.error('[LangGraph] Analysis failed:', error);

    const err = error as { code?: string; response?: { status: number }; message?: string };

    // Provide helpful error messages
    if (err.code === 'ECONNREFUSED') {
      return res.status(503).json({
        success: false,
        message: 'AI service unavailable. Please try again later.',
        error: 'service_unavailable'
      });
    }

    if (err.response?.status === 401 || err.response?.status === 403) {
      return res.status(401).json({
        success: false,
        message: 'OpenAI API key is invalid or missing.',
        error: 'authentication_failed'
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Script analysis failed',
      error: err.message
    });
  }
}

/**
 * Stream analysis progress using Server-Sent Events (SSE)
 */
export async function streamAnalysis(
  req: AuthenticatedRequest,
  res: Response,
  _next: NextFunction
): Promise<void | Response> {
  try {
    const scriptId = req.params.id;
    // eslint-disable-next-line camelcase -- API query params use snake_case
    const { require_human_review = 'false', thread_id, model = 'gpt-4.1' } = req.query as {
      require_human_review?: string;
      thread_id?: string;
      model?: string;
    };

    logger.info(`[LangGraph] Starting streaming analysis for script ${scriptId}`);

    // Get the script
    const script = await Script.findByPk(scriptId);
    if (!script) {
      return res.status(404).json({ message: 'Script not found' });
    }

    // Set up SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

    // Send initial connection event
    res.write(`data: ${JSON.stringify({ type: 'connected', message: 'Stream started' })}\n\n`);

    // Get OpenAI API key from request headers
    const openaiApiKey = req.headers['x-openai-api-key'] as string;

    // Call LangGraph with streaming enabled
    const analysisConfig = {
      headers: {
        'Content-Type': 'application/json'
      } as Record<string, string>,
      timeout: TIMEOUTS.EXTENDED,
      responseType: 'stream' as const
    };

    if (openaiApiKey) {
      analysisConfig.headers['x-api-key'] = openaiApiKey;
    }

    // eslint-disable-next-line camelcase -- API request uses snake_case
    const langgraphStream = await axios.post(
      `${AI_SERVICE_URL}/langgraph/analyze`,
      {
        script_content: script.content,
        thread_id: thread_id || `script_${scriptId}_${Date.now()}`, // eslint-disable-line camelcase
        require_human_review: require_human_review === 'true', // eslint-disable-line camelcase
        stream: true,
        model,
        api_key: openaiApiKey
      },
      analysisConfig
    );

    // Forward events from LangGraph to client
    (langgraphStream.data as NodeJS.ReadableStream).on('data', (chunk: Buffer) => {
      const data = chunk.toString();

      // Parse and re-format events for frontend
      const lines = data.split('\n');
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const eventData = JSON.parse(line.substring(6)) as Record<string, unknown>;

            // Add script_id to each event for context
            eventData.script_id = scriptId;

            // Forward to client
            res.write(`data: ${JSON.stringify(eventData)}\n\n`);
          } catch (_e) {
            // Skip malformed events
            logger.warn('[LangGraph] Malformed event:', line);
          }
        }
      }
    });

    (langgraphStream.data as NodeJS.ReadableStream).on('end', () => {
      res.write(`data: ${JSON.stringify({ type: 'completed', message: 'Analysis complete' })}\n\n`);
      res.end();
      logger.info(`[LangGraph] Streaming completed for script ${scriptId}`);
    });

    (langgraphStream.data as NodeJS.ReadableStream).on('error', (error: Error) => {
      res.write(`data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`);
      res.end();
      logger.error(`[LangGraph] Streaming error for script ${scriptId}:`, error);
    });

    // Handle client disconnect
    req.on('close', () => {
      const stream = langgraphStream.data as NodeJS.ReadableStream & { destroy?: () => void };
      if (typeof stream.destroy === 'function') {
        stream.destroy();
      }
      logger.info(`[LangGraph] Client disconnected from stream for script ${scriptId}`);
    });
  } catch (error) {
    logger.error('[LangGraph] Streaming failed:', error);

    // Send error event if connection is still open
    if (!res.headersSent) {
      return res.status(500).json({
        success: false,
        message: 'Failed to start analysis stream',
        error: (error as Error).message
      });
    } else {
      res.write(`data: ${JSON.stringify({ type: 'error', message: (error as Error).message })}\n\n`);
      res.end();
    }
  }
}

/**
 * Provide human feedback for paused workflow
 */
export async function provideFeedback(
  req: AuthenticatedRequest,
  res: Response,
  _next: NextFunction
): Promise<void | Response> {
  try {
    const scriptId = req.params.id;
    // eslint-disable-next-line camelcase -- API request body uses snake_case
    const { thread_id: threadId, feedback } = req.body as { thread_id?: string; feedback?: string };

    if (!threadId || !feedback) {
      return res.status(400).json({
        success: false,
        message: 'thread_id and feedback are required'
      });
    }

    logger.info(`[LangGraph] Providing feedback for script ${scriptId}, thread ${threadId}`);

    // Get OpenAI API key from request headers
    const openaiApiKey = req.headers['x-openai-api-key'] as string;

    const feedbackConfig: { headers: Record<string, string>; timeout: number } = {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: TIMEOUTS.EXTENDED
    };

    if (openaiApiKey) {
      feedbackConfig.headers['x-api-key'] = openaiApiKey;
    }

    // Call LangGraph feedback endpoint
    const feedbackResponse = await axios.post(
      `${AI_SERVICE_URL}/langgraph/feedback`,
      {
        thread_id: threadId, // eslint-disable-line camelcase
        feedback
      },
      feedbackConfig
    );

    type FeedbackResponse = {
      workflow_id: string;
      status: string;
      current_stage: string;
      final_response: string;
      analysis_results?: {
        security_scan?: string;
        quality_analysis?: string;
        generate_optimizations?: string;
      };
      requires_human_review: boolean;
    };

    const result = feedbackResponse.data as FeedbackResponse;

    logger.info(`[LangGraph] Feedback processed for thread ${threadId}`);

    // Save updated analysis if completed
    if (result.status === 'completed' && result.analysis_results) {
      try {
        const results = result.analysis_results;
        const securityData = results.security_scan ? JSON.parse(results.security_scan) : {};
        const qualityData = results.quality_analysis ? JSON.parse(results.quality_analysis) : {};
        const optimizationData = results.generate_optimizations
          ? JSON.parse(results.generate_optimizations)
          : {};

        await ScriptAnalysis.upsert({
          scriptId: parseInt(scriptId),
          purpose: result.final_response || 'Analysis completed with feedback',
          securityScore: securityData.risk_score || 5.0,
          codeQualityScore: qualityData.quality_score || 5.0,
          riskScore: securityData.risk_score || 5.0,
          parameters: {},
          optimizationSuggestions: optimizationData.optimizations || [],
          commandDetails: {},
          msDocsReferences: []
        });
      } catch (saveError) {
        logger.error(`[LangGraph] Error saving feedback analysis: ${saveError}`);
      }
    }

    return res.json({
      success: true,
      workflow_id: result.workflow_id,
      status: result.status,
      current_stage: result.current_stage,
      final_response: result.final_response,
      analysis_results: result.analysis_results,
      requires_human_review: result.requires_human_review
    });
  } catch (error) {
    logger.error('[LangGraph] Feedback submission failed:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to process feedback',
      error: (error as Error).message
    });
  }
}

// Export as a controller object for compatibility
export const ScriptAnalysisController = {
  getScriptAnalysis,
  analyzeScript,
  analyzeScriptAndSave,
  analyzeScriptWithAssistant,
  analyzeLangGraph,
  streamAnalysis,
  provideFeedback
};
