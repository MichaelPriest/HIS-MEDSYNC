import Link from "next/link";
import type { Route } from "next";
import { Activity, BedDouble, Droplets, FlaskConical, HeartPulse, Pill, Salad, ScanLine, Scissors, ShieldCheck, Stethoscope } from "lucide-react";
import { SectionPage } from "@/components/painel/section-page";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const MODULOS = [
  { slug: "prontuario", titulo: "Prontuário Clínico", descricao: "Anamnese, alergias, problemas, CID, SOAP, exame físico, escalas, conduta e assinatura.", Icon: Stethoscope, href: "/prontuario" as Route, table: "prontuario_anamneses" },
  { slug: "sae", titulo: "SAE de Enfermagem", descricao: "Histórico, diagnósticos, prescrição de cuidados e checagens de enfermagem.", Icon: Activity, href: "/assistencial/sae" as Route, table: "sae_avaliacoes" },
  { slug: "medicamentos", titulo: "Medicamentos", descricao: "Prescrição hospitalar, dispensação, devolução, administração e checagem beira-leito.", Icon: Pill, href: "/assistencial/medicamentos" as Route, table: "prescricao_checagens" },
  { slug: "laboratorio", titulo: "Laboratório", descricao: "Solicitação, coleta, amostra, resultados, referência, liberação e assinatura.", Icon: FlaskConical, href: "/assistencial/laboratorio" as Route, table: "laboratorio_amostras" },
  { slug: "imagem", titulo: "Diagnóstico por Imagem", descricao: "Solicitação, execução, controle de sala/equipamento, laudo e liberação.", Icon: ScanLine, href: "/assistencial/imagem" as Route, table: "imagem_execucoes" },
  { slug: "internacao", titulo: "Internação e Leitos", descricao: "Mapa de leitos, transferências, diárias, isolamento e alta hospitalar.", Icon: BedDouble, href: "/assistencial/internacao" as Route, table: "leitos" },
  { slug: "urgencia", titulo: "Urgência / Emergência", descricao: "Classificação, ABCDE, protocolos, reavaliação, procedimentos e destino.", Icon: HeartPulse, href: "/assistencial/urgencia" as Route, table: "emergencia_registros" },
  { slug: "centro-cirurgico", titulo: "Centro Cirúrgico", descricao: "Cirurgia, anestesia, RPA, cirurgia segura, OPME e CME.", Icon: Scissors, href: "/assistencial/centro-cirurgico" as Route, table: "cirurgias" },
  { slug: "nutricao", titulo: "Nutrição", descricao: "Triagem nutricional, avaliação, necessidades e dietas hospitalares.", Icon: Salad, href: "/assistencial/nutricao" as Route, table: "nutricao_avaliacoes" },
  { slug: "hemoterapia", titulo: "Banco de Sangue / Hemoterapia", descricao: "Solicitação, compatibilidade, dupla checagem e transfusão de hemocomponentes.", Icon: Droplets, href: "/assistencial/hemoterapia" as Route, table: "hemoterapia_solicitacoes" },
] as const;

export default async function AssistencialPage() {
  const supabase = await createClient();
  const contagens = await Promise.all(MODULOS.map(async (modulo) => {
    const { count, error } = await supabase.from(modulo.table).select("id", { count: "exact", head: true });
    return { slug: modulo.slug, count: error ? null : count ?? 0 };
  }));
  const mapa = new Map(contagens.map((item) => [item.slug, item.count]));

  return <SectionPage eyebrow="Assistencial" title="Central Assistencial" description="Centro operacional dos módulos clínicos e hospitalares integrados ao atendimento, paciente, profissional e unidade.">
    <section className="rounded-[22px] border border-brand-100 bg-[linear-gradient(120deg,#eef6ff_0%,#f8fbff_60%,#ecfeff_100%)] p-5 sm:p-6">
      <div className="flex items-start gap-4"><span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-brand-900 text-white"><ShieldCheck className="size-6"/></span><div><p className="his-eyebrow">Prontuário unificado</p><h2 className="mt-1 text-xl font-black text-slate-950">Um único episódio assistencial, múltiplas equipes</h2><p className="mt-2 max-w-4xl text-sm leading-6 text-slate-600">Os módulos abaixo compartilham o mesmo atendimento e paciente. As informações clínicas não ficam isoladas por setor e podem alimentar auditoria, contas médicas e faturamento posteriormente.</p></div></div>
    </section>

    <section className="mt-5 grid gap-4 md:grid-cols-2 2xl:grid-cols-3 ui-stagger">
      {MODULOS.map(({ slug, titulo, descricao, Icon, href }) => {
        const total = mapa.get(slug);
        return <Link key={slug} href={href} className="group his-card relative overflow-hidden p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4"><span className="grid size-12 place-items-center rounded-2xl bg-brand-50 text-brand-700 transition group-hover:bg-brand-100"><Icon className="size-5.5"/></span><span className="rounded-full bg-slate-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-slate-500">{total === null ? "Acesso restrito" : `${total} registro${total === 1 ? "" : "s"}`}</span></div>
          <h2 className="mt-5 text-lg font-black text-slate-950">{titulo}</h2><p className="mt-2 text-sm leading-6 text-slate-500">{descricao}</p><span className="mt-5 inline-flex text-xs font-black text-brand-600 transition group-hover:translate-x-1">Abrir módulo →</span>
        </Link>;
      })}
    </section>
  </SectionPage>;
}
