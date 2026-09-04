"use client";

import { useMemo, useState } from "react";
import type { RegulatoryOption } from "@/modules/cadastros/regulatory-domains";
import { BRAZIL_UFS, suggestCouncilCodeForCbo } from "@/modules/cadastros/regulatory-domains";

export function ProfessionalRegulatoryFields({
  cboOptions,
  councilOptions,
  defaultEnabled = false,
  defaultCbo = null,
  defaultCouncilCode = null,
  defaultCouncilNumber = null,
  defaultUf = null,
  disabled = false,
  sourceVersion = "202309",
}: {
  cboOptions: RegulatoryOption[];
  councilOptions: RegulatoryOption[];
  defaultEnabled?: boolean;
  defaultCbo?: string | null;
  defaultCouncilCode?: string | null;
  defaultCouncilNumber?: string | null;
  defaultUf?: string | null;
  disabled?: boolean;
  sourceVersion?: string;
}) {
  const [enabled, setEnabled] = useState(defaultEnabled);
  const [cbo, setCbo] = useState(defaultCbo ?? "");
  const [councilCode, setCouncilCode] = useState(defaultCouncilCode ?? "");
  const cboLabel = useMemo(() => cboOptions.find((item) => item.code === cbo)?.label ?? null, [cbo, cboOptions]);

  return <div className="space-y-4">
    <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-3">
      <input
        type="checkbox"
        name="habilitado_tiss"
        value="true"
        checked={enabled}
        onChange={(event) => setEnabled(event.target.checked)}
        disabled={disabled}
        className="mt-1 size-4 rounded border-slate-300"
      />
      <span><span className="block text-sm font-black text-slate-800">Habilitado para uso profissional no TISS</span><span className="mt-0.5 block text-xs leading-5 text-slate-500">Ative para profissionais que serão solicitantes ou executantes. Funções administrativas podem permanecer desativadas sem gerar pendência regulatória.</span></span>
    </label>

    <fieldset disabled={disabled || !enabled} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 disabled:opacity-55">
      <label className="space-y-1 text-xs font-semibold text-slate-600 sm:col-span-2 xl:col-span-2">
        <span>CBO / ocupação oficial *</span>
        <select
          name="cbo"
          value={cbo}
          required={enabled}
          onChange={(event) => {
            const next = event.target.value;
            setCbo(next);
            setCouncilCode(suggestCouncilCodeForCbo(next) ?? "");
          }}
          className="ui-input"
        >
          <option value="">Selecionar CBO</option>
          {cboOptions.map((item) => <option key={item.code} value={item.code}>{item.code} · {item.label}</option>)}
        </select>
      </label>

      <label className="space-y-1 text-xs font-semibold text-slate-600 sm:col-span-2 xl:col-span-2">
        <span>Conselho profissional · TUSS 26 *</span>
        <select name="codigo_conselho_ans" value={councilCode} required={enabled} onChange={(event) => setCouncilCode(event.target.value)} className="ui-input">
          <option value="">Selecionar conselho</option>
          {councilOptions.map((item) => <option key={item.code} value={item.code}>{item.code} · {item.label}</option>)}
        </select>
      </label>

      <label className="space-y-1 text-xs font-semibold text-slate-600 sm:col-span-2">
        <span>Número do conselho *</span>
        <input name="numero_conselho" defaultValue={defaultCouncilNumber ?? ""} required={enabled} maxLength={20} className="ui-input" />
      </label>

      <label className="space-y-1 text-xs font-semibold text-slate-600">
        <span>UF do conselho *</span>
        <select name="uf_conselho" defaultValue={defaultUf ?? ""} required={enabled} className="ui-input">
          <option value="">Selecionar UF</option>
          {BRAZIL_UFS.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
        </select>
      </label>

      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
        <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">Especialidade / ocupação vinculada</p>
        <p className="mt-1 text-sm font-bold text-slate-800">{cboLabel ?? "Selecione um CBO"}</p>
      </div>
    </fieldset>

    <p className="text-[11px] leading-5 text-slate-500">Fonte regulatória: ANS TUSS 24 (CBO) e TUSS 26 (Conselho profissional), baseline FHIR {sourceVersion}. A descrição da especialidade/ocupação é derivada do CBO selecionado; não é digitada livremente.</p>
  </div>;
}
