"use client";

import { useMemo } from "react";
import { useData } from "../context/DataContext";

function formatTime(ts: number | null) {
  if (!ts) return "--";
  return new Date(ts).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export default function RealtimeHealthBadge() {
  const { realtimeStatus, lastSyncAt } = useData();

  const ui = useMemo(() => {
    if (realtimeStatus === "connected") {
      return { label: "Realtime On", dot: "bg-emerald-500", text: "text-emerald-700" };
    }
    if (realtimeStatus === "reconnecting") {
      return { label: "Reconnecting", dot: "bg-amber-500", text: "text-amber-700" };
    }
    if (realtimeStatus === "connecting") {
      return { label: "Connecting", dot: "bg-sky-500", text: "text-sky-700" };
    }
    return { label: "Realtime Off", dot: "bg-slate-400", text: "text-slate-600" };
  }, [realtimeStatus]);

  return (
    <div className="fixed bottom-3 right-3 z-50 rounded-xl border border-slate-200 bg-white/95 px-3 py-2 shadow-sm backdrop-blur">
      <div className="flex items-center gap-2 text-xs font-medium">
        <span className={`h-2 w-2 rounded-full ${ui.dot}`} />
        <span className={ui.text}>{ui.label}</span>
      </div>
      <p className="mt-1 text-[11px] text-slate-500">Last sync: {formatTime(lastSyncAt)}</p>
    </div>
  );
}
