import Link from "next/link";
import type { Route } from "next";
import { Activity, ArrowLeft, BedDouble, Droplets, FlaskConical, HeartPulse, Pill, Salad, ScanLine, Scissors } from "lucide-react";
import { notFound } from "next/navigation";
import { SectionPage } from "@/components/painel/section-page";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const MODULOS = {
  sae: { titulo: "SAE de Enfermagem", descricao: "Histórico, avaliação, diagnósticos, prescrição de cuidados e checagens.", Icon: Activity, principal: "sae_avaliacoes", secundarios: ["sae_diagnosticos", "sae_cuidados", "sae_checagens"], fila: "/setores/enfermagem" as Route, fluxo: ["Avaliação de enfermagem", "Diagnóstico de enfermagem", "Planejamento / cuidados", "Implementação", "Checagem e evolução"] },
  medicamentos: { titulo: "Medicamentos e Beira-leito", descricao: "Prescrição, aprazamento, dispensação, devolução, administração e segurança do paciente.", Icon: Pill, principal: "prescricao_checagens", secundarios: ["dispensacoes_medicamentos", "devolucoes_medicamentos", "administracoes_medicamentos"], fila: "/setores/farmacia" as Route, fluxo: ["Prescrição médica", "Validação / dispensação", "Aprazamento", "Identificação paciente + item", "Administração / dupla checagem"] },
  laboratorio: { titulo: "Laboratório Clínico", descricao: "Da solicitação ao resultado liberado, com rastreabilidade da amostra.", Icon: FlaskConical, principal: "laboratorio_amostras", secundarios: ["laboratorio_resultados"], fila: "/setores/laboratorio" as Route, fluxo: ["Solicitação", "Coleta", "Identificação da amostra", "Processamento", "Resultado / referência", "Liberação e assinatura"] },
  imagem: { titulo: "Diagnóstico por Imagem", descricao: "Execução dos exames e laudos vinculados à solicitação clínica.", Icon: ScanLine, principal: "imagem_execucoes", secundarios: ["imagem_laudos"], fila: "/setores/imagem" as Route, fluxo: ["Solicitação", "Agendamento / fila", "Execução", "Laudo", "Liberação e assinatura"] },
  internacao: { titulo: "Internação e Mapa de Leitos", descricao: "Gestão da ocupação, movimentações, diárias, isolamento e alta.", Icon: BedDouble, principal: "leitos", secundarios: ["internacoes", "movimentacoes_leitos", "internacao_diarias", "internacao_isolamentos"], fila: "/setores/internacao" as Route, fluxo: ["Solicitação de internação", "Reserva / ocupação", "Transferências", "Diárias", "Isolamento", "Alta e liberação do leito"] },
  urgencia: { titulo: "Urgência e Emergência", descricao: "Registro estruturado do atendimento crítico e protocolos institucionais.", Icon: HeartPulse, principal: "emergencia_registros", secundarios: ["triagens"], fila: "/triagem" as Route, fluxo: ["Acolhimento", "Classificação de risco", "ABCDE", "Protocolos / procedimentos", "Reavaliação", "Destino"] },
  "centro-cirurgico": { titulo: "Centro Cirúrgico", descricao: "Cirurgia, checklist, anestesia, RPA, OPME e CME em um fluxo único.", Icon: Scissors, principal: "cirurgias", secundarios: ["cirurgia_checklist", "anestesia_registros", "rpa_registros", "cirurgia_opme", "cme_ciclos"], fila: "/internacao" as Route, fluxo: ["Mapa cirúrgico", "Checklist cirurgia segura", "Anestesia", "Ato cirúrgico / OPME", "RPA", "CME / rastreabilidade"] },
  nutricao: { titulo: "Nutrição Clínica", descricao: "Triagem, avaliação e dieta hospitalar vinculadas ao episódio.", Icon: Salad, principal: "nutricao_avaliacoes", secundarios: ["nutricao_dietas"], fila: "/internacao" as Route, fluxo: ["Triagem nutricional", "Avaliação antropométrica", "Diagnóstico nutricional", "Necessidades", "Prescrição de dieta", "Reavaliação"] },
  hemoterapia: { titulo: "Banco de Sangue / Hemoterapia", descricao: "Solicitação e transfusão com compatibilidade e dupla checagem.", Icon: Droplets, principal: "hemoterapia_solicitacoes", secundarios: ["hemoterapia_transfusoes"], fila: "/internacao" as Route, fluxo: ["Solicitação", "Tipagem / compatibilidade", "Liberação", "Dupla checagem", "Transfusão", "Monitorização / reação"] },
} as const;

type ModuloKey = keyof typeof MODULOS;

export default async function ModuloAssistencialPage({ params }: { params: Promise<{ modulo: string }> }) {
  const { modulo } = await params;
  if (!(modulo in MODULOS)) notFound();
  const config = MODULOS[modulo as ModuloKey];
  const supabase = await createClient();

  const tabelas = [config.principal, ...config.secundarios];
  const contagens = await Promise.all(tabelas.map(async (tabela) => {
    const { count, error } = await supabase.from(tabela).select("id", { count: "exact", head: true });
    return { tabela, count: error ? null : count ?? 0 };
  }));
  const total = contagens.reduce((acc, item) => acc + (item.count ?? 0), 0);
  const Icon = config.Icon;

  return <SectionPage eyebrow="Assistencial" title={config.titulo} description={config.descricao}>
    <div className="mb-4 flex flex-wrap gap-2"><Link href="/assistencial" className="btn-secondary"><ArrowLeft className="size-4"/>Central Assistencial</Link><Link href={config.fila} className="ui-button-primary">Abrir fila / operação atual</Link></div>

    <section className="grid gap-4 md:grid-cols-[1fr_260px]">
      <div className="his-card p-5 sm:p-6"><div className="flex items-start gap-4"><span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-brand-50 text-brand-700"><Icon className="size-6"/></span><div><p className="his-eyebrow">Fluxo hospitalar</p><h2 className="mt-1 text-xl font-black text-slate-950">Etapas previstas</h2><div className="mt-4 flex flex-wrap gap-2">{config.fluxo.map((etapa, index) => <span key={etapa} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-600"><span className="mr-1 text-brand-600">{index + 1}.</span>{etapa}</span>)}</div></div></div></div>
      <div className="his-kpi"><p className="text-xs font-black uppercase tracking-wider text-slate-400">Registros do módulo</p><p className="mt-3 text-4xl font-black text-brand-950">{total}</p><p className="mt-2 text-xs text-slate-500">Somatório das tabelas assistenciais visíveis para seu perfil.</p></div>
    </section>

    <section className="his-card mt-5 overflow-hidden"><div className="border-b border-slate-100 p-5"><h2 className="font-black text-slate-900">Componentes do módulo</h2><p className="mt-1 text-sm text-slate-500">Estrutura clínica já disponível no banco e protegida por escopo de unidade.</p></div><div className="grid gap-px bg-slate-100 sm:grid-cols-2 xl:grid-cols-3">{contagens.map(item => <div key={item.tabela} className="bg-white p-5"><p className="text-xs font-bold uppercase tracking-wider text-slate-400">{item.tabela.replaceAll("_", " ")}</p><p className="mt-2 text-2xl font-black text-slate-900">{item.count ?? "—"}</p><p className="mt-1 text-xs text-slate-500">registro(s) visíveis</p></div>)}</div></section>

    <section className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900"><strong>Estado do módulo:</strong> a estrutura de dados, RLS e integração com atendimento/paciente já estão implantadas. As telas operacionais especializadas serão evoluídas sobre esta base sem criar bancos paralelos.</section>
  </SectionPage>;
}
