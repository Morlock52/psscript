import React, { useEffect, useMemo, useState } from 'react';
import SettingsLayout from './SettingsLayout';
import { apiClient } from '../../services/api';

type BackupFile = {
  name: string;
  sizeBytes: number;
  createdAt: string;
  updatedAt: string;
};

const inputStyles =
  'w-full px-3 py-2 rounded-md bg-[var(--surface-base)] border border-[var(--surface-overlay)] text-[var(--ink-primary)] focus:ring-2 focus:ring-[var(--accent)] focus:outline-none';

const buttonPrimary =
  'px-3 py-2 rounded-md bg-[var(--accent)] hover:bg-[var(--color-primary-dark)] text-white transition disabled:opacity-60 disabled:cursor-not-allowed';
const buttonSecondary =
  'px-3 py-2 rounded-md bg-[var(--surface-overlay)] hover:bg-[var(--surface-base)] text-[var(--ink-primary)] border border-[var(--surface-overlay)] transition disabled:opacity-60 disabled:cursor-not-allowed';
const buttonDanger =
  'px-3 py-2 rounded-md bg-red-600 hover:bg-red-700 text-white transition disabled:opacity-60 disabled:cursor-not-allowed';

export default function DataMaintenanceSettings() {
  const [backups, setBackups] = useState<BackupFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [newBackupName, setNewBackupName] = useState('');
  const [selectedBackup, setSelectedBackup] = useState('');
  const [restoreConfirm, setRestoreConfirm] = useState('');

  const [clearConfirm, setClearConfirm] = useState('');
  const [backupBeforeClear, setBackupBeforeClear] = useState(true);
  const [clearBackupName, setClearBackupName] = useState('');
  const [clearTables, setClearTables] = useState('');

  const clearStatus = useMemo(() => {
    if (clearConfirm === 'CLEAR TEST DATA') return 'ready';
    return 'locked';
  }, [clearConfirm]);

  const restoreStatus = useMemo(() => {
    if (selectedBackup && restoreConfirm === 'RESTORE BACKUP') return 'ready';
    return 'locked';
  }, [selectedBackup, restoreConfirm]);

  const loadBackups = async () => {
    try {
      setLoading(true);
      setMessage(null);
      const response = await apiClient.get('/admin/db/backups');
      const files = (response.data?.backups || []) as BackupFile[];
      setBackups(files);
      if (files.length > 0 && !selectedBackup) {
        setSelectedBackup(files[0].name);
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err?.message || 'Failed to load backup list' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadBackups();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const createBackup = async () => {
    try {
      setLoading(true);
      setMessage(null);
      const response = await apiClient.post('/admin/db/backup', {
        filename: newBackupName.trim() || undefined
      });
      setMessage({ type: 'success', text: response.data?.message || 'Backup created' });
      setNewBackupName('');
      await loadBackups();
    } catch (err: any) {
      setMessage({ type: 'error', text: err?.message || 'Failed to create backup' });
    } finally {
      setLoading(false);
    }
  };

  const restoreBackup = async () => {
    try {
      setLoading(true);
      setMessage(null);
      const response = await apiClient.post('/admin/db/restore', {
        filename: selectedBackup,
        confirmText: restoreConfirm,
      });
      setMessage({ type: 'success', text: response.data?.message || 'Restore completed' });
      setRestoreConfirm('');
    } catch (err: any) {
      setMessage({ type: 'error', text: err?.message || 'Failed to restore backup' });
    } finally {
      setLoading(false);
    }
  };

  const clearTestData = async () => {
    try {
      setLoading(true);
      setMessage(null);
      const response = await apiClient.post('/admin/db/clear-test-data', {
        confirmText: clearConfirm,
        backupFirst: backupBeforeClear,
        backupFilename: clearBackupName.trim() || undefined,
        tables: clearTables
          .split(',')
          .map((name) => name.trim())
          .filter((name) => name.length > 0)
      });
      const cleared = response.data?.clearedTables || [];
      const ignored = response.data?.ignoredTables || [];
      const filterSummary = Array.isArray(response.data?.requestedTables)
        ? `${response.data.requestedTables.length} requested, ${response.data.filteredTables?.length || 0} applied`
        : 'default table set';

      const details = [`${response.data?.message || 'Test data cleared'}`, `Clear summary: ${filterSummary}`];
      if (cleared.length > 0) {
        details.push(`Cleared tables: ${cleared.join(', ')}`);
      }
      if (ignored.length > 0) {
        details.push(`Skipped (not found): ${ignored.join(', ')}`);
      }

      setMessage({ type: 'success', text: details.join(' | ') });
      setClearConfirm('');
      setClearBackupName('');
      setClearTables('');
      await loadBackups();
    } catch (err: any) {
      setMessage({ type: 'error', text: err?.message || 'Failed to clear test data' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <SettingsLayout
      title="Data Maintenance"
      description="Admin tools for database backup, restore, and test data cleanup."
    >
      <div className="space-y-6">
        {message && (
          <div
            className={`rounded-md border px-3 py-2 text-sm ${
              message.type === 'success'
                ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                : 'border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300'
            }`}
          >
            {message.text}
          </div>
        )}

        <div className="rounded-lg border border-[var(--surface-overlay)] bg-[var(--surface-overlay)] p-4 space-y-3">
          <h2 className="text-lg font-semibold text-[var(--ink-primary)]">Install + Support</h2>
          <p className="text-sm text-[var(--ink-secondary)]">
            Reference:
            <span className="block mt-1 font-mono">/docs/DATA-MAINTENANCE.md</span>
            <span className="block font-mono">/docs/SUPPORT.md</span>
          </p>
          <p className="text-sm text-[var(--ink-secondary)]">
            Set <span className="font-mono">DB_BACKUP_DIR</span> before starting services and use admin credentials.
          </p>
        </div>

        <div className="rounded-lg border border-[var(--surface-overlay)] bg-[var(--surface-overlay)] p-4 space-y-4">
          <h2 className="text-lg font-semibold text-[var(--ink-primary)]">Backups</h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
            <div className="md:col-span-2">
              <label className="block text-xs mb-1 text-[var(--ink-secondary)]">New backup filename (optional)</label>
              <input
                className={inputStyles}
                value={newBackupName}
                onChange={(e) => setNewBackupName(e.target.value)}
                placeholder="example: before-test-run"
              />
            </div>
            <button className={buttonPrimary} onClick={createBackup} disabled={loading}>
              {loading ? 'Working...' : 'Create Backup'}
            </button>
          </div>

          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-[var(--ink-primary)]">Existing backups</h3>
            <button className={buttonSecondary} onClick={() => void loadBackups()} disabled={loading}>
              Refresh
            </button>
          </div>

          <div className="max-h-56 overflow-auto rounded border border-[var(--surface-overlay)]">
            <table className="w-full text-sm">
              <thead className="bg-[var(--surface-base)]">
                <tr>
                  <th className="text-left p-2">Name</th>
                  <th className="text-left p-2">Updated</th>
                  <th className="text-left p-2">Size</th>
                </tr>
              </thead>
              <tbody>
                {backups.length === 0 && (
                  <tr>
                    <td className="p-2 text-[var(--ink-secondary)]" colSpan={3}>
                      No backups found.
                    </td>
                  </tr>
                )}
                {backups.map((b) => (
                  <tr
                    key={b.name}
                    className={`border-t border-[var(--surface-overlay)] cursor-pointer ${selectedBackup === b.name ? 'bg-[var(--surface-base)]' : ''}`}
                    onClick={() => setSelectedBackup(b.name)}
                  >
                    <td className="p-2 font-mono">{b.name}</td>
                    <td className="p-2">{new Date(b.updatedAt).toLocaleString()}</td>
                    <td className="p-2">{Math.max(1, Math.round(b.sizeBytes / 1024))} KB</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 space-y-3">
          <h2 className="text-lg font-semibold text-[var(--ink-primary)]">Restore Backup</h2>
          <p className="text-sm text-[var(--ink-secondary)]">
            Restoring replaces current database content with the selected backup.
          </p>

          <div>
            <label className="block text-xs mb-1 text-[var(--ink-secondary)]">Selected backup</label>
            <select
              className={inputStyles}
              value={selectedBackup}
              onChange={(e) => setSelectedBackup(e.target.value)}
            >
              {backups.map((b) => (
                <option key={b.name} value={b.name}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs mb-1 text-[var(--ink-secondary)]">Type exactly: RESTORE BACKUP</label>
            <input
              className={inputStyles}
              value={restoreConfirm}
              onChange={(e) => setRestoreConfirm(e.target.value)}
              placeholder="RESTORE BACKUP"
            />
          </div>

          <button
            className={buttonDanger}
            disabled={loading || restoreStatus !== 'ready'}
            onClick={restoreBackup}
          >
            {loading ? 'Working...' : 'Restore Selected Backup'}
          </button>
        </div>

        <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-4 space-y-3">
          <h2 className="text-lg font-semibold text-[var(--ink-primary)]">Clear Test Data</h2>
          <p className="text-sm text-[var(--ink-secondary)]">
            Clears script-related test data tables while preserving users, categories, tags, documentation, and migrations.
          </p>

          <label className="flex items-center gap-2 text-sm text-[var(--ink-primary)]">
            <input
              type="checkbox"
              checked={backupBeforeClear}
              onChange={(e) => setBackupBeforeClear(e.target.checked)}
            />
            Create backup before clear
          </label>

          {backupBeforeClear && (
            <div>
              <label className="block text-xs mb-1 text-[var(--ink-secondary)]">Backup filename (optional)</label>
              <input
                className={inputStyles}
                value={clearBackupName}
                onChange={(e) => setClearBackupName(e.target.value)}
                placeholder="example: pre-clear-test-data"
              />
            </div>
          )}

          <div>
            <label className="block text-xs mb-1 text-[var(--ink-secondary)]">Type exactly: CLEAR TEST DATA</label>
            <input
              className={inputStyles}
              value={clearConfirm}
              onChange={(e) => setClearConfirm(e.target.value)}
              placeholder="CLEAR TEST DATA"
            />
          </div>

          <div>
            <label className="block text-xs mb-1 text-[var(--ink-secondary)]">Optional table filter (comma-separated)</label>
            <input
              className={inputStyles}
              value={clearTables}
              onChange={(e) => setClearTables(e.target.value)}
              placeholder="scripts,script_versions,execution_logs"
            />
          </div>

          <button
            className={buttonDanger}
            disabled={loading || clearStatus !== 'ready'}
            onClick={clearTestData}
          >
            {loading ? 'Working...' : 'Clear Test Data'}
          </button>
        </div>
      </div>
    </SettingsLayout>
  );
}
