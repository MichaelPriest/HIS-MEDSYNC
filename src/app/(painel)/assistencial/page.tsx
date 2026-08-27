import Link from "next/link";
import type { Route } from "next";
import {
  Activity,
  Baby,
  BedDouble,
  ChevronDown,
  ClipboardCheck,
  Droplets,
  FlaskConical,
  HeartPulse,
  MapPin,
  Pill,
  Salad,
  ScanLine,
  Scissors,
  ShieldAlert,
  ShieldCheck,
  Stethoscope,
  Syringe,
  Truck,
  Wind,
} from "lucide-react";
import { SectionPage } from "@/components/painel/section-page";
import { canAccessNavigation } from "@/lib/permissions/navigation";
import { getCurrentNavigationAccess } from "@/lib/permissions/server-navigation";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const modules = [
  ["prontuario", "Prontuário Clínico", "Histórico longitudinal, anamnese, evolução, documentos e contexto completo do episódio.", Stethoscope, "prontuario_anamneses", "/prontuario", "fluxo"],
  ["sae", "SAE de Enfermagem", "Avaliação, diagnósticos, cuidados, sinais vitais, balanço, dispositivos e feridas.", Activity, "sae_avaliacoes", "/assistencial/sae", "fluxo"],
  ["medicamentos", "Medicamentos / Farmácia", "Validação, dispensação, lote, devolução e administração beira-leito.", Pill, "administracoes_medicamentos", "/assistencial/medicamentos", "fluxo"],
  ["laboratorio", "Laboratório Clínico", "Coleta, amostra, bancada, resultados, críticos, liberação e laudo.", FlaskConical, "laboratorio_amostras", "/assistencial/laboratorio", "fluxo"],
  ["imagem", "Diagnóstico por Imagem", "Execução, PACS/DICOM, achados, comunicação crítica, laudo e retificação.", ScanLine, "imagem_execucoes", "/assistencial/imagem", "fluxo"],
  ["internacao", "Internação e Leitos", "Censo, leitos, NIR, transferências e alta no mesmo atendimento.", BedDouble, "internacoes", "/internacao", "fluxo"],
  ["urgencia", "Urgência / Emergência", "ABCDE, classificação, protocolos, procedimentos, reavaliação e destino.", HeartPulse, "emergencia_registros", "/assistencial/urgencia", "fluxo"],
  ["procedimentos", "Procedimentos Assistenciais", "Execução multiprofissional estruturada e vinculada ao prontuário.", ClipboardCheck, "procedimentos_assistenciais", "/assistencial/procedimentos", "fluxo"],
  ["alta", "Transição / Alta", "Planejamento multiprofissional, conciliação e sumário de alta.", ClipboardCheck, "sumarios_alta", "/internacao/altas", "fluxo"],

  ["nutricao", "Nutrição Clínica", "Triagem, avaliação, necessidades, dieta e aceitação alimentar.", Salad, "nutricao_avaliacoes", "/assistencial/nutricao", "terapias"],
  ["hemoterapia", "Hemoterapia", "Solicitação, bolsas, compatibilidade, transfusão e reação transfusional.", Droplets, "hemoterapia_solicitacoes", "/assistencial/hemoterapia", "terapias"],
  ["antimicrobianos", "Antimicrobianos", "Stewardship, culturas, restritos e reavaliação terapêutica.", Syringe, "antimicrobianos_controle", "/assistencial/antimicrobianos", "terapias"],
  ["uti", "UTI", "Monitorização intensiva, ventilação, gasometria e desmame.", Wind, "ventilacao_mecanica", "/assistencial/uti", "terapias"],
  ["multiprofissional", "Equipe Multiprofissional", "Fisioterapia, fono, psicologia, TO, serviço social e demais equipes.", Stethoscope, "evolucoes_multiprofissionais", "/assistencial/multiprofissional", "terapias"],
  ["transportes", "Transportes", "Transporte interno, externo, inter-hospitalar e monitorização.", Truck, "transportes_pacientes", "/assistencial/transportes", "terapias"],

  ["centro-cirurgico", "Centro Cirúrgico / CME", "Cirurgia segura, anestesia, RPA, OPME, salas e esterilização.", Scissors, "cirurgias", "/assistencial/centro-cirurgico", "cirurgico"],
  ["obstetricia", "Obstetrícia / Parto", "Trabalho de parto, parto e intercorrências maternas.", Baby, "obstetricia_registros", "/assistencial/obstetricia", "cirurgico"],
  ["neonatal", "Neonatal", "Apgar, reanimação, profilaxias, aleitamento e destino do RN.", Baby, "neonatal_registros", "/assistencial/neonatal", "cirurgico"],

  ["dialise", "Hemodiálise", "Prescrição dialítica, máquina, sessão, ultrafiltração e monitorização.", Droplets, "dialise_sessoes", "/assistencial/dialise", "especialidades"],
  ["oncologia", "Oncologia", "Plano, protocolo, ciclos, quimioterápicos e dupla checagem.", Stethoscope, "oncologia_planos", "/assistencial/oncologia", "especialidades"],
  ["radioterapia", "Radioterapia", "Planejamento, técnica, dose, frações e execução seriada.", ScanLine, "radioterapia_planos", "/assistencial/radioterapia", "especialidades"],
  ["hemodinamica", "Hemodinâmica", "Cateterismo, intervenção, contraste, materiais e laudo.", HeartPulse, "hemodinamica_procedimentos", "/assistencial/hemodinamica", "especialidades"],
  ["endoscopia", "Endoscopia", "Preparo, sedação, achados, biópsias e procedimentos.", Activity, "endoscopia_procedimentos", "/assistencial/endoscopia", "especialidades"],
  ["anatomia-patologica", "Anatomia Patológica", "Material, macroscopia, blocos, lâminas, imuno e laudo.", FlaskConical, "anatomia_patologica_solicitacoes", "/assistencial/anatomia-patologica", "especialidades"],
  ["transplantes", "Transplantes", "Avaliação, lista de espera, procedimento e seguimento.", ShieldCheck, "transplante_avaliacoes", "/assistencial/transplantes", "especialidades"],
  ["home-care", "Home Care", "Plano domiciliar, equipamentos, insumos, visitas e continuidade.", Truck, "homecare_planos", "/assistencial/home-care", "especialidades"],
  ["paliativos", "Cuidados Paliativos", "Objetivos de cuidado, sintomas, diretivas e suporte familiar.", ShieldCheck, "cuidados_paliativos_planos", "/assistencial/paliativos", "especialidades"],
  ["imunizacao", "Imunização", "Vacina, lote, validade, via, aplicação e evento adverso.", Syringe, "imunizacoes", "/assistencial/imunizacao", "especialidades"],

  ["ccih", "CCIH", "Infecções, multirresistência, isolamento, precauções e vigilância.", ShieldAlert, "ccih_eventos", "/assistencial/ccih", "qualidade"],
  ["seguranca-paciente", "Segurança do Paciente", "Near miss, incidentes, dano e análise institucional.", ShieldAlert, "eventos_seguranca_paciente", "/assistencial/seguranca-paciente", "qualidade"],
  ["obitos", "Óbitos", "Constatação, documentação, familiares e liberação do corpo.", ShieldCheck, "obitos", "/assistencial/obitos", "qualidade"],
] as const;

type AssistencialModule = (typeof modules)[number];

const sectionMeta = {
  fluxo: { title: "Fluxo principal do atendimento", description: "Áreas que acompanham o paciente ao longo do episódio e do histórico longitudinal." },
  terapias: { title: "Terapias e apoio clínico", description: "Equipes que executam cuidado especializado e compartilham o mesmo prontuário." },
  cirurgico: { title: "Bloco cirúrgico e materno-infantil", description: "Fluxos perioperatórios, obstétricos e neonatais." },
  especialidades: { title: "Especialidades avançadas", description: "Áreas especializadas com operação própria e integração longitudinal." },
  qualidade: { title: "Qualidade e segurança assistencial", description: "Vigilância, segurança do paciente e eventos institucionais." },
} as const;

export default async function AssistencialPage() {
  const { supabase, grantedPermissions, activeProfile } = await getCurrentNavigationAccess();
  const visibleModules = modules.filter(([, , , , , href]) => canAccessNavigation(grantedPermissions, href));
  const counts = await Promise.all(visibleModules.map(async ([slug, , , , table]) => {
    const { count, error } = await supabase.from(table).select("id", { count: "exact", head: true });
    return [slug, error ? null : count ?? 0] as const;
  }));
  const countMap = new Map(counts);

  const moduleCard = ([slug, title, description, Icon, , href]: AssistencialModule) => {
    const count = countMap.get(slug);
    return (
      <Link key={slug} href={href as Route} className="group his-card p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <span className="grid size-11 place-items-center rounded-2xl bg-brand-50 text-brand-700 transition group-hover:bg-brand-100"><Icon className="size-5" /></span>
          <span className="rounded-full bg-slate-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-slate-500">{count === null ? "restrito" : `${count} registro${count === 1 ? "" : "s"}`}</span>
        </div>
        <h3 className="mt-4 text-base font-black text-slate-950">{title}</h3>
        <p className="mt-2 text-sm leading-6 text-slate-500">{description}</p>
        <span className="mt-4 inline-flex text-xs font-black text-brand-600 transition group-hover:translate-x-1">Abrir workspace →</span>
      </Link>
    );
  };

  const sections = Object.entries(sectionMeta)
    .map(([key, meta]) => ({ key, ...meta, items: visibleModules.filter((item) => item[6] === key) }))
    .filter((section) => section.items.length > 0);

  const [primary, ...secondary] = sections;

  return (
    <SectionPage
      eyebrow="Assistencial / Mapa de áreas"
      title="Mapa Assistencial"
      description="A Central Assistencial agora funciona como mapa de apoio. O acesso diário deve acontecer prioritariamente pelo Meu setor do perfil ativo."
    >
      <section className="rounded-[24px] bg-[linear-gradient(120deg,#0b1f44_0%,#173273_58%,#2563eb_100%)] p-6 text-white shadow-his-float sm:p-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-200/70">Navegação por responsabilidade</p>
            <h2 className="mt-2 text-2xl font-black tracking-tight">{activeProfile ? `Área assistencial de ${activeProfile.nome}` : "Visão assistencial integrada"}</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-blue-100/75">Os módulos abaixo já respeitam o perfil ativo. Médico, enfermagem, farmácia, diagnóstico e especialidades continuam compartilhando paciente, atendimento, RA, auditoria e histórico clínico sem transformar esta página em um menu infinito.</p>
          </div>
          {activeProfile?.paginaInicial ? <Link href={activeProfile.paginaInicial as Route} className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-4 py-3 text-sm font-black text-white hover:bg-white/15"><MapPin className="size-4" /> Ir para Meu setor</Link> : null}
        </div>
      </section>

      {primary ? (
        <section className="mt-6">
          <div className="mb-4"><p className="text-xs font-black uppercase tracking-[0.16em] text-brand-600">Acesso direto</p><h2 className="mt-1 text-xl font-black text-slate-950">{primary.title}</h2><p className="mt-1 text-sm text-slate-500">{primary.description}</p></div>
          <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">{primary.items.map(moduleCard)}</div>
        </section>
      ) : null}

      <div className="mt-6 space-y-4">
        {secondary.map((section) => (
          <details key={section.key} className="his-card overflow-hidden">
            <summary className="flex cursor-pointer list-none items-center gap-4 p-5 sm:p-6">
              <span className="grid size-11 place-items-center rounded-2xl bg-slate-100 text-slate-700"><Activity className="size-5" /></span>
              <div className="min-w-0 flex-1"><h2 className="font-black text-slate-950">{section.title}</h2><p className="mt-1 text-sm text-slate-500">{section.description}</p></div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">{section.items.length}</span><ChevronDown className="size-5 text-slate-400" />
            </summary>
            <div className="border-t border-slate-100 bg-slate-50/50 p-4 sm:p-6"><div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">{section.items.map(moduleCard)}</div></div>
          </details>
        ))}
      </div>
    </SectionPage>
  );
}
