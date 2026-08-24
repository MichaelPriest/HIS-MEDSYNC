"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

const TABLES = [
  "leitos",
  "internacoes",
  "leito_reservas",
  "leito_bloqueios",
  "leito_higienizacoes",
] as const;

export function BedManagementAutoRefresh({
  unidadeId,
  heartbeatMs = 120000,
}: {
  unidadeId: string;
  heartbeatMs?: number;
}) {
  const router = useRouter();
  const lastRefreshAt = useRef(0);

  const refresh = useCallback((force = false) => {
    if (!force && document.visibilityState !== "visible") return;

    const now = Date.now();
    if (!force && now - lastRefreshAt.current < 900) return;
    lastRefreshAt.current = now;
    router.refresh();
  }, [router]);

  useEffect(() => {
    const supabase = createClient();
    let debounceTimer: number | null = null;

    const scheduleRefresh = () => {
      if (document.visibilityState !== "visible") return;
      if (debounceTimer !== null) window.clearTimeout(debounceTimer);
      debounceTimer = window.setTimeout(() => refresh(), 220);
    };

    let channel = supabase.channel(`internacao-tempo-real:${unidadeId}`);
    for (const table of TABLES) {
      channel = channel.on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table,
          filter: `unidade_id=eq.${unidadeId}`,
        },
        scheduleRefresh,
      );
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

  return null;
}
