import Link from "next/link";
import { BookOpenCheck, DatabaseZap, Plus } from "lucide-react";
import { SectionPage } from "@/components/painel/section-page";
import { createClient } from "@/lib/supabase/server";

const nomesTipo: Record<string, string> = { tipo_profissional: "Tipo de profissional", especialidade: "Especialidade", cbo: "CBO", cid10: "CID-10", tuss: "TUSS", tipo_atendimento: "Tipo de atendimento", motivo_classificacao: "Motivo / classificação" };

export default async function CatalogosPage({ searchParams }: { searchParams: Promise<{ sucesso?: string }> }) {
  const { sucesso } = await searchParams;
  const supabase = await createClient();
  const { data, error } = await supabase.from("catalogos").select("id,tipo,codigo,descricao,vigencia_inicio,vigencia_fim").eq("ativo", true).order("tipo").order("descricao").limit(200);

  return <SectionPage eyebrow="Cadastros / Catálogos" title="Catálogos assistenciais" description="Códigos e descrições centralizados para os módulos do HIS." actions={<div className="flex flex-wrap gap-2"><Link href="/catalogos/ans" className="ui-button-primary"><DatabaseZap className="size-4"/>Consultar TUSS / ANS</Link><Link href="/catalogos/novo" className="ui-button-secondary"><Plus className="size-4"/>Novo item</Link></div>}>
    {sucesso === "cadastrado" ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">Item de catálogo cadastrado com sucesso.</div> : null}
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm shadow-slate-900/[0.03]">
      <div className="flex flex-col gap-3 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-brand-50 text-brand-700"><BookOpenCheck className="size-5" /></span><div><h2 className="font-semibold text-slate-900">Itens ativos</h2><p className="text-sm text-slate-500">Domínios e referências centralizados do HIS.</p></div></div><span className="w-fit rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{data?.length ?? 0} exibidos</span></div>
      {error ? <p className="p-6 text-sm text-red-700">Não foi possível consultar os catálogos. Confirme migration e permissões.</p> : data?.length ? <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-slate-50/80 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-3">Tipo</th><th className="px-5 py-3">Código</th><th className="px-5 py-3">Descrição</th><th className="px-5 py-3">Vigência</th></tr></thead><tbody className="divide-y divide-slate-100">{data.map((item) => <tr key={item.id} className="transition hover:bg-slate-50/70"><td className="px-5 py-4"><span className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700">{nomesTipo[item.tipo] ?? item.tipo}</span></td><td className="px-5 py-4 font-medium text-slate-900">{item.codigo}</td><td className="px-5 py-4 text-slate-600">{item.descricao}</td><td className="px-5 py-4 text-slate-600">{item.vigencia_inicio || item.vigencia_fim ? `${item.vigencia_inicio || "…"} — ${item.vigencia_fim || "…"}` : "Sem vigência definida"}</td></tr>)}</tbody></table></div> : <div className="p-10 text-center"><span className="mx-auto grid size-12 place-items-center rounded-2xl bg-slate-100 text-slate-400"><BookOpenCheck className="size-5" /></span><p className="mt-3 text-sm text-slate-500">Nenhum item de catálogo cadastrado.</p></div>}
    </section>
  </SectionPage>;
}