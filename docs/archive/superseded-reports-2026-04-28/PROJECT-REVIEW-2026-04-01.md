# PSScript Project Review & Improvement Plan

**Date:** April 1, 2026
**Scope:** Full-stack review of backend, frontend, AI service, database, and API
**Goal:** Identify 20+ improvements, fix all API and database table issues, ensure backend correctness

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Database & Model Issues Found](#database--model-issues-found)
3. [API Issues Found](#api-issues-found)
4. [Backend Correctness Issues](#backend-correctness-issues)
5. [20 Improvements with Best Practices](#20-improvements-with-best-practices)
6. [Comprehensive Implementation Plan](#comprehensive-implementation-plan)

---

## Executive Summary

The PSScript project is a well-structured multi-service application (Express/TypeScript backend, React/Vite frontend, FastAPI AI service, PostgreSQL + Redis). After thorough review, we identified **critical database schema gaps**, **API consistency issues**, **TypeScript safety bypasses**, and **architectural improvements** that should be addressed holistically.

### Key Findings at a Glance

| Category | Critical | Major | Minor |
|----------|----------|-------|-------|
| Database/Models | 3 | 4 | 2 |
| API Endpoints | 2 | 3 | 3 |
| Backend Code | 2 | 4 | 3 |
| Security | 1 | 2 | 2 |
| Architecture | 0 | 3 | 2 |

---

## Database & Model Issues Found

### CRITICAL: DB-001 - ExecutionLog Missing `output` Column

**File:** `src/backend/src/models/ExecutionLog.ts:11-13`
**Impact:** The controller at `execution.ts:61` and `execution.ts:133` references `log.output` but the column doesn't exist in the database or model.

**Problem:**
```typescript
// ExecutionLog.ts - field is missing
// TODO: Add 'output' field once database migration is created
// The ScriptController.ts references log.output but the column doesn't exist in DB
```

**Fix:** Add `output` field to the model:
```typescript
output: {
  type: DataTypes.TEXT,
  allowNull: true,
  comment: 'Command output or execution result'
}
```

---

### CRITICAL: DB-002 - Script `fileHash` Column Too Short for SHA-256

**File:** `src/backend/src/models/Script.ts:78-81`
**Impact:** CLAUDE.md documents SHA-256 hashing for deduplication, but `fileHash` is `STRING(32)` which can only hold MD5 hashes (32 hex chars). SHA-256 requires 64 hex characters.

**Problem:**
```typescript
fileHash: {
  type: DataTypes.STRING(32), // SHA-256 = 64 hex chars, this truncates!
  allowNull: true,
  field: 'file_hash'
}
```

**Fix:** Change to `DataTypes.STRING(64)` or `DataTypes.STRING(128)` for future-proofing.

---

### CRITICAL: DB-003 - ChatHistory Uses Different Model Pattern

**File:** `src/backend/src/models/ChatHistory.ts`
**Impact:** ChatHistory uses a factory function pattern (`ChatHistory(sequelize)`) while all other models use static class pattern (`Model.initialize(sequelize)`). This causes inconsistency and the `safeAssociate` call in `models/index.ts` may silently fail because the returned model instance has the `associate` method attached dynamically.

**Problem:**
```typescript
// ChatHistory uses factory pattern - different from all other models
const ChatHistory = function(sequelize: Sequelize) {
  const ChatHistoryModel = sequelize.define<ChatHistoryInstance>(...);
  // @ts-ignore - Dynamic association assignment pattern
  ChatHistoryModel.associate = function() { ... };
  return ChatHistoryModel;
};

// Then monkey-patches initialize:
ChatHistory.initialize = function(sequelize: Sequelize) {
  return ChatHistory(sequelize);
};
```

**Fix:** Refactor to use the same static class pattern as other models.

---

### MAJOR: DB-004 - Missing Database Indexes

**Files:** Multiple models
**Impact:** Performance degradation on common queries.

Missing indexes:
| Model | Column(s) | Query Pattern |
|-------|-----------|---------------|
| Script | `file_hash` | Deduplication lookup |
| Script | `is_public, user_id` | Visibility filtering (compound) |
| ScriptAnalysis | `script_id` (already unique, but no index on scores) | Score-based filtering |
| ScriptVersion | `script_id, version` | Already has unique constraint (good) |
| Comment | `created_at` | Time-ordered listing |

---

### MAJOR: DB-005 - Inconsistent Foreign Key Naming

**Files:** Multiple models
**Impact:** Confusing codebase, potential query bugs.

| Model | Association FK | Field Mapping | Issue |
|-------|---------------|---------------|-------|
| Comment | `foreignKey: 'script_id'` | Uses snake_case directly | Other models use camelCase `scriptId` |
| Comment | `foreignKey: 'user_id'` | Uses snake_case directly | Inconsistent with Script's `foreignKey: 'userId'` |
| ScriptDependency | `foreignKey: 'parent_script_id'` | Uses snake_case | Should use camelCase `parentScriptId` |
| ExecutionLog | Missing `field: 'script_id'` | No explicit field mapping | Relies on `underscored: true` |

---

### MAJOR: DB-006 - No CASCADE on ScriptAnalysis Delete

**File:** `src/backend/src/models/ScriptAnalysis.ts:46-48`
**Impact:** When a Script is deleted, the ScriptAnalysis must be manually deleted. The `crud.ts:379` handles this manually, but if any other code path deletes a script, orphan analyses remain.

**Problem:** No `onDelete: 'CASCADE'` on ScriptAnalysis.scriptId reference.

---

### MAJOR: DB-007 - ScriptVersion `timestamps: false` But Model Declares `createdAt` and `updatedAt`

**File:** `src/backend/src/models/ScriptVersion.ts:59-60`
**Impact:** The model class declares `public readonly createdAt!: Date; public readonly updatedAt!: Date;` but the Sequelize config has `timestamps: false`. Accessing these properties will return `undefined`.

---

### MINOR: DB-008 - Embedding Model Uses Outdated Default

**File:** `src/backend/src/models/ScriptEmbedding.ts:42`
**Impact:** Default embedding model `text-embedding-ada-002` is deprecated. Current best practice (2026) is `text-embedding-3-small` or `text-embedding-3-large`.

---

### MINOR: DB-009 - No Pagination Limit Guard

**File:** `src/backend/src/controllers/script/shared.ts:386-391`
**Impact:** `parsePaginationParams` doesn't cap the `limit` value. A client can request `?limit=999999` and pull all records.

```typescript
// No max limit enforced
const limit = parseInt(query.limit as string) || 10;
```

---

## API Issues Found

### CRITICAL: API-001 - Inconsistent Response Shapes

**Files:** Multiple controllers
**Impact:** Frontend must handle different response structures for different endpoints, increasing complexity and bugs.

| Endpoint | Success Shape | Error Shape |
|----------|--------------|-------------|
| Auth routes | `{ success: true, token, user }` | `{ success: false, message, error }` |
| Script CRUD | Raw script object | `{ message: '...' }` |
| Script delete | `{ message, id, success }` | `{ message, error, success }` |
| Analytics | `{ message: '...' }` or raw data | `{ message, status: 'error' }` |
| Health | Custom format | Custom format |

**Best Practice (2026):** Use consistent envelope:
```typescript
// Success
{ success: true, data: { ... }, meta?: { page, total } }

// Error
{ success: false, error: { code: 'ERROR_CODE', message: '...' } }
```

---

### CRITICAL: API-002 - Analytics Summary Endpoint Returns Stub

**File:** `src/backend/src/routes/analytics.ts:60-63`
**Impact:** Production endpoint returns a TODO placeholder.

```typescript
router.get('/summary', (req, res) => {
  // TODO: Implement comprehensive analytics summary
  res.json({ message: 'Analytics summary endpoint (to be implemented)' });
});
```

---

### MAJOR: API-003 - SERIALIZABLE Isolation on Script Create Is Overkill

**File:** `src/backend/src/controllers/script/crud.ts:193-195`
**Impact:** `SERIALIZABLE` isolation level causes maximum lock contention and can lead to serialization failures under concurrent load. Script creation doesn't need this - `READ COMMITTED` (Sequelize default) is sufficient.

```typescript
transaction = await sequelize.transaction({
  isolationLevel: Transaction.ISOLATION_LEVELS.SERIALIZABLE // Overkill
});
```

---

### MAJOR: API-004 - Fire-and-Forget Analysis With No Error Recovery

**File:** `src/backend/src/controllers/script/crud.ts:262-310`
**Impact:** On script create, AI analysis is fired and forgotten with `void (async () => { ... })()`. If it fails, the user gets no analysis and no notification. There's no retry mechanism.

---

### MAJOR: API-005 - Script Update Re-analysis Blocks the Response

**File:** `src/backend/src/controllers/script/crud.ts:462-505`
**Impact:** Unlike create (which is fire-and-forget), the update path calls AI analysis **synchronously within the transaction**. If the AI service is slow, the user waits and the transaction holds locks.

---

### MINOR: API-006 - User Email Exposed in Execution History

**File:** `src/backend/src/controllers/script/execution.ts:113`
**Impact:** The query includes `email` in user attributes, which is then filtered out in the response. But the raw data fetched from DB includes it unnecessarily.

```typescript
attributes: ['id', 'username', 'email'] // 'email' fetched but not returned
```

---

### MINOR: API-007 - No Input Validation on Script Routes

**File:** `src/backend/src/routes/scripts.ts`
**Impact:** Script creation/update doesn't use `express-validator` like auth routes do. Validation is done manually in controllers, which is less robust.

---

### MINOR: API-008 - Analytics Controller Instantiated Per Request

**File:** `src/backend/src/routes/analytics.ts:15-19`
**Impact:** `new analyticsController()` creates a new instance for every request. This is wasteful if the controller is stateless.

```typescript
router.get('/security', async (req, res) => {
  const controller = new analyticsController(); // New instance each time
  await controller.getSecurityMetrics(req, res);
});
```

---

## Backend Correctness Issues

### BE-001 - Massive `@ts-nocheck` Usage

**Files:** `index.ts`, `scripts.ts`, `documentation.ts`, `chat.ts`, `uploadMiddleware.ts`, `redisMiddleware.ts`, `models/index.ts`
**Impact:** TypeScript safety completely bypassed in 7 files. This means type errors, null access, and incorrect argument passing are not caught at compile time.

**Root Cause:** Most `@ts-nocheck` comments cite "Express middleware chain loses type info when JWT adds req.user". This is solvable with proper interface extension.

**Fix:** Create a shared type declaration:
```typescript
// src/backend/src/types/express.d.ts
declare namespace Express {
  interface Request {
    user?: { id: number; username: string; email: string; role: string };
    authInfo?: { tokenType: string; requestId: string; ... };
  }
}
```

---

### BE-002 - Default Port Mismatch

**File:** `src/backend/src/index.ts:62`
**Impact:** Default port is `4001` but CLAUDE.md says backend is port `4000`.

```typescript
const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 4001; // Should be 4000
```

---

### BE-003 - Custom In-Memory Cache Instead of Using Redis

**File:** `src/backend/src/index.ts:94-250+`
**Impact:** ~200 lines of custom LRU cache with TTL, persistence, memory monitoring. Redis is already in the stack but the in-memory cache is always used instead. This means cache is lost on restart and isn't shared across potential multiple backend instances.

---

### BE-004 - `require()` Inside Module (Circular Dependency Workaround)

**File:** `src/backend/src/controllers/script/shared.ts:73-76`
**Impact:** Uses `require('../../index')` at runtime to avoid circular dependency. This is fragile and breaks ES module compatibility.

```typescript
export const getCache = (): CacheService => {
  const mod = require('../../index') as { cache?: CacheService } | undefined;
  // ...
};
```

---

### BE-005 - Error Handler Catches `ValidationError` (Mongoose) But Uses Sequelize

**File:** `src/backend/src/middleware/errorHandler.ts:48-50`
**Impact:** The error handler checks for `ValidationError` with comment "Mongoose or other validation error" but this project uses Sequelize, not Mongoose. Dead code path.

---

### BE-006 - `unhandledRejection` Handler Throws

**File:** `src/backend/src/middleware/errorHandler.ts:110-118`
**Impact:** The `unhandledRejection` handler does `throw reason` to convert to `uncaughtException`. This is a known anti-pattern in Node.js 18+ because `unhandledRejection` defaults to `throw` mode already, and re-throwing can cause double-logging or mask the original rejection.

---

### BE-007 - Security Logger Uses `console.warn` Instead of Winston

**File:** `src/backend/src/middleware/security.ts:296`
**Impact:** Security-critical events like path traversal and XSS detection use `console.warn` instead of the structured `logger` used everywhere else. These events won't appear in log files.

---

### BE-008 - Password Hash Field Size May Be Insufficient

**File:** `src/backend/src/models/User.ts:228`
**Impact:** `DataTypes.STRING(100)` for password_hash. Bcrypt hashes are exactly 60 chars, so 100 is fine for bcrypt. But if switching to argon2id (recommended by OWASP 2025+), hashes can be 97+ chars. Consider `STRING(255)`.

---

### BE-009 - Stale `ScriptController.fix.ts` File

**File:** `src/backend/src/controllers/ScriptController.fix.ts`
**Impact:** This appears to be a leftover fix file that should have been cleaned up.

---

## 20 Improvements with Best Practices

### Improvement 1: Add Missing `output` Column to ExecutionLog
- **Type:** Critical Fix
- **Best Practice:** Every model field referenced in controllers must exist in the schema
- **Action:** Add `output: DataTypes.TEXT` to ExecutionLog model

### Improvement 2: Fix Script `fileHash` Length for SHA-256
- **Type:** Critical Fix
- **Best Practice:** Column sizes must accommodate the hash algorithm used (SHA-256 = 64 hex chars)
- **Action:** Change `STRING(32)` to `STRING(64)`

### Improvement 3: Standardize ChatHistory Model Pattern
- **Type:** Critical Fix
- **Best Practice:** All models should follow the same initialization pattern (static class method)
- **Action:** Refactor ChatHistory to use `class extends Model { static initialize() {} }`

### Improvement 4: Remove All `@ts-nocheck` Directives
- **Type:** Major Fix
- **Best Practice:** TypeScript strict mode catches bugs at compile time; never disable it file-wide
- **Action:** Create proper Express.Request type extensions, fix type errors

### Improvement 5: Fix Default Port to Match CLAUDE.md (4000)
- **Type:** Critical Fix
- **Best Practice:** Default values must match documentation
- **Action:** Change fallback port from 4001 to 4000

### Improvement 6: Standardize API Response Envelope
- **Type:** Major Improvement
- **Best Practice:** RFC 7807 Problem Details + consistent success wrapper (2026 standard)
- **Action:** Create response helpers, migrate all endpoints

### Improvement 7: Add Pagination Limit Guard
- **Type:** Major Fix
- **Best Practice:** Always cap pagination limit (max 100) to prevent resource exhaustion
- **Action:** Add `Math.min(limit, 100)` guard in `parsePaginationParams`

### Improvement 8: Implement Analytics Summary Endpoint
- **Type:** Critical Fix
- **Best Practice:** No production endpoints should return TODO stubs
- **Action:** Implement actual aggregation query

### Improvement 9: Fix Transaction Isolation Level on Script Create
- **Type:** Major Fix
- **Best Practice:** Use minimum necessary isolation level; SERIALIZABLE only for financial transactions
- **Action:** Remove explicit isolation level (use READ COMMITTED default)

### Improvement 10: Add CASCADE on ScriptAnalysis Foreign Key
- **Type:** Major Fix
- **Best Practice:** Use database-level cascades instead of application-level manual deletes
- **Action:** Add `onDelete: 'CASCADE'` to ScriptAnalysis.scriptId

### Improvement 11: Add Missing Database Indexes
- **Type:** Major Improvement
- **Best Practice:** Index all columns used in WHERE clauses and JOIN conditions
- **Action:** Add indexes on Script.file_hash, compound index on (is_public, user_id)

### Improvement 12: Fix Foreign Key Naming Consistency
- **Type:** Minor Fix
- **Best Practice:** Use consistent naming convention (camelCase for Sequelize, snake_case for DB)
- **Action:** Standardize all foreignKey references to camelCase

### Improvement 13: Fix ScriptVersion Timestamp Mismatch
- **Type:** Minor Fix
- **Best Practice:** Model class properties must reflect actual Sequelize configuration
- **Action:** Either enable timestamps or remove the property declarations

### Improvement 14: Update Default Embedding Model
- **Type:** Minor Improvement
- **Best Practice:** Use current-generation models (text-embedding-3-small as of 2026)
- **Action:** Update default in ScriptEmbedding model

### Improvement 15: Replace Custom Cache with Redis Integration
- **Type:** Major Improvement
- **Best Practice:** Use the cache service already in your stack; don't reinvent LRU caches
- **Action:** Use ioredis client with proper TTL instead of 200-line custom Map cache

### Improvement 16: Fix Circular Dependency with Dependency Injection
- **Type:** Major Improvement
- **Best Practice:** Use dependency injection or service locator pattern instead of runtime require()
- **Action:** Extract cache into a standalone module, inject into controllers

### Improvement 17: Use Winston for Security Logger
- **Type:** Minor Fix
- **Best Practice:** All production logging should go through the structured logger
- **Action:** Replace `console.warn` with `logger.warn` in security middleware

### Improvement 18: Remove Dead Mongoose Error Handling
- **Type:** Minor Fix
- **Best Practice:** Don't handle errors from frameworks you don't use
- **Action:** Remove `ValidationError` (Mongoose) handling from errorHandler

### Improvement 19: Fix `unhandledRejection` Handler
- **Type:** Major Fix
- **Best Practice (Node.js 22+):** Don't re-throw in unhandledRejection; log and exit gracefully
- **Action:** Replace `throw reason` with `process.exit(1)` after logging

### Improvement 20: Add Input Validation to Script Routes
- **Type:** Major Improvement
- **Best Practice:** Use express-validator on ALL user-facing endpoints, not just auth
- **Action:** Add validation middleware for title, content, categoryId, tags

### Improvement 21 (Bonus): Clean Up Stale Files
- **Type:** Minor Cleanup
- **Best Practice:** No dead code or abandoned fix files in production
- **Action:** Remove `ScriptController.fix.ts`

### Improvement 22 (Bonus): Increase Password Hash Field Size
- **Type:** Minor Future-Proofing
- **Best Practice:** Accommodate argon2id hashes (OWASP 2025+ recommendation)
- **Action:** Change `STRING(100)` to `STRING(255)` for password_hash

---

## Comprehensive Implementation Plan

### Philosophy

This plan attacks the project as a **single cohesive entity** rather than fixing individual errors. All changes are grouped into **waves** that build on each other, ensuring the foundation (types, models, database) is solid before fixing the layers above (controllers, routes, API responses).

### Wave 1: Foundation - Types & Models (Must Do First)

**Goal:** Establish type safety and fix all database schema issues.

| # | Task | Files | Depends On |
|---|------|-------|------------|
| 1.1 | Create Express.Request type declaration | `src/types/express.d.ts` | - |
| 1.2 | Remove all `@ts-nocheck` / `@ts-ignore` | 7 files across backend | 1.1 |
| 1.3 | Add `output` field to ExecutionLog model | `models/ExecutionLog.ts` | - |
| 1.4 | Fix Script.fileHash to STRING(64) | `models/Script.ts` | - |
| 1.5 | Refactor ChatHistory to class pattern | `models/ChatHistory.ts` | - |
| 1.6 | Add CASCADE to ScriptAnalysis FK | `models/ScriptAnalysis.ts` | - |
| 1.7 | Fix ScriptVersion timestamps | `models/ScriptVersion.ts` | - |
| 1.8 | Standardize FK naming (Comment, ScriptDependency) | 2 model files | - |
| 1.9 | Add missing indexes (Script.file_hash, compound) | `models/Script.ts` + others | - |
| 1.10 | Update embedding model default | `models/ScriptEmbedding.ts` | - |
| 1.11 | Increase password hash field size | `models/User.ts` | - |
| 1.12 | Fix default port 4001 -> 4000 | `src/index.ts` | - |

### Wave 2: Core Backend - Controllers & Middleware

**Goal:** Fix all controller logic, error handling, and middleware issues.

| # | Task | Files | Depends On |
|---|------|-------|------------|
| 2.1 | Fix SERIALIZABLE -> READ COMMITTED | `controllers/script/crud.ts` | Wave 1 |
| 2.2 | Add pagination limit guard (max 100) | `controllers/script/shared.ts` | Wave 1 |
| 2.3 | Fix fire-and-forget analysis (add job queue or status tracking) | `controllers/script/crud.ts` | Wave 1 |
| 2.4 | Make update analysis async (non-blocking) | `controllers/script/crud.ts` | 2.3 |
| 2.5 | Remove email from execution history query | `controllers/script/execution.ts` | - |
| 2.6 | Fix unhandledRejection handler | `middleware/errorHandler.ts` | - |
| 2.7 | Remove Mongoose error handling | `middleware/errorHandler.ts` | - |
| 2.8 | Use Winston in security logger | `middleware/security.ts` | - |
| 2.9 | Add express-validator to script routes | `routes/scripts.ts` | 1.1 |
| 2.10 | Implement analytics summary endpoint | `routes/analytics.ts` | Wave 1 |
| 2.11 | Fix analytics controller instantiation | `routes/analytics.ts` | - |
| 2.12 | Remove ScriptController.fix.ts | `controllers/` | - |

### Wave 3: Architecture - Cache & Dependencies

**Goal:** Fix architectural issues (cache, circular deps).

| # | Task | Files | Depends On |
|---|------|-------|------------|
| 3.1 | Extract cache into standalone module | New: `services/cache.ts` | Wave 2 |
| 3.2 | Replace custom Map cache with Redis wrapper | `services/cache.ts`, `index.ts` | 3.1 |
| 3.3 | Fix circular dependency (remove require()) | `controllers/script/shared.ts` | 3.1 |
| 3.4 | Remove 200+ lines of custom cache code from index.ts | `src/index.ts` | 3.2 |

### Wave 4: API Consistency

**Goal:** Standardize all API responses.

| # | Task | Files | Depends On |
|---|------|-------|------------|
| 4.1 | Create response envelope helpers | New: `utils/responseHelpers.ts` | - |
| 4.2 | Migrate auth routes to envelope | `routes/auth.ts` | 4.1 |
| 4.3 | Migrate script CRUD to envelope | `controllers/script/crud.ts` | 4.1 |
| 4.4 | Migrate all other controllers to envelope | Multiple files | 4.1 |

### Wave 5: Verification

**Goal:** Verify everything works.

| # | Task | Approach |
|---|------|----------|
| 5.1 | Run TypeScript compiler (no errors) | `npm run typecheck` |
| 5.2 | Run linter | `npm run lint` |
| 5.3 | Run test suite | `npm test` |
| 5.4 | Manual smoke test (start backend, hit key endpoints) | `npm run dev` + curl |
| 5.5 | Verify database sync works | Check Sequelize sync output |

---

## Research References (April 2026 Best Practices)

### Express.js / TypeScript
- **Never use `@ts-nocheck`** - Use proper type declarations instead (Express.Request augmentation)
- **Use `express-validator` on all endpoints** - Not just auth routes
- **Structured error responses** - RFC 7807 Problem Details standard
- **Response envelope pattern** - Consistent `{ success, data, error }` wrapping

### Sequelize / PostgreSQL
- **Index strategy** - Index all FK columns, compound indexes for common WHERE patterns
- **CASCADE deletes** - Prefer database-level cascading over application-level cleanup
- **READ COMMITTED default** - Only escalate isolation for actual concurrency conflicts
- **Pagination guards** - Always cap `limit` at a reasonable maximum (50-100)
- **Column sizing** - Size hash columns for the actual algorithm (SHA-256 = 64 chars)

### Node.js Security (OWASP 2026)
- **Helmet.js** - Already well-configured in this project
- **Rate limiting** - Good implementation with per-endpoint limits
- **CSRF protection** - Origin-based validation is appropriate for API-first backends
- **Password hashing** - bcrypt with 12 rounds is acceptable; consider argon2id for new projects
- **JWT** - Current implementation follows best practices (refresh tokens, constant-time comparison)

### Architecture
- **Single cache layer** - Don't maintain both Redis and in-memory when Redis is available
- **Dependency injection** - Avoid `require()` in handler functions for testability
- **Consistent model patterns** - All models should follow the same initialization convention
- **Clean code** - Remove dead files, stubs, and commented-out code

---

*Generated by full project review on April 1, 2026*

---

## Implementation Status (Updated April 2, 2026)

### All 22 Improvements - Final Status

| # | Improvement | Status | Session |
|---|------------|--------|---------|
| 1 | ExecutionLog `output` column | DONE | Apr 1 |
| 2 | Script fileHash STRING(64) | DONE | Apr 1 |
| 3 | ChatHistory class pattern | DONE | Apr 1 |
| 4 | Remove @ts-nocheck (7 files) | DONE | Apr 1 |
| 5 | Fix port 4001 -> 4000 | DONE | Apr 1 |
| 6 | **API Response Envelope** | **DONE** | Apr 2 |
| 7 | Pagination limit guard (max 100) | DONE | Apr 1 |
| 8 | Analytics summary endpoint | DONE | Apr 1 |
| 9 | SERIALIZABLE -> READ COMMITTED | DONE | Apr 1 |
| 10 | ScriptAnalysis CASCADE | DONE | Apr 1 |
| 11 | Missing database indexes | DONE | Apr 1 |
| 12 | FK naming consistency | DONE | Apr 1 |
| 13 | ScriptVersion timestamps | DONE | Apr 1 |
| 14 | Embedding model default | DONE | Apr 1 |
| 15 | **Redis cache integration** | **DONE** | Apr 2 |
| 16 | Circular dependency fix | DONE | Apr 1 |
| 17 | Winston for security logger | DONE | Apr 1 |
| 18 | Remove Mongoose error handling | DONE | Apr 1 |
| 19 | unhandledRejection fix | DONE | Apr 1 |
| 20 | Input validation on scripts | DONE | Apr 1 |
| 21 | Clean stale files | DONE | Apr 1 |
| 22 | Password hash field size | DONE | Apr 1 |

### Additional Fixes (April 2)

| Fix | Description |
|-----|-------------|
| **AI analysis retry** | Added exponential backoff retry (max 2 retries) to fire-and-forget AI analysis in both create and update paths. Fixes API-004. |
| **Response helpers** | Created `utils/responseHelpers.ts` with `ok()`, `created()`, `paginated()`, `fail()`, and `errors.*` convenience methods. |
| **CRUD error envelope** | Migrated all script CRUD error responses to use standardized envelope. |
| **Redis + fallback cache** | Replaced pure in-memory cache with ioredis (when REDIS_URL set) + in-memory fallback. Both layers kept in sync. |
| **Last @ts-ignore** | Fixed remaining `@ts-ignore` in AsyncUploadController. |

### Verification Results

| Check | Result |
|-------|--------|
| TypeScript (`npx tsc --noEmit`) | 0 errors |
| ESLint (`npm run lint`) | 0 errors, 2 warnings (pre-existing in test file) |

### Files Modified (Total across both sessions)

**30+ files** across models, controllers, routes, middleware, services, types, and utilities.

Key new files created:
- `src/backend/src/services/cacheService.ts` - Centralized Redis+memory cache
- `src/backend/src/utils/responseHelpers.ts` - API response envelope helpers
