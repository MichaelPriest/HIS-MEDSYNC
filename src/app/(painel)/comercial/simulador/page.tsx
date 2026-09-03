import type { Route } from "next";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Calculator,
  CheckCircle2,
  FileSearch,
  ListChecks,
  ReceiptText,
  Search,
  ShieldAlert,
} from "lucide-react";
import { CadastrosWorkspaceNav, CadastroKpi } from "@/components/cadastros/cadastros-workspace-nav";
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
  unidade_id: string | null;
  numero_contrato: string | null;
  data_inicio: string | null;
  data_fim: string | null;
  status: string;
  convenio: Rel<Convenio>;
};
type Plano = { id: string; nome: string; convenio_id: string };
type Diagnostico = { severidade: string; codigo: string; categoria: string; mensagem: string };
type RegraAplicada = {
  id?: string;
  codigo?: string;
  descricao?: string;
  categoria?: string;
  prioridade?: number;
  operacao?: string;
  aplica_sobre?: string;
  percentual?: number | null;
  valor_fixo?: number | null;
  valor_antes?: number;
  valor_depois?: number;
  condicoes?: Record<string, unknown>;
};
type Simulacao = {
  status?: string;
  data_referencia?: string;
  contrato_id?: string;
  contrato_selecionado_id?: string;
  contrato_resolvido_id?: string | null;
  codigo?: string;
  categoria?: string;
  metodologia?: string;
  valor_base?: number;
  valor_final?: number;
  valor_resolvido?: number;
  regras_aplicadas?: RegraAplicada[];
  contexto?: Record<string, unknown>;
  memoria_base?: Record<string, unknown>;
};
type SearchParams = {
  contrato?: string;
  codigo?: string;
  data?: string;
  categoria?: string;
  urgencia?: string;
  horario_especial?: string;
  acomodacao_individual?: string;
  anestesia?: string;
  auxiliares?: string;
  sequencia?: string;
  via_acesso?: string;
  mesma_via?: string;
  origem_tipo?: string;
};

const CATEGORIAS = [
  ["procedimentos", "Procedimentos"],
  ["cirurgias", "Cirurgias"],
  ["sadt", "SADT / exames"],
  ["honorarios", "Honorários"],
  ["anestesia", "Anestesia"],
  ["auxiliares", "Auxiliares"],
  ["diarias", "Diárias"],
  ["taxas", "Taxas"],
  ["gases", "Gases"],
  ["materiais", "Materiais"],
  ["medicamentos", "Medicamentos"],
  ["opme", "OPME"],
  ["pacotes", "Pacotes"],
] as const;

const one = <T,>(value: Rel<T>): T | null => Array.isArray(value) ? value[0] ?? null : value;
const localToday = () => new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Sao_Paulo" }).format(new Date());
const validDate = (value: string | undefined) => value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : localToday();
const safeInt = (value: string | undefined, fallback: number, min: number) => Math.max(min, Number.parseInt(value ?? String(fallback), 10) || fallback);
const checked = (value: string | undefined) => value === "1" || value === "true" || value === "on";
const brl = (value: unknown) => typeof value === "number" && Number.isFinite(value)
  ? value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
  : "—";
const text = (value: unknown) => value === null || value === undefined || value === "" ? "—" : String(value);
const clean = (value: string | undefined, max = 80) => (value ?? "").replace(/[<>]/g, "").trim().slice(0, max);

function contractHref(id: string): Route {
  return `/comercial/simulador?contrato=${encodeURIComponent(id)}` as Route;
}

function statusMeta(status: string | undefined) {
  if (status === "precificado") return { label: "Precificado", className: "border-emerald-200 bg-emerald-50 text-emerald-900", icon: CheckCircle2 };
  if (status === "contrato_contextual_diferente") return { label: "Conflito de contexto", className: "border-rose-200 bg-rose-50 text-rose-900", icon: ShieldAlert };
  if (status === "contrato_fora_contexto") return { label: "Contrato fora da vigência", className: "border-amber-200 bg-amber-50 text-amber-900", icon: AlertTriangle };
  if (status === "sem_preco_contratual") return { label: "Sem preço contratual", className: "border-rose-200 bg-rose-50 text-rose-900", icon: ShieldAlert };
  return { label: "Aguardando simulação", className: "border-slate-200 bg-slate-50 text-slate-700", icon: Calculator };
}

function memoryRows(memory: Record<string, unknown> | undefined) {
  if (!memory) return [];
  const fields: Array<[string, string]> = [
    ["fonte", "Fonte"],
    ["fonte_tipo", "Tipo da fonte"],
    ["edicao", "Edição"],
    ["categoria_contrato", "Categoria do vínculo"],
    ["prioridade_tabela", "Prioridade"],
    ["codigo_fonte", "Código na fonte"],
    ["codigo_tuss", "Código TUSS resolvido"],
    ["tabela_tiss_codigo", "Tabela TISS"],
    ["depara_origem", "Origem do DePara"],
    ["depara_tuss_id", "ID do DePara"],
    ["metodo_base", "Método da base"],
    ["base_preco", "Base de preço"],
    ["pontos_ch", "Pontos CH"],
    ["pontos_hm", "Pontos HM"],
    ["pontos_sadt", "Pontos SADT"],
    ["porte", "Porte"],
    ["porte_anestesico", "Porte anestésico"],
    ["quantidade_uco", "Quantidade UCO"],
    ["valor_uco_contratual", "UCO contratual"],
    ["quantidade_filme", "Quantidade de filme"],
    ["valor_filme_m2", "Filme / m²"],
    ["percentual_ajuste_contrato", "Ajuste do vínculo (%)"],
    ["base_calculo", "Base calculada"],
  ];
  return fields.flatMap(([key, label]) => memory[key] === null || memory[key] === undefined || memory[key] === "" ? [] : [{ key, label, value: memory[key] }]);
}

export default async function ComercialSimuladorPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const { supabase, empresaId } = await requireAnyPermission([
    "comercial.visualizar",
    "comercial.editar",
    "credenciamento.visualizar",
    "credenciamento.gerenciar",
    "tabelas_comerciais.visualizar",
    "tabelas_comerciais.gerenciar",
  ]);

  const [contractsReq, planosReq] = await Promise.all([
    supabase
      .from("credenciamento_contratos")
      .select("id,convenio_id,plano_id,unidade_id,numero_contrato,data_inicio,data_fim,status,convenio:convenios(nome_fantasia,registro_ans)")
      .eq("empresa_id", empresaId)
      .order("created_at", { ascending: false })
      .limit(250),
    supabase
      .from("convenio_planos")
      .select("id,nome,convenio_id")
      .eq("empresa_id", empresaId)
      .eq("ativo", true)
      .order("nome"),
  ]);

  const contratos = (contractsReq.data ?? []) as unknown as Contrato[];
  const planos = (planosReq.data ?? []) as Plano[];
  const planoMap = new Map(planos.map((item) => [item.id, item]));
  const selected = contratos.find((item) => item.id === sp.contrato)
    ?? contratos.find((item) => item.status === "ativo")
    ?? contratos[0]
    ?? null;

  const codigo = clean(sp.codigo, 100);
  const data = validDate(sp.data);
  const categoria = CATEGORIAS.some(([value]) => value === sp.categoria) ? String(sp.categoria) : "procedimentos";
  const urgencia = checked(sp.urgencia);
  const horarioEspecial = checked(sp.horario_especial);
  const acomodacaoIndividual = checked(sp.acomodacao_individual);
  const anestesia = checked(sp.anestesia);
  const mesmaVia = checked(sp.mesma_via);
  const auxiliares = safeInt(sp.auxiliares, 0, 0);
  const sequencia = safeInt(sp.sequencia, 1, 1);
  const viaAcesso = clean(sp.via_acesso, 60) || null;
  const origemTipo = clean(sp.origem_tipo, 60) || null;

  let simulacao: Simulacao | null = null;
  let simError: string | null = null;
  let prontidao: Diagnostico[] = [];
  if (selected && codigo) {
    const [simReq, readyReq] = await Promise.all([
      supabase.rpc("comercial_simular_precificacao", {
        p_contrato_id: selected.id,
        p_codigo: codigo,
        p_data: data,
        p_categoria: categoria,
        p_urgencia: urgencia,
        p_horario_especial: horarioEspecial,
        p_acomodacao_individual: acomodacaoIndividual,
        p_anestesia: anestesia,
        p_quantidade_auxiliares: auxiliares,
        p_sequencia: sequencia,
        p_via_acesso: viaAcesso,
        p_mesma_via: mesmaVia,
        p_origem_tipo: origemTipo,
      }),
      supabase.rpc("comercial_prontidao_contrato", { p_contrato_id: selected.id, p_data: data }),
    ]);
    simulacao = simReq.data as Simulacao | null;
    simError = simReq.error?.message ?? null;
    prontidao = (readyReq.data ?? []) as Diagnostico[];
  }

  const blockers = prontidao.filter((item) => item.severidade === "bloqueio").length;
  const warnings = prontidao.filter((item) => item.severidade === "aviso").length;
  const regras = Array.isArray(simulacao?.regras_aplicadas) ? simulacao.regras_aplicadas : [];
  const memory = simulacao?.memoria_base;
  const meta = statusMeta(simulacao?.status);
  const StatusIcon = meta.icon;
  const selectedConvenio = selected ? one(selected.convenio) : null;
  const selectedPlan = selected?.plano_id ? planoMap.get(selected.plano_id) ?? null : null;

  return (
    <SectionPage
      eyebrow="Comercial / Simulador"
      title="Simulador de precificação contratual"
      description="Execute a mesma cadeia comercial usada pelo faturamento sem criar conta, alterar preço ou gravar snapshot. Use para homologar códigos, tabelas, portes, DePara e regras antes da operação real."
      actions={selected ? <div className="flex flex-wrap gap-2"><Link href={`/comercial/prontidao?contrato=${selected.id}&data=${data}` as Route} className="ui-button-secondary"><ListChecks className="size-4" />Prontidão</Link><Link href={`/comercial?contrato=${selected.id}&aba=negociacao` as Route} className="ui-button-secondary"><ReceiptText className="size-4" />Negociação</Link></div> : null}
    >
      <CadastrosWorkspaceNav active="/comercial/simulador" />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <CadastroKpi label="Resultado" value={meta.label} detail={codigo ? `Código ${codigo}` : "Informe um código"} />
        <CadastroKpi label="Valor base" value={brl(simulacao?.valor_base)} detail="Antes das regras adicionais" />
        <CadastroKpi label="Valor final" value={brl(simulacao?.valor_final)} detail={`${regras.length} regra(s) aplicada(s)`} />
        <CadastroKpi label="Prontidão" value={blockers ? `${blockers} bloqueio(s)` : warnings ? `${warnings} aviso(s)` : codigo ? "Sem bloqueios" : "—"} detail={`Referência ${data}`} />
        <CadastroKpi label="Persistência" value="Nenhuma" detail="Simulação somente leitura" />
      </section>

      <div className="mt-5 grid gap-5 xl:grid-cols-[330px_minmax(0,1fr)]">
        <aside className="his-card h-fit p-4">
          <div className="mb-3 flex items-center gap-2"><Search className="size-5 text-brand-700" /><div><h2 className="font-black text-slate-900">Contratos</h2><p className="text-xs text-slate-500">O motor deve resolver exatamente este contexto.</p></div></div>
          <div className="max-h-[680px] space-y-2 overflow-y-auto pr-1">
            {contratos.map((contrato) => {
              const convenio = one(contrato.convenio);
              const plano = contrato.plano_id ? planoMap.get(contrato.plano_id) : null;
              const active = contrato.id === selected?.id;
              return <Link key={contrato.id} href={contractHref(contrato.id)} className={`block rounded-xl border p-3 transition ${active ? "border-brand-300 bg-brand-50" : "border-slate-100 hover:border-slate-200"}`}>
                <div className="flex items-start justify-between gap-2"><b className="min-w-0 truncate text-sm text-slate-900">{convenio?.nome_fantasia ?? "Convênio"}</b><span className="text-[10px] font-black uppercase text-slate-400">{contrato.status}</span></div>
                <p className="mt-1 text-xs text-slate-500">{plano?.nome ?? "Todos os planos"} · {contrato.numero_contrato || "Sem nº"}</p>
                <p className="mt-1 text-[11px] text-slate-400">{contrato.data_inicio || "sem início"} → {contrato.data_fim || "aberto"}</p>
              </Link>;
            })}
            {!contratos.length ? <p className="py-8 text-center text-sm text-slate-500">Nenhum contrato disponível.</p> : null}
          </div>
        </aside>

        <main className="min-w-0 space-y-5">
          {selected ? <>
            <section className="his-card p-5">
              <div className="mb-4"><p className="text-xs font-black uppercase tracking-wider text-brand-600">Contexto da simulação</p><h2 className="mt-1 text-xl font-black text-slate-950">{selectedConvenio?.nome_fantasia ?? "Convênio"} · {selected.numero_contrato || "Sem nº"}</h2><p className="mt-1 text-sm text-slate-500">{selectedPlan?.nome ?? "Todos os planos"} · ANS {selectedConvenio?.registro_ans || "—"}</p></div>
              <form className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <input type="hidden" name="contrato" value={selected.id} />
                <label className="text-xs font-bold text-slate-600 md:col-span-2">Código da fonte, próprio ou TUSS<input name="codigo" defaultValue={codigo} required maxLength={100} placeholder="Ex.: código contratado ou TUSS" className="ui-input mt-1" /></label>
                <label className="text-xs font-bold text-slate-600">Data de referência<input type="date" name="data" defaultValue={data} className="ui-input mt-1" /></label>
                <label className="text-xs font-bold text-slate-600">Categoria<select name="categoria" defaultValue={categoria} className="ui-input mt-1">{CATEGORIAS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                <label className="text-xs font-bold text-slate-600">Sequência no ato<input type="number" min={1} name="sequencia" defaultValue={sequencia} className="ui-input mt-1" /></label>
                <label className="text-xs font-bold text-slate-600">Nº de auxiliares<input type="number" min={0} name="auxiliares" defaultValue={auxiliares} className="ui-input mt-1" /></label>
                <label className="text-xs font-bold text-slate-600">Via de acesso<input name="via_acesso" defaultValue={viaAcesso ?? ""} maxLength={60} placeholder="Quando a regra exigir" className="ui-input mt-1" /></label>
                <label className="text-xs font-bold text-slate-600">Origem / tipo<input name="origem_tipo" defaultValue={origemTipo ?? ""} maxLength={60} placeholder="exame, honorario, material..." className="ui-input mt-1" /></label>
                <div className="md:col-span-2 xl:col-span-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
                  {[
                    ["urgencia", "Urgência", urgencia],
                    ["horario_especial", "Horário especial", horarioEspecial],
                    ["acomodacao_individual", "Acomodação individual", acomodacaoIndividual],
                    ["anestesia", "Anestesia", anestesia],
                    ["mesma_via", "Mesma via do primeiro ato", mesmaVia],
                  ].map(([name, label, value]) => <label key={String(name)} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-bold text-slate-700"><input type="checkbox" name={String(name)} value="1" defaultChecked={Boolean(value)} />{String(label)}</label>)}
                </div>
                <div className="md:col-span-2 xl:col-span-4 flex flex-wrap gap-2"><button className="ui-button-primary"><Calculator className="size-4" />Simular preço</button><Link href={`/comercial/depara?contrato=${selected.id}` as Route} className="ui-button-secondary">DePara TUSS</Link><Link href={`/comercial/regras?contrato=${selected.id}` as Route} className="ui-button-secondary">Regras / CBHPM</Link></div>
              </form>
            </section>

            {simError ? <section className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-rose-900"><div className="flex gap-3"><ShieldAlert className="mt-0.5 size-5 shrink-0" /><div><h2 className="font-black">Falha ao simular</h2><p className="mt-1 text-sm leading-6">{simError}</p></div></div></section> : null}

            {!simError && simulacao ? <section className={`rounded-2xl border p-5 ${meta.className}`}><div className="flex flex-wrap items-start justify-between gap-4"><div className="flex gap-3"><StatusIcon className="mt-0.5 size-6 shrink-0" /><div><h2 className="font-black">{meta.label}</h2><p className="mt-1 text-sm leading-6">{simulacao.status === "precificado" ? "O motor encontrou uma cadeia comercial válida e reproduziu as regras vigentes sem persistir dados." : simulacao.status === "contrato_contextual_diferente" ? "O contexto informado resolveu outro contrato. Revise sobreposição, plano, unidade e vigência antes de homologar." : simulacao.status === "sem_preco_contratual" ? "Nenhuma combinação segura de tabela, edição, item e componentes contratuais produziu preço." : "O contrato selecionado não está ativo/vigente na data simulada."}</p></div></div>{simulacao.status === "contrato_contextual_diferente" ? <Link href={`/comercial/prontidao?contrato=${selected.id}&data=${data}` as Route} className="ui-button-secondary">Revisar prontidão<ArrowRight className="size-4" /></Link> : null}</div></section> : null}

            {simulacao?.status === "precificado" ? <>
              <section className="grid gap-4 lg:grid-cols-2">
                <div className="his-card p-5"><div className="flex items-center gap-2"><FileSearch className="size-5 text-brand-700" /><h2 className="font-black text-slate-950">Memória da base</h2></div><div className="mt-4 grid gap-2 sm:grid-cols-2">{memoryRows(memory).map((row) => <div key={row.key} className="rounded-xl border border-slate-100 bg-slate-50 p-3"><p className="text-[10px] font-black uppercase tracking-wide text-slate-400">{row.label}</p><p className="mt-1 break-words text-sm font-bold text-slate-800">{row.key.startsWith("valor_") || row.key === "base_calculo" ? brl(typeof row.value === "number" ? row.value : Number(row.value)) : text(row.value)}</p></div>)}</div>{!memoryRows(memory).length ? <p className="mt-4 text-sm text-slate-500">O resolvedor não retornou memória detalhada.</p> : null}</div>
                <div className="his-card p-5"><div className="flex items-center gap-2"><ListChecks className="size-5 text-brand-700" /><h2 className="font-black text-slate-950">Contexto aplicado</h2></div><div className="mt-4 grid gap-2 sm:grid-cols-2">{Object.entries(simulacao.contexto ?? {}).map(([key, value]) => <div key={key} className="rounded-xl border border-slate-100 bg-slate-50 p-3"><p className="text-[10px] font-black uppercase tracking-wide text-slate-400">{key.replaceAll("_", " ")}</p><p className="mt-1 text-sm font-bold text-slate-800">{typeof value === "boolean" ? value ? "Sim" : "Não" : text(value)}</p></div>)}</div></div>
              </section>

              <section className="his-card p-5">
                <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-wider text-brand-600">Regras contratuais</p><h2 className="mt-1 text-lg font-black text-slate-950">Caminho do valor base ao valor final</h2></div><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">{regras.length} aplicada(s)</span></div>
                <div className="mt-4 space-y-3">{regras.map((regra, index) => <article key={regra.id ?? `${regra.codigo}-${index}`} className="rounded-2xl border border-slate-200 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2"><code className="rounded bg-slate-100 px-2 py-1 text-[11px] font-black text-slate-600">{regra.codigo ?? `REGRA ${index + 1}`}</code><span className="text-xs font-bold text-slate-400">Prioridade {regra.prioridade ?? "—"}</span></div><p className="mt-2 text-sm font-bold text-slate-900">{regra.descricao ?? "Regra contratual"}</p><p className="mt-1 text-xs text-slate-500">{regra.operacao ?? "—"} sobre {regra.aplica_sobre ?? "—"}{regra.percentual !== null && regra.percentual !== undefined ? ` · ${regra.percentual}%` : ""}{regra.valor_fixo !== null && regra.valor_fixo !== undefined ? ` · ${brl(regra.valor_fixo)}` : ""}</p></div><div className="text-right"><p className="text-xs text-slate-400">{brl(regra.valor_antes)}</p><p className="text-sm font-black text-slate-900">→ {brl(regra.valor_depois)}</p></div></div></article>)}{!regras.length ? <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-center"><CheckCircle2 className="mx-auto size-6 text-emerald-600" /><p className="mt-2 text-sm font-bold text-slate-800">Nenhuma regra adicional foi aplicada</p><p className="mt-1 text-xs text-slate-500">O valor final é o valor resolvido pela tabela/vínculo comercial.</p></div> : null}</div>
              </section>
            </> : null}

            {!codigo ? <section className="his-card p-8 text-center"><Calculator className="mx-auto size-9 text-brand-600" /><h2 className="mt-3 font-black text-slate-950">Informe um código para iniciar</h2><p className="mx-auto mt-1 max-w-2xl text-sm leading-6 text-slate-500">Você pode testar código da tabela de origem, código próprio ou TUSS. Quando houver DePara explícito, o mesmo resolvedor do faturamento será usado.</p></section> : null}
          </> : <section className="his-card p-8 text-center"><AlertTriangle className="mx-auto size-8 text-amber-500" /><h2 className="mt-3 font-black text-slate-900">Nenhum contrato disponível</h2><p className="mt-1 text-sm text-slate-500">Cadastre ou habilite um contrato comercial antes de simular.</p></section>}
        </main>
      </div>
    </SectionPage>
  );
}
