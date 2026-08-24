import Link from "next/link";
import type { Route } from "next";
import { Activity, ArrowLeft, Baby, BedDouble, ClipboardCheck, Droplets, FlaskConical, HeartPulse, Pill, Salad, ScanLine, Scissors, ShieldAlert, ShieldCheck, Stethoscope, Syringe, Truck, Wind } from "lucide-react";
import { notFound } from "next/navigation";
import { SectionPage } from "@/components/painel/section-page";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const modules = {
  sae: ["SAE de Enfermagem","Avaliação, diagnósticos, cuidados, sinais vitais, balanço hídrico, dispositivos, feridas e curativos.",Activity,["sae_avaliacoes","sae_diagnosticos","sae_cuidados","sae_checagens","sinais_vitais","balancos_hidricos","dispositivos_invasivos","lesoes_pele","curativos"],"/setores/enfermagem"],
  medicamentos: ["Medicamentos / Farmácia Clínica","Conciliação, validação, dispensação por lote, devolução e administração segura.",Pill,["prescricoes","validacoes_farmaceuticas","dispensacoes_medicamentos","devolucoes_medicamentos","administracoes_medicamentos","conciliacoes_medicamentosas"],"/prescricao"],
  laboratorio: ["Laboratório Clínico","Amostra, cadeia de custódia, resultado, referência, críticos, liberação e assinatura.",FlaskConical,["laboratorio_amostras","laboratorio_resultados","laboratorio_resultados_historico"],"/setores/laboratorio"],
  imagem: ["Diagnóstico por Imagem","Execução, PACS/DICOM, laudo, assinatura, liberação e histórico.",ScanLine,["imagem_execucoes","imagem_laudos","imagem_laudos_historico"],"/setores/imagem"],
  internacao: ["Internação e Leitos","Mapa, ocupação, transferências, diárias, isolamento, higienização e alta.",BedDouble,["leitos","internacoes","movimentacoes_leitos","internacao_diarias","internacao_isolamentos"],"/internacao"],
  urgencia: ["Urgência / Emergência","ABCDE, classificação, protocolos, procedimentos, reavaliações e destino.",HeartPulse,["emergencia_registros","emergencia_reavaliacoes","triagens"],"/triagem"],
  "centro-cirurgico": ["Centro Cirúrgico / CME","Cirurgia segura, anestesia, RPA, OPME e esterilização rastreável.",Scissors,["cirurgias","cirurgia_checklist","anestesia_registros","rpa_registros","cirurgia_opme","cme_ciclos"],"/internacao"],
  nutricao: ["Nutrição Clínica","Triagem, avaliação, necessidades, dietas e aceitação.",Salad,["nutricao_avaliacoes","nutricao_dietas","nutricao_aceitacoes"],"/internacao"],
  hemoterapia: ["Hemoterapia","Solicitação, bolsas, compatibilidade, transfusão e hemovigilância.",Droplets,["hemoterapia_solicitacoes","hemoterapia_bolsas","hemoterapia_compatibilidades","hemoterapia_transfusoes","transfusao_monitoracoes","hemoterapia_reacoes"],"/internacao"],
  ccih: ["CCIH","Infecções, multirresistência, precauções e vigilância.",ShieldAlert,["ccih_eventos"],"/assistencial"],
  antimicrobianos: ["Antimicrobianos","Stewardship, culturas, ajuste renal, restritos e reavaliação.",Syringe,["antimicrobianos_controle"],"/assistencial"],
  uti: ["UTI / Ventilação","Parâmetros ventilatórios, gasometria, desmame e monitorização intensiva.",Wind,["ventilacao_mecanica","sinais_vitais","balancos_hidricos"],"/internacao"],
  multiprofissional: ["Multiprofissional","Fisioterapia, fono, psicologia, TO, serviço social e demais áreas.",Stethoscope,["evolucoes_multiprofissionais","procedimentos_assistenciais"],"/prontuario"],
  procedimentos: ["Procedimentos Assistenciais","Execução estruturada, TUSS, quantidade, resultado e assinatura.",ClipboardCheck,["procedimentos_assistenciais"],"/prontuario"],
  transportes: ["Transportes","Transporte interno, externo e inter-hospitalar com requisitos clínicos.",Truck,["transportes_pacientes"],"/assistencial"],
  alta: ["Transição / Alta","Planejamento multiprofissional, conciliação e sumário de alta assinado.",ClipboardCheck,["planejamentos_alta","sumarios_alta","conciliacoes_medicamentosas"],"/internacao"],
  "seguranca-paciente": ["Segurança do Paciente","Near miss, incidentes, dano, ação imediata e análise institucional.",ShieldAlert,["eventos_seguranca_paciente"],"/assistencial"],
  obstetricia: ["Obstetrícia / Parto","Acompanhamento gestacional, trabalho de parto e parto.",Baby,["obstetricia_registros","partos"],"/assistencial"],
  neonatal: ["Neonatal","Apgar, reanimação, profilaxias, aleitamento e destino do RN.",Baby,["neonatal_registros"],"/assistencial"],
  obitos: ["Óbitos","Constatação, causas, documentação, comunicação familiar e liberação do corpo.",ShieldCheck,["obitos"],"/assistencial"],
} as const;

type Key = keyof typeof modules;

export default async function AssistencialModuloPage({ params }: { params: Promise<{ modulo: string }> }) {
  const { modulo } = await params;
  if (!(modulo in modules)) notFound();
  const [title, description, Icon, tables, operationHref] = modules[modulo as Key];
  const supabase = await createClient();
  const counts = await Promise.all(tables.map(async (table) => { const { count, error } = await supabase.from(table).select("id", { count: "exact", head: true }); return { table, count: error ? null : count ?? 0 }; }));
  const total = counts.reduce((sum, item) => sum + (item.count ?? 0), 0);

  return <SectionPage eyebrow="Assistencial" title={title} description={description}>
    <div className="mb-5 flex flex-wrap gap-2"><Link href={"/assistencial" as Route} className="btn-secondary"><ArrowLeft className="size-4"/>Central Assistencial</Link><Link href={operationHref as Route} className="ui-button-primary">Abrir operação atual</Link></div>
    <section className="grid gap-4 md:grid-cols-[1fr_250px]"><div className="his-card p-6"><div className="flex items-start gap-4"><span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-brand-50 text-brand-700"><Icon className="size-6"/></span><div><p className="his-eyebrow">Domínio hospitalar</p><h2 className="mt-1 text-xl font-black text-slate-950">Base integrada implantada</h2><p className="mt-2 text-sm leading-6 text-slate-500">As estruturas deste módulo compartilham atendimento, paciente, unidade, profissionais e regras de acesso. Operações críticas como estoque, leitos, assinatura, resultado e laudo já possuem funções transacionais no banco.</p></div></div></div><div className="his-kpi"><p className="text-xs font-black uppercase tracking-wider text-slate-400">Registros visíveis</p><p className="mt-3 text-4xl font-black text-brand-950">{total}</p><p className="mt-2 text-xs text-slate-500">no escopo atual.</p></div></section>
    <section className="his-card mt-5 overflow-hidden"><div className="border-b border-slate-100 p-5"><h2 className="font-black text-slate-900">Componentes implantados</h2></div><div className="grid gap-px bg-slate-100 sm:grid-cols-2 xl:grid-cols-3">{counts.map((item) => <div key={item.table} className="bg-white p-5"><p className="text-xs font-bold uppercase tracking-wider text-slate-400">{item.table.replaceAll("_"," ")}</p><p className="mt-2 text-2xl font-black text-slate-900">{item.count ?? "—"}</p></div>)}</div></section>
  </SectionPage>;
}
