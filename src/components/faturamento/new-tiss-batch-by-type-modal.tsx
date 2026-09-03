"use client";

import type { Route } from "next";
import { ArrowRight, Boxes } from "lucide-react";
import { useRouter } from "next/navigation";
import { useActionState, useEffect } from "react";
import { BillingModal } from "@/components/faturamento/billing-modal";
import type { BackgroundActionState } from "@/lib/actions/background-action";
import {
  criarLoteTissPorTipoBackground,
  type BillingType,
  type TissBatchByTypeData,
} from "@/modules/faturamento/lote-tipo-background-actions";

type Convenio = { id: string; nome_fantasia: string; registro_ans: string | null };

const initialState: BackgroundActionState<TissBatchByTypeData> = { status: "idle" };
const TYPES: { value: BillingType; label: string; detail: string }[] = [
  { value: "pronto_atendimento", label: "Pronto Atendimento", detail: "Urgência, emergência e demanda espontânea do PS." },
  { value: "ambulatorio", label: "Ambulatório", detail: "Consultas, terapias e procedimentos eletivos ambulatoriais." },
  { value: "internacao", label: "Internação", detail: "Contas vinculadas a episódio com internação hospitalar." },
  { value: "sadt", label: "SADT", detail: "Laboratório, imagem e exames eletivos fora do PS e da internação." },
];

export function NewTissBatchByTypeModal({ convenios }: { convenios: Convenio[] }) {
  const router = useRouter();
  const [state, action, pending] = useActionState(criarLoteTissPorTipoBackground, initialState);

  useEffect(() => {
    if (state.status === "success" && state.data?.redirectTo) router.push(state.data.redirectTo as Route);
  }, [router, state]);

  return <BillingModal
    title="Criar lote TISS por tipo de atendimento"
    description="A operadora e a competência são separadas também pela natureza faturável. O banco bloqueia qualquer mistura entre PA, Ambulatório, Internação e SADT."
    trigger={<><Boxes className="size-4" />Novo lote</>}
    size="lg"
  >
    <form action={action} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-1.5 text-sm font-semibold text-slate-700 sm:col-span-2">
          <span>Convênio *</span>
          <select name="convenio_id" required defaultValue="" className="ui-input">
            <option value="">Selecione a operadora</option>
            {convenios.map((convenio) => <option key={convenio.id} value={convenio.id}>{convenio.nome_fantasia} · ANS {convenio.registro_ans || "—"}</option>)}
          </select>
        </label>
        <label className="space-y-1.5 text-sm font-semibold text-slate-700"><span>Competência *</span><input name="competencia" required type="month" className="ui-input" /></label>
        <label className="space-y-1.5 text-sm font-semibold text-slate-700"><span>Previsão de pagamento</span><input name="previsao_pagamento" type="date" className="ui-input" /></label>
        <label className="space-y-1.5 text-sm font-semibold text-slate-700 sm:col-span-2">
          <span>Tipo de atendimento faturável *</span>
          <select name="tipo_atendimento_faturamento" required defaultValue="" className="ui-input">
            <option value="">Selecione a natureza do lote</option>
            {TYPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </label>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {TYPES.map((item) => <div key={item.value} className="rounded-xl border border-slate-200 bg-slate-50 p-3"><strong className="text-xs text-slate-900">{item.label}</strong><p className="mt-1 text-[11px] leading-5 text-slate-600">{item.detail}</p></div>)}
      </div>

      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Uma execução cria apenas um lote de uma natureza. Se existirem contas de outro tipo na mesma operadora e competência, gere outro lote separado.</div>
      <div aria-live="polite" className="min-h-6 text-sm">
        {pending ? <span className="font-semibold text-brand-700">Criando lote…</span> : null}
        {!pending && state.status === "error" ? <span className="font-semibold text-rose-700">{state.message}</span> : null}
        {!pending && state.status === "success" ? <span className="font-semibold text-emerald-700">{state.message}</span> : null}
      </div>
      <div className="flex justify-end"><button disabled={pending} className="ui-button-primary disabled:opacity-60">Criar lote separado <ArrowRight className="size-4" /></button></div>
    </form>
  </BillingModal>;
}
