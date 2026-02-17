import React, { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { scriptService } from '../services/api';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import { FaExclamationTriangle, FaCheckCircle, FaInfoCircle, FaLightbulb, FaChartLine, FaPaperPlane, FaRobot } from 'react-icons/fa';
// LangGraph Integration
import { streamAnalysis, AnalysisEvent } from '../services/langgraphService';
import { AnalysisProgressPanel } from '../components/Analysis/AnalysisProgressPanel';
import { getApiUrl } from '../utils/apiUrl';

// Define message type for AI chat
interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface AssistantModelOption {
  value: string;
  label: string;
  provider: 'openai' | 'anthropic' | 'google' | 'ollama';
  source: 'static' | 'configured';
  details?: string;
  supportsAnalysis: boolean;
  supportsChat: boolean;
}

interface ProviderModelRow {
  id: string;
  owned_by?: string;
  created?: number;
}

interface GoogleModelRow {
  id: string;
  displayName: string;
  description?: string;
  inputTokenLimit?: number;
  outputTokenLimit?: number;
  supportedGenerationMethods?: string[];
}

interface OllamaModelRow {
  name: string;
  size?: number;
  context_length?: number;
  size_vram?: number;
  details?: {
    parameter_size?: string;
    quantization_level?: string;
  };
}

type ModelProvider = 'openai' | 'anthropic' | 'google' | 'ollama';

const MODEL_PROVIDER_LABELS: Record<ModelProvider, string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  google: 'Google',
  ollama: 'Ollama'
};

const ANALYSIS_DEFAULT_MODELS: AssistantModelOption[] = [
  {
    value: 'gpt-4o',
    label: 'GPT-4o (OpenAI)',
    provider: 'openai',
    source: 'static',
    details: 'Balanced quality + speed for coding tasks.',
    supportsAnalysis: true,
    supportsChat: true,
  },
  {
    value: 'gpt-4.1',
    label: 'GPT-4.1 (OpenAI)',
    provider: 'openai',
    source: 'static',
    details: 'Higher reasoning for long analysis chains.',
    supportsAnalysis: true,
    supportsChat: true,
  },
  {
    value: 'gpt-4o-mini',
    label: 'GPT-4o Mini (Fast)',
    provider: 'openai',
    source: 'static',
    details: 'Lower-cost, faster responses for routine questions.',
    supportsAnalysis: true,
    supportsChat: true,
  },
  {
    value: 'claude-sonnet-4-20250514',
    label: 'Claude Sonnet 4 (Anthropic)',
    provider: 'anthropic',
    source: 'static',
    details: 'Anthropic support is available when key is configured.',
    supportsAnalysis: true,
    supportsChat: true,
  },
];

const MODEL_ORDER: ModelProvider[] = ['ollama', 'openai', 'anthropic', 'google'];

const buildModelProviderUrls = (baseUrl: string, path: '/api/tags' | '/api/ps'): string[] => {
  const urls: string[] = [`${window.location.origin}/ollama${path}`];
  const trimmed = baseUrl.replace(/\/+$/, '');

  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    urls.push(`${trimmed}${path}`);
  } else if (trimmed) {
    urls.push(`http://${trimmed}${path}`);
  }

  if (/^(https?:\/\/)?(localhost|127\.0\.0\.1)(:\d+)?$/i.test(trimmed) && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    const isHttps = window.location.protocol === 'https:';
    const host = isHttps ? `https://${window.location.hostname}:11434` : `http://${window.location.hostname}:11434`;
    urls.push(`${host}${path}`);
  }

  return [...new Set(urls)];
};

const fetchJsonFromAny = async (urls: string[]) => {
  let lastError = 'Unknown error';
  for (const url of urls) {
    try {
      const response = await axios.get(url, { timeout: 12000 });
      if (response.status >= 200 && response.status < 300) {
        return response.data;
      }
      lastError = `${url} -> HTTP ${response.status} ${response.statusText}`;
    } catch (error) {
      const details = (error as Error).message || 'Unknown error';
      lastError = `${url} -> ${details}`;
    }
  }
  throw new Error(lastError);
};

const toSortedModelList = (values: AssistantModelOption[]) => {
  const modelGroups = new Map<string, AssistantModelOption[]>();
  values.forEach((model) => {
    const current = modelGroups.get(model.provider) || [];
    current.push(model);
    modelGroups.set(model.provider, current);
  });

  const merged: AssistantModelOption[] = [];
  MODEL_ORDER.forEach((provider) => {
    const group = modelGroups.get(provider) || [];
    merged.push(...group.sort((a, b) => a.value.localeCompare(b.value)));
  });
  return merged;
};

const formatTokenLimit = (value?: number): string => {
  if (!value) return '';
  return value >= 1_000_000
    ? `${(value / 1_000_000).toFixed(1)}M`
    : value.toLocaleString();
}

const formatBytes = (value?: number): string => {
  if (!value) return '';
  const sizeGb = value / (1024 ** 3);
  return `${sizeGb.toFixed(1)} GB`;
}

const buildModelLabel = (
  modelId: string,
  provider: ModelProvider,
  detail?: string
) => {
  const providerSuffix = provider === 'openai'
    ? 'OpenAI'
    : provider === 'anthropic'
      ? 'Anthropic'
      : provider === 'google'
        ? 'Google'
        : 'Ollama';
  if (!detail) {
    return `${modelId} (${providerSuffix})`;
  }
  return `${modelId} (${providerSuffix} · ${detail})`;
}

const getModelLimitationNotes = (model?: AssistantModelOption): string[] => {
  if (!model) {
    return ['No model selected', 'Pick one from the AI Assistant model selector.'];
  }

  const notes: string[] = [
    `Provider: ${MODEL_PROVIDER_LABELS[model.provider]}`,
    `Usage: ${model.supportsChat ? 'Chat + analysis' : 'Analysis only'}`
  ];

  if (model.provider === 'ollama') {
    notes.push('Local inference: requires a running Ollama service and enough RAM/VRAM.');
    notes.push('Latency can vary based on model size and hardware.');
  } else if (model.provider === 'google') {
    notes.push('Google Gemini discovery is included; chat is not yet wired in this assistant flow.');
  } else if (model.provider === 'anthropic') {
    notes.push('Requires Anthropic API key in provider settings.');
  } else {
    notes.push('Requires OpenAI-compatible API key in provider settings.');
  }

  if (model.details) {
    notes.push(model.details);
  }

  return notes;
};

const ScriptAnalysis: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<string>('overview');

  // AI Assistant state
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // LangGraph Analysis state
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisEvents, setAnalysisEvents] = useState<AnalysisEvent[]>([]);
  const [currentStage, setCurrentStage] = useState('idle');
  const [workflowId, setWorkflowId] = useState<string | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  // AI Model selection state - Multi-model support
  const [isModelCatalogLoading, setIsModelCatalogLoading] = useState(false);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [modelCatalog, setModelCatalog] = useState<AssistantModelOption[]>(ANALYSIS_DEFAULT_MODELS);
  const savedAssistantModel = localStorage.getItem('scriptanalysis_model');
  const [selectedModel, setSelectedModel] = useState(
    savedAssistantModel || localStorage.getItem('ollama_model') || localStorage.getItem('openai_model') || 'gpt-4o'
  );

  const getProviderApiKey = (provider: ModelProvider): string => {
    if (provider === 'openai') {
      return localStorage.getItem('openai_api_key') || '';
    }
    if (provider === 'anthropic') {
      return localStorage.getItem('anthropic_api_key') || '';
    }
    if (provider === 'google') {
      return localStorage.getItem('google_api_key') || '';
    }
    return '';
  };

  const getOllamaBaseUrl = () => {
    return (
      localStorage.getItem('ollama_base_url')
      || import.meta.env.VITE_OLLAMA_BASE_URL
      || 'http://localhost:11434'
    ).trim();
  };

  const selectedModelMeta = modelCatalog.find((model) => model.value === selectedModel);
  const chatCapableModelCatalog = modelCatalog.filter((model) => model.supportsChat);
  const analysisOnlyModelCatalog = modelCatalog.filter((model) => !model.supportsChat);

  const normalizeModelList = (entries: AssistantModelOption[]) => {
    const unique: Record<string, AssistantModelOption> = {};
    const all = [...ANALYSIS_DEFAULT_MODELS, ...entries];
    all.forEach((entry) => {
      const key = `${entry.provider}:${entry.value}`;
      if (!unique[key]) {
        unique[key] = entry;
      }
    });

    return toSortedModelList(Object.values(unique));
  };

  const resolveModelByProviderPref = (models: AssistantModelOption[]) => {
    const preferredOrder = [
      localStorage.getItem('scriptanalysis_model'),
      localStorage.getItem('ollama_model'),
      localStorage.getItem('openai_model'),
      localStorage.getItem('google_model'),
    ].filter(Boolean) as string[];

    for (const preferredModel of preferredOrder) {
      const found = models.find((model) => model.value === preferredModel && model.supportsChat);
      if (found) {
        return found.value;
      }
    }

    for (const preferredModel of preferredOrder) {
      const found = models.find((model) => model.value === preferredModel);
      if (found) {
        return found.value;
      }
    }

    return models.find((model) => model.supportsChat)?.value
      || models[0]?.value
      || 'gpt-4o';
  };

  const refreshModelCatalog = async () => {
    const apiUrl = getApiUrl();
    setIsModelCatalogLoading(true);
    setCatalogError(null);

    try {
      const nextModels: AssistantModelOption[] = [];

      const openAiKey = getProviderApiKey('openai').trim();
      if (openAiKey) {
        try {
          const openAiResponse = await axios.get(`${apiUrl}/health/provider-models/openai`, {
            headers: {
              'x-openai-api-key': openAiKey,
            },
          });
          const openAiModels = Array.isArray(openAiResponse.data?.models)
            ? openAiResponse.data.models as ProviderModelRow[]
            : [];
          const mergedOpenAi = openAiModels
            .filter((row) => row?.id && typeof row.id === 'string' && row.id.trim())
            .map((row) => ({
              value: row.id,
              label: buildModelLabel(row.id, 'openai', row.owned_by),
              provider: 'openai' as const,
              source: 'configured' as const,
              details: row.owned_by ? `Owned by ${row.owned_by}` : undefined,
              supportsAnalysis: true,
              supportsChat: true,
            }));
          nextModels.push(...mergedOpenAi);
        } catch (error) {
          console.warn('OpenAI model scan failed for analysis dropdown', error);
        }
      }

      const googleKey = getProviderApiKey('google').trim();
      if (googleKey) {
        try {
          const googleResponse = await axios.get(`${apiUrl}/health/provider-models/google`, {
            headers: {
              'x-goog-api-key': googleKey,
            },
          });
          const googleModels = Array.isArray(googleResponse.data?.models)
            ? googleResponse.data.models as GoogleModelRow[]
            : [];
          const mergedGoogle = googleModels
            .filter((row) => row?.id && typeof row.id === 'string' && row.id.trim())
            .map((row) => ({
              value: row.id,
              label: buildModelLabel(row.id, 'google', row.displayName),
              provider: 'google' as const,
              source: 'configured' as const,
              details: row.displayName || row.id,
              supportsAnalysis: true,
              supportsChat: false,
            }));
          nextModels.push(...mergedGoogle);
        } catch (error) {
          console.warn('Google model scan failed for analysis dropdown', error);
        }
      }

      const ollamaBaseUrl = getOllamaBaseUrl().replace(/\/+$/, '');
      try {
        const tagsResponseData = await fetchJsonFromAny(buildModelProviderUrls(ollamaBaseUrl, '/api/tags'));
        const psResponseData = await fetchJsonFromAny(buildModelProviderUrls(ollamaBaseUrl, '/api/ps')).catch(() => ({ models: [] }));
        const tagsModels = Array.isArray(tagsResponseData?.models) ? tagsResponseData.models as OllamaModelRow[] : [];
        const runningMap = new Map<string, OllamaModelRow>();
        Array.isArray(psResponseData?.models) && psResponseData.models.forEach((model: OllamaModelRow) => {
          runningMap.set(model.name, model);
        });

        const ollamaModels = tagsModels
          .filter((model) => model?.name && typeof model.name === 'string' && model.name.trim())
          .map((model) => {
            const running = runningMap.get(model.name);
            const contextLength = running?.context_length ?? model.context_length;
            const memoryHint = formatBytes(
              running?.size || running?.size_vram || model.size
            );
            const detailParts: string[] = [];
            if (contextLength) {
              detailParts.push(`Context ${formatTokenLimit(contextLength)}`);
            }
            if (memoryHint) {
              detailParts.push(`Memory ${memoryHint}`);
            }
            const sizeHint = model.size ? formatBytes(model.size) : '';
            if (sizeHint && !memoryHint) {
              detailParts.push(`Size ${sizeHint}`);
            }

            return {
              value: model.name,
              label: buildModelLabel(
                model.name,
                'ollama',
                detailParts.join(' · ')
              ),
              provider: 'ollama' as const,
              source: 'configured' as const,
              details: model.details?.parameter_size || running?.details?.parameter_size || undefined,
              supportsAnalysis: true,
              supportsChat: true,
            };
          });
        nextModels.push(...ollamaModels);
      } catch (error) {
        const fallbackModel = localStorage.getItem('ollama_model');
        if (fallbackModel) {
          nextModels.push({
            value: fallbackModel,
            label: buildModelLabel(fallbackModel, 'ollama', 'configured default'),
            provider: 'ollama',
            source: 'configured',
            details: 'Using selected local Ollama model from settings',
            supportsAnalysis: true,
            supportsChat: true,
          });
        }
      }

      const sorted = normalizeModelList(nextModels);

      setModelCatalog(sorted);
      setSelectedModel((current) => {
        const exists = sorted.some((model) => model.value === current);
        if (exists) {
          return current;
        }
        const next = resolveModelByProviderPref(sorted);
        return next;
      });
    } catch (error) {
      console.error('Failed to build model catalog', error);
      setCatalogError((error as Error).message || 'Unable to load model catalog');
      setModelCatalog(ANALYSIS_DEFAULT_MODELS);
    } finally {
      setIsModelCatalogLoading(false);
    }
  };

  useEffect(() => {
    void refreshModelCatalog();
  }, []);

  useEffect(() => {
    localStorage.setItem('scriptanalysis_model', selectedModel);
  }, [selectedModel]);
  
  const { data: script, isLoading: scriptLoading } = useQuery({
    queryKey: ['script', id],
    queryFn: () => scriptService.getScript(id || ''),
    enabled: !!id,
    refetchOnWindowFocus: false,
  });

  const { data: analysis, isLoading: analysisLoading } = useQuery({
    queryKey: ['scriptAnalysis', id],
    queryFn: () => scriptService.getScriptAnalysis(id || ''),
    enabled: !!id,
    refetchOnWindowFocus: false,
  });
  
  const isDataLoading = scriptLoading || analysisLoading;
  
  // Scroll to bottom of messages when they change
  useEffect(() => {
    if (activeTab === 'assistant' && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, activeTab]);

  // Initialize AI assistant with a welcome message when the tab is first opened
  useEffect(() => {
    if (activeTab === 'assistant' && messages.length === 0 && script && analysis) {
      setMessages([
        {
          role: 'assistant',
          content: `# Welcome to Psscript AI Assistant!

I'm here to help you understand and improve your PowerShell script: **${script.title}**.

You can ask me questions about:
- How specific parts of your script work
- Security concerns and how to address them
- Performance optimization opportunities
- Best practices for PowerShell scripting
- How to implement specific features

What would you like to know about your script?`
        }
      ]);
    }
  }, [activeTab, messages.length, script, analysis]);

  // Handle sending a message to the AI
  const handleSendMessage = async () => {
    if (!input.trim()) return;

    if (!selectedModelMeta) {
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: 'Model selection is not valid. Refresh the model list and choose an available model.',
        }
      ]);
      return;
    }

    const chatCapableModelMeta = selectedModelMeta.supportsChat
      ? selectedModelMeta
      : modelCatalog.find((model) => model.supportsChat);

    if (!chatCapableModelMeta) {
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: 'No chat-capable model is configured. Scan Ollama models in Settings > API Settings, then retry.',
        }
      ]);
      return;
    }

    if (chatCapableModelMeta.value !== selectedModelMeta.value) {
      setSelectedModel(chatCapableModelMeta.value);
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: `Using ${chatCapableModelMeta.label} for chat because ${selectedModelMeta.value} is analysis-only in this flow.`,
        },
      ]);
    }

    const modelApiKey = getProviderApiKey(chatCapableModelMeta.provider);

    // Optional: provide clear failure messaging when Anthropic key is missing.
    if (chatCapableModelMeta.provider === 'anthropic' && !modelApiKey) {
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: 'Anthropic key not found. Add your Anthropic API key in Settings > API Settings, then retry.',
        }
      ]);
      return;
    }

    // Create a copy of the user message
    const userMessage = { role: 'user' as const, content: input };

    // Update state
    setInput('');
    setIsLoading(true);
    setMessages(prev => [...prev, userMessage]);

    try {
      // Prepare enhanced context about the script for the AI
      // The backend has guardrails to ensure PowerShell/scripting focus
      const systemPrompt = `You are PSScript AI, a specialized PowerShell scripting assistant.

CURRENT SCRIPT CONTEXT:
- Title: ${script?.title || 'Untitled Script'}
- Purpose: ${analysis?.purpose || 'Not yet analyzed'}
- Security Score: ${analysis?.securityScore || analysis?.security_score || 'N/A'}/10
- Code Quality Score: ${analysis?.codeQualityScore || analysis?.code_quality_score || 'N/A'}/10
- Risk Score: ${analysis?.riskScore || analysis?.risk_score || 'N/A'}/10

YOUR CAPABILITIES:
1. Explain what this script does and how it works
2. Identify security concerns and suggest fixes
3. Recommend code quality improvements
4. Help debug issues in the script
5. Generate new PowerShell scripts or modify existing ones
6. Explain PowerShell concepts and best practices

RESPONSE GUIDELINES:
- Be specific and reference details from the script analysis
- Provide code examples with proper PowerShell syntax highlighting
- Highlight security implications when relevant
- If asked to generate scripts, follow 2026 PowerShell best practices
- Be honest if you don't have enough information about something

When generating or modifying scripts:
- Include comment-based help (.SYNOPSIS, .DESCRIPTION, .PARAMETER, .EXAMPLE)
- Use [CmdletBinding()] for advanced function features
- Implement proper error handling with try/catch
- Follow Verb-Noun naming conventions`;

      // Get the API URL from environment or use dynamic hostname
      const apiUrl = getApiUrl();
      const requestPayload: Record<string, any> = {
        messages: [...messages, userMessage],
        system_prompt: systemPrompt,
        model: chatCapableModelMeta.value
      };

      if (chatCapableModelMeta.provider === 'anthropic') {
        requestPayload.agent_type = 'anthropic';
      }
      if (chatCapableModelMeta.provider === 'ollama') {
        requestPayload.agent_type = 'ollama';
        requestPayload.ollama_base_url = getOllamaBaseUrl();
      }
      if (modelApiKey) {
        requestPayload.api_key = modelApiKey;
      }

      // Call AI service with guardrails enabled on backend
      const response = await axios.post(`${apiUrl}/chat`, requestPayload, {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 60000 // 60 second timeout for script generation
      });

      // Add AI response
      if (response.data && response.data.response) {
        setMessages(prev => [
          ...prev,
          { role: 'assistant', content: response.data.response }
        ]);
      } else {
        throw new Error('Invalid response format from AI service');
      }
    } catch (error) {
      console.error('Error sending message to AI:', error);
      // Add error message to chat
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: "I'm sorry, I encountered an error processing your request. Please ensure your question is about PowerShell or scripting. Try asking about script analysis, debugging, or generating new scripts."
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  // LangGraph Analysis Handler
  const handleLangGraphAnalysis = async () => {
    if (!id) return;

    setIsAnalyzing(true);
    setAnalysisEvents([]);
    setAnalysisError(null);
    setCurrentStage('analyzing');

    try {
      // Start streaming analysis
      const cleanup = streamAnalysis(
        parseInt(id),
        (event: AnalysisEvent) => {
          // Add event to history
          setAnalysisEvents((prev) => [...prev, event]);

          // Handle different event types
          switch (event.type) {
            case 'stage_change':
              setCurrentStage(event.data?.stage || 'unknown');
              break;

            case 'tool_started':
              console.log(`[LangGraph] Tool started: ${event.data?.tool_name}`);
              break;

            case 'tool_completed':
              console.log(`[LangGraph] Tool completed: ${event.data?.tool_name}`);
              break;

            case 'completed':
              setIsAnalyzing(false);
              setCurrentStage('completed');
              // Refetch the analysis to get updated results
              if (id) {
                scriptService.getScriptAnalysis(id).catch(console.error);
              }
              break;

            case 'error':
              setIsAnalyzing(false);
              setCurrentStage('failed');
              setAnalysisError(event.message || 'Analysis failed');
              console.error('[LangGraph] Analysis error:', event.message);
              break;

            case 'human_review_required':
              setIsAnalyzing(false);
              setCurrentStage('paused');
              break;
          }

          // Extract workflow ID from first event that has it
          if (event.data?.workflow_id && !workflowId) {
            setWorkflowId(event.data.workflow_id);
          }
        },
        {
          require_human_review: false,
          model: selectedModel,
        }
      );

      // Store cleanup function
      cleanupRef.current = cleanup;
    } catch (error) {
      console.error('[LangGraph] Failed to start analysis:', error);
      setIsAnalyzing(false);
      setCurrentStage('failed');
      setAnalysisError(error instanceof Error ? error.message : 'Failed to start analysis');
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (cleanupRef.current) {
        cleanupRef.current();
      }
    };
  }, []);

  // Render code blocks with syntax highlighting
  const CodeBlock = ({ className, children }: { className?: string; children: React.ReactNode }) => {
    const language = className ? className.replace('language-', '') : 'powershell';
    return (
      <div className="relative rounded-md overflow-hidden bg-gray-800 my-4">
        <div className="flex justify-between items-center px-4 py-2 text-xs border-b border-gray-700">
          <span>{language}</span>
          <button
            onClick={() => navigator.clipboard.writeText(String(children))}
            className="px-2 py-1 rounded text-xs bg-gray-700 hover:bg-gray-600 text-gray-300"
          >
            Copy
          </button>
        </div>
        <pre className="p-4 overflow-x-auto">
          <code className="text-gray-300">{children}</code>
        </pre>
      </div>
    );
  };

  if (isDataLoading) {
    return (
      <div className="flex justify-center items-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }
  
  if (!script || !analysis) {
    return (
      <div className="bg-gray-700 rounded-lg p-8 shadow text-center">
        <h2 className="text-2xl font-bold text-white mb-4">Analysis Not Available</h2>
        <p className="text-gray-300 mb-6">
          The script analysis you are looking for does not exist or you don&apos;t have permission to view it.
        </p>
        <button
          onClick={() => navigate(`/scripts/${id}`)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Back to Script
        </button>
      </div>
    );
  }
  
  // Helper function to render score indicator with 1-10 rating
  // Enhanced for 2026 best practices: animations, accessibility, and visual feedback
  const renderScoreIndicator = (score: number | undefined | null, label: string, reverseColor: boolean = false) => {
    // Handle edge cases - default to 0 if score is missing
    // Normalize: if score > 10, assume 0-100 scale and convert to 1-10
    let normalizedScore = typeof score === 'number' && !isNaN(score) ? score : 0;
    if (normalizedScore > 10) {
      normalizedScore = normalizedScore / 10; // Convert 0-100 to 0-10
    }
    const safeScore = Math.min(10, Math.max(0, normalizedScore));
    const displayScore = safeScore.toFixed(1);
    const percentage = safeScore * 10;

    // Determine color based on score and direction
    let strokeColor = '';
    let textColor = '';
    let bgGlow = '';

    if (reverseColor) {
      // For Risk score (lower is better)
      if (safeScore < 3) {
        strokeColor = '#22c55e'; // green-500
        textColor = 'text-green-400';
        bgGlow = 'shadow-green-500/20';
      } else if (safeScore < 7) {
        strokeColor = '#eab308'; // yellow-500
        textColor = 'text-yellow-400';
        bgGlow = 'shadow-yellow-500/20';
      } else {
        strokeColor = '#ef4444'; // red-500
        textColor = 'text-red-400';
        bgGlow = 'shadow-red-500/20';
      }
    } else {
      // For Quality, Security, Reliability (higher is better)
      if (safeScore > 7) {
        strokeColor = '#22c55e'; // green-500
        textColor = 'text-green-400';
        bgGlow = 'shadow-green-500/20';
      } else if (safeScore > 4) {
        strokeColor = '#eab308'; // yellow-500
        textColor = 'text-yellow-400';
        bgGlow = 'shadow-yellow-500/20';
      } else {
        strokeColor = '#ef4444'; // red-500
        textColor = 'text-red-400';
        bgGlow = 'shadow-red-500/20';
      }
    }

    // Calculate stroke dasharray for circular progress
    // Circle circumference = 2 * PI * radius ≈ 100 for r=15.9155
    const circumference = 100;
    const dashArray = `${percentage} ${circumference - percentage}`;

    return (
      <div className="flex flex-col items-center group">
        {/* Circular Progress Ring */}
        <div className={`relative w-24 h-24 flex items-center justify-center mb-2 rounded-full shadow-lg ${bgGlow}`}>
          <svg
            className="w-full h-full transform -rotate-90"
            viewBox="0 0 36 36"
            role="progressbar"
            aria-valuenow={safeScore}
            aria-valuemin={0}
            aria-valuemax={10}
            aria-label={`${label} score: ${displayScore} out of 10`}
          >
            {/* Background track */}
            <circle
              cx="18"
              cy="18"
              r="15.9155"
              fill="none"
              stroke="#374151"
              strokeWidth="3"
              className="opacity-60"
            />
            {/* Animated progress arc */}
            <circle
              cx="18"
              cy="18"
              r="15.9155"
              fill="none"
              stroke={strokeColor}
              strokeWidth="3"
              strokeDasharray={dashArray}
              strokeLinecap="round"
              className="transition-all duration-1000 ease-out"
              style={{
                filter: `drop-shadow(0 0 6px ${strokeColor}40)`,
              }}
            />
          </svg>
          {/* Score text overlay */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={`text-2xl font-bold ${textColor}`}>
              {displayScore}
            </span>
            <span className="text-xs text-gray-500">/10</span>
          </div>
        </div>
        {/* Label */}
        <span className="text-sm font-medium text-gray-300 group-hover:text-white transition-colors">
          {label}
        </span>
        {/* Accessibility: Screen reader text */}
        <span className="sr-only">
          {label}: {displayScore} out of 10. {reverseColor ? 'Lower is better.' : 'Higher is better.'}
        </span>
      </div>
    );
  };
  
  return (
    <div className="container mx-auto pb-8">
      {/* Header with back button */}
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">AI Analysis: {script.title}</h1>
          <p className="text-gray-400">Comprehensive analysis and improvement recommendations for your PowerShell script</p>
        </div>
        <div className="flex space-x-2">
          <button
            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
            onClick={() => navigate(`/scripts/${id}`)}
          >
            Back to Script
          </button>
          <button
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center space-x-2"
            onClick={() => navigate('/')}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            <span>Dashboard</span>
          </button>
        </div>
      </div>
      
      {/* Tab Navigation */}
      <div className="mb-6 border-b border-gray-600">
        <nav className="flex space-x-4">
          <button
            className={`py-3 px-4 text-sm font-medium ${activeTab === 'overview' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-gray-400 hover:text-white'}`}
            onClick={() => setActiveTab('overview')}
          >
            Overview
          </button>
          <button
            className={`py-3 px-4 text-sm font-medium ${activeTab === 'security' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-gray-400 hover:text-white'}`}
            onClick={() => setActiveTab('security')}
          >
            Security
          </button>
          <button
            className={`py-3 px-4 text-sm font-medium ${activeTab === 'quality' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-gray-400 hover:text-white'}`}
            onClick={() => setActiveTab('quality')}
          >
            Code Quality
          </button>
          <button
            className={`py-3 px-4 text-sm font-medium ${activeTab === 'performance' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-gray-400 hover:text-white'}`}
            onClick={() => setActiveTab('performance')}
          >
            Performance
          </button>
          <button
            className={`py-3 px-4 text-sm font-medium ${activeTab === 'parameters' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-gray-400 hover:text-white'}`}
            onClick={() => setActiveTab('parameters')}
          >
            Parameters
          </button>
          <button
            className={`py-3 px-4 text-sm font-medium flex items-center ${activeTab === 'assistant' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-gray-400 hover:text-white'}`}
            onClick={() => setActiveTab('assistant')}
          >
            <FaRobot className="mr-2" />
            Psscript AI
          </button>
        </nav>
      </div>
      
      {/* Tab Content */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Main Content Area */}
        <div className="md:col-span-2">
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <>
                  {/* LangGraph Analysis Button */}
                  <div className="bg-gradient-to-r from-indigo-900 to-purple-900 rounded-lg shadow mb-6 p-6 border border-indigo-700">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-white mb-2 flex items-center">
                      <FaRobot className="mr-3 text-indigo-400" size={24} />
                      AI Agent Analysis
                    </h3>
                    <p className="text-gray-300 text-sm">
                      Run deep multi-agent analysis with LangGraph orchestrator for comprehensive security scanning, quality assessment, and optimization recommendations.
                    </p>
                  </div>
                  <button
                    onClick={handleLangGraphAnalysis}
                    disabled={isAnalyzing}
                    className={`px-6 py-3 rounded-lg font-medium transition-all ${
                      isAnalyzing
                        ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                        : 'bg-indigo-600 text-white hover:bg-indigo-700 hover:shadow-lg'
                    }`}
                  >
                    {isAnalyzing ? (
                      <span className="flex items-center">
                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Analyzing...
                      </span>
                    ) : (
                      'Analyze with AI Agents'
                    )}
                  </button>
                  </div>
                </div>

              {/* Analysis Progress Panel */}
              {isAnalyzing && (
                <AnalysisProgressPanel
                  workflowId={workflowId || undefined}
                  currentStage={currentStage}
                  status="analyzing"
                  events={analysisEvents}
                />
              )}

              {/* Analysis Complete Message */}
              {currentStage === 'completed' && !isAnalyzing && (
                <div className="bg-green-900 bg-opacity-20 border border-green-700 rounded-lg p-4 mb-6">
                  <div className="flex items-center">
                    <FaCheckCircle className="text-green-400 mr-3" size={20} />
                    <div>
                      <h4 className="font-medium text-green-300">Analysis Complete!</h4>
                      <p className="text-sm text-gray-300">The analysis results have been updated below.</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Analysis Error Message */}
              {analysisError && (
                <div className="bg-red-900 bg-opacity-20 border border-red-700 rounded-lg p-4 mb-6">
                  <div className="flex items-center">
                    <FaExclamationTriangle className="text-red-400 mr-3" size={20} />
                    <div>
                      <h4 className="font-medium text-red-300">Analysis Failed</h4>
                      <p className="text-sm text-gray-300">{analysisError}</p>
                    </div>
                  </div>
                </div>
              )}

              <div className="bg-gray-700 rounded-lg shadow mb-6">
                <div className="p-4 bg-gray-800 border-b border-gray-600">
                  <h2 className="text-lg font-medium">Analysis Summary</h2>
                </div>
                <div className="p-6">
                  <p className="text-gray-300 mb-6">{analysis.purpose}</p>
                
                <div className="grid grid-cols-4 gap-4 mb-8">
                  {renderScoreIndicator(analysis.codeQualityScore, 'Quality')}
                  {renderScoreIndicator(analysis.securityScore, 'Security')}
                  {renderScoreIndicator(analysis.riskScore, 'Risk', true)}
                  {analysis.reliabilityScore && renderScoreIndicator(analysis.reliabilityScore, 'Reliability')}
                </div>
                
                <div className="mt-6 space-y-6">
                  <div>
                    <h3 className="text-lg font-medium mb-4 flex items-center">
                      <svg className="w-5 h-5 mr-2 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Key Findings
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className={`p-4 rounded-lg border ${analysis.securityScore > 7 ? 'bg-green-900 bg-opacity-20 border-green-700' : 'bg-yellow-900 bg-opacity-20 border-yellow-700'}`}>
                        <div className="flex items-start">
                          {analysis.securityScore > 7 ? (
                            <FaCheckCircle className="text-green-400 mt-1 mr-3 flex-shrink-0 text-xl" />
                          ) : (
                            <FaInfoCircle className="text-yellow-400 mt-1 mr-3 flex-shrink-0 text-xl" />
                          )}
                          <div>
                            <h4 className="font-medium mb-1">Security Assessment</h4>
                            <p className="text-gray-300">
                              This script {analysis.securityScore > 7 ? 'follows good security practices' : 'has some security concerns that should be addressed'}.
                            </p>
                          </div>
                        </div>
                      </div>
                      
                      <div className={`p-4 rounded-lg border ${analysis.codeQualityScore > 7 ? 'bg-green-900 bg-opacity-20 border-green-700' : analysis.codeQualityScore > 5 ? 'bg-blue-900 bg-opacity-20 border-blue-700' : 'bg-yellow-900 bg-opacity-20 border-yellow-700'}`}>
                        <div className="flex items-start">
                          {analysis.codeQualityScore > 7 ? (
                            <FaCheckCircle className="text-green-400 mt-1 mr-3 flex-shrink-0 text-xl" />
                          ) : analysis.codeQualityScore > 5 ? (
                            <FaInfoCircle className="text-blue-400 mt-1 mr-3 flex-shrink-0 text-xl" />
                          ) : (
                            <FaInfoCircle className="text-yellow-400 mt-1 mr-3 flex-shrink-0 text-xl" />
                          )}
                          <div>
                            <h4 className="font-medium mb-1">Code Quality</h4>
                            <p className="text-gray-300">
                              Code quality is {analysis.codeQualityScore > 7 ? 'high' : analysis.codeQualityScore > 5 ? 'moderate' : 'needs improvement'} with potential for optimization.
                            </p>
                          </div>
                        </div>
                      </div>
                      
                      {/* Security concerns card */}
                      {analysis.securityConcerns && analysis.securityConcerns.length > 0 ? (
                        <div className="p-4 rounded-lg border bg-red-900 bg-opacity-20 border-red-700">
                          <div className="flex items-start">
                            <FaExclamationTriangle className="text-red-500 mt-1 mr-3 flex-shrink-0" />
                            <div>
                              <p className="text-red-300">{analysis.securityConcerns.length} security {analysis.securityConcerns.length === 1 ? 'concern' : 'concerns'} found.</p>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="p-4 rounded-lg border bg-green-900 bg-opacity-20 border-green-700">
                          <div className="flex items-start">
                            <FaCheckCircle className="text-green-500 mt-1 mr-3 flex-shrink-0" />
                            <div>
                              <p className="text-green-300">No significant security concerns were found in this script.</p>
                            </div>
                          </div>
                        </div>
                      )}
                      
                      {/* Performance suggestions card */}
                      {analysis.performanceSuggestions && analysis.performanceSuggestions.length > 0 ? (
                        <div className="p-4 rounded-lg border bg-purple-900 bg-opacity-20 border-purple-700">
                          <div className="flex items-start">
                            <FaLightbulb className="text-purple-400 mt-1 mr-3 flex-shrink-0" />
                            <div>
                              <p className="text-purple-300">{analysis.performanceSuggestions.length} performance {analysis.performanceSuggestions.length === 1 ? 'suggestion' : 'suggestions'} found.</p>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="p-4 rounded-lg border bg-blue-900 bg-opacity-20 border-blue-700">
                          <div className="flex items-start">
                            <FaCheckCircle className="text-blue-400 mt-1 mr-3 flex-shrink-0" />
                            <div>
                              <p className="text-blue-300">No specific performance optimization suggestions were identified for this script.</p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="mt-6 pt-6 border-t border-gray-600">
                    <h3 className="text-lg font-medium mb-3 flex items-center">
                      <svg className="w-5 h-5 mr-2 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                      Key PowerShell Commands Analysis
                    </h3>
                    <div className="space-y-6">
                      {analysis.commandDetails && analysis.commandDetails.length > 0 ? (
                        analysis.commandDetails.map((command, index) => (
                          <div key={index} className="bg-gradient-to-r from-gray-800 to-gray-900 p-4 rounded-lg border border-gray-700 shadow-md">
                            <h4 className="text-blue-400 font-medium mb-3">{command.name}</h4>
                            <div className="space-y-3">
                              <p className="text-gray-300">{command.description}</p>
                              
                              <div className="bg-gray-900 bg-opacity-50 p-3 rounded-lg">
                                <h5 className="text-sm text-blue-300 font-semibold mb-2">Purpose</h5>
                                <p className="text-gray-300">{command.purpose}</p>
                              </div>
                              
                              {command.parameters && command.parameters.length > 0 && (
                                <div className="bg-gray-900 bg-opacity-50 p-3 rounded-lg">
                                  <h5 className="text-sm text-blue-300 font-semibold mb-2">Common Parameters</h5>
                                  <ul className="list-disc pl-5 text-gray-300">
                                    {command.parameters.map((param, paramIndex) => (
                                      <li key={paramIndex}>
                                        <code className="bg-gray-800 px-1 rounded text-yellow-300">{param.name}</code> - {param.description}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                              
                              {command.example && (
                                <div className="bg-gray-900 bg-opacity-50 p-3 rounded-lg">
                                  <h5 className="text-sm text-blue-300 font-semibold mb-2">Example in Script</h5>
                                  <div className="bg-gray-800 p-2 rounded my-1 border-l-4 border-blue-500">
                                    <code className="text-yellow-300">{command.example}</code>
                                  </div>
                                </div>
                              )}
                              
                              {command.alternatives && (
                                <div className="bg-gray-900 bg-opacity-50 p-3 rounded-lg">
                                  <h5 className="text-sm text-blue-300 font-semibold mb-2">Alternative Approaches</h5>
                                  <div className="bg-gray-800 p-2 rounded my-1 border-l-4 border-green-500">
                                    <code className="text-green-300">{command.alternatives}</code>
                                  </div>
                                  {command.alternativeNote && (
                                    <p className="text-gray-400 text-xs mt-1">Note: {command.alternativeNote}</p>
                                  )}
                                </div>
                              )}
                              
                              {command.msDocsUrl && (
                                <div className="mt-2">
                                  <a 
                                    href={command.msDocsUrl} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="text-blue-400 hover:text-blue-300 flex items-center"
                                  >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                    </svg>
                                    Microsoft Documentation
                                  </a>
                                </div>
                              )}
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
                          <p className="text-gray-300">No detailed command analysis available for this script.</p>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {analysis.msDocsReferences && analysis.msDocsReferences.length > 0 && (
                    <div className="mt-6 pt-6 border-t border-gray-600">
                      <h3 className="text-lg font-medium mb-3 flex items-center">
                        <svg className="w-5 h-5 mr-2 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        Microsoft Documentation References
                      </h3>
                      <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
                        <ul className="space-y-3">
                          {analysis.msDocsReferences.map((doc, index) => (
                            <li key={index} className="flex items-start bg-gray-900 bg-opacity-50 p-3 rounded-lg hover:bg-opacity-70 transition-colors duration-200">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-400 mr-3 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                              <div>
                                <a 
                                  href={doc.url} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="text-blue-400 hover:text-blue-300 font-medium"
                                >
                                  {doc.title}
                                </a>
                                <p className="text-gray-400 text-sm mt-1">{doc.description}</p>
                              </div>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}
                  
                  <div className="mt-6 pt-6 border-t border-gray-600">
                    <h3 className="text-lg font-medium mb-3 flex items-center">
                      <FaRobot className="mr-2 text-blue-400" />
                      AI Command Analysis
                    </h3>
                    <div className="bg-gray-800 p-4 rounded-lg border border-gray-700 overflow-auto">
                      <pre className="text-sm text-gray-300 whitespace-pre-wrap font-mono">
{`# AI Command Analysis for ${script.title}

## Command Structure
This script follows the PowerShell cmdlet naming convention "Verb-Noun" and uses approved verbs.
* Primary Command: Get-SystemInfo
* Parameter Binding: Uses standard PowerShell parameter binding with [Parameter()] attributes
* Pipeline Support: Returns objects that can be passed through the pipeline

## Command Safety
* Execution Scope: Runs in the user's security context
* Network Activity: ${analysis.securityScore > 7 ? 'Limited to specified computers' : 'May access undefined network resources'}
* Permissions: Requires standard WMI query permissions
* Error Handling: ${analysis.codeQualityScore > 7 ? 'Comprehensive' : 'Basic'} error handling implemented

## Command Performance
* Resource Usage: ${analysis.performanceSuggestions?.length ? 'Moderate to high on large environments' : 'Efficient for most environments'}
* Execution Time: Expected to complete within 1-5 seconds per target system
* Memory Impact: Low to moderate depending on number of network adapters

## Command Output
* Output Type: PSCustomObject with system information properties
* Formatting: Raw object output suitable for pipeline processing
* Consistency: Maintains consistent property naming and data types

## Improvement Opportunities
* Consider adding -Credential parameter for remote system authentication
* Implement support for pipeline input (multiple computer names)
* Add verbose output for troubleshooting
* Implement timeout parameter for WMI queries`}
                      </pre>
                    </div>
                  </div>
                </div>
              </div>
              </div>
            </>
          )}

          {/* Security Tab */}
          {activeTab === 'security' && (
            <div className="bg-gray-700 rounded-lg shadow mb-6">
              <div className="p-4 bg-gray-800 border-b border-gray-600">
                <h2 className="text-lg font-medium">Security Analysis</h2>
              </div>
              <div className="p-6">
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-md font-medium">Security Score</h3>
                    <span className={`px-2 py-1 rounded text-sm ${
                      analysis.securityScore > 7 
                        ? 'bg-green-900 text-green-300' 
                        : analysis.securityScore > 4 
                        ? 'bg-yellow-900 text-yellow-300' 
                        : 'bg-red-900 text-red-300'
                    }`}>
                      {analysis.securityScore}/10
                    </span>
                  </div>
                  <div className="w-full bg-gray-800 rounded-full h-2.5">
                    <div 
                      className={`h-2.5 rounded-full ${
                        analysis.securityScore > 7 
                          ? 'bg-green-500' 
                          : analysis.securityScore > 4 
                          ? 'bg-yellow-500' 
                          : 'bg-red-500'
                      }`}
                      style={{ width: `${analysis.securityScore * 10}%` }}
                    ></div>
                  </div>
                </div>
                
                {analysis.securityConcerns && analysis.securityConcerns.length > 0 ? (
                  <div className="mb-6">
                    <h3 className="text-md font-medium mb-3">Security Concerns</h3>
                    <ul className="space-y-3">
                      {analysis.securityConcerns.map((concern, index) => (
                        <li key={index} className="bg-red-900 bg-opacity-20 p-3 rounded-lg border border-red-700">
                          <div className="flex items-start">
                            <FaExclamationTriangle className="text-red-500 mt-1 mr-3 flex-shrink-0" />
                            <div>
                              <p className="text-red-300">{concern}</p>
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <div className="mb-6 bg-green-900 bg-opacity-20 p-4 rounded-lg border border-green-700">
                    <div className="flex items-start">
                      <FaCheckCircle className="text-green-500 mt-1 mr-3 flex-shrink-0" />
                      <div>
                        <p className="text-green-300">No significant security concerns were found in this script.</p>
                      </div>
                    </div>
                  </div>
                )}
                
                <div className="mt-6">
                  <h3 className="text-md font-medium mb-3">Best Practices</h3>
                  {analysis.bestPractices && analysis.bestPractices.length > 0 ? (
                    <ul className="space-y-2">
                      {analysis.bestPractices.map((practice, index) => (
                        <li key={index} className="flex items-start">
                          <FaCheckCircle className="text-blue-400 mt-1 mr-2 flex-shrink-0" />
                          <span className="text-gray-300">{practice}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-gray-400">No specific best practices were identified for this script.</p>
                  )}
                </div>
              </div>
            </div>
          )}
          
          {/* Code Quality Tab */}
          {activeTab === 'quality' && (
            <div className="bg-gray-700 rounded-lg shadow mb-6">
              <div className="p-4 bg-gray-800 border-b border-gray-600">
                <h2 className="text-lg font-medium">Code Quality Analysis</h2>
              </div>
              <div className="p-6">
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-md font-medium">Quality Score</h3>
                    <span className={`px-2 py-1 rounded text-sm ${
                      analysis.codeQualityScore > 7 
                        ? 'bg-green-900 text-green-300' 
                        : analysis.codeQualityScore > 4 
                        ? 'bg-yellow-900 text-yellow-300' 
                        : 'bg-red-900 text-red-300'
                    }`}>
                      {analysis.codeQualityScore}/10
                    </span>
                  </div>
                  <div className="w-full bg-gray-800 rounded-full h-2.5">
                    <div 
                      className="bg-blue-600 h-2.5 rounded-full" 
                      style={{ width: `${analysis.codeQualityScore * 10}%` }}
                    ></div>
                  </div>
                </div>
                
                {analysis.optimizationSuggestions && analysis.optimizationSuggestions.length > 0 && (
                  <div className="mb-6">
                    <h3 className="text-md font-medium mb-3">Suggested Improvements</h3>
                    <div className="space-y-3">
                      {analysis.optimizationSuggestions.map((suggestion: string | { type?: string; description?: string }, index: number) => (
                        <div key={index} className="bg-blue-900 bg-opacity-20 p-3 rounded-lg border border-blue-800">
                          <div className="flex items-start">
                            <FaLightbulb className="text-yellow-400 mt-1 mr-3 flex-shrink-0" />
                            <div>
                              {typeof suggestion === 'string' ? (
                                <p className="text-gray-300">{suggestion}</p>
                              ) : (
                                <>
                                  {suggestion.type && <p className="text-gray-200 font-medium">{suggestion.type}</p>}
                                  <p className="text-gray-300">{suggestion.description || JSON.stringify(suggestion)}</p>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {analysis.complexityScore && (
                  <div className="mb-6">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-md font-medium">Complexity</h3>
                      <span className={`px-2 py-1 rounded text-sm ${
                        analysis.complexityScore < 4 
                          ? 'bg-green-900 text-green-300' 
                          : analysis.complexityScore < 8 
                          ? 'bg-yellow-900 text-yellow-300' 
                          : 'bg-red-900 text-red-300'
                      }`}>
                        {analysis.complexityScore}/10
                      </span>
                    </div>
                    <div className="w-full bg-gray-800 rounded-full h-2.5">
                      <div 
                        className={`h-2.5 rounded-full ${
                          analysis.complexityScore < 4 
                            ? 'bg-green-500' 
                            : analysis.complexityScore < 8 
                            ? 'bg-yellow-500' 
                            : 'bg-red-500'
                        }`}
                        style={{ width: `${analysis.complexityScore * 10}%` }}
                      ></div>
                    </div>
                    <p className="text-sm text-gray-400 mt-2">
                      {analysis.complexityScore < 4 
                        ? 'Low complexity makes this script easy to understand and maintain.' 
                        : analysis.complexityScore < 8 
                        ? 'Moderate complexity - some sections might benefit from refactoring.' 
                        : 'High complexity - consider breaking this script into smaller modules.'}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
          
          {/* Performance Tab */}
          {activeTab === 'performance' && (
            <div className="bg-gray-700 rounded-lg shadow mb-6">
              <div className="p-4 bg-gray-800 border-b border-gray-600">
                <h2 className="text-lg font-medium">Performance Analysis</h2>
              </div>
              <div className="p-6">
                {analysis.performanceSuggestions && analysis.performanceSuggestions.length > 0 ? (
                  <div className="mb-6">
                    <h3 className="text-md font-medium mb-3">Performance Optimization Opportunities</h3>
                    <div className="space-y-4">
                      {analysis.performanceSuggestions.map((suggestion, index) => (
                        <div key={index} className="bg-green-900 bg-opacity-20 p-4 rounded-lg border border-green-800">
                          <div className="flex items-start">
                            <FaChartLine className="text-green-400 mt-1 mr-3 flex-shrink-0" />
                            <div>
                              <p className="text-gray-300">{suggestion}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="mb-6 bg-blue-900 bg-opacity-20 p-4 rounded-lg">
                    <div className="flex items-start">
                      <FaInfoCircle className="text-blue-400 mt-1 mr-3 flex-shrink-0" />
                      <div>
                        <p className="text-gray-300">No specific performance optimization suggestions were identified for this script.</p>
                      </div>
                    </div>
                  </div>
                )}
                
                {analysis.reliabilityScore && (
                  <div className="mb-6">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-md font-medium">Reliability</h3>
                      <span className={`px-2 py-1 rounded text-sm ${
                        analysis.reliabilityScore > 7 
                          ? 'bg-green-900 text-green-300' 
                          : analysis.reliabilityScore > 4 
                          ? 'bg-yellow-900 text-yellow-300' 
                          : 'bg-red-900 text-red-300'
                      }`}>
                        {analysis.reliabilityScore}/10
                      </span>
                    </div>
                    <div className="w-full bg-gray-800 rounded-full h-2.5">
                      <div 
                        className={`h-2.5 rounded-full ${
                          analysis.reliabilityScore > 7 
                            ? 'bg-green-500' 
                            : analysis.reliabilityScore > 4 
                            ? 'bg-yellow-500' 
                            : 'bg-red-500'
                        }`}
                        style={{ width: `${analysis.reliabilityScore * 10}%` }}
                      ></div>
                    </div>
                    <p className="text-sm text-gray-400 mt-2">
                      {analysis.reliabilityScore > 7 
                        ? 'High reliability - script handles errors well and should operate consistently.' 
                        : analysis.reliabilityScore > 4 
                        ? 'Moderate reliability - additional error handling would improve robustness.' 
                        : 'Low reliability - significant improvements to error handling recommended.'}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
          
          {/* Parameters Tab */}
          {activeTab === 'parameters' && (

            <div className="bg-gray-700 rounded-lg shadow mb-6">
              <div className="p-4 bg-gray-800 border-b border-gray-600">
                <h2 className="text-lg font-medium">Script Parameters</h2>
              </div>
              <div className="p-6">
                {analysis?.parameters && Object.keys(analysis.parameters).length > 0 ? (
                  <div className="space-y-6">
                    {Object.entries(analysis.parameters || {}).map(([name, info]: [string, any]) => (
                      <div key={name} className="border border-gray-600 rounded-lg overflow-hidden">
                        <div className="bg-gray-800 p-3 flex justify-between items-center">
                          <div className="flex items-center">
                            <span className="text-white font-mono">{name}</span>
                            {info.mandatory && (
                              <span className="ml-2 px-2 py-0.5 bg-red-900 text-red-300 rounded text-xs">Required</span>
                            )}
                          </div>
                          <span className="text-gray-400 text-sm">{info.type || 'String'}</span>
                        </div>
                        <div className="p-3">
                          {info.description && <p className="text-gray-300">{info.description}</p>}
                          {info.defaultValue && (
                            <div className="mt-2">
                              <span className="text-gray-400 text-sm">Default: </span>
                              <code className="bg-gray-800 px-2 py-0.5 rounded text-yellow-300">{info.defaultValue}</code>
                            </div>
                          )}
                          {info.validValues && info.validValues.length > 0 && (
                            <div className="mt-2">
                              <span className="text-gray-400 text-sm">Valid values: </span>
                              <div className="flex flex-wrap gap-1 mt-1">
                                {info.validValues.map((value: string, idx: number) => (
                                  <code key={idx} className="bg-gray-800 px-2 py-0.5 rounded text-blue-300">{value}</code>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="bg-blue-900 bg-opacity-20 p-4 rounded-lg">
                    <div className="flex items-start">
                      <FaInfoCircle className="text-blue-400 mt-1 mr-3 flex-shrink-0" />
                      <div>
                        <p className="text-gray-300">This script does not have any identified parameters.</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* AI Assistant Tab */}
          {activeTab === 'assistant' && (
            <div className="bg-gray-700 rounded-lg shadow mb-6 flex flex-col min-h-[480px] h-[68vh] md:h-[64vh]">
              <div className="p-4 bg-gray-800 border-b border-gray-600">
                <h2 className="text-lg font-medium flex items-center">
                  <FaRobot className="mr-2 text-blue-400" />
                  Psscript AI Assistant
                </h2>
                <div className="mt-3">
                  <div className="flex items-center justify-between mb-1">
                    <label htmlFor="model-select-assistant" className="text-xs text-gray-400">
                      AI Model
                    </label>
                    <button
                      type="button"
                      onClick={() => void refreshModelCatalog()}
                      disabled={isModelCatalogLoading}
                      className={`text-xs px-2 py-1 rounded transition-all ${
                        isModelCatalogLoading
                          ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                          : 'text-blue-300 hover:text-white hover:bg-blue-800/40'
                      }`}
                    >
                      {isModelCatalogLoading ? 'Refreshing...' : 'Refresh'}
                    </button>
                  </div>
                  <select
                    id="model-select-assistant"
                    value={selectedModel}
                    onChange={(e) => setSelectedModel(e.target.value)}
                    disabled={isAnalyzing || isModelCatalogLoading || modelCatalog.length === 0}
                    className={`w-full px-3 py-2 rounded-lg border text-sm font-medium transition-all ${
                      isAnalyzing || isModelCatalogLoading || modelCatalog.length === 0
                        ? 'bg-gray-700 text-gray-400 border-gray-600 cursor-not-allowed'
                        : 'bg-gray-800 text-white border-gray-600 hover:border-blue-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500'
                    }`}
                    aria-label="Select AI model for assistant chat"
                  >
                    {chatCapableModelCatalog.length > 0 && (
                      <optgroup label="Chat-capable models">
                        {chatCapableModelCatalog.map((model) => (
                          <option key={`${model.provider}-${model.value}`} value={model.value}>
                            {model.label}
                          </option>
                        ))}
                      </optgroup>
                    )}
                    {analysisOnlyModelCatalog.length > 0 && (
                      <optgroup label="Analysis-only models (not available in chat)">
                        {analysisOnlyModelCatalog.map((model) => (
                          <option
                            key={`${model.provider}-${model.value}`}
                            value={model.value}
                            disabled
                            title="Not yet supported in assistant chat flow"
                          >
                            {model.label} (analysis only)
                          </option>
                        ))}
                      </optgroup>
                    )}
                  </select>
                  {catalogError && (
                    <p className="text-amber-300 text-xs mt-1">
                      {catalogError}
                    </p>
                  )}
                  <ul className="mt-2 space-y-1 text-xs text-gray-300">
                    {getModelLimitationNotes(selectedModelMeta).map((item) => (
                      <li key={item} className="flex items-start">
                        <span className="text-blue-300 mr-2">•</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                  {analysisOnlyModelCatalog.length > 0 && (
                    <p className="text-xs text-gray-300 mt-2">
                      Analysis-only models are shown for exploration. Chat uses the selected chat-capable model (including Ollama).
                    </p>
                  )}
                </div>
              </div>
              
              {/* Chat Messages */}
              <div className="flex-1 overflow-y-auto p-4">
                <div className="space-y-4">
                  {messages.map((msg, index) => (
                    <div 
                      key={index} 
                      className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div 
                        className={`max-w-[75%] rounded-lg p-3 ${
                          msg.role === 'user' 
                            ? 'bg-blue-600 text-white' 
                            : 'bg-gray-800 text-gray-200'
                        }`}
                      >
                        <ReactMarkdown
                          components={{
                            code({inline, className, children, ...props}) {
                              if (inline) {
                                return <code className="bg-gray-900 px-1 rounded font-mono text-yellow-300" {...props}>{children}</code>;
                              }
                              return <CodeBlock className={className}>{children}</CodeBlock>;
                            },
                            h1: ({children}) => <h1 className="text-xl font-bold mb-2">{children}</h1>,
                            h2: ({children}) => <h2 className="text-lg font-bold mb-2">{children}</h2>,
                            h3: ({children}) => <h3 className="text-md font-bold mb-2">{children}</h3>,
                            p: ({children}) => <p className="mb-2">{children}</p>,
                            ul: ({children}) => <ul className="list-disc pl-5 mb-2">{children}</ul>,
                            ol: ({children}) => <ol className="list-decimal pl-5 mb-2">{children}</ol>,
                            // Handle li elements
                            li: ({children, ...props}) => {
                              return <li className="mb-1" {...props}>{children}</li>;
                            },
                            // Custom component for handling text that might be intended as list items but not in a list
                            text: ({children}) => {
                              // Check if the text looks like a list item (starts with - or * or number.)
                              const text = String(children);
                              if (text.trim().match(/^[-*]\s/) || text.trim().match(/^\d+\.\s/)) {
                                return <div className="mb-1 pl-2 border-l-2 border-gray-600">{children}</div>;
                              }
                              return <>{children}</>;
                            },
                          }}
                        >
                          {msg.content}
                        </ReactMarkdown>
                      </div>
                    </div>
                  ))}
                  {isLoading && (
                    <div className="flex justify-start">
                      <div className="bg-gray-800 text-white rounded-lg p-3">
                        <div className="flex space-x-2">
                          <div className="w-2 h-2 rounded-full bg-gray-500 animate-pulse"></div>
                          <div className="w-2 h-2 rounded-full bg-gray-500 animate-pulse delay-75"></div>
                          <div className="w-2 h-2 rounded-full bg-gray-500 animate-pulse delay-150"></div>
                        </div>
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
              </div>
              
              {/* Input Area */}
              <div className="p-4 border-t border-gray-600">
                <form 
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSendMessage();
                  }}
                  className="flex flex-col sm:flex-row gap-2"
                >
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Ask about your PowerShell script..."
                    className="flex-1 bg-gray-800 text-white border border-gray-600 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={isLoading}
                  />
                  <button
                    type="submit"
                    disabled={isLoading || !input.trim()}
                    className="bg-blue-600 text-white rounded-lg px-4 py-2 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                  >
                    <FaPaperPlane className="mr-2" />
                    Send
                  </button>
                </form>
                <p className="text-xs text-gray-500 mt-2">
                  Ask questions about your script to get AI-powered insights and recommendations.
                </p>
              </div>
            </div>
          )}
        </div>
        
        {/* Sidebar */}
        <div className="space-y-6">
          {/* Script Info Card */}
          <div className="bg-gray-700 rounded-lg shadow">
            <div className="p-4 bg-gray-800 border-b border-gray-600">
              <h2 className="text-lg font-medium">Script Information</h2>
            </div>
            <div className="p-4">
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm text-gray-400">Title</h3>
                  <p className="text-white font-medium">{script.title}</p>
                </div>
                <div>
                  <h3 className="text-sm text-gray-400">Category</h3>
                  <p className="text-white">{script.category?.name || 'Uncategorized'}</p>
                </div>
                <div>
                  <h3 className="text-sm text-gray-400">Author</h3>
                  <p className="text-white">{script.user?.username || 'Unknown'}</p>
                </div>
                <div>
                  <h3 className="text-sm text-gray-400">Version</h3>
                  <p className="text-white">{script.version || '1.0'}</p>
                </div>
                <div>
                  <h3 className="text-sm text-gray-400">Last Updated</h3>
                  <p className="text-white">{new Date(script.updatedAt).toLocaleDateString()}</p>
                </div>
                <div>
                  <h3 className="text-sm text-gray-400">Execution Count</h3>
                  <p className="text-white">{script.executionCount || 0}</p>
                </div>
              </div>
            </div>
          </div>
          
          {/* Actions Card */}
          <div className="bg-gray-700 rounded-lg shadow">
            <div className="p-4 bg-gray-800 border-b border-gray-600">
              <h2 className="text-lg font-medium">Actions</h2>
            </div>
            <div className="p-4">
              <div className="space-y-3">
                <button
                  onClick={() => navigate(`/scripts/${id}`)}
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center"
                >
                  View Script
                </button>
                <button
                  onClick={() => navigate(`/scripts/${id}/edit`)}
                  className="w-full px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 flex items-center justify-center"
                >
                  Edit Script
                </button>
                <button
                  onClick={() => {
                    const apiUrl = getApiUrl();
                    window.open(`${apiUrl}/scripts/${id}/export-analysis`, '_blank');
                  }}
                  className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center justify-center"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Export PDF
                </button>
              </div>
            </div>
          </div>
          
          {/* AI Info Card */}
          <div className="bg-gray-700 rounded-lg shadow overflow-hidden">
            <div className="p-4 bg-gradient-to-r from-indigo-800 to-blue-700 border-b border-gray-600">
              <h2 className="text-lg font-medium flex items-center">
                <FaRobot className="mr-2" />
                Analysis Information
              </h2>
            </div>
            <div className="p-4">
              <div className="space-y-4">
                <div className="flex items-center">
                  <div className="w-10 h-10 rounded-full bg-blue-900 flex items-center justify-center mr-3">
                    <svg className="w-6 h-6 text-blue-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-sm text-gray-400">Analysis Date</h3>
                    <p className="text-white font-medium">{new Date().toLocaleDateString()}</p>
                  </div>
                </div>
                
                <div className="flex items-center">
                  <div className="w-10 h-10 rounded-full bg-purple-900 flex items-center justify-center mr-3">
                    <svg className="w-6 h-6 text-purple-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-sm text-gray-400">Analysis Model</h3>
                    <p className="text-white font-medium">{selectedModelMeta?.label || selectedModel}</p>
                    <p className="text-xs text-gray-300">
                      {selectedModelMeta
                        ? `${MODEL_PROVIDER_LABELS[selectedModelMeta.provider]} · ${selectedModelMeta.supportsChat ? 'Chat + Analysis' : 'Analysis only'}`
                        : 'Unknown model provider'}
                    </p>
                    {selectedModelMeta?.details && (
                      <p className="text-xs text-gray-400 mt-1">{selectedModelMeta.details}</p>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center">
                  <div className="w-10 h-10 rounded-full bg-green-900 flex items-center justify-center mr-3">
                    <svg className="w-6 h-6 text-green-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-sm text-gray-400">Analysis Version</h3>
                    <p className="text-white font-medium">3.2.1</p>
                  </div>
                </div>
                
                <div className="mt-4 pt-4 border-t border-gray-600 bg-gray-800 rounded-lg p-3">
                  <div className="flex items-start">
                    <FaInfoCircle className="text-blue-400 mt-1 mr-2 flex-shrink-0" />
                    <p className="text-xs text-gray-300">
                      AI analysis is provided as guidance and may not catch all issues. Always review scripts manually before use in production environments.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ScriptAnalysis;
