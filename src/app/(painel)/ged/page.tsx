import Link from "next/link";
import type { Route } from "next";
import { FileCheck2, FileLock2, FileUp, FolderArchive, Search } from "lucide-react";
import { GedUploadForm } from "@/components/ged/ged-upload-form";
import { SectionPage } from "@/components/painel/section-page";
import { getCurrentNavigationAccess } from "@/lib/permissions/server-navigation";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function GedPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; categoria?: string }>;
}) {
  const sp = await searchParams;
  const { supabase, grantedPermissions } = await getCurrentNavigationAccess();
  const q = (sp.q ?? "").trim();
  const status = (sp.status ?? "").trim();
  const categoria = (sp.categoria ?? "").trim();
  const canUpload = ["ged.enviar", "ged.gerenciar", "ged.administrar"].some((code) => grantedPermissions.includes(code));

  let query = supabase
    .from("ged_documentos")
    .select("id,categoria,subcategoria,titulo,nome_arquivo,mime_type,versao,status,confidencial,created_at,assinado_em,atendimento_id,paciente_id,solicitacao_exame_id,laboratorio_laudo_id,imagem_laudo_id")
    .order("created_at", { ascending: false })
    .limit(200);
  if (q) query = query.ilike("titulo", `%${q.replace(/[%_]/g, "")} %`.trim());
  if (status && status !== "todos") query = query.eq("status", status);
  if (categoria && categoria !== "todas") query = query.eq("categoria", categoria);

  const { data: docs, error } = await query;
  const rows = docs ?? [];
  const total = rows.length;
  const ativos = rows.filter((doc) => doc.status === "ativo").length;
  const assinados = rows.filter((doc) => Boolean(doc.assinado_em)).length;
  const confidenciais = rows.filter((doc) => doc.confidencial).length;
  const categorias = [...new Set(rows.map((doc) => doc.categoria).filter(Boolean))].sort();

  return (
    <SectionPage
      eyebrow="Governança / GED"
      title="Gestão Eletrônica de Documentos"
      description="Repositório transversal e versionado de documentos clínicos, administrativos, financeiros, contratuais e fiscais."
    >
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="his-kpi"><p className="text-xs font-bold uppercase tracking-wider text-slate-400">Exibidos</p><p className="mt-2 text-3xl font-black text-brand-950">{total}</p></div>
        <div className="his-kpi"><p className="text-xs font-bold uppercase tracking-wider text-slate-400">Ativos</p><p className="mt-2 text-3xl font-black text-emerald-700">{ativos}</p></div>
        <div className="his-kpi"><p className="text-xs font-bold uppercase tracking-wider text-slate-400">Assinados</p><p className="mt-2 text-3xl font-black text-blue-700">{assinados}</p></div>
        <div className="his-kpi"><p className="text-xs font-bold uppercase tracking-wider text-slate-400">Confidenciais</p><p className="mt-2 text-3xl font-black text-rose-700">{confidenciais}</p></div>
      </section>

      {canUpload ? (
        <details className="his-card mt-5 overflow-hidden">
          <summary className="flex cursor-pointer list-none items-center gap-4 p-5 sm:p-6">
            <span className="grid size-11 place-items-center rounded-2xl bg-brand-50 text-brand-700"><FileUp className="size-5" /></span>
            <div className="min-w-0 flex-1"><h2 className="font-black text-slate-950">Enviar documento</h2><p className="mt-1 text-sm text-slate-500">Upload direto para Storage privado, com hash SHA-256 e vínculo ao escopo atual.</p></div>
          </summary>
          <div className="border-t border-slate-100 bg-slate-50/40 p-4 sm:p-6"><GedUploadForm compact /></div>
        </details>
      ) : null}

      <section className="his-card mt-5 overflow-hidden">
        <div className="border-b border-slate-100 p-5 sm:p-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div className="flex items-start gap-3"><FolderArchive className="mt-0.5 size-5 text-brand-700" /><div><h2 className="font-black text-slate-900">Documentos do escopo atual</h2><p className="text-sm text-slate-500">A leitura respeita empresa, unidade e permissões do perfil ativo.</p></div></div>
            <form className="grid gap-2 sm:grid-cols-[minmax(220px,1fr)_150px_170px_auto]" method="get">
              <label className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" /><input name="q" defaultValue={q} placeholder="Buscar por título" className="ui-input h-10 w-full pl-9" /></label>
              <select name="status" defaultValue={status || "todos"} className="ui-input h-10"><option value="todos">Todos os status</option><option value="ativo">Ativos</option><option value="arquivado">Arquivados</option><option value="substituido">Substituídos</option><option value="cancelado">Cancelados</option></select>
              <select name="categoria" defaultValue={categoria || "todas"} className="ui-input h-10"><option value="todas">Todas as categorias</option>{categorias.map((item) => <option key={item} value={item}>{item}</option>)}</select>
              <button className="btn-secondary h-10">Filtrar</button>
            </form>
          </div>
        </div>

        {error ? <div className="border-b border-amber-200 bg-amber-50 px-5 py-3 text-sm text-amber-800">Não foi possível carregar todos os documentos do GED neste contexto.</div> : null}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">Documento</th><th className="px-4 py-3">Categoria</th><th className="px-4 py-3">Arquivo</th><th className="px-4 py-3">Versão</th><th className="px-4 py-3">Integridade</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Data</th><th className="px-4 py-3 text-right">Ação</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {rows.length ? rows.map((doc) => (
                <tr key={doc.id} className="hover:bg-slate-50/70">
                  <td className="px-4 py-3"><b className="text-slate-900">{doc.titulo}</b><div className="mt-1 flex flex-wrap gap-1.5">{doc.confidencial ? <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-700"><FileLock2 className="size-3" />Confidencial</span> : null}{doc.atendimento_id ? <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-bold text-brand-700">Atendimento</span> : null}{doc.laboratorio_laudo_id || doc.imagem_laudo_id ? <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-bold text-violet-700">Laudo</span> : null}</div></td>
                  <td className="px-4 py-3 text-slate-600">{doc.categoria}{doc.subcategoria ? ` / ${doc.subcategoria}` : ""}</td>
                  <td className="max-w-[260px] truncate px-4 py-3 text-slate-600">{doc.nome_arquivo}</td>
                  <td className="px-4 py-3 font-bold text-slate-700">v{doc.versao}</td>
                  <td className="px-4 py-3">{doc.assinado_em ? <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700"><FileCheck2 className="size-3.5" />Assinado</span> : <span className="text-xs text-slate-400">Hash registrado</span>}</td>
                  <td className="px-4 py-3"><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold capitalize text-slate-700">{doc.status}</span></td>
                  <td className="px-4 py-3 text-xs text-slate-500">{new Date(doc.created_at).toLocaleString("pt-BR")}</td>
                  <td className="px-4 py-3 text-right"><Link href={`/ged/${doc.id}` as Route} className="btn-secondary h-8 text-xs">Abrir</Link></td>
                </tr>
              )) : <tr><td colSpan={8} className="px-4 py-10 text-center text-slate-500">Nenhum documento encontrado com os filtros atuais.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </SectionPage>
  );
}
