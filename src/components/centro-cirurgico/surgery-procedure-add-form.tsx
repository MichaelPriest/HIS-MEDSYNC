"use client";

import { AlertTriangle, Plus, Search, ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type ProcedimentoContrato = {
  tabela_item_id: string;
  codigo: string;
  codigo_tuss: string | null;
  descricao: string;
  porte: string | null;
  porte_anestesico: string | null;
  fonte_codigo: string | null;
  fonte_nome: string | null;
  edicao_nome: string | null;
  numero_contrato: string | null;
};

type Props = {
  action: (formData: FormData) => void | Promise<void>;
  cirurgiaId: string;
  atendimentoId: string;
  conveniado: boolean;
  convenioNome?: string | null;
};

export function SurgeryProcedureAddForm({ action, cirurgiaId, atendimentoId, conveniado, convenioNome }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<ProcedimentoContrato[]>([]);
  const [selected, setSelected] = useState<ProcedimentoContrato | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!conveniado || selected) return;
    const term = query.trim();
    if (term.length === 1) {
      setItems([]);
      return;
    }
    let active = true;
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError(null);
      const { data, error: rpcError } = await supabase.rpc("buscar_procedimentos_cirurgicos_contrato", {
        p_atendimento_id: atendimentoId,
        p_busca: term || null,
        p_limite: 60,
      });
      if (!active) return;
      setLoading(false);
      if (rpcError) {
        setItems([]);
        setError("Não foi possível consultar os procedimentos do contrato.");
        return;
      }
      setItems((Array.isArray(data) ? data : []) as ProcedimentoContrato[]);
    }, term ? 250 : 0);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [atendimentoId, conveniado, query, selected, supabase]);

  return <form action={action} className="space-y-3">
    <input type="hidden" name="cirurgia_id" value={cirurgiaId} />
    {conveniado ? <div className="rounded-2xl border border-brand-200 bg-brand-50/50 p-4">
      <div className="flex items-start gap-3"><ShieldCheck className="mt-0.5 size-5 text-brand-700" /><div><p className="font-black text-brand-950">Adicionar procedimento conforme contrato</p><p className="mt-1 text-xs text-brand-800">{convenioNome ?? "Convênio do atendimento"}. Código, porte e porte anestésico serão revalidados no banco.</p></div></div>
      {selected ? <div className="mt-4 rounded-xl border border-emerald-200 bg-white p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-black text-slate-900">{selected.descricao}</p><p className="mt-1 text-xs text-slate-600">Cód. {selected.codigo}{selected.codigo_tuss ? ` · TUSS ${selected.codigo_tuss}` : ""} · porte {selected.porte ?? "—"} · anest. {selected.porte_anestesico ?? "—"}</p><p className="mt-1 text-xs text-slate-500">{selected.fonte_codigo ?? selected.fonte_nome ?? "Tabela"}{selected.edicao_nome ? ` · ${selected.edicao_nome}` : ""} · contrato {selected.numero_contrato ?? "ativo"}</p></div><button type="button" onClick={() => { setSelected(null); setQuery(""); setItems([]); }} className="btn-secondary h-9 text-xs">Trocar</button></div></div> : <div className="relative mt-4"><Search className="pointer-events-none absolute left-3 top-3.5 size-4 text-slate-400" /><input value={query} onChange={(event) => setQuery(event.target.value)} className="ui-input pl-9" placeholder="Buscar por descrição, código ou TUSS" autoComplete="off" />{loading ? <p className="mt-2 text-xs font-semibold text-brand-700">Consultando contrato…</p> : null}{error ? <p className="mt-2 text-xs font-semibold text-rose-700">{error}</p> : null}{!loading && !error ? <div className="mt-2 max-h-72 overflow-y-auto rounded-xl border border-brand-100 bg-white">{items.map((item) => <button key={item.tabela_item_id} type="button" onClick={() => { setSelected(item); setQuery(""); setItems([]); }} className="block w-full border-b border-slate-100 px-4 py-3 text-left last:border-b-0 hover:bg-slate-50"><strong className="block text-sm text-slate-900">{item.descricao}</strong><span className="mt-1 block text-xs text-slate-600">Cód. {item.codigo}{item.codigo_tuss ? ` · TUSS ${item.codigo_tuss}` : ""} · porte {item.porte ?? "—"} · anest. {item.porte_anestesico ?? "—"}</span></button>)}{!items.length ? <div className="p-4 text-sm text-amber-800"><AlertTriangle className="mr-2 inline size-4" />Nenhum item contratual encontrado.</div> : null}</div> : null}</div>}
      <input type="hidden" name="tabela_item_id" value={selected?.tabela_item_id ?? ""} />
      <input type="hidden" name="codigo" value={selected?.codigo_tuss ?? selected?.codigo ?? ""} />
      <input type="hidden" name="descricao" value={selected?.descricao ?? ""} />
      <input type="hidden" name="porte" value={selected?.porte ?? ""} />
      <input type="hidden" name="porte_anestesico" value={selected?.porte_anestesico ?? ""} />
    </div> : <div className="grid gap-3 md:grid-cols-2"><input name="descricao" required className="ui-input md:col-span-2" placeholder="Descrição do procedimento *" /><input name="codigo" className="ui-input" placeholder="Código / TUSS" /><input name="porte" className="ui-input" placeholder="Porte" /><input name="porte_anestesico" className="ui-input" placeholder="Porte anestésico" /><input name="observacoes" className="ui-input" placeholder="Observações" /></div>}
    {conveniado ? <input name="observacoes" className="ui-input" placeholder="Observações do procedimento" /> : null}
    <button disabled={conveniado && !selected} className="ui-button-primary disabled:cursor-not-allowed disabled:opacity-50"><Plus className="size-4" />Adicionar ao ato cirúrgico</button>
  </form>;
}
