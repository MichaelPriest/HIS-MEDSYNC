import Link from "next/link";
import { AlertTriangle, Cable, Download, ShieldCheck } from "lucide-react";
import { notFound } from "next/navigation";
import {
  TissDenialModal,
  TissManualImportModal,
  TissManualSendModal,
  TissPreliminaryXmlForm,
  TissProtocolModal,
} from "@/components/faturamento/tiss-lot-background-forms";
import { SectionPage } from "@/components/painel/section-page";
import { createClient } from "@/lib/supabase/server";
import { enviarLoteWebservice } from "@/modules/tiss/webservices/actions";

function one<T>(rel: T | T[] | null): T | null {
  return Array.isArray(rel) ? rel[0] ?? null : rel;
}

function brl(value: number | string | null | undefined) {
  return `R$ ${Number(value ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function dateTime(value: string | null | undefined) {
  return value ? new Date(value).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "—";
}

export default async function LotePage({
  params,
  searchParams,
}: {
  params: Promise<{ loteId: string }>;
  searchParams: Promise<{ erro?: string; enviado?: string }>;
}) {
  const { loteId } = await params;
  const qs = await searchParams;
  const supabase = await createClient();

  const [
    { data: lote },
    { data: links },
    { data: protocolos },
    { data: glosas },
    { data: xmls },
    { data: transacoes },
    { data: operacoesManuais },
  ] = await Promise.all([
    supabase
      .from("tiss_lotes")
      .select("id,numero_lote,competencia,status,quantidade_guias,valor_total,xsd_validado,erros_validacao,protocolo_operadora,convenio_id,convenio:convenios(nome_fantasia,registro_ans),versao:tiss_versoes(organizacional,conteudo_estrutura,tuss,comunicacao_principal)")
      .eq("id", loteId)
      .maybeSingle(),
    supabase
      .from("tiss_lote_guias")
      .select("guia:tiss_guias(id,numero_guia_prestador,tipo_guia,status,valor_total,paciente:pacientes(nome_completo,ra,numero_registro))")
      .eq("lote_id", loteId),
    supabase
      .from("tiss_protocolos")
      .select("id,numero_protocolo,data_protocolo,status,valor_apresentado,valor_processado,valor_liberado,valor_glosa,created_at")
      .eq("lote_id", loteId)
      .order("created_at", { ascending: false }),
    supabase
      .from("tiss_glosas")
      .select("id,codigo_glosa,descricao_glosa,valor_glosado,status,guia:tiss_guias(numero_guia_prestador)")
      .eq("lote_id", loteId)
      .order("created_at", { ascending: false }),
    supabase
      .from("tiss_xmls")
      .select("id,tipo_mensagem,versao_comunicacao,xsd_validado,erros_validacao,created_at")
      .eq("lote_id", loteId)
      .order("created_at", { ascending: false }),
    supabase
      .from("tiss_webservice_transacoes")
      .select("id,tipo_operacao,ambiente,status,http_status,protocolo_local,protocolo_operadora,codigo_erro,mensagem_erro,created_at,finalizado_em")
      .eq("lote_id", loteId)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("tiss_operacoes_manuais")
      .select("id,direcao,tipo_documento,nome_arquivo,xsd_validado,protocolo_externo,observacoes,processado,created_at")
      .eq("lote_id", loteId)
      .order("created_at", { ascending: false })
      .limit(30),
  ]);

  if (!lote) notFound();

  const convenio = one(lote.convenio);
  const versao = one(lote.versao);
  const enviar = enviarLoteWebservice.bind(null, loteId);
  const xmlsValidados = (xmls ?? [])
    .filter((xml) => xml.xsd_validado)
    .map((xml) => ({
      id: xml.id,
      tipo_mensagem: String(xml.tipo_mensagem),
      versao_comunicacao: String(xml.versao_comunicacao ?? "—"),
    }));
  const guiasDoLote = (links ?? []).flatMap((link) => {
    const guia = one(link.guia);
    return guia ? [{ id: guia.id, numero_guia_prestador: String(guia.numero_guia_prestador ?? "—") }] : [];
  });
  const protocolosDoLote = (protocolos ?? []).map((protocolo) => ({
    id: protocolo.id,
    numero_protocolo: String(protocolo.numero_protocolo),
  }));
  const totalGlosado = (glosas ?? []).reduce((sum, item) => sum + Number(item.valor_glosado ?? 0), 0);

  return <SectionPage
    eyebrow="Ciclo da Receita / TISS / Lote"
    title={`Lote ${lote.numero_lote}`}
    description={`${convenio?.nome_fantasia ?? "Convênio"} · ANS ${convenio?.registro_ans ?? "—"} · Competência ${lote.competencia ?? "—"}`}
    actions={<Link href="/faturamento/lotes" className="ui-button-secondary">Voltar aos lotes</Link>}
  >
    {qs.erro ? <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">A operação de webservice não foi concluída: {qs.erro}.</div> : null}
    {qs.enviado ? <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">Lote transmitido ao webservice configurado. Confira protocolo e histórico da transmissão.</div> : null}

    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      <Info label="Status" value={String(lote.status).replaceAll("_", " ")} />
      <Info label="Guias" value={String(lote.quantidade_guias)} />
      <Info label="Valor apresentado" value={brl(lote.valor_total)} />
      <Info label="Glosas registradas" value={brl(totalGlosado)} alert={totalGlosado > 0} />
      <Info label="XSD" value={lote.xsd_validado ? "Validado" : "Não validado"} alert={!lote.xsd_validado} />
    </section>

    <section className="ui-card mt-6 p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[.14em] text-brand-600">Mensagem eletrônica</p>
          <h2 className="mt-1 font-black text-slate-900">Versões TISS aplicadas</h2>
          <p className="mt-1 text-sm text-slate-500">Conteúdo {versao?.conteudo_estrutura ?? "—"} · TUSS {versao?.tuss ?? "—"} · Comunicação {versao?.comunicacao_principal ?? "—"}</p>
        </div>
        <div className="flex flex-wrap items-start gap-3">
          <TissPreliminaryXmlForm loteId={loteId} />
          <form action={enviar}>
            <button disabled={!lote.xsd_validado} className="ui-button-primary disabled:cursor-not-allowed disabled:opacity-50"><Cable className="size-4" />Enviar via webservice</button>
          </form>
        </div>
      </div>
      {!lote.xsd_validado ? <div className="mt-4 flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800"><AlertTriangle className="size-5 shrink-0" /><p>Envio final permanece bloqueado até validação com o XSD oficial correspondente. O XML preliminar é somente artefato interno de conferência.</p></div> : <div className="mt-4 flex gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800"><ShieldCheck className="size-5 shrink-0" /><p>Lote validado contra XSD e elegível para webservice ou operação manual.</p></div>}
    </section>

    <section className="ui-card mt-6 p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[.14em] text-slate-400">Operação manual</p>
          <h2 className="mt-1 font-black text-slate-900">Portal, upload, e-mail ou outro canal externo</h2>
          <p className="mt-1 max-w-3xl text-sm text-slate-500">Importações entram como pendentes de validação. O registro de saída manual só aceita XML já validado.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <TissManualImportModal loteId={loteId} />
          <TissManualSendModal loteId={loteId} xmls={xmlsValidados} />
        </div>
      </div>
      <div className="mt-5 space-y-2">
        {xmlsValidados.length ? xmlsValidados.map((xml) => <div key={xml.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 p-3">
          <div><p className="font-semibold text-slate-800">{xml.tipo_mensagem}</p><p className="text-xs text-slate-500">Comunicação {xml.versao_comunicacao}</p></div>
          <Link href={`/api/tiss/xml/${xml.id}`} className="ui-button-secondary"><Download className="size-4" />Baixar XML</Link>
        </div>) : <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">Nenhum XML validado disponível para exportação.</p>}
      </div>
    </section>

    <section className="ui-card mt-6 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <div><h2 className="font-black text-slate-900">Guias do lote</h2><p className="mt-1 text-xs text-slate-500">Beneficiário, tipo e valor permanecem vinculados ao snapshot da guia faturada.</p></div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">{guiasDoLote.length} guia(s)</span>
      </div>
      <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">Guia</th><th className="px-4 py-3">Paciente</th><th className="px-4 py-3">Tipo</th><th className="px-4 py-3 text-right">Valor</th></tr></thead><tbody className="divide-y divide-slate-100">{(links ?? []).map((link) => { const guia = one(link.guia); const paciente = guia ? one(guia.paciente) : null; return guia ? <tr key={guia.id}><td className="px-4 py-3"><Link href={`/faturamento/guias/${guia.id}`} className="font-semibold text-brand-700 hover:underline">{guia.numero_guia_prestador}</Link></td><td className="px-4 py-3">{paciente?.nome_completo ?? "—"}<div className="text-xs text-slate-400">Registro #{paciente?.numero_registro ?? "—"} · {paciente?.ra ?? "—"}</div></td><td className="px-4 py-3 capitalize">{String(guia.tipo_guia).replaceAll("_", " ")}</td><td className="px-4 py-3 text-right font-semibold">{brl(guia.valor_total)}</td></tr> : null; })}</tbody></table></div>
    </section>

    <section className="ui-card mt-6 p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div><p className="text-[10px] font-black uppercase tracking-[.14em] text-slate-400">Retorno da operadora</p><h2 className="mt-1 font-black text-slate-900">Protocolo e recuperação de receita</h2><p className="mt-1 text-sm text-slate-500">Registre protocolo ou glosa em modal; o histórico consolidado permanece visível abaixo.</p></div>
        <div className="flex flex-wrap gap-2">
          <TissProtocolModal loteId={loteId} />
          <TissDenialModal loteId={loteId} protocolos={protocolosDoLote} guias={guiasDoLote} />
        </div>
      </div>
    </section>

    <div className="mt-6 grid gap-6 xl:grid-cols-2">
      <section className="ui-card p-5"><div className="flex items-center justify-between gap-3"><h2 className="font-black text-slate-900">Protocolos</h2><span className="text-xs font-semibold text-slate-500">{protocolos?.length ?? 0} registro(s)</span></div><div className="mt-4 space-y-3">{protocolos?.length ? protocolos.map((protocolo) => <div key={protocolo.id} className="rounded-xl border border-slate-200 p-3"><div className="flex justify-between gap-3"><strong>{protocolo.numero_protocolo}</strong><span className="text-xs capitalize text-slate-500">{String(protocolo.status).replaceAll("_", " ")}</span></div><div className="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-500"><span>Apresentado {brl(protocolo.valor_apresentado)}</span><span>Liberado {brl(protocolo.valor_liberado)}</span><span>Processado {brl(protocolo.valor_processado)}</span><span className={Number(protocolo.valor_glosa ?? 0) > 0 ? "font-semibold text-rose-600" : ""}>Glosa {brl(protocolo.valor_glosa)}</span></div></div>) : <p className="text-sm text-slate-500">Nenhum protocolo.</p>}</div></section>
      <section className="ui-card p-5"><div className="flex items-center justify-between gap-3"><h2 className="font-black text-slate-900">Glosas</h2><span className="text-xs font-semibold text-rose-600">{brl(totalGlosado)}</span></div><div className="mt-4 space-y-3">{glosas?.length ? glosas.map((glosa) => { const guia = one(glosa.guia); return <div key={glosa.id} className="rounded-xl border border-rose-200 bg-rose-50 p-3"><div className="flex justify-between gap-3"><strong>{glosa.codigo_glosa}</strong><span className="font-semibold text-rose-700">{brl(glosa.valor_glosado)}</span></div><p className="mt-1 text-sm text-slate-600">Guia {guia?.numero_guia_prestador ?? "—"} · {glosa.descricao_glosa ?? "Sem descrição"}</p><p className="mt-1 text-[11px] font-bold uppercase text-rose-500">{String(glosa.status).replaceAll("_", " ")}</p></div>; }) : <p className="text-sm text-slate-500">Nenhuma glosa.</p>}</div></section>
    </div>

    {operacoesManuais?.length ? <section className="ui-card mt-6 p-5"><h2 className="font-black text-slate-900">Histórico de operação manual</h2><div className="mt-4 space-y-2">{operacoesManuais.map((operacao) => <div key={operacao.id} className="rounded-xl border border-slate-200 p-3 text-sm"><div className="flex flex-wrap items-center justify-between gap-2"><strong>{operacao.direcao === "saida" ? "Saída" : "Entrada"} · {operacao.tipo_documento}</strong><span className="text-xs text-slate-500">{dateTime(operacao.created_at)}</span></div><p className="mt-1 text-xs text-slate-500">{operacao.nome_arquivo} · protocolo {operacao.protocolo_externo ?? "—"} · {operacao.xsd_validado ? "XSD validado" : "validação pendente"}</p>{operacao.observacoes ? <p className="mt-1 text-xs text-slate-600">{operacao.observacoes}</p> : null}</div>)}</div></section> : null}

    {transacoes?.length ? <section className="ui-card mt-6 p-5"><h2 className="font-black text-slate-900">Histórico de webservice</h2><div className="mt-4 space-y-2">{transacoes.map((transacao) => <div key={transacao.id} className="rounded-xl border border-slate-200 p-3 text-sm"><div className="flex flex-wrap items-center justify-between gap-2"><strong>{transacao.tipo_operacao} · {transacao.ambiente}</strong><span className={`rounded-full px-2 py-1 text-xs font-semibold ${transacao.status === "enviado" || transacao.status === "aceito" ? "bg-emerald-50 text-emerald-700" : transacao.status === "erro" || transacao.status === "timeout" ? "bg-rose-50 text-rose-700" : "bg-slate-100 text-slate-600"}`}>{transacao.status}</span></div><p className="mt-1 text-xs text-slate-500">Local {transacao.protocolo_local} · Operadora {transacao.protocolo_operadora ?? "—"} · HTTP {transacao.http_status ?? "—"}</p>{transacao.mensagem_erro ? <p className="mt-1 text-xs text-rose-600">{transacao.codigo_erro}: {transacao.mensagem_erro}</p> : null}</div>)}</div></section> : null}

    {xmls?.length ? <section className="ui-card mt-6 p-5"><h2 className="font-black text-slate-900">Artefatos XML</h2><div className="mt-3 space-y-2">{xmls.map((xml) => <div key={xml.id} className="rounded-xl bg-slate-50 p-3 text-sm"><b>{xml.tipo_mensagem}</b> · comunicação {xml.versao_comunicacao} · {xml.xsd_validado ? "XSD validado" : "não validado"}</div>)}</div></section> : null}
  </SectionPage>;
}

function Info({ label, value, alert = false }: { label: string; value: string; alert?: boolean }) {
  return <div className={`ui-card p-4 ${alert ? "border-amber-200 bg-amber-50" : ""}`}><p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p><p className={`mt-2 font-semibold capitalize ${alert ? "text-amber-800" : "text-slate-900"}`}>{value}</p></div>;
}
