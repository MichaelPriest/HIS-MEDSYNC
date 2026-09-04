"use client";

import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const TABLES = ["senhas_atendimento", "agendamentos", "atendimentos"] as const;

export function ReceptionCockpitRefresh({
  unidadeId,
  heartbeatMs = 60000,
}: {
  unidadeId: string;
  heartbeatMs?: number;
}) {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const lastRefreshAt = useRef(0);

  const refresh = useCallback((force = false) => {
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
      debounceTimer = window.setTimeout(() => refresh(), 180);
    };

    let channel = supabase.channel(`recepcao-cockpit:${unidadeId}`);
    for (const table of TABLES) {
      channel = channel.on("postgres_changes", {
        event: "*",
        schema: "public",
        table,
        filter: `unidade_id=eq.${unidadeId}`,
      }, scheduleRefresh);
    }
    channel.subscribe();

    const heartbeat = window.setInterval(() => refresh(), heartbeatMs);
    const onFocus = () => refresh();
    const onVisibility = () => {
      if (document.visibilityState === "visible") refresh();
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
  }, [heartbeatMs, refresh, unidadeId]);

  function atualizarAgora() {
    setRefreshing(true);
    refresh(true);
    window.setTimeout(() => setRefreshing(false), 600);
  }

  return (
    <button type="button" onClick={atualizarAgora} className="btn-secondary" title="Atualização em tempo real com sincronização automática de segurança">
      <RefreshCw className={`size-4 ${refreshing ? "animate-spin" : ""}`} />
      Tempo real
    </button>
  );
}
