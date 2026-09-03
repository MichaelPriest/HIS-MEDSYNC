import type { Route } from "next";
import Link from "next/link";
import {
  AlertTriangle,
  BadgeCheck,
  CheckCircle2,
  Clock3,
  FileCheck2,
  History,
  RefreshCcw,
  RotateCcw,
  Search,
  ShieldAlert,
} from "lucide-react";
import { CadastrosWorkspaceNav, CadastroKpi } from "@/components/cadastros/cadastros-workspace-nav";
import { SectionPage } from "@/components/painel/section-page";
import { requireAnyPermission } from "@/lib/permissions/server";
import { homologarContratoComercial, revogarHomologacaoComercial } from "@/modules/comercial/homologacao-actions";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Rel<T> = T | T[] | null;
type Convenio = { nome_fantasia: string | null; registro_ans: string | null };
type Contrato = {
  id: string;
  numero_contrato: string | null;
  status: string;
  data_inicio: string | null;
  data_fim: string | null;
  plano_id: string | null;
  unidade_id: string | null;
  convenio: Rel<Convenio>;
};
type Diagnostico = {
  severidade: "bloqueio" | "aviso" | "ok" | string;
  codigo: string;
  categoria: string;
  mensagem: string;
  contexto: Record<string, unknown> | null;
};
type HomologacaoStatus = {
  status?: "nao_homologado" | "homologado" | "desatualizado" | "revogado" | "substituido" | string;
  homologacao_id?: string;
  contrato_id?: string;
  data_referencia?: string;
  homologado_em?: string;
  homologado_por?: string;
  avisos_aceitos?: boolean;
  observacoes?: string | null;
  evento_corte_em?: string | null;
  ultima_mutacao_relevante_em?: string | null;
  revogado_em?: string | null;
  motivo_revogacao?: string | null;
  prontidao_snapshot?: Diagnostico[];
};
type Historico = {
  id: string;
  data_referencia: string;
  status: string;
  prontidao_snapshot: Diagnostico[] | null;
  avisos_aceitos: boolean;
  observacoes: string | null;
  evento_corte_em: string | null;
  homologado_em: string;
  revogado_em: string | null;
  motivo_revogacao: string | null;
};
type SearchParams = { contrato?: string; data?: string; sucesso?: string; erro?: string };

const one = <T,>(value: Rel<T>): T | null => Array.isArray(value) ? value[0] ?? null : value;
const localToday = () => new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Sao_Paulo" }).format(new Date());
const validDate = (value: string | undefined) => value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : localToday();
const fmtDateTime = (value: string | null | undefined) => value
  ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(value))
  : "—";

function contractHref(id: string, data: string): Route {
  return `/comercial/homologacao?contrato=${encodeURIComponent(id)}&data=${data}` as Route;
}

function stateMeta(status: string | undefined) {
  if (status === "homologado") return { label: "Homologado", detail: "Configuração formalmente homologada e sem mutação relevante posterior.", className: "border-emerald-200 bg-emerald-50 text-emerald-900", icon: CheckCircle2 };
  if (status === "desatualizado") return { label: "Desatualizado", detail: "A cadeia comercial mudou após a homologação. Revise e homologue uma nova versão.", className: "border-amber-200 bg-amber-50 text-amber-950", icon: RefreshCcw };
  if (status === "revogado") return { label: "Revogado", detail: "A homologação foi revogada formalmente e não deve ser tratada como vigente.", className: "border-rose-200 bg-rose-50 text-rose-900", icon: RotateCcw };
  if (status === "substituido") return { label: "Substituído", detail: "Este registro histórico foi substituído por uma homologação posterior.", className: "border-slate-200 bg-slate-50 text-slate-700", icon: History };
  return { label: "Não homologado", detail: "Ainda não há homologação formal registrada para a configuração comercial.", className: "border-slate-200 bg-slate-50 text-slate-700", icon: BadgeCheck };
}

function diagnosticBadge(severity: string) {
  if (severity === "bloqueio") return "border-rose-200 bg-rose-50 text-rose-700";
  if (severity === "aviso") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-emerald-200 bg-emerald-50 text-emerald-700";
}

export default async function ComercialHomologacaoPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const { supabase, empresaId } = await requireAnyPermission([
    "comercial.visualizar",
    "comercial.editar",
    "credenciamento.visualizar",
    "credenciamento.gerenciar",
    "tabelas_comerciais.visualizar",
    "tabelas_comerciais.gerenciar",
  ]);

  const data = validDate(sp.data);
  const contractsReq = await supabase
    .from("credenciamento_contratos")
    .select("id,numero_contrato,status,data_inicio,data_fim,plano_id,unidade_id,convenio:convenios(nome_fantasia,registro_ans)")
    .eq("empresa_id", empresaId)
    .order("created_at", { ascending: false })
    .limit(250);

  const contratos = (contractsReq.data ?? []) as unknown as Contrato[];
  const selected = contratos.find((item) => item.id === sp.contrato)
    ?? contratos.find((item) => item.status === "ativo")
    ?? contratos[0]
    ?? null;

  let readiness: Diagnostico[] = [];
  let status: HomologacaoStatus = { status: "nao_homologado" };
  let history: Historico[] = [];
  let canEdit = false;
  let loadingError: string | null = null;

  if (selected) {
    const [readyReq, statusReq, historyReq, editReq] = await Promise.all([
      supabase.rpc("comercial_prontidao_contrato", { p_contrato_id: selected.id, p_data: data }),
      supabase.rpc("comercial_status_homologacao", { p_contrato_id: selected.id }),
      supabase
        .from("contrato_homologacoes_comerciais")
        .select("id,data_referencia,status,prontidao_snapshot,avisos_aceitos,observacoes,evento_corte_em,homologado_em,revogado_em,motivo_revogacao")
        .eq("contrato_id", selected.id)
        .order("homologado_em", { ascending: false })
        .limit(30),
      supabase.rpc("comercial_pode_editar", { p_empresa: empresaId, p_unidade: selected.unidade_id }),
    ]);
    readiness = (readyReq.data ?? []) as Diagnostico[];
    status = (statusReq.data ?? { status: "nao_homologado" }) as HomologacaoStatus;
    history = (historyReq.data ?? []) as unknown as Historico[];
    canEdit = editReq.data === true;
    loadingError = readyReq.error?.message ?? statusReq.error?.message ?? historyReq.error?.message ?? null;
  }

  const blockers = readiness.filter((item) => item.severidade === "bloqueio");
  const warnings = readiness.filter((item) => item.severidade === "aviso");
  const state = stateMeta(status.status);
  const StateIcon = state.icon;
  const convenio = selected ? one(selected.convenio) : null;
  const canHomologate = Boolean(selected && canEdit && blockers.length === 0);
  const canRevoke = Boolean(canEdit && status.homologacao_id && ["homologado", "desatualizado"].includes(status.status ?? ""));

  return (
    <SectionPage
      eyebrow="Comercial / Governança"
      title="Homologação da configuração comercial"
      description="Registre a aprovação interna da parametrização depois de revisar prontidão e simular cenários reais. Alterações posteriores deixam a homologação desatualizada sem apagar o histórico."
      actions={selected ? <div className="flex flex-wrap gap-2"><Link href={`/comercial/prontidao?contrato=${selected.id}&data=${data}` as Route} className="ui-button-secondary"><FileCheck2 className="size-4" />Prontidão</Link><Link href={`/comercial/simulador?contrato=${selected.id}&data=${data}` as Route} className="ui-button-secondary"><Search className="size-4" />Simulador</Link></div> : null}
    >
      <CadastrosWorkspaceNav active="/comercial/homologacao" />

      {sp.sucesso ? <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-800">{sp.sucesso === "revogado" ? "Homologação revogada e registrada no histórico." : "Configuração comercial homologada e fotografada com sucesso."}</div> : null}
      {sp.erro ? <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-800">{sp.erro}</div> : null}
      {loadingError ? <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-800">Não foi possível carregar toda a governança comercial: {loadingError}</div> : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <CadastroKpi label="Homologação" value={state.label} detail={status.data_referencia ? `Referência ${status.data_referencia}` : "Sem registro formal"} />
        <CadastroKpi label="Bloqueios" value={blockers.length} detail={blockers.length ? "Impedem homologação" : "Nenhum bloqueio conhecido"} />
        <CadastroKpi label="Avisos" value={warnings.length} detail={warnings.length ? "Exigem aceite explícito" : "Sem avisos pendentes"} />
        <CadastroKpi label="Última homologação" value={status.homologado_em ? fmtDateTime(status.homologado_em) : "—"} detail={status.avisos_aceitos ? "Avisos aceitos no snapshot" : "Sem aceite de avisos"} />
        <CadastroKpi label="Última mutação" value={status.ultima_mutacao_relevante_em ? fmtDateTime(status.ultima_mutacao_relevante_em) : "—"} detail="Contrato, tabela, edição, regra, pacote, CBHPM ou DePara" />
      </section>

      <div className="mt-5 grid gap-5 xl:grid-cols-[330px_minmax(0,1fr)]">
        <aside className="his-card h-fit p-4">
          <div className="mb-3 flex items-center gap-2"><Search className="size-5 text-brand-700" /><div><h2 className="font-black text-slate-900">Contratos</h2><p className="text-xs text-slate-500">Selecione a configuração a governar.</p></div></div>
          <div className="max-h-[680px] space-y-2 overflow-y-auto pr-1">
            {contratos.map((contrato) => {
              const itemConvenio = one(contrato.convenio);
              const active = contrato.id === selected?.id;
              return <Link key={contrato.id} href={contractHref(contrato.id, data)} className={`block rounded-xl border p-3 transition ${active ? "border-brand-300 bg-brand-50" : "border-slate-100 hover:border-slate-200"}`}>
                <div className="flex items-start justify-between gap-2"><b className="min-w-0 truncate text-sm text-slate-900">{itemConvenio?.nome_fantasia ?? "Convênio"}</b><span className="text-[10px] font-black uppercase text-slate-400">{contrato.status}</span></div>
                <p className="mt-1 text-xs text-slate-500">{contrato.numero_contrato || "Sem nº"}</p>
                <p className="mt-1 text-[11px] text-slate-400">{contrato.data_inicio || "sem início"} → {contrato.data_fim || "aberto"}</p>
              </Link>;
            })}
            {!contratos.length ? <p className="py-8 text-center text-sm text-slate-500">Nenhum contrato disponível.</p> : null}
          </div>
        </aside>

        <main className="min-w-0 space-y-5">
          {selected ? <>
            <section className={`rounded-2xl border p-5 ${state.className}`}>
              <div className="flex flex-wrap items-start justify-between gap-4"><div className="flex gap-3"><StateIcon className="mt-0.5 size-6 shrink-0" /><div><p className="text-xs font-black uppercase tracking-wide opacity-70">{convenio?.nome_fantasia ?? "Convênio"} · {selected.numero_contrato || "Sem nº"}</p><h2 className="mt-1 text-xl font-black">{state.label}</h2><p className="mt-1 max-w-3xl text-sm leading-6">{state.detail}</p>{status.status === "desatualizado" ? <p className="mt-2 text-xs font-bold">Mudança relevante detectada em {fmtDateTime(status.ultima_mutacao_relevante_em)}; a homologação anterior foi em {fmtDateTime(status.homologado_em)}.</p> : null}</div></div><form><input type="hidden" name="contrato" value={selected.id} /><label className="text-xs font-black uppercase tracking-wide">Data de referência<input name="data" type="date" defaultValue={data} className="ui-input mt-1 min-w-40" /></label><button className="ui-button-secondary mt-2 w-full"><Clock3 className="size-4" />Reavaliar</button></form></div>
            </section>

            <section className="rounded-2xl border border-blue-200 bg-blue-50 p-5 text-blue-950">
              <div className="flex gap-3"><ShieldAlert className="mt-0.5 size-5 shrink-0" /><div><h2 className="font-black">Escopo desta homologação</h2><p className="mt-1 text-sm leading-6">A homologação registra a revisão interna do contrato selecionado na data informada. Ela não substitui homologação da operadora, validação jurídica, conferência do instrumento contratual ou aprovação regulatória. Contratos gerais também não comprovam automaticamente todos os cenários de planos ou unidades mais específicos; use o simulador nos contextos relevantes.</p></div></div>
            </section>

            <section className="his-card p-5">
              <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-wider text-brand-600">Pré-condições</p><h2 className="mt-1 text-lg font-black text-slate-950">Prontidão fotografada na homologação</h2></div><Link href={`/comercial/prontidao?contrato=${selected.id}&data=${data}` as Route} className="ui-button-secondary">Abrir diagnóstico completo</Link></div>
              <div className="mt-4 space-y-3">{readiness.map((item) => <article key={`${item.severidade}-${item.codigo}-${item.categoria}`} className="rounded-2xl border border-slate-200 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2"><span className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase ${diagnosticBadge(item.severidade)}`}>{item.severidade}</span><code className="text-[11px] font-bold text-slate-400">{item.codigo}</code></div><p className="mt-2 text-sm font-bold text-slate-900">{item.mensagem}</p><p className="mt-1 text-xs text-slate-500">Categoria: {item.categoria}</p></div>{item.severidade === "bloqueio" ? <AlertTriangle className="size-5 text-rose-500" /> : item.severidade === "aviso" ? <AlertTriangle className="size-5 text-amber-500" /> : <CheckCircle2 className="size-5 text-emerald-500" />}</div></article>)}{!readiness.length ? <p className="text-sm text-slate-500">Nenhum diagnóstico retornado para esta data.</p> : null}</div>
            </section>

            <section className="grid gap-5 lg:grid-cols-2">
              <div className="his-card p-5">
                <div className="flex items-center gap-2"><BadgeCheck className="size-5 text-brand-700" /><h2 className="font-black text-slate-950">Homologar configuração</h2></div>
                {blockers.length ? <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800"><b>Homologação bloqueada.</b><p className="mt-1">Resolva {blockers.length} bloqueio(s) na prontidão antes de registrar a aprovação.</p></div> : null}
                {!canEdit ? <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">Seu acesso permite consultar, mas não homologar ou revogar configurações comerciais.</div> : null}
                {canHomologate ? <form action={homologarContratoComercial} className="mt-4 space-y-4">
                  <input type="hidden" name="contrato_id" value={selected.id} /><input type="hidden" name="data_referencia" value={data} />
                  {warnings.length ? <label className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-900"><input type="checkbox" name="aceitar_avisos" className="mt-1" required /><span>Revisei os {warnings.length} aviso(s), compreendo que não são bloqueios técnicos e aceito registrá-los no snapshot desta homologação.</span></label> : null}
                  <label className="block text-xs font-bold text-slate-600">Observações da homologação<textarea name="observacoes" rows={4} maxLength={2000} placeholder="Documento revisado, cenários simulados, ressalvas ou referência interna." className="ui-input mt-1 min-h-28" /></label>
                  <button className="ui-button-primary w-full"><BadgeCheck className="size-4" />{status.status === "desatualizado" || status.status === "homologado" ? "Homologar nova versão" : "Homologar configuração"}</button>
                  <p className="text-xs leading-5 text-slate-500">Esta é uma transição crítica: a prontidão atual será fotografada e o usuário/data ficarão registrados no histórico comercial.</p>
                </form> : null}
              </div>

              <div className="his-card p-5">
                <div className="flex items-center gap-2"><RotateCcw className="size-5 text-rose-600" /><h2 className="font-black text-slate-950">Revogar homologação</h2></div>
                {canRevoke ? <form action={revogarHomologacaoComercial} className="mt-4 space-y-4"><input type="hidden" name="homologacao_id" value={status.homologacao_id} /><input type="hidden" name="contrato_id" value={selected.id} /><input type="hidden" name="data_referencia" value={data} /><label className="block text-xs font-bold text-slate-600">Motivo da revogação<textarea name="motivo_revogacao" required rows={4} maxLength={2000} placeholder="Informe a razão documental/operacional para retirar a homologação." className="ui-input mt-1 min-h-28" /></label><button className="ui-button-secondary w-full border-rose-200 text-rose-700 hover:bg-rose-50"><RotateCcw className="size-4" />Revogar homologação</button></form> : <p className="mt-4 text-sm leading-6 text-slate-500">Não existe homologação ativa que possa ser revogada neste momento.</p>}
              </div>
            </section>

            <section className="his-card p-5">
              <div className="flex items-center gap-2"><History className="size-5 text-brand-700" /><div><h2 className="font-black text-slate-950">Histórico de homologações</h2><p className="text-xs text-slate-500">Registros são preservados; uma nova homologação substitui a anterior sem apagá-la.</p></div></div>
              <div className="mt-4 space-y-3">{history.map((item) => { const snapshot = Array.isArray(item.prontidao_snapshot) ? item.prontidao_snapshot : []; const itemBlockers = snapshot.filter((d) => d.severidade === "bloqueio").length; const itemWarnings = snapshot.filter((d) => d.severidade === "aviso").length; return <article key={item.id} className="rounded-2xl border border-slate-200 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black uppercase text-slate-600">{item.status}</span><span className="text-xs font-bold text-slate-400">Referência {item.data_referencia}</span></div><p className="mt-2 text-sm font-bold text-slate-900">Homologado em {fmtDateTime(item.homologado_em)}</p><p className="mt-1 text-xs text-slate-500">Snapshot: {itemBlockers} bloqueio(s) · {itemWarnings} aviso(s) · aceite de avisos: {item.avisos_aceitos ? "sim" : "não"}</p>{item.observacoes ? <p className="mt-2 text-sm text-slate-600">{item.observacoes}</p> : null}{item.motivo_revogacao ? <p className="mt-2 text-sm font-bold text-rose-700">Revogação: {item.motivo_revogacao}</p> : null}</div><div className="text-right text-xs text-slate-400"><p>Corte: {fmtDateTime(item.evento_corte_em)}</p>{item.revogado_em ? <p className="mt-1">Revogado: {fmtDateTime(item.revogado_em)}</p> : null}</div></div></article>; })}{!history.length ? <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center"><BadgeCheck className="mx-auto size-7 text-slate-400" /><p className="mt-2 text-sm font-bold text-slate-700">Nenhuma homologação registrada</p></div> : null}</div>
            </section>
          </> : <section className="his-card p-8 text-center"><AlertTriangle className="mx-auto size-8 text-amber-500" /><h2 className="mt-3 font-black text-slate-900">Nenhum contrato disponível</h2><p className="mt-1 text-sm text-slate-500">Cadastre um contrato comercial antes de iniciar a governança de homologação.</p></section>}
        </main>
      </div>
    </SectionPage>
  );
}
