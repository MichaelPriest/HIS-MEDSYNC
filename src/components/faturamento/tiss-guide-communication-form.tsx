"use client";

import { Save, ShieldCheck } from "lucide-react";
import { useActionState } from "react";
import type { BackgroundActionState } from "@/lib/actions/background-action";
import {
  salvarComplementoComunicacaoTissBackground,
  type TissGuideCommunicationData,
} from "@/modules/tiss/guia-complement-background-actions";

type GuideType = "consulta" | "sp_sadt" | "resumo_internacao";

type Values = {
  codigo_conselho_ans_snapshot?: string | null;
  indicador_acidente?: string | null;
  regime_atendimento_tiss?: string | null;
  carater_atendimento?: string | null;
  numero_solicitacao_internacao?: string | null;
  data_autorizacao?: string | null;
  tipo_faturamento_tiss?: string | null;
  data_inicio_faturamento?: string | null;
  hora_inicio_faturamento?: string | null;
  data_fim_faturamento?: string | null;
  hora_fim_faturamento?: string | null;
  tipo_internacao_tiss?: string | null;
  regime_internacao_tiss?: string | null;
  motivo_encerramento_tiss?: string | null;
};

const initialState: BackgroundActionState<TissGuideCommunicationData> = { status: "idle" };

const councils = [
  ["01", "CRESS"], ["02", "COREN"], ["03", "CRF"], ["04", "CRFA"], ["05", "CREFITO"],
  ["06", "CRM"], ["07", "CRN"], ["08", "CRO"], ["09", "CRP"], ["10", "Outros"],
  ["11", "CRBio"], ["12", "CRBM"], ["13", "CREF"], ["14", "CRMV"], ["15", "CRTR"],
] as const;

const regimes = [
  ["01", "Ambulatorial"], ["02", "Domiciliar"], ["03", "Internação"], ["04", "Pronto-socorro"], ["05", "Telessaúde"],
] as const;

export function TissGuideCommunicationForm({
  guiaId,
  type,
  values,
  disabled = false,
}: {
  guiaId: string;
  type: GuideType;
  values: Values;
  disabled?: boolean;
}) {
  const action = salvarComplementoComunicacaoTissBackground.bind(null, guiaId);
  const [state, formAction, pending] = useActionState(action, initialState);
  const isInpatient = type === "resumo_internacao";
  const needsRegime = type === "consulta" || type === "sp_sadt";
  const needsCharacter = type === "sp_sadt" || isInpatient;

  return <section className="ui-card mt-6 p-5">
    <div className="flex items-start gap-3">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700"><ShieldCheck className="size-5" /></span>
      <div>
        <h2 className="font-semibold text-slate-900">Complemento de Comunicação ANS · 04.03.00</h2>
        <p className="mt-1 max-w-3xl text-sm text-slate-600">Campos exigidos pela estrutura XSD que não podem ser presumidos pelo sistema. O salvamento reexecuta a validação da guia e mantém bloqueado o que estiver incompleto.</p>
      </div>
    </div>

    <form action={formAction} className="mt-5 space-y-4">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Field label="Conselho profissional · código ANS">
          <select name="codigo_conselho_ans_snapshot" defaultValue={values.codigo_conselho_ans_snapshot ?? ""} className="ui-input" disabled={disabled || pending}>
            <option value="">Selecionar</option>
            {councils.map(([code,label]) => <option key={code} value={code}>{code} · {label}</option>)}
          </select>
        </Field>

        <Field label="Indicador de acidente">
          <select name="indicador_acidente" defaultValue={values.indicador_acidente ?? ""} className="ui-input" disabled={disabled || pending}>
            <option value="">Selecionar código TISS</option>
            {(["0","1","2","9"] as const).map((code) => <option key={code} value={code}>Código {code}</option>)}
          </select>
        </Field>

        {needsRegime ? <Field label="Regime de atendimento">
          <select name="regime_atendimento_tiss" defaultValue={values.regime_atendimento_tiss ?? ""} className="ui-input" disabled={disabled || pending}>
            <option value="">Selecionar</option>
            {regimes.map(([code,label]) => <option key={code} value={code}>{code} · {label}</option>)}
          </select>
        </Field> : <input type="hidden" name="regime_atendimento_tiss" value="" />}

        {needsCharacter ? <Field label="Caráter do atendimento">
          <select name="carater_atendimento" defaultValue={values.carater_atendimento ?? ""} className="ui-input" disabled={disabled || pending}>
            <option value="">Selecionar</option>
            <option value="1">1 · Eletiva</option>
            <option value="2">2 · Urgência/Emergência</option>
          </select>
        </Field> : <input type="hidden" name="carater_atendimento" value="" />}

        {isInpatient ? <>
          <Field label="Guia de solicitação de internação">
            <input name="numero_solicitacao_internacao" defaultValue={values.numero_solicitacao_internacao ?? ""} maxLength={20} className="ui-input" disabled={disabled || pending} />
          </Field>
          <Field label="Data formal da autorização">
            <input name="data_autorizacao" type="date" defaultValue={values.data_autorizacao ?? ""} className="ui-input" disabled={disabled || pending} />
          </Field>
          <Field label="Tipo de faturamento">
            <select name="tipo_faturamento_tiss" defaultValue={values.tipo_faturamento_tiss ?? ""} className="ui-input" disabled={disabled || pending}>
              <option value="">Selecionar</option><option value="1">1 · Parcial</option><option value="2">2 · Final</option><option value="3">3 · Complementar</option><option value="4">4 · Total</option>
            </select>
          </Field>
          <Field label="Tipo de internação">
            <select name="tipo_internacao_tiss" defaultValue={values.tipo_internacao_tiss ?? ""} className="ui-input" disabled={disabled || pending}>
              <option value="">Selecionar</option><option value="1">1 · Clínica</option><option value="2">2 · Cirúrgica</option><option value="3">3 · Obstétrica</option><option value="4">4 · Pediátrica</option><option value="5">5 · Psiquiátrica</option>
            </select>
          </Field>
          <Field label="Regime de internação">
            <select name="regime_internacao_tiss" defaultValue={values.regime_internacao_tiss ?? ""} className="ui-input" disabled={disabled || pending}>
              <option value="">Selecionar</option><option value="1">1 · Hospitalar</option><option value="2">2 · Hospital-dia</option><option value="3">3 · Domiciliar</option>
            </select>
          </Field>
          <Field label="Motivo de encerramento · código TISS">
            <input name="motivo_encerramento_tiss" defaultValue={values.motivo_encerramento_tiss ?? ""} maxLength={2} inputMode="numeric" className="ui-input" placeholder="Código da TISS" disabled={disabled || pending} />
          </Field>
          <Field label="Início do faturamento · data">
            <input name="data_inicio_faturamento" type="date" defaultValue={values.data_inicio_faturamento ?? ""} className="ui-input" disabled={disabled || pending} />
          </Field>
          <Field label="Início do faturamento · hora">
            <input name="hora_inicio_faturamento" type="time" step="1" defaultValue={normalizeTime(values.hora_inicio_faturamento)} className="ui-input" disabled={disabled || pending} />
          </Field>
          <Field label="Fim do faturamento · data">
            <input name="data_fim_faturamento" type="date" defaultValue={values.data_fim_faturamento ?? ""} className="ui-input" disabled={disabled || pending} />
          </Field>
          <Field label="Fim do faturamento · hora">
            <input name="hora_fim_faturamento" type="time" step="1" defaultValue={normalizeTime(values.hora_fim_faturamento)} className="ui-input" disabled={disabled || pending} />
          </Field>
        </> : <>
          <input type="hidden" name="numero_solicitacao_internacao" value="" />
          <input type="hidden" name="data_autorizacao" value="" />
          <input type="hidden" name="tipo_faturamento_tiss" value="" />
          <input type="hidden" name="tipo_internacao_tiss" value="" />
          <input type="hidden" name="regime_internacao_tiss" value="" />
          <input type="hidden" name="motivo_encerramento_tiss" value="" />
          <input type="hidden" name="data_inicio_faturamento" value="" />
          <input type="hidden" name="hora_inicio_faturamento" value="" />
          <input type="hidden" name="data_fim_faturamento" value="" />
          <input type="hidden" name="hora_fim_faturamento" value="" />
        </>}
      </div>

      <div aria-live="polite" className="min-h-6 text-sm font-semibold">
        {pending ? <span className="text-brand-700">Salvando…</span> : null}
        {!pending && state.status === "error" ? <span className="text-rose-700">{state.message}</span> : null}
        {!pending && state.status === "success" ? <span className="text-emerald-700">{state.message}</span> : null}
      </div>

      <button type="submit" disabled={disabled || pending} className="ui-button-primary disabled:cursor-not-allowed disabled:opacity-50"><Save className="size-4" />Salvar complemento e revalidar</button>
    </form>
  </section>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block space-y-1.5 text-sm font-semibold text-slate-700"><span>{label}</span>{children}</label>;
}

function normalizeTime(value?: string | null) {
  if (!value) return "";
  return String(value).slice(0, 8);
}
