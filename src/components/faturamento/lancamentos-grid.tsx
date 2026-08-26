"use client";

import { useMemo, useState } from "react";

export type LancamentoGridRow = {
  id: string;
  data_execucao: string | null;
  tabela: string | null;
  codigo: string | null;
  descricao: string;
  quantidade: number | string | null;
  valor_unitario: number | string | null;
  valor_total: number | string | null;
  setor: string | null;
  setor_subgrupo: string | null;
  categoria_item: string | null;
  subgrupo_item: string | null;
  parcial_numero: number | null;
  parcial_inicio: string | null;
  parcial_fim: string | null;
  origem_valor: string | null;
};

function uniq(values: Array<string | null | undefined>) {
  return [...new Set(values.filter((v): v is string => Boolean(v?.trim())).map((v) => v.trim()))].sort((a,b)=>a.localeCompare(b,"pt-BR"));
}
function brl(value: number | string | null) {
  return Number(value ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function date(value: string | null) {
  if(!value) return "—";
  return new Date(value).toLocaleDateString("pt-BR");
}
function parcial(row: LancamentoGridRow) {
  if(row.parcial_numero) return `P${row.parcial_numero}`;
  if(row.parcial_inicio || row.parcial_fim) return `${row.parcial_inicio??"…"} → ${row.parcial_fim??"…"}`;
  return "Sem parcial";
}

export function LancamentosGrid({ rows }: { rows: LancamentoGridRow[] }) {
  const [busca,setBusca]=useState("");
  const [setor,setSetor]=useState("");
  const [setorSubgrupo,setSetorSubgrupo]=useState("");
  const [grupo,setGrupo]=useState("");
  const [parcialFiltro,setParcialFiltro]=useState("");
  const [inicio,setInicio]=useState("");
  const [fim,setFim]=useState("");

  const setores=useMemo(()=>uniq(rows.map(r=>r.setor)),[rows]);
  const subSetores=useMemo(()=>uniq(rows.filter(r=>!setor||r.setor===setor).map(r=>r.setor_subgrupo)),[rows,setor]);
  const grupos=useMemo(()=>uniq(rows.map(r=>r.subgrupo_item??r.categoria_item)),[rows]);
  const parciais=useMemo(()=>uniq(rows.map(parcial)),[rows]);

  const filtrados=useMemo(()=>{
    const termo=busca.trim().toLocaleLowerCase("pt-BR");
    return rows.filter(row=>{
      const data=row.data_execucao?.slice(0,10)??"";
      const texto=`${row.codigo??""} ${row.descricao} ${row.tabela??""}`.toLocaleLowerCase("pt-BR");
      return (!termo||texto.includes(termo))
        &&(!setor||row.setor===setor)
        &&(!setorSubgrupo||row.setor_subgrupo===setorSubgrupo)
        &&(!grupo||(row.subgrupo_item??row.categoria_item)===grupo)
        &&(!parcialFiltro||parcial(row)===parcialFiltro)
        &&(!inicio||data>=inicio)
        &&(!fim||data<=fim);
    });
  },[rows,busca,setor,setorSubgrupo,grupo,parcialFiltro,inicio,fim]);

  const total=useMemo(()=>filtrados.reduce((s,r)=>s+Number(r.valor_total??0),0),[filtrados]);
  const limpar=()=>{setBusca("");setSetor("");setSetorSubgrupo("");setGrupo("");setParcialFiltro("");setInicio("");setFim("");};

  return <div className="border-b border-slate-200 bg-white">
    <div className="grid gap-2 border-b border-slate-200 bg-slate-50 p-3 md:grid-cols-2 xl:grid-cols-7">
      <input value={busca} onChange={e=>setBusca(e.target.value)} className="ui-input" placeholder="Código ou descrição"/>
      <select value={setor} onChange={e=>{setSetor(e.target.value);setSetorSubgrupo("");}} className="ui-input"><option value="">Todos os setores</option>{setores.map(v=><option key={v}>{v}</option>)}</select>
      <select value={setorSubgrupo} onChange={e=>setSetorSubgrupo(e.target.value)} className="ui-input"><option value="">Subgrupo do setor</option>{subSetores.map(v=><option key={v}>{v}</option>)}</select>
      <select value={grupo} onChange={e=>setGrupo(e.target.value)} className="ui-input"><option value="">Grupo do item</option>{grupos.map(v=><option key={v}>{v}</option>)}</select>
      <select value={parcialFiltro} onChange={e=>setParcialFiltro(e.target.value)} className="ui-input"><option value="">Todas as parciais</option>{parciais.map(v=><option key={v}>{v}</option>)}</select>
      <div className="grid grid-cols-2 gap-2"><input type="date" value={inicio} onChange={e=>setInicio(e.target.value)} className="ui-input" title="Data inicial"/><input type="date" value={fim} onChange={e=>setFim(e.target.value)} className="ui-input" title="Data final"/></div>
      <button type="button" onClick={limpar} className="ui-button-secondary">Limpar filtros</button>
    </div>
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-2 text-xs text-slate-500"><span>{filtrados.length} de {rows.length} lançamento(s)</span><strong className="text-slate-900">Total filtrado: {brl(total)}</strong></div>
    <div className="max-h-[520px] overflow-auto">
      <table className="min-w-[1500px] w-full border-collapse text-left text-xs">
        <thead className="sticky top-0 z-10 bg-slate-100 text-[11px] uppercase text-slate-600"><tr>
          {['Data','Parcial','Setor','Subgrupo setor','Grupo item','Tabela','Código','Descrição','Qtd.','Valor unit.','Total','Origem preço','Ação'].map(h=><th key={h} className="border border-slate-300 px-2 py-2 font-bold">{h}</th>)}
        </tr></thead>
        <tbody>{filtrados.length?filtrados.map(row=><tr key={row.id} className="odd:bg-white even:bg-slate-50/70 hover:bg-brand-50/50">
          <td className="whitespace-nowrap border border-slate-200 px-2 py-1.5">{date(row.data_execucao)}</td>
          <td className="whitespace-nowrap border border-slate-200 px-2 py-1.5">{parcial(row)}</td>
          <td className="border border-slate-200 px-2 py-1.5">{row.setor??"—"}</td>
          <td className="border border-slate-200 px-2 py-1.5">{row.setor_subgrupo??"—"}</td>
          <td className="border border-slate-200 px-2 py-1.5">{row.subgrupo_item??row.categoria_item??"—"}</td>
          <td className="border border-slate-200 px-2 py-1.5 font-mono">{row.tabela??"—"}</td>
          <td className="border border-slate-200 px-2 py-1.5 font-mono">{row.codigo??"—"}</td>
          <td className="max-w-[360px] border border-slate-200 px-2 py-1.5 font-medium">{row.descricao}</td>
          <td className="border border-slate-200 px-2 py-1.5 text-right">{Number(row.quantidade??0).toLocaleString("pt-BR")}</td>
          <td className="border border-slate-200 px-2 py-1.5 text-right">{brl(row.valor_unitario)}</td>
          <td className="border border-slate-200 px-2 py-1.5 text-right font-semibold">{brl(row.valor_total)}</td>
          <td className="border border-slate-200 px-2 py-1.5">{row.origem_valor??"—"}</td>
          <td className="border border-slate-200 px-2 py-1.5"><a href={`#editar-${row.id}`} className="font-semibold text-brand-700 hover:underline">Editar</a></td>
        </tr>):<tr><td colSpan={13} className="border border-slate-200 p-8 text-center text-slate-500">Nenhum lançamento corresponde aos filtros.</td></tr>}</tbody>
      </table>
    </div>
  </div>;
}
