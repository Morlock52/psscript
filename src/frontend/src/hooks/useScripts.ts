import { useQuery } from 'react-query';
import { scriptService } from '../services/api';

// Hook to fetch a script by ID
export const useScriptById = (id: string) => {
  return useQuery(
    ['script', id],
    () => scriptService.getScript(id),
    {
      enabled: !!id,
      staleTime: 5 * 60 * 1000, // 5 minutes
      cacheTime: 10 * 60 * 1000, // 10 minutes
    }
  );
};

// Hook to fetch all scripts
export const useScripts = (params = {}) => {
  return useQuery(
    ['scripts', params],
    () => scriptService.getScripts(params),
    {
      staleTime: 5 * 60 * 1000, // 5 minutes
      cacheTime: 10 * 60 * 1000, // 10 minutes
    }
  );
};

// Hook to search scripts
export const useScriptSearch = (query: string, filters = {}) => {
  return useQuery(
    ['scriptSearch', query, filters],
    () => scriptService.searchScripts(query, filters),
    {
      enabled: !!query,
      staleTime: 5 * 60 * 1000, // 5 minutes
      cacheTime: 10 * 60 * 1000, // 10 minutes
    }
  );
};
