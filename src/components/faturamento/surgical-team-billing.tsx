"use client";

import { AlertTriangle, Calculator, CheckCircle2, RefreshCcw, Save, UsersRound } from "lucide-react";
import { useActionState } from "react";
import type { BackgroundActionState } from "@/lib/actions/background-action";
import {
  atualizarEquipeCirurgicaBackground,
  sincronizarEquipeCirurgicaBackground,
  type SurgicalTeamBillingActionData,
} from "@/modules/faturamento/equipe-cirurgica-background-actions";

export type SurgicalProcedureBilling = {
  id: string;
  codigo: string | null;
  descricao: string;
  tabela_referencia: string | null;
  porte: string | null;
  porte_anestesico: string | null;
  requisitos_equipe: Record<string, unknown> | null;
};

export type SurgicalClinicalMember = {
  id: string;
  cirurgia_procedimento_id: string;
  papel: string;
  ordem_participacao: number | null;
  faturavel: boolean;
  profissional: { nome_completo: string | null; conselho: string | null; numero_conselho: string | null; uf_conselho: string | null } | null;
};

export type SurgicalBillingMember = {
  id: string;
  cirurgia_procedimento_id: string;
  cirurgia_equipe_id: string;
  papel: string;
  ordem_participacao: number | null;
  fonte_codigo: string | null;
  fonte_tipo: string | null;
  porte_anestesico: string | null;
  quantidade_auxiliares_regra: number;
  percentual_honorario: number | string | null;
  ch_anestesista: number | string | null;
  valor_ch: number | string | null;
  valor_base_procedimento: number | string | null;
  valor_calculado: number | string | null;
  cobrar_regra: boolean;
  cobrar: boolean;
  repasse: boolean;
  ajuste_manual: boolean;
  justificativa_ajuste: string | null;
  status_calculo: string;
  origem_regra: string;
  ativo: boolean;
};

const initialState: BackgroundActionState<SurgicalTeamBillingActionData> = { status: "idle" };

const ROLE_LABELS: Record<string, string> = {
  cirurgiao_principal: "Cirurgião",
  cirurgiao_auxiliar: "Auxiliar",
  anestesista: "Anestesista",
  auxiliar_anestesia: "Auxiliar de anestesia",
  instrumentador: "Instrumentador",
  pediatra: "Pediatra",
  neonatologista: "Neonatologista",
  perfusionista: "Perfusionista",
  enfermeiro: "Enfermeiro",
  tecnico_enfermagem: "Técnico de enfermagem",
  circulante_sala: "Circulante",
  tecnico_radiologia: "Técnico de radiologia",
  outro: "Outro",
};

function roleLabel(role: string, order: number | null) {
  if (role === "cirurgiao_auxiliar") return `${order ?? "—"}º auxiliar`;
  return ROLE_LABELS[role] ?? role.replaceAll("_", " ");
}

function brl(value: number | string | null) {
  if (value === null || value === undefined || value === "") return "—";
  return Number(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function number(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function requirement(procedure: SurgicalProcedureBilling, key: string) {
  return procedure.requisitos_equipe?.[key];
}

function SyncProcedure({ contaId, procedure, disabled }: { contaId: string; procedure: SurgicalProcedureBilling; disabled: boolean }) {
  const action = sincronizarEquipeCirurgicaBackground.bind(null, contaId, procedure.id);
  const [state, formAction, pending] = useActionState(action, initialState);
  return <form action={formAction}>
    <button disabled={disabled || pending} className="ui-button-primary disabled:cursor-not-allowed disabled:opacity-50">
      <RefreshCcw className={`size-4 ${pending ? "animate-spin" : ""}`} />
      {pending ? "Calculando…" : "Sincronizar equipe e honorários"}
    </button>
    <div aria-live="polite" className="mt-2 min-h-5 text-xs font-semibold">
      {state.status === "error" ? <span className="text-rose-700">{state.message}</span> : null}
      {state.status === "success" ? <span className="text-emerald-700">{state.message}</span> : null}
    </div>
  </form>;
}

function MemberForm({ contaId, row, clinical, disabled }: { contaId: string; row: SurgicalBillingMember; clinical: SurgicalClinicalMember | undefined; disabled: boolean }) {
  const action = atualizarEquipeCirurgicaBackground.bind(null, contaId, row.id);
  const [state, formAction, pending] = useActionState(action, initialState);
  const professional = clinical?.profissional;
  const rule = row.papel === "anestesista"
    ? row.ch_anestesista ? `${number(row.ch_anestesista).toLocaleString("pt-BR")} CH` : "Porte anestésico"
    : row.percentual_honorario !== null ? `${number(row.percentual_honorario).toLocaleString("pt-BR")}%` : "Sem regra automática";
  const ok = row.status_calculo === "calculado";

  return <form action={formAction} className="grid gap-3 border-t border-slate-100 px-4 py-4 xl:grid-cols-[minmax(230px,1fr)_130px_130px_150px_110px_110px_minmax(220px,1fr)_auto] xl:items-center">
    <div className="min-w-0">
      <div className="flex items-center gap-2">
        <span className="font-black text-slate-900">{roleLabel(row.papel, row.ordem_participacao)}</span>
        {ok ? <CheckCircle2 className="size-4 text-emerald-600" /> : <AlertTriangle className="size-4 text-amber-600" />}
      </div>
      <p className="truncate text-sm text-slate-700">{professional?.nome_completo ?? "Profissional não identificado"}</p>
      <p className="text-[11px] text-slate-500">{[professional?.conselho, professional?.numero_conselho, professional?.uf_conselho].filter(Boolean).join(" ") || "Registro profissional não exibido"}</p>
    </div>
    <div><p className="text-[10px] font-black uppercase text-slate-400">Regra</p><p className="mt-1 text-sm font-bold text-slate-800">{rule}</p></div>
    <div><p className="text-[10px] font-black uppercase text-slate-400">Base</p><p className="mt-1 text-sm font-bold text-slate-800">{brl(row.valor_base_procedimento)}</p></div>
    <div><p className="text-[10px] font-black uppercase text-slate-400">Honorário</p><p className="mt-1 text-base font-black text-slate-950">{brl(row.valor_calculado)}</p></div>
    <label className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold text-slate-700"><input type="checkbox" name="cobrar" defaultChecked={row.cobrar} disabled={disabled || pending || !ok}/>Cobrar</label>
    <label className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold text-slate-700"><input type="checkbox" name="repasse" defaultChecked={row.repasse} disabled={disabled || pending}/>Repasse</label>
    <div>
      <input name="justificativa" defaultValue={row.justificativa_ajuste ?? ""} className="ui-input" placeholder="Justificativa se alterar a regra" disabled={disabled || pending}/>
      <p className={`mt-1 text-[11px] ${ok ? "text-slate-500" : "font-semibold text-amber-700"}`}>{ok ? `${row.fonte_codigo ?? "Tabela"} · ${row.origem_regra.replaceAll("_", " ")}` : row.status_calculo.replaceAll("_", " ")}</p>
    </div>
    <button disabled={disabled || pending} className="ui-button-secondary disabled:cursor-not-allowed disabled:opacity-50"><Save className="size-4" />{pending ? "Salvando…" : "Salvar"}</button>
    <div aria-live="polite" className="xl:col-span-8 min-h-4 text-xs font-semibold">
      {state.status === "error" ? <span className="text-rose-700">{state.message}</span> : null}
      {state.status === "success" ? <span className="text-emerald-700">{state.message}</span> : null}
    </div>
  </form>;
}

export function SurgicalTeamBillingPanel({
  contaId,
  procedures,
  clinicalMembers,
  billingMembers,
  disabled = false,
}: {
  contaId: string;
  procedures: SurgicalProcedureBilling[];
  clinicalMembers: SurgicalClinicalMember[];
  billingMembers: SurgicalBillingMember[];
  disabled?: boolean;
}) {
  return <section className="mt-5 space-y-4" id="equipe-medica">
    <div className="flex items-start gap-3">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700"><UsersRound className="size-5" /></span>
      <div><h2 className="font-black text-slate-950">Equipe médica e honorários</h2><p className="text-sm text-slate-500">A equipe clínica vem do Centro Cirúrgico. O faturamento cria um snapshot separado para calcular Cobrar e Repasse sem alterar o registro assistencial.</p></div>
    </div>

    {!procedures.length ? <div className="ui-card p-7 text-center text-sm text-slate-500">Nenhum procedimento do Centro Cirúrgico foi localizado neste atendimento. Registre o ato assistencial antes de faturar a equipe.</div> : null}

    {procedures.map((procedure) => {
      const clinical = clinicalMembers.filter((item) => item.cirurgia_procedimento_id === procedure.id);
      const billing = billingMembers.filter((item) => item.cirurgia_procedimento_id === procedure.id && item.ativo);
      const aux = number(requirement(procedure, "quantidade_auxiliares"));
      const ch = number(requirement(procedure, "ch_anestesista"));
      const anest = requirement(procedure, "anestesista") === true;
      return <article key={procedure.id} className="ui-card overflow-hidden">
        <header className="border-b border-slate-200 bg-slate-50 px-5 py-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="font-mono text-xs font-black text-brand-700">{procedure.tabela_referencia ?? "Tabela contratual"} · {procedure.codigo ?? "sem código"}</p>
              <h3 className="mt-1 text-lg font-black text-slate-950">{procedure.descricao}</h3>
              <div className="mt-2 flex flex-wrap gap-2 text-xs font-bold text-slate-600">
                <span className="rounded-full bg-white px-2.5 py-1 ring-1 ring-slate-200">Auxiliares previstos: {aux}</span>
                <span className="rounded-full bg-white px-2.5 py-1 ring-1 ring-slate-200">Anestesia: {anest ? "sim" : "não"}</span>
                {ch > 0 ? <span className="rounded-full bg-white px-2.5 py-1 ring-1 ring-slate-200">CH anestesista: {ch.toLocaleString("pt-BR")}</span> : null}
                {procedure.porte_anestesico ? <span className="rounded-full bg-white px-2.5 py-1 ring-1 ring-slate-200">Porte anestésico: {procedure.porte_anestesico}</span> : null}
                <span className="rounded-full bg-white px-2.5 py-1 ring-1 ring-slate-200">Equipe registrada: {clinical.length}</span>
              </div>
            </div>
            <SyncProcedure contaId={contaId} procedure={procedure} disabled={disabled || !clinical.length} />
          </div>
          {!clinical.length ? <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-semibold text-amber-800">A equipe assistencial ainda não foi registrada para este procedimento. Complete a equipe no Centro Cirúrgico; o faturamento não cria profissionais automaticamente.</p> : null}
        </header>

        {billing.length ? <div>
          <div className="hidden grid-cols-[minmax(230px,1fr)_130px_130px_150px_110px_110px_minmax(220px,1fr)_auto] gap-3 bg-white px-4 py-2 text-[10px] font-black uppercase tracking-wide text-slate-400 xl:grid">
            <span>Profissional / papel</span><span>Regra</span><span>Base</span><span>Honorário</span><span>Cobrar</span><span>Repasse</span><span>Status / justificativa</span><span>Ação</span>
          </div>
          {billing.map((row) => <MemberForm key={row.id} contaId={contaId} row={row} clinical={clinical.find((item) => item.id === row.cirurgia_equipe_id)} disabled={disabled} />)}
        </div> : <div className="p-5 text-sm text-slate-500"><Calculator className="mr-2 inline size-4" />Sincronize a equipe para gerar os honorários contratuais deste procedimento.</div>}
      </article>;
    })}

    <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-xs leading-5 text-blue-950">
      <b>Regras automáticas atuais:</b> cirurgião 100%; 1º auxiliar 30%; 2º–4º auxiliares 20%; instrumentador 10%; anestesista pelo CH/porte da tabela e contrato. A quantidade de auxiliares é limitada pelo procedimento. Para AMB 90/92, CH explícito importado do item tem prioridade; o mapa de portes 1–7 é apenas fallback quando não existir CH no item. AMB 96/99 exige método contratual explícito e não usa valores históricos aproximados embutidos.
    </div>
  </section>;
}
