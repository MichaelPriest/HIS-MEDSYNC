import { CalendarDays } from "lucide-react";
import { SectionPage } from "@/components/painel/section-page";
import { createClient } from "@/lib/supabase/server";

function relNome(rel: { nome_completo?: string; nome_fantasia?: string } | { nome_completo?: string; nome_fantasia?: string }[] | null) { const item = Array.isArray(rel) ? rel[0] : rel; return item?.nome_completo ?? item?.nome_fantasia; }

export default async function AgendaPage({ searchParams }: { searchParams: Promise<{ sucesso?: string }> }) {
  const { sucesso } = await searchParams;
  const supabase = await createClient();
  const { data, error } = await supabase.from("agendamentos").select("id,inicio,fim,status,tipo_atendimento,paciente:pacientes(nome_completo),profissional:profissionais(nome_completo),convenio:convenios(nome_fantasia)").order("inicio").limit(150);
  return <SectionPage eyebrow="Assistencial / Agenda" title="Agenda e Recepção" description="Agendamentos, confirmação, check-in e acompanhamento da recepção." primaryActionLabel="Novo agendamento" primaryActionHref="/agenda/novo">
    {sucesso ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">Agendamento criado com sucesso.</div> : null}
    <section className="ui-card overflow-hidden"><div className="flex items-center gap-3 border-b border-slate-100 p-5"><span className="grid size-10 place-items-center rounded-xl bg-brand-50 text-brand-700"><CalendarDays className="size-5" /></span><div><h2 className="font-semibold text-slate-900">Próximos agendamentos</h2><p className="text-sm text-slate-500">Agenda visível conforme unidade e permissões.</p></div></div>{error ? <p className="p-6 text-sm text-red-700">Não foi possível consultar a agenda. Confirme a migration e as permissões.</p> : data?.length ? <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-5 py-3">Data/Hora</th><th className="px-5 py-3">Paciente</th><th className="px-5 py-3">Profissional</th><th className="px-5 py-3">Convênio</th><th className="px-5 py-3">Status</th></tr></thead><tbody className="divide-y divide-slate-100">{data.map((item) => <tr key={item.id} className="hover:bg-slate-50"><td className="px-5 py-4 font-medium text-slate-900">{new Date(item.inicio).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}</td><td className="px-5 py-4 text-slate-700">{relNome(item.paciente) ?? "—"}</td><td className="px-5 py-4 text-slate-600">{relNome(item.profissional) ?? "A definir"}</td><td className="px-5 py-4 text-slate-600">{relNome(item.convenio) ?? "Particular"}</td><td className="px-5 py-4"><span className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700">{String(item.status)}</span></td></tr>)}</tbody></table></div> : <div className="p-10 text-center text-sm text-slate-500">Nenhum agendamento encontrado.</div>}</section>
  </SectionPage>;
}
