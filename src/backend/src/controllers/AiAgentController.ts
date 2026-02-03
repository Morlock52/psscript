/**
 * AI Agent Controller
 * Handles AI agent interactions including question answering and script analysis
 */
import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger';
import { analyzeScriptAssistant, answerQuestion } from '../services/ai/aiEngine';

class AiAgentController {
  /**
   * Answer a question using the AI agent
   */
  async answerQuestion(req: Request, res: Response, _next: NextFunction) {
    try {
      const { question, context, useAgent: _useAgent = false } = req.body;
      
      if (!question) {
        return res.status(400).json({ 
          message: 'Question is required', 
          status: 'error' 
        });
      }
      
      logger.info(`Processing AI agent question: "${question.substring(0, 50)}..."`);
      
      const apiKey = req.headers['x-openai-api-key'] as string | undefined;
      const response = await answerQuestion(question, context, apiKey);
      return res.json({ response });
    } catch (error) {
      logger.error('Error in AI agent question endpoint:', error);
      return res.status(500).json({ 
        message: 'Failed to process your question', 
        status: 'error' 
      });
    }
  }

  /**
   * Analyze a script using the AI assistant
   */
  async analyzeScript(req: Request, res: Response, _next: NextFunction) {
    try {
      const { content, filename, requestType: _requestType = 'standard', analysisOptions: _analysisOptions } = req.body;
      
      if (!content) {
        return res.status(400).json({ 
          message: 'Script content is required', 
          status: 'error' 
        });
      }
      
      logger.info(`Processing AI assistant analysis request: ${filename || 'unnamed script'}`);
      
      const apiKey = req.headers['x-openai-api-key'] as string | undefined;
      const analysisResult = await analyzeScriptAssistant(content, filename || 'script.ps1', apiKey);
      return res.json(analysisResult);
    } catch (error) {
      logger.error('Error in AI assistant analysis endpoint:', error);
      return res.status(500).json({ 
        message: 'Failed to analyze the script', 
        status: 'error' 
      });
    }
  }
}

export default new AiAgentController();
