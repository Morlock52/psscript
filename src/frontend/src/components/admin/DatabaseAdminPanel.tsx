/**
 * Database Admin Panel
 * Industrial control room aesthetic for monitoring PostgreSQL health
 */
import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import './DatabaseAdminPanel.css';

// Types
interface TableHealth {
  name: string;
  liveRows: number;
  deadRows: number;
  totalSize: string;
  lastVacuum: string | null;
  bloatRatio: number;
}

interface IndexUsage {
  tableName: string;
  indexName: string;
  size: string;
  scans: number;
  status: 'USED' | 'UNUSED';
}

interface ConnectionStats {
  total: number;
  active: number;
  idle: number;
  idleInTransaction: number;
  maxConnections: number;
}

interface DatabaseMetrics {
  tables: TableHealth[];
  indexes: IndexUsage[];
  connections: ConnectionStats;
  lastUpdated: Date;
}

// Mock data based on our actual database review
const mockMetrics: DatabaseMetrics = {
  tables: [
    { name: 'scripts', liveRows: 73, deadRows: 0, totalSize: '144 kB', lastVacuum: '2026-01-16 22:30:00', bloatRatio: 0 },
    { name: 'users', liveRows: 12, deadRows: 0, totalSize: '96 kB', lastVacuum: '2026-01-16 22:30:00', bloatRatio: 0 },
    { name: 'documentation', liveRows: 17, deadRows: 0, totalSize: '384 kB', lastVacuum: '2026-01-16 22:30:00', bloatRatio: 0 },
    { name: 'categories', liveRows: 16, deadRows: 0, totalSize: '80 kB', lastVacuum: '2026-01-16 22:30:00', bloatRatio: 0 },
    { name: 'tags', liveRows: 11, deadRows: 0, totalSize: '40 kB', lastVacuum: '2026-01-16 22:30:00', bloatRatio: 0 },
    { name: 'script_versions', liveRows: 2, deadRows: 0, totalSize: '112 kB', lastVacuum: '2026-01-16 22:30:00', bloatRatio: 0 },
    { name: 'script_analysis', liveRows: 1, deadRows: 0, totalSize: '80 kB', lastVacuum: '2026-01-16 22:30:00', bloatRatio: 0 },
    { name: 'script_embeddings', liveRows: 0, deadRows: 0, totalSize: '1632 kB', lastVacuum: null, bloatRatio: 0 },
    { name: 'execution_logs', liveRows: 0, deadRows: 0, totalSize: '64 kB', lastVacuum: '2026-01-16 22:30:00', bloatRatio: 0 },
    { name: 'chat_history', liveRows: 0, deadRows: 0, totalSize: '24 kB', lastVacuum: null, bloatRatio: 0 },
  ],
  indexes: [
    { tableName: 'script_embeddings', indexName: 'script_embeddings_idx', size: '1608 kB', scans: 0, status: 'UNUSED' },
    { tableName: 'categories', indexName: 'categories_pkey', size: '16 kB', scans: 124, status: 'USED' },
    { tableName: 'script_tags', indexName: 'script_tags_pkey', size: '16 kB', scans: 322, status: 'USED' },
    { tableName: 'execution_logs', indexName: 'idx_execution_logs_user', size: '16 kB', scans: 360, status: 'USED' },
    { tableName: 'execution_logs', indexName: 'idx_execution_logs_script', size: '16 kB', scans: 268, status: 'USED' },
    { tableName: 'script_analysis', indexName: 'idx_script_analysis_script', size: '16 kB', scans: 136, status: 'USED' },
  ],
  connections: {
    total: 3,
    active: 1,
    idle: 2,
    idleInTransaction: 0,
    maxConnections: 100,
  },
  lastUpdated: new Date(),
};

// Status indicator component
const StatusLight: React.FC<{ status: 'healthy' | 'warning' | 'critical' | 'inactive' }> = ({ status }) => {
  const colors = {
    healthy: '#00ff88',
    warning: '#ffaa00',
    critical: '#ff3366',
    inactive: '#444455',
  };

  return (
    <motion.div
      className="status-light"
      style={{ backgroundColor: colors[status] }}
      animate={{
        boxShadow: status !== 'inactive'
          ? [`0 0 4px ${colors[status]}`, `0 0 12px ${colors[status]}`, `0 0 4px ${colors[status]}`]
          : 'none',
      }}
      transition={{ duration: 2, repeat: Infinity }}
    />
  );
};

// Gauge component for connection pool
const ConnectionGauge: React.FC<{ stats: ConnectionStats }> = ({ stats }) => {
  const percentage = (stats.total / stats.maxConnections) * 100;
  const circumference = 2 * Math.PI * 45;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div className="gauge-container">
      <svg viewBox="0 0 100 100" className="gauge-svg">
        {/* Background track */}
        <circle
          cx="50"
          cy="50"
          r="45"
          fill="none"
          stroke="#1a1a2e"
          strokeWidth="8"
        />
        {/* Progress arc */}
        <motion.circle
          cx="50"
          cy="50"
          r="45"
          fill="none"
          stroke="url(#gaugeGradient)"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset }}
          transition={{ duration: 1.5, ease: 'easeOut' }}
          transform="rotate(-90 50 50)"
        />
        <defs>
          <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#00ff88" />
            <stop offset="50%" stopColor="#00ccff" />
            <stop offset="100%" stopColor="#ff3366" />
          </linearGradient>
        </defs>
      </svg>
      <div className="gauge-center">
        <span className="gauge-value">{stats.total}</span>
        <span className="gauge-label">/ {stats.maxConnections}</span>
      </div>
    </div>
  );
};

// Table health row component
const TableHealthRow: React.FC<{ table: TableHealth; index: number }> = ({ table, index }) => {
  const getBloatStatus = (ratio: number): 'healthy' | 'warning' | 'critical' => {
    if (ratio > 100) return 'critical';
    if (ratio > 25) return 'warning';
    return 'healthy';
  };

  return (
    <motion.tr
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
      className="table-row"
    >
      <td className="cell-name">
        <StatusLight status={table.deadRows > 0 ? 'warning' : 'healthy'} />
        <span className="mono">{table.name}</span>
      </td>
      <td className="cell-numeric">{table.liveRows.toLocaleString()}</td>
      <td className={`cell-numeric ${table.deadRows > 0 ? 'text-warning' : ''}`}>
        {table.deadRows.toLocaleString()}
      </td>
      <td className="cell-size">{table.totalSize}</td>
      <td className="cell-vacuum">
        {table.lastVacuum ? (
          <span className="timestamp">{new Date(table.lastVacuum).toLocaleTimeString()}</span>
        ) : (
          <span className="text-muted">Never</span>
        )}
      </td>
      <td className="cell-bloat">
        <div className="bloat-indicator">
          <motion.div
            className={`bloat-bar bloat-${getBloatStatus(table.bloatRatio)}`}
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(table.bloatRatio, 100)}%` }}
            transition={{ delay: index * 0.05 + 0.2, duration: 0.5 }}
          />
          <span className="bloat-value">{table.bloatRatio.toFixed(1)}%</span>
        </div>
      </td>
    </motion.tr>
  );
};

// Index usage row
const IndexRow: React.FC<{ idx: IndexUsage; index: number }> = ({ idx, index }) => (
  <motion.tr
    initial={{ opacity: 0, x: -20 }}
    animate={{ opacity: 1, x: 0 }}
    transition={{ delay: index * 0.05 }}
    className="table-row"
  >
    <td className="cell-name">
      <StatusLight status={idx.status === 'USED' ? 'healthy' : 'inactive'} />
      <span className="mono">{idx.indexName}</span>
    </td>
    <td className="cell-table">{idx.tableName}</td>
    <td className="cell-size">{idx.size}</td>
    <td className="cell-numeric">{idx.scans.toLocaleString()}</td>
    <td className="cell-status">
      <span className={`status-badge ${idx.status.toLowerCase()}`}>
        {idx.status}
      </span>
    </td>
  </motion.tr>
);

// Main component
const DatabaseAdminPanel: React.FC = () => {
  const [metrics, setMetrics] = useState<DatabaseMetrics>(mockMetrics);
  const [isVacuuming, setIsVacuuming] = useState(false);
  const [activeTab, setActiveTab] = useState<'tables' | 'indexes'>('tables');
  const [lastRefresh, setLastRefresh] = useState(new Date());

  const refreshMetrics = useCallback(async () => {
    // In production, this would fetch from the API
    setLastRefresh(new Date());
    setMetrics({ ...mockMetrics, lastUpdated: new Date() });
  }, []);

  const runVacuum = async () => {
    setIsVacuuming(true);
    // Simulate vacuum operation
    await new Promise(resolve => setTimeout(resolve, 2000));
    setIsVacuuming(false);
    refreshMetrics();
  };

  useEffect(() => {
    const interval = setInterval(refreshMetrics, 30000);
    return () => clearInterval(interval);
  }, [refreshMetrics]);

  return (
    <div className="db-admin-panel">
      {/* Header */}
      <header className="panel-header">
        <div className="header-left">
          <motion.div
            className="logo-mark"
            animate={{ rotate: 360 }}
            transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
          >
            <svg viewBox="0 0 40 40" fill="none">
              <circle cx="20" cy="20" r="18" stroke="currentColor" strokeWidth="2" />
              <circle cx="20" cy="20" r="12" stroke="currentColor" strokeWidth="1.5" opacity="0.6" />
              <circle cx="20" cy="20" r="6" stroke="currentColor" strokeWidth="1" opacity="0.4" />
              <circle cx="20" cy="20" r="2" fill="currentColor" />
            </svg>
          </motion.div>
          <div className="header-title">
            <h1>DATABASE CONTROL</h1>
            <span className="subtitle">PSSCRIPT // POSTGRESQL ADMIN</span>
          </div>
        </div>
        <div className="header-right">
          <div className="connection-indicator">
            <StatusLight status="healthy" />
            <span>CONNECTED</span>
          </div>
          <div className="refresh-info">
            <span className="label">LAST SYNC</span>
            <span className="value">{lastRefresh.toLocaleTimeString()}</span>
          </div>
        </div>
      </header>

      {/* Connection Pool Section */}
      <section className="section connection-section">
        <div className="section-header">
          <h2>CONNECTION POOL</h2>
          <div className="pool-stats">
            <div className="stat">
              <span className="stat-value active">{metrics.connections.active}</span>
              <span className="stat-label">ACTIVE</span>
            </div>
            <div className="stat">
              <span className="stat-value idle">{metrics.connections.idle}</span>
              <span className="stat-label">IDLE</span>
            </div>
            <div className="stat">
              <span className="stat-value warning">{metrics.connections.idleInTransaction}</span>
              <span className="stat-label">IN TRANS</span>
            </div>
          </div>
        </div>
        <div className="gauge-wrapper">
          <ConnectionGauge stats={metrics.connections} />
          <div className="gauge-labels">
            <div className="gauge-stat">
              <span className="big-number">{((metrics.connections.total / metrics.connections.maxConnections) * 100).toFixed(1)}%</span>
              <span className="label">POOL UTILIZATION</span>
            </div>
          </div>
        </div>
      </section>

      {/* Maintenance Actions */}
      <section className="section actions-section">
        <div className="section-header">
          <h2>MAINTENANCE</h2>
        </div>
        <div className="action-buttons">
          <motion.button
            className={`action-btn vacuum-btn ${isVacuuming ? 'running' : ''}`}
            onClick={runVacuum}
            disabled={isVacuuming}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <AnimatePresence mode="wait">
              {isVacuuming ? (
                <motion.span
                  key="running"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="btn-content"
                >
                  <motion.div
                    className="spinner"
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                  />
                  VACUUMING...
                </motion.span>
              ) : (
                <motion.span
                  key="idle"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="btn-content"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 6h18M3 12h18M3 18h18" />
                  </svg>
                  VACUUM ANALYZE
                </motion.span>
              )}
            </AnimatePresence>
          </motion.button>

          <motion.button
            className="action-btn refresh-btn"
            onClick={refreshMetrics}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M23 4v6h-6M1 20v-6h6" />
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
            </svg>
            REFRESH STATS
          </motion.button>
        </div>
      </section>

      {/* Tab Navigation */}
      <div className="tab-navigation">
        <button
          className={`tab-btn ${activeTab === 'tables' ? 'active' : ''}`}
          onClick={() => setActiveTab('tables')}
        >
          <span className="tab-icon">▦</span>
          TABLE HEALTH
          <span className="tab-count">{metrics.tables.length}</span>
        </button>
        <button
          className={`tab-btn ${activeTab === 'indexes' ? 'active' : ''}`}
          onClick={() => setActiveTab('indexes')}
        >
          <span className="tab-icon">⚡</span>
          INDEX USAGE
          <span className="tab-count">{metrics.indexes.length}</span>
        </button>
      </div>

      {/* Data Tables */}
      <section className="section data-section">
        <AnimatePresence mode="wait">
          {activeTab === 'tables' ? (
            <motion.div
              key="tables"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="data-table-wrapper"
            >
              <table className="data-table">
                <thead>
                  <tr>
                    <th>TABLE</th>
                    <th>LIVE ROWS</th>
                    <th>DEAD ROWS</th>
                    <th>SIZE</th>
                    <th>LAST VACUUM</th>
                    <th>BLOAT</th>
                  </tr>
                </thead>
                <tbody>
                  {metrics.tables.map((table, i) => (
                    <TableHealthRow key={table.name} table={table} index={i} />
                  ))}
                </tbody>
              </table>
            </motion.div>
          ) : (
            <motion.div
              key="indexes"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="data-table-wrapper"
            >
              <table className="data-table">
                <thead>
                  <tr>
                    <th>INDEX</th>
                    <th>TABLE</th>
                    <th>SIZE</th>
                    <th>SCANS</th>
                    <th>STATUS</th>
                  </tr>
                </thead>
                <tbody>
                  {metrics.indexes.map((idx, i) => (
                    <IndexRow key={idx.indexName} idx={idx} index={i} />
                  ))}
                </tbody>
              </table>
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      {/* Footer */}
      <footer className="panel-footer">
        <div className="footer-left">
          <span className="version">v1.0.0</span>
          <span className="divider">|</span>
          <span className="db-info">PostgreSQL 15 • Pool: 10 max • localhost:5432</span>
        </div>
        <div className="footer-right">
          <span className="uptime">SYSTEM UPTIME: 99.9%</span>
        </div>
      </footer>
    </div>
  );
};

export default DatabaseAdminPanel;
