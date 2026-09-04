"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

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
  setor_paciente?: string | null;
  andar_paciente?: string | null;
  origem_operacional?: string | null;
};

type LocationSnapshot = {
  id: string;
  setor_paciente: string | null;
  andar_paciente: string | null;
  origem_operacional: string | null;
};

type EnrichedRow = LancamentoGridRow & {
  _setorPaciente: string | null;
  _andarPaciente: string | null;
  _origemOperacional: string | null;
};

function uniq(values: Array<string | null | undefined>) {
  return [...new Set(values.filter((value): value is string => Boolean(value?.trim())).map((value) => value.trim()))]
    .sort((a, b) => a.localeCompare(b, "pt-BR"));
}

function brl(value: number | string | null) {
  return Number(value ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function date(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("pt-BR");
}

function parcial(row: LancamentoGridRow) {
  if (row.parcial_numero) return `P${row.parcial_numero}`;
  if (row.parcial_inicio || row.parcial_fim) return `${row.parcial_inicio ?? "…"} → ${row.parcial_fim ?? "…"}`;
  return "Sem parcial";
}

function chunks<T>(items: T[], size: number) {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) result.push(items.slice(index, index + size));
  return result;
}

export function LancamentosGrid({ rows }: { rows: LancamentoGridRow[] }) {
  const supabase = useMemo(() => createClient(), []);
  const [locationById, setLocationById] = useState<Record<string, LocationSnapshot>>({});
  const [busca, setBusca] = useState("");
  const [setorPaciente, setSetorPaciente] = useState("");
  const [andarPaciente, setAndarPaciente] = useState("");
  const [origemOperacional, setOrigemOperacional] = useState("");
  const [setorSubgrupo, setSetorSubgrupo] = useState("");
  const [grupo, setGrupo] = useState("");
  const [parcialFiltro, setParcialFiltro] = useState("");
  const [inicio, setInicio] = useState("");
  const [fim, setFim] = useState("");

  useEffect(() => {
    const ids = rows
      .filter((row) => row.setor_paciente === undefined || row.andar_paciente === undefined || row.origem_operacional === undefined)
      .map((row) => row.id);
    if (!ids.length) return;

    let active = true;
    void (async () => {
      const next: Record<string, LocationSnapshot> = {};
      for (const part of chunks(ids, 100)) {
        const { data } = await supabase
          .from("conta_faturamento_itens")
          .select("id,setor_paciente,andar_paciente,origem_operacional")
          .in("id", part);
        for (const item of (data ?? []) as LocationSnapshot[]) next[item.id] = item;
      }
      if (active) setLocationById(next);
    })();

    return () => { active = false; };
  }, [rows, supabase]);

  const enriched = useMemo<EnrichedRow[]>(() => rows.map((row) => {
    const snapshot = locationById[row.id];
    return {
      ...row,
      _setorPaciente: row.setor_paciente ?? snapshot?.setor_paciente ?? null,
      _andarPaciente: row.andar_paciente ?? snapshot?.andar_paciente ?? null,
      _origemOperacional: row.origem_operacional ?? snapshot?.origem_operacional ?? row.setor ?? null,
    };
  }), [locationById, rows]);

  const setoresPaciente = useMemo(() => uniq(enriched.map((row) => row._setorPaciente)), [enriched]);
  const andaresPaciente = useMemo(() => uniq(enriched.filter((row) => !setorPaciente || row._setorPaciente === setorPaciente).map((row) => row._andarPaciente)), [enriched, setorPaciente]);
  const origensOperacionais = useMemo(() => uniq(enriched.map((row) => row._origemOperacional)), [enriched]);
  const subSetores = useMemo(() => uniq(enriched.map((row) => row.setor_subgrupo)), [enriched]);
  const grupos = useMemo(() => uniq(enriched.map((row) => row.subgrupo_item ?? row.categoria_item)), [enriched]);
  const parciais = useMemo(() => uniq(enriched.map(parcial)), [enriched]);

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLocaleLowerCase("pt-BR");
    return enriched.filter((row) => {
      const data = row.data_execucao?.slice(0, 10) ?? "";
      const texto = `${row.codigo ?? ""} ${row.descricao} ${row.tabela ?? ""} ${row._setorPaciente ?? ""} ${row._andarPaciente ?? ""} ${row._origemOperacional ?? ""}`.toLocaleLowerCase("pt-BR");
      return (!termo || texto.includes(termo))
        && (!setorPaciente || row._setorPaciente === setorPaciente)
        && (!andarPaciente || row._andarPaciente === andarPaciente)
        && (!origemOperacional || row._origemOperacional === origemOperacional)
        && (!setorSubgrupo || row.setor_subgrupo === setorSubgrupo)
        && (!grupo || (row.subgrupo_item ?? row.categoria_item) === grupo)
        && (!parcialFiltro || parcial(row) === parcialFiltro)
        && (!inicio || data >= inicio)
        && (!fim || data <= fim);
    });
  }, [andarPaciente, busca, enriched, fim, grupo, inicio, origemOperacional, parcialFiltro, setorPaciente, setorSubgrupo]);

  const total = useMemo(() => filtrados.reduce((sum, row) => sum + Number(row.valor_total ?? 0), 0), [filtrados]);
  const limpar = () => {
    setBusca("");
    setSetorPaciente("");
    setAndarPaciente("");
    setOrigemOperacional("");
    setSetorSubgrupo("");
    setGrupo("");
    setParcialFiltro("");
    setInicio("");
    setFim("");
  };

  return <div className="border-b border-slate-200 bg-white">
    <div className="border-b border-slate-200 bg-sky-50/70 px-4 py-3 text-xs leading-5 text-sky-900">
      <strong>Localização assistencial:</strong> Setor do paciente e Andar representam onde o paciente estava no momento do lançamento. <strong>Origem operacional</strong> identifica quem gerou ou forneceu o item, como Farmácia, Centro Cirúrgico ou Laboratório. Quando não existir histórico confiável, a localização permanece como “Não identificada”.
    </div>
    <div className="grid gap-2 border-b border-slate-200 bg-slate-50 p-3 md:grid-cols-2 xl:grid-cols-5 2xl:grid-cols-9">
      <input value={busca} onChange={(event) => setBusca(event.target.value)} className="ui-input" placeholder="Código, descrição ou localização" />
      <select value={setorPaciente} onChange={(event) => { setSetorPaciente(event.target.value); setAndarPaciente(""); }} className="ui-input"><option value="">Todos os setores do paciente</option>{setoresPaciente.map((value) => <option key={value}>{value}</option>)}</select>
      <select value={andarPaciente} onChange={(event) => setAndarPaciente(event.target.value)} className="ui-input"><option value="">Todos os andares</option>{andaresPaciente.map((value) => <option key={value}>{value}</option>)}</select>
      <select value={origemOperacional} onChange={(event) => setOrigemOperacional(event.target.value)} className="ui-input"><option value="">Todas as origens</option>{origensOperacionais.map((value) => <option key={value}>{value}</option>)}</select>
      <select value={setorSubgrupo} onChange={(event) => setSetorSubgrupo(event.target.value)} className="ui-input"><option value="">Subgrupo do setor</option>{subSetores.map((value) => <option key={value}>{value}</option>)}</select>
      <select value={grupo} onChange={(event) => setGrupo(event.target.value)} className="ui-input"><option value="">Grupo do item</option>{grupos.map((value) => <option key={value}>{value}</option>)}</select>
      <select value={parcialFiltro} onChange={(event) => setParcialFiltro(event.target.value)} className="ui-input"><option value="">Todas as parciais</option>{parciais.map((value) => <option key={value}>{value}</option>)}</select>
      <div className="grid grid-cols-2 gap-2"><input type="date" value={inicio} onChange={(event) => setInicio(event.target.value)} className="ui-input" title="Data inicial" /><input type="date" value={fim} onChange={(event) => setFim(event.target.value)} className="ui-input" title="Data final" /></div>
      <button type="button" onClick={limpar} className="ui-button-secondary">Limpar filtros</button>
    </div>
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-2 text-xs text-slate-500"><span>{filtrados.length} de {rows.length} lançamento(s)</span><strong className="text-slate-900">Total filtrado: {brl(total)}</strong></div>
    <div className="max-h-[560px] overflow-auto">
      <table className="min-w-[1880px] w-full border-collapse text-left text-xs">
        <thead className="sticky top-0 z-10 bg-slate-100 text-[11px] uppercase text-slate-600"><tr>
          {['Data','Parcial','Setor do paciente','Andar','Origem operacional','Subgrupo setor','Grupo item','Tabela','Código','Descrição','Qtd.','Valor unit.','Total','Origem preço','Ação'].map((header) => <th key={header} className="border border-slate-300 px-2 py-2 font-bold">{header}</th>)}
        </tr></thead>
        <tbody>{filtrados.length ? filtrados.map((row) => <tr key={row.id} className="odd:bg-white even:bg-slate-50/70 hover:bg-brand-50/50">
          <td className="whitespace-nowrap border border-slate-200 px-2 py-1.5">{date(row.data_execucao)}</td>
          <td className="whitespace-nowrap border border-slate-200 px-2 py-1.5">{parcial(row)}</td>
          <td className="border border-slate-200 px-2 py-1.5 font-semibold text-slate-800">{row._setorPaciente ?? "Não identificada"}</td>
          <td className="border border-slate-200 px-2 py-1.5">{row._andarPaciente ?? "Não identificado"}</td>
          <td className="border border-slate-200 px-2 py-1.5"><span className="rounded-lg bg-slate-100 px-2 py-1 font-semibold text-slate-700">{row._origemOperacional ?? "Não identificada"}</span></td>
          <td className="border border-slate-200 px-2 py-1.5">{row.setor_subgrupo ?? "—"}</td>
          <td className="border border-slate-200 px-2 py-1.5">{row.subgrupo_item ?? row.categoria_item ?? "—"}</td>
          <td className="border border-slate-200 px-2 py-1.5 font-mono">{row.tabela ?? "—"}</td>
          <td className="border border-slate-200 px-2 py-1.5 font-mono">{row.codigo ?? "—"}</td>
          <td className="max-w-[360px] border border-slate-200 px-2 py-1.5 font-medium">{row.descricao}</td>
          <td className="border border-slate-200 px-2 py-1.5 text-right">{Number(row.quantidade ?? 0).toLocaleString("pt-BR")}</td>
          <td className="border border-slate-200 px-2 py-1.5 text-right">{brl(row.valor_unitario)}</td>
          <td className="border border-slate-200 px-2 py-1.5 text-right font-semibold">{brl(row.valor_total)}</td>
          <td className="border border-slate-200 px-2 py-1.5">{row.origem_valor ?? "—"}</td>
          <td className="border border-slate-200 px-2 py-1.5"><a href={`#editar-${row.id}`} className="font-semibold text-brand-700 hover:underline">Editar</a></td>
        </tr>) : <tr><td colSpan={15} className="border border-slate-200 p-8 text-center text-slate-500">Nenhum lançamento corresponde aos filtros.</td></tr>}</tbody>
      </table>
    </div>
  </div>;
}
