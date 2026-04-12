import { useCallback, useEffect, useRef, useState } from "react";
import type { DashboardData } from "../lib/dashboard-model";

const API_REST = "/api/dashboard";
const API_SSE = "/api/dashboard/stream";

export function useDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryDelayMs = useRef(2000);
  const mountedRef = useRef(true);

  const connectSse = useCallback(() => {
    if (!mountedRef.current) return;

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    const eventSource = new EventSource(API_SSE);
    eventSourceRef.current = eventSource;

    eventSource.addEventListener("dashboard", (event: MessageEvent) => {
      if (!mountedRef.current) return;

      try {
        setData(JSON.parse(event.data));
        setError(false);
        retryDelayMs.current = 2000;
      } catch {
        return;
      }
    });

    eventSource.onerror = () => {
      eventSource.close();
      eventSourceRef.current = null;
      if (!mountedRef.current) return;

      fetch(API_REST)
        .then((response) => response.json())
        .then((payload) => {
          if (!mountedRef.current) return;
          setData(payload);
          setError(false);
        })
        .catch(() => {
          if (mountedRef.current) setError(true);
        });

      const delay = retryDelayMs.current;
      retryDelayMs.current = Math.min(delay * 2, 30000);
      retryTimeoutRef.current = setTimeout(connectSse, delay);
    };
  }, []);

  useEffect(() => {
    mountedRef.current = true;

    fetch(API_REST)
      .then((response) => response.json())
      .then((payload) => {
        if (!mountedRef.current) return;
        setData(payload);
        setError(false);
      })
      .catch(() => {
        if (mountedRef.current) setError(true);
      });

    connectSse();

    return () => {
      mountedRef.current = false;
      eventSourceRef.current?.close();
      eventSourceRef.current = null;

      if (!retryTimeoutRef.current) return;
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    };
  }, [connectSse]);

  return { data, error };
}
