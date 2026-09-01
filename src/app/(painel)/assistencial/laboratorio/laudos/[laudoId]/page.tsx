import type { Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, CheckCircle2, FileClock, FileText, FlaskConical, RotateCcw } from "lucide-react";
import { LaboratoryReportBackgroundForm } from "@/components/laboratorio/laboratory-report-background-form";
import { SectionPage } from "@/components/painel/section-page";
import { getAssistencialContext } from "@/modules/assistencial/context";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const fmt = (value?: string | null) => value ? new Date(value).toLocaleString("pt-BR") : "—";
const one = <T,>(value: T | T[] | null | undefined): T | null => Array.isArray(value) ? value[0] ?? null : value ?? null;

export default async function LaboratorioLaudoPage({
  params,
  searchParams,
}: {
  params: Promise<{ laudoId: string }>;
  searchParams: Promise<{ sucesso?: string; erro?: string }>;
}) {
  const [{ laudoId }, sp] = await Promise.all([params, searchParams]);
  const { supabase, empresaId, unidadeId } = await getAssistencialContext();

  const [visualizarReq, resultarReq, laudarReq, liberarReq] = await Promise.all(
    ["laboratorio.visualizar", "laboratorio.resultar", "laboratorio.laudar", "laboratorio.liberar"].map((codigo) =>
      supabase.rpc("tem_permissao", { p_empresa: empresaId, p_unidade: unidadeId, p_codigo: codigo }),
    ),
  );
  const podeVisualizarModulo = !visualizarReq.error && visualizarReq.data === true;
  const podeResultar = !resultarReq.error && resultarReq.data === true;
  const podeLaudar = !laudarReq.error && laudarReq.data === true;
  const podeLiberar = !liberarReq.error && liberarReq.data === true;

  const { data: laudo } = await supabase
    .from("laboratorio_laudos")
    .select("id,solicitacao_id,amostra_id,atendimento_id,paciente_id,titulo,material,metodo,corpo,conclusao,observacoes,status,versao,responsavel_tecnico_id,validado_por,validado_em,liberado_por,liberado_em,assinatura_hash,motivo_retificacao,publicado_portal,publicado_em,created_at,updated_at")
    .eq("id", laudoId)
    .eq("empresa_id", empresaId)
    .eq("unidade_id", unidadeId)
    .maybeSingle();

  if (!laudo) notFound();

  const [solReq, amostraReq, atReq, resultadoReq, histReq, profReq] = await Promise.all([
    supabase
      .from("solicitacoes_exames")
      .select("id,exame,codigo_tuss,indicacao_clinica,prioridade,status,created_at,catalogo_exame_id")
      .eq("id", laudo.solicitacao_id)
      .maybeSingle(),
    laudo.amostra_id
      ? supabase
          .from("laboratorio_amostras")
          .select("id,codigo_amostra,accession_number,material,recipiente,status,coleta_prevista_em,coletada_em,recebida_em,temperatura_recebimento,rejeitada_motivo,setor_processamento,bancada_processamento")
          .eq("id", laudo.amostra_id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    supabase
      .from("atendimentos")
      .select("numero_atendimento,paciente:pacientes(nome_completo,ra,numero_registro,data_nascimento,sexo)")
      .eq("id", laudo.atendimento_id)
      .maybeSingle(),
    supabase
      .from("laboratorio_resultados")
      .select("id,analito,resultado,valor_numerico,unidade_medida,referencia_min,referencia_max,referencia_texto,flag,metodo,liberado,liberado_em,valor_critico,criticidade,notificado_em,notificado_a,created_at")
      .eq("solicitacao_id", laudo.solicitacao_id)
      .order("created_at", { ascending: true }),
    supabase
      .from("laboratorio_laudos_historico")
      .select("id,versao,motivo,criado_em")
      .eq("laudo_id", laudo.id)
      .order("versao", { ascending: false })
      .limit(30),
    laudo.responsavel_tecnico_id
      ? supabase
          .from("profissionais")
          .select("nome_completo,conselho,numero_conselho,uf_conselho,especialidade")
          .eq("id", laudo.responsavel_tecnico_id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);

  const solicitacao = solReq.data;
  const amostra = amostraReq.data;
  const atendimento = atReq.data;
  const paciente = one(atendimento?.paciente);
  const resultados = resultadoReq.data ?? [];
  const historico = histReq.data ?? [];
  const profissional = profReq.data;
  const liberado = laudo.status === "liberado";
  const criticosPendentes = resultados.filter((r) => r.valor_critico && !r.notificado_em);
  const resultadosNaoValidados = resultados.filter((r) => !r.liberado);

  return (
    <SectionPage
      eyebrow="Assistencial / Laboratório / LIS"
      title={laudo.titulo || solicitacao?.exame || "Laudo laboratorial"}
      description={`Atendimento #${atendimento?.numero_atendimento ?? "—"} · ${paciente?.nome_completo ?? "Paciente"} · versão ${laudo.versao}`}
    >
      {sp.sucesso ? <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">Operação concluída: {sp.sucesso}.</div> : null}
      {sp.erro ? <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">Falha: {decodeURIComponent(sp.erro)}.</div> : null}

      <div className="mb-5 flex flex-wrap gap-2">
        <Link href={`/prontuario/${laudo.atendimento_id}/historico` as Route} className="ui-button-secondary">Voltar ao histórico</Link>
        {podeVisualizarModulo ? <Link href="/assistencial/laboratorio/laudos" className="ui-button-secondary">Voltar à bancada</Link> : null}
        {podeVisualizarModulo ? <Link href="/assistencial/laboratorio" className="ui-button-secondary">Laboratório</Link> : null}
        <Link href={`/assistencial/laboratorio/laudos/${laudo.id}/imprimir` as Route} className="ui-button-secondary">
          <FileText className="size-4" /> Imprimir / PDF
        </Link>
      </div>

      {criticosPendentes.length > 0 ? (
        <div className="mb-5 rounded-2xl border border-rose-300 bg-rose-50 p-4 text-rose-900">
          <div className="flex items-center gap-2 font-black"><AlertTriangle className="size-5" /> Valor crítico pendente de comunicação</div>
          <p className="mt-1 text-sm">O laudo final não pode ser liberado até que todos os valores críticos sejam comunicados e registrados.</p>
        </div>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-[1.6fr_0.8fr]">
        <div className="space-y-4">
          <div className="his-card p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-wider text-slate-400">Paciente / exame</p>
                <h2 className="mt-1 text-lg font-black text-slate-950">{paciente?.nome_completo ?? "Paciente"}</h2>
                <p className="text-sm text-slate-500">RA {paciente?.ra ?? "—"} · registro {paciente?.numero_registro ?? "—"} · nascimento {paciente?.data_nascimento ? new Date(`${paciente.data_nascimento}T12:00:00`).toLocaleDateString("pt-BR") : "—"}</p>
              </div>
              <span className={liberado ? "rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700" : "rounded-full bg-amber-50 px-3 py-1 text-xs font-black text-amber-700"}>
                {liberado ? "LAUDO LIBERADO" : "EM EDIÇÃO"}
              </span>
            </div>
            <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-4">
              <Info label="Exame" value={solicitacao?.exame ?? "—"} />
              <Info label="TUSS" value={solicitacao?.codigo_tuss ?? "—"} />
              <Info label="Prioridade" value={solicitacao?.prioridade ?? "—"} />
              <Info label="Status pedido" value={solicitacao?.status ?? "—"} />
              <Info label="Amostra" value={amostra?.codigo_amostra ?? "—"} />
              <Info label="Accession" value={amostra?.accession_number ?? "—"} />
              <Info label="Material" value={amostra?.material ?? laudo.material ?? "—"} />
              <Info label="Recipiente" value={amostra?.recipiente ?? "—"} />
              <Info label="Setor" value={amostra?.setor_processamento ?? "—"} />
              <Info label="Bancada" value={amostra?.bancada_processamento ?? "—"} />
              <Info label="Coleta" value={fmt(amostra?.coletada_em)} />
              <Info label="Recebimento" value={fmt(amostra?.recebida_em)} />
              <Info label="Temperatura" value={amostra?.temperatura_recebimento !== null && amostra?.temperatura_recebimento !== undefined ? `${amostra.temperatura_recebimento} °C` : "—"} />
              <Info label="Resultados" value={`${resultados.length - resultadosNaoValidados.length}/${resultados.length} validados`} />
            </div>
            {solicitacao?.indicacao_clinica ? <div className="mt-4 rounded-xl bg-slate-50 p-3"><p className="text-xs font-black uppercase text-slate-400">Indicação clínica</p><p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{solicitacao.indicacao_clinica}</p></div> : null}
          </div>

          <div className="his-card overflow-hidden">
            <div className="border-b border-slate-100 px-5 py-4">
              <div className="flex items-center gap-2"><FlaskConical className="size-5 text-brand-700" /><h2 className="font-black">Resultados por analito</h2></div>
              <p className="text-sm text-slate-500">Validação técnica não equivale à liberação final do exame.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                  <tr><th className="px-4 py-3">Analito</th><th className="px-4 py-3">Resultado</th><th className="px-4 py-3">Referência</th><th className="px-4 py-3">Flag</th><th className="px-4 py-3">Validação / crítico</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {resultados.length ? resultados.map((resultado) => (
                    <tr key={resultado.id} className="align-top">
                      <td className="px-4 py-4"><p className="font-black">{resultado.analito}</p><p className="text-xs text-slate-400">{resultado.metodo ?? "Método não informado"}</p></td>
                      <td className="px-4 py-4 font-semibold">{resultado.resultado ?? resultado.valor_numerico ?? "—"} {resultado.unidade_medida ?? ""}</td>
                      <td className="px-4 py-4 text-xs text-slate-600">{referencia(resultado.referencia_texto, resultado.referencia_min, resultado.referencia_max)}</td>
                      <td className="px-4 py-4"><Flag value={resultado.flag} critical={resultado.valor_critico} /></td>
                      <td className="px-4 py-4">
                        <div className="space-y-2">
                          {resultado.liberado ? <p className="text-xs font-bold text-emerald-700">Validado {fmt(resultado.liberado_em)}</p> : podeResultar ? (
                            <LaboratoryReportBackgroundForm kind="validate">
                              <input type="hidden" name="laudo_id" value={laudo.id} />
                              <input type="hidden" name="resultado_id" value={resultado.id} />
                              <button className="ui-button-secondary">Validar analito</button>
                            </LaboratoryReportBackgroundForm>
                          ) : <p className="text-xs text-slate-500">Aguardando validação técnica.</p>}
                          {resultado.valor_critico ? resultado.notificado_em ? (
                            <p className="text-xs font-bold text-rose-700">Crítico comunicado a {resultado.notificado_a ?? "destinatário registrado"} · {fmt(resultado.notificado_em)}</p>
                          ) : podeResultar ? (
                            <LaboratoryReportBackgroundForm kind="critical" resetOnSuccess className="grid gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3">
                              <input type="hidden" name="laudo_id" value={laudo.id} />
                              <input type="hidden" name="resultado_id" value={resultado.id} />
                              <input name="notificado_a" required className="ui-input" placeholder="Comunicado a" />
                              <div className="flex flex-wrap gap-2">
                                <select name="meio" defaultValue="telefone" className="ui-input max-w-36"><option value="telefone">Telefone</option><option value="presencial">Presencial</option><option value="sistema">Sistema</option></select>
                                <label className="flex items-center gap-2 rounded-lg border border-rose-200 px-3 text-xs font-bold"><input type="checkbox" name="readback" /> Read-back</label>
                              </div>
                              <input name="observacoes" className="ui-input" placeholder="Observações da comunicação" />
                              <button className="ui-button-primary justify-self-end">Registrar comunicação</button>
                            </LaboratoryReportBackgroundForm>
                          ) : <p className="text-xs font-bold text-rose-700">Comunicação crítica pendente pela equipe do laboratório.</p> : null}
                        </div>
                      </td>
                    </tr>
                  )) : <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-500">Nenhum resultado registrado.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>

          {!liberado && podeLaudar ? (
            <LaboratoryReportBackgroundForm kind="save" className="his-card p-6">
              <input type="hidden" name="laudo_id" value={laudo.id} />
              <input type="hidden" name="solicitacao_id" value={laudo.solicitacao_id} />
              <div className="mb-4"><h2 className="font-black">Editor do laudo</h2><p className="text-sm text-slate-500">Resultados estruturados ficam acima; use o texto para interpretação, conclusão e observações quando aplicável.</p></div>
              {laudo.motivo_retificacao ? <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800"><strong>Retificação:</strong> {laudo.motivo_retificacao}</div> : null}
              <div className="grid gap-4">
                <label className="grid gap-1 text-sm font-semibold text-slate-700">Título<input name="titulo" defaultValue={laudo.titulo ?? solicitacao?.exame ?? ""} className="ui-input" /></label>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="grid gap-1 text-sm font-semibold text-slate-700">Material<input name="material" defaultValue={laudo.material ?? amostra?.material ?? ""} className="ui-input" /></label>
                  <label className="grid gap-1 text-sm font-semibold text-slate-700">Método<input name="metodo" defaultValue={laudo.metodo ?? ""} className="ui-input" /></label>
                </div>
                <label className="grid gap-1 text-sm font-semibold text-slate-700">Descrição / interpretação<textarea name="corpo" rows={8} defaultValue={laudo.corpo ?? ""} className="ui-input" /></label>
                <label className="grid gap-1 text-sm font-semibold text-slate-700">Conclusão<textarea name="conclusao" rows={5} defaultValue={laudo.conclusao ?? ""} className="ui-input" /></label>
                <label className="grid gap-1 text-sm font-semibold text-slate-700">Observações<textarea name="observacoes" rows={3} defaultValue={laudo.observacoes ?? ""} className="ui-input" /></label>
                <div className="flex justify-end"><button className="ui-button-secondary">Salvar rascunho</button></div>
              </div>
            </LaboratoryReportBackgroundForm>
          ) : liberado ? (
            <div className="his-card p-6">
              <div className="mb-5 flex items-center gap-2"><CheckCircle2 className="size-5 text-emerald-700" /><h2 className="font-black">Laudo assinado</h2></div>
              <ReportSection title="Descrição / interpretação" value={laudo.corpo} />
              <ReportSection title="Conclusão" value={laudo.conclusao} />
              <ReportSection title="Observações" value={laudo.observacoes} />
              <div className="mt-5 border-t border-slate-200 pt-4 text-sm text-slate-600">
                <p className="font-bold text-slate-900">{profissional?.nome_completo ?? "Responsável técnico"}</p>
                <p>{[profissional?.conselho, profissional?.numero_conselho, profissional?.uf_conselho].filter(Boolean).join(" ") || profissional?.especialidade || "—"}</p>
                <p>Liberado em {fmt(laudo.liberado_em)} · versão {laudo.versao}</p>
                <p className="mt-1 break-all font-mono text-[11px] text-slate-400">Hash: {laudo.assinatura_hash ?? "—"}</p>
              </div>
            </div>
          ) : null}

          {!liberado && podeLiberar ? (
            <LaboratoryReportBackgroundForm kind="release" className="his-card p-5">
              <input type="hidden" name="laudo_id" value={laudo.id} />
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div><h2 className="font-black">Assinar e liberar exame</h2><p className="text-sm text-slate-500">A liberação final assina o laudo, consolida os resultados e encerra a solicitação laboratorial.</p></div>
                <button className="ui-button-primary" disabled={resultados.length === 0 || criticosPendentes.length > 0}><CheckCircle2 className="size-4" /> Assinar e liberar</button>
              </div>
            </LaboratoryReportBackgroundForm>
          ) : liberado && podeLiberar ? (
            <LaboratoryReportBackgroundForm kind="rectify" resetOnSuccess className="his-card p-5">
              <input type="hidden" name="laudo_id" value={laudo.id} />
              <div className="flex items-center gap-2"><RotateCcw className="size-5 text-amber-700" /><h2 className="font-black">Abrir retificação</h2></div>
              <p className="mt-1 text-sm text-slate-500">A versão liberada permanece preservada no histórico e uma nova versão editável é criada.</p>
              <div className="mt-4 flex flex-col gap-3 sm:flex-row"><input name="motivo" required className="ui-input flex-1" placeholder="Motivo obrigatório da retificação" /><button className="ui-button-secondary">Retificar laudo</button></div>
            </LaboratoryReportBackgroundForm>
          ) : null}
        </div>

        <aside className="space-y-4">
          <div className="his-card p-5">
            <div className="flex items-center gap-2"><FileClock className="size-5 text-brand-700" /><h2 className="font-black">Histórico do laudo</h2></div>
            <div className="mt-4 space-y-3">
              {historico.length ? historico.map((item) => <div key={item.id} className="rounded-xl border border-slate-100 p-3"><div className="flex items-center justify-between gap-2"><span className="text-sm font-black">Versão {item.versao}</span><span className="text-xs text-slate-400">{fmt(item.criado_em)}</span></div><p className="mt-1 text-xs text-slate-500">{item.motivo ?? "Registro de versão"}</p></div>) : <p className="text-sm text-slate-500">O histórico será criado na primeira liberação.</p>}
            </div>
          </div>

          <div className="his-card p-5 text-sm text-slate-600">
            <h2 className="font-black text-slate-900">Regra de liberação</h2>
            <p className="mt-2">Analitos podem ser validados individualmente. O pedido só passa a <strong>liberado</strong> após a assinatura do laudo final.</p>
            <p className="mt-2">Valores críticos exigem comunicação registrada antes da assinatura. Essa regra também é validada no banco.</p>
          </div>
        </aside>
      </section>
    </SectionPage>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <div><p className="text-[11px] font-black uppercase tracking-wider text-slate-400">{label}</p><p className="mt-1 break-words font-semibold text-slate-700">{value}</p></div>;
}

function Flag({ value, critical }: { value?: string | null; critical: boolean }) {
  if (critical) return <span className="rounded-full bg-rose-100 px-2.5 py-1 text-xs font-black text-rose-700">{value ?? "CRÍTICO"}</span>;
  if (!value) return <span className="text-xs font-bold text-emerald-700">NORMAL</span>;
  return <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-black text-amber-700">{value}</span>;
}

function referencia(texto: string | null, minimo: number | null, maximo: number | null) {
  if (texto) return texto;
  if (minimo !== null && maximo !== null) return `${minimo} – ${maximo}`;
  if (minimo !== null) return `≥ ${minimo}`;
  if (maximo !== null) return `≤ ${maximo}`;
  return "—";
}

function ReportSection({ title, value }: { title: string; value?: string | null }) {
  if (!value) return null;
  return <section className="mb-5"><h3 className="mb-2 text-xs font-black uppercase tracking-wider text-slate-400">{title}</h3><p className="whitespace-pre-wrap text-sm leading-7 text-slate-800">{value}</p></section>;
}
