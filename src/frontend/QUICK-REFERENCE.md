# TanStack Query v5 Quick Reference

## Import Statement
```typescript
import { useQuery, useMutation, useQueryClient, QueryClient, QueryClientProvider } from '@tanstack/react-query';
```

## useQuery - Object Syntax

### Basic Query
```typescript
const { data, isPending, error } = useQuery({
  queryKey: ['todos'],
  queryFn: fetchTodos,
});
```

### With Parameters
```typescript
const { data, isPending } = useQuery({
  queryKey: ['todo', id],
  queryFn: () => fetchTodo(id),
  enabled: !!id,
});
```

### With Options
```typescript
const { data, isPending, error, refetch } = useQuery({
  queryKey: ['scripts', filters],
  queryFn: () => fetchScripts(filters),
  staleTime: 5 * 60 * 1000,      // 5 minutes
  gcTime: 10 * 60 * 1000,        // 10 minutes (was cacheTime)
  enabled: isAuthenticated,       // Conditional fetching
  refetchOnWindowFocus: false,    // Disable auto-refetch
  placeholderData: (previousData) => previousData, // Keep old data while fetching
});
```

## useMutation - Object Syntax

### Basic Mutation
```typescript
const mutation = useMutation({
  mutationFn: (newTodo) => createTodo(newTodo),
});

// Usage
mutation.mutate(formData);
```

### With Callbacks
```typescript
const mutation = useMutation({
  mutationFn: (data) => updateScript(data),
});

// Callbacks moved to mutate() call
const handleSubmit = (formData) => {
  mutation.mutate(formData, {
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['scripts'] });
      navigate(`/scripts/${data.id}`);
    },
    onError: (error) => {
      toast.error(error.message);
    },
    onSettled: () => {
      setSubmitting(false);
    },
  });
};
```

### Optimistic Updates
```typescript
const mutation = useMutation({
  mutationFn: updateTodo,
});

mutation.mutate(newData, {
  onMutate: async (newData) => {
    await queryClient.cancelQueries({ queryKey: ['todos'] });
    const previousTodos = queryClient.getQueryData(['todos']);
    queryClient.setQueryData(['todos'], (old) => [...old, newData]);
    return { previousTodos };
  },
  onError: (err, newData, context) => {
    queryClient.setQueryData(['todos'], context.previousTodos);
  },
  onSettled: () => {
    queryClient.invalidateQueries({ queryKey: ['todos'] });
  },
});
```

## useQueryClient

### Invalidate Queries
```typescript
const queryClient = useQueryClient();

// Invalidate specific query
queryClient.invalidateQueries({ queryKey: ['scripts'] });

// Invalidate with filters
queryClient.invalidateQueries({
  queryKey: ['scripts'],
  exact: true,  // Only this exact key
});
```

### Set Query Data
```typescript
queryClient.setQueryData(['script', id], newScriptData);
```

### Get Query Data
```typescript
const scripts = queryClient.getQueryData(['scripts']);
```

### Cancel Queries
```typescript
queryClient.cancelQueries({ queryKey: ['scripts'] });
```

## Loading States

### isPending vs isFetching
```typescript
const { data, isPending, isFetching } = useQuery({
  queryKey: ['data'],
  queryFn: fetchData,
});

// isPending: true only during initial fetch (no cached data)
// isFetching: true during any fetch (including background refetch)

if (isPending) return <InitialLoadingSpinner />;
return (
  <div>
    {isFetching && <BackgroundRefetchIndicator />}
    <DataDisplay data={data} />
  </div>
);
```

## Error Handling

### In Component
```typescript
const { data, isPending, error } = useQuery({
  queryKey: ['data'],
  queryFn: fetchData,
});

if (isPending) return <LoadingSpinner />;
if (error) return <ErrorMessage error={error} />;
return <DataDisplay data={data} />;
```

### Global Error Handling
```typescript
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      onError: (error) => {
        toast.error(`Error: ${error.message}`);
      },
    },
  },
});
```

## Common Patterns

### Dependent Queries
```typescript
const { data: user } = useQuery({
  queryKey: ['user', id],
  queryFn: () => fetchUser(id),
});

const { data: projects } = useQuery({
  queryKey: ['projects', user?.id],
  queryFn: () => fetchProjects(user.id),
  enabled: !!user?.id,  // Only run if user exists
});
```

### Parallel Queries
```typescript
// These run in parallel automatically
const scripts = useQuery({ queryKey: ['scripts'], queryFn: fetchScripts });
const categories = useQuery({ queryKey: ['categories'], queryFn: fetchCategories });
const tags = useQuery({ queryKey: ['tags'], queryFn: fetchTags });

const isPending = scripts.isPending || categories.isPending || tags.isPending;
```

### Pagination
```typescript
const [page, setPage] = useState(1);

const { data, isPending } = useQuery({
  queryKey: ['scripts', page],
  queryFn: () => fetchScripts({ page }),
  placeholderData: (previousData) => previousData, // Keep old data while fetching
});
```

### Infinite Queries
```typescript
import { useInfiniteQuery } from '@tanstack/react-query';

const {
  data,
  fetchNextPage,
  hasNextPage,
  isFetchingNextPage,
} = useInfiniteQuery({
  queryKey: ['scripts'],
  queryFn: ({ pageParam = 1 }) => fetchScripts(pageParam),
  getNextPageParam: (lastPage, pages) => lastPage.nextPage,
  initialPageParam: 1,
});
```

## Configuration Best Practices

### Recommended Settings
```typescript
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,           // 1 minute
      gcTime: 5 * 60 * 1000,          // 5 minutes
      refetchOnWindowFocus: false,     // Disable for admin tools
      retry: 1,                        // Retry once on failure
      networkMode: 'online',           // Default
    },
    mutations: {
      retry: 0,                        // Don't retry mutations
      networkMode: 'online',
    },
  },
});
```

### Per-Query Overrides
```typescript
// Override defaults for specific queries
const { data } = useQuery({
  queryKey: ['real-time-data'],
  queryFn: fetchRealTimeData,
  refetchInterval: 5000,        // Poll every 5 seconds
  refetchIntervalInBackground: true,
});
```

## TypeScript

### Type-Safe Queries
```typescript
interface Script {
  id: string;
  title: string;
  content: string;
}

const { data } = useQuery<Script>({
  queryKey: ['script', id],
  queryFn: () => fetchScript(id),
});
// data is typed as Script | undefined
```

### Type-Safe Mutations
```typescript
interface ScriptInput {
  title: string;
  content: string;
}

interface ScriptOutput {
  id: string;
  title: string;
  content: string;
}

const mutation = useMutation<ScriptOutput, Error, ScriptInput>({
  mutationFn: (data) => createScript(data),
});
```

## DevTools

### Installation
```bash
npm install @tanstack/react-query-devtools
```

### Usage
```typescript
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <YourApp />
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
```

## Common Gotchas

1. **Don't use array notation for queryKey**
   ```typescript
   // ❌ Wrong
   queryKey: 'scripts'

   // ✅ Correct
   queryKey: ['scripts']
   ```

2. **Remember to use object syntax**
   ```typescript
   // ❌ Wrong (v4 syntax)
   useQuery(['key'], fetchFn)

   // ✅ Correct (v5 syntax)
   useQuery({ queryKey: ['key'], queryFn: fetchFn })
   ```

3. **Move mutation callbacks to mutate() call**
   ```typescript
   // ❌ Wrong (v4 syntax)
   useMutation(mutateFn, { onSuccess: () => {} })

   // ✅ Correct (v5 syntax)
   const mutation = useMutation({ mutationFn });
   mutation.mutate(data, { onSuccess: () => {} });
   ```

4. **Use isPending, not isLoading**
   ```typescript
   // ❌ Wrong (v4)
   const { isLoading } = useQuery({...});

   // ✅ Correct (v5)
   const { isPending } = useQuery({...});
   ```

## Cheat Sheet Summary

| Operation | Code |
|-----------|------|
| Fetch data | `useQuery({ queryKey: ['key'], queryFn })` |
| Mutation | `useMutation({ mutationFn })` |
| Invalidate | `queryClient.invalidateQueries({ queryKey: ['key'] })` |
| Refetch | `refetch()` from useQuery return |
| Loading | Check `isPending` for initial load |
| Fetching | Check `isFetching` for any fetch |
| Error | Check `error` property |

---

**Version**: TanStack Query v5.62.12
**Last Updated**: January 7, 2026
