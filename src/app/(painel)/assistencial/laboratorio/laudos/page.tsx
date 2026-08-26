import type { Route } from "next";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, FileText, FlaskConical, Microscope } from "lucide-react";
import { SectionPage } from "@/components/painel/section-page";
import { abrirLaudoLaboratorio } from "@/modules/assistencial/laboratorio-laudo-actions";
import { getAssistencialContext } from "@/modules/assistencial/context";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const one = <T,>(value: T | T[] | null | undefined): T | null => Array.isArray(value) ? value[0] ?? null : value ?? null;
const fmt = (value?: string | null) => value ? new Date(value).toLocaleString("pt-BR") : "—";

type Search = { erro?: string; sucesso?: string };

export default async function LaboratorioLaudosPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const { supabase, unidadeId } = await getAssistencialContext();

  const [solReq, laudoReq, resultadoReq] = await Promise.all([
    supabase
      .from("solicitacoes_exames")
      .select("id,atendimento_id,exame,codigo_tuss,prioridade,status,created_at,atendimento:atendimentos(numero_atendimento,paciente:pacientes(nome_completo,ra,numero_registro))")
      .eq("unidade_id", unidadeId)
      .ilike("modalidade", "%laborat%")
      .in("status", ["solicitado", "coleta", "processamento", "liberado"])
      .order("created_at", { ascending: false })
      .limit(300),
    supabase
      .from("laboratorio_laudos")
      .select("id,solicitacao_id,status,versao,liberado_em,motivo_retificacao,updated_at")
      .eq("unidade_id", unidadeId)
      .order("updated_at", { ascending: false })
      .limit(500),
    supabase
      .from("laboratorio_resultados")
      .select("id,solicitacao_id,liberado,valor_critico,notificado_em")
      .eq("unidade_id", unidadeId)
      .limit(3000),
  ]);

  const solicitacoes = solReq.data ?? [];
  const laudos = laudoReq.data ?? [];
  const resultados = resultadoReq.data ?? [];
  const laudoPorSolicitacao = new Map(laudos.map((laudo) => [laudo.solicitacao_id, laudo]));
  const resumoResultados = new Map<string, { total: number; validados: number; criticosPendentes: number }>();

  for (const resultado of resultados) {
    const atual = resumoResultados.get(resultado.solicitacao_id) ?? { total: 0, validados: 0, criticosPendentes: 0 };
    atual.total += 1;
    if (resultado.liberado) atual.validados += 1;
    if (resultado.valor_critico && !resultado.notificado_em) atual.criticosPendentes += 1;
    resumoResultados.set(resultado.solicitacao_id, atual);
  }

  const liberados = laudos.filter((laudo) => laudo.status === "liberado").length;
  const rascunhos = laudos.filter((laudo) => laudo.status !== "liberado").length;
  const criticosAbertos = Array.from(resumoResultados.values()).reduce((sum, item) => sum + item.criticosPendentes, 0);

  return (
    <SectionPage
      eyebrow="Assistencial / Laboratório / LIS"
      title="Bancada de laudos"
      description="Resultados estruturados, validação técnica, valores críticos, laudo final, assinatura e retificação no mesmo fluxo."
    >
      {sp.erro ? <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">Falha: {decodeURIComponent(sp.erro)}.</div> : null}
      {sp.sucesso ? <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">Operação concluída: {sp.sucesso}.</div> : null}

      <div className="mb-5 flex flex-wrap gap-2">
        <Link href="/assistencial/laboratorio" className="ui-button-secondary">Voltar ao Laboratório</Link>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi icon={FlaskConical} label="Exames na bancada" value={solicitacoes.length} />
        <Kpi icon={FileText} label="Laudos em edição" value={rascunhos} />
        <Kpi icon={CheckCircle2} label="Laudos liberados" value={liberados} />
        <Kpi icon={AlertTriangle} label="Críticos sem comunicação" value={criticosAbertos} danger={criticosAbertos > 0} />
      </section>

      <section className="his-card mt-5 overflow-hidden">
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 className="font-black text-slate-950">Fila de laudos</h2>
          <p className="text-sm text-slate-500">O exame só é considerado liberado após assinatura do laudo final.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Paciente / exame</th>
                <th className="px-4 py-3">Atendimento</th>
                <th className="px-4 py-3">Resultados</th>
                <th className="px-4 py-3">Críticos</th>
                <th className="px-4 py-3">Laudo</th>
                <th className="px-4 py-3">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {solicitacoes.length ? solicitacoes.map((sol) => {
                const atendimento = one(sol.atendimento);
                const paciente = one(atendimento?.paciente);
                const laudo = laudoPorSolicitacao.get(sol.id);
                const resumo = resumoResultados.get(sol.id) ?? { total: 0, validados: 0, criticosPendentes: 0 };
                return (
                  <tr key={sol.id} className="align-top">
                    <td className="px-4 py-4">
                      <p className="font-black text-slate-900">{sol.exame}</p>
                      <p className="text-xs text-slate-500">{paciente?.nome_completo ?? "Paciente"} · RA {paciente?.ra ?? "—"}</p>
                      <p className="mt-1 text-xs text-slate-400">TUSS {sol.codigo_tuss ?? "—"} · {sol.prioridade} · solicitado {fmt(sol.created_at)}</p>
                    </td>
                    <td className="px-4 py-4">#{atendimento?.numero_atendimento ?? "—"}</td>
                    <td className="px-4 py-4">
                      <p className="font-bold">{resumo.validados}/{resumo.total} validados</p>
                      <p className="text-xs text-slate-500">Status do pedido: {sol.status}</p>
                    </td>
                    <td className="px-4 py-4">
                      {resumo.criticosPendentes > 0
                        ? <span className="rounded-full bg-rose-50 px-2.5 py-1 text-xs font-black text-rose-700">{resumo.criticosPendentes} pendente(s)</span>
                        : <span className="text-xs font-bold text-emerald-700">Sem crítico pendente</span>}
                    </td>
                    <td className="px-4 py-4">
                      {laudo ? <><p className="font-bold capitalize">{laudo.status.replaceAll("_", " ")}</p><p className="text-xs text-slate-500">Versão {laudo.versao}{laudo.liberado_em ? ` · ${fmt(laudo.liberado_em)}` : ""}</p></> : <span className="text-slate-400">Não iniciado</span>}
                    </td>
                    <td className="px-4 py-4">
                      {laudo ? (
                        <Link href={`/assistencial/laboratorio/laudos/${laudo.id}` as Route} className="ui-button-secondary">Abrir laudo</Link>
                      ) : (
                        <form action={abrirLaudoLaboratorio}>
                          <input type="hidden" name="solicitacao_id" value={sol.id} />
                          <button className="ui-button-primary" disabled={resumo.total === 0} title={resumo.total === 0 ? "Registre ao menos um resultado antes de iniciar o laudo" : undefined}>
                            <Microscope className="size-4" /> Iniciar laudo
                          </button>
                        </form>
                      )}
                    </td>
                  </tr>
                );
              }) : <tr><td colSpan={6} className="px-4 py-10 text-center text-slate-500">Nenhum exame laboratorial na bancada.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </SectionPage>
  );
}

function Kpi({ icon: Icon, label, value, danger = false }: { icon: typeof FlaskConical; label: string; value: number; danger?: boolean }) {
  return <div className="his-kpi"><div className="flex items-center justify-between"><p className="text-xs font-black uppercase tracking-wider text-slate-400">{label}</p><Icon className={`size-5 ${danger ? "text-rose-600" : "text-brand-600"}`} /></div><p className={`mt-2 text-3xl font-black ${danger ? "text-rose-700" : "text-brand-950"}`}>{value}</p></div>;
}
