import type { Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PrintButton } from "@/components/print-button";
import { getAssistencialContext } from "@/modules/assistencial/context";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const fmt = (value?: string | null) => value ? new Date(value).toLocaleString("pt-BR") : "—";
const one = <T,>(value: T | T[] | null | undefined): T | null => Array.isArray(value) ? value[0] ?? null : value ?? null;

export default async function ImprimirLaudoLaboratorioPage({ params }: { params: Promise<{ laudoId: string }> }) {
  const { laudoId } = await params;
  const { supabase, empresaId, unidadeId } = await getAssistencialContext();

  const { data: laudo } = await supabase
    .from("laboratorio_laudos")
    .select("id,solicitacao_id,amostra_id,atendimento_id,titulo,material,metodo,corpo,conclusao,observacoes,status,versao,responsavel_tecnico_id,liberado_em,assinatura_hash,motivo_retificacao")
    .eq("id", laudoId)
    .eq("empresa_id", empresaId)
    .eq("unidade_id", unidadeId)
    .maybeSingle();
  if (!laudo) notFound();

  const [solReq, amostraReq, atReq, resultadoReq, profReq, unidadeReq] = await Promise.all([
    supabase.from("solicitacoes_exames").select("exame,codigo_tuss,indicacao_clinica,prioridade,created_at").eq("id", laudo.solicitacao_id).maybeSingle(),
    laudo.amostra_id
      ? supabase.from("laboratorio_amostras").select("codigo_amostra,accession_number,material,recipiente,coletada_em,recebida_em").eq("id", laudo.amostra_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    supabase.from("atendimentos").select("numero_atendimento,paciente:pacientes(nome_completo,ra,numero_registro,data_nascimento,sexo)").eq("id", laudo.atendimento_id).maybeSingle(),
    supabase.from("laboratorio_resultados").select("id,analito,resultado,valor_numerico,unidade_medida,referencia_min,referencia_max,referencia_texto,flag,metodo,valor_critico").eq("solicitacao_id", laudo.solicitacao_id).order("created_at", { ascending: true }),
    laudo.responsavel_tecnico_id
      ? supabase.from("profissionais").select("nome_completo,conselho,numero_conselho,uf_conselho,especialidade").eq("id", laudo.responsavel_tecnico_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    supabase.from("unidades").select("nome,cnes").eq("id", unidadeId).maybeSingle(),
  ]);

  const solicitacao = solReq.data;
  const amostra = amostraReq.data;
  const atendimento = atReq.data;
  const paciente = one(atendimento?.paciente);
  const resultados = resultadoReq.data ?? [];
  const profissional = profReq.data;
  const unidade = unidadeReq.data;
  const rascunho = laudo.status !== "liberado";

  return (
    <main className="mx-auto max-w-5xl bg-white px-5 py-6 text-slate-950 print:max-w-none print:px-0 print:py-0">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link href={`/assistencial/laboratorio/laudos/${laudo.id}` as Route} className="ui-button-secondary">Voltar ao editor</Link>
        <PrintButton label="Imprimir / salvar PDF" />
      </div>

      {rascunho ? <div className="mb-5 border-2 border-dashed border-amber-400 p-3 text-center text-sm font-black uppercase tracking-[0.25em] text-amber-700">Rascunho — não liberado</div> : null}

      <header className="border-b-2 border-slate-900 pb-4">
        <div className="flex items-start justify-between gap-6">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Laboratório Clínico</p>
            <h1 className="mt-1 text-2xl font-black">{laudo.titulo || solicitacao?.exame || "Laudo laboratorial"}</h1>
            <p className="mt-1 text-sm text-slate-600">{unidade?.nome ?? "Unidade hospitalar"}{unidade?.cnes ? ` · CNES ${unidade.cnes}` : ""}</p>
          </div>
          <div className="text-right text-xs text-slate-500">
            <p>Versão {laudo.versao}</p>
            <p>Liberado: {fmt(laudo.liberado_em)}</p>
          </div>
        </div>
      </header>

      <section className="mt-5 grid gap-x-6 gap-y-3 border-b border-slate-300 pb-5 text-sm sm:grid-cols-2">
        <Field label="Paciente" value={paciente?.nome_completo ?? "—"} />
        <Field label="RA / registro" value={`${paciente?.ra ?? "—"} / ${paciente?.numero_registro ?? "—"}`} />
        <Field label="Nascimento" value={paciente?.data_nascimento ? new Date(`${paciente.data_nascimento}T12:00:00`).toLocaleDateString("pt-BR") : "—"} />
        <Field label="Atendimento" value={`#${atendimento?.numero_atendimento ?? "—"}`} />
        <Field label="Exame" value={solicitacao?.exame ?? "—"} />
        <Field label="Código TUSS" value={solicitacao?.codigo_tuss ?? "—"} />
        <Field label="Amostra" value={amostra?.codigo_amostra ?? "—"} />
        <Field label="Accession" value={amostra?.accession_number ?? "—"} />
        <Field label="Material / recipiente" value={`${amostra?.material ?? laudo.material ?? "—"} / ${amostra?.recipiente ?? "—"}`} />
        <Field label="Coleta / recebimento" value={`${fmt(amostra?.coletada_em)} / ${fmt(amostra?.recebida_em)}`} />
      </section>

      {solicitacao?.indicacao_clinica ? <ReportSection title="Indicação clínica" value={solicitacao.indicacao_clinica} /> : null}

      <section className="mt-7">
        <h2 className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Resultados</h2>
        <div className="mt-3 overflow-hidden border border-slate-300">
          <table className="w-full border-collapse text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr><th className="border-b border-slate-300 px-3 py-2">Analito</th><th className="border-b border-slate-300 px-3 py-2">Resultado</th><th className="border-b border-slate-300 px-3 py-2">Referência</th><th className="border-b border-slate-300 px-3 py-2">Flag</th></tr>
            </thead>
            <tbody>
              {resultados.length ? resultados.map((resultado) => (
                <tr key={resultado.id}>
                  <td className="border-b border-slate-200 px-3 py-2"><strong>{resultado.analito}</strong>{resultado.metodo ? <div className="text-[10px] text-slate-400">{resultado.metodo}</div> : null}</td>
                  <td className={`border-b border-slate-200 px-3 py-2 font-semibold ${resultado.valor_critico ? "text-rose-700 print:text-black" : ""}`}>{resultado.resultado ?? resultado.valor_numerico ?? "—"} {resultado.unidade_medida ?? ""}</td>
                  <td className="border-b border-slate-200 px-3 py-2 text-xs">{referencia(resultado.referencia_texto, resultado.referencia_min, resultado.referencia_max)}</td>
                  <td className="border-b border-slate-200 px-3 py-2 font-bold">{resultado.flag ?? (resultado.valor_critico ? "CRÍTICO" : "NORMAL")}</td>
                </tr>
              )) : <tr><td colSpan={4} className="px-3 py-5 text-center text-slate-500">Sem resultados estruturados.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      {laudo.metodo ? <ReportSection title="Método" value={laudo.metodo} /> : null}
      <ReportSection title="Descrição / interpretação" value={laudo.corpo} />
      <ReportSection title="Conclusão" value={laudo.conclusao} emphasized />
      <ReportSection title="Observações" value={laudo.observacoes} />

      {laudo.motivo_retificacao ? (
        <section className="mt-7 border border-amber-300 bg-amber-50 p-3 text-sm print:bg-white">
          <p className="font-black uppercase text-amber-800 print:text-slate-900">Retificação</p>
          <p className="mt-1 whitespace-pre-wrap">{laudo.motivo_retificacao}</p>
        </section>
      ) : null}

      <footer className="mt-10 border-t border-slate-300 pt-5 text-sm">
        <p className="font-black">{profissional?.nome_completo ?? "Responsável técnico"}</p>
        <p className="text-slate-600">{[profissional?.conselho, profissional?.numero_conselho, profissional?.uf_conselho].filter(Boolean).join(" ") || profissional?.especialidade || "—"}</p>
        <p className="mt-2 text-xs text-slate-500">Documento eletrônico · versão {laudo.versao} · liberado em {fmt(laudo.liberado_em)}</p>
        <p className="mt-1 break-all font-mono text-[10px] text-slate-400">Assinatura SHA-256: {laudo.assinatura_hash ?? "não assinada"}</p>
      </footer>
    </main>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return <div><p className="text-[10px] font-black uppercase tracking-wider text-slate-400">{label}</p><p className="mt-0.5 font-semibold">{value}</p></div>;
}

function ReportSection({ title, value, emphasized = false }: { title: string; value?: string | null; emphasized?: boolean }) {
  if (!value) return null;
  return <section className="mt-7"><h2 className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">{title}</h2><p className={`mt-2 whitespace-pre-wrap leading-7 ${emphasized ? "font-semibold" : ""}`}>{value}</p></section>;
}

function referencia(texto: string | null, minimo: number | null, maximo: number | null) {
  if (texto) return texto;
  if (minimo !== null && maximo !== null) return `${minimo} – ${maximo}`;
  if (minimo !== null) return `≥ ${minimo}`;
  if (maximo !== null) return `≤ ${maximo}`;
  return "—";
}
