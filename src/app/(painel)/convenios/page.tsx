import { Building2 } from "lucide-react";
import { SectionPage } from "@/components/painel/section-page";
import { createClient } from "@/lib/supabase/server";
import { criarUrlFotoAssinada } from "@/modules/cadastros/fotos";

export default async function ConveniosPage({ searchParams }: { searchParams: Promise<{ sucesso?: string }> }) {
  const { sucesso } = await searchParams;
  const supabase = await createClient();
  const { data, error } = await supabase.from("convenios").select("id,registro_ans,razao_social,nome_fantasia,cnpj,telefone,logo_path").eq("ativo", true).order("nome_fantasia").limit(100);
  const convenios = await Promise.all((data ?? []).map(async (item) => ({ ...item, logo_url: await criarUrlFotoAssinada(supabase, item.logo_path) })));

  return <SectionPage eyebrow="Cadastros / Convênios" title="Convênios" description="Operadoras cadastradas para autorizações, TISS e faturamento." primaryActionLabel="Novo convênio" primaryActionHref="/convenios/novo">
    {sucesso === "cadastrado" ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">Convênio cadastrado com sucesso.</div> : null}
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm shadow-slate-900/[0.03]">
      <div className="flex flex-col gap-3 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-brand-50 text-brand-700"><Building2 className="size-5" /></span><div><h2 className="font-semibold text-slate-900">Convênios ativos</h2><p className="text-sm text-slate-500">Operadoras disponíveis no ambiente.</p></div></div><span className="w-fit rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{convenios.length} exibidos</span></div>
      {error ? <p className="p-6 text-sm text-red-700">Não foi possível consultar convênios. Confirme migration e permissões.</p> : convenios.length ? <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-slate-50/80 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-3">Convênio</th><th className="px-5 py-3">Registro ANS</th><th className="px-5 py-3">Razão social</th><th className="px-5 py-3">CNPJ</th><th className="px-5 py-3">Telefone</th></tr></thead><tbody className="divide-y divide-slate-100">{convenios.map((item) => <tr key={item.id} className="transition hover:bg-slate-50/70"><td className="px-5 py-4"><div className="flex items-center gap-3"><span className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-xl bg-brand-50 text-brand-700" style={item.logo_url ? { backgroundImage: `url(${item.logo_url})`, backgroundPosition: "center", backgroundSize: "contain", backgroundRepeat: "no-repeat" } : undefined}>{item.logo_url ? null : <Building2 className="size-4" />}</span><span className="font-medium text-slate-900">{item.nome_fantasia}</span></div></td><td className="px-5 py-4"><span className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700">{item.registro_ans || "Sem ANS"}</span></td><td className="px-5 py-4 text-slate-600">{item.razao_social}</td><td className="px-5 py-4 text-slate-600">{item.cnpj || "—"}</td><td className="px-5 py-4 text-slate-600">{item.telefone || "—"}</td></tr>)}</tbody></table></div> : <div className="p-10 text-center"><span className="mx-auto grid size-12 place-items-center rounded-2xl bg-slate-100 text-slate-400"><Building2 className="size-5" /></span><p className="mt-3 text-sm text-slate-500">Nenhum convênio cadastrado.</p></div>}
    </section>
  </SectionPage>;
}
