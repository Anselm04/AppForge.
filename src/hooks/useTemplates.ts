import { useQuery } from "@tanstack/react-query";
import { trpc } from "../utils/trpc.js";

export function useTemplates() {
  const query = useQuery({
    queryKey: ["templates"],
    queryFn: () => trpc.templates.list.query(),
  });

  return {
    templates: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
  };
}

export default useTemplates;
