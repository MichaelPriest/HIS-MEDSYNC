import Link from "next/link";
import { Clock3, DoorOpen, Stethoscope, UserRound } from "lucide-react";
import type { SurgeryDashboardItem } from "@/modules/centro-cirurgico/dashboard";

const fmt = (value?: string | null) => value
  ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(value))
  : "—";

export function SurgeryStatusCard({ surgery, live = false }: { surgery: SurgeryDashboardItem; live?: boolean }) {
  return <article className={`his-card border-l-4 p-5 ${live ? "border-l-rose-500" : "border-l-brand-500"}`}>
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><p className="text-xs font-black uppercase tracking-wide text-slate-400">{live ? "Cirurgia em andamento" : "Cirurgia agendada"}</p><h2 className="mt-1 text-lg font-black text-slate-950">{surgery.paciente_nome}</h2><p className="text-xs text-slate-500">RA {surgery.paciente_ra ?? "—"}</p></div>
      <span className={`rounded-full px-3 py-1 text-xs font-black ${live ? "bg-rose-50 text-rose-700" : "bg-brand-50 text-brand-700"}`}>{live ? "EM CIRURGIA" : surgery.status === "em_preparo" ? "EM PREPARO" : "AGENDADA"}</span>
    </div>
    <p className="mt-4 font-black text-slate-900">{surgery.procedimento}</p>
    <p className="mt-1 text-xs text-slate-500">{surgery.codigo_tuss ? `TUSS ${surgery.codigo_tuss}` : surgery.codigo_contratado ? `Código ${surgery.codigo_contratado}` : "Código não informado"}</p>
    {surgery.procedimentos.length > 1 ? <div className="mt-3 rounded-xl border border-slate-100 bg-slate-50 p-3"><p className="text-[10px] font-black uppercase text-slate-400">{surgery.procedimentos.length} procedimentos no mesmo ato</p><ol className="mt-2 space-y-1 text-xs font-semibold text-slate-700">{surgery.procedimentos.map((procedure) => <li key={`${procedure.sequencia}-${procedure.descricao}`}>{procedure.sequencia}. {procedure.descricao} <span className="text-slate-400">· {procedure.status.replaceAll("_", " ")}</span></li>)}</ol></div> : null}
    <div className="mt-4 grid gap-2 text-sm text-slate-600 sm:grid-cols-2">
      <p><Clock3 className="mr-1.5 inline size-4" />{live ? `Início ${fmt(surgery.inicio_em)}` : `Prevista ${fmt(surgery.inicio_previsto)}`}</p>
      <p><DoorOpen className="mr-1.5 inline size-4" />{surgery.sala ?? "Sala a definir"}</p>
      <p><UserRound className="mr-1.5 inline size-4" />{surgery.cirurgiao_nome ?? "Cirurgião a definir"}</p>
      <p><Stethoscope className="mr-1.5 inline size-4" />{surgery.anestesista_nome ?? "Anestesista não informado"}</p>
    </div>
    <Link href={`/assistencial/centro-cirurgico?cirurgia=${surgery.id}#cirurgia-${surgery.id}`} className="ui-button-primary mt-4">Abrir tela operacional</Link>
  </article>;
}
