"use client";

import { CheckCircle2, Cloud, CloudOff, Loader2, Play, Save, Square } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

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
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const first = useRef(true);
  const [state, setState] = useState<SaveState>("idle");
  const [message, setMessage] = useState<string | null>(null);
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

  const payload = useCallback((iniciar = false, finalizar = false) => ({
    p_cirurgia_id: cirurgiaId,
    p_tecnicas: tecnicas,
    p_asa: asa || null,
    p_via_aerea: viaAerea || null,
    p_monitorizacao: monitor,
    p_medicamentos: medicamentos.split(/\r?\n/).map((descricao) => descricao.trim()).filter(Boolean).map((descricao) => ({ descricao })),
    p_fluidos: fluidos.split(/\r?\n/).map((descricao) => descricao.trim()).filter(Boolean).map((descricao) => ({ descricao })),
    p_eventos: eventos.split(/\r?\n/).map((descricao) => descricao.trim()).filter(Boolean).map((descricao) => ({ descricao })),
    p_iniciar: iniciar,
    p_finalizar: finalizar,
    p_observacoes: observacoes || null,
  }), [asa, cirurgiaId, eventos, fluidos, medicamentos, monitor, observacoes, tecnicas, viaAerea]);

  const save = useCallback(async (iniciar = false, finalizar = false) => {
    setState("saving");
    setMessage(null);
    const { error } = await supabase.rpc("centro_cirurgico_salvar_anestesia_operacional", payload(iniciar, finalizar));
    if (error) {
      setState("error");
      setMessage(error.message);
      return false;
    }
    setState("saved");
    setLastSaved(new Date());
    if (iniciar) setInicioEm(new Date().toISOString());
    if (finalizar) setFimEm(new Date().toISOString());
    if (iniciar || finalizar) router.refresh();
    return true;
  }, [payload, router, supabase]);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (finalized) return;
    setState("dirty");
    const timer = window.setTimeout(() => void save(false, false), 1200);
    return () => window.clearTimeout(timer);
  }, [asa, eventos, finalized, fluidos, medicamentos, monitor, observacoes, save, tecnicas, viaAerea]);

  const toggleTechnique = (value: string, enabled: boolean) => {
    setTecnicas((current) => enabled ? [...new Set([...current, value])] : current.filter((item) => item !== value));
  };

  return <div className="mt-4 space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
      <p className="text-xs font-semibold text-slate-600">Rascunho salvo automaticamente em segundo plano.</p>
      <SaveIndicator state={state} lastSaved={lastSaved} />
    </div>
    <div className="grid gap-3 sm:grid-cols-2">
      <fieldset className="rounded-xl border border-slate-200 p-3 sm:col-span-2">
        <legend className="px-1 text-sm font-black text-slate-800">Tipos de anestesia <span className="font-semibold text-slate-500">(selecione um ou mais)</span></legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{techniques.map(([value, label]) => <label key={value} className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-bold ${tecnicas.includes(value) ? "border-brand-300 bg-brand-50 text-brand-800" : "border-slate-200 text-slate-700"}`}><input type="checkbox" disabled={finalized} checked={tecnicas.includes(value)} onChange={(event) => toggleTechnique(value, event.target.checked)} />{label}</label>)}</div>
      </fieldset>
      <label className="space-y-1.5 text-sm font-semibold text-slate-700"><span>ASA</span><select value={asa} disabled={finalized} onChange={(e) => setAsa(e.target.value)} className="ui-input"><option value="">Selecione</option>{["I","II","III","IV","V","VI"].map((value) => <option key={value} value={value}>ASA {value}</option>)}</select></label>
      <label className="space-y-1.5 text-sm font-semibold text-slate-700"><span>Via aérea</span><input value={viaAerea} disabled={finalized} onChange={(e) => setViaAerea(e.target.value)} className="ui-input" placeholder="Ex.: máscara laríngea, TOT" /></label>
      <div className="rounded-xl border border-slate-100 p-3 text-sm"><b className="mb-2 block">Monitorização</b>{[["ecg","ECG"],["spo2","SpO₂"],["pressao","PA"],["capnografia","Capnografia"],["temperatura","Temperatura"]].map(([key,label]) => <label key={key} className="mr-3 inline-flex items-center gap-1.5"><input type="checkbox" disabled={finalized} checked={monitor[key as keyof typeof monitor]} onChange={(e) => setMonitor((old) => ({ ...old, [key]: e.target.checked }))} />{label}</label>)}</div>
      <textarea value={medicamentos} disabled={finalized} onChange={(e) => setMedicamentos(e.target.value)} className="ui-input min-h-24" placeholder="Medicamentos — um por linha" />
      <textarea value={fluidos} disabled={finalized} onChange={(e) => setFluidos(e.target.value)} className="ui-input min-h-24" placeholder="Fluidos — um por linha" />
      <textarea value={eventos} disabled={finalized} onChange={(e) => setEventos(e.target.value)} className="ui-input min-h-24" placeholder="Eventos/intercorrências — um por linha" />
      <textarea value={observacoes} disabled={finalized} onChange={(e) => setObservacoes(e.target.value)} className="ui-input min-h-24" placeholder="Observações" />
    </div>
    {message ? <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">{message}</p> : null}
    <div className="flex flex-wrap items-center gap-3">
      {!finalized ? <button type="button" onClick={() => void save(false, false)} disabled={state === "saving"} className="ui-button-secondary"><Save className="size-4" />Salvar agora</button> : null}
      {!inicioEm && !finalized ? <button type="button" onClick={() => void save(true, false)} disabled={state === "saving" || !tecnicas.length} className="ui-button-primary"><Play className="size-4" />Registrar início</button> : null}
      {inicioEm && !finalized ? <button type="button" onClick={() => void save(false, true)} disabled={state === "saving" || !tecnicas.length} className="rounded-xl bg-rose-700 px-4 py-2 text-sm font-black text-white hover:bg-rose-800"><Square className="mr-2 inline size-4" />Finalizar anestesia</button> : null}
      <span className="text-xs text-slate-500">Início {fmt(inicioEm)} · fim {fmt(fimEm)} · horário de Brasília</span>
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
