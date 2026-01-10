# TanStack Query v5 Migration Status

## Completed Tasks

### Phase 1: Package & Import Updates ✅
- [x] Verified `@tanstack/react-query@^5.62.12` is installed in package.json
- [x] Updated all imports from `react-query` to `@tanstack/react-query`
- [x] Replaced `isLoading` with `isPending` throughout the codebase
- [x] Replaced `cacheTime` with `gcTime`

### Phase 2: Core Files ✅
- [x] `src/App.tsx` - Updated QueryClient configuration with v5 syntax
  - Added `gcTime` instead of `cacheTime`
  - Added explicit `networkMode` configuration
  - Added Suspense boundary for better loading UX
- [x] `src/hooks/useScripts.ts` - Converted all hooks to object syntax

### Phase 3: Page Components ✅
- [x] `src/pages/Dashboard.tsx` - Fully migrated to v5
  - All useQuery calls converted to object syntax
  - All `isLoading` replaced with `isPending`
  - Loading states properly handled

## Partial Completion - Needs Manual Review

The following files have had automatic updates applied but need manual conversion to object syntax:

### 1. ScriptManagement.tsx
**Auto-updates applied:**
- ✅ Imports updated to @tanstack/react-query
- ✅ isLoading → isPending

**Manual updates needed:**
```typescript
// Line 53-65: Convert useQuery to object syntax
const { data: scriptsData, isPending: isScriptsLoading } = useQuery({
  queryKey: ['scripts', selectedCategory, isPublicFilter, selectedTags, searchQuery],
  queryFn: () => scriptService.getScripts({
    category: selectedCategory,
    isPublic: isPublicFilter,
    tags: selectedTags.length > 0 ? selectedTags : undefined,
    search: searchQuery || undefined
  }),
  placeholderData: (previousData) => previousData, // v5 replacement for keepPreviousData
  staleTime: 10000
});

// Line 83-99: Convert useMutation to object syntax and move callbacks
const bulkUpdateMutation = useMutation({
  mutationFn: (data: { ids: string[], isPublic: boolean }) =>
    scriptService.bulkUpdateScripts(data),
});

// Usage in component:
bulkUpdateMutation.mutate(data, {
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['scripts'] });
    setSelectedScripts([]);
    setShowBulkActions(false);
    setSuccessMessage('Scripts updated successfully');
    setTimeout(() => setSuccessMessage(null), 3000);
  },
  onError: (error: any) => {
    console.error('Failed to update scripts:', error);
    setErrorMessage(error.message || 'Failed to update scripts. Please try again.');
    setTimeout(() => setErrorMessage(null), 5000);
  }
});
```

### 2. ScriptDetail.tsx
**Auto-updates applied:**
- ✅ Imports updated
- ✅ isLoading → isPending

**Manual updates needed:**
- Convert all `useQuery` calls to object syntax (lines ~16-48)
- Convert `useMutation` calls to object syntax (lines ~50-96)
- Move `onSuccess`, `onError`, `onSettled` callbacks from mutation config to `mutate()` call

### 3. ScriptAnalysis.tsx
**Auto-updates applied:**
- ✅ Imports updated
- ✅ isLoading → isPending

**Manual updates needed:**
- Convert useQuery calls on lines ~26-42 to object syntax

### 4. ScriptUpload.tsx
**Auto-updates applied:**
- ✅ Imports updated
- ✅ isLoading → isPending

**Manual updates needed:**
- Convert useQuery calls (lines ~31-34, ~37-96) to object syntax
- Convert useMutation calls to object syntax
- Move callbacks to mutate() call

### 5. ManageFiles.tsx
**Auto-updates applied:**
- ✅ Imports updated
- ✅ isLoading → isPending

**Manual updates needed:**
- Convert useQuery and useMutation to object syntax

### 6. Analytics.tsx
**Auto-updates applied:**
- ✅ Imports updated

**Manual updates needed:**
- Convert any useQuery calls to object syntax (if present)

### 7. Search.tsx
**Auto-updates applied:**
- ✅ Imports updated
- ✅ isLoading → isPending

**Manual updates needed:**
- Convert useQuery calls to object syntax

## Manual Conversion Template

### useQuery v4 → v5
```typescript
// V4 (positional arguments)
const { data, isLoading } = useQuery(
  ['key', param],
  () => fetchData(param),
  {
    enabled: !!param,
    staleTime: 60000,
  }
);

// V5 (object syntax)
const { data, isPending } = useQuery({
  queryKey: ['key', param],
  queryFn: () => fetchData(param),
  enabled: !!param,
  staleTime: 60000,
});
```

### useMutation v4 → v5
```typescript
// V4 (with callbacks in config)
const mutation = useMutation(
  (data) => updateData(data),
  {
    onSuccess: (data) => { /* ... */ },
    onError: (error) => { /* ... */ },
  }
);

// V5 (callbacks moved to mutate call)
const mutation = useMutation({
  mutationFn: (data) => updateData(data),
});

// Usage
mutation.mutate(formData, {
  onSuccess: (data) => { /* ... */ },
  onError: (error) => { /* ... */ },
});
```

### keepPreviousData → placeholderData
```typescript
// V4
const query = useQuery(['key'], fetchFn, {
  keepPreviousData: true
});

// V5
const query = useQuery({
  queryKey: ['key'],
  queryFn: fetchFn,
  placeholderData: (previousData) => previousData,
});
```

## Testing Checklist

After completing manual updates:

- [ ] Run TypeScript compiler: `npm run build`
- [ ] Fix any type errors
- [ ] Test data fetching flows
- [ ] Verify loading states display correctly
- [ ] Test error handling
- [ ] Test mutations and cache invalidation
- [ ] Verify Suspense boundaries work correctly
- [ ] Test refetch functionality
- [ ] Check that background refetches work
- [ ] Verify stale-while-revalidate behavior

## Next Steps

1. **Complete Manual Conversions**: Update remaining files to v5 object syntax
2. **Test Application**: Run full integration tests
3. **Fix TypeScript Errors**: Address any typing issues
4. **Performance Review**: Check for any performance regressions
5. **Documentation Update**: Update team docs with v5 patterns

## Benefits of v5

- ✨ Better TypeScript inference
- 🚀 Improved performance
- 🎯 More consistent API surface
- 🔧 Better debugging with new devtools
- 📦 Smaller bundle size
- 🎨 Clearer separation of concerns (callbacks moved to usage)

## Resources

- [Migration Guide](./TANSTACK-QUERY-V5-MIGRATION.md)
- [TanStack Query v5 Docs](https://tanstack.com/query/latest)
- [Breaking Changes](https://tanstack.com/query/latest/docs/react/guides/migrating-to-v5)
