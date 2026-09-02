import type { Route } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft, ShieldAlert, Waypoints } from "lucide-react";
import { AssumePatientBackgroundForm } from "@/components/fila-medica/assume-patient-background-form";
import { SectionPage } from "@/components/painel/section-page";
import { getAssistencialContext } from "@/modules/assistencial/context";
import { especialidadesCompativeis } from "@/modules/fila-medica/especialidade";

type Rel<T> = T | T[] | null;

type EncaminhamentoPendente = {
  id: string;
  origem: string | null;
  especialidade: string | null;
  profissional_id: string | null;
  status: string;
  prioridade: string | null;
  motivo: string | null;
  created_at: string;
};

function one<T>(rel: Rel<T>): T | null {
  return Array.isArray(rel) ? rel[0] ?? null : rel;
}

function normalizar(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function pontoPadrao(setorAtual: string | null | undefined) {
  const setor = normalizar(setorAtual);
  if (setor.includes("pronto") || setor.includes("urgencia") || setor.includes("emergencia")) return "Pronto-socorro";
  return "Consultório";
}

function fmtData(value: string | null | undefined) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(value));
}

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ProntuarioClinicoClaimLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ atendimentoId: string }>;
}) {
  const { atendimentoId } = await params;
  const { supabase, empresaId, unidadeId } = await getAssistencialContext();

  const [atendimentoRes, profissionalLogadoRes, encaminhamentosRes] = await Promise.all([
    supabase
      .from("atendimentos")
      .select("id,numero_atendimento,status,setor_atual,profissional_id,paciente:pacientes(nome_completo,ra,numero_registro)")
      .eq("id", atendimentoId)
      .eq("empresa_id", empresaId)
      .eq("unidade_id", unidadeId)
      .maybeSingle(),
    supabase.rpc("profissional_logado", { p_empresa: empresaId }),
    supabase
      .from("encaminhamentos_assistenciais")
      .select("id,origem,especialidade,profissional_id,status,prioridade,motivo,created_at")
      .eq("atendimento_id", atendimentoId)
      .eq("empresa_id", empresaId)
      .eq("unidade_id", unidadeId)
      .eq("status", "aguardando_profissional")
      .is("profissional_id", null)
      .order("created_at", { ascending: true })
      .limit(20),
  ]);

  const atendimento = atendimentoRes.data;
  if (!atendimento || atendimento.status === "alta" || atendimento.status === "cancelado") return children;

  const profissionalId = typeof profissionalLogadoRes.data === "string" ? profissionalLogadoRes.data : null;
  const candidatosTriagem = ((encaminhamentosRes.data ?? []) as EncaminhamentoPendente[])
    .filter((item) => normalizar(item.origem) === "triagem");

  if (!candidatosTriagem.length) return children;

  const profissionalRes = profissionalId
    ? await supabase.from("profissionais").select("id,especialidade").eq("id", profissionalId).eq("empresa_id", empresaId).maybeSingle()
    : { data: null };
  const especialidadeProfissional = profissionalRes.data?.especialidade ?? null;

  const encaminhamento = profissionalId
    ? candidatosTriagem.find((item) => especialidadesCompativeis(especialidadeProfissional, item.especialidade))
      ?? (atendimento.profissional_id === profissionalId && candidatosTriagem.length === 1 ? candidatosTriagem[0] : null)
    : candidatosTriagem[0];

  if (!encaminhamento) return children;

  const paciente = one(atendimento.paciente);
  const resumoHref = `/prontuario/${atendimentoId}` as Route;
  const filaHref = "/fila-medica" as Route;

  return (
    <SectionPage
      eyebrow="Assistencial / Prontuário clínico"
      title={paciente?.nome_completo ?? "Paciente"}
      description={`Atendimento #${atendimento.numero_atendimento ?? "—"} · Registro #${paciente?.numero_registro ?? "—"} · ${paciente?.ra ?? "—"}`}
    >
      <div className="mb-4 flex flex-wrap gap-2">
        <Link href={resumoHref} className="btn-secondary"><ArrowLeft className="size-4" />Resumo do atendimento</Link>
        <Link href={filaHref} className="btn-secondary">Abrir fila médica</Link>
      </div>

      <section className="overflow-hidden rounded-2xl border border-amber-200 bg-amber-50/70">
        <div className="flex items-start gap-3 border-b border-amber-200 px-5 py-4">
          <ShieldAlert className="mt-0.5 size-5 shrink-0 text-amber-700" />
          <div>
            <h1 className="font-black text-amber-950">Assuma o atendimento antes de registrar a evolução</h1>
            <p className="mt-1 text-sm leading-6 text-amber-800">
              Este episódio chegou da triagem, mas o encaminhamento médico ainda está sem profissional responsável.
              O prontuário clínico fica protegido contra novos registros até o claim da fila ser concluído.
            </p>
          </div>
        </div>

        <div className="grid gap-4 bg-white/70 p-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-bold text-brand-700">
                {encaminhamento.especialidade ?? "Especialidade não informada"}
              </span>
              <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-800">
                aguardando profissional
              </span>
              {encaminhamento.prioridade ? (
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold capitalize text-slate-700">
                  {encaminhamento.prioridade.replaceAll("_", " ")}
                </span>
              ) : null}
            </div>
            <p className="mt-3 flex items-center gap-2 font-black text-slate-950">
              <Waypoints className="size-4 text-amber-700" />Triagem → {encaminhamento.especialidade ?? "atendimento médico"}
            </p>
            <p className="mt-1 text-sm text-slate-600">
              {encaminhamento.motivo || "Encaminhamento da triagem aguardando início do atendimento médico."}
            </p>
            <p className="mt-2 text-xs text-slate-500">Criado em {fmtData(encaminhamento.created_at)}</p>
          </div>

          {profissionalId ? (
            <AssumePatientBackgroundForm
              encaminhamentoId={encaminhamento.id}
              filaSetor="consultorio"
              pontoPadrao={pontoPadrao(atendimento.setor_atual)}
            />
          ) : (
            <div className="max-w-sm rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
              Seu usuário não está vinculado a um profissional ativo. Abra a fila médica ou solicite a correção do perfil antes de evoluir.
            </div>
          )}
        </div>
      </section>

      <p className="mt-4 text-sm text-slate-500">
        Nenhum encaminhamento é concluído automaticamente. Ao assumir, o sistema mantém a validação de especialidade,
        disputa concorrente, unidade, fila setorial e responsável do atendimento já existente no fluxo médico.
      </p>
    </SectionPage>
  );
}
