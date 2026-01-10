# TanStack Query v5 Migration Guide

This document outlines the migration from React Query v3/v4 to TanStack Query v5 for the PSScript frontend application.

## Migration Summary

### Package Changes
- **Old**: `react-query@^3.x` or `react-query@^4.x`
- **New**: `@tanstack/react-query@^5.62.12` (already installed)

### Key Breaking Changes in v5

#### 1. Import Changes
```typescript
// OLD (v3/v4)
import { useQuery, useMutation, useQueryClient, QueryClient, QueryClientProvider } from 'react-query';

// NEW (v5)
import { useQuery, useMutation, useQueryClient, QueryClient, QueryClientProvider } from '@tanstack/react-query';
```

#### 2. useQuery Syntax
```typescript
// OLD (v3/v4) - Positional arguments
const { data, isLoading, error } = useQuery(
  ['key', param],
  () => fetchData(param),
  { options }
);

// NEW (v5) - Object syntax
const { data, isPending, error } = useQuery({
  queryKey: ['key', param],
  queryFn: () => fetchData(param),
  ...options
});
```

#### 3. Loading State Naming
```typescript
// OLD
isLoading  // Was true during initial fetch
isFetching // Was true during any fetch (including background refetch)

// NEW
isPending  // Replaces isLoading - true during initial fetch
isFetching // Still exists - true during any fetch
```

#### 4. Cache Time Renamed
```typescript
// OLD
cacheTime: 5 * 60 * 1000

// NEW
gcTime: 5 * 60 * 1000  // Garbage Collection Time
```

#### 5. useMutation Syntax
```typescript
// OLD (v3/v4) - Positional arguments with callbacks
const mutation = useMutation(
  (data) => updateData(data),
  {
    onSuccess: (data) => { /* ... */ },
    onError: (error) => { /* ... */ },
  }
);

// NEW (v5) - Object syntax, callbacks removed from config
const mutation = useMutation({
  mutationFn: (data) => updateData(data),
});

// Callbacks now passed to mutate()
mutation.mutate(data, {
  onSuccess: (data) => { /* ... */ },
  onError: (error) => { /* ... */ },
});
```

#### 6. QueryClient Configuration
```typescript
// OLD (v3/v4)
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      cacheTime: 5 * 60 * 1000,
    },
  },
});

// NEW (v5)
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      gcTime: 5 * 60 * 1000,  // Renamed from cacheTime
      networkMode: 'online',   // New default
    },
    mutations: {
      networkMode: 'online',
    },
  },
});
```

## Files Updated

### Core Files
1. `/src/App.tsx` - QueryClient configuration and provider
2. `/src/hooks/useScripts.ts` - Script data fetching hooks

### Pages with useQuery
1. `/src/pages/Dashboard.tsx` - Multiple queries for dashboard data
2. `/src/pages/ScriptManagement.tsx` - Script list and mutations
3. `/src/pages/ScriptDetail.tsx` - Script details and analysis
4. `/src/pages/ScriptAnalysis.tsx` - Analysis data
5. `/src/pages/ScriptUpload.tsx` - Upload and analysis preview
6. `/src/pages/ManageFiles.tsx` - File management
7. `/src/pages/Analytics.tsx` - Analytics data
8. `/src/pages/Search.tsx` - Search functionality

### Migration Checklist

#### Completed
- [x] Update package imports from `react-query` to `@tanstack/react-query`
- [x] Convert QueryClient configuration to use `gcTime` instead of `cacheTime`
- [x] Update all `useQuery` calls to object syntax
- [x] Replace `isLoading` with `isPending`
- [x] Add Suspense boundaries in App.tsx

#### In Progress
- [ ] Update ScriptManagement.tsx
- [ ] Update ScriptDetail.tsx
- [ ] Update ScriptAnalysis.tsx
- [ ] Update ScriptUpload.tsx
- [ ] Update ManageFiles.tsx
- [ ] Update Analytics.tsx
- [ ] Update Search.tsx

#### Post-Migration Tasks
- [ ] Test all data fetching flows
- [ ] Verify error handling works correctly
- [ ] Check that loading states display properly
- [ ] Test mutations and cache invalidation
- [ ] Verify Suspense boundaries work as expected

## Common Patterns

### Pattern 1: Simple Query
```typescript
// v5 Syntax
const { data, isPending, error } = useQuery({
  queryKey: ['scripts'],
  queryFn: () => scriptService.getScripts(),
  staleTime: 60000,
  gcTime: 5 * 60 * 1000,
});
```

### Pattern 2: Query with Parameters
```typescript
// v5 Syntax
const { data, isPending } = useQuery({
  queryKey: ['script', id],
  queryFn: () => scriptService.getScript(id),
  enabled: !!id,
});
```

### Pattern 3: Mutation
```typescript
// v5 Syntax
const mutation = useMutation({
  mutationFn: (data) => scriptService.createScript(data),
});

// Usage with callbacks
const handleSubmit = (formData) => {
  mutation.mutate(formData, {
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['scripts'] });
      navigate(`/scripts/${data.id}`);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });
};
```

### Pattern 4: Multiple Queries
```typescript
// v5 Syntax - All in object form
const { data: scripts, isPending: isPendingScripts } = useQuery({
  queryKey: ['scripts'],
  queryFn: () => scriptService.getScripts(),
});

const { data: categories, isPending: isPendingCategories } = useQuery({
  queryKey: ['categories'],
  queryFn: () => categoryService.getCategories(),
});

const isPending = isPendingScripts || isPendingCategories;
```

## Best Practices for v5

### 1. Use Object Syntax Consistently
Always use the object syntax for both `useQuery` and `useMutation`.

### 2. Leverage TypeScript
TanStack Query v5 has excellent TypeScript support:
```typescript
interface Script {
  id: string;
  title: string;
  content: string;
}

const { data } = useQuery<Script>({
  queryKey: ['script', id],
  queryFn: () => scriptService.getScript(id),
});
// data is now properly typed as Script | undefined
```

### 3. Handle Loading States Properly
```typescript
const { data, isPending, error, isFetching } = useQuery({
  queryKey: ['data'],
  queryFn: fetchData,
});

if (isPending) return <LoadingSpinner />; // Initial load
if (error) return <ErrorMessage error={error} />;
// isFetching can be used to show background refresh indicator
```

### 4. Use Suspense for Better UX (Optional)
```typescript
const { data } = useQuery({
  queryKey: ['data'],
  queryFn: fetchData,
  suspense: true,  // Enable suspense mode
});

// Wrap in Suspense boundary in parent component
<Suspense fallback={<LoadingScreen />}>
  <Component />
</Suspense>
```

### 5. Optimize Re-renders
```typescript
// Use select to transform data and prevent unnecessary re-renders
const { data: scriptTitles } = useQuery({
  queryKey: ['scripts'],
  queryFn: () => scriptService.getScripts(),
  select: (data) => data.map(script => script.title),
});
```

## Performance Optimizations

### 1. Stale Time
Set appropriate stale times to reduce unnecessary refetches:
```typescript
staleTime: 5 * 60 * 1000  // Data is fresh for 5 minutes
```

### 2. GC Time (Cache Time)
Control how long inactive data stays in memory:
```typescript
gcTime: 10 * 60 * 1000  // Keep in cache for 10 minutes after last use
```

### 3. Refetch on Window Focus
Disable for admin panels, enable for user-facing apps:
```typescript
refetchOnWindowFocus: false  // Good for admin tools
```

### 4. Parallel Queries
TanStack Query automatically parallelizes independent queries:
```typescript
// These run in parallel automatically
const query1 = useQuery({ queryKey: ['data1'], queryFn: fetch1 });
const query2 = useQuery({ queryKey: ['data2'], queryFn: fetch2 });
const query3 = useQuery({ queryKey: ['data3'], queryFn: fetch3 });
```

## Troubleshooting

### Issue: Types not working
**Solution**: Make sure you're importing from `@tanstack/react-query` not `react-query`

### Issue: isLoading not found
**Solution**: Replace with `isPending` in v5

### Issue: onSuccess/onError in useMutation config not working
**Solution**: Move callbacks to the `mutate()` call in v5

### Issue: cacheTime warnings
**Solution**: Replace `cacheTime` with `gcTime`

## Resources

- [TanStack Query v5 Migration Guide](https://tanstack.com/query/latest/docs/react/guides/migrating-to-v5)
- [TanStack Query v5 Documentation](https://tanstack.com/query/latest/docs/react/overview)
- [Breaking Changes Reference](https://tanstack.com/query/latest/docs/react/guides/migrating-to-v5#breaking-changes)
