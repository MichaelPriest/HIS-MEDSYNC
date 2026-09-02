"use client";

import { CheckCircle2, Cloud, CloudOff, Loader2, Save } from "lucide-react";
import { useActionState, useEffect, useRef, useState } from "react";
import {
  salvarRpaBackground,
  type SurgicalTimelineActionState,
} from "@/modules/centro-cirurgico/anestesia-rpa-background-actions";

export type RpaInitialData = {
  aldrete_entrada: number | null;
  aldrete_alta: number | null;
  dor: number | null;
  nauseas: boolean;
  sinais_vitais?: Record<string, unknown> | null;
  intercorrencias?: string | null;
  destino: string | null;
  status: string;
  alta_em: string | null;
};

type SaveState = "idle" | "dirty" | "saving" | "saved" | "error";
const INITIAL_STATE: SurgicalTimelineActionState = { status: "idle" };
const text = (value: unknown) => typeof value === "string" ? value : value == null ? "" : String(value);
const fmt = (value?: string | null) => value
  ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(value))
  : "—";

export function RpaAutosaveForm({ cirurgiaId, initial }: { cirurgiaId: string; initial?: RpaInitialData | null }) {
  const formRef = useRef<HTMLFormElement>(null);
  const first = useRef(true);
  const editVersion = useRef(0);
  const submittedVersion = useRef(0);
  const [actionState, formAction, pending] = useActionState(salvarRpaBackground, INITIAL_STATE);
  const [dirty, setDirty] = useState(false);
  const [autoBlocked, setAutoBlocked] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [aldreteEntrada, setAldreteEntrada] = useState(initial?.aldrete_entrada?.toString() ?? "");
  const [aldreteAlta, setAldreteAlta] = useState(initial?.aldrete_alta?.toString() ?? "");
  const [dor, setDor] = useState(initial?.dor?.toString() ?? "");
  const [nauseas, setNauseas] = useState(initial?.nauseas ?? false);
  const [pa, setPa] = useState(text(initial?.sinais_vitais?.pa));
  const [fc, setFc] = useState(text(initial?.sinais_vitais?.fc));
  const [spo2, setSpo2] = useState(text(initial?.sinais_vitais?.spo2));
  const [temperatura, setTemperatura] = useState(text(initial?.sinais_vitais?.temperatura));
  const [destino, setDestino] = useState(initial?.destino ?? "");
  const [intercorrencias, setIntercorrencias] = useState(initial?.intercorrencias ?? "");
  const [status, setStatus] = useState(initial?.status ?? "em_rpa");
  const [altaEm, setAltaEm] = useState(initial?.alta_em ?? null);
  const altaConcluida = status === "alta" || Boolean(altaEm);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (altaConcluida) return;
    editVersion.current += 1;
    setDirty(true);
    setAutoBlocked(false);
  }, [aldreteAlta, aldreteEntrada, altaConcluida, destino, dor, fc, intercorrencias, nauseas, pa, spo2, temperatura]);

  useEffect(() => {
    if (!dirty || pending || altaConcluida || autoBlocked) return;
    const timer = window.setTimeout(() => {
      submittedVersion.current = editVersion.current;
      formRef.current?.requestSubmit();
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [altaConcluida, autoBlocked, dirty, pending]);

  useEffect(() => {
    if (actionState.status === "success") {
      setLastSaved(new Date());
      setAutoBlocked(false);
      if (editVersion.current === submittedVersion.current) setDirty(false);
      if (actionState.data?.status !== undefined) setStatus(actionState.data.status ?? "em_rpa");
      if (actionState.data?.altaEm !== undefined) setAltaEm(actionState.data.altaEm ?? null);
    } else if (actionState.status === "error") {
      setAutoBlocked(true);
    }
  }, [actionState]);

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
      <p className="text-xs font-semibold text-slate-600">Rascunho da recuperação salvo automaticamente.</p>
      <SaveIndicator state={saveState} lastSaved={lastSaved} />
    </div>
    <div className="grid gap-3 sm:grid-cols-4">
      <input name="aldrete_entrada" value={aldreteEntrada} disabled={altaConcluida} onChange={(e) => setAldreteEntrada(e.target.value)} type="number" step="0.1" className="ui-input" placeholder="Aldrete entrada" />
      <input name="aldrete_alta" value={aldreteAlta} disabled={altaConcluida} onChange={(e) => setAldreteAlta(e.target.value)} type="number" step="0.1" className="ui-input" placeholder="Aldrete alta" />
      <input name="dor" value={dor} disabled={altaConcluida} onChange={(e) => setDor(e.target.value)} type="number" min="0" max="10" step="0.1" className="ui-input" placeholder="Dor 0–10" />
      <input name="pa" value={pa} disabled={altaConcluida} onChange={(e) => setPa(e.target.value)} className="ui-input" placeholder="PA" />
      <input name="fc" value={fc} disabled={altaConcluida} onChange={(e) => setFc(e.target.value)} type="number" className="ui-input" placeholder="FC" />
      <input name="spo2" value={spo2} disabled={altaConcluida} onChange={(e) => setSpo2(e.target.value)} type="number" step="0.1" className="ui-input" placeholder="SpO₂" />
      <input name="temperatura" value={temperatura} disabled={altaConcluida} onChange={(e) => setTemperatura(e.target.value)} type="number" step="0.1" className="ui-input" placeholder="Temperatura" />
      <input name="destino" value={destino} disabled={altaConcluida} onChange={(e) => setDestino(e.target.value)} className="ui-input" placeholder="Destino" />
      <textarea name="intercorrencias" value={intercorrencias} disabled={altaConcluida} onChange={(e) => setIntercorrencias(e.target.value)} className="ui-input min-h-20 sm:col-span-3" placeholder="Intercorrências" />
      <label className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm"><input type="checkbox" name="nauseas" disabled={altaConcluida} checked={nauseas} onChange={(e) => setNauseas(e.target.checked)} />Náuseas</label>
    </div>
    {actionState.status === "error" ? <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700" aria-live="polite">{actionState.message}{actionState.detail ? <span className="mt-1 block font-normal">{actionState.detail}</span> : null}</p> : null}
    {actionState.status === "success" && actionState.data?.action === "discharge" ? <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700" aria-live="polite">{actionState.message}</p> : null}
    <div className="flex flex-wrap items-center gap-3">
      {!altaConcluida ? <button type="submit" disabled={pending} className="ui-button-secondary"><Save className="size-4" />Salvar agora</button> : null}
      {!altaConcluida ? <button type="submit" name="acao" value="alta" disabled={pending || !aldreteAlta} className="ui-button-primary">Registrar alta da RPA</button> : null}
      <span className="text-xs text-slate-500">Status {status} · alta {fmt(altaEm)} · horário de Brasília</span>
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
