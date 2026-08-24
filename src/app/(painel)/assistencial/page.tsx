import Link from "next/link";
import type { Route } from "next";
import {
  Activity,
  Baby,
  BedDouble,
  ClipboardCheck,
  Droplets,
  FlaskConical,
  HeartPulse,
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
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const modules = [
  ["prontuario", "Prontuário Clínico", "Anamnese, problemas, CID, SOAP, exame físico e assinatura.", Stethoscope, "prontuario_anamneses", "/prontuario"],
  ["sae", "SAE de Enfermagem", "Avaliação, diagnósticos, cuidados, sinais vitais e dispositivos.", Activity, "sae_avaliacoes", "/assistencial/sae"],
  ["medicamentos", "Medicamentos / Farmácia", "Prescrição segura, validação, dispensação e administração.", Pill, "administracoes_medicamentos", "/assistencial/medicamentos"],
  ["laboratorio", "Laboratório Clínico", "Coleta, amostras, resultados, críticos e liberação.", FlaskConical, "laboratorio_amostras", "/assistencial/laboratorio"],
  ["imagem", "Diagnóstico por Imagem", "Execução, DICOM/PACS, laudo, assinatura e liberação.", ScanLine, "imagem_execucoes", "/assistencial/imagem"],
  ["internacao", "Internação e Leitos", "Ocupação, transferências, isolamento, higienização e alta.", BedDouble, "internacoes", "/assistencial/internacao"],
  ["urgencia", "Urgência / Emergência", "ABCDE, classificação, protocolos, reavaliação e destino.", HeartPulse, "emergencia_registros", "/assistencial/urgencia"],
  ["centro-cirurgico", "Centro Cirúrgico / CME", "Cirurgia segura, anestesia, RPA, OPME e esterilização.", Scissors, "cirurgias", "/assistencial/centro-cirurgico"],
  ["nutricao", "Nutrição Clínica", "Triagem nutricional, necessidades, dieta e aceitação.", Salad, "nutricao_avaliacoes", "/assistencial/nutricao"],
  ["hemoterapia", "Hemoterapia", "Bolsas, compatibilidade, transfusão e reações transfusionais.", Droplets, "hemoterapia_solicitacoes", "/assistencial/hemoterapia"],
  ["ccih", "CCIH", "Infecções, multirresistência, isolamento e vigilância.", ShieldAlert, "ccih_eventos", "/assistencial/ccih"],
  ["antimicrobianos", "Antimicrobianos", "Stewardship, culturas, restritos e reavaliação clínica.", Syringe, "antimicrobianos_controle", "/assistencial/antimicrobianos"],
  ["uti", "UTI / Ventilação", "Ventilação mecânica, gasometria, desmame e monitorização.", Wind, "ventilacao_mecanica", "/assistencial/uti"],
  ["multiprofissional", "Multiprofissional", "Fisioterapia, fono, psicologia, TO e serviço social.", Stethoscope, "evolucoes_multiprofissionais", "/assistencial/multiprofissional"],
  ["procedimentos", "Procedimentos Assistenciais", "Execução estruturada, TUSS, resultado e assinatura.", ClipboardCheck, "procedimentos_assistenciais", "/assistencial/procedimentos"],
  ["transportes", "Transportes", "Transporte interno, externo e inter-hospitalar.", Truck, "transportes_pacientes", "/assistencial/transportes"],
  ["alta", "Transição / Alta", "Planejamento multiprofissional, conciliação e sumário de alta.", ClipboardCheck, "sumarios_alta", "/assistencial/alta"],
  ["seguranca-paciente", "Segurança do Paciente", "Near miss, incidentes, dano e análise institucional.", ShieldAlert, "eventos_seguranca_paciente", "/assistencial/seguranca-paciente"],
  ["obstetricia", "Obstetrícia / Parto", "Acompanhamento gestacional, trabalho de parto e intercorrências.", Baby, "obstetricia_registros", "/assistencial/obstetricia"],
  ["neonatal", "Neonatal", "Apgar, reanimação, profilaxias, aleitamento e destino do RN.", Baby, "neonatal_registros", "/assistencial/neonatal"],
  ["obitos", "Óbitos", "Constatação, causas, documentação e liberação do corpo.", ShieldCheck, "obitos", "/assistencial/obitos"],
  ["dialise", "Hemodiálise", "Prescrição dialítica, acesso, sessão, ultrafiltração e Kt/V.", Droplets, "dialise_sessoes", "/assistencial/dialise"],
  ["oncologia", "Oncologia / Quimioterapia", "Plano oncológico, ciclos, doses e dupla checagem.", Stethoscope, "oncologia_planos", "/assistencial/oncologia"],
  ["radioterapia", "Radioterapia", "Planejamento, técnica, dose, frações e execução seriada.", ScanLine, "radioterapia_planos", "/assistencial/radioterapia"],
  ["hemodinamica", "Hemodinâmica", "Cateterismo, angiografia, contraste, radiação e implantes.", HeartPulse, "hemodinamica_procedimentos", "/assistencial/hemodinamica"],
  ["endoscopia", "Endoscopia", "Preparo, sedação, achados, biópsias e complicações.", Activity, "endoscopia_procedimentos", "/assistencial/endoscopia"],
  ["anatomia-patologica", "Anatomia Patológica", "Material, macroscopia, lâminas, microscopia e laudo.", FlaskConical, "anatomia_patologica_solicitacoes", "/assistencial/anatomia-patologica"],
  ["transplantes", "Transplantes", "Avaliação, lista de espera, procedimento e seguimento.", ShieldCheck, "transplante_avaliacoes", "/assistencial/transplantes"],
  ["home-care", "Home Care", "Plano domiciliar, equipamentos, insumos e visitas.", Truck, "homecare_planos", "/assistencial/home-care"],
  ["paliativos", "Cuidados Paliativos", "Objetivos de cuidado, sintomas, diretivas e suporte familiar.", ShieldCheck, "cuidados_paliativos_planos", "/assistencial/paliativos"],
  ["imunizacao", "Imunização", "Vacina, dose, fabricante, lote e evento adverso.", Syringe, "imunizacoes", "/assistencial/imunizacao"],
] as const;

type ModuleSlug = (typeof modules)[number][0];

const groups: Array<{ title: string; description: string; slugs: ModuleSlug[] }> = [
  {
    title: "Fluxo clínico principal",
    description: "Registro clínico e atividades executadas durante o episódio assistencial.",
    slugs: ["prontuario", "sae", "medicamentos", "procedimentos", "multiprofissional", "alta", "seguranca-paciente"],
  },
  {
    title: "Diagnóstico e terapias",
    description: "Exames, medicamentos, suporte terapêutico e serviços de apoio diagnóstico.",
    slugs: ["laboratorio", "imagem", "hemoterapia", "antimicrobianos", "nutricao", "imunizacao"],
  },
  {
    title: "Hospitalar e alta complexidade",
    description: "Fluxos de internação, urgência, terapia intensiva, cirurgia e vigilância hospitalar.",
    slugs: ["internacao", "urgencia", "uti", "centro-cirurgico", "transportes", "ccih", "obitos", "paliativos"],
  },
  {
    title: "Especialidades avançadas",
    description: "Linhas assistenciais especializadas acessadas conforme o perfil do hospital.",
    slugs: ["obstetricia", "neonatal", "dialise", "oncologia", "radioterapia", "hemodinamica", "endoscopia", "anatomia-patologica", "transplantes", "home-care"],
  },
];

export default async function AssistencialPage() {
  const supabase = await createClient();
  const counts = await Promise.all(
    modules.map(async ([slug, , , , table]) => {
      const { count, error } = await supabase.from(table).select("id", { count: "exact", head: true });
      return [slug, error ? null : count ?? 0] as const;
    }),
  );
  const countMap = new Map(counts);
  const moduleMap = new Map(modules.map((item) => [item[0], item] as const));

  return (
    <SectionPage eyebrow="Assistencial" title="Central Assistencial" description="Encontre o que precisa pelo fluxo clínico, sem navegar por dezenas de telas no mesmo nível.">
      <section className="rounded-[24px] bg-[linear-gradient(120deg,#0b1f44_0%,#173273_58%,#2563eb_100%)] p-6 text-white shadow-his-float sm:p-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-200/70">Operação clínica integrada</p>
            <h2 className="mt-2 text-2xl font-black tracking-tight">Escolha primeiro o contexto de trabalho</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-blue-100/70">Prontuário, enfermagem, diagnóstico, internação e especialidades continuam integrados ao mesmo paciente e atendimento, mas agora aparecem agrupados por finalidade.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/operacao" className="rounded-xl border border-white/15 bg-white/[.08] px-4 py-2.5 text-xs font-bold text-white transition hover:bg-white/[.14]">Jornada do paciente</Link>
            <Link href="/setores" className="rounded-xl border border-white/15 bg-white/[.08] px-4 py-2.5 text-xs font-bold text-white transition hover:bg-white/[.14]">Filas por setor</Link>
          </div>
        </div>
      </section>

      <section className="mt-5 grid gap-5 xl:grid-cols-2">
        {groups.map((group) => (
          <div key={group.title} className="his-card overflow-hidden">
            <div className="border-b border-slate-100 px-5 py-4 sm:px-6">
              <h2 className="text-base font-black text-slate-950">{group.title}</h2>
              <p className="mt-1 text-sm leading-5 text-slate-500">{group.description}</p>
            </div>
            <div className="divide-y divide-slate-100">
              {group.slugs.map((slug) => {
                const module = moduleMap.get(slug);
                if (!module) return null;
                const [, title, description, Icon, , href] = module;
                const count = countMap.get(slug);
                return (
                  <Link key={slug} href={href as Route} className="group flex items-center gap-4 px-5 py-4 transition hover:bg-slate-50 sm:px-6">
                    <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700"><Icon className="size-4.5" /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-bold text-slate-900">{title}</span>
                      <span className="mt-0.5 block truncate text-xs text-slate-500">{description}</span>
                    </span>
                    <span className="hidden rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-500 sm:inline-flex">{count === null ? "restrito" : count}</span>
                    <span className="text-sm font-black text-brand-600 transition group-hover:translate-x-1">→</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </section>
    </SectionPage>
  );
}
