"use client";

import type { ComponentProps, FormEvent } from "react";
import { useActionState, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CircleAlert, CircleCheck, Loader2, ShieldCheck, TriangleAlert } from "lucide-react";
import { AdmissionForm } from "@/components/atendimentos/admission-form";
import {
  INITIAL_BACKGROUND_ACTION_STATE,
  type BackgroundActionState,
} from "@/lib/actions/background-action";
import { createClient } from "@/lib/supabase/client";

type AdmissionAction = (
  previousState: BackgroundActionState,
  formData: FormData,
) => Promise<BackgroundActionState>;

type Props = Omit<ComponentProps<typeof AdmissionForm>, "action"> & {
  action: AdmissionAction;
};

type ReadinessIssue = {
  codigo: string;
  grupo: string;
  mensagem: string;
};

type AdmissionReadiness = {
  pronto: boolean;
  bloqueios: ReadinessIssue[];
  alertas: ReadinessIssue[];
  total_bloqueios: number;
  total_alertas: number;
};

type ReadinessStatus = "idle" | "checking" | "ready" | "blocked" | "unavailable";

const READINESS_FIELDS = [
  "paciente_id",
  "profissional_id",
  "tipo_atendimento",
  "cobertura",
  "convenio_id",
  "plano_id",
  "numero_carteirinha",
  "validade_carteirinha",
  "numero_autorizacao",
  "senha_autorizacao",
  "paciente_nome",
  "paciente_data_nascimento",
  "paciente_telefone",
  "paciente_endereco",
  "paciente_numero",
  "paciente_bairro",
  "paciente_cidade",
  "paciente_estado",
  "regime_atendimento",
  "tipo_atendimento_tiss",
  "tipo_atendimento_tuss50_codigo",
  "tipo_consulta_tuss52_codigo",
  "codigo_tuss_principal",
  "indicacao_clinica",
  "identificacao_metodo",
] as const;

const FRIENDLY_ACTION_ERRORS: Record<string, string> = {
  "campos-obrigatorios": "Complete os dados obrigatórios do paciente e do atendimento.",
  cobertura: "Revise operadora, plano e os dados da carteirinha.",
  paciente: "O paciente selecionado não está mais disponível para esta admissão.",
  profissional: "Selecione um profissional válido. Para atendimento por convênio, o profissional é obrigatório.",
  "conselho-incompleto": "O cadastro do profissional está incompleto. Corrija conselho, número e UF antes da abertura.",
  "cbo-ausente": "O cadastro do profissional precisa ter a ocupação informada antes da abertura por convênio.",
  "cnes-ausente": "O cadastro da unidade está incompleto para atendimento por convênio.",
  "registro-ans-ausente": "O cadastro da operadora está incompleto para faturamento.",
  "carteira-vencida": "A carteirinha informada está vencida.",
  "validade-carteira": "Este plano exige a validade da carteirinha.",
  "carteirinha-padrao": "A carteirinha não corresponde ao padrão configurado para este plano.",
  tuss: "Selecione um procedimento válido para este atendimento.",
  "indicacao-clinica": "Informe a indicação clínica para este tipo de atendimento.",
  "classificacao-tiss": "Revise a classificação do atendimento antes de concluir a abertura.",
  permissao: "Seu perfil não possui permissão para abrir atendimentos nesta unidade.",
  "senha-invalida": "Esta senha não está mais disponível para admissão.",
  "agendamento-invalido": "Este agendamento não está mais disponível para abertura de atendimento.",
  "agendamento-cirurgico": "Cirurgia eletiva deve seguir pelo fluxo de pré-admissão e Centro Cirúrgico.",
  "identificacao-obrigatoria": "Esta operadora exige identificação do beneficiário antes da abertura.",
  "falha-cadastro": "Não foi possível abrir o atendimento. Revise as pendências indicadas e tente novamente.",
};

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function readinessInput(form: HTMLFormElement) {
  const formData = new FormData(form);
  const payload: Record<string, string | boolean> = {};

  for (const field of READINESS_FIELDS) payload[field] = text(formData, field);

  // A validação preventiva recebe somente presença + método. O token/biometria bruto
  // permanece restrito à transação final, que registra apenas o hash da referência.
  payload.identificacao_informada = Boolean(text(formData, "identificacao_referencia"));

  return { payload, signature: JSON.stringify(payload) };
}

function normalizeReadiness(value: unknown): AdmissionReadiness | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Partial<AdmissionReadiness>;
  return {
    pronto: raw.pronto === true,
    bloqueios: Array.isArray(raw.bloqueios) ? raw.bloqueios : [],
    alertas: Array.isArray(raw.alertas) ? raw.alertas : [],
    total_bloqueios: Number(raw.total_bloqueios ?? 0),
    total_alertas: Number(raw.total_alertas ?? 0),
  };
}

export function AdmissionBackgroundForm({ action, ...props }: Props) {
  const [state, formAction, pending] = useActionState(
    action,
    INITIAL_BACKGROUND_ACTION_STATE,
  );
  const supabase = useMemo(() => createClient(), []);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<number | null>(null);
  const requestRef = useRef(0);
  const checkedSignatureRef = useRef<string | null>(null);
  const [readiness, setReadiness] = useState<AdmissionReadiness | null>(null);
  const [readinessStatus, setReadinessStatus] = useState<ReadinessStatus>("idle");

  const validateCurrent = useCallback(async () => {
    const form = containerRef.current?.querySelector("form");
    if (!(form instanceof HTMLFormElement)) return;

    const { payload, signature } = readinessInput(form);
    const requestId = ++requestRef.current;
    setReadinessStatus("checking");
    const { data, error } = await supabase.rpc("admissao_prontidao", {
      p_unidade_id: props.unidadeId,
      p_payload: payload,
    });
    if (requestId !== requestRef.current) return;

    if (error) {
      checkedSignatureRef.current = null;
      setReadiness(null);
      setReadinessStatus("unavailable");
      return;
    }

    const result = normalizeReadiness(data);
    if (!result) {
      checkedSignatureRef.current = null;
      setReadiness(null);
      setReadinessStatus("unavailable");
      return;
    }

    checkedSignatureRef.current = signature;
    setReadiness(result);
    setReadinessStatus(result.pronto ? "ready" : "blocked");
  }, [props.unidadeId, supabase]);

  const queueCheck = useCallback(() => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    setReadinessStatus("checking");
    debounceRef.current = window.setTimeout(() => void validateCurrent(), 550);
  }, [validateCurrent]);

  useEffect(() => {
    queueCheck();
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
      requestRef.current += 1;
    };
  }, [queueCheck]);

  function preventKnownBlockedSubmit(event: FormEvent<HTMLDivElement>) {
    const form = event.target;
    if (!(form instanceof HTMLFormElement)) return;
    const { signature } = readinessInput(form);
    if (checkedSignatureRef.current === signature && readiness && !readiness.pronto) {
      event.preventDefault();
      event.stopPropagation();
      setReadinessStatus("blocked");
    }
  }

  const actionError = state.status === "error"
    ? FRIENDLY_ACTION_ERRORS[state.code ?? ""] ?? FRIENDLY_ACTION_ERRORS["falha-cadastro"]
    : null;

  return (
    <div className="space-y-3" aria-busy={pending}>
      <div aria-live="polite" aria-atomic="true">
        {pending ? (
          <div className="flex items-center gap-2 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm font-semibold text-brand-900">
            <Loader2 className="size-4 animate-spin" />
            Salvando…
          </div>
        ) : null}
        {!pending && actionError ? (
          <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">
            <CircleAlert className="mt-0.5 size-4 shrink-0" />
            <span>{actionError}</span>
          </div>
        ) : null}
      </div>

      <ReadinessPanel status={readinessStatus} readiness={readiness} />

      <div
        ref={containerRef}
        onInputCapture={queueCheck}
        onChangeCapture={queueCheck}
        onClickCapture={queueCheck}
        onSubmitCapture={preventKnownBlockedSubmit}
        className={pending ? "pointer-events-none opacity-80" : undefined}
      >
        <AdmissionForm action={formAction} {...props} />
      </div>
    </div>
  );
}

function ReadinessPanel({ status, readiness }: { status: ReadinessStatus; readiness: AdmissionReadiness | null }) {
  if (status === "idle" || status === "checking") {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700" aria-live="polite">
        <Loader2 className="size-4 animate-spin text-brand-600" />
        <div><strong>Conferindo a abertura…</strong><p className="mt-0.5 text-xs text-slate-500">Paciente, cobertura, profissional e atendimento são validados antes da gravação.</p></div>
      </div>
    );
  }

  if (status === "unavailable") {
    return (
      <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900" aria-live="polite">
        <TriangleAlert className="mt-0.5 size-4 shrink-0" />
        <div><strong>Conferência preventiva indisponível.</strong><p className="mt-0.5 text-xs text-amber-800">A validação final da abertura continua ativa e nenhuma regra de segurança foi desabilitada.</p></div>
      </div>
    );
  }

  if (status === "ready" && readiness) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900" aria-live="polite">
        <div className="flex items-start gap-3"><CircleCheck className="mt-0.5 size-5 shrink-0" /><div><strong>Pronto para abrir o atendimento.</strong><p className="mt-0.5 text-xs text-emerald-800">Os dados essenciais estão consistentes para seguir no fluxo.</p></div></div>
        {readiness.alertas.length ? <IssueList title={`${readiness.total_alertas} alerta(s) para revisão`} issues={readiness.alertas} tone="amber" /> : null}
      </div>
    );
  }

  if (readiness) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900" aria-live="polite">
        <div className="flex items-start gap-3"><ShieldCheck className="mt-0.5 size-5 shrink-0" /><div><strong>{readiness.total_bloqueios} pendência(s) impedem a abertura.</strong><p className="mt-0.5 text-xs text-rose-800">Corrija os itens abaixo; a conferência será refeita automaticamente.</p></div></div>
        <IssueList title="Corrigir antes de abrir" issues={readiness.bloqueios} tone="rose" />
        {readiness.alertas.length ? <IssueList title="Alertas adicionais" issues={readiness.alertas} tone="amber" /> : null}
      </div>
    );
  }

  return null;
}

function IssueList({ title, issues, tone }: { title: string; issues: ReadinessIssue[]; tone: "rose" | "amber" }) {
  const classes = tone === "rose" ? "border-rose-200 bg-white/70 text-rose-900" : "border-amber-200 bg-amber-50 text-amber-900";
  return (
    <div className={`mt-3 rounded-xl border px-3 py-2 ${classes}`}>
      <p className="text-xs font-black uppercase tracking-wide">{title}</p>
      <ul className="mt-1.5 space-y-1 text-xs">
        {issues.map((issue, index) => <li key={`${issue.codigo}-${index}`}>• {issue.mensagem}</li>)}
      </ul>
    </div>
  );
}
