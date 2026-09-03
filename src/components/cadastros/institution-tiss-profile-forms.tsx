"use client";

import { Save } from "lucide-react";
import { useActionState } from "react";
import type { BackgroundActionState } from "@/lib/actions/background-action";
import {
  salvarCnesUnidadeTiss,
  salvarIdentificacaoTissEmpresa,
  type InstitutionTissProfileData,
} from "@/modules/cadastros/tiss-readiness-background-actions";

const initialState: BackgroundActionState<InstitutionTissProfileData> = { status: "idle" };

function Feedback({ state, pending }: { state: BackgroundActionState<InstitutionTissProfileData>; pending: boolean }) {
  return <div aria-live="polite" className="min-h-5 text-xs font-semibold">{pending ? <span className="text-brand-700">Salvando…</span> : state.status === "error" ? <span className="text-rose-700">{state.message}</span> : state.status === "success" ? <span className="text-emerald-700">{state.message}</span> : null}</div>;
}

export function CompanyTissProfileForm({ cnpj, cnes }: { cnpj: string | null; cnes: string | null }) {
  const [state, action, pending] = useActionState(salvarIdentificacaoTissEmpresa, initialState);
  return <form action={action} className="rounded-2xl border border-slate-200 bg-white p-4">
    <h3 className="font-black text-slate-900">Correção rápida do prestador</h3><p className="mt-1 text-xs text-slate-500">Atualiza somente CNPJ e CNES. Os demais dados institucionais continuam em Configurações → Empresa.</p>
    <div className="mt-3 grid gap-3 sm:grid-cols-2"><label className="space-y-1 text-xs font-semibold text-slate-600"><span>CNPJ *</span><input name="cnpj" inputMode="numeric" defaultValue={cnpj ?? ""} className="ui-input" /></label><label className="space-y-1 text-xs font-semibold text-slate-600"><span>CNES *</span><input name="cnes" inputMode="numeric" maxLength={7} defaultValue={cnes ?? ""} className="ui-input" /></label></div>
    <div className="mt-3"><Feedback state={state} pending={pending} /></div><div className="mt-2 flex justify-end"><button disabled={pending} className="ui-button-primary disabled:opacity-60"><Save className="size-4" />Salvar prestador</button></div>
  </form>;
}

export function UnitTissProfileForm({ unidadeId, nome, cnes }: { unidadeId: string; nome: string; cnes: string | null }) {
  const serverAction = salvarCnesUnidadeTiss.bind(null, unidadeId);
  const [state, action, pending] = useActionState(serverAction, initialState);
  return <form action={action} className="rounded-2xl border border-slate-200 bg-white p-4">
    <h3 className="font-black text-slate-900">CNES da unidade ativa</h3><p className="mt-1 text-xs text-slate-500">{nome}. Informe o CNES real do estabelecimento; a unidade ativa não é inferida a partir da empresa.</p>
    <label className="mt-3 block space-y-1 text-xs font-semibold text-slate-600"><span>CNES *</span><input name="cnes" inputMode="numeric" maxLength={7} defaultValue={cnes ?? ""} className="ui-input" /></label>
    <div className="mt-3"><Feedback state={state} pending={pending} /></div><div className="mt-2 flex justify-end"><button disabled={pending} className="ui-button-primary disabled:opacity-60"><Save className="size-4" />Salvar CNES</button></div>
  </form>;
}
