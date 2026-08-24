import Link from "next/link";
import type { Route } from "next";
import { Activity, Baby, BedDouble, ClipboardCheck, Droplets, FlaskConical, HeartPulse, Pill, Salad, ScanLine, Scissors, ShieldAlert, ShieldCheck, Stethoscope, Syringe, Truck, Wind } from "lucide-react";
import { SectionPage } from "@/components/painel/section-page";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const modules = [
  ["prontuario","Prontuário Clínico","Anamnese, alergias, problemas, CID, SOAP, exame físico, escalas, assinatura e adendos.",Stethoscope,"prontuario_anamneses","/prontuario"],
  ["sae","SAE de Enfermagem","Avaliação, diagnósticos, cuidados, sinais vitais, balanço hídrico, dispositivos, feridas e curativos.",Activity,"sae_avaliacoes","/assistencial/sae"],
  ["medicamentos","Medicamentos / Farmácia","Prescrição segura, conciliação, validação, lote, dispensação, devolução e administração beira-leito.",Pill,"administracoes_medicamentos","/assistencial/medicamentos"],
  ["laboratorio","Laboratório Clínico","Coleta, amostra, cadeia de custódia, resultados, referência, críticos, liberação e assinatura.",FlaskConical,"laboratorio_amostras","/assistencial/laboratorio"],
  ["imagem","Diagnóstico por Imagem","Execução, DICOM/PACS, laudo, assinatura, liberação e retificação.",ScanLine,"imagem_execucoes","/assistencial/imagem"],
  ["internacao","Internação e Leitos","Mapa de leitos, ocupação, transferências, diárias, isolamento, higienização e alta.",BedDouble,"internacoes","/assistencial/internacao"],
  ["urgencia","Urgência / Emergência","ABCDE, classificação, protocolo, procedimentos, reavaliação e destino.",HeartPulse,"emergencia_registros","/assistencial/urgencia"],
  ["centro-cirurgico","Centro Cirúrgico / CME","Cirurgia segura, anestesia, RPA, OPME, salas e esterilização rastreável.",Scissors,"cirurgias","/assistencial/centro-cirurgico"],
  ["nutricao","Nutrição Clínica","Triagem, avaliação, necessidades, dieta e aceitação alimentar.",Salad,"nutricao_avaliacoes","/assistencial/nutricao"],
  ["hemoterapia","Hemoterapia","Solicitação, bolsas, compatibilidade, transfusão, monitorização e reação transfusional.",Droplets,"hemoterapia_solicitacoes","/assistencial/hemoterapia"],
  ["ccih","CCIH","Infecções, multirresistência, isolamento, precauções e vigilância.",ShieldAlert,"ccih_eventos","/assistencial/ccih"],
  ["antimicrobianos","Antimicrobianos","Stewardship, culturas, ajuste renal, restritos e reavaliação em 48–72 h.",Syringe,"antimicrobianos_controle","/assistencial/antimicrobianos"],
  ["uti","UTI / Ventilação","Parâmetros ventilatórios, gasometria, desmame e monitorização intensiva.",Wind,"ventilacao_mecanica","/assistencial/uti"],
  ["multiprofissional","Multiprofissional","Fisioterapia, fono, psicologia, TO, serviço social e demais equipes.",Stethoscope,"evolucoes_multiprofissionais","/assistencial/multiprofissional"],
  ["procedimentos","Procedimentos Assistenciais","Execução multiprofissional estruturada, TUSS, resultado e assinatura.",ClipboardCheck,"procedimentos_assistenciais","/assistencial/procedimentos"],
  ["transportes","Transportes","Transporte interno, externo, inter-hospitalar, oxigênio e monitorização.",Truck,"transportes_pacientes","/assistencial/transportes"],
  ["alta","Transição / Alta","Planejamento multiprofissional, conciliação e sumário de alta assinado.",ClipboardCheck,"sumarios_alta","/assistencial/alta"],
  ["seguranca-paciente","Segurança do Paciente","Near miss, incidentes, dano, ação imediata e análise institucional.",ShieldAlert,"eventos_seguranca_paciente","/assistencial/seguranca-paciente"],
  ["obstetricia","Obstetrícia / Parto","Acompanhamento gestacional, trabalho de parto, parto e intercorrências.",Baby,"obstetricia_registros","/assistencial/obstetricia"],
  ["neonatal","Neonatal","Apgar, reanimação, medidas, profilaxias, aleitamento e destino do RN.",Baby,"neonatal_registros","/assistencial/neonatal"],
  ["obitos","Óbitos","Constatação, causas, documentação, familiares e liberação do corpo.",ShieldCheck,"obitos","/assistencial/obitos"],
] as const;

export default async function AssistencialPage() {
  const supabase = await createClient();
  const counts = await Promise.all(modules.map(async ([slug,,,,table]) => {
    const { count, error } = await supabase.from(table).select("id", { count: "exact", head: true });
    return [slug, error ? null : count ?? 0] as const;
  }));
  const map = new Map(counts);

  return (
    <SectionPage eyebrow="Assistencial" title="Central Assistencial" description="Prontuário unificado e módulos hospitalares integrados ao mesmo paciente e atendimento.">
      <section className="rounded-[24px] bg-[linear-gradient(120deg,#0b1f44_0%,#173273_58%,#2563eb_100%)] p-6 text-white shadow-his-float sm:p-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div><p className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-200/70">Operação clínica integrada</p><h2 className="mt-2 text-2xl font-black tracking-tight">Um episódio assistencial, todas as equipes</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-blue-100/70">Médico, enfermagem, farmácia, diagnóstico, internação e equipes especializadas compartilham atendimento, paciente, rastreabilidade, permissões e histórico clínico.</p></div>
          <div className="rounded-2xl border border-white/10 bg-white/[.07] px-4 py-3 text-xs font-semibold text-cyan-100"><strong className="text-xl text-white">{modules.length}</strong><br/>domínios assistenciais</div>
        </div>
      </section>

      <section className="mt-5 grid gap-4 md:grid-cols-2 2xl:grid-cols-3 ui-stagger">
        {modules.map(([slug,title,description,Icon,,href]) => {
          const count = map.get(slug);
          return <Link key={slug} href={href as Route} className="group his-card relative overflow-hidden p-5 sm:p-6">
            <div className="flex items-start justify-between gap-4"><span className="grid size-12 place-items-center rounded-2xl bg-brand-50 text-brand-700 transition group-hover:bg-brand-100"><Icon className="size-5.5" /></span><span className="rounded-full bg-slate-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-slate-500">{count === null ? "restrito" : `${count} registro${count === 1 ? "" : "s"}`}</span></div>
            <h2 className="mt-5 text-lg font-black text-slate-950">{title}</h2><p className="mt-2 text-sm leading-6 text-slate-500">{description}</p><span className="mt-5 inline-flex text-xs font-black text-brand-600 transition group-hover:translate-x-1">Abrir módulo →</span>
          </Link>;
        })}
      </section>
    </SectionPage>
  );
}
