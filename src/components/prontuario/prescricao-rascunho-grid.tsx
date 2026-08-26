"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, RefreshCw } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { adicionarItemPrescricaoDiaAsyncAction } from "@/modules/prontuario-medico/prescricao-dia-async-action";

type Linha = {
  id: string;
  tipo: string;
  item: string;
  detalhe: string;
  via: string;
  frequencia: string;
  horarios: string;
  criadoEm: string;
};

function fmtHorarios(value: unknown) {
  if (Array.isArray(value)) return value.map(String).join(", ");
  if (typeof value === "string") return value;
  return "—";
}

export function PrescricaoRascunhoGrid({ empresaId, atendimentoId }: { empresaId: string; atendimentoId: string }) {
  const supabase = useMemo(() => createClient(), []);
  const sectionRef = useRef<HTMLElement>(null);
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    const [prescricoes, exames, procedimentos, materiais] = await Promise.all([
      supabase.from("prescricoes").select("id,tipo,item,dose,unidade_dose,via,frequencia,horarios,created_at").eq("empresa_id", empresaId).eq("atendimento_id", atendimentoId).eq("status", "rascunho").order("created_at"),
      supabase.from("solicitacoes_exames").select("id,modalidade,exame,prioridade,created_at").eq("empresa_id", empresaId).eq("atendimento_id", atendimentoId).eq("status", "rascunho").order("created_at"),
      supabase.from("procedimentos_assistenciais").select("id,procedimento,quantidade,unidade_medida,lateralidade,created_at").eq("empresa_id", empresaId).eq("atendimento_id", atendimentoId).eq("status", "rascunho").order("created_at"),
      supabase.from("solicitacoes_materiais_assistenciais").select("id,categoria,descricao,quantidade,unidade_medida,created_at").eq("empresa_id", empresaId).eq("atendimento_id", atendimentoId).eq("status", "rascunho").order("created_at"),
    ]);
    const itens: Linha[] = [];
    for (const p of prescricoes.data ?? []) itens.push({ id: `p-${p.id}`, tipo: p.tipo === "medicamento" ? "Medicamento" : p.tipo === "dieta" ? "Dieta" : p.tipo === "cuidado" ? "Cuidado" : p.tipo, item: p.item ?? "—", detalhe: [p.dose, p.unidade_dose].filter(Boolean).join(" ") || "—", via: p.via ?? "—", frequencia: p.frequencia ?? "—", horarios: fmtHorarios(p.horarios), criadoEm: p.created_at });
    for (const e of exames.data ?? []) itens.push({ id: `e-${e.id}`, tipo: e.modalidade === "laboratorio" ? "Exame · Laboratório" : "Exame · Imagem", item: e.exame ?? "—", detalhe: "—", via: "—", frequencia: e.prioridade ?? "rotina", horarios: "—", criadoEm: e.created_at });
    for (const p of procedimentos.data ?? []) itens.push({ id: `proc-${p.id}`, tipo: "Procedimento", item: p.procedimento ?? "—", detalhe: `${p.quantidade ?? 1} ${p.unidade_medida ?? "UN"}`, via: p.lateralidade ?? "—", frequencia: "—", horarios: "—", criadoEm: p.created_at });
    for (const m of materiais.data ?? []) itens.push({ id: `m-${m.id}`, tipo: String(m.categoria ?? "Material").toUpperCase(), item: m.descricao ?? "—", detalhe: `${m.quantidade ?? 1} ${m.unidade_medida ?? "UN"}`, via: "—", frequencia: "—", horarios: "—", criadoEm: m.created_at });
    itens.sort((a, b) => new Date(a.criadoEm).getTime() - new Date(b.criadoEm).getTime());
    setLinhas(itens);
    setCarregando(false);
  }, [atendimentoId, empresaId, supabase]);

  useEffect(() => { void carregar(); }, [carregar]);

  useEffect(() => {
    const section = sectionRef.current;
    const form = section?.previousElementSibling;
    if (!(form instanceof HTMLFormElement)) return;

    const submit = async (event: Event) => {
      event.preventDefault();
      if (salvando) return;
      setSalvando(true);
      setMensagem(null);
      const resultado = await adicionarItemPrescricaoDiaAsyncAction(new FormData(form));
      if (!resultado.ok) {
        setMensagem({ tipo: "erro", texto: resultado.erro });
        setSalvando(false);
        return;
      }
      setMensagem({ tipo: "ok", texto: "Item salvo no rascunho. Você já pode adicionar o próximo." });
      form.reset();
      await carregar();
      setSalvando(false);
    };

    form.addEventListener("submit", submit);
    return () => form.removeEventListener("submit", submit);
  }, [carregar, salvando]);

  return <section ref={sectionRef} className="rounded-2xl border border-slate-200 bg-white">
    {mensagem ? <div className={`flex items-center gap-2 border-b px-4 py-3 text-sm font-semibold ${mensagem.tipo === "ok" ? "border-emerald-100 bg-emerald-50 text-emerald-700" : "border-rose-100 bg-rose-50 text-rose-700"}`}>{mensagem.tipo === "ok" ? <CheckCircle2 className="size-4"/> : null}{mensagem.texto}</div> : null}
    {salvando ? <div className="flex items-center gap-2 border-b border-blue-100 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-700"><RefreshCw className="size-4 animate-spin"/>Salvando item em segundo plano...</div> : null}
    <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
      <div><h3 className="font-black text-slate-950">Itens já adicionados à prescrição do dia</h3><p className="text-xs text-slate-500">O rascunho é atualizado sem recarregar a página. Os itens só são liberados aos setores após a assinatura.</p></div>
      <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-black text-amber-800">{linhas.length} item(ns)</span>
    </div>
    <div className="overflow-x-auto">
      <table className="min-w-[980px] w-full text-sm">
        <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500"><tr><th className="px-3 py-3">Ordem</th><th className="px-3 py-3">Tipo</th><th className="px-3 py-3">Item</th><th className="px-3 py-3">Dose / Quantidade</th><th className="px-3 py-3">Via / Lateralidade</th><th className="px-3 py-3">Frequência / Prioridade</th><th className="px-3 py-3">Horários</th><th className="px-3 py-3">Status</th></tr></thead>
        <tbody className="divide-y divide-slate-100">
          {linhas.map((linha, index) => <tr key={linha.id} className="align-top hover:bg-slate-50"><td className="px-3 py-3 font-black text-slate-500">{String(index + 1).padStart(2, "0")}</td><td className="px-3 py-3"><span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-bold text-slate-700">{linha.tipo}</span></td><td className="px-3 py-3 font-bold text-slate-950">{linha.item}</td><td className="px-3 py-3 text-slate-700">{linha.detalhe}</td><td className="px-3 py-3 text-slate-700">{linha.via}</td><td className="px-3 py-3 text-slate-700">{linha.frequencia}</td><td className="px-3 py-3 font-semibold text-brand-700">{linha.horarios}</td><td className="px-3 py-3"><span className="rounded-full bg-amber-50 px-2 py-1 text-xs font-black text-amber-700">Rascunho</span></td></tr>)}
          {!carregando && linhas.length === 0 ? <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-500">Nenhum item adicionado ainda.</td></tr> : null}
          {carregando ? <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-500"><span className="inline-flex items-center gap-2"><RefreshCw className="size-4 animate-spin"/>Atualizando itens...</span></td></tr> : null}
        </tbody>
      </table>
    </div>
  </section>;
}
