import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTheme } from '../hooks/useTheme';
import { useQuery } from '@tanstack/react-query';
import { getApiUrl } from '../utils/apiUrl';
import ReadmeViewer from '../components/ReadmeViewer';

// Reusable style constants for theme-aware styling
const cardStyles = "rounded-lg shadow-[var(--shadow-md)] p-6 bg-[var(--color-bg-elevated)] border border-[var(--color-border-default)]";
const inputStyles = "w-full px-3 py-2 rounded-md bg-[var(--color-bg-primary)] border border-[var(--color-border-default)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]";
const selectStyles = "px-3 py-2 rounded-md w-full bg-[var(--color-bg-primary)] border border-[var(--color-border-default)] text-[var(--color-text-primary)]";
const labelStyles = "block text-sm mb-2 text-[var(--color-text-secondary)]";
const toggleLabelStyles = "text-[var(--color-text-secondary)]";
const linkButtonStyles = "px-4 py-2 rounded-md transition text-center bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)] hover:bg-[var(--color-bg-primary)] border border-[var(--color-border-default)]";
const moduleLinkStyles = "px-3 py-2 rounded-md transition text-center text-sm bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)] hover:bg-[var(--color-bg-primary)] border border-[var(--color-border-default)]";

const Settings: React.FC = () => {
  // Theme settings
  const { theme, setTheme } = useTheme();

  // Notification settings
  const [notifications, setNotifications] = useState({
    emailNotifications: true,
    scriptExecutionAlerts: true,
    securityAlerts: true,
    weeklyDigest: false
  });

  // API settings
  const [apiSettings, setApiSettings] = useState({
    apiKey: 'sk-••••••••••••••••••••••••',
    showApiKey: false
  });

  const apiUrl = getApiUrl();
  // `getApiUrl()` typically returns something like `http://host:port/api`.
  // Static assets (like `/docs/exports/...`) are served from the backend root.
  const backendBaseUrl = apiUrl.replace(/\/api\/?$/, '');

  type ExportEntry = {
    filename: string;
    localUrl: string;
    githubRawUrl: string;
    bytes: number;
    modifiedAt: string;
  };

  type ExportsResponse = {
    repo: string;
    branch: string;
    pdf: ExportEntry[];
    docx: ExportEntry[];
  };

  const exportsQuery = useQuery({
    queryKey: ['docsExports'],
    queryFn: async (): Promise<ExportsResponse> => {
      const resp = await fetch(`${apiUrl}/docs/exports`, { cache: 'no-store' });
      if (!resp.ok) {
        throw new Error(`Failed to load exports (${resp.status})`);
      }
      return (await resp.json()) as ExportsResponse;
    },
    staleTime: 30_000,
    retry: 0
  });

  const githubRepo = exportsQuery.data?.repo || 'Morlock52/psscript';
  const githubBranch = exportsQuery.data?.branch || 'main';
  const githubBlobBase = `https://github.com/${githubRepo}/blob/${githubBranch}`;
  const githubTreeBase = `https://github.com/${githubRepo}/tree/${githubBranch}`;

  const [docsFilter, setDocsFilter] = useState('');
  const [showReadme, setShowReadme] = useState(false);

  const filteredPdf = useMemo(() => {
    const items = exportsQuery.data?.pdf || [];
    const q = docsFilter.trim().toLowerCase();
    if (!q) return items;
    return items.filter((x) => x.filename.toLowerCase().includes(q));
  }, [exportsQuery.data?.pdf, docsFilter]);

  const filteredDocx = useMemo(() => {
    const items = exportsQuery.data?.docx || [];
    const q = docsFilter.trim().toLowerCase();
    if (!q) return items;
    return items.filter((x) => x.filename.toLowerCase().includes(q));
  }, [exportsQuery.data?.docx, docsFilter]);

  const formatBytes = (bytes: number) => {
    if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
    const val = bytes / Math.pow(1024, i);
    return `${val.toFixed(val >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
  };

  const formatModifiedAt = (iso: string) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString();
  };

  // Display settings
  const [displaySettings, setDisplaySettings] = useState({
    itemsPerPage: '10',
    defaultSort: 'updated',
    codeEditorTheme: 'vs-dark'
  });

  // Handle notification toggle
  const handleNotificationToggle = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    setNotifications(prev => ({ ...prev, [name]: checked }));
  };

  // Handle display settings change
  const handleDisplayChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const { name, value } = e.target;
    setDisplaySettings(prev => ({ ...prev, [name]: value }));
  };

  // Handle API key toggle
  const toggleApiKeyVisibility = () => {
    setApiSettings(prev => ({ ...prev, showApiKey: !prev.showApiKey }));
  };

  // Regenerate API key
  const regenerateApiKey = () => {
    // This would call an API to regenerate the key
    const mockNewKey = 'sk-' + Math.random().toString(36).substring(2, 15);
    setApiSettings(prev => ({ ...prev, apiKey: mockNewKey }));
  };

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6 text-[var(--color-text-primary)]">Settings</h1>

      {/* User Management Card - Admin Only */}
      <Link
        to="/settings/users"
        className={`block mb-6 ${cardStyles} hover:border-[var(--color-primary)] hover:shadow-lg transition-all group`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-bold text-[var(--color-text-primary)] group-hover:text-[var(--color-primary)] transition-colors">
                User Management
              </h2>
              <p className="text-[var(--color-text-secondary)]">
                Add users, change passwords, and manage user settings
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 text-xs font-medium rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/30">
              Admin
            </span>
            <svg className="w-5 h-5 text-[var(--color-text-tertiary)] group-hover:text-[var(--color-primary)] group-hover:translate-x-1 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </div>
      </Link>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Appearance */}
        <div className={cardStyles}>
          <h2 className="text-xl font-bold mb-4 text-[var(--color-text-primary)]">Appearance</h2>

          <div className="space-y-4">
            <div>
              <label className={labelStyles}>Theme</label>
              <div className="flex gap-3">
                <button
                  onClick={() => setTheme('light')}
                  className={`px-4 py-2 rounded-md transition ${
                    theme === 'light'
                      ? 'bg-[var(--color-primary)] text-white'
                      : 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)]'
                  }`}
                >
                  Light
                </button>
                <button
                  onClick={() => setTheme('dark')}
                  className={`px-4 py-2 rounded-md transition ${
                    theme === 'dark'
                      ? 'bg-[var(--color-primary)] text-white'
                      : 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)]'
                  }`}
                >
                  Dark
                </button>
              </div>
            </div>

            <div>
              <label htmlFor="itemsPerPage" className={labelStyles}>
                Items Per Page
              </label>
              <select
                id="itemsPerPage"
                name="itemsPerPage"
                value={displaySettings.itemsPerPage}
                onChange={handleDisplayChange}
                className={selectStyles}
              >
                <option value="5">5</option>
                <option value="10">10</option>
                <option value="25">25</option>
                <option value="50">50</option>
              </select>
            </div>

            <div>
              <label htmlFor="defaultSort" className={labelStyles}>
                Default Sort
              </label>
              <select
                id="defaultSort"
                name="defaultSort"
                value={displaySettings.defaultSort}
                onChange={handleDisplayChange}
                className={selectStyles}
              >
                <option value="updated">Last Updated</option>
                <option value="created">Date Created</option>
                <option value="name">Name</option>
                <option value="quality">Quality Score</option>
              </select>
            </div>

            <div>
              <label htmlFor="codeEditorTheme" className={labelStyles}>
                Code Editor Theme
              </label>
              <select
                id="codeEditorTheme"
                name="codeEditorTheme"
                value={displaySettings.codeEditorTheme}
                onChange={handleDisplayChange}
                className={selectStyles}
              >
                <option value="vs-dark">Dark (VS Code)</option>
                <option value="vs-light">Light (VS Code)</option>
                <option value="hc-black">High Contrast</option>
              </select>
            </div>
          </div>
        </div>

        {/* Notifications */}
        <div className={cardStyles}>
          <h2 className="text-xl font-bold mb-4 text-[var(--color-text-primary)]">Notifications</h2>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label htmlFor="emailNotifications" className={toggleLabelStyles}>
                Email Notifications
              </label>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  id="emailNotifications"
                  name="emailNotifications"
                  className="sr-only peer"
                  checked={notifications.emailNotifications}
                  onChange={handleNotificationToggle}
                />
                <div className="w-11 h-6 bg-[var(--color-bg-tertiary)] peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-[var(--color-primary)] rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--color-primary)]"></div>
              </label>
            </div>

            <div className="flex items-center justify-between">
              <label htmlFor="scriptExecutionAlerts" className={toggleLabelStyles}>
                Script Execution Alerts
              </label>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  id="scriptExecutionAlerts"
                  name="scriptExecutionAlerts"
                  className="sr-only peer"
                  checked={notifications.scriptExecutionAlerts}
                  onChange={handleNotificationToggle}
                />
                <div className="w-11 h-6 bg-[var(--color-bg-tertiary)] peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-[var(--color-primary)] rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--color-primary)]"></div>
              </label>
            </div>

            <div className="flex items-center justify-between">
              <label htmlFor="securityAlerts" className={toggleLabelStyles}>
                Security Alerts
              </label>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  id="securityAlerts"
                  name="securityAlerts"
                  className="sr-only peer"
                  checked={notifications.securityAlerts}
                  onChange={handleNotificationToggle}
                />
                <div className="w-11 h-6 bg-[var(--color-bg-tertiary)] peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-[var(--color-primary)] rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--color-primary)]"></div>
              </label>
            </div>

            <div className="flex items-center justify-between">
              <label htmlFor="weeklyDigest" className={toggleLabelStyles}>
                Weekly Digest
              </label>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  id="weeklyDigest"
                  name="weeklyDigest"
                  className="sr-only peer"
                  checked={notifications.weeklyDigest}
                  onChange={handleNotificationToggle}
                />
                <div className="w-11 h-6 bg-[var(--color-bg-tertiary)] peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-[var(--color-primary)] rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--color-primary)]"></div>
              </label>
            </div>
          </div>
        </div>

        {/* API Settings */}
        <div className={cardStyles}>
          <h2 className="text-xl font-bold mb-4 text-[var(--color-text-primary)]">API Settings</h2>

          <div className="space-y-4">
            <div>
              <label className={labelStyles}>API Key</label>
              <div className="flex">
                <input
                  type={apiSettings.showApiKey ? "text" : "password"}
                  value={apiSettings.apiKey}
                  readOnly
                  className="flex-1 px-3 py-2 rounded-l-md bg-[var(--color-bg-primary)] border border-[var(--color-border-default)] text-[var(--color-text-primary)]"
                />
                <button
                  onClick={toggleApiKeyVisibility}
                  className="px-3 py-2 rounded-r-md bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] border border-l-0 border-[var(--color-border-default)] hover:bg-[var(--color-bg-primary)] transition"
                >
                  {apiSettings.showApiKey ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            <button
              onClick={regenerateApiKey}
              className="bg-[var(--color-primary)] text-white px-4 py-2 rounded-md hover:bg-[var(--color-primary-dark)] transition w-full"
            >
              Regenerate API Key
            </button>

            <div className="mt-4 p-4 rounded-md text-sm bg-[var(--color-bg-tertiary)] border border-[var(--color-border-default)]">
              <p className="mb-2 text-[var(--color-text-secondary)]">API Usage This Month:</p>
              <div className="flex justify-between mb-1">
                <span className="text-[var(--color-text-secondary)]">Script Analysis</span>
                <span className="text-[var(--color-text-secondary)]">245 / 1000</span>
              </div>
              <div className="w-full rounded-full h-2.5 mb-4 bg-[var(--color-bg-primary)]">
                <div
                  className="bg-[var(--color-primary)] h-2.5 rounded-full"
                  style={{ width: '24.5%' }}
                ></div>
              </div>

              <div className="flex justify-between mb-1">
                <span className="text-[var(--color-text-secondary)]">Script Executions</span>
                <span className="text-[var(--color-text-secondary)]">87 / 500</span>
              </div>
              <div className="w-full rounded-full h-2.5 bg-[var(--color-bg-primary)]">
                <div
                  className="bg-green-500 h-2.5 rounded-full"
                  style={{ width: '17.4%' }}
                ></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Documentation & Training */}
      <div className={`mt-6 ${cardStyles}`}>
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold mb-1 text-[var(--color-text-primary)]">Documentation &amp; Training</h2>
            <p className="text-[var(--color-text-secondary)]">
              Project docs, training suite exports, and the live README rendered in-app.
            </p>
            <p className="text-xs mt-2 text-[var(--color-text-tertiary)]">
              Repo: <span className="font-mono">{githubRepo}</span> ({githubBranch})
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <button
              type="button"
              onClick={() => setShowReadme(true)}
              className="bg-[var(--color-primary)] text-white px-4 py-2 rounded-md hover:bg-[var(--color-primary-dark)] transition text-center"
            >
              View README (In App)
            </button>
            <a
              href={`${githubBlobBase}/README.md`}
              target="_blank"
              rel="noreferrer"
              className={linkButtonStyles}
            >
              README (GitHub)
            </a>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
          <a
            href={`${githubTreeBase}/docs/training-suite`}
            target="_blank"
            rel="noreferrer"
            className={linkButtonStyles}
          >
            Training Suite (GitHub)
          </a>
          <a
            href={`${githubBlobBase}/MANAGEMENT-PLAYBOOK.md`}
            target="_blank"
            rel="noreferrer"
            className={linkButtonStyles}
          >
            Management Playbook (GitHub)
          </a>
          <a
            href={`${githubTreeBase}/docs/exports`}
            target="_blank"
            rel="noreferrer"
            className={linkButtonStyles}
          >
            Exports Folder (GitHub)
          </a>
        </div>

        <div className="mt-6">
          <label className={labelStyles}>Search exports</label>
          <input
            value={docsFilter}
            onChange={(e) => setDocsFilter(e.target.value)}
            className={inputStyles}
            placeholder="Filter by filename (e.g. Training, Playbook, module, lab)"
          />
        </div>

        <div className="mt-4">
          {exportsQuery.isLoading ? (
            <div className="p-4 rounded-md bg-[var(--color-bg-tertiary)] border border-[var(--color-border-default)]">
              <div className="text-sm text-[var(--color-text-secondary)]">Loading exports…</div>
              <div className="mt-3 w-full rounded-full h-2.5 bg-[var(--color-bg-primary)] overflow-hidden">
                <div className="bg-[var(--color-primary)] h-2.5 rounded-full animate-pulse w-2/3"></div>
              </div>
            </div>
          ) : exportsQuery.isError ? (
            <div className="p-4 rounded-md bg-red-500/10 border border-red-500/30">
              <div className="text-sm text-red-400">
                Failed to load documentation exports from the backend. The static docs links will be unavailable until the backend is online.
              </div>
              <div className="text-xs mt-2 text-[var(--color-text-tertiary)]">
                Endpoint: <span className="font-mono">{apiUrl}/docs/exports</span>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="p-4 rounded-md bg-[var(--color-bg-tertiary)] border border-[var(--color-border-default)]">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold text-[var(--color-text-primary)]">PDF Exports</div>
                    <div className="text-xs text-[var(--color-text-tertiary)]">{filteredPdf.length} files</div>
                  </div>
                  <div className="mt-3 space-y-2">
                    {filteredPdf.slice(0, 6).map((f) => (
                      <div
                        key={`pdf-${f.filename}`}
                        data-testid={`docs-export-pdf-${f.filename}`}
                        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-3 rounded-md bg-[var(--color-bg-elevated)] border border-[var(--color-border-default)]"
                      >
                        <div className="min-w-0">
                          <div className="font-mono text-sm text-[var(--color-text-primary)] truncate">{f.filename}</div>
                          <div className="text-xs text-[var(--color-text-tertiary)]">
                            {formatBytes(f.bytes)} · {formatModifiedAt(f.modifiedAt)}
                          </div>
                        </div>
                        <div className="flex gap-2 shrink-0">
                          <a
                            href={`${backendBaseUrl}${f.localUrl}`}
                            target="_blank"
                            rel="noreferrer"
                            className={moduleLinkStyles}
                          >
                            Open (Local)
                          </a>
                          <a
                            href={f.githubRawUrl}
                            target="_blank"
                            rel="noreferrer"
                            className={moduleLinkStyles}
                          >
                            Download (GitHub)
                          </a>
                        </div>
                      </div>
                    ))}
                    {filteredPdf.length > 6 && (
                      <div className="text-xs text-[var(--color-text-tertiary)]">
                        Showing 6 of {filteredPdf.length}. Use the filter box above to narrow results.
                      </div>
                    )}
                    {filteredPdf.length === 0 && (
                      <div className="text-sm text-[var(--color-text-secondary)]">No PDF exports found.</div>
                    )}
                  </div>
                </div>

                <div className="p-4 rounded-md bg-[var(--color-bg-tertiary)] border border-[var(--color-border-default)]">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold text-[var(--color-text-primary)]">DOCX Exports</div>
                    <div className="text-xs text-[var(--color-text-tertiary)]">{filteredDocx.length} files</div>
                  </div>
                  <div className="mt-3 space-y-2">
                    {filteredDocx.slice(0, 6).map((f) => (
                      <div
                        key={`docx-${f.filename}`}
                        data-testid={`docs-export-docx-${f.filename}`}
                        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-3 rounded-md bg-[var(--color-bg-elevated)] border border-[var(--color-border-default)]"
                      >
                        <div className="min-w-0">
                          <div className="font-mono text-sm text-[var(--color-text-primary)] truncate">{f.filename}</div>
                          <div className="text-xs text-[var(--color-text-tertiary)]">
                            {formatBytes(f.bytes)} · {formatModifiedAt(f.modifiedAt)}
                          </div>
                        </div>
                        <div className="flex gap-2 shrink-0">
                          <a
                            href={`${backendBaseUrl}${f.localUrl}`}
                            target="_blank"
                            rel="noreferrer"
                            className={moduleLinkStyles}
                          >
                            Open (Local)
                          </a>
                          <a
                            href={f.githubRawUrl}
                            target="_blank"
                            rel="noreferrer"
                            className={moduleLinkStyles}
                          >
                            Download (GitHub)
                          </a>
                        </div>
                      </div>
                    ))}
                    {filteredDocx.length > 6 && (
                      <div className="text-xs text-[var(--color-text-tertiary)]">
                        Showing 6 of {filteredDocx.length}. Use the filter box above to narrow results.
                      </div>
                    )}
                    {filteredDocx.length === 0 && (
                      <div className="text-sm text-[var(--color-text-secondary)]">No DOCX exports found.</div>
                    )}
                  </div>
                </div>
              </div>

              <details className="p-4 rounded-md bg-[var(--color-bg-tertiary)] border border-[var(--color-border-default)]">
                <summary className="cursor-pointer text-sm font-semibold text-[var(--color-text-primary)]">
                  View full export lists
                </summary>
                <div className="mt-4 space-y-4">
                  <div>
                    <div className="text-sm font-semibold text-[var(--color-text-primary)] mb-2">All PDFs</div>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
                      {filteredPdf.map((f) => (
                        <div key={`pdf-all-${f.filename}`} className="flex items-center justify-between gap-2 p-3 rounded-md bg-[var(--color-bg-elevated)] border border-[var(--color-border-default)]">
                          <div className="min-w-0">
                            <div className="font-mono text-sm text-[var(--color-text-primary)] truncate">{f.filename}</div>
                            <div className="text-xs text-[var(--color-text-tertiary)]">
                              {formatBytes(f.bytes)} · {formatModifiedAt(f.modifiedAt)}
                            </div>
                          </div>
                          <div className="flex gap-2 shrink-0">
                            <a href={`${backendBaseUrl}${f.localUrl}`} target="_blank" rel="noreferrer" className={moduleLinkStyles}>Local</a>
                            <a href={f.githubRawUrl} target="_blank" rel="noreferrer" className={moduleLinkStyles}>GitHub</a>
                          </div>
                        </div>
                      ))}
                      {filteredPdf.length === 0 && (
                        <div className="text-sm text-[var(--color-text-secondary)]">No PDF exports found.</div>
                      )}
                    </div>
                  </div>

                  <div>
                    <div className="text-sm font-semibold text-[var(--color-text-primary)] mb-2">All DOCX</div>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
                      {filteredDocx.map((f) => (
                        <div key={`docx-all-${f.filename}`} className="flex items-center justify-between gap-2 p-3 rounded-md bg-[var(--color-bg-elevated)] border border-[var(--color-border-default)]">
                          <div className="min-w-0">
                            <div className="font-mono text-sm text-[var(--color-text-primary)] truncate">{f.filename}</div>
                            <div className="text-xs text-[var(--color-text-tertiary)]">
                              {formatBytes(f.bytes)} · {formatModifiedAt(f.modifiedAt)}
                            </div>
                          </div>
                          <div className="flex gap-2 shrink-0">
                            <a href={`${backendBaseUrl}${f.localUrl}`} target="_blank" rel="noreferrer" className={moduleLinkStyles}>Local</a>
                            <a href={f.githubRawUrl} target="_blank" rel="noreferrer" className={moduleLinkStyles}>GitHub</a>
                          </div>
                        </div>
                      ))}
                      {filteredDocx.length === 0 && (
                        <div className="text-sm text-[var(--color-text-secondary)]">No DOCX exports found.</div>
                      )}
                    </div>
                  </div>
                </div>
              </details>
            </div>
          )}
        </div>
      </div>

      <ReadmeViewer isOpen={showReadme} onClose={() => setShowReadme(false)} />

      {/* Account Security */}
      <div className={`mt-6 ${cardStyles}`}>
        <h2 className="text-xl font-bold mb-4 text-[var(--color-text-primary)]">Account Security</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h3 className="text-lg font-semibold mb-3 text-[var(--color-text-primary)]">Change Password</h3>
            <form className="space-y-4">
              <div>
                <label htmlFor="currentPassword" className={labelStyles}>
                  Current Password
                </label>
                <input
                  type="password"
                  id="currentPassword"
                  className={inputStyles}
                />
              </div>

              <div>
                <label htmlFor="newPassword" className={labelStyles}>
                  New Password
                </label>
                <input
                  type="password"
                  id="newPassword"
                  className={inputStyles}
                />
              </div>

              <div>
                <label htmlFor="confirmPassword" className={labelStyles}>
                  Confirm New Password
                </label>
                <input
                  type="password"
                  id="confirmPassword"
                  className={inputStyles}
                />
              </div>

              <button
                type="submit"
                className="bg-[var(--color-primary)] text-white px-4 py-2 rounded-md hover:bg-[var(--color-primary-dark)] transition"
              >
                Update Password
              </button>
            </form>
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-3 text-[var(--color-text-primary)]">Two-Factor Authentication</h3>
            <p className="mb-4 text-[var(--color-text-secondary)]">
              Enhance your account security by enabling two-factor authentication.
            </p>

            <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-md mb-4">
              <p className="text-yellow-500">
                Two-factor authentication is currently disabled.
              </p>
            </div>

            <button
              className="bg-[var(--color-primary)] text-white px-4 py-2 rounded-md hover:bg-[var(--color-primary-dark)] transition"
            >
              Enable 2FA
            </button>
          </div>
        </div>
      </div>

      {/* Save Settings Button */}
      <div className="mt-6 flex justify-end">
        <button
          className="bg-[var(--color-primary)] text-white px-6 py-2 rounded-md hover:bg-[var(--color-primary-dark)] transition"
        >
          Save All Settings
        </button>
      </div>
    </div>
  );
};

export default Settings;
