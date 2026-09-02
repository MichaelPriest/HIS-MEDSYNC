import Link from "next/link";
import { AlertTriangle, Boxes, CheckCircle2, Clock3, FlaskConical, LockKeyhole, ShieldCheck } from "lucide-react";
import { CmeBackgroundForm } from "@/components/centro-cirurgico/cme-background-form";
import { SectionPage } from "@/components/painel/section-page";
import { getAssistencialContext } from "@/modules/assistencial/context";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Ciclo = {
  id: string;
  codigo_ciclo: string;
  equipamento: string | null;
  metodo: string | null;
  carga: string | null;
  inicio_em: string | null;
  fim_em: string | null;
  indicadores: Record<string, unknown> | null;
  resultado: string | null;
  liberado_em: string | null;
  status: string;
  observacoes: string | null;
};

const fmt = (value?: string | null) => value ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(value)) : "—";
const label = (value: string) => ({ em_processamento: "Em processamento", concluido: "Concluído", liberado: "Liberado", reprovado: "Reprovado" }[value] ?? value.replaceAll("_", " "));

export default async function CmePage() {
  const { supabase, empresaId, unidadeId } = await getAssistencialContext();
  const { data } = await supabase
    .from("cme_ciclos")
    .select("id,codigo_ciclo,equipamento,metodo,carga,inicio_em,fim_em,indicadores,resultado,liberado_em,status,observacoes")
    .eq("empresa_id", empresaId)
    .eq("unidade_id", unidadeId)
    .order("created_at", { ascending: false })
    .limit(300);
  const ciclos = (data ?? []) as Ciclo[];
  const emProcessamento = ciclos.filter((item) => item.status === "em_processamento").length;
  const liberados = ciclos.filter((item) => item.status === "liberado").length;
  const reprovados = ciclos.filter((item) => item.status === "reprovado").length;

  return (
    <SectionPage
      eyebrow="Assistencial / Centro Cirúrgico / CME"
      title="Central de Material e Esterilização"
      description="Rastreabilidade de ciclos, indicadores, resultado e liberação técnica. Ciclos liberados ficam imutáveis no banco e podem ser vinculados às cirurgias."
      actions={<div className="flex flex-wrap gap-2"><Link href="/assistencial/centro-cirurgico" className="ui-button-secondary">← Centro Cirúrgico</Link><Link href="/assistencial/centro-cirurgico/equipamentos" className="ui-button-secondary"><ShieldCheck className="size-4" />Prontidão das salas</Link></div>}
    >
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Ciclos cadastrados" value={ciclos.length} icon={<Boxes className="size-5 text-brand-600" />} />
        <Kpi label="Em processamento" value={emProcessamento} icon={<Clock3 className="size-5 text-amber-600" />} />
        <Kpi label="Liberados" value={liberados} icon={<CheckCircle2 className="size-5 text-emerald-600" />} />
        <Kpi label="Reprovados" value={reprovados} icon={<AlertTriangle className="size-5 text-rose-600" />} />
      </section>

      <section className="mt-5 his-card p-5">
        <div className="mb-4 border-b border-slate-100 pb-4"><h2 className="font-black text-slate-950">Novo ciclo CME</h2><p className="mt-1 text-sm text-slate-500">Registre o processamento e somente libere após informar resultado e indicadores.</p></div>
        <CmeBackgroundForm />
      </section>

      <section className="mt-5 space-y-4">
        <div><h2 className="text-lg font-black text-slate-950">Histórico e rastreabilidade dos ciclos</h2><p className="mt-1 text-sm text-slate-500">A liberação é definitiva. Ciclos ainda em processamento, concluídos ou reprovados podem receber atualização técnica.</p></div>
        <div className="grid gap-4 xl:grid-cols-2">
          {ciclos.map((ciclo) => {
            const indicador = ciclo.indicadores ?? {};
            const liberado = ciclo.status === "liberado";
            return <article key={ciclo.id} className={`his-card p-5 ${liberado ? "border-emerald-200" : ciclo.status === "reprovado" ? "border-rose-200" : ""}`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div><div className="flex items-center gap-2"><Status status={ciclo.status} />{liberado ? <LockKeyhole className="size-4 text-emerald-600" /> : null}</div><h3 className="mt-3 text-lg font-black text-slate-950">{ciclo.codigo_ciclo}</h3><p className="mt-1 text-sm text-slate-600">{ciclo.equipamento ?? "Equipamento não informado"} · {ciclo.metodo ?? "Método não informado"}</p></div>
                <div className="text-right text-xs text-slate-500"><p>Início {fmt(ciclo.inicio_em)}</p><p>Fim {fmt(ciclo.fim_em)}</p>{liberado ? <p className="font-black text-emerald-700">Liberado {fmt(ciclo.liberado_em)}</p> : null}</div>
              </div>
              <div className="mt-4 grid gap-2 sm:grid-cols-2"><Info label="Carga" value={ciclo.carga} /><Info label="Resultado" value={ciclo.resultado} /><Info label="Indicador químico" value={indicador.quimico ? "Conforme" : "Não marcado"} /><Info label="Indicador biológico" value={indicador.biologico ? "Conforme" : "Não marcado"} /><Info label="Indicador físico" value={indicador.fisico ? "Conforme" : "Não marcado"} /><Info label="Observação" value={String(indicador.observacao ?? ciclo.observacoes ?? "—")} /></div>
              {!liberado ? <details className="mt-4 rounded-xl border border-slate-200 p-4"><summary className="cursor-pointer font-black text-slate-800">Atualizar / finalizar ciclo</summary><div className="mt-4"><CmeBackgroundForm ciclo={ciclo} /></div></details> : <div className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800"><LockKeyhole className="mr-2 inline size-4" />Ciclo liberado e protegido contra alteração.</div>}
            </article>;
          })}
          {!ciclos.length ? <div className="his-card p-10 text-center xl:col-span-2"><FlaskConical className="mx-auto size-8 text-slate-300" /><p className="mt-3 font-black text-slate-700">Nenhum ciclo CME registrado.</p><p className="mt-1 text-sm text-slate-500">O primeiro ciclo pode ser criado no formulário acima.</p></div> : null}
        </div>
      </section>
    </SectionPage>
  );
}

function Kpi({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) { return <div className="his-kpi"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-wide text-slate-400">{label}</p><p className="mt-2 text-3xl font-black text-slate-950">{value}</p></div>{icon}</div></div>; }
function Info({ label: title, value }: { label: string; value: string | null | undefined }) { return <div className="rounded-xl bg-slate-50 px-3 py-2"><p className="text-[10px] font-black uppercase tracking-wide text-slate-400">{title}</p><p className="mt-1 text-sm font-semibold text-slate-700">{value || "—"}</p></div>; }
function Status({ status }: { status: string }) { const classes = status === "liberado" ? "bg-emerald-50 text-emerald-700" : status === "reprovado" ? "bg-rose-50 text-rose-700" : status === "concluido" ? "bg-brand-50 text-brand-700" : "bg-amber-50 text-amber-700"; return <span className={`rounded-full px-3 py-1 text-xs font-black ${classes}`}>{label(status)}</span>; }
