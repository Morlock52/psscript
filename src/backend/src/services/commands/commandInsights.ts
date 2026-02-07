import crypto from 'crypto';
import { QueryTypes, Op } from 'sequelize';
import { sequelize } from '../../database/connection';
import Documentation from '../../models/Documentation';
import CommandInsight from '../../models/CommandInsight';
import CommandEnrichmentJob, { CommandEnrichmentJobStatus } from '../../models/CommandEnrichmentJob';
import { getFastModel, getOpenAIClient, extractJson } from '../ai/openaiClient';

type DocContext = {
  title: string;
  url: string;
  summary?: string | null;
  snippet?: string | null;
};

type GeneratedInsight = {
  description?: string;
  howToUse?: string;
  keyParameters?: any[];
  useCases?: any[];
  examples?: any[];
  sampleOutput?: string;
  flags?: any[];
  docsUrls?: Array<{ title?: string; url?: string }>;
  sources?: Record<string, unknown>;
};

const normalizeCmdlet = (raw: string): string => raw.trim();

export const listDistinctCmdletsFromDocumentation = async (): Promise<string[]> => {
  const rows = (await sequelize.query(
    `
      SELECT DISTINCT jsonb_array_elements_text(extracted_commands) AS cmdlet
      FROM documentation
      WHERE extracted_commands IS NOT NULL
        AND jsonb_typeof(extracted_commands) = 'array'
        AND jsonb_array_length(extracted_commands) > 0
    `,
    { type: QueryTypes.SELECT }
  )) as Array<{ cmdlet: string }>;

  const cmdlets = rows
    .map(r => normalizeCmdlet(r.cmdlet))
    .filter(Boolean);

  // Stable ordering makes progress + testing deterministic.
  cmdlets.sort((a, b) => a.localeCompare(b));
  return cmdlets;
};

const fetchDocContextForCmdlet = async (cmdlet: string): Promise<DocContext[]> => {
  // Prefer internal docs content where cmdlet appears in title or content.
  const docs = await Documentation.findAll({
    where: {
      [Op.or]: [
        { title: { [Op.iLike]: `%${cmdlet}%` } },
        { summary: { [Op.iLike]: `%${cmdlet}%` } },
        { content: { [Op.iLike]: `%${cmdlet}%` } }
      ]
    },
    order: [['crawled_at', 'DESC']],
    limit: 3
  });

  return docs.map(d => {
    const content = (d.content || '').toString();
    const snippet = content ? content.slice(0, 1200) : null;
    return {
      title: d.title,
      url: d.url,
      summary: d.summary || null,
      snippet
    };
  });
};

const generateInsightWithAI = async (cmdlet: string, context: DocContext[]): Promise<GeneratedInsight> => {
  const client = getOpenAIClient();
  const model = getFastModel();

  const system = [
    'You are a PowerShell cmdlet reference author and security reviewer.',
    'Return ONLY valid JSON (no markdown, no commentary).',
    'Be practical and concrete. Prefer grounded claims from the provided context.',
    'If a field is unknown, use null/[] and do not guess.',
    '',
    'Schema:',
    '{',
    '  "description": string,',
    '  "howToUse": string,',
    '  "keyParameters": [{"name": string, "description": string, "required": boolean, "dangerous": boolean, "notes": string, "example": string}],',
    '  "useCases": [{"title": string, "scenario": string, "exampleCommand": string, "sampleOutput": string}],',
    '  "examples": [{"title": string, "command": string, "explanation": string, "sampleOutput": string}],',
    '  "sampleOutput": string,',
    '  "flags": [{"severity": "info"|"warn"|"danger", "pattern": string, "reason": string, "saferAlternative": string}],',
    '  "docsUrls": [{"title": string, "url": string}],',
    '  "sources": {"notes": string, "contextUsed": number}',
    '}'
  ].join('\n');

  const user = [
    `Create a compact, high-signal reference card for the PowerShell cmdlet: ${cmdlet}`,
    'Focus on: safe usage, common patterns, and dangerous flags/parameters.',
    'UseCases/Examples should be short, copy-pasteable.',
    '',
    'CONTEXT (internal docs snippets):',
    JSON.stringify(context, null, 2)
  ].join('\n');

  const resp = await client.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user }
    ],
    response_format: { type: 'json_object' }
  });

  const raw = resp.choices[0]?.message?.content || '';
  const parsed = extractJson(raw) as GeneratedInsight | null;
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Failed to parse JSON insight from model response');
  }
  return parsed;
};

const coerceArray = (v: any): any[] => (Array.isArray(v) ? v : []);

export const upsertInsightForCmdlet = async (cmdlet: string): Promise<CommandInsight> => {
  const cmdletName = normalizeCmdlet(cmdlet);
  const context = await fetchDocContextForCmdlet(cmdletName);
  const generated = await generateInsightWithAI(cmdletName, context);

  const docsUrls = coerceArray(generated.docsUrls).filter((d: any) => d && (d.url || d.title));
  if (docsUrls.length === 0) {
    // Always include at least one helpful link for the UI.
    docsUrls.push({
      title: 'Microsoft Learn search',
      url: `https://learn.microsoft.com/search/?terms=${encodeURIComponent(cmdletName)}`
    });
  }

  const [row] = await CommandInsight.upsert(
    {
      cmdletName,
      description: typeof generated.description === 'string' ? generated.description : null,
      howToUse: typeof generated.howToUse === 'string' ? generated.howToUse : null,
      keyParameters: coerceArray(generated.keyParameters),
      useCases: coerceArray(generated.useCases),
      examples: coerceArray(generated.examples),
      sampleOutput: typeof generated.sampleOutput === 'string' ? generated.sampleOutput : null,
      flags: coerceArray(generated.flags),
      docsUrls,
      sources: generated.sources && typeof generated.sources === 'object' ? generated.sources : { contextUsed: context.length },
      lastEnrichedAt: new Date()
    } as any,
    { returning: true }
  ) as any;

  return row as CommandInsight;
};

export const createCommandEnrichmentJob = async (request: Record<string, unknown> = {}) => {
  const running = await CommandEnrichmentJob.findOne({
    where: { status: { [Op.in]: ['queued', 'running'] } as any },
    order: [['created_at', 'DESC']]
  });
  if (running) {
    return { job: running, alreadyRunning: true as const };
  }

  const id = crypto.randomUUID();
  const job = await CommandEnrichmentJob.create({
    id,
    status: 'queued',
    request,
    total: 0,
    processed: 0,
    succeeded: 0,
    failed: 0,
    cancelRequested: false,
    error: null,
    currentCmdlet: null,
    startedAt: null,
    finishedAt: null
  } as any);

  return { job, alreadyRunning: false as const };
};

const setJobStatus = async (
  jobId: string,
  patch: Partial<{
    status: CommandEnrichmentJobStatus;
    total: number;
    processed: number;
    succeeded: number;
    failed: number;
    currentCmdlet: string | null;
    error: string | null;
    startedAt: Date | null;
    finishedAt: Date | null;
  }>
) => {
  await CommandEnrichmentJob.update(patch as any, { where: { id: jobId } });
};

export const runCommandEnrichmentJob = async (jobId: string) => {
  await setJobStatus(jobId, { status: 'running', startedAt: new Date(), error: null });

  let cmdlets: string[] = [];
  try {
    cmdlets = await listDistinctCmdletsFromDocumentation();
    await setJobStatus(jobId, { total: cmdlets.length });
  } catch (e: any) {
    await setJobStatus(jobId, { status: 'error', error: e?.message || 'Failed to list cmdlets', finishedAt: new Date() });
    return;
  }

  let processed = 0;
  let succeeded = 0;
  let failed = 0;

  for (const cmdlet of cmdlets) {
    const job = await CommandEnrichmentJob.findByPk(jobId);
    if (!job) return;
    if (job.cancelRequested) {
      await setJobStatus(jobId, { status: 'cancelled', finishedAt: new Date(), currentCmdlet: null });
      return;
    }

    await setJobStatus(jobId, { currentCmdlet: cmdlet });

    try {
      await upsertInsightForCmdlet(cmdlet);
      succeeded += 1;
    } catch (err: any) {
      failed += 1;
      // Keep going; record last error as a hint.
      await setJobStatus(jobId, { error: err?.message || String(err) });
    } finally {
      processed += 1;
      await setJobStatus(jobId, { processed, succeeded, failed });
    }
  }

  await setJobStatus(jobId, {
    status: 'completed',
    finishedAt: new Date(),
    currentCmdlet: null
  });
};

