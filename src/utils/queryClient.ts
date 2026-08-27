import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 10, // 10 minutes
      retry: (failureCount, error) => {
        const msg = String((error as Error)?.message || error || "");
        if (/unauth|not authenticated|401/i.test(msg)) return false;
        return failureCount < 2;
      },
    },
  },
});
