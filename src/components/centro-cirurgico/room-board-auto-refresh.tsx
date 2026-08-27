"use client";

import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

export function RoomBoardAutoRefresh({ intervalMs = 15000 }: { intervalMs?: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [lastRefresh, setLastRefresh] = useState(() => new Date());

  function refresh() {
    startTransition(() => {
      router.refresh();
      setLastRefresh(new Date());
    });
  }

  useEffect(() => {
    const timer = window.setInterval(refresh, intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs]);

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
      <span>Atualização automática a cada {Math.round(intervalMs / 1000)}s · última {lastRefresh.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>
      <button type="button" onClick={refresh} disabled={pending} className="ui-button-secondary h-9 px-3">
        <RefreshCw className={`size-4 ${pending ? "animate-spin" : ""}`} />
        Atualizar agora
      </button>
    </div>
  );
}
