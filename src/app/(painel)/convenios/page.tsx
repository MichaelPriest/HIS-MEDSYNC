import { ModulePlaceholder } from "@/components/painel/module-placeholder";
import { SectionPage } from "@/components/painel/section-page";

export default function ConveniosPage() {
  return (
    <SectionPage
      eyebrow="Cadastros / Convênios"
      title="Convênios"
      description="Cadastro de operadoras, planos, regras administrativas e identificadores necessários aos fluxos de autorização, TISS e faturamento."
    >
      <ModulePlaceholder
        title="Cadastro mestre de convênios"
        description="Este módulo será a fonte única para operadoras e planos usados em pacientes, atendimentos, autorizações e faturamento."
        items={["Registro ANS", "Razão social e nome fantasia", "Planos", "Padrões de carteirinha", "Regras de autorização", "Status e vigência"]}
      />
    </SectionPage>
  );
}
