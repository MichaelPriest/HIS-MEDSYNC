import Link from "next/link";
import type { Route } from "next";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { notFound } from "next/navigation";
import { PrintDocumentButton } from "@/components/prontuario/print-document-button";
import { requireAnyPermission } from "@/lib/permissions/server";

type Snapshot = Record<string, string | null | undefined>;
type ItemDocumento = { ordem?: number; texto?: string };

function snapshot(value: unknown): Snapshot {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Snapshot : {};
}
function itens(value: unknown): ItemDocumento[] {
  return Array.isArray(value) ? value.filter((item) => item && typeof item === "object") as ItemDocumento[] : [];
}
function fmtData(value?: string | null) { return value ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "long", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(value)) : "—"; }

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function DocumentoMedicoPage({ params }: { params: Promise<{ atendimentoId: string; documentoId: string }> }) {
  const { atendimentoId, documentoId } = await params;
  const { supabase, empresaId, unidadeId } = await requireAnyPermission(["prontuario.visualizar", "prescricao.visualizar"]);
  if (!unidadeId) return null;

  const { data: documento } = await supabase.from("documentos_clinicos_medicos")
    .select("id,tipo_documento,titulo,itens,orientacoes,observacoes,numero_notificacao,status,emitido_em,assinado_em,assinatura_hash,paciente_snapshot,profissional_snapshot,estabelecimento_snapshot")
    .eq("id", documentoId).eq("atendimento_id", atendimentoId).eq("empresa_id", empresaId).eq("unidade_id", unidadeId).maybeSingle();
  if (!documento) notFound();

  const paciente = snapshot(documento.paciente_snapshot);
  const profissional = snapshot(documento.profissional_snapshot);
  const estabelecimento = snapshot(documento.estabelecimento_snapshot);
  const linhas = itens(documento.itens);
  const controlado = ["controle_especial", "b1_azul"].includes(documento.tipo_documento);

  return <main className="mx-auto max-w-4xl pb-12 print:max-w-none print:pb-0">
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 print:hidden">
      <Link href={`/prontuario/${atendimentoId}/documentos` as Route} className="ui-button-secondary"><ArrowLeft className="size-4"/>Voltar aos documentos</Link>
      <PrintDocumentButton />
    </div>

    <article className="rounded-2xl border border-slate-200 bg-white p-7 shadow-sm print:rounded-none print:border-0 print:p-0 print:shadow-none">
      <header className="border-b border-slate-300 pb-5 text-center">
        <p className="text-sm font-black uppercase tracking-wider text-slate-500">{estabelecimento.nome_fantasia || estabelecimento.razao_social || "Estabelecimento de saúde"}</p>
        <h1 className="mt-2 text-2xl font-black text-slate-950">{documento.titulo}</h1>
        <p className="mt-2 text-xs text-slate-500">{estabelecimento.unidade || ""}{estabelecimento.cnes ? ` · CNES ${estabelecimento.cnes}` : ""}{estabelecimento.cnpj ? ` · CNPJ ${estabelecimento.cnpj}` : ""}</p>
        {estabelecimento.endereco ? <p className="mt-1 text-xs text-slate-500">{estabelecimento.endereco}</p> : null}
      </header>

      <section className="mt-5 grid gap-3 border-b border-slate-200 pb-5 text-sm sm:grid-cols-2">
        <div><p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Paciente</p><p className="mt-1 font-bold text-slate-950">{paciente.nome_social || paciente.nome_completo || "Paciente"}</p><p className="mt-1 text-slate-600">CPF {paciente.cpf || "—"} · CNS {paciente.cns || "—"}</p>{paciente.data_nascimento ? <p className="mt-1 text-slate-600">Nascimento {paciente.data_nascimento}</p> : null}</div>
        <div><p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Emissão</p><p className="mt-1 font-bold text-slate-950">{fmtData(documento.emitido_em)}</p><p className="mt-1 text-slate-600">Status: {documento.status === "assinado" ? "Assinado" : "Rascunho"}</p>{documento.numero_notificacao ? <p className="mt-1 font-semibold text-slate-800">Notificação: {documento.numero_notificacao}</p> : null}</div>
      </section>

      {documento.tipo_documento === "orientacao_nao_medicamentosa" ? <section className="my-7 whitespace-pre-wrap text-[15px] leading-7 text-slate-800"><h2 className="mb-3 text-sm font-black uppercase tracking-wider text-slate-500">Orientações</h2>{documento.orientacoes}</section> : <section className="my-7"><h2 className="mb-4 text-sm font-black uppercase tracking-wider text-slate-500">Prescrição</h2><ol className="space-y-5">{linhas.map((item, index) => <li key={`${item.ordem ?? index}-${item.texto ?? ""}`} className="flex gap-3 text-[15px] leading-7 text-slate-900"><span className="font-black">{item.ordem ?? index + 1}.</span><span className="whitespace-pre-wrap">{item.texto || "—"}</span></li>)}</ol></section>}

      {documento.observacoes ? <section className="my-6 rounded-xl border border-slate-200 bg-slate-50 p-4 print:bg-white"><h2 className="text-xs font-black uppercase tracking-wider text-slate-500">Observações</h2><p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{documento.observacoes}</p></section> : null}

      {controlado ? <section className="my-6 rounded-xl border border-amber-300 bg-amber-50 p-4 text-xs leading-5 text-amber-900 print:bg-white"><b>Registro de documento sujeito a controle especial.</b> A emissão no HIS registra conteúdo, profissional, paciente, assinatura e identificador informado. Requisitos regulatórios externos, numeração oficial e modelo físico/digital aplicável continuam sujeitos às regras vigentes.</section> : null}

      <footer className="mt-12 border-t border-slate-300 pt-6">
        <div className="text-center"><p className="font-black text-slate-950">{profissional.nome_completo || "Profissional"}</p><p className="mt-1 text-sm text-slate-600">{[profissional.conselho, profissional.numero_conselho, profissional.uf_conselho].filter(Boolean).join(" ")} {profissional.especialidade ? `· ${profissional.especialidade}` : ""}</p></div>
        {documento.status === "assinado" ? <div className="mt-5 flex items-center justify-center gap-2 text-xs font-semibold text-emerald-700"><ShieldCheck className="size-4"/>Documento assinado em {fmtData(documento.assinado_em)}{documento.assinatura_hash ? ` · hash ${documento.assinatura_hash.slice(0, 12)}…` : ""}</div> : <div className="mt-5 text-center text-xs font-bold text-amber-700">RASCUNHO — documento ainda não assinado.</div>}
        {estabelecimento.rodape ? <p className="mt-5 text-center text-[10px] text-slate-400">{estabelecimento.rodape}</p> : null}
      </footer>
    </article>
  </main>;
}