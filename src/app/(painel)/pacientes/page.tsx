import { ModulePlaceholder } from "@/components/painel/module-placeholder";
import { SectionPage } from "@/components/painel/section-page";

export default function PacientesPage() {
  return (
    <SectionPage
      eyebrow="Cadastros / Pacientes"
      title="Pacientes"
      description="Central de cadastro e consulta da identificação administrativa do paciente, preparada para vínculo posterior com atendimentos, documentos e prontuário."
      primaryActionLabel="Novo paciente"
      primaryActionHref="/pacientes/novo"
    >
      <ModulePlaceholder
        title="Cadastro mestre de pacientes"
        description="A próxima etapa conectará esta tela às tabelas do marco 2, mantendo isolamento por empresa e unidade e evitando exclusão física de registros assistenciais."
        items={["Busca por nome, CPF e CNS", "Dados pessoais e contatos", "Endereço", "Convênios e carteirinhas", "Contatos de emergência", "Histórico de alterações"]}
      />
    </SectionPage>
  );
}
