import Link from "next/link";
import type { Route } from "next";
import { LockKeyhole } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

function fmtData(value: string | null | undefined) {
  if (!value) return null;
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(value));
}

export async function EpisodioEncerradoBanner({ atendimentoId }: { atendimentoId: string }) {
  const supabase = await createClient();
  const { data } = await supabase.from("atendimentos").select("status,data_fechamento").eq("id", atendimentoId).maybeSingle();
  if (!data || !["alta", "cancelado"].includes(String(data.status))) return null;

  const altaHref = `/prontuario/${atendimentoId}/alta` as Route;
  const fechadoEm = fmtData(data.data_fechamento);
  return <div className="mb-5 flex flex-col gap-3 rounded-2xl border border-slate-300 bg-slate-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-start gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-white text-slate-600 shadow-sm"><LockKeyhole className="size-4"/></span><div><p className="font-black text-slate-900">Episódio encerrado · modo histórico</p><p className="mt-0.5 text-xs text-slate-600">Status: {data.status}{fechadoEm ? ` · encerrado em ${fechadoEm}` : ""}. Novos registros vinculados a este atendimento estão bloqueados.</p></div></div><Link href={altaHref} className="ui-button-secondary shrink-0">Ver conclusão / alta</Link></div>;
}
