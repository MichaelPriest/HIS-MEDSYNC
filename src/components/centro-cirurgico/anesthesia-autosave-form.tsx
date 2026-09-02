"use client";

import { CheckCircle2, Cloud, CloudOff, Loader2, Play, Save, Square } from "lucide-react";
import { useActionState, useEffect, useRef, useState } from "react";
import {
  salvarAnestesiaBackground,
  type SurgicalTimelineActionState,
} from "@/modules/centro-cirurgico/anestesia-rpa-background-actions";

export type AnesthesiaInitialData = {
  tecnica: string | null;
  tecnicas?: string[] | null;
  asa: string | null;
  via_aerea: string | null;
  monitorizacao?: Record<string, unknown> | null;
  medicamentos?: unknown[] | null;
  fluidos?: unknown[] | null;
  eventos?: unknown[] | null;
  inicio_em: string | null;
  fim_em: string | null;
  observacoes: string | null;
};

type SaveState = "idle" | "dirty" | "saving" | "saved" | "error";

const INITIAL_STATE: SurgicalTimelineActionState = { status: "idle" };
const techniques = [
  ["Anestesia Local", "Anestesia Local"],
  ["Bloqueio de Nervos Periféricos", "Bloqueio de Nervos Periféricos"],
  ["Raquianestesia", "Raquianestesia"],
  ["Anestesia Peridural", "Anestesia Peridural"],
  ["Anestesia Geral", "Anestesia Geral"],
] as const;

const fmt = (value?: string | null) => value
  ? new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "America/Sao_Paulo" }).format(new Date(value))
  : "—";

function listText(value?: unknown[] | null) {
  return (value ?? []).map((item) => {
    if (typeof item === "string") return item;
    if (item && typeof item === "object" && "descricao" in item) return String((item as { descricao?: unknown }).descricao ?? "");
    return "";
  }).filter(Boolean).join("\n");
}

export function AnesthesiaAutosaveForm({ cirurgiaId, initial }: { cirurgiaId: string; initial?: AnesthesiaInitialData | null }) {
  const formRef = useRef<HTMLFormElement>(null);
  const first = useRef(true);
  const editVersion = useRef(0);
  const submittedVersion = useRef(0);
  const [actionState, formAction, pending] = useActionState(salvarAnestesiaBackground, INITIAL_STATE);
  const [dirty, setDirty] = useState(false);
  const [autoBlocked, setAutoBlocked] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [tecnicas, setTecnicas] = useState<string[]>(initial?.tecnicas?.length ? initial.tecnicas : initial?.tecnica ? [initial.tecnica] : []);
  const [asa, setAsa] = useState(initial?.asa ?? "");
  const [viaAerea, setViaAerea] = useState(initial?.via_aerea ?? "");
  const [monitor, setMonitor] = useState({
    ecg: Boolean(initial?.monitorizacao?.ecg),
    spo2: Boolean(initial?.monitorizacao?.spo2),
    pressao: Boolean(initial?.monitorizacao?.pressao),
    capnografia: Boolean(initial?.monitorizacao?.capnografia),
    temperatura: Boolean(initial?.monitorizacao?.temperatura),
  });
  const [medicamentos, setMedicamentos] = useState(listText(initial?.medicamentos));
  const [fluidos, setFluidos] = useState(listText(initial?.fluidos));
  const [eventos, setEventos] = useState(listText(initial?.eventos));
  const [observacoes, setObservacoes] = useState(initial?.observacoes ?? "");
  const [inicioEm, setInicioEm] = useState(initial?.inicio_em ?? null);
  const [fimEm, setFimEm] = useState(initial?.fim_em ?? null);
  const finalized = Boolean(fimEm);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (finalized) return;
    editVersion.current += 1;
    setDirty(true);
    setAutoBlocked(false);
  }, [asa, eventos, finalized, fluidos, medicamentos, monitor, observacoes, tecnicas, viaAerea]);

  useEffect(() => {
    if (!dirty || pending || finalized || autoBlocked) return;
    const timer = window.setTimeout(() => {
      submittedVersion.current = editVersion.current;
      formRef.current?.requestSubmit();
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [autoBlocked, dirty, finalized, pending]);

  useEffect(() => {
    if (actionState.status === "success") {
      setLastSaved(new Date());
      setAutoBlocked(false);
      if (editVersion.current === submittedVersion.current) setDirty(false);
      if (actionState.data?.inicioEm !== undefined) setInicioEm(actionState.data.inicioEm ?? null);
      if (actionState.data?.fimEm !== undefined) setFimEm(actionState.data.fimEm ?? null);
    } else if (actionState.status === "error") {
      setAutoBlocked(true);
    }
  }, [actionState]);

  const toggleTechnique = (value: string, enabled: boolean) => {
    setTecnicas((current) => enabled ? [...new Set([...current, value])] : current.filter((item) => item !== value));
  };
  const saveState: SaveState = pending ? "saving" : actionState.status === "error" ? "error" : dirty ? "dirty" : actionState.status === "success" ? "saved" : "idle";

  return <form
    ref={formRef}
    action={formAction}
    onSubmit={() => { submittedVersion.current = editVersion.current; }}
    className="mt-4 space-y-3"
    aria-busy={pending}
  >
    <input type="hidden" name="cirurgia_id" value={cirurgiaId} />
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2" aria-live="polite">
      <p className="text-xs font-semibold text-slate-600">Rascunho salvo automaticamente em segundo plano.</p>
      <SaveIndicator state={saveState} lastSaved={lastSaved} />
    </div>
    <div className="grid gap-3 sm:grid-cols-2">
      <fieldset className="rounded-xl border border-slate-200 p-3 sm:col-span-2">
        <legend className="px-1 text-sm font-black text-slate-800">Tipos de anestesia <span className="font-semibold text-slate-500">(selecione um ou mais)</span></legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{techniques.map(([value, label]) => <label key={value} className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-bold ${tecnicas.includes(value) ? "border-brand-300 bg-brand-50 text-brand-800" : "border-slate-200 text-slate-700"}`}><input type="checkbox" name="tecnicas" value={value} disabled={finalized} checked={tecnicas.includes(value)} onChange={(event) => toggleTechnique(value, event.target.checked)} />{label}</label>)}</div>
      </fieldset>
      <label className="space-y-1.5 text-sm font-semibold text-slate-700"><span>ASA</span><select name="asa" value={asa} disabled={finalized} onChange={(e) => setAsa(e.target.value)} className="ui-input"><option value="">Selecione</option>{["I","II","III","IV","V","VI"].map((value) => <option key={value} value={value}>ASA {value}</option>)}</select></label>
      <label className="space-y-1.5 text-sm font-semibold text-slate-700"><span>Via aérea</span><input name="via_aerea" value={viaAerea} disabled={finalized} onChange={(e) => setViaAerea(e.target.value)} className="ui-input" placeholder="Ex.: máscara laríngea, TOT" /></label>
      <div className="rounded-xl border border-slate-100 p-3 text-sm"><b className="mb-2 block">Monitorização</b>{[["ecg","ECG"],["spo2","SpO₂"],["pressao","PA"],["capnografia","Capnografia"],["temperatura","Temperatura"]].map(([key,label]) => <label key={key} className="mr-3 inline-flex items-center gap-1.5"><input type="checkbox" name={`monitor_${key}`} disabled={finalized} checked={monitor[key as keyof typeof monitor]} onChange={(e) => setMonitor((old) => ({ ...old, [key]: e.target.checked }))} />{label}</label>)}</div>
      <textarea name="medicamentos" value={medicamentos} disabled={finalized} onChange={(e) => setMedicamentos(e.target.value)} className="ui-input min-h-24" placeholder="Medicamentos — um por linha" />
      <textarea name="fluidos" value={fluidos} disabled={finalized} onChange={(e) => setFluidos(e.target.value)} className="ui-input min-h-24" placeholder="Fluidos — um por linha" />
      <textarea name="eventos" value={eventos} disabled={finalized} onChange={(e) => setEventos(e.target.value)} className="ui-input min-h-24" placeholder="Eventos/intercorrências — um por linha" />
      <textarea name="observacoes" value={observacoes} disabled={finalized} onChange={(e) => setObservacoes(e.target.value)} className="ui-input min-h-24" placeholder="Observações" />
    </div>
    {actionState.status === "error" ? <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700" aria-live="polite">{actionState.message}{actionState.detail ? <span className="mt-1 block font-normal">{actionState.detail}</span> : null}</p> : null}
    {actionState.status === "success" && actionState.data?.action !== "save" ? <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700" aria-live="polite">{actionState.message}</p> : null}
    <div className="flex flex-wrap items-center gap-3">
      {!finalized ? <button type="submit" disabled={pending} className="ui-button-secondary"><Save className="size-4" />Salvar agora</button> : null}
      {!inicioEm && !finalized ? <button type="submit" name="acao" value="iniciar" disabled={pending || !tecnicas.length} className="ui-button-primary"><Play className="size-4" />Registrar início</button> : null}
      {inicioEm && !finalized ? <button type="submit" name="acao" value="finalizar" disabled={pending || !tecnicas.length} className="rounded-xl bg-rose-700 px-4 py-2 text-sm font-black text-white hover:bg-rose-800"><Square className="mr-2 inline size-4" />Finalizar anestesia</button> : null}
      <span className="text-xs text-slate-500">Início {fmt(inicioEm)} · fim {fmt(fimEm)} · horário de Brasília</span>
    </div>
  </form>;
}

function SaveIndicator({ state, lastSaved }: { state: SaveState; lastSaved: Date | null }) {
  if (state === "saving") return <span className="inline-flex items-center gap-1.5 text-xs font-black text-brand-700"><Loader2 className="size-3.5 animate-spin" />Salvando…</span>;
  if (state === "error") return <span className="inline-flex items-center gap-1.5 text-xs font-black text-rose-700"><CloudOff className="size-3.5" />Falha ao salvar</span>;
  if (state === "dirty") return <span className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-700"><Cloud className="size-3.5" />Alterações pendentes</span>;
  if (state === "saved") return <span className="inline-flex items-center gap-1.5 text-xs font-black text-emerald-700"><CheckCircle2 className="size-3.5" />Salvo{lastSaved ? ` às ${lastSaved.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "America/Sao_Paulo" })}` : ""}</span>;
  return <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500"><Cloud className="size-3.5" />Autosave ativo</span>;
}
