import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetDashboard,
  useRefreshDashboard,
  getGetDashboardQueryKey,
} from "@workspace/api-client-react";
import type { DashboardData } from "@workspace/api-client-react";

const REFETCH_INTERVAL_MS = 30 * 1000;

export type DashboardConnectionState =
  | "connecting"
  | "live"
  | "reconnecting"
  | "polling";

export function useDashboardData() {
  return useGetDashboard({
    query: {
      queryKey: getGetDashboardQueryKey(),
      refetchInterval: REFETCH_INTERVAL_MS,
      refetchOnWindowFocus: true,
      staleTime: REFETCH_INTERVAL_MS - 5_000,
    },
  });
}

export function useDashboardLiveSync() {
  const queryClient = useQueryClient();
  const [connectionState, setConnectionState] =
    useState<DashboardConnectionState>("connecting");
  const [lastEventAt, setLastEventAt] = useState<number | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || typeof EventSource === "undefined") {
      setConnectionState("polling");
      return;
    }

    const streamUrl = new URL("/api/dashboard/stream", window.location.origin);
    const eventSource = new EventSource(streamUrl);

    const handleDashboardEvent = (event: MessageEvent<string>) => {
      try {
        const payload = JSON.parse(event.data) as DashboardData;
        queryClient.setQueryData(getGetDashboardQueryKey(), payload);
        setLastEventAt(Date.now());
        setConnectionState("live");
      } catch {
        setConnectionState("reconnecting");
      }
    };

    const handleHeartbeat = () => {
      setLastEventAt(Date.now());
    };

    eventSource.onopen = () => {
      setConnectionState("live");
    };

    eventSource.onerror = () => {
      setConnectionState("reconnecting");
    };

    eventSource.addEventListener("dashboard", handleDashboardEvent as EventListener);
    eventSource.addEventListener("heartbeat", handleHeartbeat as EventListener);

    return () => {
      eventSource.removeEventListener(
        "dashboard",
        handleDashboardEvent as EventListener,
      );
      eventSource.removeEventListener(
        "heartbeat",
        handleHeartbeat as EventListener,
      );
      eventSource.close();
    };
  }, [queryClient]);

  return { connectionState, lastEventAt };
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
