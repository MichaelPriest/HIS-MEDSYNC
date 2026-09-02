"use client";

import { BadgeDollarSign, FileCode2, Send, ShieldCheck, Upload, WalletCards } from "lucide-react";
import { useActionState } from "react";
import { BillingModal } from "@/components/faturamento/billing-modal";
import type { BackgroundActionState } from "@/lib/actions/background-action";
import {
  gerarXmlPreliminarTissBackground,
  importarXmlManualTissBackground,
  registrarEnvioManualTissBackground,
  registrarGlosaTissBackground,
  registrarProtocoloTissBackground,
  validarXmlLoteTissBackground,
  type TissLotActionData,
} from "@/modules/tiss/lote-background-actions";

const initialState: BackgroundActionState<TissLotActionData> = { status: "idle" };

type Protocol = { id: string; numero_protocolo: string };
type Guide = { id: string; numero_guia_prestador: string };
type ValidatedXml = { id: string; tipo_mensagem: string; versao_comunicacao: string };

function Feedback({ state, pending }: { state: BackgroundActionState<TissLotActionData>; pending: boolean }) {
  return <div aria-live="polite" className="min-h-6 text-xs font-semibold">
    {pending ? <span className="text-brand-700">Salvando…</span> : null}
    {!pending && state.status === "error" ? <span className="text-rose-700">{state.message}</span> : null}
    {!pending && state.status === "success" ? <span className="text-emerald-700">{state.message}</span> : null}
  </div>;
}

export function TissPreliminaryXmlForm({ loteId }: { loteId: string }) {
  const action = gerarXmlPreliminarTissBackground.bind(null, loteId);
  const [state, formAction, pending] = useActionState(action, initialState);
  return <form action={formAction} className="space-y-1">
    <button disabled={pending} className="ui-button-secondary disabled:opacity-60"><FileCode2 className="size-4" />Gerar artefato preliminar</button>
    <Feedback state={state} pending={pending} />
  </form>;
}

export function TissXmlXsdValidationForm({ loteId, xmlId }: { loteId: string; xmlId: string }) {
  const action = validarXmlLoteTissBackground.bind(null, loteId, xmlId);
  const [state, formAction, pending] = useActionState(action, initialState);

  return <form action={formAction} className="space-y-1">
    <button disabled={pending} className="ui-button-secondary disabled:cursor-not-allowed disabled:opacity-60">
      <ShieldCheck className="size-4" />Validar XSD ANS
    </button>
    <Feedback state={state} pending={pending} />
  </form>;
}

export function TissManualSendModal({ loteId, xmls }: { loteId: string; xmls: ValidatedXml[] }) {
  const action = registrarEnvioManualTissBackground.bind(null, loteId);
  const [state, formAction, pending] = useActionState(action, initialState);
  return <BillingModal
    title="Registrar envio manual"
    description="Use somente após enviar externamente um XML já validado pelo XSD oficial aplicável."
    trigger={<><Send className="size-4" />Registrar envio</>}
    triggerClassName="ui-button-secondary"
    size="lg"
  >
    <form action={formAction} className="space-y-4">
      <label className="block space-y-1.5 text-sm font-semibold text-slate-700"><span>XML validado *</span><select name="xml_id" defaultValue="" required className="ui-input"><option value="">Selecione o XML</option>{xmls.map((xml)=><option key={xml.id} value={xml.id}>{xml.tipo_mensagem} · {xml.versao_comunicacao}</option>)}</select></label>
      <input name="protocolo_externo" className="ui-input" placeholder="Protocolo/comprovante externo" />
      <textarea name="observacoes" rows={3} className="ui-input" placeholder="Ex.: enviado pelo portal da operadora" />
      <Feedback state={state} pending={pending} />
      <button disabled={pending || !xmls.length} className="ui-button-primary w-full disabled:opacity-50">Registrar envio manual</button>
    </form>
  </BillingModal>;
}

export function TissManualImportModal({ loteId }: { loteId: string }) {
  const action = importarXmlManualTissBackground.bind(null, loteId);
  const [state, formAction, pending] = useActionState(action, initialState);
  return <BillingModal
    title="Importar XML da operadora"
    description="O arquivo é validado no servidor contra o XSD ANS 04.03.00. Mesmo inválido, permanece registrado com a trilha de erros para correção e auditoria."
    trigger={<><Upload className="size-4" />Importar XML</>}
    triggerClassName="ui-button-secondary"
    size="lg"
  >
    <form action={formAction} className="space-y-4">
      <select name="tipo_documento" defaultValue="retorno_operadora" className="ui-input"><option value="retorno_operadora">Retorno da operadora</option><option value="protocolo_recebimento">Protocolo de recebimento</option><option value="demonstrativo_analise_conta">Demonstrativo de análise de conta</option><option value="demonstrativo_pagamento">Demonstrativo de pagamento</option><option value="recurso_glosa_retorno">Retorno de recurso de glosa</option><option value="outro">Outro XML TISS</option></select>
      <input type="file" name="arquivo_xml" accept=".xml,application/xml,text/xml" required className="ui-input" />
      <input name="protocolo_externo" className="ui-input" placeholder="Protocolo relacionado (opcional)" />
      <textarea name="observacoes" rows={3} className="ui-input" placeholder="Observações da importação" />
      <Feedback state={state} pending={pending} />
      <button disabled={pending} className="ui-button-primary w-full disabled:opacity-60"><Upload className="size-4" />Importar e validar XML</button>
    </form>
  </BillingModal>;
}

export function TissProtocolModal({ loteId }: { loteId: string }) {
  const action = registrarProtocoloTissBackground.bind(null, loteId);
  const [state, formAction, pending] = useActionState(action, initialState);
  return <BillingModal
    title="Registrar protocolo / retorno"
    description="Registre o retorno financeiro da operadora sem sair do lote."
    trigger={<><WalletCards className="size-4" />Novo protocolo</>}
    size="lg"
  >
    <form action={formAction} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <input name="numero_protocolo" required placeholder="Número do protocolo" className="ui-input" />
        <input name="data_protocolo" type="date" className="ui-input" />
        <select name="status" defaultValue="recebido" className="ui-input"><option value="recebido">Recebido</option><option value="em_analise">Em análise</option><option value="processado">Processado</option><option value="rejeitado">Rejeitado</option><option value="pago_parcial">Pago parcial</option><option value="pago">Pago</option></select>
        <input name="valor_apresentado" placeholder="Valor apresentado" className="ui-input" inputMode="decimal" />
        <input name="valor_processado" placeholder="Valor processado" className="ui-input" inputMode="decimal" />
        <input name="valor_liberado" placeholder="Valor liberado" className="ui-input" inputMode="decimal" />
        <input name="valor_glosa" placeholder="Valor glosa" className="ui-input" inputMode="decimal" />
        <textarea name="observacoes" rows={3} placeholder="Observações" className="ui-input sm:col-span-2" />
      </div>
      <Feedback state={state} pending={pending} />
      <button disabled={pending} className="ui-button-primary w-full disabled:opacity-60">Salvar protocolo</button>
    </form>
  </BillingModal>;
}

export function TissDenialModal({ loteId, protocolos, guias }: { loteId: string; protocolos: Protocol[]; guias: Guide[] }) {
  const action = registrarGlosaTissBackground.bind(null, loteId);
  const [state, formAction, pending] = useActionState(action, initialState);
  return <BillingModal
    title="Registrar glosa"
    description="Vincule o motivo e o valor à guia e ao protocolo quando conhecidos."
    trigger={<><BadgeDollarSign className="size-4" />Registrar glosa</>}
    size="lg"
  >
    <form action={formAction} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <select name="protocolo_id" defaultValue="" className="ui-input"><option value="">Sem protocolo específico</option>{protocolos.map((item)=><option key={item.id} value={item.id}>{item.numero_protocolo}</option>)}</select>
        <select name="guia_id" defaultValue="" className="ui-input"><option value="">Selecione a guia</option>{guias.map((item)=><option key={item.id} value={item.id}>{item.numero_guia_prestador}</option>)}</select>
        <input name="codigo_glosa" required placeholder="Código da glosa" className="ui-input" />
        <input name="valor_glosado" required placeholder="Valor glosado" className="ui-input" inputMode="decimal" />
        <textarea name="descricao_glosa" rows={4} placeholder="Descrição/motivo" className="ui-input sm:col-span-2" />
      </div>
      <Feedback state={state} pending={pending} />
      <button disabled={pending} className="ui-button-primary w-full disabled:opacity-60">Registrar glosa</button>
    </form>
  </BillingModal>;
}
