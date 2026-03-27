import { useQueryClient } from "@tanstack/react-query";
import { useGetDashboard, useRefreshDashboard, getGetDashboardQueryKey } from "@workspace/api-client-react";

const REFETCH_INTERVAL_MS = 5 * 60 * 1000;

export function useDashboardData() {
  return useGetDashboard({
    query: {
      refetchInterval: REFETCH_INTERVAL_MS,
      refetchOnWindowFocus: true,
      staleTime: REFETCH_INTERVAL_MS - 30_000,
    },
  });
}

export function useTriggerRefresh() {
  const queryClient = useQueryClient();
  return useRefreshDashboard({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
      },
    },
  });
}
