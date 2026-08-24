import Link from "next/link";
import type { Route } from "next";
import { Activity, BedDouble, BellRing, ExternalLink, FlaskConical, MapPin, Pill, PlayCircle, ScanLine } from "lucide-react";
import { SectionPage } from "@/components/painel/section-page";
import { QueueAutoRefresh } from "@/components/senhas/queue-auto-refresh";
import { getAssistencialContext } from "@/modules/assistencial/context";
import { assumirFilaSetorial, chamarFilaSetorial, concluirFilaSetorial } from "@/modules/fluxo-setorial/actions";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const META: Record<string, { titulo: string; descricao: string; Icon: typeof Pill; ponto: string }> = {
  enfermagem: { titulo: "Fila da Enfermagem", descricao: "Pacientes encaminhados para cuidados e procedimentos de enfermagem.", Icon: Activity, ponto: "Box Enfermagem 01" },
  farmacia: { titulo: "Fila da Farmácia", descricao: "Pacientes encaminhados para dispensação ou orientação farmacêutica.", Icon: Pill, ponto: "Guichê Farmácia 01" },
  laboratorio: { titulo: "Fila do Laboratório", descricao: "Pacientes encaminhados para coleta e exames laboratoriais.", Icon: FlaskConical, ponto: "Sala de Coleta 01" },
  imagem: { titulo: "Fila de Diagnóstico por Imagem", descricao: "Pacientes encaminhados para exames de imagem.", Icon: ScanLine, ponto: "Sala de Exame 01" },
  internacao: { titulo: "Fila de Internação", descricao: "Pacientes aguardando admissão hospitalar ou movimentação para leito.", Icon: BedDouble, ponto: "Admissão de Internação" },
};

function one<T>(rel: T | T[] | null) {
  return Array.isArray(rel) ? rel[0] ?? null : rel;
}

function prioridadeClass(prioridade: string | null) {
  if (prioridade === "emergencia") return "bg-rose-100 text-rose-700";
  if (prioridade === "preferencial") return "bg-amber-100 text-amber-700";
  return "bg-emerald-100 text-emerald-700";
}

export default async function SetorPage({
  params,
  searchParams,
}: {
  params: Promise<{ setor: string }>;
  searchParams: Promise<{ atendimento?: string; erro?: string; sucesso?: string; chamado?: string }>;
}) {
  const { setor } = await params;
  const sp = await searchParams;
  const meta = META[setor] ?? { titulo: "Fila Setorial", descricao: "Fila operacional do setor.", Icon: Activity, ponto: "Ponto de Atendimento 01" };
  const { supabase, unidadeId } = await getAssistencialContext();

  const { data: fila, error } = await supabase
    .from("filas_setoriais")
    .select("id,status,prioridade,motivo,created_at,chamado_em,iniciado_em,ponto_atendimento,atendimento_id,paciente:pacientes(nome_completo,ra,numero_registro),atendimento:atendimentos(numero_atendimento,setor_atual)")
    .eq("unidade_id", unidadeId)
    .eq("setor_codigo", setor)
    .in("status", ["aguardando", "chamado", "em_atendimento"])
    .order("created_at", { ascending: true })
    .limit(200);

  const atual = sp.atendimento ? (fila ?? []).find((item) => String(item.atendimento_id) === sp.atendimento) : null;
  const aguardando = (fila ?? []).filter((item) => item.status === "aguardando").length;
  const chamados = (fila ?? []).filter((item) => item.status === "chamado").length;
  const emAtendimento = (fila ?? []).filter((item) => item.status === "em_atendimento").length;
  const Icon = meta.Icon;
  const painelHref = `/painel-chamadas/${unidadeId}?setor=${encodeURIComponent(setor)}` as Route;

  return (
    <SectionPage eyebrow={`Assistencial / Setores / ${setor}`} title={meta.titulo} description={meta.descricao}>
      {sp.erro ? <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">Não foi possível concluir a ação desta fila. Verifique o ponto de atendimento e tente novamente.</div> : null}
      {sp.sucesso ? <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">Atendimento setorial concluído.</div> : null}
      {sp.chamado ? <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-medium text-blue-700">Paciente chamado no painel do setor.</div> : null}
      {error ? <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">A fila não pôde ser atualizada completamente.</div> : null}

      <section className="grid gap-3 sm:grid-cols-3">
        <div className="his-kpi"><p className="text-xs font-bold uppercase tracking-wider text-slate-400">Aguardando</p><p className="mt-2 text-3xl font-black text-brand-950">{aguardando}</p></div>
        <div className="his-kpi"><p className="text-xs font-bold uppercase tracking-wider text-slate-400">Chamados</p><p className="mt-2 text-3xl font-black text-violet-700">{chamados}</p></div>
        <div className="his-kpi"><p className="text-xs font-bold uppercase tracking-wider text-slate-400">Em atendimento</p><p className="mt-2 text-3xl font-black text-emerald-700">{emAtendimento}</p></div>
      </section>

      <section className="his-card mt-4 p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-2xl bg-brand-50 text-brand-700"><Icon className="size-5" /></span>
            <div><h2 className="font-bold text-slate-900">Central de chamadas do setor</h2><p className="mt-1 text-sm text-slate-500">Chame o paciente e acompanhe a atualização automática da fila.</p></div>
          </div>
          <div className="flex flex-wrap gap-2">
            <QueueAutoRefresh />
            <Link href={painelHref} target="_blank" className="btn-secondary h-9 text-xs"><ExternalLink className="size-3.5" /> Abrir painel do setor</Link>
          </div>
        </div>
      </section>

      {atual ? (
        <section className="his-card mt-4 border-brand-100 p-5">
          <div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-brand-50 text-brand-700"><PlayCircle className="size-5" /></span><div><h2 className="font-semibold text-slate-900">Em atendimento no setor</h2><p className="text-sm text-slate-500">Finalize quando a etapa estiver concluída. O paciente retornará ao fluxo assistencial.</p></div></div>
          <form action={concluirFilaSetorial} className="mt-4"><input type="hidden" name="fila_id" value={atual.id} /><input type="hidden" name="setor_codigo" value={setor} /><button className="ui-button-primary">Concluir etapa do setor</button></form>
        </section>
      ) : null}

      <div className="mt-4 space-y-3">
        {fila?.length ? fila.map((item) => {
          const paciente = one(item.paciente);
          const atendimento = one(item.atendimento);
          const chamado = item.status === "chamado";
          const emAtendimentoItem = item.status === "em_atendimento";
          return (
            <article key={item.id} className={`his-card p-5 ${chamado ? "border-violet-200" : ""}`}>
              <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-bold text-slate-900">{paciente?.nome_completo ?? "Paciente"}</h2>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${prioridadeClass(item.prioridade)}`}>{item.prioridade ?? "normal"}</span>
                    {chamado ? <span className="rounded-full bg-violet-100 px-2.5 py-1 text-xs font-semibold text-violet-700">Chamado</span> : null}
                    {emAtendimentoItem ? <span className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700">Em atendimento</span> : null}
                  </div>
                  <p className="mt-1 text-sm text-slate-500">Atendimento #{atendimento?.numero_atendimento ?? "—"} · Registro #{paciente?.numero_registro ?? "—"} · {paciente?.ra ?? "—"}</p>
                  {item.motivo ? <p className="mt-2 text-sm text-slate-700"><b>Motivo:</b> {item.motivo}</p> : null}
                  {item.ponto_atendimento ? <p className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-violet-700"><MapPin className="size-4" />{item.ponto_atendimento}</p> : null}
                </div>

                <div className="flex min-w-0 flex-col gap-2 sm:min-w-[340px]">
                  {!emAtendimentoItem ? (
                    <form action={chamarFilaSetorial} className="flex flex-col gap-2 sm:flex-row">
                      <input type="hidden" name="fila_id" value={item.id} />
                      <input type="hidden" name="setor_codigo" value={setor} />
                      <input name="ponto_atendimento" defaultValue={item.ponto_atendimento || meta.ponto} required className="ui-input h-10 min-w-0 flex-1" aria-label="Ponto de atendimento" />
                      <button className={chamado ? "btn-secondary h-10 whitespace-nowrap" : "ui-button-primary h-10 whitespace-nowrap"}><BellRing className="size-4" />{chamado ? "Rechamar" : "Chamar"}</button>
                    </form>
                  ) : null}

                  {chamado ? (
                    <form action={assumirFilaSetorial} className="flex justify-end">
                      <input type="hidden" name="fila_id" value={item.id} />
                      <input type="hidden" name="setor_codigo" value={setor} />
                      <button className="ui-button-primary h-10"><PlayCircle className="size-4" /> Iniciar atendimento</button>
                    </form>
                  ) : null}
                </div>
              </div>
            </article>
          );
        }) : <div className="his-card p-8 text-center text-sm text-slate-500">Nenhum paciente aguardando neste setor.</div>}
      </div>
    </SectionPage>
  );
}
