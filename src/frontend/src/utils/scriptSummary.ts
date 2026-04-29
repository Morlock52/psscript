export type ScriptLifecycleStatus =
  | 'uploaded'
  | 'analyzing'
  | 'analyzed'
  | 'analysis_failed'
  | 'stale_analysis'
  | 'archived'
  | 'deleted'
  | 'approved'
  | 'needs_review'
  | 'retired';

export interface ScriptSummary {
  id: string;
  title: string;
  description: string;
  content?: string;
  author: string;
  ownerId?: string;
  createdAt?: string;
  updatedAt?: string;
  categoryId?: number | null;
  categoryName?: string;
  tags: string[];
  visibleTags: string[];
  systemTags: string[];
  isPublic: boolean;
  version: number;
  executionCount: number;
  securityScore?: number;
  qualityScore?: number;
  riskScore?: number;
  fileHash?: string;
  lifecycleStatus: ScriptLifecycleStatus;
  analysisCurrent: boolean;
  analysisConfidence?: number | null;
  analysisCriteriaVersion?: string | null;
  isTestData: boolean;
  archivedAt?: string | null;
  archivedBy?: string | null;
  archiveReason?: string | null;
  reviewStatus?: string | null;
  riskBadges: string[];
}

const SYSTEM_TAGS = new Set([
  'codex-smoke',
  'delete-test',
  'readme-screenshot',
  'e2e',
  'e2e-test',
  'test-data',
]);

const TEST_TITLE_PATTERN = /^(e2e script|smoke upload|codex lifecycle|test upload)/i;

export function normalizeScore(...values: unknown[]): number | undefined {
  for (const value of values) {
    const score = Number(value);
    if (Number.isFinite(score)) return score;
  }
  return undefined;
}

export function normalizeIsoDate(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (!value) continue;
    const date = new Date(String(value));
    if (!Number.isNaN(date.getTime())) return date.toISOString();
  }
  return undefined;
}

export function formatScriptDate(script: Pick<ScriptSummary, 'updatedAt' | 'createdAt'>): string {
  const date = normalizeIsoDate(script.updatedAt, script.createdAt);
  return date ? new Date(date).toLocaleDateString() : 'Date unavailable';
}

export function formatScriptRelativeDate(script: Pick<ScriptSummary, 'updatedAt' | 'createdAt'>): string {
  const date = normalizeIsoDate(script.updatedAt, script.createdAt);
  if (!date) return 'Date unavailable';

  const diffMs = Date.now() - new Date(date).getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffDay > 0) return diffDay === 1 ? 'yesterday' : `${diffDay} days ago`;
  if (diffHour > 0) return diffHour === 1 ? '1 hour ago' : `${diffHour} hours ago`;
  if (diffMin > 0) return diffMin === 1 ? '1 minute ago' : `${diffMin} minutes ago`;
  return 'just now';
}

function normalizeTags(rawTags: unknown): string[] {
  if (!Array.isArray(rawTags)) return [];
  return Array.from(new Set(
    rawTags
      .map(tag => String(tag || '').trim().toLowerCase())
      .filter(Boolean)
  )).sort();
}

function isAnalysisCurrent(raw: any, version: number, fileHash?: string): boolean {
  const analysis = raw?.analysis || raw?.latestAnalysis || raw?.analysisSummary;
  const analysisVersion = Number(analysis?.script_version ?? analysis?.scriptVersion);
  const analysisHash = analysis?.file_hash ?? analysis?.fileHash;

  if (analysisVersion && Number.isFinite(analysisVersion)) return analysisVersion === version;
  if (analysisHash && fileHash) return analysisHash === fileHash;
  return Boolean(analysis);
}

function deriveRiskBadges(content: string, analysis: any): string[] {
  const haystack = `${content}\n${JSON.stringify(analysis || {})}`.toLowerCase();
  const badges: string[] = [];

  if (/(remove-item|del |rd |rmdir )/.test(haystack)) badges.push('Deletes files');
  if (/(invoke-webrequest|invoke-restmethod|downloadstring|start-bitstransfer)/.test(haystack)) badges.push('Downloads remote content');
  if (/(new-aduser|set-aduser|remove-aduser|disable-adaccount)/.test(haystack)) badges.push('Changes users');
  if (/(invoke-command|enter-pssession|new-pssession)/.test(haystack)) badges.push('Uses remoting');
  if (/(runas|administrator|elevat|uac)/.test(haystack)) badges.push('Requires admin review');

  return badges;
}

export function normalizeScriptSummary(raw: any): ScriptSummary {
  const analysis = raw?.analysis || {};
  const category = typeof raw?.category === 'object' && raw.category ? raw.category : null;
  const user = typeof raw?.user === 'object' && raw.user ? raw.user : null;
  const tags = normalizeTags(raw?.tags);
  const systemTags = tags.filter(tag => SYSTEM_TAGS.has(tag));
  const visibleTags = tags.filter(tag => !SYSTEM_TAGS.has(tag));
  const version = Number(raw?.version || 1);
  const fileHash = raw?.fileHash ?? raw?.file_hash;
  const archivedAt = raw?.archivedAt ?? raw?.archived_at ?? null;
  const deletedAt = raw?.deletedAt ?? raw?.deleted_at ?? null;
  const analysisCurrent = isAnalysisCurrent(raw, version, fileHash);
  const qualityScore = normalizeScore(analysis?.quality_score, analysis?.qualityScore, analysis?.code_quality_score, raw?.quality_score);
  const securityScore = normalizeScore(analysis?.security_score, analysis?.securityScore, raw?.security_score);
  const riskScore = normalizeScore(analysis?.risk_score, analysis?.riskScore, raw?.risk_score);
  const reviewStatus = raw?.reviewStatus ?? raw?.review_status ?? null;
  const isTestData = Boolean(raw?.isTestData ?? raw?.is_test_data) || systemTags.length > 0 || TEST_TITLE_PATTERN.test(String(raw?.title || ''));

  const lifecycleStatus: ScriptLifecycleStatus = deletedAt
    ? 'deleted'
    : archivedAt
      ? 'archived'
      : reviewStatus === 'approved'
        ? 'approved'
        : reviewStatus === 'retired'
          ? 'retired'
          : analysis && !analysisCurrent
            ? 'stale_analysis'
            : analysis && (qualityScore !== undefined || securityScore !== undefined)
              ? 'analyzed'
              : 'uploaded';

  return {
    id: String(raw?.id || ''),
    title: String(raw?.title || 'Untitled script'),
    description: String(raw?.description || raw?.analysis?.purpose || ''),
    content: raw?.content,
    author: String(user?.username || raw?.author || raw?.author_username || 'Unknown'),
    ownerId: raw?.userId ?? raw?.user_id ?? user?.id,
    createdAt: normalizeIsoDate(raw?.createdAt, raw?.created_at, raw?.dateCreated),
    updatedAt: normalizeIsoDate(raw?.updatedAt, raw?.updated_at, raw?.dateModified, raw?.createdAt, raw?.created_at),
    categoryId: raw?.categoryId ?? raw?.category_id ?? category?.id ?? null,
    categoryName: raw?.categoryName ?? raw?.category_name ?? category?.name ?? undefined,
    tags,
    visibleTags,
    systemTags,
    isPublic: Boolean(raw?.isPublic ?? raw?.is_public),
    version,
    executionCount: Number(raw?.executionCount ?? raw?.execution_count ?? raw?.executions ?? 0),
    securityScore,
    qualityScore,
    riskScore,
    fileHash,
    lifecycleStatus,
    analysisCurrent,
    analysisConfidence: analysis?.confidence ?? analysis?.executionSummary?.confidence ?? null,
    analysisCriteriaVersion: analysis?.criteriaVersion ?? analysis?.executionSummary?.criteria_version ?? null,
    isTestData,
    archivedAt,
    archivedBy: raw?.archivedBy ?? raw?.archived_by ?? null,
    archiveReason: raw?.archiveReason ?? raw?.archive_reason ?? null,
    reviewStatus,
    riskBadges: deriveRiskBadges(String(raw?.content || ''), analysis),
  };
}

export function normalizeScriptSummaries(rawScripts: any[] = []): ScriptSummary[] {
  return rawScripts.map(normalizeScriptSummary);
}
