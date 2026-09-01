"use client";

import {
  CheckCircle2,
  CircleAlert,
  Loader2,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { useActionState, useEffect, useRef } from "react";
import {
  INITIAL_BACKGROUND_ACTION_STATE,
  type BackgroundActionState,
} from "@/lib/actions/background-action";
import {
  adicionarPendenciaAuditoria,
  executarAuditoriaAutomatica,
  iniciarAuditoria,
  liberarAuditoria,
  reabrirPendenciaAuditoria,
  resolverPendenciaAuditoria,
} from "@/modules/auditoria/actions";

function Feedback({
  state,
  pending,
}: {
  state: BackgroundActionState;
  pending: boolean;
}) {
  return (
    <div aria-live="polite" aria-atomic="true" className="mt-2">
      {pending ? (
        <p className="flex items-center gap-2 text-xs font-semibold text-brand-700">
          <Loader2 className="size-3.5 animate-spin" />
          Salvando…
        </p>
      ) : null}
      {!pending && state.status === "success" ? (
        <p className="flex items-start gap-2 text-xs font-semibold text-emerald-700">
          <CheckCircle2 className="mt-0.5 size-3.5 shrink-0" />
          <span>{state.message ?? "Operação concluída."}</span>
        </p>
      ) : null}
      {!pending && state.status === "error" ? (
        <p className="flex items-start gap-2 text-xs font-semibold text-rose-700">
          <CircleAlert className="mt-0.5 size-3.5 shrink-0" />
          <span>
            {state.message ?? "Não foi possível concluir a operação."}
            {state.detail ? ` ${state.detail}` : ""}
          </span>
        </p>
      ) : null}
    </div>
  );
}

export function ExecutarAuditoriaButton({ auditoriaId }: { auditoriaId: string }) {
  const [state, action, pending] = useActionState(
    executarAuditoriaAutomatica,
    INITIAL_BACKGROUND_ACTION_STATE,
  );

  return (
    <form action={action}>
      <input type="hidden" name="auditoria_id" value={auditoriaId} />
      <button className="ui-button-secondary" disabled={pending}>
        {pending ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
        {pending ? "Executando…" : "Executar auditoria automática"}
      </button>
      <Feedback state={state} pending={pending} />
    </form>
  );
}

export function IniciarAuditoriaButton({ auditoriaId }: { auditoriaId: string }) {
  const [state, action, pending] = useActionState(
    iniciarAuditoria,
    INITIAL_BACKGROUND_ACTION_STATE,
  );

  return (
    <form action={action}>
      <input type="hidden" name="auditoria_id" value={auditoriaId} />
      <button className="ui-button-secondary w-full" disabled={pending}>
        {pending ? "Salvando…" : "Iniciar auditoria"}
      </button>
      <Feedback state={state} pending={pending} />
    </form>
  );
}

export function ResolverPendenciaForm({ itemId }: { itemId: string }) {
  const [state, action, pending] = useActionState(
    resolverPendenciaAuditoria,
    INITIAL_BACKGROUND_ACTION_STATE,
  );

  return (
    <form action={action} className="mt-3">
      <input type="hidden" name="item_id" value={itemId} />
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          name="resolucao"
          className="ui-input flex-1"
          placeholder="Descreva como a pendência foi tratada"
        />
        <button className="ui-button-secondary" disabled={pending}>
          {pending ? "Salvando…" : "Marcar como resolvida"}
        </button>
      </div>
      <Feedback state={state} pending={pending} />
    </form>
  );
}

export function ReabrirPendenciaButton({ itemId }: { itemId: string }) {
  const [state, action, pending] = useActionState(
    reabrirPendenciaAuditoria,
    INITIAL_BACKGROUND_ACTION_STATE,
  );

  return (
    <form action={action} className="mt-3">
      <input type="hidden" name="item_id" value={itemId} />
      <button className="ui-button-secondary" disabled={pending}>
        {pending ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
        {pending ? "Salvando…" : "Reabrir pendência manual"}
      </button>
      <Feedback state={state} pending={pending} />
    </form>
  );
}

export function AdicionarPendenciaForm({ auditoriaId }: { auditoriaId: string }) {
  const [state, action, pending] = useActionState(
    adicionarPendenciaAuditoria,
    INITIAL_BACKGROUND_ACTION_STATE,
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.status === "success") formRef.current?.reset();
  }, [state.status]);

  return (
    <form
      ref={formRef}
      action={action}
      className="grid gap-2 rounded-xl border border-slate-200 p-3"
    >
      <input type="hidden" name="auditoria_id" value={auditoriaId} />
      <div className="grid grid-cols-2 gap-2">
        <select name="severidade" className="ui-input" defaultValue="alerta">
          <option value="alerta">Alerta</option>
          <option value="erro">Erro</option>
          <option value="bloqueio">Bloqueio</option>
        </select>
        <input name="categoria" placeholder="Categoria" className="ui-input" />
      </div>
      <input
        name="descricao"
        required
        placeholder="Descreva a pendência manual"
        className="ui-input"
      />
      <button className="ui-button-secondary" disabled={pending}>
        {pending ? "Salvando…" : "Adicionar pendência"}
      </button>
      <Feedback state={state} pending={pending} />
    </form>
  );
}

export function LiberarAuditoriaForm({
  auditoriaId,
  impeditivasNaUltimaVerificacao,
}: {
  auditoriaId: string;
  impeditivasNaUltimaVerificacao: number;
}) {
  const [state, action, pending] = useActionState(
    liberarAuditoria,
    INITIAL_BACKGROUND_ACTION_STATE,
  );

  return (
    <form
      action={action}
      className="grid gap-2 rounded-xl border border-brand-100 bg-brand-50/50 p-3"
    >
      <input type="hidden" name="auditoria_id" value={auditoriaId} />
      <textarea
        name="observacoes"
        rows={2}
        className="ui-input"
        placeholder="Observações finais"
      />
      <button className="ui-button-primary" disabled={pending}>
        {pending ? "Revalidando…" : "Revalidar e liberar para Contas Médicas"}
      </button>
      {impeditivasNaUltimaVerificacao ? (
        <p className="text-xs font-semibold text-rose-700">
          Há {impeditivasNaUltimaVerificacao} pendência(s) impeditiva(s) na última verificação.
          A liberação executa o motor novamente e só prossegue se não houver bloqueio atual.
        </p>
      ) : (
        <p className="text-xs font-semibold text-emerald-700">
          A auditoria será reexecutada no banco antes da liberação.
        </p>
      )}
      <Feedback state={state} pending={pending} />
    </form>
  );
}
