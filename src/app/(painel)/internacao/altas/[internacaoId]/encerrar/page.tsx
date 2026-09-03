import type { Route } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { DischargeFinalizationForm } from "@/components/internacao/discharge-finalization-form";
import { SectionPage } from "@/components/painel/section-page";
import { getAssistencialContext } from "@/modules/assistencial/context";

type Rel<T> = T | T[] | null;
type Patient = { nome_completo: string | null; ra: string | null };
type Attendance = { id: string; numero_atendimento: number | string | null; paciente: Rel<Patient> };
type Admission = {
  id: string;
  atendimento_id: string;
  status: string;
  setor: string;
  quarto: string | null;
  leito: string | null;
  data_internacao: string;
  atendimento: Rel<Attendance>;
};
type Reason = { codigo: string; display: string };

const one = <T,>(value: Rel<T>): T | null => Array.isArray(value) ? value[0] ?? null : value;
const fmt = (value: string) => new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(value));

export default async function EncerrarInternacaoPage({ params }: { params: Promise<{ internacaoId: string }> }) {
  const { internacaoId } = await params;
  const { supabase, empresaId, unidadeId } = await getAssistencialContext();

  const [{ data: admissionData }, { data: reasonsData }] = await Promise.all([
    supabase
      .from("internacoes")
      .select("id,atendimento_id,status,setor,quarto,leito,data_internacao,atendimento:atendimentos(id,numero_atendimento,paciente:pacientes(nome_completo,ra))")
      .eq("id", internacaoId)
      .eq("empresa_id", empresaId)
      .eq("unidade_id", unidadeId)
      .maybeSingle(),
    supabase
      .from("ans_fhir_dominios_ativos")
      .select("codigo,display,ordem")
      .eq("tabela", 39)
      .not("codigo", "in", "(21,22,23,24,25,26,27,28)")
      .order("ordem"),
  ]);

  const admission = admissionData as Admission | null;
  if (!admission) notFound();
  if (!["internado", "transferido", "aguardando_leito"].includes(admission.status)) redirect(`/internacao/altas/${internacaoId}` as Route);

  const attendance = one(admission.atendimento);
  const patient = one(attendance?.paciente ?? null);
  const reasons = (reasonsData ?? []) as Reason[];

  return <SectionPage
    eyebrow="Internação / Encerramento"
    title={patient?.nome_completo ?? "Encerrar internação"}
    description={`Atendimento / Guia #${attendance?.numero_atendimento ?? "—"} · RA ${patient?.ra ?? "—"}`}
    actions={<div className="flex flex-wrap gap-2"><Link href={`/internacao/altas/${internacaoId}` as Route} className="ui-button-secondary">Voltar à alta</Link><Link href="/internacao/contas" className="ui-button-secondary">Contas da internação</Link></div>}
  >
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Info label="Entrada" value={fmt(admission.data_internacao)} />
      <Info label="Setor" value={admission.setor || "—"} />
      <Info label="Quarto" value={admission.quarto || "—"} />
      <Info label="Leito" value={admission.leito || "—"} />
    </section>

    <section className="his-card mt-5 p-5 sm:p-6">
      <div className="mb-5 border-b border-slate-100 pb-4">
        <p className="text-[10px] font-black uppercase tracking-[.14em] text-slate-400">Confirmação final</p>
        <h2 className="mt-1 text-lg font-black text-slate-950">Motivo e documentos do encerramento</h2>
        <p className="mt-1 text-sm text-slate-600">Selecione o motivo real da saída. Nos casos de óbito, os documentos correspondentes passam a ser obrigatórios.</p>
      </div>
      <DischargeFinalizationForm internacaoId={internacaoId} reasons={reasons} />
    </section>
  </SectionPage>;
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="his-kpi"><p className="text-[10px] font-black uppercase tracking-wide text-slate-400">{label}</p><p className="mt-2 font-black text-slate-900">{value}</p></div>;
}
