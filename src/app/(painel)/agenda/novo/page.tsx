import { AgendaForm } from "@/components/agenda/agenda-form";
import { SectionPage } from "@/components/painel/section-page";
import { createClient } from "@/lib/supabase/server";
import { criarAgendamento } from "@/modules/agenda/actions";

export default async function NovoAgendamentoPage({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const { erro } = await searchParams;
  const supabase = await createClient();
  const [{ data: pacientes }, { data: profissionais }, { data: convenios }, { data: tipos }] = await Promise.all([
    supabase.from("pacientes").select("id,nome_completo,cpf,ra,numero_registro").eq("ativo", true).order("nome_completo").limit(1000),
    supabase.from("profissionais").select("id,nome_completo").eq("ativo", true).order("nome_completo").limit(500),
    supabase.from("convenios").select("id,nome_fantasia").eq("ativo", true).order("nome_fantasia").limit(300),
    supabase.from("catalogos").select("codigo,descricao").eq("ativo", true).eq("tipo", "tipo_atendimento").order("descricao"),
  ]);
  return <SectionPage eyebrow="Assistencial / Agenda / Novo" title="Novo agendamento" description="Localize o paciente por nome, CPF, RA ou registro e crie o agendamento.">
    {erro ? <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">Preencha paciente, início e fim e confirme suas permissões.</div> : null}
    <AgendaForm action={criarAgendamento} pacientes={pacientes ?? []} profissionais={profissionais ?? []} convenios={convenios ?? []} tipos={tipos ?? []} />
  </SectionPage>;
}
