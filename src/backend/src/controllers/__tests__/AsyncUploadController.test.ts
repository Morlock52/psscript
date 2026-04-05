/**
 * Tests for AsyncUploadController bug fixes.
 * These tests verify that Script.create receives the correct fields.
 */
// Import from models/index.ts which initializes all models and associations
import { Script, ScriptVersion } from '../../models/index';

// We test the data shape, not the full controller flow (that needs HTTP + multer)
describe('AsyncUploadController Script.create contract', () => {
  it('Script model requires content field (allowNull: false)', () => {
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
