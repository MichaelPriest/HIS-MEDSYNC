import type { Route } from "next";
import Link from "next/link";
import {
  ArrowLeftRight,
  BookOpenCheck,
  CalendarClock,
  Database,
  FileClock,
  Search,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import { CadastrosWorkspaceNav, CadastroKpi } from "@/components/cadastros/cadastros-workspace-nav";
import { CommercialDeparaBackgroundForm } from "@/components/comercial/commercial-depara-background-form";
import { SectionPage } from "@/components/painel/section-page";
import { requireAnyPermission } from "@/lib/permissions/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Rel<T> = T | T[] | null;
type Convenio = { nome_fantasia: string | null; registro_ans: string | null };
type Contrato = {
  id: string;
  convenio_id: string;
  plano_id: string | null;
  numero_contrato: string | null;
  data_inicio: string | null;
  data_fim: string | null;
  status: string;
  convenio: Rel<Convenio>;
};
type Plano = { id: string; convenio_id: string; nome: string };
type Fonte = { id: string; codigo: string; nome: string; tipo: string };
type Vinculo = { id: string; contrato_id: string; fonte_id: string; categoria: string; prioridade: number; ativo: boolean };
type Depara = {
  id: string;
  contrato_id: string;
  fonte_id: string;
  codigo_origem: string;
  descricao_origem: string | null;
  codigo_tuss: string;
  descricao_tuss: string | null;
  tabela_tiss_codigo: string | null;
  vigencia_inicio: string;
  vigencia_fim: string | null;
  ativo: boolean;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
};
type SearchParams = { contrato?: string; q?: string; fonte?: string; status?: string };

const one = <T,>(value: Rel<T>): T | null => Array.isArray(value) ? value[0] ?? null : value;
const cleanSearch = (value: string) => value.replace(/[,%()]/g, " ").trim().slice(0, 80);
const localToday = () => new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Sao_Paulo" }).format(new Date());
const href = (params: Record<string, string | null | undefined>): Route => {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (value) search.set(key, value);
  return `/comercial/depara${search.size ? `?${search.toString()}` : ""}` as Route;
};

function sourceLabel(source: Fonte | undefined) {
  if (!source) return "Fonte não localizada";
  return `${source.nome} · ${source.tipo.toUpperCase()}`;
}

function statusAt(mapping: Depara, today: string) {
  if (!mapping.ativo) return "inativo";
  if (mapping.vigencia_inicio > today) return "futuro";
  if (mapping.vigencia_fim && mapping.vigencia_fim < today) return "encerrado";
  return "vigente";
}

function MappingStatus({ value }: { value: string }) {
  const styles: Record<string, string> = {
    vigente: "border-emerald-200 bg-emerald-50 text-emerald-700",
    futuro: "border-blue-200 bg-blue-50 text-blue-700",
    encerrado: "border-slate-200 bg-slate-50 text-slate-600",
    inativo: "border-rose-200 bg-rose-50 text-rose-700",
  };
  return <span className={`rounded-full border px-2.5 py-1 text-[11px] font-black uppercase tracking-wide ${styles[value] ?? styles.inativo}`}>{value}</span>;
}

export default async function ComercialDeparaPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const { supabase, empresaId, unidadeId } = await requireAnyPermission([
    "comercial.visualizar",
    "comercial.editar",
    "credenciamento.visualizar",
    "credenciamento.gerenciar",
    "tabelas_comerciais.visualizar",
    "tabelas_comerciais.gerenciar",
  ]);

  const [contractsReq, planosReq, fontesReq, canEditReq] = await Promise.all([
    supabase
      .from("credenciamento_contratos")
      .select("id,convenio_id,plano_id,numero_contrato,data_inicio,data_fim,status,convenio:convenios(nome_fantasia,registro_ans)")
      .eq("empresa_id", empresaId)
      .order("created_at", { ascending: false })
      .limit(250),
    supabase.from("convenio_planos").select("id,convenio_id,nome").eq("empresa_id", empresaId).eq("ativo", true).order("nome"),
    supabase.from("tabelas_comerciais_fontes").select("id,codigo,nome,tipo").eq("empresa_id", empresaId).eq("ativo", true).order("nome"),
    supabase.rpc("comercial_pode_editar", { p_empresa: empresaId, p_unidade: unidadeId }),
  ]);

  const contratos = (contractsReq.data ?? []) as unknown as Contrato[];
  const planos = (planosReq.data ?? []) as Plano[];
  const fontes = (fontesReq.data ?? []) as Fonte[];
  const planoMap = new Map(planos.map((item) => [item.id, item]));
  const fonteMap = new Map(fontes.map((item) => [item.id, item]));
  const selectedContract = contratos.find((item) => item.id === sp.contrato) ?? contratos.find((item) => item.status === "ativo") ?? contratos[0] ?? null;
  const canEdit = canEditReq.data === true && !canEditReq.error;

  let vinculos: Vinculo[] = [];
  let mappings: Depara[] = [];
  if (selectedContract) {
    const [linksReq, mappingsReq] = await Promise.all([
      supabase
        .from("contrato_tabelas_comerciais")
        .select("id,contrato_id,fonte_id,categoria,prioridade,ativo")
        .eq("contrato_id", selectedContract.id)
        .eq("ativo", true)
        .order("prioridade"),
      supabase
        .from("contrato_depara_tuss")
        .select("id,contrato_id,fonte_id,codigo_origem,descricao_origem,codigo_tuss,descricao_tuss,tabela_tiss_codigo,vigencia_inicio,vigencia_fim,ativo,observacoes,created_at,updated_at")
        .eq("contrato_id", selectedContract.id)
        .order("codigo_origem")
        .order("vigencia_inicio", { ascending: false }),
    ]);
    vinculos = (linksReq.data ?? []) as Vinculo[];
    mappings = (mappingsReq.data ?? []) as Depara[];
  }

  const linkedSourceIds = Array.from(new Set(vinculos.map((item) => item.fonte_id)));
  const linkedSources = linkedSourceIds.map((id) => fonteMap.get(id)).filter((item): item is Fonte => Boolean(item));
  const today = localToday();
  const q = cleanSearch(sp.q ?? "").toLowerCase();
  const sourceFilter = sp.fonte && linkedSourceIds.includes(sp.fonte) ? sp.fonte : "";
  const statusFilter = ["vigente", "futuro", "encerrado", "inativo"].includes(sp.status ?? "") ? String(sp.status) : "";
  const filteredMappings = mappings.filter((mapping) => {
    if (sourceFilter && mapping.fonte_id !== sourceFilter) return false;
    if (statusFilter && statusAt(mapping, today) !== statusFilter) return false;
    if (!q) return true;
    const source = fonteMap.get(mapping.fonte_id);
    return `${mapping.codigo_origem} ${mapping.descricao_origem ?? ""} ${mapping.codigo_tuss} ${mapping.descricao_tuss ?? ""} ${source?.nome ?? ""}`.toLowerCase().includes(q);
  });

  const currentCount = mappings.filter((item) => statusAt(item, today) === "vigente").length;
  const futureCount = mappings.filter((item) => statusAt(item, today) === "futuro").length;
  const historyCount = mappings.filter((item) => ["encerrado", "inativo"].includes(statusAt(item, today))).length;
  const mappedSourceCount = new Set(mappings.filter((item) => item.ativo).map((item) => item.fonte_id)).size;
  const selectedConvenio = selectedContract ? one(selectedContract.convenio) : null;
  const selectedPlan = selectedContract?.plano_id ? planoMap.get(selectedContract.plano_id) ?? null : null;
  const errors = [contractsReq.error, planosReq.error, fontesReq.error].filter(Boolean);

  return (
    <SectionPage
      eyebrow="Comercial / DePara TUSS"
      title="DePara TUSS contratual e versionado"
      description="Mapeie códigos da fonte contratada para TUSS por contrato e vigência. O motor usa esta correspondência antes do catálogo global e registra a origem na memória de cálculo."
      actions={<div className="flex flex-wrap gap-2"><Link href="/comercial" className="ui-button-secondary"><BookOpenCheck className="size-4" />Contratos</Link><Link href="/comercial/tabelas" className="ui-button-secondary"><Database className="size-4" />Fontes e edições</Link><Link href="/comercial/regras" className="ui-button-secondary"><ShieldCheck className="size-4" />Regras e pacotes</Link></div>}
    >
      <CadastrosWorkspaceNav active="/comercial/depara" />
      {errors.length ? <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-800">Há consultas comerciais com erro. Revise permissões e RLS antes de alterar o DePara.</div> : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <CadastroKpi label="Vigentes" value={currentCount} detail={`Data de referência ${today}`} />
        <CadastroKpi label="Futuros" value={futureCount} detail="Aguardando início da vigência" />
        <CadastroKpi label="Histórico" value={historyCount} detail="Encerrados ou inativos" />
        <CadastroKpi label="Fontes vinculadas" value={linkedSources.length} />
        <CadastroKpi label="Fontes com DePara" value={`${mappedSourceCount}/${linkedSources.length}`} detail="DePara pode ser dispensável quando o item já possui TUSS direto" />
      </section>

      <div className="mt-5 grid gap-5 xl:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="his-card h-fit p-4">
          <div className="mb-3 flex items-center gap-2"><ArrowLeftRight className="size-5 text-brand-700" /><div><h2 className="font-black text-slate-900">Contrato</h2><p className="text-xs text-slate-500">O DePara nunca é compartilhado automaticamente entre contratos.</p></div></div>
          <div className="max-h-[620px] space-y-2 overflow-y-auto pr-1">
            {contratos.map((contrato) => {
              const convenio = one(contrato.convenio);
              const plano = contrato.plano_id ? planoMap.get(contrato.plano_id) : null;
              const selected = contrato.id === selectedContract?.id;
              return <Link key={contrato.id} href={href({ contrato: contrato.id })} className={`block rounded-xl border p-3 transition ${selected ? "border-brand-300 bg-brand-50" : "border-slate-100 hover:border-slate-200"}`}>
                <div className="flex items-start justify-between gap-2"><b className="min-w-0 truncate text-sm text-slate-900">{convenio?.nome_fantasia ?? "Convênio"}</b><span className="text-[10px] font-black uppercase text-slate-400">{contrato.status}</span></div>
                <p className="mt-1 text-xs text-slate-500">{plano?.nome ?? "Todos os planos"} · {contrato.numero_contrato || "Sem nº"}</p>
                <p className="mt-1 text-[11px] text-slate-400">ANS {convenio?.registro_ans || "—"}</p>
              </Link>;
            })}
            {!contratos.length ? <p className="py-6 text-center text-sm text-slate-500">Nenhum contrato disponível.</p> : null}
          </div>
        </aside>

        <main className="min-w-0 space-y-5">
          {selectedContract ? <>
            <section className="his-card p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div><p className="text-xs font-black uppercase tracking-wider text-brand-600">Contexto selecionado</p><h2 className="mt-1 text-xl font-black text-slate-950">{selectedConvenio?.nome_fantasia ?? "Convênio"} · {selectedContract.numero_contrato || "Sem nº"}</h2><p className="mt-1 text-sm text-slate-500">{selectedPlan?.nome ?? "Todos os planos"} · {selectedContract.data_inicio || "sem início"} → {selectedContract.data_fim || "vigência aberta"}</p></div>
                <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-black uppercase text-slate-600">{selectedContract.status}</span>
              </div>
              {!linkedSources.length ? <div className="mt-4 flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><TriangleAlert className="mt-0.5 size-5 shrink-0" /><div><b>Nenhuma fonte ativa vinculada.</b><p className="mt-1 leading-6">Vincule primeiro AMB, CBHPM, Brasíndice, CMED, SIMPRO ou outra fonte em Contratos. O sistema não permite criar DePara para uma fonte fora do contrato.</p></div></div> : null}

              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4"><ShieldCheck className="size-5 text-brand-700" /><b className="mt-2 block text-sm text-slate-900">Prioridade contratual</b><p className="mt-1 text-xs leading-5 text-slate-500">O mapeamento deste contrato vence o fallback global somente dentro da sua vigência.</p></div>
                <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4"><CalendarClock className="size-5 text-brand-700" /><b className="mt-2 block text-sm text-slate-900">Histórico preservado</b><p className="mt-1 text-xs leading-5 text-slate-500">Nova correspondência deve iniciar outra vigência; não reescreva o passado.</p></div>
                <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4"><FileClock className="size-5 text-brand-700" /><b className="mt-2 block text-sm text-slate-900">Memória de cálculo</b><p className="mt-1 text-xs leading-5 text-slate-500">O faturamento registra o ID e a origem do DePara utilizado no cálculo.</p></div>
              </div>
            </section>

            {canEdit && linkedSources.length ? <section className="his-card p-5">
              <div className="mb-4"><p className="text-xs font-black uppercase tracking-wider text-brand-600">Nova versão</p><h2 className="mt-1 text-lg font-black text-slate-950">Cadastrar correspondência explícita</h2><p className="mt-1 text-sm leading-6 text-slate-500">Informe somente códigos confirmados na fonte e na TUSS aplicável. O HIS não sugere equivalências automaticamente.</p></div>
              <CommercialDeparaBackgroundForm className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <input type="hidden" name="contrato_id" value={selectedContract.id} />
                <input type="hidden" name="ativo" value="true" />
                <label className="text-xs font-bold text-slate-600">Fonte vinculada<select name="fonte_id" required defaultValue="" className="ui-input mt-1"><option value="">Selecione</option>{linkedSources.map((source) => <option key={source.id} value={source.id}>{sourceLabel(source)}</option>)}</select></label>
                <label className="text-xs font-bold text-slate-600">Código na fonte<input name="codigo_origem" required className="ui-input mt-1" placeholder="Código exatamente como contratado" /></label>
                <label className="text-xs font-bold text-slate-600">Descrição na fonte<input name="descricao_origem" className="ui-input mt-1" placeholder="Opcional" /></label>
                <label className="text-xs font-bold text-slate-600">Código TUSS<input name="codigo_tuss" required className="ui-input mt-1" placeholder="Correspondência confirmada" /></label>
                <label className="text-xs font-bold text-slate-600">Descrição TUSS<input name="descricao_tuss" className="ui-input mt-1" placeholder="Opcional" /></label>
                <label className="text-xs font-bold text-slate-600">Tabela TISS<select name="tabela_tiss_codigo" defaultValue="" className="ui-input mt-1"><option value="">Não informar</option><option value="00">00 · Tabela própria</option><option value="18">18 · Diárias/taxas/gases</option><option value="19">19 · Materiais/OPME</option><option value="20">20 · Medicamentos</option><option value="22">22 · Procedimentos/eventos</option><option value="98">98 · Pacotes</option></select></label>
                <label className="text-xs font-bold text-slate-600">Início da vigência<input type="date" name="vigencia_inicio" required defaultValue={selectedContract.data_inicio ?? ""} className="ui-input mt-1" /></label>
                <label className="text-xs font-bold text-slate-600">Fim da vigência<input type="date" name="vigencia_fim" className="ui-input mt-1" /></label>
                <label className="text-xs font-bold text-slate-600 md:col-span-2 xl:col-span-4">Observações<textarea name="observacoes" rows={2} className="ui-input mt-1" placeholder="Aditivo, documento ou justificativa da equivalência" /></label>
              </CommercialDeparaBackgroundForm>
            </section> : null}

            <section className="his-card p-5">
              <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-wider text-brand-600">Mapa contratual</p><h2 className="mt-1 text-lg font-black text-slate-950">Correspondências e histórico</h2></div><span className="text-xs font-bold text-slate-500">{filteredMappings.length} de {mappings.length}</span></div>
              <form className="mt-4 grid gap-2 md:grid-cols-[minmax(0,1fr)_220px_180px_auto]">
                <input type="hidden" name="contrato" value={selectedContract.id} />
                <div className="relative"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" /><input name="q" defaultValue={sp.q ?? ""} className="ui-input pl-9" placeholder="Código, descrição ou fonte" /></div>
                <select name="fonte" defaultValue={sourceFilter} className="ui-input"><option value="">Todas as fontes</option>{linkedSources.map((source) => <option key={source.id} value={source.id}>{source.nome}</option>)}</select>
                <select name="status" defaultValue={statusFilter} className="ui-input"><option value="">Todos os status</option><option value="vigente">Vigente</option><option value="futuro">Futuro</option><option value="encerrado">Encerrado</option><option value="inativo">Inativo</option></select>
                <button className="ui-button-secondary">Filtrar</button>
              </form>

              <div className="mt-4 space-y-3">
                {filteredMappings.map((mapping) => {
                  const source = fonteMap.get(mapping.fonte_id);
                  const linked = linkedSourceIds.includes(mapping.fonte_id);
                  const currentStatus = statusAt(mapping, today);
                  return <article key={mapping.id} className="rounded-2xl border border-slate-200 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><b className="text-sm text-slate-950">{mapping.codigo_origem}</b><ArrowLeftRight className="size-4 text-slate-400" /><b className="text-sm text-brand-800">{mapping.codigo_tuss}</b>{mapping.tabela_tiss_codigo ? <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-black text-slate-500">TISS {mapping.tabela_tiss_codigo}</span> : null}</div><p className="mt-1 text-sm text-slate-600">{mapping.descricao_origem || "Sem descrição de origem"} → {mapping.descricao_tuss || "Sem descrição TUSS"}</p><p className="mt-1 text-xs text-slate-400">{sourceLabel(source)} · {mapping.vigencia_inicio} → {mapping.vigencia_fim || "vigência aberta"}</p></div><MappingStatus value={currentStatus} /></div>
                    {mapping.observacoes ? <p className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-600">{mapping.observacoes}</p> : null}
                    {!linked ? <p className="mt-3 text-xs font-bold text-amber-700">A fonte deste histórico não está mais vinculada ao contrato. O registro permanece para auditoria.</p> : null}
                    {canEdit && linked ? <details className="mt-3 border-t border-slate-100 pt-3"><summary className="cursor-pointer text-xs font-black uppercase tracking-wide text-brand-700">Editar / encerrar vigência</summary><CommercialDeparaBackgroundForm deparaId={mapping.id} className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                      <input type="hidden" name="contrato_id" value={selectedContract.id} />
                      <label className="text-xs font-bold text-slate-600">Fonte<select name="fonte_id" required defaultValue={mapping.fonte_id} className="ui-input mt-1">{linkedSources.map((item) => <option key={item.id} value={item.id}>{sourceLabel(item)}</option>)}</select></label>
                      <label className="text-xs font-bold text-slate-600">Código na fonte<input name="codigo_origem" required defaultValue={mapping.codigo_origem} className="ui-input mt-1" /></label>
                      <label className="text-xs font-bold text-slate-600">Descrição na fonte<input name="descricao_origem" defaultValue={mapping.descricao_origem ?? ""} className="ui-input mt-1" /></label>
                      <label className="text-xs font-bold text-slate-600">Código TUSS<input name="codigo_tuss" required defaultValue={mapping.codigo_tuss} className="ui-input mt-1" /></label>
                      <label className="text-xs font-bold text-slate-600">Descrição TUSS<input name="descricao_tuss" defaultValue={mapping.descricao_tuss ?? ""} className="ui-input mt-1" /></label>
                      <label className="text-xs font-bold text-slate-600">Tabela TISS<input name="tabela_tiss_codigo" defaultValue={mapping.tabela_tiss_codigo ?? ""} maxLength={2} className="ui-input mt-1" placeholder="Ex.: 22" /></label>
                      <label className="text-xs font-bold text-slate-600">Início<input type="date" name="vigencia_inicio" required defaultValue={mapping.vigencia_inicio} className="ui-input mt-1" /></label>
                      <label className="text-xs font-bold text-slate-600">Fim<input type="date" name="vigencia_fim" defaultValue={mapping.vigencia_fim ?? ""} className="ui-input mt-1" /></label>
                      <label className="text-xs font-bold text-slate-600">Status<select name="ativo" defaultValue={mapping.ativo ? "true" : "false"} className="ui-input mt-1"><option value="true">Ativo</option><option value="false">Inativo</option></select></label>
                      <label className="text-xs font-bold text-slate-600 md:col-span-2 xl:col-span-3">Observações<textarea name="observacoes" rows={2} defaultValue={mapping.observacoes ?? ""} className="ui-input mt-1" /></label>
                    </CommercialDeparaBackgroundForm></details> : null}
                  </article>;
                })}
                {!filteredMappings.length ? <div className="rounded-2xl border border-dashed border-slate-200 py-10 text-center text-sm text-slate-500">Nenhum DePara encontrado para os filtros atuais.</div> : null}
              </div>
            </section>
          </> : <section className="his-card p-8 text-center"><TriangleAlert className="mx-auto size-8 text-amber-500" /><h2 className="mt-3 font-black text-slate-900">Nenhum contrato comercial disponível</h2><p className="mt-1 text-sm text-slate-500">Cadastre um contrato e vincule uma fonte antes de configurar o DePara TUSS.</p></section>}
        </main>
      </div>
    </SectionPage>
  );
}
