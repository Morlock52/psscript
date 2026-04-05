// Import from models/index.ts which initializes all models and associations
import { Script, ScriptVersion } from '../index';

describe('Script model associations', () => {
  it('should have a hasMany association with ScriptVersion as "versions"', () => {
    const associations = Script.associations;
    expect(associations).toHaveProperty('versions');
    expect(associations.versions.associationType).toBe('HasMany');
  });
});
