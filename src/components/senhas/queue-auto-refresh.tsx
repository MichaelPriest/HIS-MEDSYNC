"use client";

import Link from "next/link";
import { LayoutDashboard, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function QueueAutoRefresh({
  unidadeId,
  heartbeatMs = 60000,
}: {
  unidadeId?: string;
  heartbeatMs?: number;
}) {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const lastRefreshAt = useRef(0);

  const refreshQueue = useCallback((force = false) => {
    if (!force && document.visibilityState !== "visible") return;

    const now = Date.now();
    if (!force && now - lastRefreshAt.current < 750) return;
    lastRefreshAt.current = now;
    router.refresh();
  }, [router]);

  useEffect(() => {
    const supabase = createClient();
    let debounceTimer: number | null = null;

    const scheduleRefresh = () => {
      if (document.visibilityState !== "visible") return;
      if (debounceTimer !== null) window.clearTimeout(debounceTimer);
      debounceTimer = window.setTimeout(() => refreshQueue(), 180);
    };

    // Na Recepção observamos senhas_atendimento filtradas pela unidade. O mesmo
    // componente já era usado nas filas setoriais; sem unidade explícita ele
    // observa filas_setoriais e deixa o RLS limitar os eventos autorizados.
    const table = unidadeId ? "senhas_atendimento" : "filas_setoriais";
    const postgresConfig = unidadeId
      ? {
          event: "*" as const,
          schema: "public",
          table,
          filter: `unidade_id=eq.${unidadeId}`,
        }
      : {
          event: "*" as const,
          schema: "public",
          table,
        };

    const channel = supabase
      .channel(`fila-tempo-real:${table}:${unidadeId ?? "escopo-rls"}`)
      .on("postgres_changes", postgresConfig, scheduleRefresh)
      .subscribe();

    // Fallback de segurança caso o websocket seja interrompido. É muito menos
    // agressivo que o polling anterior de 5 s e pausa quando a aba está oculta.
    const heartbeat = window.setInterval(() => refreshQueue(), heartbeatMs);
    const onFocus = () => refreshQueue();
    const onVisibility = () => {
      if (document.visibilityState === "visible") refreshQueue();
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      if (debounceTimer !== null) window.clearTimeout(debounceTimer);
      window.clearInterval(heartbeat);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
      void supabase.removeChannel(channel);
    };
  }, [heartbeatMs, refreshQueue, unidadeId]);

  const atualizarAgora = () => {
    setRefreshing(true);
    refreshQueue(true);
    window.setTimeout(() => setRefreshing(false), 600);
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {unidadeId ? <Link href="/senhas/cockpit" className="btn-secondary h-9 text-xs"><LayoutDashboard className="size-3.5" />Cockpit</Link> : null}
      <button
        type="button"
        onClick={atualizarAgora}
        className="btn-secondary h-9 text-xs"
        title="Atualização em tempo real com sincronização automática de segurança"
      >
        <RefreshCw className={`size-3.5 ${refreshing ? "animate-spin" : ""}`} />
        Tempo real
      </button>
    </div>
  );
}
