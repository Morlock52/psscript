import React, { useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import documentationApi from '../services/documentationApi';
import commandInsightsApi from '../services/commandInsightsApi';
import { explainWithAgent } from '../api/aiAgent';
import { useCommandExplain } from '../contexts/CommandExplainContext';
import {
  detectCommandFlags,
  extractFirstCommandLine,
  parsePowerShellCommand,
  FlagFinding,
  ParsedPowerShellCommand,
} from '../utils/powershellCommandUtils';

const severityStyles: Record<string, { badge: string; border: string }> = {
  info: { badge: 'bg-blue-900/40 text-blue-200 border-blue-700/40', border: 'border-blue-700/30' },
  warn: { badge: 'bg-amber-900/40 text-amber-200 border-amber-700/40', border: 'border-amber-700/30' },
  danger: { badge: 'bg-red-900/40 text-red-200 border-red-700/40', border: 'border-red-700/30' },
};

type SectionVariant = 'neutral' | 'green' | 'amber' | 'blue' | 'purple';

const sectionVariantClass: Record<SectionVariant, string> = {
  neutral: 'bg-gray-900/40 border-gray-700/50',
  green: 'bg-gradient-to-r from-green-900/25 to-emerald-900/10 border-green-600/20',
  amber: 'bg-gradient-to-r from-amber-900/20 to-orange-900/10 border-amber-600/20',
  blue: 'bg-gradient-to-r from-blue-900/20 to-cyan-900/10 border-blue-600/20',
  purple: 'bg-gradient-to-r from-purple-900/25 to-indigo-900/10 border-purple-600/20',
};

function Section({
  title,
  icon,
  children,
  className,
  variant = 'neutral',
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  variant?: SectionVariant;
}) {
  return (
    <div className={`rounded-2xl border overflow-hidden ${sectionVariantClass[variant]} ${className || ''}`}>
      <div className="flex items-center gap-2 px-5 py-4 bg-gray-950/20 border-b border-gray-700/30">
        {icon}
        <h3 className="text-xs font-semibold text-gray-300 uppercase tracking-wider">{title}</h3>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function Chip({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-lg font-mono text-xs border ${className || ''}`}>
      {children}
    </span>
  );
}

function formatParam(p: { name: string; value: string | null }) {
  if (!p.value) return p.name;
  return `${p.name} ${p.value}`;
}

export default function CommandExplainDrawer() {
  const { open, command, source, close } = useCommandExplain();
  const navigate = useNavigate();
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

  const parsed: ParsedPowerShellCommand | null = useMemo(() => {
    if (!open || !command) return null;
    const cmdLine = extractFirstCommandLine(command) || command;
    return parsePowerShellCommand(cmdLine);
  }, [open, command]);

  const flags: FlagFinding[] = useMemo(() => (parsed ? detectCommandFlags(parsed) : []), [parsed]);

  const cmdletForDocs = parsed?.cmdlet || (command && command.split(/\s+/)[0]) || '';

  const insightQuery = useQuery({
    queryKey: ['commandInsight', cmdletForDocs],
    enabled: open && !!cmdletForDocs && /^[A-Za-z]+-[A-Za-z]+$/.test(cmdletForDocs),
    queryFn: async () => commandInsightsApi.getInsight(cmdletForDocs),
    staleTime: 5 * 60_000,
    retry: 0,
  });

  const docsQuery = useQuery({
    queryKey: ['commandExplainDocs', cmdletForDocs],
    enabled: open && !!cmdletForDocs,
    queryFn: async () => {
      const res = await documentationApi.searchDocumentation({
        query: cmdletForDocs,
        limit: 5,
        sortBy: 'relevance',
      });
      return res.items || [];
    },
    staleTime: 60_000,
    retry: 0,
  });

  const detailedQuery = useQuery({
    queryKey: ['commandExplainAI', 'detailed', command],
    enabled: open && !!command,
    queryFn: async () => {
      return explainWithAgent(command, 'detailed');
    },
    staleTime: 0,
    retry: 0,
  });

  const securityQuery = useQuery({
    queryKey: ['commandExplainAI', 'security', command],
    enabled: open && !!command && flags.length > 0,
    queryFn: async () => {
      return explainWithAgent(command, 'security');
    },
    staleTime: 0,
    retry: 0,
  });

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, close]);

  useEffect(() => {
    if (open) {
      setTimeout(() => closeButtonRef.current?.focus(), 0);
    }
  }, [open]);

  if (!open) return null;

  const enrichedFlags = (insightQuery.data && Array.isArray(insightQuery.data.flags)) ? insightQuery.data.flags : [];
  const hasAnyFlags = enrichedFlags.length > 0 || flags.length > 0;

  return (
    <div className="fixed inset-0 z-[10000]" role="dialog" aria-modal="true" aria-label="Explain Command">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={close} />

      {/* Drawer */}
      <div className="absolute right-3 top-3 bottom-3 w-[min(680px,calc(100%-1.5rem))] bg-gray-900/95 border border-gray-700/70 shadow-2xl flex flex-col rounded-3xl overflow-hidden">
        {/* Colored header (matches the Documentation modal vibe) */}
        <div className="relative px-6 py-5 bg-gradient-to-r from-emerald-700 via-green-700 to-emerald-600">
          <div className="absolute inset-0 opacity-25 pointer-events-none bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.35),transparent_45%),radial-gradient(circle_at_80%_0%,rgba(255,255,255,0.25),transparent_40%)]" />
          <div className="relative flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-semibold text-white/90 uppercase tracking-wider bg-white/20 px-2 py-1 rounded">
                  Explain
                </span>
                {source !== 'unknown' && (
                  <span className="text-xs text-white/80 bg-black/20 px-2 py-1 rounded">
                    {source}
                  </span>
                )}
              </div>
              <div className="font-mono text-sm text-white/95 break-words">
                {parsed?.original || command}
              </div>
              {parsed?.cmdlet && (
                <div className="mt-3 flex flex-wrap gap-2">
                  <Chip className="bg-black/20 text-white border-white/25">
                    {parsed.cmdlet}
                  </Chip>
                  {parsed.pipelineSegments.length > 1 && (
                    <Chip className="bg-black/15 text-white/90 border-white/20">
                      Pipeline: {parsed.pipelineSegments.length} segments
                    </Chip>
                  )}
                </div>
              )}
            </div>
            <button
              ref={closeButtonRef}
              type="button"
              onClick={close}
              className="shrink-0 rounded-xl px-3 py-2 bg-black/20 hover:bg-black/30 text-white border border-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
              aria-label="Close"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5 bg-gradient-to-b from-gray-900/95 to-gray-950/95">
          <Section title="Breakdown" icon={<span className="text-emerald-200">⌁</span>} variant="green">
            {!parsed ? (
              <div className="text-gray-300 text-sm">No command to parse.</div>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <div className="text-xs text-gray-400 mb-1">Cmdlet</div>
                    <div className="font-mono text-sm text-white">{parsed.cmdlet || 'Unknown'}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-400 mb-1">Specials</div>
                    <div className="flex flex-wrap gap-2">
                      {parsed.specials.length ? (
                        parsed.specials.map((s) => (
                          <Chip key={s} className="bg-gray-800/60 text-gray-200 border-gray-700/40">{s}</Chip>
                        ))
                      ) : (
                        <span className="text-sm text-gray-300">None</span>
                      )}
                    </div>
                  </div>
                </div>

                <div>
                  <div className="text-xs text-gray-400 mb-2">Parameters</div>
                  {parsed.parameters.length ? (
                    <div className="flex flex-wrap gap-2">
                      {parsed.parameters.map((p, idx) => (
                        <Chip
                          key={`${p.name}-${idx}`}
                          className="bg-gray-800/60 text-gray-100 border-gray-700/50"
                        >
                          {formatParam(p)}
                        </Chip>
                      ))}
                    </div>
                  ) : (
                    <div className="text-sm text-gray-300">No parameters detected.</div>
                  )}
                </div>

                <div>
                  <div className="text-xs text-gray-400 mb-2">Positional Args</div>
                  {parsed.positionalArgs.length ? (
                    <div className="flex flex-wrap gap-2">
                      {parsed.positionalArgs.map((a, idx) => (
                        <Chip key={`${a}-${idx}`} className="bg-gray-800/60 text-gray-100 border-gray-700/50">
                          {a}
                        </Chip>
                      ))}
                    </div>
                  ) : (
                    <div className="text-sm text-gray-300">None</div>
                  )}
                </div>

                {parsed.pipelineSegments.length > 1 && (
                  <div>
                    <div className="text-xs text-gray-400 mb-2">Pipeline Segments</div>
                    <ol className="space-y-2">
                      {parsed.pipelineSegments.map((seg, idx) => (
                        <li key={`${seg}-${idx}`} className="flex gap-3 items-start">
                          <span className="text-gray-500 font-mono text-xs mt-0.5">{idx + 1}.</span>
                          <pre className="flex-1 whitespace-pre-wrap text-sm text-gray-200 font-mono bg-gray-950/50 border border-gray-800 rounded-lg p-2">
                            {seg}
                          </pre>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
              </div>
            )}
          </Section>

          <Section title="Cmdlet Card" icon={<span className="text-emerald-200">▣</span>} variant="neutral">
            {insightQuery.isLoading ? (
              <div className="text-sm text-gray-300">
                Loading enriched cmdlet details…
                <div className="mt-3 h-2 rounded-full bg-gray-800 overflow-hidden">
                  <div className="h-2 w-1/3 bg-emerald-500 animate-pulse" />
                </div>
              </div>
            ) : insightQuery.isError ? (
              <div className="text-sm text-gray-300">
                Enriched cmdlet details unavailable right now.
              </div>
            ) : !insightQuery.data ? (
              <div className="text-sm text-gray-300">
                No enriched card found for <span className="font-mono text-white">{cmdletForDocs}</span>.
                <div className="mt-2 text-xs text-gray-400">
                  Run <span className="font-semibold text-gray-200">Command Enrichment</span> in <span className="font-semibold text-gray-200">Documentation Crawl</span> to backfill all cmdlets.
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {insightQuery.data.description && (
                  <div>
                    <div className="text-xs text-gray-400 mb-1">What it does</div>
                    <div className="text-sm text-gray-100 whitespace-pre-wrap">{insightQuery.data.description}</div>
                  </div>
                )}

                {insightQuery.data.howToUse && (
                  <div>
                    <div className="text-xs text-gray-400 mb-1">How to use</div>
                    <pre className="whitespace-pre-wrap text-sm text-gray-200 font-mono bg-gray-950/50 border border-gray-800 rounded-lg p-3">
                      {insightQuery.data.howToUse}
                    </pre>
                  </div>
                )}

                {Array.isArray(insightQuery.data.keyParameters) && insightQuery.data.keyParameters.length > 0 && (
                  <div>
                    <div className="text-xs text-gray-400 mb-2">Key parameters</div>
                    <div className="space-y-2">
                      {insightQuery.data.keyParameters.slice(0, 8).map((p, idx) => (
                        <div key={`${p?.name || 'param'}-${idx}`} className="rounded-xl border border-gray-800 bg-gray-950/30 p-3">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Chip className="bg-gray-900/60 text-gray-100 border-gray-700/50">
                              {p?.name || '(unknown)'}
                            </Chip>
                            {p?.dangerous && (
                              <span className="text-[11px] px-2 py-0.5 rounded border bg-red-900/30 text-red-200 border-red-700/40">
                                RISKY
                              </span>
                            )}
                            {p?.required && (
                              <span className="text-[11px] px-2 py-0.5 rounded border bg-blue-900/30 text-blue-200 border-blue-700/40">
                                REQUIRED
                              </span>
                            )}
                          </div>
                          {p?.description && <div className="mt-2 text-sm text-gray-200">{p.description}</div>}
                          {p?.notes && <div className="mt-2 text-xs text-gray-400">{p.notes}</div>}
                          {p?.example && (
                            <pre className="mt-2 whitespace-pre-wrap text-xs text-gray-200 font-mono bg-gray-950/50 border border-gray-800 rounded-lg p-2">
                              {p.example}
                            </pre>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {Array.isArray(insightQuery.data.useCases) && insightQuery.data.useCases.length > 0 && (
                  <div>
                    <div className="text-xs text-gray-400 mb-2">Use cases</div>
                    <div className="space-y-2">
                      {insightQuery.data.useCases.slice(0, 6).map((u, idx) => (
                        <div key={`${u?.title || 'usecase'}-${idx}`} className="rounded-xl border border-gray-800 bg-gray-950/30 p-3">
                          <div className="text-sm font-semibold text-white">{u?.title || 'Use case'}</div>
                          {u?.scenario && <div className="mt-1 text-sm text-gray-200">{u.scenario}</div>}
                          {u?.exampleCommand && (
                            <pre className="mt-2 whitespace-pre-wrap text-xs text-gray-200 font-mono bg-gray-950/50 border border-gray-800 rounded-lg p-2">
                              {u.exampleCommand}
                            </pre>
                          )}
                          {u?.sampleOutput && (
                            <details className="mt-2">
                              <summary className="cursor-pointer text-xs text-gray-400 hover:text-gray-300">Sample output</summary>
                              <pre className="mt-2 whitespace-pre-wrap text-xs text-gray-200 font-mono bg-gray-950/50 border border-gray-800 rounded-lg p-2">
                                {u.sampleOutput}
                              </pre>
                            </details>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {Array.isArray(insightQuery.data.examples) && insightQuery.data.examples.length > 0 && (
                  <div>
                    <div className="text-xs text-gray-400 mb-2">Examples</div>
                    <div className="space-y-2">
                      {insightQuery.data.examples.slice(0, 6).map((ex, idx) => (
                        <div key={`${ex?.title || 'example'}-${idx}`} className="rounded-xl border border-gray-800 bg-gray-950/30 p-3">
                          <div className="text-sm font-semibold text-white">{ex?.title || 'Example'}</div>
                          {ex?.command && (
                            <pre className="mt-2 whitespace-pre-wrap text-xs text-gray-200 font-mono bg-gray-950/50 border border-gray-800 rounded-lg p-2">
                              {ex.command}
                            </pre>
                          )}
                          {ex?.explanation && <div className="mt-2 text-sm text-gray-200">{ex.explanation}</div>}
                          {ex?.sampleOutput && (
                            <details className="mt-2">
                              <summary className="cursor-pointer text-xs text-gray-400 hover:text-gray-300">Sample output</summary>
                              <pre className="mt-2 whitespace-pre-wrap text-xs text-gray-200 font-mono bg-gray-950/50 border border-gray-800 rounded-lg p-2">
                                {ex.sampleOutput}
                              </pre>
                            </details>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {insightQuery.data.sampleOutput && (
                  <div>
                    <div className="text-xs text-gray-400 mb-1">General sample output</div>
                    <pre className="whitespace-pre-wrap text-xs text-gray-200 font-mono bg-gray-950/50 border border-gray-800 rounded-lg p-3">
                      {insightQuery.data.sampleOutput}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </Section>

          <Section
            title="Flags"
            icon={<span className="text-amber-300">⚑</span>}
            className={hasAnyFlags ? '' : 'opacity-90'}
            variant="amber"
          >
            {!hasAnyFlags ? (
              <div className="text-sm text-gray-300">No obvious risky patterns detected.</div>
            ) : (
              <div className="space-y-3">
                {enrichedFlags.map((f: any, idx: number) => {
                  const sev = (f?.severity || 'info').toLowerCase();
                  const s = severityStyles[sev] || severityStyles.info;
                  return (
                    <div key={`enriched-${idx}`} className={`rounded-xl border ${s.border} bg-gray-950/30 p-3`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className={`text-[11px] px-2 py-0.5 rounded border ${s.badge}`}>
                              {String(sev).toUpperCase()}
                            </span>
                            <div className="text-sm font-semibold text-white">{f?.pattern || 'Flag'}</div>
                          </div>
                          {f?.reason && <div className="mt-2 text-sm text-gray-200">{f.reason}</div>}
                          {f?.saferAlternative && (
                            <div className="mt-2 text-sm text-emerald-200/90">
                              Safer: <span className="text-emerald-100">{f.saferAlternative}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
                {flags.map((f) => {
                  const s = severityStyles[f.severity] || severityStyles.info;
                  return (
                    <div key={f.id} className={`rounded-xl border ${s.border} bg-gray-950/30 p-3`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className={`text-[11px] px-2 py-0.5 rounded border ${s.badge}`}>{f.severity.toUpperCase()}</span>
                            <div className="text-sm font-semibold text-white">{f.title}</div>
                          </div>
                          <div className="mt-2 text-sm text-gray-200">{f.reason}</div>
                          {f.saferAlternative && (
                            <div className="mt-2 text-sm text-emerald-200/90">
                              Safer: <span className="text-emerald-100">{f.saferAlternative}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Section>

          <Section title="Docs" icon={<span className="text-blue-200">⎘</span>} variant="blue">
            <div className="flex flex-wrap gap-2 mb-3">
              <button
                type="button"
                onClick={() => navigate(`/documentation?q=${encodeURIComponent(cmdletForDocs)}`)}
                className="px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm"
              >
                Search Internal Docs
              </button>
              {cmdletForDocs && (
                <a
                  href={`https://learn.microsoft.com/en-us/search/?terms=${encodeURIComponent(cmdletForDocs)}&category=Documentation`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-100 text-sm border border-gray-700/60"
                >
                  Search Microsoft Learn
                </a>
              )}
            </div>

            {docsQuery.isLoading ? (
              <div className="text-sm text-gray-300">Searching docs…</div>
            ) : docsQuery.isError ? (
              <div className="text-sm text-gray-300">Docs search unavailable.</div>
            ) : (docsQuery.data && docsQuery.data.length > 0) ? (
              <ul className="space-y-2">
                {docsQuery.data.map((item: any) => (
                  <li key={item.id} className="rounded-lg border border-gray-800 bg-gray-950/30 p-3">
                    <div className="text-sm font-semibold text-white">{item.title}</div>
                    {item.summary && <div className="mt-1 text-sm text-gray-300 line-clamp-2">{item.summary}</div>}
                    <div className="mt-2 text-xs text-gray-500">
                      {item.source} · {new Date(item.crawledAt).toLocaleDateString()}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="text-sm text-gray-300">No internal docs matches found.</div>
            )}

            {insightQuery.data?.docsUrls?.length ? (
              <div className="mt-4 pt-4 border-t border-gray-800">
                <div className="text-xs uppercase tracking-wider text-gray-400 mb-2">Curated links</div>
                <ul className="space-y-2">
                  {insightQuery.data.docsUrls.slice(0, 6).map((d, idx) => (
                    <li key={`${d.url || 'doc'}-${idx}`} className="text-sm">
                      <a
                        href={d.url || '#'}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-200 hover:text-blue-100 underline decoration-blue-400/40"
                      >
                        {d.title || d.url}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </Section>

          <Section title="AI Explain" icon={<span className="text-purple-200">✦</span>} variant="purple">
            {detailedQuery.isLoading ? (
              <div className="text-sm text-gray-300">
                Explaining with AI…
                <div className="mt-3 h-2 rounded-full bg-gray-800 overflow-hidden">
                  <div className="h-2 w-1/3 bg-purple-500 animate-pulse" />
                </div>
              </div>
            ) : detailedQuery.isError ? (
              <div className="text-sm text-gray-300">
                AI explain failed. (You can still use Breakdown + Flags.)
              </div>
            ) : (
              <div className="text-sm text-gray-100 whitespace-pre-wrap">
                {detailedQuery.data || 'No AI output.'}
              </div>
            )}

            {flags.length > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-800">
                <div className="text-xs uppercase tracking-wider text-gray-400 mb-2">Security notes</div>
                {securityQuery.isLoading ? (
                  <div className="text-sm text-gray-300">Analyzing security implications…</div>
                ) : securityQuery.isError ? (
                  <div className="text-sm text-gray-300">Security analysis unavailable.</div>
                ) : (
                  <div className="text-sm text-gray-100 whitespace-pre-wrap">
                    {securityQuery.data || ''}
                  </div>
                )}
              </div>
            )}
          </Section>
        </div>

        <div className="px-6 py-4 border-t border-gray-700/70 bg-gray-900/90 flex items-center justify-between">
          <div className="text-xs text-gray-400">
            Tip: click cmdlet pills or inline cmdlets anywhere to open this panel.
          </div>
          <button
            type="button"
            onClick={close}
            className="px-4 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-100 border border-gray-700/70"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
