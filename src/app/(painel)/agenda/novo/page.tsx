import { AgendaForm } from "@/components/agenda/agenda-form";
import { SectionPage } from "@/components/painel/section-page";
import { getAssistencialContext } from "@/modules/assistencial/context";

export default async function NovoAgendamentoPage() {
  const { supabase, empresaId, unidadeId } = await getAssistencialContext();
  const [{ data: convenios }, { data: planos }, { data: tipos }, { data: especialidades }, { data: locais }] = await Promise.all([
    supabase.from("convenios").select("id,nome_fantasia").eq("empresa_id", empresaId).eq("ativo", true).order("nome_fantasia").limit(300),
    supabase.from("convenio_planos").select("id,convenio_id,nome,codigo").eq("empresa_id", empresaId).eq("ativo", true).order("nome").limit(800),
    supabase.from("catalogos").select("codigo,descricao").eq("ativo", true).eq("tipo", "tipo_atendimento").order("descricao"),
    supabase.from("catalogos").select("codigo,descricao").eq("ativo", true).eq("tipo", "especialidade").order("descricao").limit(300),
    supabase.from("estruturas_fisicas").select("id,nome,tipo").eq("unidade_id", unidadeId).eq("ativo", true).eq("permite_atendimento", true).order("ordem").order("nome").limit(500),
  ]);

  return (
    <SectionPage
      eyebrow="Assistencial / Agenda / Novo"
      title="Novo agendamento"
      description="Agenda ambulatorial e programação eletiva com controle de profissional, local, convênio, plano e conflito de horários."
    >
      <AgendaForm
        empresaId={empresaId}
        convenios={convenios ?? []}
        planos={planos ?? []}
        tipos={tipos ?? []}
        especialidades={especialidades ?? []}
        locais={locais ?? []}
      />
    </SectionPage>
  );
}
