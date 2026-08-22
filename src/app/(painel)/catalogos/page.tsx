import { ModulePlaceholder } from "@/components/painel/module-placeholder";
import { SectionPage } from "@/components/painel/section-page";

export default function CatalogosPage() {
  return (
    <SectionPage
      eyebrow="Cadastros / Catálogos"
      title="Catálogos assistenciais"
      description="Área para tabelas de domínio usadas por todo o HIS, mantendo códigos, vigências e referências regulatórias centralizadas."
    >
      <ModulePlaceholder
        title="Catálogos centrais"
        description="Os catálogos devem ser versionados quando houver vigência regulatória e nunca depender de valores fixos espalhados pelas páginas."
        items={["Especialidades", "CBO", "CID-10", "TUSS / procedimentos", "Tipos de atendimento", "Motivos e classificações"]}
      />
    </SectionPage>
  );
}
