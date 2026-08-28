import type { Route } from "next";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  BookOpenCheck,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Database,
  FileClock,
  Handshake,
  ListFilter,
  PencilLine,
  Search,
  TableProperties,
} from "lucide-react";
import { CadastrosWorkspaceNav, CadastroKpi } from "@/components/cadastros/cadastros-workspace-nav";
import { SectionPage } from "@/components/painel/section-page";
import { requireAnyPermission } from "@/lib/permissions/server";
import { criarContratoCredenciamento } from "@/modules/corporativo/actions";
import {
  atualizarContratoComercial,
  atualizarNegociacaoTabela,
  criarVersaoNegociacao,
  publicarEdicaoComercial,
  salvarItemEdicaoComercial,
  vincularTabelaContratoWorkspace,
} from "@/modules/comercial/workspace-actions";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const PAGE_SIZE = 100;
const ABAS = new Set(["resumo", "negociacao", "itens", "historico"]);

type Rel<T> = T | T[] | null;
type Convenio = { id?: string; nome_fantasia: string | null; registro_ans: string | null };
type Contrato = {
  id: string;
  convenio_id: string;
  unidade_id: string | null;
  numero_contrato: string | null;
  data_inicio: string | null;
  data_fim: string | null;
  status: string;
  prazo_pagamento_dias: number | null;
  reajuste_indice: string | null;
  data_base_reajuste: string | null;
  contato_comercial: string | null;
  email_comercial: string | null;
  observacoes: string | null;
  convenio: Rel<Convenio>;
};
type Fonte = { id: string; codigo: string; nome: string; tipo: string; ativo: boolean };
type Edicao = {
  id: string;
  fonte_id: string;
  convenio_id: string | null;
  nome_edicao: string;
  referencia: string | null;
  status: string;
  vigencia_inicio: string;
  vigencia_fim: string | null;
  metodo_calculo: string;
  valor_uco: number | null;
  itens: Array<{ count: number }> | null;
};
type Vinculo = {
  id: string;
  contrato_id: string;
  fonte_id: string;
  edicao_fixa_id: string | null;
  categoria: string;
  modo_edicao: string;
  percentual_ajuste: number;
  prioridade: number;
  valor_ch: number | null;
  valor_hm: number | null;
  valor_sadt: number | null;
  valor_uco_contratual: number | null;
  regras_adicionais: Record<string, unknown> | null;
  arredondamento_casas: number;
  ativo: boolean;
  observacoes: string | null;
};
type ItemTabela = {
  id: string;
  codigo: string;
  descricao: string;
  codigo_tuss: string | null;
  valor_referencia: number;
  pontos_ch: number | null;
  quantidade_auxiliares: number | null;
  pontos_hm: number | null;
  pontos_sadt: number | null;
  porte: string | null;
  ch_anestesista: number | null;
  quantidade_filme: number | null;
  quantidade_uco: number | null;
  porte_anestesico: string | null;
  exige_autorizacao: boolean;
  ativo: boolean;
  categoria_item: string;
  tabela_tiss_codigo: string | null;
  codigo_tabela_propria: string | null;
};
type Evento = {
  id: string;
  entidade_tipo: string;
  entidade_id: string;
  acao: string;
  antes: Record<string, unknown> | null;
  depois: Record<string, unknown> | null;
  contexto_contrato_id: string | null;
  contexto_edicao_id: string | null;
  created_at: string;
};
type SearchParams = {
  contrato?: string;
  vinculo?: string;
  edicao?: string;
  aba?: string;
  contrato_q?: string;
  item_q?: string;
  item_status?: string;
  item_page?: string;
  status?: string;
  sucesso?: string;
  erro?: string;
};

const one = <T,>(value: Rel<T>): T | null => Array.isArray(value) ? value[0] ?? null : value;
const brl = (value: number | string | null | undefined) => value == null || value === "" ? "—" : Number(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const num = (value: number | string | null | undefined, suffix = "") => value == null || value === "" ? "—" : `${Number(value).toLocaleString("pt-BR", { maximumFractionDigits: 6 })}${suffix}`;
const cleanSearch = (value: string) => value.replace(/[,%()]/g, " ").trim().slice(0, 80);
const today = () => new Date().toISOString().slice(0, 10);

function editionCount(edicao: Edicao | null | undefined) {
  return Array.isArray(edicao?.itens) ? Number(edicao?.itens?.[0]?.count ?? 0) : 0;
}

function resolveEdition(vinculo: Vinculo, editions: Edicao[], convenioId: string) {
  if (vinculo.modo_edicao === "edicao_fixa") return editions.find((item) => item.id === vinculo.edicao_fixa_id) ?? null;
  const date = today();
  return editions
    .filter((item) => item.fonte_id === vinculo.fonte_id && item.status === "vigente")
    .filter((item) => item.vigencia_inicio <= date && (!item.vigencia_fim || item.vigencia_fim >= date))
    .filter((item) => !item.convenio_id || item.convenio_id === convenioId)
    .sort((a, b) => Number(Boolean(b.convenio_id)) - Number(Boolean(a.convenio_id)) || b.vigencia_inicio.localeCompare(a.vigencia_inicio))[0] ?? null;
}

function href(params: Record<string, string | number | null | undefined>): Route {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (value !== null && value !== undefined && value !== "") qs.set(key, String(value));
  return `/comercial${qs.size ? `?${qs.toString()}` : ""}` as Route;
}

export default async function ComercialPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const { supabase, empresaId, unidadeId } = await requireAnyPermission([
    "comercial.visualizar",
    "comercial.editar",
    "credenciamento.visualizar",
    "credenciamento.gerenciar",
    "tabelas_comerciais.visualizar",
    "tabelas_comerciais.gerenciar",
  ]);
  const contractQ = cleanSearch(sp.contrato_q ?? "");
  const itemQ = cleanSearch(sp.item_q ?? "");
  const itemStatus = ["ativos", "inativos"].includes(sp.item_status ?? "") ? String(sp.item_status) : "todos";
  const status = String(sp.status ?? "");
  const aba = ABAS.has(sp.aba ?? "") ? String(sp.aba) : "resumo";
  const requestedPage = Math.max(1, Number.parseInt(sp.item_page ?? "1", 10) || 1);

  let contractsQuery = supabase
    .from("credenciamento_contratos")
    .select("id,convenio_id,unidade_id,numero_contrato,data_inicio,data_fim,status,prazo_pagamento_dias,reajuste_indice,data_base_reajuste,contato_comercial,email_comercial,observacoes,convenio:convenios(id,nome_fantasia,registro_ans)")
    .eq("empresa_id", empresaId)
    .order("created_at", { ascending: false });
  if (status) contractsQuery = contractsQuery.eq("status", status);

  const [contractsReq, conveniosReq, fontesReq, edicoesReq, canEditReq, canTableReq] = await Promise.all([
    contractsQuery.limit(250),
    supabase.from("convenios").select("id,nome_fantasia,registro_ans").eq("empresa_id", empresaId).eq("ativo", true).order("nome_fantasia"),
    supabase.from("tabelas_comerciais_fontes").select("id,codigo,nome,tipo,ativo").eq("empresa_id", empresaId).eq("ativo", true).order("nome"),
    supabase.from("tabelas_comerciais_edicoes").select("id,fonte_id,convenio_id,nome_edicao,referencia,status,vigencia_inicio,vigencia_fim,metodo_calculo,valor_uco,itens:tabelas_comerciais_itens(count)").order("vigencia_inicio", { ascending: false }).limit(500),
    supabase.rpc("comercial_pode_editar", { p_empresa: empresaId, p_unidade: unidadeId }),
    supabase.rpc("tabelas_comerciais_pode_editar", { p_empresa: empresaId, p_unidade: unidadeId }),
  ]);

  const contratos = (contractsReq.data ?? []) as unknown as Contrato[];
  const fontes = (fontesReq.data ?? []) as Fonte[];
  const edicoes = (edicoesReq.data ?? []) as unknown as Edicao[];
  const canEdit = canEditReq.data === true && !canEditReq.error;
  const canTable = canTableReq.data === true && !canTableReq.error;
  const fonteMap = new Map(fontes.map((item) => [item.id, item]));

  const filteredContracts = contratos.filter((contrato) => {
    if (!contractQ) return true;
    const convenio = one(contrato.convenio);
    return `${convenio?.nome_fantasia ?? ""} ${convenio?.registro_ans ?? ""} ${contrato.numero_contrato ?? ""}`.toLowerCase().includes(contractQ.toLowerCase());
  });
  const selectedContract = contratos.find((item) => item.id === sp.contrato) ?? filteredContracts[0] ?? contratos[0] ?? null;

  let vinculos: Vinculo[] = [];
  let regrasCount = 0;
  let pacotesCount = 0;
  if (selectedContract) {
    const [vincReq, regrasReq, pacotesReq] = await Promise.all([
      supabase.from("contrato_tabelas_comerciais").select("id,contrato_id,fonte_id,edicao_fixa_id,categoria,modo_edicao,percentual_ajuste,prioridade,valor_ch,valor_hm,valor_sadt,valor_uco_contratual,regras_adicionais,arredondamento_casas,ativo,observacoes").eq("contrato_id", selectedContract.id).order("prioridade"),
      supabase.from("contrato_regras_faturamento").select("id", { count: "exact", head: true }).eq("contrato_id", selectedContract.id).eq("ativo", true),
      supabase.from("contrato_pacotes").select("id", { count: "exact", head: true }).eq("contrato_id", selectedContract.id).eq("ativo", true),
    ]);
    vinculos = (vincReq.data ?? []) as Vinculo[];
    regrasCount = regrasReq.count ?? 0;
    pacotesCount = pacotesReq.count ?? 0;
  }

  const resolvedByLink = new Map(vinculos.map((item) => [item.id, resolveEdition(item, edicoes, selectedContract?.convenio_id ?? "")]));
  const firstUsefulLink = vinculos.find((item) => item.ativo && editionCount(resolvedByLink.get(item.id)) > 0)
    ?? vinculos.find((item) => item.ativo && resolvedByLink.get(item.id))
    ?? vinculos[0]
    ?? null;
  const selectedLink = vinculos.find((item) => item.id === sp.vinculo) ?? firstUsefulLink;
  const resolvedEdition = selectedLink ? resolvedByLink.get(selectedLink.id) ?? null : null;
  const selectedEdition = edicoes.find((item) => item.id === sp.edicao && (!selectedLink || item.fonte_id === selectedLink.fonte_id)) ?? resolvedEdition;
  const sourceEditions = selectedLink ? edicoes.filter((item) => item.fonte_id === selectedLink.fonte_id) : [];

  let items: ItemTabela[] = [];
  let itemCount = 0;
  if (selectedEdition) {
    let itemQuery = supabase
      .from("tabelas_comerciais_itens")
      .select("id,codigo,descricao,codigo_tuss,valor_referencia,pontos_ch,pontos_hm,pontos_sadt,quantidade_auxiliares,porte,ch_anestesista,quantidade_filme,quantidade_uco,porte_anestesico,exige_autorizacao,ativo,categoria_item,tabela_tiss_codigo,codigo_tabela_propria", { count: "exact" })
      .eq("edicao_id", selectedEdition.id)
      .order("codigo");
    if (itemQ.length >= 2) itemQuery = itemQuery.or(`codigo.ilike.%${itemQ}%,descricao.ilike.%${itemQ}%,codigo_tuss.ilike.%${itemQ}%`);
    if (itemStatus === "ativos") itemQuery = itemQuery.eq("ativo", true);
    if (itemStatus === "inativos") itemQuery = itemQuery.eq("ativo", false);
    const from = (requestedPage - 1) * PAGE_SIZE;
    const itemReq = await itemQuery.range(from, from + PAGE_SIZE - 1);
    items = (itemReq.data ?? []) as ItemTabela[];
    itemCount = itemReq.count ?? 0;
  }
  const pageCount = Math.max(1, Math.ceil(itemCount / PAGE_SIZE));
  const itemPage = Math.min(requestedPage, pageCount);

  let events: Evento[] = [];
  if (selectedContract) {
    const ids = [selectedContract.id, ...vinculos.map((item) => item.id), ...(selectedEdition ? [selectedEdition.id] : [])];
    const contextFilters = [
      `entidade_id.in.(${ids.join(",")})`,
      `contexto_contrato_id.eq.${selectedContract.id}`,
      ...(selectedEdition ? [`contexto_edicao_id.eq.${selectedEdition.id}`] : []),
    ];
    const evtReq = await supabase
      .from("comercial_eventos")
      .select("id,entidade_tipo,entidade_id,acao,antes,depois,contexto_contrato_id,contexto_edicao_id,created_at")
      .eq("empresa_id", empresaId)
      .or(contextFilters.join(","))
      .order("created_at", { ascending: false })
      .limit(100);
    events = (evtReq.data ?? []) as Evento[];
  }

  const ativos = contratos.filter((item) => item.status === "ativo").length;
  const negociacao = contratos.filter((item) => item.status === "negociacao").length;
  const linksVazios = vinculos.filter((item) => editionCount(resolvedByLink.get(item.id)) === 0).length;
  const linksSemEdicao = vinculos.filter((item) => !resolvedByLink.get(item.id)).length;
  const selectedConvenio = selectedContract ? one(selectedContract.convenio) : null;
  const selectedItemTotal = editionCount(selectedEdition);
  const errors = [contractsReq.error, fontesReq.error, edicoesReq.error].filter(Boolean);

  const context = {
    contrato: selectedContract?.id,
    vinculo: selectedLink?.id,
    edicao: selectedEdition?.id,
  };

  return (
    <SectionPage
      eyebrow="Comercial / Credenciamento"
      title="Credenciamento, Contratos e Tabelas"
      description="Um único workspace para revisar contrato, negociação, versões de tabela, itens e histórico. Publicações permanecem imutáveis; novas negociações são feitas por versão."
      actions={<div className="flex flex-wrap gap-2"><Link href="/comercial/tabelas" className="ui-button-secondary"><Database className="size-4"/>Fontes e importações</Link><Link href="/comercial/regras" className="ui-button-secondary"><BookOpenCheck className="size-4"/>Regras e pacotes</Link></div>}
    >
      <CadastrosWorkspaceNav active="/comercial" />
      {sp.sucesso ? <Notice ok text={`Operação concluída: ${sp.sucesso.replaceAll("-", " ")}.`} /> : null}
      {sp.erro ? <Notice text={decodeURIComponent(sp.erro)} /> : null}
      {errors.length ? <Notice text="Há consultas comerciais com erro. Revise RLS/permissões antes de alterar o contrato." /> : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <CadastroKpi label="Contratos ativos" value={ativos} />
        <CadastroKpi label="Em negociação" value={negociacao} />
        <CadastroKpi label="Tabelas no contrato" value={vinculos.length} />
        <CadastroKpi label="Vínculos com problema" value={linksVazios} detail={linksSemEdicao ? `${linksSemEdicao} sem edição resolvida` : linksVazios ? "Tabela sem itens" : "Tudo parametrizado"} />
        <CadastroKpi label="Regras / pacotes" value={`${regrasCount} / ${pacotesCount}`} />
      </section>

      <div className="mt-5 grid gap-5 xl:grid-cols-[330px_minmax(0,1fr)]">
        <aside className="space-y-4">
          <section className="his-card p-4">
            <div className="mb-3 flex items-center gap-2"><Handshake className="size-5 text-brand-700"/><div><h2 className="font-black text-slate-900">Contratos</h2><p className="text-xs text-slate-500">Selecione a operadora/contrato.</p></div></div>
            <form className="mb-3 grid gap-2">
              <div className="relative"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400"/><input name="contrato_q" defaultValue={contractQ} className="ui-input pl-9" placeholder="Operadora, ANS ou contrato"/></div>
              <select name="status" defaultValue={status} className="ui-input"><option value="">Todos os status</option><option value="negociacao">Negociação</option><option value="ativo">Ativo</option><option value="suspenso">Suspenso</option><option value="encerrado">Encerrado</option></select>
              <button className="ui-button-secondary">Filtrar contratos</button>
            </form>
            <div className="max-h-[520px] space-y-2 overflow-y-auto pr-1">{filteredContracts.map((contrato) => {
              const convenio = one(contrato.convenio);
              const selected = contrato.id === selectedContract?.id;
              return <Link key={contrato.id} href={href({ contrato: contrato.id, aba: "resumo" })} className={`block rounded-xl border p-3 transition ${selected ? "border-brand-300 bg-brand-50" : "border-slate-100 hover:border-slate-200"}`}><div className="flex justify-between gap-2"><b className="min-w-0 truncate text-sm">{convenio?.nome_fantasia ?? "Convênio"}</b><Status status={contrato.status}/></div><p className="mt-1 text-xs text-slate-500">{contrato.numero_contrato || "Sem nº"} · ANS {convenio?.registro_ans || "—"}</p><p className="mt-1 text-[11px] text-slate-400">{contrato.data_inicio || "sem início"} → {contrato.data_fim || "vigência aberta"}</p></Link>;
            })}{!filteredContracts.length ? <p className="py-6 text-center text-sm text-slate-500">Nenhum contrato encontrado.</p> : null}</div>
          </section>

          {canEdit ? <details className="his-card p-4"><summary className="cursor-pointer text-sm font-black text-slate-800">+ Novo contrato</summary><form action={criarContratoCredenciamento} className="mt-4 grid gap-2"><select name="convenio_id" required defaultValue="" className="ui-input"><option value="">Convênio</option>{conveniosReq.data?.map((item) => <option key={item.id} value={item.id}>{item.nome_fantasia} · ANS {item.registro_ans || "—"}</option>)}</select><input name="numero_contrato" className="ui-input" placeholder="Número do contrato"/><div className="grid grid-cols-2 gap-2"><input type="date" name="data_inicio" className="ui-input"/><input type="date" name="data_fim" className="ui-input"/></div><select name="status" defaultValue="negociacao" className="ui-input"><option value="negociacao">Negociação</option><option value="ativo">Ativo</option></select><button className="ui-button-primary">Criar contrato</button></form></details> : null}
        </aside>

        <main className="min-w-0">
          {selectedContract ? <>
            <section className="his-card overflow-hidden">
              <div className="border-b border-slate-100 p-5">
                <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-wider text-brand-600">Contrato selecionado</p><h2 className="mt-1 text-xl font-black text-slate-950">{selectedConvenio?.nome_fantasia ?? "Convênio"} · {selectedContract.numero_contrato || "Sem nº"}</h2><p className="mt-1 text-sm text-slate-500">ANS {selectedConvenio?.registro_ans || "—"} · {selectedContract.data_inicio || "—"} → {selectedContract.data_fim || "vigência aberta"}</p></div><Status status={selectedContract.status}/></div>
                {linksVazios ? <Warning text={`${linksVazios} vínculo(s) deste contrato não possuem itens utilizáveis. A central seleciona automaticamente a primeira tabela com itens para facilitar a conferência.`}/> : null}
              </div>
              <nav className="grid grid-cols-2 gap-1 bg-slate-50 p-2 lg:grid-cols-4">
                <Tab active={aba === "resumo"} href={href({ ...context, aba: "resumo" })} label="Contrato" detail="Dados e vigência" />
                <Tab active={aba === "negociacao"} href={href({ ...context, aba: "negociacao" })} label="Negociação" detail={`${vinculos.length} tabela(s)`} />
                <Tab active={aba === "itens"} href={href({ ...context, aba: "itens" })} label="Itens da tabela" detail={`${selectedItemTotal} item(ns)`} />
                <Tab active={aba === "historico"} href={href({ ...context, aba: "historico" })} label="Histórico" detail={`${events.length} evento(s)`} />
              </nav>
            </section>

            {aba === "resumo" ? <section className="his-card mt-4 p-5">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Info label="Pagamento" value={selectedContract.prazo_pagamento_dias ? `${selectedContract.prazo_pagamento_dias} dias` : "Não informado"}/><Info label="Reajuste" value={selectedContract.reajuste_indice || "Não informado"}/><Info label="Data-base" value={selectedContract.data_base_reajuste || "Não informada"}/><Info label="Contato" value={selectedContract.contato_comercial || selectedContract.email_comercial || "Não informado"}/></div>
              <div className="mt-4 grid gap-3 md:grid-cols-3"><Info label="Tabelas vinculadas" value={String(vinculos.length)}/><Info label="Tabela selecionada" value={selectedLink ? fonteMap.get(selectedLink.fonte_id)?.nome ?? "—" : "Nenhuma"}/><Info label="Itens disponíveis" value={String(selectedItemTotal)}/></div>
              <div className="mt-5 flex flex-wrap gap-2"><Link href={href({ ...context, aba: "negociacao" })} className="ui-button-primary"><Handshake className="size-4"/>Abrir negociação</Link><Link href={href({ ...context, aba: "itens" })} className="ui-button-secondary"><TableProperties className="size-4"/>Visualizar itens</Link><Link href="/comercial/regras" className="ui-button-secondary">Regras / pacotes</Link></div>
              {canEdit ? <details className="mt-5 rounded-xl border border-slate-200 p-4"><summary className="cursor-pointer font-black text-slate-800"><PencilLine className="mr-2 inline size-4"/>Editar dados do contrato</summary><form action={atualizarContratoComercial} className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4"><ReturnFields contrato={selectedContract.id} aba="resumo"/><input type="hidden" name="contrato_id" value={selectedContract.id}/><input name="numero_contrato" defaultValue={selectedContract.numero_contrato ?? ""} className="ui-input" placeholder="Número"/><select name="status" defaultValue={selectedContract.status} className="ui-input"><option value="negociacao">Negociação</option><option value="ativo">Ativo</option><option value="suspenso">Suspenso</option><option value="encerrado">Encerrado</option></select><input type="date" name="data_inicio" defaultValue={selectedContract.data_inicio ?? ""} className="ui-input"/><input type="date" name="data_fim" defaultValue={selectedContract.data_fim ?? ""} className="ui-input"/><input name="prazo_pagamento_dias" defaultValue={selectedContract.prazo_pagamento_dias ?? ""} className="ui-input" placeholder="Prazo pagamento (dias)"/><input name="reajuste_indice" defaultValue={selectedContract.reajuste_indice ?? ""} className="ui-input" placeholder="Índice reajuste"/><input name="data_base_reajuste" defaultValue={selectedContract.data_base_reajuste ?? ""} className="ui-input" placeholder="Data-base"/><input name="contato_comercial" defaultValue={selectedContract.contato_comercial ?? ""} className="ui-input" placeholder="Contato comercial"/><input name="email_comercial" defaultValue={selectedContract.email_comercial ?? ""} className="ui-input md:col-span-2" placeholder="E-mail comercial"/><textarea name="observacoes" defaultValue={selectedContract.observacoes ?? ""} className="ui-input min-h-20 md:col-span-2" placeholder="Observações"/><button className="ui-button-primary xl:col-span-4">Salvar contrato</button></form></details> : null}
            </section> : null}

            {aba === "negociacao" ? <section className="his-card mt-4 p-5">
              <div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="font-black text-slate-950">Tabelas e negociação</h2><p className="mt-1 text-sm text-slate-500">Escolha uma tabela para revisar edição, quantidade de itens e coeficientes contratados.</p></div><Link href="/comercial/tabelas" className="ui-button-secondary"><Database className="size-4"/>Fontes / importações</Link></div>
              <div className="mt-4 grid gap-3 lg:grid-cols-2">{vinculos.map((vinculo) => {
                const fonte = fonteMap.get(vinculo.fonte_id);
                const edicao = resolvedByLink.get(vinculo.id) ?? null;
                const count = editionCount(edicao);
                const active = selectedLink?.id === vinculo.id;
                return <article key={vinculo.id} className={`rounded-2xl border p-4 ${active ? "border-brand-300 bg-brand-50/30" : count ? "border-slate-100" : "border-amber-200 bg-amber-50/30"}`}><div className="flex items-start justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2"><b>{fonte?.nome ?? "Fonte"}</b><span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-black uppercase">{vinculo.categoria}</span></div><p className="mt-1 text-xs text-slate-500">{vinculo.modo_edicao === "edicao_fixa" ? "Edição fixa" : "Edição vigente na data"} · prioridade {vinculo.prioridade}</p></div><span className={`rounded-full px-2 py-1 text-xs font-black ${count ? "bg-emerald-50 text-emerald-700" : "bg-amber-100 text-amber-800"}`}>{count} itens</span></div><div className="mt-3 grid gap-2 sm:grid-cols-2"><Info label="Edição" value={edicao?.nome_edicao ?? "Não resolvida"}/><Info label="Ajuste" value={num(vinculo.percentual_ajuste, "%")}/><Info label="CH / HM / SADT" value={`${num(vinculo.valor_ch)} / ${num(vinculo.valor_hm)} / ${num(vinculo.valor_sadt)}`}/><Info label="Status" value={vinculo.ativo ? "Ativo" : "Inativo"}/></div><div className="mt-3 flex flex-wrap gap-2"><Link href={href({ contrato: selectedContract.id, vinculo: vinculo.id, edicao: edicao?.id, aba: "negociacao" })} className="ui-button-secondary">Editar negociação</Link>{edicao ? <Link href={href({ contrato: selectedContract.id, vinculo: vinculo.id, edicao: edicao.id, aba: "itens" })} className="ui-button-secondary">Ver itens <ArrowRight className="size-4"/></Link> : null}</div>{!edicao ? <Warning text="Nenhuma edição válida foi resolvida para este vínculo."/> : count === 0 ? <Warning text="A edição existe, mas está vazia. Importe/cadastre itens ou selecione outra versão."/> : null}</article>;
              })}{!vinculos.length ? <Warning text="Nenhuma tabela comercial vinculada a este contrato."/> : null}</div>

              {(canEdit || canTable) ? <details className="mt-5 rounded-2xl border border-slate-200 p-4"><summary className="cursor-pointer font-black text-slate-800">+ Vincular outra tabela ao contrato</summary><form action={vincularTabelaContratoWorkspace} className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4"><ReturnFields contrato={selectedContract.id} aba="negociacao"/><input type="hidden" name="contrato_id" value={selectedContract.id}/><select name="fonte_id" required defaultValue="" className="ui-input"><option value="">Tabela / fonte *</option>{fontes.map((fonte) => <option key={fonte.id} value={fonte.id}>{fonte.codigo} · {fonte.nome}</option>)}</select><select name="edicao_fixa_id" defaultValue="" className="ui-input"><option value="">Edição fixa</option>{edicoes.map((edicao) => <option key={edicao.id} value={edicao.id}>{fonteMap.get(edicao.fonte_id)?.codigo ?? "Tabela"} · {edicao.nome_edicao} · {editionCount(edicao)} itens</option>)}</select><select name="categoria" defaultValue="geral" className="ui-input"><option value="geral">Geral</option><option value="procedimentos">Procedimentos</option><option value="diarias_taxas">Diárias / taxas</option><option value="materiais_opme">Materiais / OPME</option><option value="medicamentos">Medicamentos</option></select><select name="modo_edicao" defaultValue="edicao_fixa" className="ui-input"><option value="edicao_fixa">Edição fixa</option><option value="vigente_na_data">Vigente na data</option></select><input name="percentual_ajuste" defaultValue="0" className="ui-input" placeholder="Ajuste %"/><input name="prioridade" defaultValue="100" className="ui-input" placeholder="Prioridade"/><input name="valor_ch" className="ui-input" placeholder="Valor CH"/><input name="valor_hm" className="ui-input" placeholder="Valor HM"/><input name="valor_sadt" className="ui-input" placeholder="Valor SADT"/><input name="valor_uco_contratual" className="ui-input" placeholder="UCO contratual"/><input name="urgencia_percentual" defaultValue="0" className="ui-input" placeholder="Urgência %"/><input name="apartamento_percentual" defaultValue="0" className="ui-input" placeholder="Apartamento %"/><input name="arredondamento_casas" defaultValue="2" className="ui-input" placeholder="Casas decimais"/><input name="horario_especial_regra" className="ui-input" placeholder="Regra de horário especial"/><textarea name="observacoes" className="ui-input min-h-20 md:col-span-2 xl:col-span-4" placeholder="Observações da negociação"/><button className="ui-button-primary md:col-span-2 xl:col-span-4">Vincular tabela</button></form></details> : null}

              {selectedLink ? <div className="mt-5 rounded-2xl border border-brand-100 bg-brand-50/30 p-4"><div className="flex items-center gap-2"><PencilLine className="size-5 text-brand-700"/><div><h3 className="font-black">Editar negociação selecionada · {fonteMap.get(selectedLink.fonte_id)?.nome}</h3><p className="text-xs text-slate-500">Os coeficientes abaixo são os usados na resolução contratual.</p></div></div>{canEdit || canTable ? <form action={atualizarNegociacaoTabela} className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4"><ReturnFields contrato={selectedContract.id} vinculo={selectedLink.id} edicao={selectedEdition?.id} aba="negociacao"/><input type="hidden" name="vinculo_id" value={selectedLink.id}/><select name="modo_edicao" defaultValue={selectedLink.modo_edicao} className="ui-input"><option value="vigente_na_data">Edição vigente na data</option><option value="edicao_fixa">Edição fixa</option></select><select name="edicao_fixa_id" defaultValue={selectedLink.edicao_fixa_id ?? ""} className="ui-input"><option value="">Sem edição fixa</option>{sourceEditions.map((item) => <option key={item.id} value={item.id}>{item.nome_edicao} · {item.status} · {editionCount(item)} itens</option>)}</select><input name="percentual_ajuste" defaultValue={selectedLink.percentual_ajuste ?? 0} className="ui-input" placeholder="Ajuste %"/><input name="prioridade" defaultValue={selectedLink.prioridade} className="ui-input" placeholder="Prioridade"/><input name="valor_ch" defaultValue={selectedLink.valor_ch ?? ""} className="ui-input" placeholder="Valor CH"/><input name="valor_hm" defaultValue={selectedLink.valor_hm ?? ""} className="ui-input" placeholder="Valor HM"/><input name="valor_sadt" defaultValue={selectedLink.valor_sadt ?? ""} className="ui-input" placeholder="Valor SADT"/><input name="valor_uco_contratual" defaultValue={selectedLink.valor_uco_contratual ?? ""} className="ui-input" placeholder="UCO contratual"/><input name="urgencia_percentual" defaultValue={String(selectedLink.regras_adicionais?.urgencia_percentual ?? "")} className="ui-input" placeholder="Urgência %"/><input name="apartamento_percentual" defaultValue={String(selectedLink.regras_adicionais?.apartamento_percentual ?? "")} className="ui-input" placeholder="Apartamento %"/><input name="horario_especial_regra" defaultValue={String(selectedLink.regras_adicionais?.horario_especial_regra ?? "")} className="ui-input md:col-span-2" placeholder="Regra de horário especial"/><input name="arredondamento_casas" defaultValue={selectedLink.arredondamento_casas} className="ui-input" placeholder="Casas decimais"/><label className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 text-sm font-bold"><input type="checkbox" name="ativo" defaultChecked={selectedLink.ativo}/>Vínculo ativo</label><textarea name="observacoes" defaultValue={selectedLink.observacoes ?? ""} className="ui-input min-h-20 md:col-span-2" placeholder="Observações"/><button className="ui-button-primary md:col-span-2 xl:col-span-4">Salvar negociação</button></form> : <p className="mt-4 text-sm text-slate-500">Seu perfil possui leitura, mas não edição.</p>}</div> : null}
            </section> : null}

            {aba === "itens" ? <section className="his-card mt-4 p-5">
              <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-black text-slate-950">Itens da tabela contratada</h2><p className="mt-1 text-sm text-slate-500">{selectedEdition ? `${fonteMap.get(selectedEdition.fonte_id)?.nome ?? "Tabela"} · ${selectedEdition.nome_edicao}` : "Selecione uma tabela/edição na negociação."}</p></div>{selectedEdition ? <div className="text-right"><span className={`rounded-full px-3 py-1 text-xs font-black ${selectedEdition.status === "rascunho" ? "bg-amber-50 text-amber-700" : selectedEdition.status === "vigente" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>{selectedEdition.status}</span><p className="mt-2 text-xs font-bold text-slate-500">{selectedItemTotal} itens na edição</p></div> : null}</div>
              {selectedLink && sourceEditions.length ? <div className="mt-4 flex flex-wrap gap-2"><span className="py-2 text-xs font-black uppercase text-slate-400">Versões:</span>{sourceEditions.map((item) => <Link key={item.id} href={href({ contrato: selectedContract.id, vinculo: selectedLink.id, edicao: item.id, aba: "itens" })} className={`rounded-xl border px-3 py-2 text-xs font-bold ${selectedEdition?.id === item.id ? "border-brand-300 bg-brand-50 text-brand-800" : "border-slate-200 text-slate-600"}`}>{item.nome_edicao} · {item.status} · {editionCount(item)} itens</Link>)}</div> : null}

              {selectedEdition ? <>
                <form method="get" className="mt-4 grid gap-2 md:grid-cols-[1fr_170px_auto]"><input type="hidden" name="contrato" value={selectedContract.id}/>{selectedLink ? <input type="hidden" name="vinculo" value={selectedLink.id}/> : null}<input type="hidden" name="edicao" value={selectedEdition.id}/><input type="hidden" name="aba" value="itens"/><div className="relative"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400"/><input name="item_q" defaultValue={itemQ} className="ui-input pl-9" placeholder="Código, descrição ou TUSS"/></div><select name="item_status" defaultValue={itemStatus} className="ui-input"><option value="todos">Todos os itens</option><option value="ativos">Somente ativos</option><option value="inativos">Somente inativos</option></select><button className="ui-button-secondary"><ListFilter className="size-4"/>Filtrar itens</button></form>

                {selectedEdition.status !== "rascunho" && canTable ? <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4"><div className="flex items-start gap-3"><FileClock className="mt-0.5 size-5 text-amber-700"/><div className="min-w-0 flex-1"><p className="font-black text-amber-900">Edição publicada é histórica e não pode ser alterada diretamente</p><p className="mt-1 text-sm text-amber-800">Crie uma nova versão rascunho. Os {editionCount(selectedEdition)} itens serão copiados para a nova negociação.</p><form action={criarVersaoNegociacao} className="mt-3 grid gap-2 md:grid-cols-[1fr_180px_auto]"><ReturnFields contrato={selectedContract.id} vinculo={selectedLink?.id} edicao={selectedEdition.id} aba="itens"/><input type="hidden" name="edicao_origem_id" value={selectedEdition.id}/><input name="nome_edicao" required className="ui-input" defaultValue={`${selectedEdition.nome_edicao} · nova negociação`} placeholder="Nome da nova versão"/><input type="date" name="vigencia_inicio" required className="ui-input" defaultValue={today()}/><button className="ui-button-primary">Criar versão editável</button></form></div></div></div> : null}

                {selectedEdition.status === "rascunho" && canTable ? <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_auto]"><details className="rounded-xl border border-slate-200 p-4"><summary className="cursor-pointer font-black text-slate-800">+ Incluir item na edição</summary><ItemForm contrato={selectedContract.id} vinculo={selectedLink?.id} edicao={selectedEdition.id}/></details><form action={publicarEdicaoComercial} className="flex items-end"><ReturnFields contrato={selectedContract.id} vinculo={selectedLink?.id} edicao={selectedEdition.id} aba="itens"/><input type="hidden" name="edicao_id" value={selectedEdition.id}/><button className="ui-button-primary"><CheckCircle2 className="size-4"/>Publicar edição</button></form></div> : null}

                <div className="mt-4 overflow-x-auto rounded-xl border border-slate-100"><table className="w-full min-w-[1320px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-3 py-3">Código</th><th className="px-3 py-3">Descrição</th><th className="px-3 py-3">TUSS</th><th className="px-3 py-3">Valor referência</th><th className="px-3 py-3">CH/HM/SADT</th><th className="px-3 py-3">Aux.</th><th className="px-3 py-3">Porte</th><th className="px-3 py-3">CH anest.</th><th className="px-3 py-3">Filme</th><th className="px-3 py-3">P. anest.</th><th className="px-3 py-3">Situação</th>{selectedEdition.status === "rascunho" && canTable ? <th className="px-3 py-3">Ação</th> : null}</tr></thead><tbody className="divide-y divide-slate-100">{items.map((item) => <tr key={item.id} className={!item.ativo ? "bg-slate-50 opacity-60" : ""}><td className="px-3 py-3 font-black text-slate-900">{item.codigo}</td><td className="max-w-md px-3 py-3"><div className="font-semibold text-slate-800">{item.descricao}</div><div className="text-xs text-slate-400">{item.categoria_item} · Tabela TISS {item.tabela_tiss_codigo || "—"}</div></td><td className="px-3 py-3">{item.codigo_tuss || "—"}</td><td className="px-3 py-3 font-semibold">{brl(item.valor_referencia)}</td><td className="px-3 py-3 text-xs">{num(item.pontos_ch)} / {num(item.pontos_hm)} / {num(item.pontos_sadt)}</td><td className="px-3 py-3">{num(item.quantidade_auxiliares)}</td><td className="px-3 py-3">{item.porte || "—"}</td><td className="px-3 py-3">{num(item.ch_anestesista)}</td><td className="px-3 py-3">{num(item.quantidade_filme)}</td><td className="px-3 py-3">{item.porte_anestesico || "—"}</td><td className="px-3 py-3"><span className={`rounded-full px-2 py-1 text-[10px] font-black ${item.ativo ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{item.ativo ? "ATIVO" : "INATIVO"}</span>{item.exige_autorizacao ? <div className="mt-1 text-[10px] font-black text-amber-700">AUTORIZAÇÃO</div> : null}</td>{selectedEdition.status === "rascunho" && canTable ? <td className="px-3 py-3"><details><summary className="cursor-pointer text-xs font-black text-brand-700">Editar</summary><div className="mt-2 w-[560px] max-w-[72vw] rounded-xl border border-slate-200 bg-white p-3"><ItemForm contrato={selectedContract.id} vinculo={selectedLink?.id} edicao={selectedEdition.id} item={item}/></div></details></td> : null}</tr>)}{!items.length ? <tr><td colSpan={selectedEdition.status === "rascunho" && canTable ? 12 : 11} className="p-8 text-center text-slate-500">Nenhum item encontrado nesta edição/filtro.</td></tr> : null}</tbody></table></div>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-slate-500">{itemCount ? `Exibindo ${(itemPage - 1) * PAGE_SIZE + 1}–${Math.min(itemPage * PAGE_SIZE, itemCount)} de ${itemCount}` : "Nenhum item"}</p><div className="flex items-center gap-2"><Link aria-disabled={itemPage <= 1} href={href({ contrato: selectedContract.id, vinculo: selectedLink?.id, edicao: selectedEdition.id, aba: "itens", item_q: itemQ, item_status: itemStatus, item_page: Math.max(1, itemPage - 1) })} className={`ui-button-secondary ${itemPage <= 1 ? "pointer-events-none opacity-40" : ""}`}><ChevronLeft className="size-4"/>Anterior</Link><span className="text-xs font-black text-slate-600">Página {itemPage} / {pageCount}</span><Link aria-disabled={itemPage >= pageCount} href={href({ contrato: selectedContract.id, vinculo: selectedLink?.id, edicao: selectedEdition.id, aba: "itens", item_q: itemQ, item_status: itemStatus, item_page: Math.min(pageCount, itemPage + 1) })} className={`ui-button-secondary ${itemPage >= pageCount ? "pointer-events-none opacity-40" : ""}`}>Próxima<ChevronRight className="size-4"/></Link></div></div>
              </> : <Warning text="Este vínculo não possui uma edição resolvida. Abra a aba Negociação e selecione uma edição fixa ou corrija a vigência."/>}
            </section> : null}

            {aba === "historico" ? <section className="his-card mt-4 p-5"><div className="flex items-center gap-2"><FileClock className="size-5 text-brand-700"/><div><h2 className="font-black text-slate-950">Histórico contratual e de negociação</h2><p className="text-sm text-slate-500">Contrato, vínculos, versões e alterações de itens ficam auditados no contexto selecionado.</p></div></div><div className="mt-4 space-y-2">{events.map((event) => <article key={event.id} className="rounded-xl border border-slate-100 p-3"><div className="flex flex-wrap items-center justify-between gap-2"><div><b className="text-sm text-slate-800">{eventLabel(event.entidade_tipo)}</b><p className="text-xs text-slate-500">{new Date(event.created_at).toLocaleString("pt-BR")}</p></div><span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-black uppercase text-slate-600">{event.acao}</span></div>{event.antes || event.depois ? <details className="mt-2"><summary className="cursor-pointer text-xs font-black text-brand-700">Ver alteração</summary><div className="mt-2 grid gap-2 lg:grid-cols-2"><JsonBlock title="Antes" value={event.antes}/><JsonBlock title="Depois" value={event.depois}/></div></details> : null}</article>)}{!events.length ? <p className="py-8 text-center text-sm text-slate-500">Ainda não há eventos auditados para este contexto.</p> : null}</div></section> : null}
          </> : <section className="his-card p-10 text-center"><Handshake className="mx-auto size-9 text-slate-300"/><p className="mt-3 font-black text-slate-700">Nenhum contrato disponível.</p><p className="mt-1 text-sm text-slate-500">Cadastre um contrato para iniciar a negociação comercial.</p></section>}
        </main>
      </div>
    </SectionPage>
  );
}

function ReturnFields({ contrato, vinculo, edicao, aba }: { contrato: string; vinculo?: string | null; edicao?: string | null; aba?: string | null }) {
  return <><input type="hidden" name="retorno_contrato" value={contrato}/>{vinculo ? <input type="hidden" name="retorno_vinculo" value={vinculo}/> : null}{edicao ? <input type="hidden" name="retorno_edicao" value={edicao}/> : null}{aba ? <input type="hidden" name="retorno_aba" value={aba}/> : null}</>;
}

function ItemForm({ contrato, vinculo, edicao, item }: { contrato: string; vinculo?: string | null; edicao: string; item?: ItemTabela }) {
  return <form action={salvarItemEdicaoComercial} className="mt-3 grid gap-2 md:grid-cols-2"><ReturnFields contrato={contrato} vinculo={vinculo} edicao={edicao} aba="itens"/><input type="hidden" name="edicao_id" value={edicao}/>{item ? <input type="hidden" name="item_id" value={item.id}/> : null}<input name="codigo" required defaultValue={item?.codigo ?? ""} className="ui-input" placeholder="Código"/><input name="codigo_tuss" defaultValue={item?.codigo_tuss ?? ""} className="ui-input" placeholder="TUSS"/><input name="descricao" required defaultValue={item?.descricao ?? ""} className="ui-input md:col-span-2" placeholder="Descrição"/><input name="valor_referencia" required defaultValue={item?.valor_referencia ?? ""} className="ui-input" placeholder="Valor referência"/><select name="categoria_item" defaultValue={item?.categoria_item ?? "procedimento"} className="ui-input"><option value="procedimento">Procedimento</option><option value="diaria">Diária</option><option value="taxa">Taxa</option><option value="gas_medicinal">Gás</option><option value="material">Material</option><option value="opme">OPME</option><option value="medicamento">Medicamento</option><option value="pacote">Pacote</option><option value="outro">Outro</option></select><select name="tabela_tiss_codigo" defaultValue={item?.tabela_tiss_codigo ?? "22"} className="ui-input"><option value="00">00 · Própria</option><option value="18">18 · Diárias/taxas/gases</option><option value="19">19 · Materiais/OPME</option><option value="20">20 · Medicamentos</option><option value="22">22 · Procedimentos</option><option value="98">98 · Pacotes</option></select><input name="codigo_tabela_propria" defaultValue={item?.codigo_tabela_propria ?? ""} className="ui-input" placeholder="Código próprio"/><input name="pontos_ch" defaultValue={item?.pontos_ch ?? ""} className="ui-input" placeholder="Pontos CH"/><input name="pontos_hm" defaultValue={item?.pontos_hm ?? ""} className="ui-input" placeholder="Pontos HM"/><input name="pontos_sadt" defaultValue={item?.pontos_sadt ?? ""} className="ui-input" placeholder="Pontos SADT"/><input name="porte" defaultValue={item?.porte ?? ""} className="ui-input" placeholder="Porte"/><input name="porte_anestesico" defaultValue={item?.porte_anestesico ?? ""} className="ui-input" placeholder="Porte anestésico"/><input name="quantidade_uco" defaultValue={item?.quantidade_uco ?? ""} className="ui-input" placeholder="Qtd. UCO"/><label className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" name="exige_autorizacao" defaultChecked={item?.exige_autorizacao ?? false}/>Exige autorização</label><label className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" name="ativo" defaultChecked={item?.ativo ?? true}/>Item ativo</label><button className="ui-button-primary md:col-span-2">{item ? "Salvar item" : "Incluir item"}</button></form>;
}

function Tab({ active, href: target, label, detail }: { active: boolean; href: Route; label: string; detail: string }) {
  return <Link href={target} className={`rounded-xl px-3 py-3 transition ${active ? "bg-white text-brand-800 shadow-sm ring-1 ring-brand-100" : "text-slate-600 hover:bg-white/70"}`}><span className="block text-sm font-black">{label}</span><span className="mt-0.5 block text-[11px] text-slate-400">{detail}</span></Link>;
}
function Status({ status }: { status: string }) { const style = status === "ativo" ? "bg-emerald-50 text-emerald-700" : status === "negociacao" ? "bg-blue-50 text-blue-700" : status === "suspenso" ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-600"; return <span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase ${style}`}>{status}</span>; }
function Info({ label, value }: { label: string; value: string }) { return <div className="rounded-xl bg-slate-50 p-3"><p className="text-[10px] font-black uppercase tracking-wide text-slate-400">{label}</p><p className="mt-1 break-words text-sm font-semibold text-slate-800">{value}</p></div>; }
function Warning({ text }: { text: string }) { return <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800"><AlertTriangle className="mt-0.5 size-4 shrink-0"/>{text}</div>; }
function Notice({ ok = false, text }: { ok?: boolean; text: string }) { return <div className={`mb-4 flex items-start gap-2 rounded-xl border px-4 py-3 text-sm font-semibold ${ok ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-rose-200 bg-rose-50 text-rose-700"}`}>{ok ? <CheckCircle2 className="mt-0.5 size-4 shrink-0"/> : <AlertTriangle className="mt-0.5 size-4 shrink-0"/>}{text}</div>; }
function JsonBlock({ title, value }: { title: string; value: Record<string, unknown> | null }) { return <div className="min-w-0 rounded-xl bg-slate-50 p-3"><p className="mb-2 text-[10px] font-black uppercase tracking-wide text-slate-400">{title}</p><pre className="max-h-56 overflow-auto whitespace-pre-wrap break-words text-[11px] text-slate-600">{value ? JSON.stringify(value, null, 2) : "—"}</pre></div>; }
function eventLabel(type: string) { return ({ credenciamento_contratos: "Contrato", contrato_tabelas_comerciais: "Negociação / vínculo", contrato_regras_procedimentos: "Regra de procedimento", contrato_regras_faturamento: "Regra de faturamento", contrato_pacotes: "Pacote", contrato_pacote_itens: "Item de pacote", tabelas_comerciais_fontes: "Fonte comercial", tabelas_comerciais_edicoes: "Edição da tabela", tabelas_comerciais_itens: "Item da tabela" } as Record<string, string>)[type] ?? type.replaceAll("_", " "); }
