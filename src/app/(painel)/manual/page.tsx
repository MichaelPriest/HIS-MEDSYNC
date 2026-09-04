import { BookOpenCheck, Layers3, Search, UsersRound } from "lucide-react";
import { KnowledgeBaseBrowser } from "@/components/manual/knowledge-base-browser";
import { SectionPage } from "@/components/painel/section-page";
import { knowledgeBaseArticles } from "@/modules/knowledge-base/articles";
import { admissionReadinessKnowledgeBaseArticles } from "@/modules/knowledge-base/admissao-prontidao-articles";
import { assistencialOperationalKnowledgeBaseArticles } from "@/modules/knowledge-base/assistencial-operacional-articles";
import { billingTissKnowledgeBaseArticles } from "@/modules/knowledge-base/faturamento-tiss-articles";
import { commercialKnowledgeBaseArticles } from "@/modules/knowledge-base/comercial-articles";
import { commercialLinkKnowledgeBaseArticles } from "@/modules/knowledge-base/commercial-link-articles";
import { surgicalBillingKnowledgeBaseArticles } from "@/modules/knowledge-base/faturamento-equipe-cirurgica-articles";
import { receptionCockpitKnowledgeBaseArticles } from "@/modules/knowledge-base/recepcao-cockpit-articles";

export default function ManualPage() {
  const articles = [
    ...knowledgeBaseArticles,
    ...admissionReadinessKnowledgeBaseArticles,
    ...receptionCockpitKnowledgeBaseArticles,
    ...commercialKnowledgeBaseArticles,
    ...commercialLinkKnowledgeBaseArticles,
    ...surgicalBillingKnowledgeBaseArticles,
    ...billingTissKnowledgeBaseArticles,
    ...assistencialOperationalKnowledgeBaseArticles,
  ];
  const categories = ["Todas", ...Array.from(new Set(articles.map((article) => article.category)))];
  const audiences = ["Todos os perfis", ...Array.from(new Set(articles.flatMap((article) => article.audience))).sort((a, b) => a.localeCompare(b, "pt-BR"))];

  return (
    <SectionPage
      eyebrow="Ajuda / Base de Conhecimento"
      title="Base de Conhecimento do MedSync HIS"
      description="Guias operacionais pesquisáveis para aprender a usar os módulos mantendo o mesmo atendimento, as regras de segurança e a sequência correta entre os setores."
    >
      <section className="grid gap-3 sm:grid-cols-3">
        <div className="his-kpi"><div className="flex items-center justify-between"><p className="text-xs font-black uppercase tracking-wider text-slate-400">Guias disponíveis</p><BookOpenCheck className="size-5 text-brand-600" /></div><p className="mt-2 text-3xl font-black text-brand-950">{articles.length}</p></div>
        <div className="his-kpi"><div className="flex items-center justify-between"><p className="text-xs font-black uppercase tracking-wider text-slate-400">Categorias</p><Layers3 className="size-5 text-brand-600" /></div><p className="mt-2 text-3xl font-black text-brand-950">{categories.length - 1}</p></div>
        <div className="his-kpi"><div className="flex items-center justify-between"><p className="text-xs font-black uppercase tracking-wider text-slate-400">Perfis orientados</p><UsersRound className="size-5 text-brand-600" /></div><p className="mt-2 text-3xl font-black text-brand-950">{audiences.length - 1}</p></div>
      </section>

      <section className="ui-card my-5 p-5">
        <div className="flex gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700"><Search className="size-5" /></span>
          <div>
            <h2 className="font-black text-slate-900">Procure pela tarefa que precisa executar</h2>
            <p className="mt-1 text-sm leading-6 text-slate-600">Você pode buscar por módulo, ação ou dúvida, como “recepção”, “triagem”, “dispensação”, “laudo”, “glosa”, “recurso”, “TISS”, “contrato”, “CBHPM”, “urgência”, “UTI”, “CME”, “SAE”, “diálise” ou “NFS-e”. Também é possível filtrar pelo perfil operacional para ver somente os guias do seu setor.</p>
          </div>
        </div>
      </section>

      <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 p-5">
        <strong className="text-sm text-amber-900">Base operacional em evolução</strong>
        <p className="mt-1 text-sm leading-6 text-amber-800">Os guias ensinam o comportamento atualmente implementado, mas não substituem protocolos institucionais, treinamento assistencial, regras contratuais ou homologações externas. Integrações com operadoras, diagnóstico por imagem e emissão fiscal devem refletir a infraestrutura real da instituição.</p>
      </div>

      <KnowledgeBaseBrowser articles={articles} categories={categories} audiences={audiences} />
    </SectionPage>
  );
}
