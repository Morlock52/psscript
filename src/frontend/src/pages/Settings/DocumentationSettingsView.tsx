import React, { useMemo, useState } from 'react';
import { marked } from 'marked';
import SafeHtml from '../../components/SafeHtml';
import SettingsLayout from './SettingsLayout';

type Accent = 'cyan' | 'blue' | 'indigo' | 'violet' | 'slate';

export type TrainingDoc = {
  id: string;
  title: string;
  description: string;
  audience: string;
  audienceTags: string[];
  moduleType: string;
  status: string;
  icon: string;
  accent: Accent;
  featuredGraphic?: string;
  content: string;
};

type TocItem = {
  id: string;
  title: string;
};

export type VisualReference = {
  label: string;
  description: string;
  path: string;
};

type DocumentationSettingsViewProps = {
  docs: TrainingDoc[];
  visualReferences: VisualReference[];
  canvaCompanionUrl?: string;
  assetMap?: Record<string, string>;
};

const trainingMetrics = [
  { label: 'Training guides', value: '5', detail: 'role-based modules' },
  { label: 'Lifecycle stages', value: '7', detail: 'access through support' },
  { label: 'Reference assets', value: '18+', detail: 'screenshots, charts, diagrams' },
  { label: 'Production path', value: '1', detail: 'Netlify plus hosted Supabase' },
];

const learningPath = [
  { label: 'Access', detail: 'Sign in and approval' },
  { label: 'Upload', detail: 'Metadata and intake' },
  { label: 'Edit', detail: 'Save and VS Code export' },
  { label: 'Analyze', detail: 'Scores and requirements' },
  { label: 'Discover', detail: 'Search and docs' },
  { label: 'Operate', detail: 'Netlify and Supabase' },
  { label: 'Support', detail: 'Evidence and cleanup' },
];

const roleChips = ['Authors', 'Reviewers', 'Admins', 'Support', 'Trainers'];

const audienceTracks = [
  {
    role: 'Basic user',
    outcome: 'Find scripts, read documentation, and download approved reports without changing production data.',
    path: 'Dashboard -> Search -> Documentation -> Analysis PDF',
    evidence: 'Can locate a script, open the analysis, and confirm the export is a PDF.',
  },
  {
    role: 'New beginner',
    outcome: 'Upload a safe training script with complete title, category, tags, description, and owner context.',
    path: 'Training Guide -> Upload -> Script Detail -> Edit -> Analyze',
    evidence: 'Disposable script has complete metadata and a readable analysis result.',
  },
  {
    role: 'Senior engineer',
    outcome: 'Review quality, security, runtime requirements, dependencies, and accepted risk before reuse.',
    path: 'Lifecycle Suite -> Script Detail -> Analysis -> Search -> Support',
    evidence: 'Findings are triaged, required modules are known, and remediation or risk acceptance is documented.',
  },
  {
    role: 'Admin or support',
    outcome: 'Operate access, data maintenance, delete checks, Netlify evidence, and Supabase evidence safely.',
    path: 'Support Guide -> Settings -> Data Maintenance -> Function logs',
    evidence: 'Backup-first checks and support notes include route, role, script id, deploy id, and log window.',
  },
  {
    role: 'C-level management',
    outcome: 'Understand governance posture, business value, risk controls, and production operating boundaries.',
    path: 'Executive summary -> Readiness Scorecard -> Lifecycle Map -> Escalation Ladder',
    evidence: 'Can explain where scripts live, who approves changes, and how risk is reported.',
  },
];

const accentClasses: Record<Accent, { card: string; badge: string; active: string; ring: string }> = {
  cyan: {
    card: 'border-cyan-200 bg-cyan-50/80 dark:border-cyan-800 dark:bg-cyan-950/30',
    badge: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/70 dark:text-cyan-100',
    active: 'border-cyan-400 bg-cyan-50 shadow-sm dark:border-cyan-500 dark:bg-cyan-950/40',
    ring: 'ring-cyan-500/30',
  },
  blue: {
    card: 'border-blue-200 bg-blue-50/80 dark:border-blue-800 dark:bg-blue-950/30',
    badge: 'bg-blue-100 text-blue-800 dark:bg-blue-900/70 dark:text-blue-100',
    active: 'border-blue-400 bg-blue-50 shadow-sm dark:border-blue-500 dark:bg-blue-950/40',
    ring: 'ring-blue-500/30',
  },
  indigo: {
    card: 'border-indigo-200 bg-indigo-50/80 dark:border-indigo-800 dark:bg-indigo-950/30',
    badge: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/70 dark:text-indigo-100',
    active: 'border-indigo-400 bg-indigo-50 shadow-sm dark:border-indigo-500 dark:bg-indigo-950/40',
    ring: 'ring-indigo-500/30',
  },
  violet: {
    card: 'border-violet-200 bg-violet-50/80 dark:border-violet-800 dark:bg-violet-950/30',
    badge: 'bg-violet-100 text-violet-800 dark:bg-violet-900/70 dark:text-violet-100',
    active: 'border-violet-400 bg-violet-50 shadow-sm dark:border-violet-500 dark:bg-violet-950/40',
    ring: 'ring-violet-500/30',
  },
  slate: {
    card: 'border-slate-200 bg-slate-50/80 dark:border-slate-700 dark:bg-slate-900/60',
    badge: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-100',
    active: 'border-slate-400 bg-slate-50 shadow-sm dark:border-slate-500 dark:bg-slate-900',
    ring: 'ring-slate-500/30',
  },
};

const iconPaths: Record<string, string> = {
  flow: 'M4 7h7m0 0l-2-2m2 2L9 9m4 8h7m0 0l-2-2m2 2l-2 2M5 17h4a2 2 0 002-2v-1a2 2 0 012-2h6',
  book: 'M12 6.75A5.25 5.25 0 006.75 1.5H4.5A1.5 1.5 0 003 3v15.75a1.5 1.5 0 001.5 1.5h2.25A5.25 5.25 0 0112 22.5m0-15.75a5.25 5.25 0 015.25-5.25h2.25A1.5 1.5 0 0121 3v15.75a1.5 1.5 0 01-1.5 1.5h-2.25A5.25 5.25 0 0012 22.5m0-15.75v15.75',
  image: 'M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-7-6h.01M4 5h16v14H4V5z',
  support: 'M18 10a6 6 0 10-12 0v4a3 3 0 003 3h1m8-7v4a3 3 0 01-3 3h-1m-4 0h4m-2 0v3',
  check: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
};

const normalizeAssetKey = (path: string) =>
  path
    .replace(/^\.?\//, '')
    .replace(/^(\.\.\/)+/, '')
    .replace(/^docs\//, '');

const normalizeMarkdown = (content: string, assetMap: Record<string, string>) =>
  content.replace(/(!\[[^\]]*]\()([^)\s]+)(\))/g, (match, prefix, rawPath, suffix) => {
    const mapped = assetMap[normalizeAssetKey(rawPath)];
    return mapped ? `${prefix}${mapped}${suffix}` : match;
  });

const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

const escapeAttribute = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

const estimateReadingTime = (content: string) => {
  const words = content.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 220));
};

const buildToc = (content: string): TocItem[] =>
  content
    .split('\n')
    .filter((line) => /^#{2,3}\s+/.test(line))
    .slice(0, 12)
    .map((line) => {
      const title = line.replace(/^#{2,3}\s+/, '').replace(/\s+#*$/, '').trim();
      return { id: slugify(title), title };
    });

const IconBadge: React.FC<{ doc: TrainingDoc }> = ({ doc }) => (
  <span
    className={`inline-flex h-10 w-10 items-center justify-center rounded-xl ${accentClasses[doc.accent].badge}`}
    aria-hidden="true"
  >
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d={iconPaths[doc.icon]} />
    </svg>
  </span>
);

const DocumentationSettingsView: React.FC<DocumentationSettingsViewProps> = ({
  docs,
  visualReferences,
  canvaCompanionUrl = '',
  assetMap = {},
}) => {
  const [selectedId, setSelectedId] = useState(docs[0].id);
  const selectedDoc = docs.find((doc) => doc.id === selectedId) ?? docs[0];
  const selectedAccent = accentClasses[selectedDoc.accent];

  const renderedHtml = useMemo(() => {
    const renderer = new marked.Renderer();
    renderer.heading = (text, level, raw) => `<h${level} id="${slugify(raw)}">${text}</h${level}>\n`;
    renderer.image = (href, title, text) => {
      const safeHref = escapeAttribute(href ?? '');
      const safeAlt = escapeAttribute(text ?? 'Training visual');
      const safeTitle = title ? ` title="${escapeAttribute(title)}"` : '';
      return `<figure class="not-prose my-6 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-950"><img src="${safeHref}" alt="${safeAlt}"${safeTitle} class="w-full bg-gray-50 object-contain dark:bg-gray-950" loading="lazy" /><figcaption class="border-t border-gray-200 px-4 py-3 text-sm font-medium text-gray-600 dark:border-gray-700 dark:text-gray-300">${safeAlt}</figcaption></figure>`;
    };
    const html = marked.parse(normalizeMarkdown(selectedDoc.content, assetMap), {
      gfm: true,
      breaks: false,
      renderer,
    });
    return typeof html === 'string' ? html : '';
  }, [assetMap, selectedDoc]);

  const selectedToc = useMemo(() => buildToc(selectedDoc.content), [selectedDoc]);
  const readingTime = useMemo(() => estimateReadingTime(selectedDoc.content), [selectedDoc]);

  return (
    <SettingsLayout
      title="Docs & Training"
      description="Read the current lifecycle, training, screenshot, and support documents from inside Settings."
    >
      <div className="space-y-6">
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-950 text-white shadow-sm dark:border-slate-700">
          <div className="grid gap-6 p-4 sm:p-6 xl:grid-cols-[minmax(0,1fr)_300px]">
            <div>
              <div className="mb-4 flex flex-wrap gap-2">
                {roleChips.map((role) => (
                  <span key={role} className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-medium text-slate-100">
                    {role}
                  </span>
                ))}
              </div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-200">
                Hosted training library
              </p>
              <h2 className="mt-2 max-w-3xl text-3xl font-black leading-tight sm:text-4xl">
                PSScript Training & Support Library
              </h2>
              <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-300 sm:text-base">
                A technical enablement library for the current Netlify and hosted Supabase operating model,
                with role-based procedures, lifecycle controls, screenshots, diagrams, and support evidence.
              </p>
              <div className="mt-6 grid gap-3 sm:grid-cols-2 2xl:grid-cols-4">
                {trainingMetrics.map((metric) => (
                  <div key={metric.label} className="rounded-xl border border-white/10 bg-white/10 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-cyan-100">{metric.label}</p>
                    <p className="mt-2 text-3xl font-black text-white">{metric.value}</p>
                    <p className="mt-1 text-xs leading-5 text-slate-300">{metric.detail}</p>
                  </div>
                ))}
              </div>
              <div className="mt-5 flex flex-wrap gap-3 text-sm">
                <a
                  href="#training-reader"
                  className="rounded-lg bg-cyan-300 px-4 py-2 font-semibold text-slate-950 transition hover:bg-cyan-200"
                >
                  Read selected guide
                </a>
                {canvaCompanionUrl && (
                  <a
                    href={canvaCompanionUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-lg border border-white/20 px-4 py-2 font-semibold text-white transition hover:bg-white/10"
                  >
                    Open Canva Training Handout
                  </a>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-cyan-100">Operating model</p>
              <div className="mt-4 space-y-3 text-sm text-slate-200">
                <div className="rounded-xl bg-slate-900/70 p-3">
                  <span className="font-semibold text-white">UI/API:</span> Netlify production deploy
                </div>
                <div className="rounded-xl bg-slate-900/70 p-3">
                  <span className="font-semibold text-white">Data:</span> hosted Supabase Auth/Postgres
                </div>
                <div className="rounded-xl bg-slate-900/70 p-3">
                  <span className="font-semibold text-white">Training:</span> approved accounts, no local database
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
          <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-blue-600 dark:text-blue-300">
                Learning path
              </p>
              <h2 className="text-xl font-bold text-gray-950 dark:text-white">Operational script lifecycle</h2>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Access through support evidence, ordered for business and technical handoffs.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-7">
            {learningPath.map((step, index) => (
              <div
                key={step.label}
                className="rounded-xl border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-950/50"
              >
                <span className="text-xs font-semibold text-blue-600 dark:text-blue-300">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <h3 className="mt-2 text-sm font-bold text-gray-950 dark:text-white">{step.label}</h3>
                <p className="mt-1 text-xs leading-5 text-gray-500 dark:text-gray-400">{step.detail}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
          <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-blue-600 dark:text-blue-300">
                Audience tracks
              </p>
              <h2 className="text-xl font-bold text-gray-950 dark:text-white">What each learner should be able to do</h2>
            </div>
            <p className="max-w-2xl text-sm leading-6 text-gray-500 dark:text-gray-400">
              Training is grouped by outcome so new users, engineers, support, and leadership can learn the same system at the right depth.
            </p>
          </div>
          <div className="grid gap-3 xl:grid-cols-5">
            {audienceTracks.map((track) => (
              <article
                key={track.role}
                className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-950/50"
              >
                <h3 className="text-base font-bold text-gray-950 dark:text-white">{track.role}</h3>
                <p className="mt-2 text-sm leading-6 text-gray-600 dark:text-gray-300">{track.outcome}</p>
                <div className="mt-3 border-t border-gray-200 pt-3 text-xs leading-5 text-gray-500 dark:border-gray-700 dark:text-gray-400">
                  <p><span className="font-semibold text-gray-700 dark:text-gray-200">Path:</span> {track.path}</p>
                  <p className="mt-1"><span className="font-semibold text-gray-700 dark:text-gray-200">Proof:</span> {track.evidence}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section aria-label="Training document library">
          <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-blue-600 dark:text-blue-300">
                Document library
              </p>
              <h2 className="text-xl font-bold text-gray-950 dark:text-white">Choose a guide</h2>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Five current guides, organized for onboarding, review, operations, and support.</p>
          </div>
          <div className="grid gap-3 xl:grid-cols-3">
            {docs.map((doc) => {
              const isActive = doc.id === selectedId;
              const accent = accentClasses[doc.accent];
              return (
                <button
                  key={doc.id}
                  type="button"
                  onClick={() => setSelectedId(doc.id)}
                  className={`rounded-2xl border p-4 text-left transition hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-4 ${
                    isActive ? accent.active : `${accent.card} hover:border-blue-300 dark:hover:border-blue-600`
                  } ${accent.ring}`}
                  aria-pressed={isActive}
                >
                  <div className="flex gap-3">
                    <IconBadge doc={doc} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded-full px-2 py-1 text-xs font-semibold ${accent.badge}`}>
                          {doc.moduleType}
                        </span>
                        <span className="rounded-full bg-white/70 px-2 py-1 text-xs font-medium text-gray-600 dark:bg-gray-950/60 dark:text-gray-300">
                          {estimateReadingTime(doc.content)} min read
                        </span>
                        <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-100">
                          {doc.status}
                        </span>
                      </div>
                      <h3 className="mt-3 text-lg font-bold text-gray-950 dark:text-white">{doc.title}</h3>
                      <p className="mt-1 text-sm leading-6 text-gray-600 dark:text-gray-300">{doc.description}</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {doc.audienceTags.map((tag) => (
                          <span
                            key={tag}
                            className="rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-700 dark:bg-gray-800 dark:text-gray-200"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        <section
          id="training-reader"
          className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900"
        >
          <div className={`border-b border-gray-200 p-4 dark:border-gray-700 sm:p-5 ${selectedAccent.card}`}>
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_220px]">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-3">
                  <IconBadge doc={selectedDoc} />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                      Selected document
                    </p>
                    <h2 data-testid="training-reader-title" className="mt-1 text-2xl font-black leading-tight text-gray-950 dark:text-white">
                      {selectedDoc.title}
                    </h2>
                  </div>
                </div>
                <p className="mt-3 max-w-3xl text-base leading-7 text-gray-700 dark:text-gray-200">{selectedDoc.description}</p>
              </div>

              <dl className="grid grid-cols-2 gap-3 rounded-2xl border border-white/50 bg-white/70 p-3 text-sm dark:border-gray-700 dark:bg-gray-950/50 xl:grid-cols-1">
                <div>
                  <dt className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Audience</dt>
                  <dd className="mt-1 font-semibold text-gray-900 dark:text-white">{selectedDoc.audience}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Reading</dt>
                  <dd className="mt-1 font-semibold text-gray-900 dark:text-white">{readingTime} min</dd>
                </div>
              </dl>
            </div>

            {selectedToc.length > 0 && (
              <nav className="mt-4" aria-label={`${selectedDoc.title} contents`}>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  Contents
                </p>
                <ol className="mt-2 flex gap-2 overflow-x-auto pb-1">
                  {selectedToc.map((item) => (
                    <li key={item.id} className="shrink-0">
                      <a
                        href={`#${item.id}`}
                        className="block max-w-[16rem] truncate rounded-full border border-gray-200 bg-white/80 px-3 py-1.5 text-sm font-medium text-gray-700 hover:border-blue-300 hover:text-blue-700 dark:border-gray-700 dark:bg-gray-950/60 dark:text-gray-200 dark:hover:border-blue-500 dark:hover:text-blue-200"
                        title={item.title}
                      >
                        {item.title}
                      </a>
                    </li>
                  ))}
                </ol>
              </nav>
            )}
          </div>

          <article className="min-w-0 px-3 py-5 sm:px-5 lg:px-6 xl:px-8">
            <div className="mx-auto max-w-[88ch]">
              {selectedDoc.featuredGraphic && (
                <img
                  src={selectedDoc.featuredGraphic}
                  alt={`${selectedDoc.title} featured graphic`}
                  className="mb-6 aspect-[16/7] w-full rounded-2xl border border-gray-200 bg-gray-50 object-contain dark:border-gray-700 dark:bg-gray-950"
                />
              )}
              <SafeHtml
                html={renderedHtml}
                variant="markdown"
                className="prose max-w-none break-words text-base leading-7 text-gray-800 [overflow-wrap:anywhere] dark:prose-invert dark:text-gray-100 prose-headings:scroll-mt-24 prose-headings:leading-tight prose-p:leading-7 prose-li:leading-7 prose-a:text-blue-600 prose-a:break-words dark:prose-a:text-blue-300 prose-table:block prose-table:overflow-x-auto prose-table:text-sm prose-th:whitespace-nowrap prose-td:align-top prose-pre:overflow-x-auto prose-pre:rounded-xl prose-pre:border prose-pre:border-gray-200 dark:prose-pre:border-gray-700"
              />
            </div>
          </article>
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
          <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-blue-600 dark:text-blue-300">
                Quick visual references
              </p>
              <h2 className="text-xl font-bold text-gray-950 dark:text-white">Screenshots used in the selected guide</h2>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Large, readable previews for training and support handoff.</p>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            {visualReferences.filter((visual) => visual.label.includes('Screenshot')).slice(0, 4).map((visual) => (
              <a
                key={`quick-${visual.path}`}
                href={visual.path}
                target="_blank"
                rel="noopener noreferrer"
                className="group rounded-2xl border border-gray-200 bg-gray-50 p-3 transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md dark:border-gray-700 dark:bg-gray-950/60 dark:hover:border-blue-600"
              >
                <img
                  src={visual.path}
                  alt={`${visual.label} quick preview`}
                  className="aspect-video w-full rounded-xl border border-gray-100 bg-gray-50 object-contain dark:border-gray-800 dark:bg-gray-950"
                />
                <div className="mt-3">
                  <h3 className="text-base font-bold text-gray-950 group-hover:text-blue-700 dark:text-white dark:group-hover:text-blue-200">
                    {visual.label}
                  </h3>
                  <p className="mt-1 text-sm leading-6 text-gray-600 dark:text-gray-300">{visual.description}</p>
                </div>
              </a>
            ))}
          </div>
        </section>

        <section>
          <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-blue-600 dark:text-blue-300">
                Graphic references
              </p>
              <h2 className="text-xl font-bold text-gray-950 dark:text-white">Technical references and screenshots</h2>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Use these assets in SOPs, support notes, onboarding, and operational reviews.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {visualReferences.map((visual) => (
              <a
                key={visual.path}
                href={visual.path}
                target="_blank"
                rel="noopener noreferrer"
                className="group rounded-2xl border border-gray-200 bg-white p-3 transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md dark:border-gray-700 dark:bg-gray-900 dark:hover:border-blue-600"
              >
                <img
                  src={visual.path}
                  alt={visual.label}
                  className="aspect-video w-full rounded-xl border border-gray-100 bg-gray-50 object-contain dark:border-gray-800 dark:bg-gray-950"
                />
                <div className="mt-3">
                  <h3 className="text-base font-bold text-gray-950 group-hover:text-blue-700 dark:text-white dark:group-hover:text-blue-200">
                    {visual.label}
                  </h3>
                  <p className="mt-1 text-sm leading-6 text-gray-600 dark:text-gray-300">{visual.description}</p>
                  <span className="mt-3 inline-flex text-sm font-semibold text-blue-600 dark:text-blue-300">
                    View full graphic
                  </span>
                </div>
              </a>
            ))}
          </div>
        </section>
      </div>
    </SettingsLayout>
  );
};

export default DocumentationSettingsView;
