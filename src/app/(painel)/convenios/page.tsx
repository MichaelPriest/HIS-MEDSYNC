import { SectionPage } from "@/components/painel/section-page";
import { createClient } from "@/lib/supabase/server";

export default async function ConveniosPage({ searchParams }: { searchParams: Promise<{ sucesso?: string }> }) {
  const { sucesso } = await searchParams;
  const supabase = await createClient();
  const { data, error } = await supabase.from("convenios").select("id,registro_ans,razao_social,nome_fantasia,cnpj,telefone").eq("ativo", true).order("nome_fantasia").limit(100);
  return <SectionPage eyebrow="Cadastros / Convênios" title="Convênios" description="Operadoras cadastradas para autorizações, TISS e faturamento." primaryActionLabel="Novo convênio" primaryActionHref="/convenios/novo">
    {sucesso === "cadastrado" ? <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">Convênio cadastrado com sucesso.</div> : null}
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">{error ? <p className="p-6 text-sm text-red-700">Não foi possível consultar convênios. Confirme migration e permissões.</p> : data?.length ? <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-5 py-3">Convênio</th><th className="px-5 py-3">Registro ANS</th><th className="px-5 py-3">Razão social</th><th className="px-5 py-3">CNPJ</th><th className="px-5 py-3">Telefone</th></tr></thead><tbody className="divide-y divide-slate-100">{data.map((item) => <tr key={item.id}><td className="px-5 py-4 font-medium text-slate-900">{item.nome_fantasia}</td><td className="px-5 py-4">{item.registro_ans || "—"}</td><td className="px-5 py-4">{item.razao_social}</td><td className="px-5 py-4">{item.cnpj || "—"}</td><td className="px-5 py-4">{item.telefone || "—"}</td></tr>)}</tbody></table></div> : <p className="p-8 text-center text-sm text-slate-500">Nenhum convênio cadastrado.</p>}</section>
  </SectionPage>;
}
