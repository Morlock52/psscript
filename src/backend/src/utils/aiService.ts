/**
 * AI Service Utility
 * Handles communication with the AI service for PowerShell script analysis and generation.
 */
import axios, { AxiosRequestConfig } from 'axios';
import logger from './logger';

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';
const DEFAULT_TIMEOUT_MS = 60000;

class AiServiceClient {
  private async post(path: string, payload: unknown, config: AxiosRequestConfig = {}) {
    try {
      const response = await axios.post(`${AI_SERVICE_URL}${path}`, payload, {
        timeout: DEFAULT_TIMEOUT_MS,
        headers: { 'Content-Type': 'application/json' },
        ...config,
      });
      return response.data;
    } catch (error) {
      logger.error(`Error calling AI service at ${path}:`, error);
      throw error;
    }
  }

  async askQuestion(question: string, context?: string) {
    const response = await this.post('/chat', {
      messages: [
        ...(context ? [{ role: 'system', content: `Context: ${context}` }] : []),
        { role: 'user', content: question }
      ]
    });

    return {
      response: response?.response || response?.message || response,
      source: 'ai_service'
    };
  }

  async generateScript(description: string) {
    const response = await this.post('/chat', {
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
    });

    return {
      content: response?.response || response?.message || response,
      source: 'ai_service'
    };
  }

  async analyzeScript(content: string, filename?: string, requestType: string = 'standard', analysisOptions?: { fetchMsDocs?: boolean }) {
    return this.post(
      '/analyze',
      {
        content,
        script_name: filename
      },
      {
        params: {
          include_command_details: requestType !== 'quick',
          fetch_ms_docs: analysisOptions?.fetchMsDocs === true,
        }
      }
    );
  }

  async explainScript(content: string, type: string = 'simple') {
    let systemPrompt = 'You are a PowerShell expert. Explain the following script in a clear, educational manner.';
    if (type === 'detailed') {
      systemPrompt = 'You are a PowerShell expert. Provide a detailed line-by-line explanation of this script, including its purpose, structure, and how each component works.';
    } else if (type === 'security') {
      systemPrompt = 'You are a security-focused PowerShell expert. Analyze this script for security implications, potential vulnerabilities, and best practices. Include warnings for dangerous patterns.';
    }

    const response = await this.post('/chat', {
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Explain this PowerShell script:\n\n${content}` }
      ]
    });

    return {
      explanation: response?.response || response?.message || response,
      source: 'ai_service'
    };
  }

  async getSimilarExamples(description: string, limit: number = 5) {
    const response = await this.post('/chat', {
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
    });

    const raw = response?.response || response?.message || response;
    if (typeof raw === 'string') {
      const jsonMatch = raw.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        return { examples: JSON.parse(jsonMatch[0]), source: 'ai_service' };
      }
    }

    return {
      examples: [{
        id: `ex_${Date.now().toString(36)}_0`,
        title: `Example for: ${description}`,
        snippet: typeof raw === 'string' ? raw : JSON.stringify(raw),
        complexity: 'Medium'
      }],
      source: 'ai_service'
    };
  }
}

export default new AiServiceClient();
