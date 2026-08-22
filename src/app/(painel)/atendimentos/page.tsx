import { ClipboardList } from "lucide-react";
import { SectionPage } from "@/components/painel/section-page";
import { createClient } from "@/lib/supabase/server";

function relNome(rel: { nome_completo?: string } | { nome_completo?: string }[] | null) { return Array.isArray(rel) ? rel[0]?.nome_completo : rel?.nome_completo; }

export default async function AtendimentosPage({ searchParams }: { searchParams: Promise<{ sucesso?: string }> }) {
  const { sucesso } = await searchParams;
  const supabase = await createClient();
  const { data, error } = await supabase.from("atendimentos").select("id,status,tipo_atendimento,data_abertura,paciente:pacientes(nome_completo),profissional:profissionais(nome_completo)").order("data_abertura", { ascending: false }).limit(100);
  return <SectionPage eyebrow="Assistencial / Atendimento" title="Atendimento / ADT" description="Abertura e acompanhamento da jornada assistencial do paciente na unidade." primaryActionLabel="Abrir atendimento" primaryActionHref="/atendimentos/novo">
    {sucesso ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">Atendimento aberto com sucesso.</div> : null}
    <section className="ui-card overflow-hidden"><div className="flex items-center gap-3 border-b border-slate-100 p-5"><span className="grid size-10 place-items-center rounded-xl bg-brand-50 text-brand-700"><ClipboardList className="size-5" /></span><div><h2 className="font-semibold text-slate-900">Atendimentos recentes</h2><p className="text-sm text-slate-500">Registros visíveis conforme unidade e permissões.</p></div></div>{error ? <p className="p-6 text-sm text-red-700">Não foi possível consultar atendimentos. Confirme a migration e as permissões.</p> : data?.length ? <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-5 py-3">Paciente</th><th className="px-5 py-3">Profissional</th><th className="px-5 py-3">Tipo</th><th className="px-5 py-3">Abertura</th><th className="px-5 py-3">Status</th></tr></thead><tbody className="divide-y divide-slate-100">{data.map((item) => <tr key={item.id} className="hover:bg-slate-50"><td className="px-5 py-4 font-medium text-slate-900">{relNome(item.paciente) ?? "—"}</td><td className="px-5 py-4 text-slate-600">{relNome(item.profissional) ?? "Não definido"}</td><td className="px-5 py-4 text-slate-600">{item.tipo_atendimento}</td><td className="px-5 py-4 text-slate-600">{new Date(item.data_abertura).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}</td><td className="px-5 py-4"><span className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700">{String(item.status).replaceAll("_", " ")}</span></td></tr>)}</tbody></table></div> : <div className="p-10 text-center text-sm text-slate-500">Nenhum atendimento encontrado.</div>}</section>
  </SectionPage>;
}
