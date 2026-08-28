"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Eye, FileHeart, X } from "lucide-react";

export type HistoricoClinicoModalItem = {
  id: string;
  tipo: string;
  data: string;
  assinado: boolean;
  profissional: string | null;
  resumo: string | null;
  detalhes: Array<{ label: string; value: string | null }>;
};

export function HistoricoClinicoModal({ itens }: { itens: HistoricoClinicoModalItem[] }) {
  const [aberto, setAberto] = useState<HistoricoClinicoModalItem | null>(null);

  useEffect(() => {
    if (!aberto) return;
    const anterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setAberto(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = anterior;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [aberto]);

  return (
    <>
      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        {itens.map((item) => (
          <button
            type="button"
            key={`${item.tipo}-${item.id}`}
            onClick={() => setAberto(item)}
            className="group rounded-2xl border border-slate-200 p-4 text-left transition hover:border-brand-300 hover:bg-brand-50/40 hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
          >
            <div className="flex items-center justify-between gap-3">
              <strong className="text-sm text-slate-900">{item.tipo}</strong>
              {item.assinado ? <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-black text-emerald-700">ASSINADO</span> : <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-black text-amber-700">RASCUNHO</span>}
            </div>
            <p className="mt-1 text-xs text-slate-400">{formatarData(item.data)} · {item.profissional || "Profissional"}</p>
            {item.resumo ? <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-600">{item.resumo}</p> : null}
            <span className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-brand-700"><Eye className="size-3.5" />Clique para visualizar o registro completo</span>
          </button>
        ))}
      </div>

      {aberto ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/55 p-3 sm:p-6" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setAberto(null); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="historico-clinico-titulo" className="max-h-[92vh] w-full max-w-4xl overflow-hidden rounded-3xl bg-white shadow-2xl">
            <header className="flex items-start justify-between gap-4 border-b border-slate-200 bg-slate-50 px-5 py-4 sm:px-6">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="grid size-9 place-items-center rounded-xl bg-brand-100 text-brand-700"><FileHeart className="size-4.5" /></span>
                  <div><p className="text-[10px] font-black uppercase tracking-[.14em] text-brand-600">Histórico clínico deste atendimento</p><h2 id="historico-clinico-titulo" className="text-lg font-black text-slate-950">{aberto.tipo}</h2></div>
                  {aberto.assinado ? <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-black text-emerald-700"><CheckCircle2 className="size-3" />ASSINADO</span> : <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-black text-amber-700">RASCUNHO</span>}
                </div>
                <p className="mt-2 text-xs text-slate-500">{formatarData(aberto.data)} · {aberto.profissional || "Profissional"}</p>
              </div>
              <button type="button" onClick={() => setAberto(null)} className="grid size-9 shrink-0 place-items-center rounded-xl text-slate-500 transition hover:bg-slate-200 hover:text-slate-900" aria-label="Fechar detalhes"><X className="size-5" /></button>
            </header>

            <div className="max-h-[calc(92vh-92px)] overflow-y-auto p-5 sm:p-6">
              <div className="grid gap-4 md:grid-cols-2">
                {aberto.detalhes.filter((campo) => campo.value?.trim()).map((campo) => (
                  <div key={campo.label} className="rounded-2xl border border-slate-200 bg-white p-4 md:even:last:col-span-2">
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">{campo.label}</p>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{campo.value}</p>
                  </div>
                ))}
              </div>
              {!aberto.detalhes.some((campo) => campo.value?.trim()) ? <p className="rounded-2xl bg-slate-50 p-5 text-sm text-slate-500">Este registro não possui conteúdo adicional preenchido.</p> : null}
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}

function formatarData(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(value));
}
