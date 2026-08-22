import { SectionPage } from "@/components/painel/section-page";
import { createClient } from "@/lib/supabase/server";

const nomesTipo: Record<string, string> = { especialidade: "Especialidade", cbo: "CBO", cid10: "CID-10", tuss: "TUSS", tipo_atendimento: "Tipo de atendimento", motivo_classificacao: "Motivo / classificação" };

export default async function CatalogosPage({ searchParams }: { searchParams: Promise<{ sucesso?: string }> }) {
  const { sucesso } = await searchParams;
  const supabase = await createClient();
  const { data, error } = await supabase.from("catalogos").select("id,tipo,codigo,descricao,vigencia_inicio,vigencia_fim").eq("ativo", true).order("tipo").order("descricao").limit(200);
  return <SectionPage eyebrow="Cadastros / Catálogos" title="Catálogos assistenciais" description="Códigos e descrições centralizados para os módulos do HIS." primaryActionLabel="Novo item" primaryActionHref="/catalogos/novo">
    {sucesso === "cadastrado" ? <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">Item de catálogo cadastrado com sucesso.</div> : null}
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">{error ? <p className="p-6 text-sm text-red-700">Não foi possível consultar os catálogos. Confirme migration e permissões.</p> : data?.length ? <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-5 py-3">Tipo</th><th className="px-5 py-3">Código</th><th className="px-5 py-3">Descrição</th><th className="px-5 py-3">Vigência</th></tr></thead><tbody className="divide-y divide-slate-100">{data.map((item) => <tr key={item.id}><td className="px-5 py-4">{nomesTipo[item.tipo] ?? item.tipo}</td><td className="px-5 py-4 font-medium text-slate-900">{item.codigo}</td><td className="px-5 py-4">{item.descricao}</td><td className="px-5 py-4">{item.vigencia_inicio || item.vigencia_fim ? `${item.vigencia_inicio || "…"} — ${item.vigencia_fim || "…"}` : "Sem vigência definida"}</td></tr>)}</tbody></table></div> : <p className="p-8 text-center text-sm text-slate-500">Nenhum item de catálogo cadastrado.</p>}</section>
  </SectionPage>;
}
