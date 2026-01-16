# ScriptController Migration Roadmap

## Overview

This document outlines the migration plan for splitting the monolithic `ScriptController.ts` (23 methods, 2600+ lines) into focused, type-safe modules.

## Current State

### Original Controller: `ScriptController.ts`
- **Lines of code**: ~2600
- **Methods**: 23
- **Type safety**: Disabled with `@ts-nocheck`
- **Pattern**: Monolithic class with all script-related operations

### Problems with Current Approach
1. **Violates Single Responsibility Principle**: One class handles CRUD, search, analysis, execution, versioning, and export
2. **No type safety**: `@ts-nocheck` hides bugs and prevents IDE assistance
3. **Hard to test**: Large class with many dependencies
4. **Hard to maintain**: Changes in one area can affect others
5. **Code duplication**: Similar patterns repeated across methods

## Target Architecture

```
src/backend/src/controllers/script/
├── index.ts          # Module exports
├── types.ts          # Shared type definitions
├── shared.ts         # Common utilities and imports
├── crud.ts           # ✅ Basic CRUD operations
├── search.ts         # Search and query operations
├── analysis.ts       # AI analysis operations
├── execution.ts      # Script execution
├── versions.ts       # Version control
└── export.ts         # Export and upload operations
```

## Module Breakdown

### 1. `crud.ts` ✅ COMPLETED
**Methods to migrate:**
- `getScripts` ✅
- `getScript` ✅
- `createScript` ✅
- `updateScript` (pending)
- `deleteScript` ✅

**Status**: 4/5 methods migrated

### 2. `search.ts` (Pending)
**Methods to migrate:**
- `searchScripts`
- `findSimilarScripts`

**Dependencies**: Vector search utilities

### 3. `analysis.ts` (Pending)
**Methods to migrate:**
- `getScriptAnalysis`
- `analyzeScript`
- `analyzeScriptAndSave`
- `analyzeScriptWithAssistant`
- `analyzeLangGraph`
- `streamAnalysis`
- `provideFeedback`

**Dependencies**: AI service, streaming utilities

### 4. `execution.ts` (Pending)
**Methods to migrate:**
- `executeScript`
- `getExecutionHistory`

**Dependencies**: Script execution engine

### 5. `versions.ts` (Pending)
**Methods to migrate:**
- `getVersionHistory`
- `getVersion`
- `revertToVersion`
- `compareVersions`

**Dependencies**: Version diffing utilities

### 6. `export.ts` (Pending)
**Methods to migrate:**
- `exportAnalysis`
- `uploadScript`

**Dependencies**: PDF generation (PDFKit), file handling

## Migration Steps

### Phase 1: Foundation ✅ COMPLETED
1. ✅ Create `types.ts` with shared type definitions
2. ✅ Create `shared.ts` with common utilities (WITHOUT `@ts-nocheck`)
3. ✅ Create `index.ts` for module exports

### Phase 2: CRUD Migration (Current)
1. ✅ Create `crud.ts` with type-safe CRUD operations
2. ⏳ Migrate `updateScript` method
3. ⏳ Update routes to use new controller

### Phase 3: Search Migration
1. Create `search.ts`
2. Migrate search methods with proper types
3. Update routes

### Phase 4: Analysis Migration
1. Create `analysis.ts`
2. Handle streaming responses properly
3. Type AI service responses
4. Update routes

### Phase 5: Execution & Versions
1. Create `execution.ts` and `versions.ts`
2. Migrate remaining methods
3. Update routes

### Phase 6: Export & Cleanup
1. Create `export.ts`
2. Migrate remaining methods
3. Deprecate original `ScriptController.ts`
4. Remove `@ts-nocheck` from `models/index.ts`
5. Full type coverage verification

## Route Migration Example

### Before (in routes file)
```typescript
import ScriptController from '../controllers/ScriptController';

const controller = new ScriptController();
router.get('/', controller.getScripts.bind(controller));
```

### After (in routes file)
```typescript
import { getScripts, getScript, createScript, deleteScript } from '../controllers/script';

router.get('/', getScripts);
router.get('/:id', getScript);
router.post('/', createScript);
router.delete('/:id', deleteScript);
```

## Type Safety Improvements

### Original (with @ts-nocheck)
```typescript
async getScripts(req: Request, res: Response, next: NextFunction) {
  const whereClause: any = {};  // No type safety!
  const analysis: any = await sequelize.query(...);  // Could be anything
}
```

### Migrated (type-safe)
```typescript
async function getScripts(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void | Response> {
  const whereClause: Record<string, unknown> = {};
  const analysis: AnalysisResult | null = await fetchScriptAnalysis(scriptId);
}
```

## Testing Strategy

1. **Unit Tests**: Each module should have focused unit tests
2. **Integration Tests**: Test API endpoints remain functional
3. **Type Tests**: Ensure no type errors after migration
4. **Regression Tests**: Compare responses before/after migration

## Rollback Plan

If issues are discovered:
1. Routes can quickly switch back to original controller
2. Original `ScriptController.ts` remains unchanged until Phase 6
3. Both old and new methods coexist during migration

## Timeline Estimate

| Phase | Effort | Status |
|-------|--------|--------|
| Phase 1: Foundation | 2 hours | ✅ Done |
| Phase 2: CRUD | 3 hours | 🔄 In Progress |
| Phase 3: Search | 2 hours | Pending |
| Phase 4: Analysis | 4 hours | Pending |
| Phase 5: Execution & Versions | 3 hours | Pending |
| Phase 6: Export & Cleanup | 2 hours | Pending |

**Total Estimated Effort**: 16 hours

## Success Criteria

- [ ] All methods migrated to modular structure
- [ ] No `@ts-nocheck` in controller modules
- [ ] All existing tests pass
- [ ] No regression in API behavior
- [ ] Type coverage > 90%
- [ ] Original `ScriptController.ts` deprecated and removed

## Notes

- Keep backward compatibility during migration
- Update API documentation as methods are migrated
- Consider adding request validation with zod or joi
- Monitor performance after migration (should be equivalent or better)
