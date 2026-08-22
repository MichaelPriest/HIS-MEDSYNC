import { SectionPage } from "@/components/painel/section-page";
import { createClient } from "@/lib/supabase/server";

export default async function ProfissionaisPage({ searchParams }: { searchParams: Promise<{ sucesso?: string }> }) {
  const { sucesso } = await searchParams;
  const supabase = await createClient();
  const { data, error } = await supabase.from("profissionais").select("id,nome_completo,conselho,numero_conselho,uf_conselho,especialidade,cbo,telefone").eq("ativo", true).order("nome_completo").limit(100);
  return <SectionPage eyebrow="Cadastros / Profissionais" title="Profissionais" description="Cadastro de profissionais assistenciais e administrativos." primaryActionLabel="Novo profissional" primaryActionHref="/profissionais/novo">
    {sucesso === "cadastrado" ? <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">Profissional cadastrado com sucesso.</div> : null}
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">{error ? <p className="p-6 text-sm text-red-700">Não foi possível consultar profissionais. Confirme migration e permissões.</p> : data?.length ? <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-5 py-3">Nome</th><th className="px-5 py-3">Conselho</th><th className="px-5 py-3">Especialidade</th><th className="px-5 py-3">CBO</th><th className="px-5 py-3">Telefone</th></tr></thead><tbody className="divide-y divide-slate-100">{data.map((item) => <tr key={item.id}><td className="px-5 py-4 font-medium text-slate-900">{item.nome_completo}</td><td className="px-5 py-4">{[item.conselho,item.numero_conselho,item.uf_conselho].filter(Boolean).join(" ") || "—"}</td><td className="px-5 py-4">{item.especialidade || "—"}</td><td className="px-5 py-4">{item.cbo || "—"}</td><td className="px-5 py-4">{item.telefone || "—"}</td></tr>)}</tbody></table></div> : <p className="p-8 text-center text-sm text-slate-500">Nenhum profissional cadastrado.</p>}</section>
  </SectionPage>;
}
