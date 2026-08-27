"use client";

import { CheckCircle2, Cloud, CloudOff, Loader2, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

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
const num = (value: string) => value === "" ? null : Number(value);
const text = (value: unknown) => typeof value === "string" ? value : value == null ? "" : String(value);
const fmt = (value?: string | null) => value
  ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(value))
  : "—";

export function RpaAutosaveForm({ cirurgiaId, initial }: { cirurgiaId: string; initial?: RpaInitialData | null }) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const first = useRef(true);
  const [state, setState] = useState<SaveState>("idle");
  const [message, setMessage] = useState<string | null>(null);
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
  const altaConcluida = initial?.status === "alta" || Boolean(initial?.alta_em);

  const payload = useCallback((alta = false) => ({
    p_cirurgia_id: cirurgiaId,
    p_aldrete_entrada: num(aldreteEntrada),
    p_aldrete_alta: num(aldreteAlta),
    p_dor: num(dor),
    p_nauseas: nauseas,
    p_sinais_vitais: { pa: pa || null, fc: num(fc), spo2: num(spo2), temperatura: num(temperatura) },
    p_intercorrencias: intercorrencias || null,
    p_destino: destino || null,
    p_alta: alta,
  }), [aldreteAlta, aldreteEntrada, cirurgiaId, destino, dor, fc, intercorrencias, nauseas, pa, spo2, temperatura]);

  const save = useCallback(async (alta = false) => {
    if (altaConcluida && !alta) return true;
    setState("saving");
    setMessage(null);
    const { error } = await supabase.rpc("centro_cirurgico_salvar_rpa_operacional", payload(alta));
    if (error) {
      setState("error");
      setMessage(error.message);
      return false;
    }
    setState("saved");
    setLastSaved(new Date());
    if (alta) router.refresh();
    return true;
  }, [altaConcluida, payload, router, supabase]);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (altaConcluida) return;
    setState("dirty");
    const timer = window.setTimeout(() => void save(false), 1200);
    return () => window.clearTimeout(timer);
  }, [aldreteAlta, aldreteEntrada, altaConcluida, destino, dor, fc, intercorrencias, nauseas, pa, save, spo2, temperatura]);

  return <div className="mt-4 space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
      <p className="text-xs font-semibold text-slate-600">Rascunho da recuperação salvo automaticamente.</p>
      <SaveIndicator state={state} lastSaved={lastSaved} />
    </div>
    <div className="grid gap-3 sm:grid-cols-4">
      <input value={aldreteEntrada} disabled={altaConcluida} onChange={(e) => setAldreteEntrada(e.target.value)} type="number" step="0.1" className="ui-input" placeholder="Aldrete entrada" />
      <input value={aldreteAlta} disabled={altaConcluida} onChange={(e) => setAldreteAlta(e.target.value)} type="number" step="0.1" className="ui-input" placeholder="Aldrete alta" />
      <input value={dor} disabled={altaConcluida} onChange={(e) => setDor(e.target.value)} type="number" min="0" max="10" step="0.1" className="ui-input" placeholder="Dor 0–10" />
      <input value={pa} disabled={altaConcluida} onChange={(e) => setPa(e.target.value)} className="ui-input" placeholder="PA" />
      <input value={fc} disabled={altaConcluida} onChange={(e) => setFc(e.target.value)} type="number" className="ui-input" placeholder="FC" />
      <input value={spo2} disabled={altaConcluida} onChange={(e) => setSpo2(e.target.value)} type="number" step="0.1" className="ui-input" placeholder="SpO₂" />
      <input value={temperatura} disabled={altaConcluida} onChange={(e) => setTemperatura(e.target.value)} type="number" step="0.1" className="ui-input" placeholder="Temperatura" />
      <input value={destino} disabled={altaConcluida} onChange={(e) => setDestino(e.target.value)} className="ui-input" placeholder="Destino" />
      <textarea value={intercorrencias} disabled={altaConcluida} onChange={(e) => setIntercorrencias(e.target.value)} className="ui-input min-h-20 sm:col-span-3" placeholder="Intercorrências" />
      <label className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm"><input type="checkbox" disabled={altaConcluida} checked={nauseas} onChange={(e) => setNauseas(e.target.checked)} />Náuseas</label>
    </div>
    {message ? <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">{message}</p> : null}
    <div className="flex flex-wrap items-center gap-3">
      {!altaConcluida ? <button type="button" onClick={() => void save(false)} disabled={state === "saving"} className="ui-button-secondary"><Save className="size-4" />Salvar agora</button> : null}
      {!altaConcluida ? <button type="button" onClick={() => void save(true)} disabled={state === "saving" || !aldreteAlta} className="ui-button-primary">Registrar alta da RPA</button> : null}
      <span className="text-xs text-slate-500">Status {initial?.status ?? "em_rpa"} · alta {fmt(initial?.alta_em)} · horário de Brasília</span>
    </div>
  </div>;
}

function SaveIndicator({ state, lastSaved }: { state: SaveState; lastSaved: Date | null }) {
  if (state === "saving") return <span className="inline-flex items-center gap-1.5 text-xs font-black text-brand-700"><Loader2 className="size-3.5 animate-spin" />Salvando…</span>;
  if (state === "error") return <span className="inline-flex items-center gap-1.5 text-xs font-black text-rose-700"><CloudOff className="size-3.5" />Falha ao salvar</span>;
  if (state === "dirty") return <span className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-700"><Cloud className="size-3.5" />Alterações pendentes</span>;
  if (state === "saved") return <span className="inline-flex items-center gap-1.5 text-xs font-black text-emerald-700"><CheckCircle2 className="size-3.5" />Salvo{lastSaved ? ` às ${lastSaved.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "America/Sao_Paulo" })}` : ""}</span>;
  return <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500"><Cloud className="size-3.5" />Autosave ativo</span>;
}
