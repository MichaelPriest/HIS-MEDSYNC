import { AgendaForm } from "@/components/agenda/agenda-form";
import { SectionPage } from "@/components/painel/section-page";
import { criarAgendamento } from "@/modules/agenda/actions";
import { getAssistencialContext } from "@/modules/assistencial/context";

function mensagemErro(erro?: string) {
  if (!erro) return null;
  if (erro === "conflito-horario") return "Existe conflito de horário para o profissional ou local selecionado.";
  if (erro === "plano") return "O plano selecionado não pertence ao convênio informado ou está inativo.";
  if (erro === "local") return "O local selecionado não está disponível para atendimento nesta unidade.";
  if (erro === "campos-obrigatorios") return "Selecione o paciente e informe início e fim do agendamento.";
  return "Não foi possível salvar o agendamento. Revise os dados e suas permissões.";
}

export default async function NovoAgendamentoPage({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const { erro } = await searchParams;
  const { supabase, empresaId, unidadeId } = await getAssistencialContext();
  const [{ data: profissionais }, { data: convenios }, { data: planos }, { data: tipos }, { data: especialidades }, { data: locais }] = await Promise.all([
    supabase.from("profissionais").select("id,nome_completo,especialidade").eq("empresa_id", empresaId).eq("ativo", true).order("nome_completo").limit(500),
    supabase.from("convenios").select("id,nome_fantasia").eq("empresa_id", empresaId).eq("ativo", true).order("nome_fantasia").limit(300),
    supabase.from("convenio_planos").select("id,convenio_id,nome,codigo").eq("empresa_id", empresaId).eq("ativo", true).order("nome").limit(800),
    supabase.from("catalogos").select("codigo,descricao").eq("ativo", true).eq("tipo", "tipo_atendimento").order("descricao"),
    supabase.from("catalogos").select("codigo,descricao").eq("ativo", true).eq("tipo", "especialidade").order("descricao").limit(300),
    supabase.from("estruturas_fisicas").select("id,nome,tipo").eq("unidade_id", unidadeId).eq("ativo", true).eq("permite_atendimento", true).order("ordem").order("nome").limit(500),
  ]);
  const erroTexto = mensagemErro(erro);

  return <SectionPage eyebrow="Assistencial / Agenda / Novo" title="Novo agendamento" description="Agenda ambulatorial e programação eletiva com controle de profissional, local, convênio, plano e conflito de horários.">
    {erroTexto ? <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{erroTexto}</div> : null}
    <AgendaForm
      action={criarAgendamento}
      empresaId={empresaId}
      profissionais={profissionais ?? []}
      convenios={convenios ?? []}
      planos={planos ?? []}
      tipos={tipos ?? []}
      especialidades={especialidades ?? []}
      locais={locais ?? []}
    />
  </SectionPage>;
}
