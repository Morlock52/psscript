# Cleanup Reminders

This file tracks temporary debugging code and logging that should be cleaned up after issues are resolved.

## Active Cleanup Items

### 1. ScriptExamplesViewer Debug Logging
- **File**: `src/frontend/src/components/Agentic/ScriptExamplesViewer.tsx`
- **Added**: 2026-01-14
- **Reminder Date**: 2026-01-24
- **Description**: Debug logging added to diagnose `[object Object]` rendering bug in AI Assistant script preview
- **Lines to remove**: 57-70 (useEffect with console.log statements)
- **Status**: Active - remove after confirming bug is fixed

```typescript
// DEBUG: Log examples to diagnose [object Object] rendering issue
// TODO(cleanup): Remove this logging after fixing the bug - Reminder: 2026-01-24
React.useEffect(() => {
  console.log('[ScriptExamplesViewer] DEBUG - examples received:', examples);
  examples.forEach((ex, i) => {
    console.log(`[ScriptExamplesViewer] DEBUG - example[${i}]:`, {
      id: ex.id,
      title: ex.title,
      scriptType: typeof ex.script,
      scriptIsArray: Array.isArray(ex.script),
      scriptPreview: typeof ex.script === 'string' ? ex.script.substring(0, 100) : ex.script,
    });
  });
}, [examples]);
```

---

## Completed Cleanup Items

(Move items here once cleaned up)

---

## Notes

- Check this file weekly for pending cleanups
- After cleaning up code, move the item to "Completed Cleanup Items" section with the cleanup date
- If an issue persists past the reminder date, investigate and update the reminder date
