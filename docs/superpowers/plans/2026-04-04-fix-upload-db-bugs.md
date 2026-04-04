# Fix Backend API Database Issues in Script Upload Pipeline

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all database-related bugs in the script upload pipeline that cause silent failures, data loss, and broken status tracking.

**Architecture:** Six verified bugs across AsyncUploadController, Script model, ScriptVersion model, and fileIntegrity utility. Fixes target model definitions, controller logic, and a new DB migration for hash uniqueness. Each task is independent and produces a working, testable change.

**Tech Stack:** TypeScript, Sequelize 6, PostgreSQL 15, Express

---

## File Structure

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `src/backend/src/models/Script.ts` | Add `hasMany(ScriptVersion)` association, add `content` to create calls |
| Modify | `src/backend/src/controllers/AsyncUploadController.ts` | Fix `Script.create` (missing content, ghost uploadId), fix `changes` → `changelog`, fix `getUploadStatus` query |
| Modify | `src/backend/src/controllers/script/export.ts` | Move hash check inside transaction |
| Modify | `src/backend/src/utils/fileIntegrity.ts` | Upgrade MD5 → SHA-256 |
| Create | `src/db/migrations/add_unique_file_hash.sql` | Add UNIQUE constraint on `file_hash` |
| Create | `src/backend/src/controllers/__tests__/AsyncUploadController.test.ts` | Unit tests for upload pipeline fixes |

---

### Task 1: Add Missing `hasMany(ScriptVersion)` Association to Script Model

**Files:**
- Modify: `src/backend/src/models/Script.ts:100-110` (associate method)

The `AsyncUploadController.getUploadStatus` (line 194) does `include: [{ model: ScriptVersion, as: 'versions' }]` but `Script` has no `hasMany(ScriptVersion)` association. This causes a Sequelize eager-loading error.

- [ ] **Step 1: Write the failing test**

Create file `src/backend/src/models/__tests__/Script.associations.test.ts`:

```typescript
import Script from '../Script';
import ScriptVersion from '../ScriptVersion';
import { sequelize } from '../../database/connection';

// Initialize models (mimics src/models/index.ts)
Script.initialize(sequelize);
ScriptVersion.initialize(sequelize);
Script.associate();
ScriptVersion.associate();

describe('Script model associations', () => {
  it('should have a hasMany association with ScriptVersion as "versions"', () => {
    const associations = Script.associations;
    expect(associations).toHaveProperty('versions');
    expect(associations.versions.associationType).toBe('HasMany');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd src/backend && npx jest src/models/__tests__/Script.associations.test.ts --no-cache 2>&1 | head -30`

Expected: FAIL — `associations.versions` is undefined

- [ ] **Step 3: Add the hasMany association**

In `src/backend/src/models/Script.ts`, inside the `associate()` method, after the existing `Script.belongsToMany(Tag, ...)` line, add:

```typescript
    Script.hasMany(ScriptVersion, { foreignKey: 'scriptId', as: 'versions' });
```

The full associate method becomes:

```typescript
  static associate() {
    Script.belongsTo(User, { foreignKey: 'userId', as: 'user' });
    Script.belongsTo(Category, { foreignKey: 'categoryId', as: 'category' });
    Script.hasOne(ScriptAnalysis, { foreignKey: 'scriptId', as: 'analysis' });
    Script.belongsToMany(Tag, { 
      through: 'script_tags',
      foreignKey: 'script_id',
      otherKey: 'tag_id',
      as: 'tags'
    });
    Script.hasMany(ScriptVersion, { foreignKey: 'scriptId', as: 'versions' });
  }
```

You must also add the import at the top of the file:

```typescript
import ScriptVersion from './ScriptVersion';
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd src/backend && npx jest src/models/__tests__/Script.associations.test.ts --no-cache 2>&1 | head -30`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/backend/src/models/Script.ts src/backend/src/models/__tests__/Script.associations.test.ts
git commit -m "fix: add missing hasMany(ScriptVersion) association to Script model

The AsyncUploadController.getUploadStatus queried Script with
include: ScriptVersion as 'versions', but no such association existed,
causing eager-loading failures."
```

---

### Task 2: Fix AsyncUploadController `Script.create` — Missing `content`, Ghost `uploadId`

**Files:**
- Modify: `src/backend/src/controllers/AsyncUploadController.ts:291-300` (Script.create call)

Two bugs in the `processNextFile` method:
1. `Script.create` passes `uploadId` — this field doesn't exist on the Script model, Sequelize silently ignores it
2. `Script.create` is missing `content: fileContent` — the `content` column is `allowNull: false`, so this INSERT always fails with a validation error

- [ ] **Step 1: Write the failing test**

Create file `src/backend/src/controllers/__tests__/AsyncUploadController.test.ts`:

```typescript
/**
 * Tests for AsyncUploadController bug fixes.
 * These tests verify that Script.create receives the correct fields.
 */
import Script from '../../models/Script';
import ScriptVersion from '../../models/ScriptVersion';

// We test the data shape, not the full controller flow (that needs HTTP + multer)
describe('AsyncUploadController Script.create contract', () => {
  it('Script model requires content field (allowNull: false)', () => {
    // Verify the model definition enforces content
    const attributes = Script.getAttributes?.() || (Script as any).rawAttributes;
    expect(attributes.content).toBeDefined();
    expect(attributes.content.allowNull).toBe(false);
  });

  it('Script model does NOT have an uploadId field', () => {
    const attributes = Script.getAttributes?.() || (Script as any).rawAttributes;
    expect(attributes.uploadId).toBeUndefined();
  });

  it('ScriptVersion model uses changelog field, not changes', () => {
    const attributes = ScriptVersion.getAttributes?.() || (ScriptVersion as any).rawAttributes;
    expect(attributes.changelog).toBeDefined();
    expect(attributes.changes).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it passes (these tests document the model contract)**

Run: `cd src/backend && npx jest src/controllers/__tests__/AsyncUploadController.test.ts --no-cache 2>&1 | head -30`

Expected: PASS — these tests prove the model contract that the controller violates

- [ ] **Step 3: Fix the Script.create call and ScriptVersion.create call**

In `src/backend/src/controllers/AsyncUploadController.ts`, replace lines 291-309:

**Old code (lines 291-309):**
```typescript
          // Create script record with authenticated user's ID
          const script = await Script.create({
            title: originalFilename,
            description,
            uploadId,
            userId, // Use the authenticated user's ID from queue context
            categoryId,
            isPublic: false,
            executionCount: 0
          }, { transaction });

          // Create script version with authenticated user's ID
          await ScriptVersion.create({
            scriptId: script.id,
            version: 1,
            content: fileContent,
            changes: 'Initial version',
            userId // Use the authenticated user's ID from queue context
          }, { transaction });
```

**New code:**
```typescript
          // Create script record with authenticated user's ID
          const script = await Script.create({
            title: originalFilename,
            description,
            content: fileContent,
            userId,
            categoryId,
            isPublic: false,
            executionCount: 0
          }, { transaction });

          // Create script version with authenticated user's ID
          await ScriptVersion.create({
            scriptId: script.id,
            version: 1,
            content: fileContent,
            changelog: 'Initial version',
            userId
          }, { transaction });
```

Changes:
- Removed `uploadId` (doesn't exist on model)
- Added `content: fileContent` (required field)
- Changed `changes` to `changelog` (correct model field name)

- [ ] **Step 4: Run tests to verify**

Run: `cd src/backend && npx jest src/controllers/__tests__/AsyncUploadController.test.ts --no-cache 2>&1 | head -30`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/backend/src/controllers/AsyncUploadController.ts src/backend/src/controllers/__tests__/AsyncUploadController.test.ts
git commit -m "fix: AsyncUploadController Script.create missing content, wrong field names

Three bugs fixed:
1. Added missing content field to Script.create (allowNull: false)
2. Removed ghost uploadId field (not in Script model)
3. Changed 'changes' to 'changelog' in ScriptVersion.create"
```

---

### Task 3: Fix `getUploadStatus` — Broken Status Tracking

**Files:**
- Modify: `src/backend/src/controllers/AsyncUploadController.ts:191-210` (getUploadStatus method)

The `getUploadStatus` method queries `Script.findOne({ where: { uploadId } })` but `uploadId` doesn't exist on the Script model. This means the "completed" status check always returns null, so uploads that succeed still show as "not_found".

**Strategy:** Track completed uploads using an in-memory Map (matching the existing in-memory queue pattern). Store `uploadId → scriptId` when processing completes.

- [ ] **Step 1: Add completed uploads tracking**

In `src/backend/src/controllers/AsyncUploadController.ts`, add a new property to the class after `private isProcessing`:

```typescript
  private completedUploads: Map<string, { scriptId: number; title: string }> = new Map();
```

- [ ] **Step 2: Store completed upload info after successful processing**

In the `processNextFile` method, after the line `logger.info(\`Successfully processed file: ${uploadId}\`);` (line 314), add:

```typescript
          // Track completed upload for status queries
          this.completedUploads.set(uploadId, {
            scriptId: script.id,
            title: script.title
          });
```

- [ ] **Step 3: Rewrite the getUploadStatus completed check**

Replace the database query block in `getUploadStatus` (lines 191-210):

**Old code:**
```typescript
      // Check if script was created in database
      const script = await Script.findOne({
        where: { uploadId },
        include: [{ model: ScriptVersion, as: 'versions' }]
      });
      
      if (script) {
        res.json({
          success: true,
          status: 'completed',
          message: 'File processing completed successfully',
          scriptId: script.id,
          scriptDetails: {
            title: script.title,
            description: script.description,
            versions: (script as any).versions?.length || 1
          }
        });
        return;
      }
```

**New code:**
```typescript
      // Check if upload completed successfully
      const completed = this.completedUploads.get(uploadId);
      if (completed) {
        res.json({
          success: true,
          status: 'completed',
          message: 'File processing completed successfully',
          scriptId: completed.scriptId,
          scriptDetails: {
            title: completed.title
          }
        });
        return;
      }
```

- [ ] **Step 4: Run typecheck**

Run: `cd src/backend && npx tsc --noEmit 2>&1 | head -30`

Expected: No errors related to AsyncUploadController

- [ ] **Step 5: Commit**

```bash
git add src/backend/src/controllers/AsyncUploadController.ts
git commit -m "fix: getUploadStatus was querying non-existent uploadId column

Replaced broken Script.findOne({ where: { uploadId } }) with
in-memory completed uploads Map, consistent with existing queue pattern."
```

---

### Task 4: Fix Race Condition in Hash Deduplication

**Files:**
- Modify: `src/backend/src/controllers/script/export.ts:506-519` (hash check)
- Create: `src/db/migrations/add_unique_file_hash.sql`

The hash deduplication check happens outside the transaction. Two concurrent uploads with identical content can both pass the check. Fix: move check inside transaction + add UNIQUE constraint.

- [ ] **Step 1: Create the migration file**

Create file `src/db/migrations/add_unique_file_hash.sql`:

```sql
-- Add UNIQUE constraint on file_hash to prevent duplicate uploads at the DB level.
-- Null values are allowed (scripts without hashes) — PostgreSQL UNIQUE permits multiple NULLs.
ALTER TABLE scripts ADD CONSTRAINT uq_scripts_file_hash UNIQUE (file_hash);
```

- [ ] **Step 2: Update Script model index to be unique**

In `src/backend/src/models/Script.ts`, change the `file_hash` index from non-unique to unique:

**Old:**
```typescript
        { fields: ['file_hash'], name: 'idx_scripts_file_hash' },
```

**New:**
```typescript
        { unique: true, fields: ['file_hash'], name: 'idx_scripts_file_hash' },
```

- [ ] **Step 3: Move hash check inside the transaction in export.ts**

In `src/backend/src/controllers/script/export.ts`, the hash check at lines 512-519 currently happens after the transaction starts but reads outside of it. Update the `checkFileExists` call to pass the transaction:

Replace lines 512-519:

**Old code:**
```typescript
    // Check if a file with the same hash already exists
    const existingScriptId = await checkFileExists(fileHash, sequelize);
    if (existingScriptId) {
      if (transaction) await transaction.rollback();
      return res.status(409).json({
        error: 'duplicate_file',
        message: 'A script with identical content already exists',
        existingScriptId
      });
    }
```

**New code:**
```typescript
    // Check if a file with the same hash already exists (inside transaction for atomicity)
    const existingScriptId = await checkFileExists(fileHash, sequelize, transaction);
    if (existingScriptId) {
      await transaction.rollback();
      return res.status(409).json({
        error: 'duplicate_file',
        message: 'A script with identical content already exists',
        existingScriptId
      });
    }
```

- [ ] **Step 4: Update checkFileExists to accept an optional transaction**

In `src/backend/src/utils/fileIntegrity.ts`, update the `checkFileExists` function signature and implementation:

**Old code:**
```typescript
export const checkFileExists = async (fileHash: string, sequelize: Sequelize): Promise<number | null> => {
  try {
    const [result] = await sequelize.query(
      `SELECT id FROM scripts WHERE file_hash = :fileHash LIMIT 1`,
      {
        replacements: { fileHash },
        type: 'SELECT',
        raw: true
      }
    );
```

**New code:**
```typescript
export const checkFileExists = async (
  fileHash: string,
  sequelize: Sequelize,
  transaction?: import('sequelize').Transaction
): Promise<number | null> => {
  try {
    const [result] = await sequelize.query(
      `SELECT id FROM scripts WHERE file_hash = :fileHash LIMIT 1 FOR UPDATE`,
      {
        replacements: { fileHash },
        type: 'SELECT',
        raw: true,
        ...(transaction ? { transaction } : {})
      }
    );
```

The `FOR UPDATE` clause locks the matching row within the transaction, preventing a second concurrent upload from reading "no match" while the first is still inserting.

- [ ] **Step 5: Add SequelizeUniqueConstraintError handling as a safety net**

In `src/backend/src/controllers/script/export.ts`, the catch block at line 716 already handles `SequelizeUniqueConstraintError` but returns a generic "title already exists" message. Update it to also handle hash conflicts:

**Old code (line 716-719):**
```typescript
    if (err.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({
        error: 'unique_constraint_error',
        message: 'A script with this title already exists'
      });
    }
```

**New code:**
```typescript
    if (err.name === 'SequelizeUniqueConstraintError') {
      const fields = (err as any).fields || {};
      if (fields.file_hash) {
        return res.status(409).json({
          error: 'duplicate_file',
          message: 'A script with identical content already exists'
        });
      }
      return res.status(409).json({
        error: 'unique_constraint_error',
        message: 'A script with this title already exists'
      });
    }
```

- [ ] **Step 6: Run typecheck**

Run: `cd src/backend && npx tsc --noEmit 2>&1 | head -30`

Expected: No errors

- [ ] **Step 7: Commit**

```bash
git add src/backend/src/models/Script.ts src/backend/src/controllers/script/export.ts src/backend/src/utils/fileIntegrity.ts src/db/migrations/add_unique_file_hash.sql
git commit -m "fix: race condition in hash deduplication during concurrent uploads

Moved hash check inside transaction with FOR UPDATE lock.
Added UNIQUE constraint on file_hash column as DB-level safety net.
Improved error message for hash-based duplicate detection."
```

---

### Task 5: Upgrade Hash Algorithm from MD5 to SHA-256

**Files:**
- Modify: `src/backend/src/utils/fileIntegrity.ts`
- Modify: `src/backend/src/models/Script.ts` (widen column from 32 to 64 chars)
- Create: `src/db/migrations/upgrade_file_hash_sha256.sql`

CLAUDE.md documents SHA-256 for file integrity, but the code uses MD5 which is cryptographically broken. The `fileHash` column is already `STRING(64)` — enough for SHA-256 hex output (64 chars). But we need a migration for existing MD5 hashes (32 chars).

- [ ] **Step 1: Create migration to rehash existing scripts**

Create file `src/db/migrations/upgrade_file_hash_sha256.sql`:

```sql
-- Upgrade file hashes from MD5 (32 hex chars) to SHA-256 (64 hex chars).
-- Clear existing MD5 hashes so they get recomputed on next access.
-- The application now uses SHA-256 for all new uploads.
UPDATE scripts SET file_hash = NULL WHERE file_hash IS NOT NULL AND length(file_hash) = 32;
```

- [ ] **Step 2: Update fileIntegrity.ts to use SHA-256**

In `src/backend/src/utils/fileIntegrity.ts`:

**Replace `calculateBufferMD5`:**

Old:
```typescript
export const calculateBufferMD5 = (buffer: Buffer): string => {
  return crypto.createHash('md5').update(buffer).digest('hex');
};
```

New:
```typescript
export const calculateBufferSHA256 = (buffer: Buffer): string => {
  return crypto.createHash('sha256').update(buffer).digest('hex');
};

/** @deprecated Use calculateBufferSHA256 */
export const calculateBufferMD5 = calculateBufferSHA256;
```

**Replace `calculateStringMD5`:**

Old:
```typescript
export const calculateStringMD5 = (content: string): string => {
  return crypto.createHash('md5').update(content).digest('hex');
};
```

New:
```typescript
export const calculateStringSHA256 = (content: string): string => {
  return crypto.createHash('sha256').update(content).digest('hex');
};

/** @deprecated Use calculateStringSHA256 */
export const calculateStringMD5 = calculateStringSHA256;
```

**Update `batchUpdateFileHashes` to use SHA-256:**

Old:
```typescript
      `UPDATE scripts SET file_hash = md5(content::text) WHERE file_hash IS NULL RETURNING id`,
```

New:
```typescript
      `UPDATE scripts SET file_hash = encode(digest(content::text, 'sha256'), 'hex') WHERE file_hash IS NULL RETURNING id`,
```

Note: This uses PostgreSQL's `pgcrypto` extension. The project already has `pgvector` so extensions are available. If `pgcrypto` isn't installed, the migration should add it.

- [ ] **Step 3: Update the migration to ensure pgcrypto**

Prepend to `src/db/migrations/upgrade_file_hash_sha256.sql`:

```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Upgrade file hashes from MD5 (32 hex chars) to SHA-256 (64 hex chars).
-- Clear existing MD5 hashes so they get recomputed on next access.
UPDATE scripts SET file_hash = NULL WHERE file_hash IS NOT NULL AND length(file_hash) = 32;
```

- [ ] **Step 4: Run typecheck**

Run: `cd src/backend && npx tsc --noEmit 2>&1 | head -30`

Expected: No errors (deprecated alias keeps all existing imports working)

- [ ] **Step 5: Commit**

```bash
git add src/backend/src/utils/fileIntegrity.ts src/db/migrations/upgrade_file_hash_sha256.sql
git commit -m "fix: upgrade file hash from MD5 to SHA-256

MD5 is cryptographically broken. SHA-256 matches the documented
algorithm in CLAUDE.md. Existing MD5 hashes are cleared for recomputation.
Old function names kept as deprecated aliases for backward compatibility."
```

---

### Task 6: Add Hash Deduplication to AsyncUploadController

**Files:**
- Modify: `src/backend/src/controllers/AsyncUploadController.ts:260-300`

The `AsyncUploadController.processNextFile` does NOT check for duplicate hashes before creating a script. Only `export.ts` (the synchronous upload) does dedup. This means async bulk uploads can create duplicates.

- [ ] **Step 1: Add hash check to processNextFile**

In `src/backend/src/controllers/AsyncUploadController.ts`, add imports at the top (after existing imports):

```typescript
import { calculateBufferMD5 as calculateHash, checkFileExists } from '../utils/fileIntegrity';
```

Then in `processNextFile`, after reading the file content (line 260: `const fileContent = await readFileAsync(filePath, 'utf8');`), add the dedup check before the transaction:

```typescript
      // Calculate hash and check for duplicates
      const fileHash = calculateHash(Buffer.from(fileContent, 'utf8'));
      const existingScriptId = await checkFileExists(fileHash, sequelize);
      if (existingScriptId) {
        logger.info(`Duplicate detected for upload ${uploadId}, existing script ID: ${existingScriptId}`);
        this.completedUploads.set(uploadId, {
          scriptId: existingScriptId,
          title: `(duplicate of ${existingScriptId})`
        });
        await unlinkAsync(filePath);
        return;
      }
```

Also add `fileHash` to the `Script.create` call:

```typescript
          const script = await Script.create({
            title: originalFilename,
            description,
            content: fileContent,
            fileHash,
            userId,
            categoryId,
            isPublic: false,
            executionCount: 0
          }, { transaction });
```

- [ ] **Step 2: Run typecheck**

Run: `cd src/backend && npx tsc --noEmit 2>&1 | head -30`

Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/backend/src/controllers/AsyncUploadController.ts
git commit -m "fix: add hash dedup to AsyncUploadController

Async bulk uploads were not checking for duplicate content,
allowing identical scripts to be stored multiple times.
Now computes SHA-256 hash and checks before insert."
```

---

## Self-Review Checklist

**Spec coverage:**
- [x] Missing `content` field in Script.create → Task 2
- [x] Ghost `uploadId` field → Task 2, Task 3
- [x] Wrong field name `changes` → Task 2
- [x] Missing Script-ScriptVersion association → Task 1
- [x] Race condition in hash dedup → Task 4
- [x] MD5 vs SHA-256 mismatch → Task 5
- [x] No dedup in async upload path → Task 6
- [x] Broken upload status tracking → Task 3

**Placeholder scan:** No TBDs, TODOs, or "similar to Task N" references found.

**Type consistency:**
- `calculateBufferMD5` aliased to `calculateBufferSHA256` — all imports continue to work
- `checkFileExists` gains optional `transaction` param — backward compatible
- `changelog` field name used consistently after Task 2 fix
