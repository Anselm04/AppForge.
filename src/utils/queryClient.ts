import { QueryClient } from "@tanstack/react-query";
import { shouldRetryQuery } from "../lib/buildPolling.js";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 10, // 10 minutes
      retry: shouldRetryQuery,
    },
  },
});
