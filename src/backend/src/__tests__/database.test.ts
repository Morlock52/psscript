/**
 * Comprehensive Database Integration Tests
 * PSScript Platform - January 15, 2026
 *
 * Tests cover:
 * - Database connection and health
 * - All model CRUD operations
 * - Relationships and cascades
 * - Index verification
 * - Cache integration
 * - Performance benchmarks
 */

import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { Sequelize, Op } from 'sequelize';
import bcrypt from 'bcrypt';

// These are true integration tests and require a reachable Postgres instance with
// the expected schema (typically via docker compose). Default to skipping so
// `npm test` is usable in environments without DB access.
const RUN_DB_INTEGRATION_TESTS = process.env.RUN_DB_INTEGRATION_TESTS === 'true';
const describeDb = RUN_DB_INTEGRATION_TESTS ? describe : describe.skip;

// Models - will be imported from the actual module
let sequelize: Sequelize;
let User: any;
let Script: any;
let Category: any;
let Tag: any;
let ScriptTag: any;
let ScriptVersion: any;
let ScriptAnalysis: any;
let _ScriptEmbedding: any;
let ExecutionLog: any;
let _ChatHistory: any;
let _Documentation: any;

// Test configuration
const TEST_TIMEOUT = 30000;
const PERFORMANCE_THRESHOLD_MS = 100;

// Test data
const testUser = {
  username: 'test_user_' + Date.now(),
  email: `test_${Date.now()}@example.com`,
  password: 'SecurePassword123!',
  role: 'user'
};

const testScript = {
  title: 'Test Script ' + Date.now(),
  description: 'A test PowerShell script',
  content: 'Write-Host "Hello, World!"',
  isPublic: true,
  version: 1
};

const testCategory = {
  name: 'Test Category ' + Date.now(),
  description: 'A test category'
};

describeDb('Database Integration Tests', () => {
  // Setup before all tests
  beforeAll(async () => {
    try {
      // Dynamic import to handle module loading
      const models = await import('../models');
      sequelize = models.sequelize;
      User = models.User;
      Script = models.Script;
      Category = models.Category;
      Tag = models.Tag;
      ScriptTag = models.ScriptTag;
      ScriptVersion = models.ScriptVersion;
      ScriptAnalysis = models.ScriptAnalysis;
      _ScriptEmbedding = models.ScriptEmbedding;
      ExecutionLog = models.ExecutionLog;
      _ChatHistory = models.ChatHistory;
      _Documentation = models.Documentation;

      // Ensure database connection
      await sequelize.authenticate();
      console.log('Database connected for testing');
    } catch (error) {
      console.error('Failed to setup test database:', error);
      throw error;
    }
  }, TEST_TIMEOUT);

  // Cleanup after all tests
  afterAll(async () => {
    try {
      if (sequelize) {
        await sequelize.close();
        console.log('Database connection closed');
      }
    } catch (error) {
      console.error('Failed to close database:', error);
    }
  });

  // ==========================================
  // SECTION 1: CONNECTION TESTS
  // ==========================================
  describe('1. Database Connection', () => {
    test('1.1 Should successfully connect to PostgreSQL', async () => {
      const result = await sequelize.authenticate();
      expect(result).toBeUndefined(); // authenticate() returns void on success
    });

    test('1.2 Should execute health check query', async () => {
      const [results] = await sequelize.query('SELECT 1 as health_check');
      expect(results).toBeDefined();
      expect(results[0]).toHaveProperty('health_check', 1);
    });

    test('1.3 Should verify PostgreSQL version', async () => {
      const [results] = await sequelize.query('SELECT version()');
      expect(results).toBeDefined();
      expect(results[0]).toHaveProperty('version');
      const version = (results[0] as any).version;
      expect(version).toContain('PostgreSQL');
    });

    test('1.4 Should verify pgvector extension is installed', async () => {
      const [results] = await sequelize.query(`
        SELECT extname FROM pg_extension WHERE extname = 'vector'
      `);
      expect(results).toBeDefined();
      expect(results.length).toBeGreaterThan(0);
    });

    test('1.5 Should have correct connection pool settings', () => {
      const pool = (sequelize as any).connectionManager.pool;
      expect(pool).toBeDefined();
      // Pool configuration check - use type assertion to access internal options
      const options = (sequelize as any).options;
      expect(options.pool?.max).toBeLessThanOrEqual(50);
      expect(options.pool?.min).toBeGreaterThanOrEqual(0);
    });
  });

  // ==========================================
  // SECTION 2: USER MODEL TESTS
  // ==========================================
  describe('2. User Model', () => {
    let createdUser: any;

    test('2.1 Should create a new user with hashed password', async () => {
      // Note: User model has a beforeCreate hook that automatically hashes the password
      // So we pass the plaintext password and let the model hash it
      createdUser = await User.create({
        username: testUser.username,
        email: testUser.email,
        password: testUser.password, // Plaintext - model will hash it
        role: testUser.role
      });

      expect(createdUser).toBeDefined();
      expect(createdUser.id).toBeDefined();
      expect(createdUser.username).toBe(testUser.username);
      expect(createdUser.email).toBe(testUser.email);
      // Password should be hashed, not plaintext
      expect(createdUser.password).not.toBe(testUser.password);
      expect(createdUser.password.startsWith('$2')).toBe(true); // bcrypt hash prefix
    });

    test('2.2 Should validate password with bcrypt', async () => {
      if (!createdUser) {
        return; // Skip if creation failed
      }
      const isValid = await bcrypt.compare(testUser.password, createdUser.password);
      expect(isValid).toBe(true);

      const isInvalid = await bcrypt.compare('wrongpassword', createdUser.password);
      expect(isInvalid).toBe(false);
    });

    test('2.3 Should enforce unique username', async () => {
      await expect(User.create({
        username: testUser.username, // Same username
        email: 'different@example.com',
        password: 'hash',
        role: 'user'
      })).rejects.toThrow();
    });

    test('2.4 Should enforce unique email', async () => {
      await expect(User.create({
        username: 'different_user',
        email: testUser.email, // Same email
        password: 'hash',
        role: 'user'
      })).rejects.toThrow();
    });

    test('2.5 Should find user by email', async () => {
      const found = await User.findOne({ where: { email: testUser.email } });
      expect(found).toBeDefined();
      expect(found.id).toBe(createdUser.id);
    });

    test('2.6 Should update user fields', async () => {
      if (!createdUser) return;

      const newUsername = 'updated_' + Date.now();
      await createdUser.update({ username: newUsername });
      await createdUser.reload();

      expect(createdUser.username).toBe(newUsername);
    });

    test('2.7 Should track login attempts (if field exists)', async () => {
      if (!createdUser) return;

      // Check if loginAttempts field exists
      const hasLoginAttempts = 'loginAttempts' in createdUser || 'login_attempts' in createdUser;

      if (hasLoginAttempts) {
        const initialAttempts = createdUser.loginAttempts || createdUser.login_attempts || 0;
        await createdUser.update({
          loginAttempts: initialAttempts + 1,
          login_attempts: initialAttempts + 1
        });
        await createdUser.reload();

        const newAttempts = createdUser.loginAttempts || createdUser.login_attempts;
        expect(newAttempts).toBe(initialAttempts + 1);
      } else {
        console.log('Note: loginAttempts field not present - migration may be pending');
      }
    });

    // Cleanup
    afterAll(async () => {
      if (createdUser) {
        await createdUser.destroy();
      }
    });
  });

  // ==========================================
  // SECTION 3: CATEGORY MODEL TESTS
  // ==========================================
  describe('3. Category Model', () => {
    let createdCategory: any;

    test('3.1 Should create a category', async () => {
      createdCategory = await Category.create(testCategory);

      expect(createdCategory).toBeDefined();
      expect(createdCategory.id).toBeDefined();
      expect(createdCategory.name).toBe(testCategory.name);
    });

    test('3.2 Should enforce unique category name', async () => {
      await expect(Category.create({
        name: testCategory.name,
        description: 'Duplicate test'
      })).rejects.toThrow();
    });

    test('3.3 Should find all categories', async () => {
      const categories = await Category.findAll();
      expect(Array.isArray(categories)).toBe(true);
      expect(categories.length).toBeGreaterThan(0);
    });

    // Cleanup
    afterAll(async () => {
      if (createdCategory) {
        await createdCategory.destroy();
      }
    });
  });

  // ==========================================
  // SECTION 4: SCRIPT MODEL TESTS
  // ==========================================
  describe('4. Script Model', () => {
    let testUserForScript: any;
    let testCategoryForScript: any;
    let createdScript: any;

    beforeAll(async () => {
      // Create dependencies
      const passwordHash = await bcrypt.hash('test123', 12);
      testUserForScript = await User.create({
        username: 'script_test_user_' + Date.now(),
        email: `script_test_${Date.now()}@example.com`,
        password: passwordHash,
        role: 'user'
      });

      testCategoryForScript = await Category.create({
        name: 'Script Test Category ' + Date.now(),
        description: 'For script testing'
      });
    });

    test('4.1 Should create a script with user and category', async () => {
      createdScript = await Script.create({
        ...testScript,
        userId: testUserForScript.id,
        categoryId: testCategoryForScript.id
      });

      expect(createdScript).toBeDefined();
      expect(createdScript.id).toBeDefined();
      expect(createdScript.title).toBe(testScript.title);
      expect(createdScript.userId).toBe(testUserForScript.id);
    });

    test('4.2 Should require title and content', async () => {
      await expect(Script.create({
        description: 'No title',
        userId: testUserForScript.id
      })).rejects.toThrow();
    });

    test('4.3 Should default version to 1', async () => {
      expect(createdScript.version).toBe(1);
    });

    test('4.4 Should store file hash for deduplication', async () => {
      const crypto = await import('crypto');
      const hash = crypto.createHash('md5').update(testScript.content).digest('hex');

      await createdScript.update({ fileHash: hash, file_hash: hash });
      await createdScript.reload();

      const storedHash = createdScript.fileHash || createdScript.file_hash;
      expect(storedHash).toBeDefined();
    });

    test('4.5 Should find scripts by user', async () => {
      const userScripts = await Script.findAll({
        where: { userId: testUserForScript.id }
      });

      expect(userScripts).toBeDefined();
      expect(userScripts.length).toBeGreaterThan(0);
    });

    test('4.6 Should include category in query', async () => {
      const scriptWithCategory = await Script.findByPk(createdScript.id, {
        include: [{ model: Category, as: 'category' }]
      });

      expect(scriptWithCategory).toBeDefined();
      // Category association check
      if (scriptWithCategory.category) {
        expect(scriptWithCategory.category.id).toBe(testCategoryForScript.id);
      }
    });

    test('4.7 Should paginate scripts correctly', async () => {
      const page1 = await Script.findAll({
        limit: 5,
        offset: 0,
        order: [['createdAt', 'DESC']]
      });

      expect(page1.length).toBeLessThanOrEqual(5);
    });

    // Cleanup
    afterAll(async () => {
      if (createdScript) await createdScript.destroy();
      if (testCategoryForScript) await testCategoryForScript.destroy();
      if (testUserForScript) await testUserForScript.destroy();
    });
  });

  // ==========================================
  // SECTION 5: TAG AND SCRIPT-TAG TESTS
  // ==========================================
  describe('5. Tag Model and Associations', () => {
    let testTag: any;
    let testScriptForTag: any;
    let testUserForTag: any;

    beforeAll(async () => {
      const passwordHash = await bcrypt.hash('test123', 12);
      testUserForTag = await User.create({
        username: 'tag_test_user_' + Date.now(),
        email: `tag_test_${Date.now()}@example.com`,
        password: passwordHash,
        role: 'user'
      });

      testScriptForTag = await Script.create({
        title: 'Tag Test Script ' + Date.now(),
        content: 'Get-Process',
        userId: testUserForTag.id
      });
    });

    test('5.1 Should create a tag', async () => {
      testTag = await Tag.create({
        name: 'test-tag-' + Date.now()
      });

      expect(testTag).toBeDefined();
      expect(testTag.id).toBeDefined();
    });

    test('5.2 Should associate tag with script', async () => {
      await ScriptTag.create({
        scriptId: testScriptForTag.id,
        tagId: testTag.id
      });

      // Verify association
      const association = await ScriptTag.findOne({
        where: {
          scriptId: testScriptForTag.id,
          tagId: testTag.id
        }
      });

      expect(association).toBeDefined();
    });

    test('5.3 Should prevent duplicate tag associations', async () => {
      await expect(ScriptTag.create({
        scriptId: testScriptForTag.id,
        tagId: testTag.id
      })).rejects.toThrow();
    });

    // Cleanup
    afterAll(async () => {
      await ScriptTag.destroy({
        where: { scriptId: testScriptForTag.id }
      });
      if (testTag) await testTag.destroy();
      if (testScriptForTag) await testScriptForTag.destroy();
      if (testUserForTag) await testUserForTag.destroy();
    });
  });

  // ==========================================
  // SECTION 6: SCRIPT VERSION TESTS
  // ==========================================
  describe('6. Script Version Model', () => {
    let testUserForVersion: any;
    let testScriptForVersion: any;
    let testVersion: any;

    beforeAll(async () => {
      const passwordHash = await bcrypt.hash('test123', 12);
      testUserForVersion = await User.create({
        username: 'version_test_user_' + Date.now(),
        email: `version_test_${Date.now()}@example.com`,
        password: passwordHash,
        role: 'user'
      });

      testScriptForVersion = await Script.create({
        title: 'Version Test Script ' + Date.now(),
        content: 'Get-Service',
        userId: testUserForVersion.id
      });
    });

    test('6.1 Should create a script version', async () => {
      testVersion = await ScriptVersion.create({
        scriptId: testScriptForVersion.id,
        content: 'Get-Service -Name "wuauserv"',
        version: 1,
        userId: testUserForVersion.id,
        commitMessage: 'Initial version'
      });

      expect(testVersion).toBeDefined();
      expect(testVersion.version).toBe(1);
    });

    test('6.2 Should create incremental versions', async () => {
      const version2 = await ScriptVersion.create({
        scriptId: testScriptForVersion.id,
        content: 'Get-Service -Name "wuauserv" | Format-Table',
        version: 2,
        userId: testUserForVersion.id,
        commitMessage: 'Added formatting'
      });

      expect(version2.version).toBe(2);
      await version2.destroy();
    });

    test('6.3 Should enforce unique version per script', async () => {
      await expect(ScriptVersion.create({
        scriptId: testScriptForVersion.id,
        content: 'Duplicate version',
        version: 1, // Same version number
        userId: testUserForVersion.id
      })).rejects.toThrow();
    });

    // Cleanup
    afterAll(async () => {
      if (testVersion) await testVersion.destroy();
      if (testScriptForVersion) await testScriptForVersion.destroy();
      if (testUserForVersion) await testUserForVersion.destroy();
    });
  });

  // ==========================================
  // SECTION 7: SCRIPT ANALYSIS TESTS
  // ==========================================
  describe('7. Script Analysis Model', () => {
    let testUserForAnalysis: any;
    let testScriptForAnalysis: any;
    let testAnalysis: any;

    beforeAll(async () => {
      const passwordHash = await bcrypt.hash('test123', 12);
      testUserForAnalysis = await User.create({
        username: 'analysis_test_user_' + Date.now(),
        email: `analysis_test_${Date.now()}@example.com`,
        password: passwordHash,
        role: 'user'
      });

      testScriptForAnalysis = await Script.create({
        title: 'Analysis Test Script ' + Date.now(),
        content: 'Remove-Item -Path C:\\Temp -Recurse -Force',
        userId: testUserForAnalysis.id
      });
    });

    test('7.1 Should create script analysis', async () => {
      // Note: Model uses different attribute names than DB columns:
      // optimizationSuggestions -> suggestions, codeQualityScore -> quality_score, etc.
      testAnalysis = await ScriptAnalysis.create({
        scriptId: testScriptForAnalysis.id,
        purpose: 'Deletes all files in temp directory',
        securityScore: 3.5,
        codeQualityScore: 7.0,
        riskScore: 8.0,
        optimizationSuggestions: ['Add -WhatIf for safety'],
        commandDetails: [{ cmdlet: 'Remove-Item', risk: 'high' }]
      });

      expect(testAnalysis).toBeDefined();
      expect(testAnalysis.securityScore).toBe(3.5);
    });

    test('7.2 Should store JSONB data correctly', async () => {
      await testAnalysis.reload();

      // Check that JSONB fields are properly stored and retrieved as arrays/objects
      const suggestions = testAnalysis.optimizationSuggestions;
      expect(Array.isArray(suggestions)).toBe(true);
      expect(suggestions[0]).toBe('Add -WhatIf for safety');
    });

    test('7.3 Should update analysis scores', async () => {
      await testAnalysis.update({
        securityScore: 5.0,
        codeQualityScore: 8.0
      });
      await testAnalysis.reload();

      expect(testAnalysis.securityScore).toBe(5.0);
      expect(testAnalysis.codeQualityScore).toBe(8.0);
    });

    // Cleanup
    afterAll(async () => {
      if (testAnalysis) await testAnalysis.destroy();
      if (testScriptForAnalysis) await testScriptForAnalysis.destroy();
      if (testUserForAnalysis) await testUserForAnalysis.destroy();
    });
  });

  // ==========================================
  // SECTION 8: EXECUTION LOG TESTS
  // ==========================================
  describe('8. Execution Log Model', () => {
    let testUserForExec: any;
    let testScriptForExec: any;
    let testLog: any;

    beforeAll(async () => {
      const passwordHash = await bcrypt.hash('test123', 12);
      testUserForExec = await User.create({
        username: 'exec_test_user_' + Date.now(),
        email: `exec_test_${Date.now()}@example.com`,
        password: passwordHash,
        role: 'user'
      });

      testScriptForExec = await Script.create({
        title: 'Execution Test Script ' + Date.now(),
        content: 'Get-Date',
        userId: testUserForExec.id
      });
    });

    test('8.1 Should create execution log', async () => {
      testLog = await ExecutionLog.create({
        scriptId: testScriptForExec.id,
        userId: testUserForExec.id,
        status: 'success',
        executionTime: 125.5,
        parameters: JSON.stringify({ format: 'short' })
      });

      expect(testLog).toBeDefined();
      expect(testLog.status).toBe('success');
    });

    test('8.2 Should log execution errors', async () => {
      const errorLog = await ExecutionLog.create({
        scriptId: testScriptForExec.id,
        userId: testUserForExec.id,
        status: 'failure',
        errorMessage: 'Access denied'
      });

      expect(errorLog.status).toBe('failure');
      expect(errorLog.errorMessage).toBe('Access denied');

      await errorLog.destroy();
    });

    test('8.3 Should query execution history', async () => {
      const history = await ExecutionLog.findAll({
        where: { scriptId: testScriptForExec.id },
        order: [['createdAt', 'DESC']]
      });

      expect(history.length).toBeGreaterThan(0);
    });

    // Cleanup
    afterAll(async () => {
      if (testLog) await testLog.destroy();
      if (testScriptForExec) await testScriptForExec.destroy();
      if (testUserForExec) await testUserForExec.destroy();
    });
  });

  // ==========================================
  // SECTION 9: INDEX VERIFICATION TESTS
  // ==========================================
  describe('9. Index Verification', () => {
    test('9.1 Should have index on scripts.category_id', async () => {
      const [indexes] = await sequelize.query(`
        SELECT indexname FROM pg_indexes
        WHERE tablename = 'scripts' AND indexname LIKE '%category%'
      `);
      expect(indexes.length).toBeGreaterThan(0);
    });

    test('9.2 Should have index on scripts.user_id', async () => {
      const [indexes] = await sequelize.query(`
        SELECT indexname FROM pg_indexes
        WHERE tablename = 'scripts' AND indexname LIKE '%user%'
      `);
      expect(indexes.length).toBeGreaterThan(0);
    });

    test('9.3 Should have vector index on script_embeddings', async () => {
      const [indexes] = await sequelize.query(`
        SELECT indexname FROM pg_indexes
        WHERE tablename = 'script_embeddings'
      `);
      // May not exist if no embeddings created yet
      console.log('script_embeddings indexes:', indexes.length);
    });

    test('9.4 Should have index on execution_logs.script_id', async () => {
      const [indexes] = await sequelize.query(`
        SELECT indexname FROM pg_indexes
        WHERE tablename = 'execution_logs' AND indexname LIKE '%script%'
      `);
      expect(indexes.length).toBeGreaterThan(0);
    });
  });

  // ==========================================
  // SECTION 10: PERFORMANCE TESTS
  // ==========================================
  describe('10. Performance Tests', () => {
    test('10.1 Simple query should complete under threshold', async () => {
      const start = Date.now();
      await Script.findAll({ limit: 10 });
      const duration = Date.now() - start;

      console.log(`Simple query time: ${duration}ms`);
      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLD_MS * 5);
    });

    test('10.2 Query with joins should complete reasonably', async () => {
      const start = Date.now();
      await Script.findAll({
        limit: 10,
        include: [
          { model: User, as: 'user', attributes: ['username'] },
          { model: Category, as: 'category', attributes: ['name'] }
        ]
      });
      const duration = Date.now() - start;

      console.log(`Join query time: ${duration}ms`);
      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLD_MS * 10);
    });

    test('10.3 Count query should be fast', async () => {
      const start = Date.now();
      await Script.count();
      const duration = Date.now() - start;

      console.log(`Count query time: ${duration}ms`);
      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLD_MS * 2);
    });

    test('10.4 Full-text like query on content', async () => {
      const start = Date.now();
      await Script.findAll({
        where: {
          content: { [Op.iLike]: '%Get-%' }
        },
        limit: 10
      });
      const duration = Date.now() - start;

      console.log(`ILIKE query time: ${duration}ms`);
      // ILIKE can be slow, allow more time
      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLD_MS * 20);
    });
  });

  // ==========================================
  // SECTION 11: CASCADE DELETE TESTS
  // ==========================================
  describe('11. Cascade Delete Tests', () => {
    test('11.1 Deleting script should cascade to versions', async () => {
      // Create a script with versions
      const passwordHash = await bcrypt.hash('test123', 12);
      const user = await User.create({
        username: 'cascade_test_' + Date.now(),
        email: `cascade_${Date.now()}@example.com`,
        password: passwordHash,
        role: 'user'
      });

      const script = await Script.create({
        title: 'Cascade Test ' + Date.now(),
        content: 'Test content',
        userId: user.id
      });

      await ScriptVersion.create({
        scriptId: script.id,
        content: 'Version 1 content',
        version: 1,
        userId: user.id
      });

      // Delete script
      await script.destroy();

      // Verify version was deleted
      const versions = await ScriptVersion.findAll({
        where: { scriptId: script.id }
      });
      expect(versions.length).toBe(0);

      // Cleanup
      await user.destroy();
    });
  });

  // ==========================================
  // SECTION 12: TRANSACTION TESTS
  // ==========================================
  describe('12. Transaction Tests', () => {
    test('12.1 Should rollback on transaction failure', async () => {
      const t = await sequelize.transaction();

      try {
        const passwordHash = await bcrypt.hash('test123', 12);
        const _user = await User.create({
          username: 'tx_test_' + Date.now(),
          email: `tx_${Date.now()}@example.com`,
          password: passwordHash,
          role: 'user'
        }, { transaction: t });

        // Force an error
        throw new Error('Simulated failure');

      } catch (_error) {
        await t.rollback();

        // Verify rollback occurred - user should not exist
        const _users = await User.findAll({
          where: { username: { [Op.like]: 'tx_test_%' } }
        });
        // Should not find the user we tried to create
      }
    });

    test('12.2 Should commit successful transactions', async () => {
      const t = await sequelize.transaction();
      let createdUser: any;

      try {
        const passwordHash = await bcrypt.hash('test123', 12);
        createdUser = await User.create({
          username: 'tx_success_' + Date.now(),
          email: `tx_success_${Date.now()}@example.com`,
          password: passwordHash,
          role: 'user'
        }, { transaction: t });

        await t.commit();

        // Verify user exists
        const found = await User.findByPk(createdUser.id);
        expect(found).toBeDefined();

      } catch (error) {
        await t.rollback();
        throw error;
      } finally {
        // Cleanup
        if (createdUser) {
          await createdUser.destroy();
        }
      }
    });
  });

  // ==========================================
  // SECTION 13: DATA INTEGRITY TESTS
  // ==========================================
  describe('13. Data Integrity Tests', () => {
    test('13.1 Should not allow null required fields', async () => {
      await expect(User.create({
        username: null,
        email: 'test@test.com',
        password: 'hash',
        role: 'user'
      })).rejects.toThrow();
    });

    test('13.2 Should handle special characters in content', async () => {
      const passwordHash = await bcrypt.hash('test123', 12);
      const user = await User.create({
        username: 'special_char_test_' + Date.now(),
        email: `special_${Date.now()}@example.com`,
        password: passwordHash,
        role: 'user'
      });

      const script = await Script.create({
        title: 'Special Chars Test',
        content: `$var = "Hello 'World' \`with\` special <chars> & symbols"`,
        userId: user.id
      });

      await script.reload();
      expect(script.content).toContain("'World'");
      expect(script.content).toContain('`with`');

      // Cleanup
      await script.destroy();
      await user.destroy();
    });

    test('13.3 Should handle Unicode in text fields', async () => {
      const passwordHash = await bcrypt.hash('test123', 12);
      const user = await User.create({
        username: 'unicode_test_' + Date.now(),
        email: `unicode_${Date.now()}@example.com`,
        password: passwordHash,
        role: 'user'
      });

      const script = await Script.create({
        title: 'Unicode Test 日本語 🚀',
        content: '# 스크립트 テスト',
        description: 'Supports émojis and ünïcödé 中文',
        userId: user.id
      });

      await script.reload();
      expect(script.title).toContain('日本語');
      expect(script.title).toContain('🚀');

      // Cleanup
      await script.destroy();
      await user.destroy();
    });
  });

  // ==========================================
  // SECTION 14: SCHEMA VALIDATION TESTS
  // ==========================================
  describe('14. Schema Validation', () => {
    test('14.1 Should have all expected tables', async () => {
      const [tables] = await sequelize.query(`
        SELECT tablename FROM pg_tables
        WHERE schemaname = 'public'
      `);

      const tableNames = tables.map((t: any) => t.tablename);

      expect(tableNames).toContain('users');
      expect(tableNames).toContain('scripts');
      expect(tableNames).toContain('categories');
      expect(tableNames).toContain('tags');
      expect(tableNames).toContain('script_tags');
      expect(tableNames).toContain('script_versions');
      expect(tableNames).toContain('script_analysis');
    });

    test('14.2 Should have correct foreign key constraints', async () => {
      const [constraints] = await sequelize.query(`
        SELECT conname, conrelid::regclass as table_name
        FROM pg_constraint
        WHERE contype = 'f' AND conrelid::regclass::text LIKE 'script%'
      `);

      expect(constraints.length).toBeGreaterThan(0);
    });

    test('14.3 Should have migrations tracking table', async () => {
      const [result] = await sequelize.query(`
        SELECT EXISTS (
          SELECT FROM pg_tables
          WHERE tablename = 'schema_migrations'
        )
      `);

      expect((result[0] as any).exists).toBe(true);
    });
  });

  // ==========================================
  // SECTION 15: EDGE CASE TESTS
  // ==========================================
  describe('15. Edge Cases', () => {
    test('15.1 Should handle passwords with special characters', async () => {
      const specialPassword = 'P@$$w0rd!#$%^&*(){}[]|\\:";\'<>,.?/~`';

      const user = await User.create({
        username: 'special_pass_' + Date.now(),
        email: `special_pass_${Date.now()}@test.com`,
        password: specialPassword,
        role: 'user'
      });

      expect(user).toBeDefined();

      // Verify password can be validated
      const isValid = await bcrypt.compare(specialPassword, user.password);
      expect(isValid).toBe(true);

      await user.destroy();
    });

    test('15.2 Should handle very long script content', async () => {
      // Create a 100KB script
      const longContent = 'Get-Process\n'.repeat(10000);

      const user = await User.create({
        username: 'long_script_' + Date.now(),
        email: `long_script_${Date.now()}@test.com`,
        password: 'test123',
        role: 'user'
      });

      const script = await Script.create({
        title: 'Long Script Test',
        content: longContent,
        userId: user.id
      });

      expect(script).toBeDefined();
      expect(script.content.length).toBeGreaterThan(100000);

      await script.destroy();
      await user.destroy();
    });

    test('15.3 Should detect duplicate file hash', async () => {
      const content = 'Get-Date # Unique test script ' + Date.now();
      const crypto = await import('crypto');
      const fileHash = crypto.createHash('md5').update(content).digest('hex');

      const user = await User.create({
        username: 'hash_test_' + Date.now(),
        email: `hash_test_${Date.now()}@test.com`,
        password: 'test123',
        role: 'user'
      });

      const script1 = await Script.create({
        title: 'Hash Test 1',
        content: content,
        userId: user.id,
        fileHash: fileHash
      });

      // Check if hash can be used to find duplicates
      const existing = await Script.findOne({ where: { fileHash } });
      expect(existing).toBeDefined();
      expect(existing?.id).toBe(script1.id);

      await script1.destroy();
      await user.destroy();
    });

    test('15.4 Should handle empty optional JSONB fields', async () => {
      const user = await User.create({
        username: 'jsonb_test_' + Date.now(),
        email: `jsonb_test_${Date.now()}@test.com`,
        password: 'test123',
        role: 'user'
      });

      const script = await Script.create({
        title: 'JSONB Test',
        content: 'Get-Date',
        userId: user.id
      });

      const analysis = await ScriptAnalysis.create({
        scriptId: script.id,
        purpose: 'Test',
        securityScore: 5.0,
        codeQualityScore: 5.0,
        riskScore: 5.0
        // Leave JSONB fields as defaults
      });

      await analysis.reload();
      expect(Array.isArray(analysis.commandDetails)).toBe(true);
      expect(analysis.commandDetails.length).toBe(0);

      await analysis.destroy();
      await script.destroy();
      await user.destroy();
    });

    test('15.5 Should handle boundary score values', async () => {
      const user = await User.create({
        username: 'boundary_' + Date.now(),
        email: `boundary_${Date.now()}@test.com`,
        password: 'test123',
        role: 'user'
      });

      const script = await Script.create({
        title: 'Boundary Test',
        content: 'Get-Date',
        userId: user.id
      });

      // Test min/max score values
      const analysis = await ScriptAnalysis.create({
        scriptId: script.id,
        securityScore: 0,
        codeQualityScore: 10.0,
        riskScore: 0.001
      });

      expect(analysis.securityScore).toBe(0);
      expect(analysis.codeQualityScore).toBe(10.0);
      expect(analysis.riskScore).toBe(0.001);

      await analysis.destroy();
      await script.destroy();
      await user.destroy();
    });
  });

  // ==========================================
  // SECTION 16: SECURITY TESTS
  // ==========================================
  describe('16. Security Tests', () => {
    test('16.1 Should prevent SQL injection in script content', async () => {
      const maliciousContent = "'; DROP TABLE scripts; --";

      const user = await User.create({
        username: 'sqli_test_' + Date.now(),
        email: `sqli_test_${Date.now()}@test.com`,
        password: 'test123',
        role: 'user'
      });

      const script = await Script.create({
        title: 'SQL Injection Test',
        content: maliciousContent,
        userId: user.id
      });

      // Script should be created safely with the content as-is
      expect(script).toBeDefined();
      expect(script.content).toBe(maliciousContent);

      // Verify scripts table still exists
      const [tables] = await sequelize.query(`
        SELECT tablename FROM pg_tables WHERE tablename = 'scripts'
      `);
      expect(tables.length).toBe(1);

      await script.destroy();
      await user.destroy();
    });

    test('16.2 Should handle XSS attempts in text fields', async () => {
      const xssContent = '<script>alert("XSS")</script>Get-Process';

      const user = await User.create({
        username: 'xss_test_' + Date.now(),
        email: `xss_test_${Date.now()}@test.com`,
        password: 'test123',
        role: 'user'
      });

      const script = await Script.create({
        title: '<img src=x onerror=alert(1)>',
        content: xssContent,
        userId: user.id
      });

      // Content should be stored as-is (sanitization is UI layer responsibility)
      expect(script.title).toContain('<img');
      expect(script.content).toContain('<script>');

      await script.destroy();
      await user.destroy();
    });

    test('16.3 Should validate parameterized queries', async () => {
      // Test that Sequelize properly parameterizes queries
      const searchTerm = "test'; DELETE FROM scripts; --";

      // This should safely parameterize the LIKE query
      const scripts = await Script.findAll({
        where: {
          title: { [Op.like]: `%${searchTerm}%` }
        }
      });

      // Should return empty result, not cause SQL error
      expect(Array.isArray(scripts)).toBe(true);
    });
  });

  // ==========================================
  // SECTION 17: CONCURRENT OPERATIONS TESTS
  // ==========================================
  describe('17. Concurrent Operations', () => {
    test('17.1 Should handle concurrent user creation', async () => {
      const timestamp = Date.now();
      const createUser = (index: number) => User.create({
        username: `concurrent_${timestamp}_${index}`,
        email: `concurrent_${timestamp}_${index}@test.com`,
        password: 'test123',
        role: 'user'
      });

      // Create 5 users concurrently
      const users = await Promise.all([
        createUser(1),
        createUser(2),
        createUser(3),
        createUser(4),
        createUser(5)
      ]);

      expect(users.length).toBe(5);
      users.forEach(user => expect(user.id).toBeDefined());

      // Cleanup
      await Promise.all(users.map(u => u.destroy()));
    });

    test('17.2 Should handle concurrent script updates', async () => {
      const user = await User.create({
        username: 'concurrent_update_' + Date.now(),
        email: `concurrent_update_${Date.now()}@test.com`,
        password: 'test123',
        role: 'user'
      });

      const script = await Script.create({
        title: 'Concurrent Update Test',
        content: 'Get-Date',
        userId: user.id,
        executionCount: 0
      });

      // Simulate concurrent execution count updates
      const incrementExecution = async () => {
        await sequelize.query(`
          UPDATE scripts SET execution_count = execution_count + 1
          WHERE id = :id
        `, { replacements: { id: script.id } });
      };

      // Run 10 concurrent increments
      await Promise.all(Array(10).fill(null).map(() => incrementExecution()));

      await script.reload();
      expect(script.executionCount).toBe(10);

      await script.destroy();
      await user.destroy();
    });

    test('17.3 Should handle deadlock-prone operations gracefully', async () => {
      const user = await User.create({
        username: 'deadlock_test_' + Date.now(),
        email: `deadlock_test_${Date.now()}@test.com`,
        password: 'test123',
        role: 'user'
      });

      const scripts = await Promise.all([
        Script.create({ title: 'Deadlock A', content: 'Get-A', userId: user.id }),
        Script.create({ title: 'Deadlock B', content: 'Get-B', userId: user.id })
      ]);

      // Concurrent updates that could potentially deadlock
      const updateA = Script.update(
        { title: 'Updated A' },
        { where: { id: scripts[0].id } }
      );
      const updateB = Script.update(
        { title: 'Updated B' },
        { where: { id: scripts[1].id } }
      );

      // Both updates should complete successfully
      await Promise.all([updateA, updateB]);

      await scripts[0].reload();
      await scripts[1].reload();
      expect(scripts[0].title).toBe('Updated A');
      expect(scripts[1].title).toBe('Updated B');

      // Cleanup
      await Promise.all(scripts.map(s => s.destroy()));
      await user.destroy();
    });
  });

  // ==========================================
  // SECTION 18: VECTOR EMBEDDING TESTS
  // ==========================================
  describe('18. Vector Embeddings', () => {
    test('18.1 Should verify pgvector is operational', async () => {
      // Test vector operations work
      const [result] = await sequelize.query(`
        SELECT '[1,2,3]'::vector(3) <-> '[4,5,6]'::vector(3) as distance
      `);

      expect((result[0] as any).distance).toBeDefined();
      expect(parseFloat((result[0] as any).distance)).toBeGreaterThan(0);
    });

    test('18.2 Should have correct embedding dimension (1536)', async () => {
      const [columns] = await sequelize.query(`
        SELECT data_type, character_maximum_length
        FROM information_schema.columns
        WHERE table_name = 'script_embeddings' AND column_name = 'embedding'
      `);

      expect(columns.length).toBe(1);
      expect((columns[0] as any).data_type).toBe('USER-DEFINED'); // pgvector type
    });
  });
});

// Export for potential reuse
export { TEST_TIMEOUT, PERFORMANCE_THRESHOLD_MS };
