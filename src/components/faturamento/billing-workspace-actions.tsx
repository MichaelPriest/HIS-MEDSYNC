"use client";

import { ArrowRight, BadgeDollarSign, Boxes, FilePlus2, Plus, RefreshCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useActionState, useEffect } from "react";
import { EncounterPicker } from "@/components/atendimentos/encounter-picker";
import { BillingModal } from "@/components/faturamento/billing-modal";
import type { BackgroundActionState } from "@/lib/actions/background-action";
import { sincronizarProducaoBackground } from "@/modules/faturamento/producao-background-actions";
import {
  abrirContaFaturamentoBackground,
  criarLoteTissBackground,
  criarNfseLoteBackground,
  criarRecursoGlosaBackground,
  type BillingNavigationData,
} from "@/modules/faturamento/workspace-background-actions";

const initialState: BackgroundActionState<BillingNavigationData> = { status: "idle" };
const simpleInitialState: BackgroundActionState = { status: "idle" };

type Encounter = {
  id: string;
  numero_atendimento: string | number | null;
  data_abertura?: string | null;
  paciente: {
    nome_completo: string;
    cpf?: string | null;
    ra?: string | null;
    numero_registro?: string | number | null;
  };
};

type Convenio = { id: string; nome_fantasia: string; registro_ans: string | null };
type FiscalLot = { id: string; numero_lote: string; competencia: string | null; valor_total: number | null; convenio_nome: string };
type ProductionEncounter = { id: string; numero: string | number; paciente: string; status: string };

function useNavigateOnSuccess(state: BackgroundActionState<BillingNavigationData>) {
  const router = useRouter();
  useEffect(() => {
    if (state.status === "success" && state.data?.redirectTo) router.push(state.data.redirectTo);
  }, [router, state]);
}

function Feedback({ state, pending }: { state: BackgroundActionState<unknown>; pending: boolean }) {
  return <div aria-live="polite" className="min-h-6 text-sm">
    {pending ? <span className="font-semibold text-brand-700">Salvando…</span> : null}
    {!pending && state.status === "error" ? <span className="font-semibold text-rose-700">{state.message}</span> : null}
    {!pending && state.status === "success" ? <span className="font-semibold text-emerald-700">{state.message}</span> : null}
  </div>;
}

export function NewBillingAccountModal({ encounters }: { encounters: Encounter[] }) {
  const [state, action, pending] = useActionState(abrirContaFaturamentoBackground, initialState);
  useNavigateOnSuccess(state);

  return <BillingModal
    title="Abrir conta de faturamento"
    description="Localize o atendimento pelo paciente, RA, CPF, registro ou número do atendimento."
    trigger={<><Plus className="size-4" />Abrir conta</>}
    size="lg"
  >
    <form action={action} className="space-y-5">
      <EncounterPicker encounters={encounters} name="atendimento_id" />
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600"><strong className="block text-slate-900">Conta existente</strong><span className="mt-1 block">O sistema abre a conta já vinculada ao episódio, sem duplicar faturamento.</span></div>
        <div className="rounded-2xl bg-brand-50 p-4 text-sm text-brand-900"><strong className="block">Nova conta</strong><span className="mt-1 block">A competência e a cobertura são fotografadas a partir do atendimento real.</span></div>
      </div>
      <Feedback state={state} pending={pending} />
      <div className="flex justify-end">
        <button disabled={pending} className="ui-button-primary disabled:cursor-not-allowed disabled:opacity-60">
          Abrir workspace <ArrowRight className="size-4" />
        </button>
      </div>
    </form>
  </BillingModal>;
}

export function NewTissBatchModal({ convenios }: { convenios: Convenio[] }) {
  const [state, action, pending] = useActionState(criarLoteTissBackground, initialState);
  useNavigateOnSuccess(state);

  return <BillingModal
    title="Criar lote TISS"
    description="O lote inclui somente guias elegíveis da operadora e competência selecionadas."
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
      </div>
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">A criação continua transacional no banco. Se não houver guias elegíveis, nenhum lote parcial será criado.</div>
      <Feedback state={state} pending={pending} />
      <div className="flex justify-end"><button disabled={pending} className="ui-button-primary disabled:opacity-60">Criar lote <ArrowRight className="size-4" /></button></div>
    </form>
  </BillingModal>;
}

export function GlosaAppealModal({
  glosaId,
  valorGlosado,
}: {
  glosaId: string;
  valorGlosado: number;
}) {
  const [state, action, pending] = useActionState(criarRecursoGlosaBackground, initialState);
  useNavigateOnSuccess(state);

  return <BillingModal
    title="Abrir recurso de glosa"
    description="Informe o valor efetivamente recursado e registre uma justificativa técnica ou administrativa completa."
    trigger={<><BadgeDollarSign className="size-4" />Criar recurso</>}
    triggerClassName="ui-button-primary w-full sm:w-auto"
    size="lg"
  >
    <form action={action} className="space-y-5">
      <input type="hidden" name="glosa_id" value={glosaId} />
      <label className="block space-y-1.5 text-sm font-semibold text-slate-700">
        <span>Valor recursado *</span>
        <input name="valor_recursado" required defaultValue={valorGlosado.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} className="ui-input" inputMode="decimal" />
      </label>
      <label className="block space-y-1.5 text-sm font-semibold text-slate-700">
        <span>Justificativa *</span>
        <textarea name="justificativa" required rows={6} className="ui-input min-h-36 resize-y" placeholder="Descreva o fundamento do recurso, documentos de apoio e divergência identificada..." />
      </label>
      <Feedback state={state} pending={pending} />
      <div className="flex justify-end"><button disabled={pending} className="ui-button-primary disabled:opacity-60">Criar e acompanhar <ArrowRight className="size-4" /></button></div>
    </form>
  </BillingModal>;
}

export function NewNfseModal({ lotes }: { lotes: FiscalLot[] }) {
  const [state, action, pending] = useActionState(criarNfseLoteBackground, initialState);
  useNavigateOnSuccess(state);

  return <BillingModal
    title="Criar rascunho de NFS-e"
    description="Selecione um lote elegível. O RPC fiscal impede duplicidade ativa para o mesmo lote."
    trigger={<><FilePlus2 className="size-4" />Nova NFS-e</>}
    size="lg"
  >
    <form action={action} className="space-y-5">
      <label className="block space-y-1.5 text-sm font-semibold text-slate-700">
        <span>Lote TISS *</span>
        <select name="lote_id" required defaultValue="" className="ui-input">
          <option value="">Selecione o lote</option>
          {lotes.map((lote) => <option key={lote.id} value={lote.id}>{lote.numero_lote} · {lote.convenio_nome} · {lote.competencia ?? "—"} · {Number(lote.valor_total ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</option>)}
        </select>
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-1.5 text-sm font-semibold text-slate-700"><span>Número RPS</span><input name="numero_rps" className="ui-input" /></label>
        <label className="space-y-1.5 text-sm font-semibold text-slate-700"><span>Série RPS</span><input name="serie_rps" className="ui-input" /></label>
        <label className="space-y-1.5 text-sm font-semibold text-slate-700"><span>Alíquota ISS %</span><input name="aliquota_iss" inputMode="decimal" className="ui-input" /></label>
        <label className="space-y-1.5 text-sm font-semibold text-slate-700"><span>Valor ISS</span><input name="valor_iss" inputMode="decimal" defaultValue="0,00" className="ui-input" /></label>
        <label className="space-y-1.5 text-sm font-semibold text-slate-700 sm:col-span-2"><span>Deduções</span><input name="valor_deducoes" inputMode="decimal" defaultValue="0,00" className="ui-input" /></label>
      </div>
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Criar o rascunho não significa emitir a nota. Emissão automática só deve ocorrer quando o conector municipal/nacional estiver homologado.</div>
      <Feedback state={state} pending={pending} />
      <div className="flex justify-end"><button disabled={pending} className="ui-button-primary disabled:opacity-60">Criar rascunho <ArrowRight className="size-4" /></button></div>
    </form>
  </BillingModal>;
}

export function ProductionSyncModal({ atendimentos }: { atendimentos: ProductionEncounter[] }) {
  const [state, action, pending] = useActionState(sincronizarProducaoBackground, simpleInitialState);

  return <BillingModal
    title="Sincronizar produção"
    description="Use apenas como contingência para recuperar um episódio antigo ou repetir a captura idempotente após correção operacional."
    trigger={<><RefreshCcw className="size-4" />Sincronizar produção</>}
    triggerClassName="ui-button-secondary"
    size="lg"
  >
    <form action={action} className="space-y-5">
      <label className="block space-y-1.5 text-sm font-semibold text-slate-700">
        <span>Atendimento *</span>
        <select name="atendimento_id" required defaultValue="" className="ui-input">
          <option value="">Selecione um atendimento</option>
          {atendimentos.map((item) => <option key={item.id} value={item.id}>#{item.numero} · {item.paciente} · {item.status.replaceAll("_", " ")}</option>)}
        </select>
      </label>
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">A sincronização não cria fato clínico fictício. Ela reaplica a captura idempotente sobre eventos já existentes no episódio.</div>
      <Feedback state={state} pending={pending} />
      <div className="flex justify-end"><button disabled={pending} className="ui-button-primary disabled:opacity-60">Sincronizar <RefreshCcw className="size-4" /></button></div>
    </form>
  </BillingModal>;
}
