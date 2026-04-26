/**
 * AI Agent Routes
 * Handles AI agent interactions including question answering, script generation, and analysis.
 */
import express from 'express';
import axios from 'axios';
import { corsMiddleware } from '../middleware/corsMiddleware';
import logger from '../utils/logger';

const router = express.Router();
router.use(corsMiddleware);

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';
const AI_REQUEST_TIMEOUT_MS = Number(process.env.AI_REQUEST_TIMEOUT_MS || 15000);
const AI_ANALYSIS_TIMEOUT_MS = Number(process.env.AI_ANALYSIS_TIMEOUT_MS || 90000);

logger.info(`AI Agent routes initialized with AI_SERVICE_URL: ${AI_SERVICE_URL}`);

function buildAiServiceFailure(error: unknown, unavailableMessage: string) {
  if (axios.isAxiosError(error) && error.response) {
    return {
      status: 502,
      body: {
        message: 'AI service returned an error',
        error: 'ai_service_error',
        upstreamStatus: error.response.status,
      },
    };
  }

  const errorMessage = error instanceof Error ? error.message.toLowerCase() : '';
  if ((axios.isAxiosError(error) && error.code === 'ECONNABORTED') || errorMessage.includes('timeout')) {
    return {
      status: 504,
      body: {
        message: 'AI service request timed out',
        error: 'ai_service_timeout',
      },
    };
  }

  return {
    status: 503,
    body: {
      message: unavailableMessage,
      error: 'ai_service_unavailable',
    },
  };
}

function sendAiServiceFailure(
  res: express.Response,
  error: unknown,
  unavailableMessage: string,
  logContext: string
) {
  const failure = buildAiServiceFailure(error, unavailableMessage);
  logger.warn(`${logContext}: ${error instanceof Error ? error.message : String(error)}`);
  return res.status(failure.status).json(failure.body);
}

router.post('/please', async (req, res) => {
  try {
    const { question, context } = req.body;

    if (!question) {
      return res.status(400).json({
        message: 'Question is required',
        status: 'error'
      });
    }

    logger.info(`Processing AI agent question: "${question.substring(0, 50)}..."`);

    try {
      const aiResponse = await axios.post(
        `${AI_SERVICE_URL}/chat`,
        {
          messages: [
            ...(context ? [{ role: 'system', content: `Context: ${context}` }] : []),
            { role: 'user', content: question }
          ]
        },
        {
          timeout: AI_REQUEST_TIMEOUT_MS,
          headers: { 'Content-Type': 'application/json' }
        }
      );

      const response = aiResponse.data.response || aiResponse.data.message || aiResponse.data;
      return res.json({
        response: typeof response === 'string' ? response : JSON.stringify(response),
        source: 'ai_service'
      });
    } catch (aiError) {
      return sendAiServiceFailure(res, aiError, 'AI service is unavailable', 'AI service unavailable for /please');
    }
  } catch (error) {
    logger.error('Error in AI agent question endpoint:', error);
    return res.status(500).json({
      message: 'Failed to process your question',
      status: 'error'
    });
  }
});

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

    try {
      const aiResponse = await axios.post(
        `${AI_SERVICE_URL}/chat`,
        {
          messages: [
            {
              role: 'system',
              content: 'You are a PowerShell expert. Generate production-ready PowerShell scripts with proper error handling, parameter validation, and comments. Return ONLY the script content without markdown code blocks.'
            },
            {
              role: 'user',
              content: `Generate a PowerShell script that: ${description}`
            }
          ]
        },
        {
          timeout: AI_REQUEST_TIMEOUT_MS,
          headers: { 'Content-Type': 'application/json' }
        }
      );

      const content = aiResponse.data.response || aiResponse.data.message || aiResponse.data;
      return res.json({
        content: typeof content === 'string' ? content : JSON.stringify(content),
        source: 'ai_service'
      });
    } catch (aiError) {
      return sendAiServiceFailure(res, aiError, 'AI service is unavailable', 'AI service unavailable for /generate');
    }
  } catch (error) {
    logger.error('Error in script generation endpoint:', error);
    return res.status(500).json({
      message: 'Failed to generate script',
      status: 'error'
    });
  }
});

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

    try {
      let systemPrompt = 'You are a PowerShell expert. Explain the following script in a clear, educational manner.';
      if (type === 'detailed') {
        systemPrompt = 'You are a PowerShell expert. Provide a detailed line-by-line explanation of this script, including its purpose, structure, and how each component works.';
      } else if (type === 'security') {
        systemPrompt = 'You are a security-focused PowerShell expert. Analyze this script for security implications, potential vulnerabilities, and best practices. Include warnings for dangerous patterns.';
      }

      const aiResponse = await axios.post(
        `${AI_SERVICE_URL}/chat`,
        {
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `Explain this PowerShell script:\n\n${content}` }
          ]
        },
        {
          timeout: AI_REQUEST_TIMEOUT_MS,
          headers: { 'Content-Type': 'application/json' }
        }
      );

      const explanation = aiResponse.data.response || aiResponse.data.message || aiResponse.data;
      return res.json({
        explanation: typeof explanation === 'string' ? explanation : JSON.stringify(explanation),
        source: 'ai_service'
      });
    } catch (aiError) {
      return sendAiServiceFailure(res, aiError, 'AI service is unavailable', 'AI service unavailable for /explain');
    }
  } catch (error) {
    logger.error('Error in script explanation endpoint:', error);
    return res.status(500).json({
      message: 'Failed to explain the script',
      status: 'error'
    });
  }
});

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

    try {
      const aiResponse = await axios.post(
        `${AI_SERVICE_URL}/chat`,
        {
          messages: [
            {
              role: 'system',
              content: `You are a PowerShell expert. Provide ${limit} relevant PowerShell script examples as a JSON array. Each example should have: title, snippet (complete working script), and complexity (Low/Medium/High).`
            },
            {
              role: 'user',
              content: `Give me ${limit} PowerShell script examples related to: ${description}`
            }
          ]
        },
        {
          timeout: AI_REQUEST_TIMEOUT_MS,
          headers: { 'Content-Type': 'application/json' }
        }
      );

      const response = aiResponse.data.response || aiResponse.data.message || aiResponse.data;
      let examples;

      try {
        const jsonMatch = typeof response === 'string' ? response.match(/\[[\s\S]*\]/) : null;
        if (jsonMatch) {
          examples = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('No JSON array found in response');
        }
      } catch {
        examples = [{
          id: `ex_${Date.now().toString(36)}_0`,
          title: `Example for: ${description}`,
          snippet: typeof response === 'string' ? response : JSON.stringify(response),
          complexity: 'Medium'
        }];
      }

      return res.json({ examples, source: 'ai_service' });
    } catch (aiError) {
      return sendAiServiceFailure(res, aiError, 'AI service is unavailable', 'AI service unavailable for /examples');
    }
  } catch (error) {
    logger.error('Error in script examples endpoint:', error);
    return res.status(500).json({
      message: 'Failed to retrieve script examples',
      status: 'error'
    });
  }
});

router.post('/analyze/assistant', async (req, res) => {
  try {
    const { content, filename } = req.body;

    if (!content) {
      return res.status(400).json({
        message: 'Script content is required',
        status: 'error'
      });
    }

    logger.info(`Processing AI assistant analysis request: ${filename || 'unnamed script'}`);

    try {
      const aiResponse = await axios.post(
        `${AI_SERVICE_URL}/analyze`,
        {
          content,
          script_name: filename
        },
        {
          timeout: AI_ANALYSIS_TIMEOUT_MS,
          params: {
            include_command_details: true,
            fetch_ms_docs: true
          },
          headers: { 'Content-Type': 'application/json' }
        }
      );

      const aiData = aiResponse.data || {};
      return res.json({
        analysis: {
          purpose: aiData.purpose ?? null,
          securityScore: typeof aiData.security_score === 'number' ? aiData.security_score : null,
          codeQualityScore: typeof aiData.code_quality_score === 'number' ? aiData.code_quality_score : null,
          riskScore: typeof aiData.risk_score === 'number' ? aiData.risk_score : null,
          suggestions: Array.isArray(aiData.optimization) ? aiData.optimization : [],
          commandDetails: aiData.command_details ?? [],
          msDocsReferences: aiData.ms_docs_references ?? [],
          examples: [],
          rawAnalysis: aiData.security_analysis ?? null,
          parameters: aiData.parameters ?? {},
          category: aiData.category ?? null,
          categoryId: aiData.category_id ?? null,
        },
        metadata: {
          processingTime: aiData.processing_time ?? null,
          model: aiData.model ?? null,
          threadId: aiData.thread_id ?? null,
          assistantId: aiData.assistant_id ?? null,
          requestId: aiData.request_id ?? null,
        },
        source: 'ai_service'
      });
    } catch (aiError) {
      return sendAiServiceFailure(res, aiError, 'AI analysis service is unavailable', 'AI service unavailable for /analyze/assistant');
    }
  } catch (error) {
    logger.error('Error in AI assistant analysis endpoint:', error);
    return res.status(500).json({
      message: 'Failed to analyze the script',
      status: 'error'
    });
  }
});

router.post('/analyze/langgraph', async (req, res) => {
  try {
    const { content, filename, requireHumanReview = false } = req.body;

    if (!content) {
      return res.status(400).json({
        message: 'Script content is required',
        status: 'error'
      });
    }

    logger.info(`Processing LangGraph analysis request: ${filename || 'unnamed script'}`);

    try {
      const aiResponse = await axios.post(
        `${AI_SERVICE_URL}/langgraph/analyze`,
        {
          script_content: content,
          script_name: filename,
          require_human_review: requireHumanReview
        },
        {
          timeout: AI_ANALYSIS_TIMEOUT_MS,
          headers: { 'Content-Type': 'application/json' }
        }
      );

      return res.json({
        ...aiResponse.data,
        source: 'ai_service'
      });
    } catch (aiError) {
      return sendAiServiceFailure(res, aiError, 'LangGraph analysis service is unavailable', 'AI service unavailable for /analyze/langgraph');
    }
  } catch (error) {
    logger.error('Error in LangGraph analysis endpoint:', error);
    return res.status(500).json({
      message: 'Failed to analyze the script with LangGraph',
      status: 'error'
    });
  }
});

export default router;
