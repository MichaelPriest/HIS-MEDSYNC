"use client";

import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useActionState, useEffect } from "react";
import { KeyRound } from "lucide-react";
import type { BackgroundActionState } from "@/lib/actions/background-action";
import { atualizarAutorizacao, registrarIdentificacaoAutorizacao } from "@/modules/autorizacoes/actions";

type StateData = { redirectTo?: string };
const INITIAL_STATE: BackgroundActionState<StateData> = { status: "idle" };

function InlineState({ state }: { state: BackgroundActionState<StateData> }) {
  return (
    <div aria-live="polite" className="min-h-5 text-xs">
      {state.status === "error" ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-rose-700">
          <p className="font-semibold">{state.message}</p>
          {state.detail ? <p className="mt-1">{state.detail}</p> : null}
        </div>
      ) : null}
      {state.status === "success" ? (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 font-semibold text-emerald-700">{state.message}</p>
      ) : null}
    </div>
  );
}

export function AuthorizationIdentificationBackgroundForm({
  autorizacaoId,
  metodoConfigurado,
  placeholder,
}: {
  autorizacaoId: string;
  metodoConfigurado: string;
  placeholder: string;
}) {
  const [state, formAction, pending] = useActionState(registrarIdentificacaoAutorizacao, INITIAL_STATE);

  return (
    <form action={formAction} className="grid w-full gap-2 md:grid-cols-[180px_1fr_auto] xl:max-w-3xl">
      <input type="hidden" name="autorizacao_id" value={autorizacaoId} />
      <select name="metodo" className="ui-input" defaultValue={metodoConfigurado === "token" ? "token" : "biometria_digital"}>
        {metodoConfigurado !== "token" ? <option value="biometria_digital">Biometria digital</option> : null}
        {metodoConfigurado !== "biometria_digital" ? <option value="token">Token</option> : null}
      </select>
      <div className="relative">
        <KeyRound className="pointer-events-none absolute left-3 top-3 size-4 text-slate-400" />
        <input name="referencia" type="password" required autoComplete="off" className="ui-input pl-9" placeholder={placeholder} />
      </div>
      <button disabled={pending} className="ui-button-primary disabled:cursor-wait disabled:opacity-70">
        {pending ? "Salvando…" : "Validar identificação"}
      </button>
      <div className="md:col-span-3"><InlineState state={state} /></div>
    </form>
  );
}

export function AuthorizationUpdateBackgroundForm({
  autorizacaoId,
  numeroGuiaPrestador,
  numeroGuiaOperadora,
  senhaAutorizacao,
  validade,
  status,
  observacao,
}: {
  autorizacaoId: string;
  numeroGuiaPrestador: string;
  numeroGuiaOperadora: string;
  senhaAutorizacao: string;
  validade: string;
  status: string;
  observacao: string;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(atualizarAutorizacao, INITIAL_STATE);

  useEffect(() => {
    if (state.status === "success" && state.data?.redirectTo) {
      router.push(state.data.redirectTo as Route);
    }
  }, [router, state]);

  return (
    <form action={formAction} className="border-t border-slate-100 bg-slate-50/35 p-5">
      <input type="hidden" name="autorizacao_id" value={autorizacaoId} />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <label className="space-y-2 text-sm font-medium text-slate-700"><span>Guia prestador</span><input name="numero_guia_prestador" defaultValue={numeroGuiaPrestador} className="ui-input" /></label>
        <label className="space-y-2 text-sm font-medium text-slate-700"><span>Guia operadora</span><input name="numero_guia_operadora" defaultValue={numeroGuiaOperadora} className="ui-input" /></label>
        <label className="space-y-2 text-sm font-medium text-slate-700"><span>Senha</span><input name="senha_autorizacao" defaultValue={senhaAutorizacao} className="ui-input" /></label>
        <label className="space-y-2 text-sm font-medium text-slate-700"><span>Validade</span><input name="validade" type="date" defaultValue={validade} className="ui-input" /></label>
        <label className="space-y-2 text-sm font-medium text-slate-700"><span>Status</span><select name="status" defaultValue={status} className="ui-input"><option value="pendente">Pendente</option><option value="solicitada">Solicitada</option><option value="autorizada">Autorizada</option><option value="negada">Negada</option><option value="dispensada">Dispensada</option></select></label>
        <label className="space-y-2 text-sm font-medium text-slate-700 md:col-span-2 xl:col-span-3"><span>Observação</span><input name="observacao" defaultValue={observacao} className="ui-input" /></label>
      </div>
      <div className="mt-4"><InlineState state={state} /></div>
      <div className="mt-5 flex justify-end border-t border-slate-200 pt-4">
        <button disabled={pending} className="ui-button-primary disabled:cursor-wait disabled:opacity-70">{pending ? "Salvando…" : "Salvar e encaminhar"}</button>
      </div>
    </form>
  );
}
