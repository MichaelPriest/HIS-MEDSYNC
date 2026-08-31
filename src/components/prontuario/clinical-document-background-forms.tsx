"use client";

import Link from "next/link";
import type { Route } from "next";
import { useActionState } from "react";
import type { BackgroundActionState } from "@/lib/actions/background-action";
import { emitirDocumentoClinicoAction } from "@/modules/prontuario-medico/documentos-actions";

type DocumentoData = { documentoId?: string; href?: string };
type DocumentoState = BackgroundActionState<DocumentoData>;
const INITIAL_STATE: DocumentoState = { status: "idle" };

function Feedback({ state }: { state: DocumentoState }) {
  return (
    <div aria-live="polite" className="min-h-6 text-sm">
      {state.status === "error" ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-rose-700">
          <p className="font-semibold">{state.message}</p>
          {state.detail ? <p className="mt-1 text-xs">{state.detail}</p> : null}
        </div>
      ) : null}
      {state.status === "success" ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-700">
          <p className="font-semibold">{state.message}</p>
          {state.data?.href ? <Link href={state.data.href as Route} className="text-xs font-black underline">Visualizar / imprimir</Link> : null}
        </div>
      ) : null}
    </div>
  );
}

export function RecipeDocumentBackgroundForm({
  atendimentoId,
  podeAssinar,
}: {
  atendimentoId: string;
  podeAssinar: boolean;
}) {
  const [state, formAction, pending] = useActionState(emitirDocumentoClinicoAction, INITIAL_STATE);

  return (
    <form action={formAction} className="mt-5 space-y-4">
      <input type="hidden" name="atendimento_id" value={atendimentoId} />
      <label className="block">
        <span className="mb-1.5 block text-sm font-bold text-slate-700">Tipo de receituário</span>
        <select name="tipo_documento" className="ui-input" defaultValue="receituario_comum">
          <option value="receituario_comum">Receituário comum</option>
          <option value="controle_especial">Receita de Controle Especial</option>
          <option value="b1_azul">Notificação B1 — registro</option>
        </select>
      </label>
      <label className="block">
        <span className="mb-1.5 block text-sm font-bold text-slate-700">Número da notificação B1 <span className="font-normal text-slate-400">(quando aplicável)</span></span>
        <input name="numero_notificacao" className="ui-input" maxLength={80} placeholder="Informe o identificador da notificação" />
      </label>
      <label className="block">
        <span className="mb-1.5 block text-sm font-bold text-slate-700">Itens prescritos</span>
        <textarea name="itens_texto" rows={9} className="ui-input" placeholder={"Um item por linha. Exemplo:\nDipirona 500 mg — tomar 1 comprimido VO a cada 6 horas se dor, por 3 dias\nSoro fisiológico 0,9% — uso conforme orientação"} required />
      </label>
      <label className="block">
        <span className="mb-1.5 block text-sm font-bold text-slate-700">Observações</span>
        <textarea name="observacoes" rows={2} className="ui-input" placeholder="Observações adicionais do documento" />
      </label>
      <div className="rounded-xl border border-sky-200 bg-sky-50 p-3 text-xs text-sky-800"><b>Controle especial:</b> o HIS registra o documento e seu identificador informado. Isso não substitui numeração, talonário, validação ou exigências regulatórias externas aplicáveis.</div>
      <Feedback state={state} />
      <div className="flex flex-wrap justify-end gap-2">
        <button disabled={pending} name="acao" value="salvar" className="ui-button-secondary disabled:cursor-wait disabled:opacity-70">{pending ? "Salvando…" : "Salvar rascunho"}</button>
        {podeAssinar ? <button disabled={pending} name="acao" value="assinar" className="ui-button-primary disabled:cursor-wait disabled:opacity-70">{pending ? "Salvando…" : "Salvar e assinar"}</button> : null}
      </div>
    </form>
  );
}

export function GuidanceDocumentBackgroundForm({
  atendimentoId,
  podeAssinar,
}: {
  atendimentoId: string;
  podeAssinar: boolean;
}) {
  const [state, formAction, pending] = useActionState(emitirDocumentoClinicoAction, INITIAL_STATE);

  return (
    <form action={formAction} className="mt-5 space-y-4">
      <input type="hidden" name="atendimento_id" value={atendimentoId} />
      <input type="hidden" name="tipo_documento" value="orientacao_nao_medicamentosa" />
      <label className="block">
        <span className="mb-1.5 block text-sm font-bold text-slate-700">Orientações ao paciente / responsável</span>
        <textarea name="orientacoes" rows={12} className="ui-input" required placeholder={"Ex.: hidratação, repouso, cuidados com curativo, sinais de alerta, retorno em caso de piora, acompanhamento ambulatorial..."} />
      </label>
      <label className="block">
        <span className="mb-1.5 block text-sm font-bold text-slate-700">Observações internas</span>
        <textarea name="observacoes" rows={2} className="ui-input" placeholder="Observações adicionais" />
      </label>
      <Feedback state={state} />
      <div className="flex flex-wrap justify-end gap-2">
        <button disabled={pending} name="acao" value="salvar" className="ui-button-secondary disabled:cursor-wait disabled:opacity-70">{pending ? "Salvando…" : "Salvar rascunho"}</button>
        {podeAssinar ? <button disabled={pending} name="acao" value="assinar" className="ui-button-primary disabled:cursor-wait disabled:opacity-70">{pending ? "Salvando…" : "Salvar e assinar"}</button> : null}
      </div>
    </form>
  );
}
