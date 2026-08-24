"use client";

import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export function QueueAutoRefresh({ intervalMs = 5000 }: { intervalMs?: number }) {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const timer = window.setInterval(() => {
      router.refresh();
    }, intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs, router]);

  const atualizarAgora = () => {
    setRefreshing(true);
    router.refresh();
    window.setTimeout(() => setRefreshing(false), 600);
  };

  return (
    <button
      type="button"
      onClick={atualizarAgora}
      className="btn-secondary h-9 text-xs"
      title="A fila atualiza automaticamente a cada 5 segundos"
    >
      <RefreshCw className={`size-3.5 ${refreshing ? "animate-spin" : ""}`} />
      Atualização automática
    </button>
  );
}
