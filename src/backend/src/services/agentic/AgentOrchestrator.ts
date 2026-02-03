/**
 * Agent Orchestrator Service
 * 
 * This is the central component of our agentic framework, responsible for:
 * - Managing agent instances and their lifecycle
 * - Orchestrating multi-agent workflows
 * - Handling thread state and persistence
 * - Coordinating tool usage across agents
 */

import { v4 as uuidv4 } from 'uuid';
import logger from '../../utils/logger';
import { cache as _cache } from '../../index';
import { getOpenAIClient, getSmartModel } from '../ai/openaiClient';

// Types for the orchestrator
export interface Agent {
  id: string;
  name: string;
  description: string;
  capabilities: string[];
  model: string;
  tools: Tool[];
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface Tool {
  id: string;
  type: string;
  name: string;
  description: string;
  parameters: Record<string, any>;
  function?: (...args: unknown[]) => unknown | Promise<unknown>;
  metadata: Record<string, any>;
}

export interface Thread {
  id: string;
  agentId: string;
  messages: Message[];
  status: ThreadStatus;
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface Message {
  id: string;
  threadId: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string | null;
  toolCalls?: ToolCall[];
  metadata: Record<string, any>;
  createdAt: Date;
}

export interface ToolCall {
  id: string;
  toolId: string;
  name: string;
  arguments: Record<string, any>;
  output?: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  createdAt: Date;
  completedAt?: Date;
}

export type ThreadStatus = 'active' | 'completed' | 'failed' | 'cancelled';

export interface Run {
  id: string;
  threadId: string;
  agentId: string;
  status: RunStatus;
  toolCalls: ToolCall[];
  startedAt: Date;
  completedAt?: Date;
  metadata: Record<string, any>;
}

export type RunStatus = 'queued' | 'in_progress' | 'completed' | 'failed' | 'cancelled';

export class AgentOrchestrator {
  private agents: Map<string, Agent> = new Map();
  private threads: Map<string, Thread> = new Map();
  private runs: Map<string, Run> = new Map();
  private tools: Map<string, Tool> = new Map();
  // Never store API keys on Run metadata (it is returned to callers). Keep them in-memory only.
  private runApiKeys: Map<string, string> = new Map();

  constructor() {
    logger.info('Agent Orchestrator initialized');
    this.registerDefaultTools();
  }

  /**
   * Register default tools available to all agents
   */
  private registerDefaultTools(): void {
    const defaultTools: Tool[] = [
      {
        id: uuidv4(),
        type: 'function',
        name: 'search_powershell_docs',
        description: 'Search Microsoft documentation for PowerShell commands and modules',
        parameters: {
          query: {
            type: 'string',
            description: 'The search query'
          }
        },
        function: async (args: any) => {
          // Implementation would connect to MS Docs API or web scrape
          return `Results for ${args.query}`;
        },
        metadata: {
          category: 'documentation',
          version: '1.0'
        }
      },
      {
        id: uuidv4(),
        type: 'function',
        name: 'analyze_script_security',
        description: 'Analyze a PowerShell script for security vulnerabilities',
        parameters: {
          script: {
            type: 'string',
            description: 'The PowerShell script content'
          }
        },
        function: async (_args: any) => {
          // Implementation would perform security analysis
          return {
            securityScore: 85,
            issues: [],
            recommendations: []
          };
        },
        metadata: {
          category: 'security',
          version: '1.0'
        }
      }
    ];

    // Register each default tool
    defaultTools.forEach(tool => {
      this.tools.set(tool.id, tool);
      logger.debug(`Registered default tool: ${tool.name}`);
    });
  }

  /**
   * Create a new agent instance
   */
  public createAgent(params: Partial<Agent>): Agent {
    const agentId = params.id || uuidv4();
    const now = new Date();
    
    const agent: Agent = {
      id: agentId,
      name: params.name || 'Unnamed Agent',
      description: params.description || '',
      capabilities: params.capabilities || [],
      model: params.model || getSmartModel(),
      tools: params.tools || [],
      metadata: params.metadata || {},
      createdAt: now,
      updatedAt: now
    };
    
    this.agents.set(agentId, agent);
    logger.info(`Created new agent: ${agent.name} (${agentId})`);
    
    return agent;
  }
  
  /**
   * Create a new thread for conversation with an agent
   */
  public createThread(agentId: string, initialMessage?: string): Thread {
    const agent = this.agents.get(agentId);
    if (!agent) {
      throw new Error(`Agent not found: ${agentId}`);
    }
    
    const threadId = uuidv4();
    const now = new Date();
    
    const thread: Thread = {
      id: threadId,
      agentId,
      messages: [],
      status: 'active',
      metadata: {},
      createdAt: now,
      updatedAt: now
    };
    
    // Add initial message if provided
    if (initialMessage) {
      const messageId = uuidv4();
      const message: Message = {
        id: messageId,
        threadId,
        role: 'user',
        content: initialMessage,
        metadata: {},
        createdAt: now
      };
      
      thread.messages.push(message);
    }
    
    this.threads.set(threadId, thread);
    logger.debug(`Created new thread ${threadId} for agent ${agentId}`);
    
    return thread;
  }
  
  /**
   * Add a message to an existing thread
   */
  public addMessage(threadId: string, role: 'user' | 'assistant' | 'system' | 'tool', content: string): Message {
    const thread = this.threads.get(threadId);
    if (!thread) {
      throw new Error(`Thread not found: ${threadId}`);
    }
    
    const messageId = uuidv4();
    const now = new Date();
    
    const message: Message = {
      id: messageId,
      threadId,
      role,
      content,
      metadata: {},
      createdAt: now
    };
    
    thread.messages.push(message);
    thread.updatedAt = now;
    
    logger.debug(`Added ${role} message to thread ${threadId}`);
    
    return message;
  }
  
  /**
   * Start a run to process a thread with the associated agent
   */
  public async createRun(threadId: string, apiKey?: string): Promise<Run> {
    const thread = this.threads.get(threadId);
    if (!thread) {
      throw new Error(`Thread not found: ${threadId}`);
    }
    
    const agent = this.agents.get(thread.agentId);
    if (!agent) {
      throw new Error(`Agent not found: ${thread.agentId}`);
    }
    
    const runId = uuidv4();
    const now = new Date();
    
    const run: Run = {
      id: runId,
      threadId,
      agentId: agent.id,
      status: 'queued',
      toolCalls: [],
      startedAt: now,
      metadata: {}
    };
    
    this.runs.set(runId, run);
    if (apiKey) {
      this.runApiKeys.set(runId, apiKey);
    }
    
    // Update run status to in progress
    run.status = 'in_progress';
    
    logger.info(`Started run ${runId} for thread ${threadId} with agent ${agent.id}`);
    
    // Process the run asynchronously
    this.processRun(run).catch(error => {
      logger.error(`Error processing run ${runId}:`, error);
      run.status = 'failed';
      run.metadata.error = error.message;
    });
    
    return run;
  }
  
  /**
   * Process a run by letting the agent process the thread
   */
  private async processRun(run: Run): Promise<void> {
    try {
      const thread = this.threads.get(run.threadId);
      if (!thread) {
        throw new Error(`Thread not found: ${run.threadId}`);
      }
      
      const agent = this.agents.get(run.agentId);
      if (!agent) {
        throw new Error(`Agent not found: ${run.agentId}`);
      }
      
      const model = agent.model || getSmartModel();
      const apiKey = this.runApiKeys.get(run.id);
      const client = getOpenAIClient(apiKey);

      const systemPromptParts = [
        `You are ${agent.name}.`,
        agent.description ? agent.description : '',
        agent.capabilities?.length ? `Capabilities: ${agent.capabilities.join(', ')}` : '',
        'You are an expert PowerShell assistant. Be practical and precise. Provide safe scripts and explain assumptions.',
      ].filter(Boolean);

      // Build conversation history for the model.
      const messages = [
        { role: 'system' as const, content: systemPromptParts.join('\n') },
        ...thread.messages
          .filter(m => typeof m.content === 'string' && m.content.trim().length > 0)
          .map(m => ({
            // OpenAI chat roles: system | user | assistant | tool.
            role: (m.role === 'tool' ? 'assistant' : m.role) as 'user' | 'assistant' | 'system',
            content: m.content as string,
          })),
      ];

      const openAiTimeoutMs = Number(process.env.AGENTIC_OPENAI_TIMEOUT_MS || 45_000);
      const completion = await Promise.race([
        client.chat.completions.create({
          model,
          messages,
        }),
        new Promise<never>((_resolve, reject) =>
          setTimeout(() => reject(new Error(`OpenAI request timed out after ${openAiTimeoutMs}ms`)), openAiTimeoutMs)
        ),
      ]);

      const assistantText = (completion as any).choices?.[0]?.message?.content?.trim();
      if (!assistantText) {
        throw new Error('No response from OpenAI');
      }

      // Add the assistant's response to the thread.
      this.addMessage(thread.id, 'assistant', assistantText);
      
      // Complete the run
      run.status = 'completed';
      run.completedAt = new Date();
      
      logger.info(`Completed run ${run.id} for thread ${thread.id}`);
    } catch (error) {
      logger.error(`Error in run ${run.id}:`, error);
      run.status = 'failed';
      run.metadata.error = error.message;

      // Surface the error in the thread so the UI doesn't look "stuck".
      try {
        const thread = this.threads.get(run.threadId);
        if (thread) {
          const message =
            `I couldn't complete that request due to an AI error.\n\n` +
            `Error: ${error instanceof Error ? error.message : String(error)}\n\n` +
            `If you're running locally, confirm your OPENAI_API_KEY is set for the backend container.`;
          this.addMessage(thread.id, 'assistant', message);
        }
      } catch (_err) {
        // Ignore secondary failures while reporting the original error.
      }
      throw error;
    } finally {
      // Ensure we don't retain API keys in memory beyond the run lifecycle.
      this.runApiKeys.delete(run.id);
    }
  }
  
  /**
   * Get a thread by ID
   */
  public getThread(threadId: string): Thread | undefined {
    return this.threads.get(threadId);
  }
  
  /**
   * Get a run by ID
   */
  public getRun(runId: string): Run | undefined {
    return this.runs.get(runId);
  }
  
  /**
   * Get all messages for a thread
   */
  public getThreadMessages(threadId: string): Message[] {
    const thread = this.threads.get(threadId);
    if (!thread) {
      throw new Error(`Thread not found: ${threadId}`);
    }
    
    return [...thread.messages];
  }
  
  /**
   * Register a new tool that agents can use
   */
  public registerTool(tool: Omit<Tool, 'id'>): Tool {
    const toolId = uuidv4();
    const fullTool: Tool = {
      ...tool,
      id: toolId,
      metadata: tool.metadata || {}
    };
    
    this.tools.set(toolId, fullTool);
    logger.info(`Registered new tool: ${tool.name} (${toolId})`);
    
    return fullTool;
  }
  
  /**
   * Enable a specific tool for an agent
   */
  public enableToolForAgent(agentId: string, toolId: string): void {
    const agent = this.agents.get(agentId);
    if (!agent) {
      throw new Error(`Agent not found: ${agentId}`);
    }
    
    const tool = this.tools.get(toolId);
    if (!tool) {
      throw new Error(`Tool not found: ${toolId}`);
    }
    
    // Check if tool is already enabled
    if (!agent.tools.some(t => t.id === toolId)) {
      agent.tools.push(tool);
      agent.updatedAt = new Date();
      logger.debug(`Enabled tool ${tool.name} for agent ${agent.name}`);
    }
  }
}

// Create and export singleton instance
export const agentOrchestrator = new AgentOrchestrator();
