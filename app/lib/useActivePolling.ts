"use client";

import { DependencyList, useEffect, useRef } from "react";

const isScreenActive = (): boolean => {
  if (typeof document === "undefined") return true;
  return document.visibilityState === "visible" && document.hasFocus();
};

export function useActivePolling(
  task: () => void | Promise<void>,
  intervalMs: number,
  deps: DependencyList = []
) {
  const taskRef = useRef(task);
  const inFlightRef = useRef(false);
  const lastRunAtRef = useRef(0);

  useEffect(() => {
    taskRef.current = task;
  }, [task]);

  useEffect(() => {
    let stopped = false;
    let timer: number | null = null;

    const run = () => {
      if (stopped) return;
      if (!isScreenActive()) return;
      if (inFlightRef.current) return;
      const now = Date.now();
      // Prevent tight duplicate calls from focus/visibility churn in development.
      if (now - lastRunAtRef.current < 1200) return;
      inFlightRef.current = true;
      lastRunAtRef.current = now;
      void Promise.resolve(taskRef.current())
        .catch((error) => {
          console.error("[useActivePolling] Poll task failed:", error);
        })
        .finally(() => {
          inFlightRef.current = false;
        });
    };

    const start = () => {
      if (timer != null) return;
      if (!isScreenActive()) return;
      run();
      timer = window.setInterval(run, intervalMs);
    };

    const stop = () => {
      if (timer == null) return;
      window.clearInterval(timer);
      timer = null;
    };

    const handleActivityChange = () => {
      if (isScreenActive()) {
        start();
      } else {
        stop();
      }
    };

    start();
    document.addEventListener("visibilitychange", handleActivityChange);
    window.addEventListener("focus", handleActivityChange);
    window.addEventListener("blur", handleActivityChange);

    return () => {
      stopped = true;
      stop();
      document.removeEventListener("visibilitychange", handleActivityChange);
      window.removeEventListener("focus", handleActivityChange);
      window.removeEventListener("blur", handleActivityChange);
    };
  }, [intervalMs, ...deps]);
}

