import { Stethoscope } from "lucide-react";
import { SectionPage } from "@/components/painel/section-page";
import { createClient } from "@/lib/supabase/server";
import { criarUrlFotoAssinada } from "@/modules/cadastros/fotos";

export default async function ProfissionaisPage({ searchParams }: { searchParams: Promise<{ sucesso?: string }> }) {
  const { sucesso } = await searchParams;
  const supabase = await createClient();
  const { data, error } = await supabase.from("profissionais").select("id,nome_completo,conselho,numero_conselho,uf_conselho,especialidade,cbo,telefone,foto_path").eq("ativo", true).order("nome_completo").limit(100);
  const profissionaisComFoto = await Promise.all((data ?? []).map(async (item) => ({ ...item, foto_url: await criarUrlFotoAssinada(supabase, item.foto_path) })));

  return <SectionPage eyebrow="Cadastros / Profissionais" title="Profissionais" description="Cadastro de profissionais assistenciais e administrativos." primaryActionLabel="Novo profissional" primaryActionHref="/profissionais/novo">
    {sucesso === "cadastrado" ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">Profissional cadastrado com sucesso.</div> : null}
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm shadow-slate-900/[0.03]">
      <div className="flex flex-col gap-3 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-brand-50 text-brand-700"><Stethoscope className="size-5" /></span><div><h2 className="font-semibold text-slate-900">Profissionais ativos</h2><p className="text-sm text-slate-500">Equipe cadastrada no escopo autorizado.</p></div></div>
        <span className="w-fit rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{profissionaisComFoto.length} exibidos</span>
      </div>
      {error ? <p className="p-6 text-sm text-red-700">Não foi possível consultar profissionais. Confirme migration e permissões.</p> : profissionaisComFoto.length ? <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-slate-50/80 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-3">Nome</th><th className="px-5 py-3">Conselho</th><th className="px-5 py-3">Especialidade</th><th className="px-5 py-3">CBO</th><th className="px-5 py-3">Telefone</th></tr></thead><tbody className="divide-y divide-slate-100">{profissionaisComFoto.map((item) => <tr key={item.id} className="transition hover:bg-slate-50/70"><td className="px-5 py-4"><div className="flex items-center gap-3"><span className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-xl bg-brand-50 text-sm font-semibold text-brand-700" style={item.foto_url ? { backgroundImage: `url(${item.foto_url})`, backgroundPosition: "center", backgroundSize: "cover" } : undefined}>{item.foto_url ? null : item.nome_completo.slice(0, 1).toUpperCase()}</span><span className="font-medium text-slate-900">{item.nome_completo}</span></div></td><td className="px-5 py-4 text-slate-600">{[item.conselho,item.numero_conselho,item.uf_conselho].filter(Boolean).join(" ") || "—"}</td><td className="px-5 py-4 text-slate-600">{item.especialidade || "—"}</td><td className="px-5 py-4 text-slate-600">{item.cbo || "—"}</td><td className="px-5 py-4 text-slate-600">{item.telefone || "—"}</td></tr>)}</tbody></table></div> : <div className="p-10 text-center"><span className="mx-auto grid size-12 place-items-center rounded-2xl bg-slate-100 text-slate-400"><Stethoscope className="size-5" /></span><p className="mt-3 text-sm text-slate-500">Nenhum profissional cadastrado.</p></div>}
    </section>
  </SectionPage>;
}
