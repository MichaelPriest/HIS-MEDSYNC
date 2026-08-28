"use client";

import { AlertTriangle, Plus, Search, ShieldCheck, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { EncounterPicker } from "@/components/atendimentos/encounter-picker";
import { ProfessionalRemotePicker } from "@/components/profissionais/professional-remote-picker";
import { createClient } from "@/lib/supabase/client";

type Encounter = {
  id: string;
  numero_atendimento: string | number | null;
  data_abertura?: string | null;
  cobertura?: string | null;
  convenio_nome?: string | null;
  paciente: {
    nome_completo: string;
    cpf?: string | null;
    ra?: string | null;
    numero_registro?: string | number | null;
  };
};

type Sala = {
  sala_id: string;
  codigo: string;
  nome: string;
  equipamentos_prontos: boolean;
};

type ProcedimentoContrato = {
  tabela_item_id: string;
  codigo: string;
  codigo_tuss: string | null;
  descricao: string;
  porte: string | null;
  porte_anestesico: string | null;
  tabela_tiss_codigo: string | null;
  fonte_codigo: string | null;
  fonte_nome: string | null;
  edicao_nome: string | null;
  prioridade: number;
  convenio_id: string;
  convenio_nome: string;
  contrato_id: string;
  numero_contrato: string | null;
};

type Props = {
  action: (formData: FormData) => void | Promise<void>;
  empresaId: string;
  encounters: Encounter[];
  salas: Sala[];
};

export function SurgerySchedulingForm({ action, empresaId, encounters, salas }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [atendimentoId, setAtendimentoId] = useState("");
  const [query, setQuery] = useState("");
  const [procedimentos, setProcedimentos] = useState<ProcedimentoContrato[]>([]);
  const [selecionados, setSelecionados] = useState<ProcedimentoContrato[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const atendimento = encounters.find((item) => item.id === atendimentoId) ?? null;
  const conveniado = atendimento?.cobertura === "convenio";
  const procedimento = selecionados[0] ?? null;

  useEffect(() => {
    setSelecionados([]);
    setQuery("");
    setProcedimentos([]);
    setSearchError(null);
  }, [atendimentoId]);

  useEffect(() => {
    if (!atendimentoId || !conveniado) return;
    const term = query.trim();
    if (term.length === 1) {
      setProcedimentos([]);
      return;
    }

    let active = true;
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setSearchError(null);
      const { data, error } = await supabase.rpc("buscar_procedimentos_cirurgicos_contrato", {
        p_atendimento_id: atendimentoId,
        p_busca: term || null,
        p_limite: 50,
      });
      if (!active) return;
      setLoading(false);
      if (error) {
        setProcedimentos([]);
        setSearchError("Não foi possível consultar a tabela contratual deste atendimento.");
        return;
      }
      setProcedimentos((Array.isArray(data) ? data : []) as ProcedimentoContrato[]);
    }, term ? 260 : 0);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [atendimentoId, conveniado, query, supabase]);

  function selectProcedure(item: ProcedimentoContrato) {
    setSelecionados((current) => current.some((selected) => selected.tabela_item_id === item.tabela_item_id) ? current : [...current, item]);
    setQuery("");
    setProcedimentos([]);
  }

  return <form action={action} className="grid gap-4 lg:grid-cols-4">
    <div className="lg:col-span-4">
      <EncounterPicker encounters={encounters} name="atendimento_id" onChange={setAtendimentoId} />
    </div>

    {atendimentoId && conveniado ? <div className="lg:col-span-4 rounded-2xl border border-brand-200 bg-brand-50/60 p-4">
      <div className="flex items-start gap-3">
        <ShieldCheck className="mt-0.5 size-5 shrink-0 text-brand-700" />
        <div className="min-w-0 flex-1">
          <p className="font-black text-brand-950">Procedimento conforme contrato do convênio</p>
          <p className="mt-1 text-sm text-brand-800">{atendimento?.convenio_nome ?? "Convênio do atendimento"}. Código, TUSS e porte serão validados novamente pelo banco ao salvar.</p>

          {selecionados.length ? <div className="mt-4 space-y-2">{selecionados.map((item, index) => <div key={item.tabela_item_id} className="rounded-xl border border-emerald-200 bg-white p-4"><div className="flex items-start justify-between gap-3"><div><span className="text-[10px] font-black uppercase text-brand-600">{index === 0 ? "Procedimento principal" : `Procedimento adicional ${index}`}</span><strong className="mt-1 block text-sm text-slate-950">{item.descricao}</strong><p className="mt-1 text-xs text-slate-600">Código {item.codigo}{item.codigo_tuss ? ` · TUSS ${item.codigo_tuss}` : ""} · porte {item.porte ?? "—"} · anest. {item.porte_anestesico ?? "—"}</p></div><button type="button" aria-label={`Remover ${item.descricao}`} onClick={() => setSelecionados((current) => current.filter((selected) => selected.tabela_item_id !== item.tabela_item_id))} className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-700"><X className="size-4" /></button></div></div>)}</div> : null}
          <div className="relative mt-4">
            <Search className="pointer-events-none absolute left-3 top-3.5 size-4 text-slate-400" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={selecionados.length ? "Buscar e adicionar outra cirurgia/procedimento" : "Buscar por descrição, código contratado ou TUSS"} className="ui-input pl-9" autoComplete="off" />
            {loading ? <p className="mt-2 text-xs font-medium text-brand-700">Consultando contrato…</p> : null}
            {searchError ? <p className="mt-2 text-xs font-medium text-rose-700">{searchError}</p> : null}
            {!loading && !searchError ? <div className="mt-2 max-h-72 overflow-y-auto rounded-xl border border-brand-100 bg-white">
              {procedimentos.filter((item) => !selecionados.some((selected) => selected.tabela_item_id === item.tabela_item_id)).map((item) => <button key={item.tabela_item_id} type="button" onClick={() => selectProcedure(item)} className="block w-full border-b border-slate-100 px-4 py-3 text-left last:border-b-0 hover:bg-slate-50">
                <strong className="block text-sm text-slate-900">{item.descricao}</strong>
                <span className="mt-1 block text-xs text-slate-600">Cód. {item.codigo}{item.codigo_tuss ? ` · TUSS ${item.codigo_tuss}` : ""} · Porte {item.porte ?? "—"} · anest. {item.porte_anestesico ?? "—"}</span>
                <span className="mt-1 block text-xs text-slate-500"><Plus className="mr-1 inline size-3" />Adicionar ao mesmo ato · {item.fonte_codigo ?? item.fonte_nome ?? "Tabela"}{item.edicao_nome ? ` · ${item.edicao_nome}` : ""}</span>
              </button>)}
              {!procedimentos.length ? <div className="p-4 text-sm text-amber-800"><AlertTriangle className="mr-2 inline size-4" />Nenhum procedimento contratual disponível. Verifique se os itens da tabela vinculada ao contrato foram importados e estão vigentes.</div> : null}
            </div> : null}
          </div>
        </div>
      </div>
      <input type="hidden" name="procedimento" value={procedimento?.descricao ?? ""} />
      <input type="hidden" name="codigo_tuss" value={procedimento?.codigo_tuss ?? procedimento?.codigo ?? ""} />
      <input type="hidden" name="porte" value={procedimento?.porte ?? ""} />
      <input type="hidden" name="procedimentos_adicionais" value={JSON.stringify(selecionados.slice(1).map((item) => item.tabela_item_id))} />
    </div> : null}

    {atendimentoId && !conveniado ? <>
      <label className="space-y-2 text-sm font-medium text-slate-700 lg:col-span-2"><span>Procedimento *</span><input name="procedimento" required className="ui-input" placeholder="Procedimento" /></label>
      <label className="space-y-2 text-sm font-medium text-slate-700"><span>Código / TUSS</span><input name="codigo_tuss" className="ui-input" placeholder="Código" /></label>
      <label className="space-y-2 text-sm font-medium text-slate-700"><span>Porte</span><input name="porte" className="ui-input" placeholder="Porte" /></label>
      <label className="space-y-2 text-sm font-medium text-slate-700 lg:col-span-4"><span>Cirurgias/procedimentos adicionais</span><textarea name="procedimentos_adicionais_livres" className="ui-input min-h-24" placeholder="Informe um procedimento adicional por linha. Todos permanecerão no mesmo ato cirúrgico e atendimento." /></label>
    </> : null}

    {!atendimentoId ? <div className="lg:col-span-4 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">Selecione o atendimento para definir a cobertura e carregar os procedimentos permitidos.</div> : null}

    <label className="space-y-2 text-sm font-medium text-slate-700 lg:col-span-2"><span>Descrição cirúrgica / técnica</span><input name="cirurgia" className="ui-input" placeholder="Descrição complementar da cirurgia" /></label>
    <label className="space-y-2 text-sm font-medium text-slate-700"><span>Lateralidade</span><select name="lateralidade" defaultValue="" className="ui-input"><option value="">Selecione</option><option value="direita">Direita</option><option value="esquerda">Esquerda</option><option value="bilateral">Bilateral</option><option value="nao_aplicavel">Não aplicável</option></select></label>
    <label className="space-y-2 text-sm font-medium text-slate-700"><span>Sala *</span><select name="sala" defaultValue="" className="ui-input" required><option value="">Selecione</option>{salas.map((sala) => <option key={sala.sala_id} value={sala.codigo}>{sala.codigo} · {sala.nome}{sala.equipamentos_prontos ? " · pronta" : " · pendência"}</option>)}</select></label>
    <label className="space-y-2 text-sm font-medium text-slate-700"><span>Classificação</span><select name="classificacao" defaultValue="" className="ui-input"><option value="">Selecione</option><option value="eletiva">Eletiva</option><option value="urgencia">Urgência</option><option value="emergencia">Emergência</option></select></label>
    <label className="space-y-2 text-sm font-medium text-slate-700"><span>Início previsto *</span><input name="inicio_previsto" type="datetime-local" required className="ui-input" /></label>
    <div className="lg:col-span-2"><ProfessionalRemotePicker empresaId={empresaId} name="cirurgiao_id" label="Cirurgião responsável" /></div>
    <div className="lg:col-span-2"><ProfessionalRemotePicker empresaId={empresaId} name="anestesista_id" label="Anestesista" /></div>
    <label className="space-y-2 text-sm font-medium text-slate-700 lg:col-span-3"><span>Diagnóstico pré-operatório</span><input name="diagnostico_pre" className="ui-input" placeholder="Diagnóstico / indicação clínica" /></label>
    <button disabled={!atendimentoId || (Boolean(conveniado) && !procedimento)} className="ui-button-primary self-end disabled:cursor-not-allowed disabled:opacity-50">Registrar agendamento</button>
  </form>;
}
