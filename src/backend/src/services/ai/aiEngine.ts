import { getFastModel, getOpenAIClient, getOpenAIModel, getSmartModel, extractJson } from './openaiClient';
import crypto from 'crypto';

export type AssistantAnalysis = {
  analysis: {
    purpose: string;
    securityScore: number;
    codeQualityScore: number;
    riskScore: number;
    suggestions: string[];
    commandDetails: Record<string, unknown>;
    msDocsReferences: Array<{ title: string; url: string }>;
    examples: Array<Record<string, unknown>>;
    rawAnalysis: string;
  };
  metadata: {
    processingTime: number;
    model: string;
    threadId: string;
    assistantId: string;
    requestId?: string;
  };
};

type BasicAnalysis = {
  purpose: string;
  parameters: Record<string, unknown>;
  security_score: number;
  code_quality_score: number;
  risk_score: number;
  reliability_score: number;
  optimization: string[];
  command_details: Record<string, unknown>;
  ms_docs_references: Array<{ command: string; url: string; description?: string }>;
  analysis_message?: string;
  category_id?: number;
};

type LangGraphAnalysis = {
  workflow_id: string;
  status: 'completed' | 'failed' | 'in_progress' | 'paused';
  current_stage: string;
  final_response: string;
  analysis_results: {
    security_scan: string;
    quality_analysis: string;
    generate_optimizations: string;
  };
  requires_human_review: boolean;
  started_at: string;
  completed_at: string;
};

const parseJsonOrThrow = (raw: string, context: string): Record<string, any> => {
  const parsed = extractJson(raw);
  if (!parsed) {
    throw new Error(`Failed to parse ${context} JSON from model response.`);
  }
  return parsed;
};

const buildSystemJsonInstruction = (schemaDescription: string) => {
  return [
    'You are a senior PowerShell security and quality reviewer.',
    'Return ONLY valid JSON with no surrounding markdown or commentary.',
    schemaDescription
  ].join(' ');
};

export const analyzeScriptBasic = async (content: string, apiKey?: string): Promise<BasicAnalysis> => {
  const client = getOpenAIClient(apiKey);
  const model = getSmartModel();

  const system = buildSystemJsonInstruction(
    'Schema: {purpose, parameters, security_score, code_quality_score, risk_score, reliability_score, optimization, command_details, ms_docs_references, analysis_message, category_id}.'
  );

  const user = [
    'Analyze this PowerShell script for purpose, security, quality, and risk.',
    'Provide scores from 0-10 where higher is better except risk_score where higher is riskier.',
    'Provide concise suggestions and 2-5 Microsoft Docs references.',
    '',
    'SCRIPT:',
    content
  ].join('\n');

  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), 45_000);

  const response = await (async () => {
    try {
      return await client.chat.completions.create(
        {
          model,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: user }
          ],
          response_format: { type: 'json_object' }
        },
        { signal: abort.signal }
      );
    } finally {
      clearTimeout(timer);
    }
  })();

  const raw = response.choices[0]?.message?.content || '';
  const parsed = parseJsonOrThrow(raw, 'basic analysis');

  return {
    purpose: parsed.purpose || 'Purpose not identified',
    parameters: parsed.parameters || {},
    security_score: Number(parsed.security_score ?? 0),
    code_quality_score: Number(parsed.code_quality_score ?? 0),
    risk_score: Number(parsed.risk_score ?? 0),
    reliability_score: Number(parsed.reliability_score ?? 0),
    optimization: Array.isArray(parsed.optimization) ? parsed.optimization : [],
    command_details: parsed.command_details || {},
    ms_docs_references: Array.isArray(parsed.ms_docs_references) ? parsed.ms_docs_references : [],
    analysis_message: parsed.analysis_message
  };
};

export const analyzeScriptAssistant = async (
  content: string,
  filename: string,
  apiKey?: string
): Promise<AssistantAnalysis> => {
  const client = getOpenAIClient(apiKey);
  const model = getSmartModel();
  const start = Date.now();

  const system = buildSystemJsonInstruction(
    'Schema: {analysis:{purpose,securityScore,codeQualityScore,riskScore,suggestions,commandDetails,msDocsReferences,examples,rawAnalysis}}.'
  );

  const user = [
    'Perform deep agentic-style analysis of this PowerShell script.',
    'Include security findings, quality issues, and actionable suggestions.',
    'Provide 2-5 Microsoft Docs references with title+url.',
    'Return JSON only.',
    '',
    `FILENAME: ${filename}`,
    'SCRIPT:',
    content
  ].join('\n');

  const response = await client.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user }
    ],
    response_format: { type: 'json_object' }
  });

  const raw = response.choices[0]?.message?.content || '';
  const parsed = parseJsonOrThrow(raw, 'assistant analysis');
  const analysis = parsed.analysis || {};

  return {
    analysis: {
      purpose: analysis.purpose || 'Purpose not identified',
      securityScore: Number(analysis.securityScore ?? 0),
      codeQualityScore: Number(analysis.codeQualityScore ?? 0),
      riskScore: Number(analysis.riskScore ?? 0),
      suggestions: Array.isArray(analysis.suggestions) ? analysis.suggestions : [],
      commandDetails: analysis.commandDetails || {},
      msDocsReferences: Array.isArray(analysis.msDocsReferences) ? analysis.msDocsReferences : [],
      examples: Array.isArray(analysis.examples) ? analysis.examples : [],
      rawAnalysis: analysis.rawAnalysis || ''
    },
    metadata: {
      processingTime: Date.now() - start,
      model,
      threadId: crypto.randomUUID(),
      assistantId: crypto.randomUUID()
    }
  };
};

/**
 * "Quick" assistant-style analysis intended for background/bulk workflows.
 * Uses the fast model + a shorter prompt to reduce latency and cost.
 */
export const analyzeScriptAssistantQuick = async (
  content: string,
  filename: string,
  apiKey?: string
): Promise<AssistantAnalysis> => {
  const client = getOpenAIClient(apiKey);
  const model = getFastModel();
  const start = Date.now();

  const system = buildSystemJsonInstruction(
    'Schema: {analysis:{purpose,securityScore,codeQualityScore,riskScore,suggestions,commandDetails,msDocsReferences,examples,rawAnalysis}}.'
  );

  const user = [
    'Quickly analyze this PowerShell script.',
    'Return a short purpose (1 sentence), 3 actionable suggestions, and 1-3 Microsoft Docs references (title+url).',
    'Use scores 0-10 (higher is better) for securityScore/codeQualityScore; riskScore 0-10 (higher is riskier).',
    'If unsure about commandDetails/examples, return {} / [].',
    'Return JSON only.',
    '',
    `FILENAME: ${filename}`,
    'SCRIPT:',
    content.slice(0, 6000)
  ].join('\n');

  const response = await client.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user }
    ],
    response_format: { type: 'json_object' }
  });

  const raw = response.choices[0]?.message?.content || '';
  const parsed = parseJsonOrThrow(raw, 'assistant quick analysis');
  const analysis = parsed.analysis || {};

  return {
    analysis: {
      purpose: analysis.purpose || 'Purpose not identified',
      securityScore: Number(analysis.securityScore ?? 0),
      codeQualityScore: Number(analysis.codeQualityScore ?? 0),
      riskScore: Number(analysis.riskScore ?? 0),
      suggestions: Array.isArray(analysis.suggestions) ? analysis.suggestions : [],
      commandDetails: analysis.commandDetails || {},
      msDocsReferences: Array.isArray(analysis.msDocsReferences) ? analysis.msDocsReferences : [],
      examples: Array.isArray(analysis.examples) ? analysis.examples : [],
      rawAnalysis: analysis.rawAnalysis || ''
    },
    metadata: {
      processingTime: Date.now() - start,
      model,
      threadId: crypto.randomUUID(),
      assistantId: crypto.randomUUID()
    }
  };
};

export const answerQuestion = async (
  question: string,
  context?: string,
  apiKey?: string
): Promise<string> => {
  const client = getOpenAIClient(apiKey);
  const model = getFastModel();

  const messages = [
    {
      role: 'system' as const,
      content:
        'You are a PowerShell expert. Provide concise, accurate answers with examples when helpful.'
    },
    ...(context ? [{ role: 'system' as const, content: `Context: ${context}` }] : []),
    { role: 'user' as const, content: question }
  ];

  const response = await client.chat.completions.create({
    model,
    messages
  });

  return response.choices[0]?.message?.content?.trim() || '';
};

export const generateScript = async (
  description: string,
  apiKey?: string
): Promise<string> => {
  const client = getOpenAIClient(apiKey);
  const model = getSmartModel();

  const response = await client.chat.completions.create({
    model,
    messages: [
      {
        role: 'system',
        content:
          'You are a PowerShell expert. Generate production-ready scripts with parameter validation and error handling. Return ONLY the script content with no markdown.'
      },
      { role: 'user', content: `Generate a PowerShell script that: ${description}` }
    ]
  });

  return response.choices[0]?.message?.content?.trim() || '';
};

export const explainScript = async (
  content: string,
  type: string,
  apiKey?: string
): Promise<string> => {
  const client = getOpenAIClient(apiKey);
  const model = getFastModel();
  const detail = type === 'detailed' ? 'Provide a detailed, step-by-step explanation.' : 'Explain succinctly.';

  const response = await client.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: `You are a PowerShell tutor. ${detail}` },
      { role: 'user', content: content }
    ]
  });

  return response.choices[0]?.message?.content?.trim() || '';
};

export const analyzeLangGraph = async (
  content: string,
  apiKey?: string,
  modelOverride?: string
): Promise<LangGraphAnalysis> => {
  const client = getOpenAIClient(apiKey);
  const model = modelOverride || getSmartModel();
  const startedAt = new Date().toISOString();

  const system = buildSystemJsonInstruction(
    'Schema: {final_response, security_scan, quality_analysis, generate_optimizations}. Each of security_scan, quality_analysis, generate_optimizations must be JSON objects.'
  );

  const user = [
    'Perform multi-agent style analysis of the script.',
    'security_scan: include risk_score (0-10), findings (array).',
    'quality_analysis: include quality_score (0-10), issues (array), recommendations (array).',
    'generate_optimizations: include optimizations (array of {category, priority, recommendation, impact}).',
    '',
    'SCRIPT:',
    content
  ].join('\n');

  const response = await client.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user }
    ],
    response_format: { type: 'json_object' }
  });

  const raw = response.choices[0]?.message?.content || '';
  const parsed = parseJsonOrThrow(raw, 'langgraph analysis');

  const workflowId = crypto.randomUUID();
  const completedAt = new Date().toISOString();

  return {
    workflow_id: workflowId,
    status: 'completed',
    current_stage: 'completed',
    final_response: parsed.final_response || 'Analysis completed.',
    analysis_results: {
      security_scan: JSON.stringify(parsed.security_scan || {}),
      quality_analysis: JSON.stringify(parsed.quality_analysis || {}),
      generate_optimizations: JSON.stringify(parsed.generate_optimizations || {})
    },
    requires_human_review: false,
    started_at: startedAt,
    completed_at: completedAt
  };
};

export const generateExamples = async (
  description: string,
  limit: number,
  apiKey?: string
): Promise<Array<Record<string, unknown>>> => {
  const client = getOpenAIClient(apiKey);
  const model = getFastModel();
  const cappedLimit = Math.min(Math.max(limit, 1), 20);

  const system = buildSystemJsonInstruction(
    'Schema: {examples:[{title, snippet, complexity}]} where complexity is Low, Medium, or High.'
  );
  const user = `Provide ${cappedLimit} PowerShell script examples related to: ${description}`;

  const response = await client.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user }
    ],
    response_format: { type: 'json_object' }
  });

  const raw = response.choices[0]?.message?.content || '';
  const parsed = parseJsonOrThrow(raw, 'examples');
  const examples = Array.isArray(parsed.examples) ? parsed.examples : [];
  return examples;
};

export const improveScript = async (script: string, apiKey?: string): Promise<string> => {
  const client = getOpenAIClient(apiKey);
  const model = getSmartModel();

  const response = await client.chat.completions.create({
    model,
    messages: [
      {
        role: 'system',
        content:
          'You are a PowerShell expert. Improve the script for safety, readability, and error handling. Return ONLY the improved script with no markdown.'
      },
      { role: 'user', content: script }
    ]
  });

  return response.choices[0]?.message?.content?.trim() || script;
};

export const lintScript = async (
  script: string,
  apiKey?: string
): Promise<{ issues: Array<{ severity: string; ruleName: string; message: string; line: number }> }> => {
  const client = getOpenAIClient(apiKey);
  const model = getFastModel();

  const system = buildSystemJsonInstruction(
    'Schema: {issues:[{severity, ruleName, message, line}]}. Severity must be Info, Warning, or Error.'
  );

  const response = await client.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: `Lint this PowerShell script:\n\n${script}` }
    ],
    response_format: { type: 'json_object' }
  });

  const raw = response.choices[0]?.message?.content || '';
  const parsed = parseJsonOrThrow(raw, 'lint');
  const issues = Array.isArray(parsed.issues) ? parsed.issues : [];
  return { issues };
};

export const generateTests = async (
  script: string,
  scriptName?: string,
  coverage: string = 'standard',
  apiKey?: string
): Promise<{ tests: string }> => {
  const client = getOpenAIClient(apiKey);
  const model = getSmartModel();

  const response = await client.chat.completions.create({
    model,
    messages: [
      {
        role: 'system',
        content:
          'You are a PowerShell testing expert. Generate Pester tests only (no markdown).'
      },
      {
        role: 'user',
        content: `Generate ${coverage} Pester tests for ${scriptName || 'script.ps1'}:\n\n${script}`
      }
    ]
  });

  return { tests: response.choices[0]?.message?.content?.trim() || '' };
};

export const routeQuery = async (): Promise<{ model: string; reason: string }> => {
  return { model: getSmartModel(), reason: 'Default high-performance model for coding tasks' };
};
