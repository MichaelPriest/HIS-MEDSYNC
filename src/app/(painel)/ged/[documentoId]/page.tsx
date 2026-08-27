import Link from "next/link";
import type { Route } from "next";
import { notFound } from "next/navigation";
import { Archive, Download, ExternalLink, FileCheck2, FileClock, FileLock2, FileUp, ShieldCheck } from "lucide-react";
import { GedUploadForm } from "@/components/ged/ged-upload-form";
import { SectionPage } from "@/components/painel/section-page";
import { getCurrentNavigationAccess } from "@/lib/permissions/server-navigation";
import { assinarDocumentoGed, atualizarStatusDocumentoGed } from "@/modules/ged/actions";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function bytesLabel(value: number | null) {
  if (!value) return "—";
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

export default async function GedDocumentoPage({
  params,
  searchParams,
}: {
  params: Promise<{ documentoId: string }>;
  searchParams: Promise<{ erro?: string; sucesso?: string }>;
}) {
  const { documentoId } = await params;
  const sp = await searchParams;
  const { supabase, grantedPermissions } = await getCurrentNavigationAccess();
  const canManage = ["ged.gerenciar", "ged.administrar"].some((code) => grantedPermissions.includes(code));

  const { data: doc, error } = await supabase
    .from("ged_documentos")
    .select("id,empresa_id,unidade_id,atendimento_id,paciente_id,profissional_id,convenio_id,lote_tiss_id,conta_faturamento_id,solicitacao_exame_id,laboratorio_laudo_id,imagem_laudo_id,categoria,subcategoria,titulo,nome_arquivo,storage_bucket,storage_path,mime_type,tamanho_bytes,hash_sha256,versao,status,confidencial,observacoes,substitui_documento_id,assinado_em,assinado_por,assinatura_hash,assinatura_observacao,created_at,created_by")
    .eq("id", documentoId)
    .maybeSingle();

  if (error || !doc) notFound();

  const { data: nextVersion } = await supabase
    .from("ged_documentos")
    .select("id,versao,status,created_at")
    .eq("substitui_documento_id", doc.id)
    .order("versao", { ascending: false })
    .limit(1)
    .maybeSingle();

  const arquivoHref = `/ged/${doc.id}/arquivo` as Route;
  const downloadHref = `/ged/${doc.id}/arquivo?download=1` as Route;
  const isPdf = doc.mime_type === "application/pdf";

  return (
    <SectionPage
      eyebrow="GED / Documento"
      title={doc.titulo}
      description={`Versão ${doc.versao} · ${doc.categoria}${doc.subcategoria ? ` / ${doc.subcategoria}` : ""}`}
    >
      {sp.erro ? <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">Não foi possível concluir a ação: {decodeURIComponent(sp.erro)}</div> : null}
      {sp.sucesso ? <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">Ação concluída com sucesso no GED.</div> : null}

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(320px,.8fr)]">
        <article className="his-card overflow-hidden">
          <div className="border-b border-slate-100 p-5 sm:p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold capitalize text-slate-700">{doc.status}</span>
                  {doc.confidencial ? <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-1 text-xs font-bold text-rose-700"><FileLock2 className="size-3.5" />Confidencial</span> : null}
                  {doc.assinado_em ? <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700"><FileCheck2 className="size-3.5" />Assinado</span> : null}
                </div>
                <p className="mt-3 text-sm font-semibold text-slate-900">{doc.nome_arquivo}</p>
                <p className="mt-1 text-xs text-slate-500">{doc.mime_type ?? "Tipo não informado"} · {bytesLabel(doc.tamanho_bytes)}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link href={arquivoHref} target="_blank" className="btn-secondary"><ExternalLink className="size-4" /> Abrir arquivo</Link>
                <Link href={downloadHref} className="ui-button-primary"><Download className="size-4" /> Baixar</Link>
              </div>
            </div>
          </div>

          {isPdf ? <iframe title={`Visualização de ${doc.titulo}`} src={arquivoHref} className="h-[68vh] min-h-[560px] w-full bg-slate-100" /> : <div className="grid min-h-[360px] place-items-center bg-slate-50 p-8 text-center"><div><ExternalLink className="mx-auto size-8 text-slate-400" /><p className="mt-3 font-semibold text-slate-700">Visualização externa protegida</p><p className="mt-1 text-sm text-slate-500">Use “Abrir arquivo” para visualizar este formato por URL temporária assinada.</p></div></div>}
        </article>

        <aside className="space-y-4">
          <section className="his-card p-5">
            <h2 className="font-black text-slate-950">Integridade e auditoria</h2>
            <dl className="mt-4 space-y-3 text-sm">
              <div><dt className="text-xs font-bold uppercase tracking-wider text-slate-400">SHA-256</dt><dd className="mt-1 break-all font-mono text-[11px] text-slate-600">{doc.hash_sha256 ?? "Não registrado"}</dd></div>
              <div><dt className="text-xs font-bold uppercase tracking-wider text-slate-400">Criado em</dt><dd className="mt-1 text-slate-700">{new Date(doc.created_at).toLocaleString("pt-BR")}</dd></div>
              <div><dt className="text-xs font-bold uppercase tracking-wider text-slate-400">Assinatura</dt><dd className="mt-1 text-slate-700">{doc.assinado_em ? new Date(doc.assinado_em).toLocaleString("pt-BR") : "Pendente"}</dd></div>
              {doc.assinatura_observacao ? <div><dt className="text-xs font-bold uppercase tracking-wider text-slate-400">Observação da assinatura</dt><dd className="mt-1 text-slate-700">{doc.assinatura_observacao}</dd></div> : null}
            </dl>
          </section>

          <section className="his-card p-5">
            <h2 className="font-black text-slate-950">Vínculos</h2>
            <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
              {doc.atendimento_id ? <Link href={`/prontuario/${doc.atendimento_id}` as Route} className="rounded-full bg-brand-50 px-3 py-1.5 text-brand-700">Prontuário / atendimento</Link> : null}
              {doc.laboratorio_laudo_id ? <Link href={`/assistencial/laboratorio/laudos/${doc.laboratorio_laudo_id}` as Route} className="rounded-full bg-violet-50 px-3 py-1.5 text-violet-700">Laudo laboratorial</Link> : null}
              {doc.imagem_laudo_id ? <Link href={`/assistencial/imagem/laudos/${doc.imagem_laudo_id}` as Route} className="rounded-full bg-violet-50 px-3 py-1.5 text-violet-700">Laudo de imagem</Link> : null}
              {doc.solicitacao_exame_id ? <span className="rounded-full bg-slate-100 px-3 py-1.5 text-slate-600">Solicitação de exame vinculada</span> : null}
              {doc.paciente_id ? <Link href={`/pacientes/${doc.paciente_id}` as Route} className="rounded-full bg-slate-100 px-3 py-1.5 text-slate-700">Paciente</Link> : null}
              {!doc.atendimento_id && !doc.laboratorio_laudo_id && !doc.imagem_laudo_id && !doc.solicitacao_exame_id && !doc.paciente_id ? <span className="text-slate-400">Documento corporativo ou sem vínculo clínico.</span> : null}
            </div>
          </section>

          <section className="his-card p-5">
            <div className="flex items-center gap-2"><FileClock className="size-4 text-brand-700" /><h2 className="font-black text-slate-950">Versionamento</h2></div>
            <div className="mt-3 space-y-2 text-sm">
              {doc.substitui_documento_id ? <Link href={`/ged/${doc.substitui_documento_id}` as Route} className="block rounded-xl border border-slate-200 px-3 py-2 text-slate-700 hover:bg-slate-50">← Abrir versão anterior</Link> : <p className="text-slate-400">Esta é a primeira versão registrada.</p>}
              {nextVersion ? <Link href={`/ged/${nextVersion.id}` as Route} className="block rounded-xl border border-brand-100 bg-brand-50/40 px-3 py-2 font-semibold text-brand-700">Abrir versão {nextVersion.versao} →</Link> : null}
            </div>
          </section>

          {canManage ? (
            <section className="his-card p-5">
              <div className="flex items-center gap-2"><ShieldCheck className="size-4 text-brand-700" /><h2 className="font-black text-slate-950">Governança</h2></div>
              {!doc.assinado_em && doc.status === "ativo" && doc.hash_sha256 ? (
                <form action={assinarDocumentoGed} className="mt-4 space-y-2">
                  <input type="hidden" name="documento_id" value={doc.id} />
                  <textarea name="observacao" rows={2} className="ui-input w-full" placeholder="Observação opcional da assinatura" />
                  <button className="ui-button-primary w-full"><FileCheck2 className="size-4" /> Validar integridade e assinar</button>
                </form>
              ) : null}

              {doc.status !== "substituido" ? (
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <form action={atualizarStatusDocumentoGed}><input type="hidden" name="documento_id" value={doc.id} /><input type="hidden" name="status" value={doc.status === "arquivado" ? "ativo" : "arquivado"} /><button className="btn-secondary w-full"><Archive className="size-4" />{doc.status === "arquivado" ? "Reativar" : "Arquivar"}</button></form>
                  {doc.status !== "cancelado" ? <form action={atualizarStatusDocumentoGed}><input type="hidden" name="documento_id" value={doc.id} /><input type="hidden" name="status" value="cancelado" /><button className="btn-secondary w-full text-rose-700">Cancelar</button></form> : null}
                </div>
              ) : null}
            </section>
          ) : null}
        </aside>
      </section>

      {canManage && doc.status === "ativo" ? (
        <details className="his-card mt-5 overflow-hidden">
          <summary className="flex cursor-pointer list-none items-center gap-4 p-5 sm:p-6"><span className="grid size-11 place-items-center rounded-2xl bg-brand-50 text-brand-700"><FileUp className="size-5" /></span><div className="min-w-0 flex-1"><h2 className="font-black text-slate-950">Criar nova versão</h2><p className="mt-1 text-sm text-slate-500">O arquivo atual será marcado como substituído e permanecerá preservado para auditoria.</p></div></summary>
          <div className="border-t border-slate-100 bg-slate-50/40 p-4 sm:p-6"><GedUploadForm compact documentoBaseId={doc.id} defaultTitulo={doc.titulo} defaultCategoria={doc.categoria} defaultSubcategoria={doc.subcategoria ?? ""} defaultConfidencial={doc.confidencial} /></div>
        </details>
      ) : null}
    </SectionPage>
  );
}
