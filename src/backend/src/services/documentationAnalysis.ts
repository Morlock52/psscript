import * as cheerio from 'cheerio';

export interface DocumentationAnalysisResult {
  title: string;
  summary: string;
  category: string;
  aiInsights: string[];
  codeExample: string;
  keyFindings: string[];
  riskNotes: string[];
  recommendedActions: string[];
}

const CATEGORIES = [
  'Process Management',
  'File System',
  'Service Management',
  'Network',
  'Security',
  'Module Management',
  'Data Conversion',
  'Pipeline',
  'Output',
  'Web Requests',
  'Active Directory',
  'Azure',
  'AWS',
  'General',
];

const POWERSHELL_SCRIPT_SELECTOR = [
  'pre code',
  'code',
  '.code-block',
  '.powershell',
  '[class*="language-powershell"]',
  '[class*="lang-ps"]',
].join(', ');

const commandPattern = /\b(Get|Set|New|Remove|Start|Stop|Add|Clear|Copy|Move|Rename|Test|Import|Export|Invoke|Register|Unregister|Update|Write|Read|Where|Select|Sort|Group|ForEach)-[A-Z][a-zA-Z]+\b/g;
const modulePattern = /\b(Microsoft\.[A-Z][a-zA-Z.]+|PSReadLine|Pester|PSScriptAnalyzer|Az\.[A-Z][a-zA-Z]+)\b/g;

export function extractPowerShellScriptsFromHtml(html: string): string[] {
  const $ = cheerio.load(html);
  const scripts: string[] = [];

  $(POWERSHELL_SCRIPT_SELECTOR).each((_, elem) => {
    const code = $(elem).text().trim();
    if (!looksLikePowerShell(code)) return;
    if (code.length > 20 && code.length < 10000) scripts.push(code);
  });

  return [...new Set(scripts)];
}

export function extractPowerShellCommands(content: string): string[] {
  return [...new Set(content.match(commandPattern) || [])];
}

export function extractPowerShellModules(content: string): string[] {
  return [...new Set(content.match(modulePattern) || [])];
}

export function buildDocumentationAnalysisPrompt(content: string, pageUrl: string, scripts: string[] = []): string {
  const scriptExamples = scripts.slice(0, 2).map((script, i) => {
    const snippet = script.length > 300
      ? script.substring(0, script.indexOf('\n', 250) > 0 ? script.indexOf('\n', 250) : 300) + '...'
      : script;
    return `Script ${i + 1}:\n\`\`\`powershell\n${snippet}\n\`\`\``;
  }).join('\n\n');

  return `Analyze this PowerShell documentation for an operations/security report.

Use a modern technical assessment structure: executive summary first, findings with evidence and impact, prioritized recommendations, scope/limitations, and validation notes. Prioritize the most operationally relevant information: commands, modules, automation pattern, security impact, implementation risk, and next actions.

Return ONLY valid JSON with this schema:
{
  "title": "max 60 chars",
  "summary": "one executive-summary sentence, max 180 chars",
  "aiInsights": ["3-4 concise learning points"],
  "keyFindings": ["2-4 finding statements with evidence or affected behavior"],
  "riskNotes": ["0-3 security, reliability, or operational risks"],
  "recommendedActions": ["2-4 prioritized action statements"],
  "codeExample": "one short PowerShell example, max 120 chars, or empty",
  "category": "${CATEGORIES.join('" | "')}"
}

Rules:
- Use neutral, audit-ready language.
- Do not invent commands, modules, vulnerabilities, or external references.
- If the page is tutorial/reference content, explain what an operator should do next.
- If code is present, mention whether it is safe as-is, needs validation, or needs review before production.
- Keep every array item short enough for a card and PDF report.

URL:
${pageUrl}

Page Content:
${content.substring(0, 3200)}

${scripts.length > 0 ? `PowerShell Code Found:\n${scriptExamples}` : ''}`;
}

export function parseDocumentationAnalysisResponse(responseText: string, content: string, pageUrl: string): DocumentationAnalysisResult {
  const fallback = createFallbackDocumentationAnalysis(content, pageUrl);

  try {
    let cleaned = responseText.trim();
    if (cleaned.startsWith('"') && cleaned.endsWith('"')) cleaned = cleaned.slice(1, -1);
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return fallback;

    const parsed = JSON.parse(jsonMatch[0]);
    return {
      title: limitText(parsed.title, fallback.title, 60),
      summary: limitText(parsed.summary, fallback.summary, 220),
      category: CATEGORIES.includes(parsed.category) ? parsed.category : fallback.category,
      aiInsights: normalizeStringArray(parsed.aiInsights, 4),
      codeExample: limitText(parsed.codeExample, '', 140),
      keyFindings: normalizeStringArray(parsed.keyFindings, 4),
      riskNotes: normalizeStringArray(parsed.riskNotes, 3),
      recommendedActions: normalizeStringArray(parsed.recommendedActions, 4),
    };
  } catch {
    return fallback;
  }
}

export function createFallbackDocumentationAnalysis(content: string, pageUrl: string): DocumentationAnalysisResult {
  const commands = extractPowerShellCommands(content);
  const modules = extractPowerShellModules(content);
  const category = detectCategory(content);
  const title = extractFallbackTitle(content, pageUrl);
  const summary = extractFallbackSummary(content);

  return {
    title,
    summary,
    category,
    aiInsights: [
      commands.length > 0 ? `Mentions ${commands.slice(0, 3).join(', ')}` : `${category} reference content`,
      modules.length > 0 ? `References ${modules.slice(0, 2).join(', ')}` : 'Review examples before production use',
    ].filter(Boolean),
    codeExample: commands[0] || '',
    keyFindings: [
      summary,
      commands.length > 0 ? `Primary commands identified: ${commands.slice(0, 5).join(', ')}` : 'No explicit PowerShell commands were detected.',
    ],
    riskNotes: category === 'Security' ? ['Security-related content should be validated in a non-production environment.'] : [],
    recommendedActions: [
      'Validate examples against the target PowerShell version and execution policy.',
      'Document required permissions, inputs, outputs, and rollback steps before reuse.',
    ],
  };
}

function looksLikePowerShell(code: string): boolean {
  if (!code) return false;
  return Boolean(
    code.includes('Get-') ||
    code.includes('Set-') ||
    code.includes('New-') ||
    code.includes('Remove-') ||
    code.includes('$') ||
    code.includes('param(') ||
    code.includes('function ') ||
    code.includes('Write-Host') ||
    code.includes('Write-Output') ||
    code.includes('ForEach-Object') ||
    code.includes('Where-Object') ||
    code.match(/\|\s*(Select|Where|ForEach|Sort|Group)/)
  );
}

function detectCategory(content: string): string {
  const lowerContent = content.toLowerCase();
  if (lowerContent.includes('get-process') || lowerContent.includes('process management')) return 'Process Management';
  if (lowerContent.includes('file system') || lowerContent.includes('get-childitem')) return 'File System';
  if (lowerContent.includes('service') || lowerContent.includes('get-service')) return 'Service Management';
  if (lowerContent.includes('network') || lowerContent.includes('test-connection')) return 'Network';
  if (lowerContent.includes('security') || lowerContent.includes('execution policy')) return 'Security';
  if (lowerContent.includes('module') || lowerContent.includes('import-module')) return 'Module Management';
  if (lowerContent.includes('json') || lowerContent.includes('convert')) return 'Data Conversion';
  if (lowerContent.includes('pipeline') || lowerContent.includes('foreach-object')) return 'Pipeline';
  if (lowerContent.includes('invoke-webrequest') || lowerContent.includes('web request')) return 'Web Requests';
  if (lowerContent.includes('active directory')) return 'Active Directory';
  if (lowerContent.includes('azure') || lowerContent.includes('az.')) return 'Azure';
  if (lowerContent.includes('aws')) return 'AWS';
  return 'General';
}

function extractFallbackTitle(content: string, pageUrl: string): string {
  const urlParts = pageUrl.split('/').filter(Boolean);
  let fallbackTitle = (urlParts[urlParts.length - 1] || 'Documentation Page').replace(/[-_]/g, ' ');
  const headingMatch = content.match(/^#\s+(.+)|^(.+?)\n=+|<h1[^>]*>([^<]+)/m);
  if (headingMatch) fallbackTitle = (headingMatch[1] || headingMatch[2] || headingMatch[3]).trim();

  fallbackTitle = fallbackTitle
    .replace(/\s+/g, ' ')
    .replace(/[|*]/g, ' - ')
    .trim()
    .substring(0, 60);

  if (!fallbackTitle || fallbackTitle.length < 3) fallbackTitle = 'Documentation Page';
  return fallbackTitle.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ');
}

function extractFallbackSummary(content: string): string {
  let summary = content
    .replace(/Table of contents.*?Focus mode/gi, '')
    .replace(/Exit editor mode.*?Ask Learn/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 260);

  const sentenceEnd = summary.search(/[.!?]\s/);
  if (sentenceEnd > 50) summary = summary.substring(0, sentenceEnd + 1);
  return summary || 'PowerShell documentation page.';
}

function normalizeStringArray(value: unknown, maxItems: number): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map(item => String(item || '').replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .slice(0, maxItems);
}

function limitText(value: unknown, fallback: string, maxLength: number): string {
  const text = String(value || fallback || '').replace(/\s+/g, ' ').trim();
  return text.length > maxLength ? text.substring(0, maxLength - 3).trim() + '...' : text;
}
