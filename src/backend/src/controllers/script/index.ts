/**
 * Script Controllers Module
 *
 * This module provides a modular structure for script-related controllers.
 * The original ScriptController (23 methods) is being split into focused modules:
 *
 * - crud.ts: Basic CRUD operations (getScripts, getScript, createScript, updateScript, deleteScript)
 * - search.ts: Search and query operations (searchScripts, findSimilarScripts)
 * - analysis.ts: AI analysis operations (getScriptAnalysis, analyzeScript, etc.)
 * - execution.ts: Script execution (executeScript, getExecutionHistory)
 * - versions.ts: Version control (getVersionHistory, getVersion, revertToVersion, compareVersions)
 * - export.ts: Export operations (exportAnalysis, uploadScript)
 *
 * Migration Strategy:
 * 1. New controllers can import from ./shared for common utilities
 * 2. Gradually migrate methods from ScriptController to appropriate modules
 * 3. Update routes to point to new controller methods
 * 4. Remove methods from ScriptController as they are migrated
 * 5. Eventually deprecate the original ScriptController
 */

// Re-export shared utilities and types
export * from './shared';
export * from './types';

// Export individual controller modules
export * from './crud';
export * from './search';
export * from './analysis';
export * from './execution';
export * from './versions';
export * from './export';

// Export controller objects for compatibility with existing route handlers
export { ScriptCrudController } from './crud';
export { ScriptSearchController } from './search';
export { ScriptAnalysisController } from './analysis';
export { ScriptExecutionController } from './execution';
export { ScriptVersionController } from './versions';
export { ScriptExportController } from './export';
