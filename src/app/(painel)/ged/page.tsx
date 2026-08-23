import { FolderArchive } from "lucide-react";
import { SectionPage } from "@/components/painel/section-page";
import { createClient } from "@/lib/supabase/server";

export default async function GedPage(){
  const supabase=await createClient();
  const {data:docs}=await supabase.from("ged_documentos").select("id,categoria,subcategoria,titulo,nome_arquivo,mime_type,versao,status,confidencial,created_at").order("created_at",{ascending:false}).limit(150);
  return <SectionPage eyebrow="Corporativo / GED" title="Gestão Eletrônica de Documentos" description="Repositório transversal de documentos clínicos, administrativos, financeiros, contratuais e fiscais.">
    <section className="ui-card overflow-hidden"><div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4"><FolderArchive className="size-5 text-brand-700"/><div><h2 className="font-semibold text-slate-900">Documentos recentes</h2><p className="text-sm text-slate-500">Documentos vinculáveis a paciente, atendimento, conta, convênio, profissional e lote TISS.</p></div></div><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">Título</th><th className="px-4 py-3">Categoria</th><th className="px-4 py-3">Arquivo</th><th className="px-4 py-3">Versão</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Data</th></tr></thead><tbody className="divide-y divide-slate-100">{docs?.length?docs.map(d=><tr key={d.id}><td className="px-4 py-3"><b>{d.titulo}</b>{d.confidencial?<div className="text-xs text-rose-500">Confidencial</div>:null}</td><td className="px-4 py-3">{d.categoria}{d.subcategoria?` / ${d.subcategoria}`:""}</td><td className="px-4 py-3">{d.nome_arquivo}</td><td className="px-4 py-3">v{d.versao}</td><td className="px-4 py-3 capitalize">{d.status}</td><td className="px-4 py-3">{new Date(d.created_at).toLocaleString("pt-BR")}</td></tr>):<tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500">Nenhum documento no GED.</td></tr>}</tbody></table></div></section>
  </SectionPage>;
}
