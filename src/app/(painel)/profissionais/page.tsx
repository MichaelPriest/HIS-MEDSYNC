import { ModulePlaceholder } from "@/components/painel/module-placeholder";
import { SectionPage } from "@/components/painel/section-page";

export default function ProfissionaisPage() {
  return (
    <SectionPage
      eyebrow="Cadastros / Profissionais"
      title="Profissionais"
      description="Cadastro de profissionais assistenciais e administrativos, com estrutura preparada para conselhos, especialidades, CBO, vínculos e unidades de atuação."
    >
      <ModulePlaceholder
        title="Cadastro mestre de profissionais"
        description="A integração futura deve separar identidade do profissional, credenciais regulatórias, especialidades e vínculos com empresas e unidades."
        items={["Nome e documento", "Conselho e registro", "UF do conselho", "Especialidades", "CBO", "Unidades de atuação"]}
      />
    </SectionPage>
  );
}
