import type { Route } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight, FileClock, Filter, History, UserRound } from "lucide-react";
import { CadastrosWorkspaceNav, CadastroKpi } from "@/components/cadastros/cadastros-workspace-nav";
import { SectionPage } from "@/components/painel/section-page";
import { requireAnyPermission } from "@/lib/permissions/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const PAGE_SIZE = 50;
const ENTITY_LABELS: Record<string, string> = {
  credenciamento_contratos: "Contrato",
  contrato_tabelas_comerciais: "Vínculo de tabela",
  contrato_depara_tuss: "DePara TUSS",
  contrato_regras_faturamento: "Regra de faturamento",
  contrato_regras_procedimentos: "Regra de procedimento",
  contrato_pacotes: "Pacote",
  contrato_pacote_itens: "Item de pacote",
  contrato_cbhpm_portes: "Porte CBHPM",
  tabelas_comerciais_fontes: "Fonte comercial",
  tabelas_comerciais_edicoes: "Edição comercial",
  tabelas_comerciais_itens: "Item de tabela",
};
const ACTION_LABELS: Record<string, string> = { insert: "Criação", update: "Alteração", delete: "Exclusão" };
const IGNORED_DIFF_FIELDS = new Set(["updated_at", "updated_by"]);

type JsonRecord = Record<string, unknown>;
type EventRow = {
  id: string;
  entidade_tipo: string;
  entidade_id: string;
  acao: string;
  antes: JsonRecord | null;
  depois: JsonRecord | null;
  usuario_id: string | null;
  created_at: string;
  contexto_contrato_id: string | null;
  contexto_edicao_id: string | null;
};
type ContractRow = {
  id: string;
  numero_contrato: string | null;
  convenio: { nome_fantasia: string | null } | { nome_fantasia: string | null }[] | null;
};
type UserRow = { id: string; nome: string | null };
type SearchParams = { contrato?: string; entidade?: string; acao?: string; de?: string; ate?: string; pagina?: string };

type Diff = { field: string; before: unknown; after: unknown };

function one<T>(value: T | T[] | null): T | null { return Array.isArray(value) ? value[0] ?? null : value; }
function safeDate(value: string | undefined) { return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : ""; }
function safePage(value: string | undefined) { return Math.max(1, Number.parseInt(value ?? "1", 10) || 1); }
function formatDateTime(value: string) { return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "medium", timeZone: "America/Sao_Paulo" }).format(new Date(value)); }
function displayValue(value: unknown) {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Sim" : "Não";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}
function changes(before: JsonRecord | null, after: JsonRecord | null): Diff[] {
  const keys = new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})]);
  return [...keys]
    .filter((key) => !IGNORED_DIFF_FIELDS.has(key))
    .filter((key) => JSON.stringify(before?.[key]) !== JSON.stringify(after?.[key]))
    .sort()
    .map((field) => ({ field, before: before?.[field], after: after?.[field] }));
}
function pageHref(sp: SearchParams, page: number): Route {
  const qs = new URLSearchParams();
  for (const key of ["contrato", "entidade", "acao", "de", "ate"] as const) if (sp[key]) qs.set(key, String(sp[key]));
  qs.set("pagina", String(page));
  return `/comercial/historico?${qs.toString()}` as Route;
}

export default async function ComercialHistoricoPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const { supabase, empresaId } = await requireAnyPermission([
    "comercial.visualizar", "comercial.editar", "credenciamento.visualizar", "credenciamento.gerenciar", "tabelas_comerciais.visualizar", "tabelas_comerciais.gerenciar",
  ]);

  const page = safePage(sp.pagina);
  const entity = sp.entidade && ENTITY_LABELS[sp.entidade] ? sp.entidade : "";
  const action = sp.acao && ACTION_LABELS[sp.acao] ? sp.acao : "";
  const fromDate = safeDate(sp.de);
  const toDate = safeDate(sp.ate);

  const contractsReq = await supabase
    .from("credenciamento_contratos")
    .select("id,numero_contrato,convenio:convenios(nome_fantasia)")
    .eq("empresa_id", empresaId)
    .order("created_at", { ascending: false })
    .limit(300);
  const contracts = (contractsReq.data ?? []) as unknown as ContractRow[];
  const validContract = sp.contrato && contracts.some((item) => item.id === sp.contrato) ? sp.contrato : "";

  let query = supabase
    .from("comercial_eventos")
    .select("id,entidade_tipo,entidade_id,acao,antes,depois,usuario_id,created_at,contexto_contrato_id,contexto_edicao_id", { count: "exact" })
    .eq("empresa_id", empresaId)
    .order("created_at", { ascending: false });
  if (validContract) query = query.eq("contexto_contrato_id", validContract);
  if (entity) query = query.eq("entidade_tipo", entity);
  if (action) query = query.eq("acao", action);
  if (fromDate) query = query.gte("created_at", `${fromDate}T00:00:00-03:00`);
  if (toDate) query = query.lte("created_at", `${toDate}T23:59:59.999-03:00`);

  const start = (page - 1) * PAGE_SIZE;
  const eventsReq = await query.range(start, start + PAGE_SIZE - 1);
  const events = (eventsReq.data ?? []) as EventRow[];
  const total = eventsReq.count ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const userIds = [...new Set(events.map((item) => item.usuario_id).filter((id): id is string => Boolean(id)))];
  let users: UserRow[] = [];
  if (userIds.length) {
    const usersReq = await supabase.from("usuarios").select("id,nome").in("id", userIds);
    users = (usersReq.data ?? []) as UserRow[];
  }
  const userMap = new Map(users.map((item) => [item.id, item.nome || "Usuário"]));
  const contractMap = new Map(contracts.map((item) => [item.id, `${one(item.convenio)?.nome_fantasia ?? "Convênio"} · ${item.numero_contrato || "Sem nº"}`]));
  const visibleInserts = events.filter((item) => item.acao === "insert").length;
  const visibleUpdates = events.filter((item) => item.acao === "update").length;
  const visibleDeletes = events.filter((item) => item.acao === "delete").length;

  return <SectionPage eyebrow="Comercial / Auditoria" title="Histórico comercial" description="Timeline auditável de alterações de contratos, vínculos, DePara, regras, tabelas e edições. Os registros são somente leitura e respeitam o mesmo escopo comercial de empresa e unidade." actions={<Link href="/comercial/vinculos" className="ui-button-secondary"><History className="size-4" />Vínculos e histórico</Link>}>
    <CadastrosWorkspaceNav active="/comercial/historico" />

    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <CadastroKpi label="Eventos filtrados" value={total} detail={`Página ${Math.min(page, pages)} de ${pages}`} />
      <CadastroKpi label="Criações nesta página" value={visibleInserts} />
      <CadastroKpi label="Alterações nesta página" value={visibleUpdates} />
      <CadastroKpi label="Exclusões nesta página" value={visibleDeletes} />
    </section>

    <section className="his-card mt-5 p-5">
      <div className="mb-4 flex items-center gap-2"><Filter className="size-5 text-brand-700" /><div><h2 className="font-black text-slate-950">Filtros</h2><p className="text-xs text-slate-500">Use filtros para evitar carregar milhares de mutações de itens de tabela sem necessidade.</p></div></div>
      <form className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <label className="text-xs font-bold text-slate-600">Contrato<select name="contrato" defaultValue={validContract} className="ui-input mt-1"><option value="">Todos</option>{contracts.map((item) => <option key={item.id} value={item.id}>{contractMap.get(item.id)}</option>)}</select></label>
        <label className="text-xs font-bold text-slate-600">Entidade<select name="entidade" defaultValue={entity} className="ui-input mt-1"><option value="">Todas</option>{Object.entries(ENTITY_LABELS).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label className="text-xs font-bold text-slate-600">Ação<select name="acao" defaultValue={action} className="ui-input mt-1"><option value="">Todas</option>{Object.entries(ACTION_LABELS).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label className="text-xs font-bold text-slate-600">De<input type="date" name="de" defaultValue={fromDate} className="ui-input mt-1" /></label>
        <label className="text-xs font-bold text-slate-600">Até<input type="date" name="ate" defaultValue={toDate} className="ui-input mt-1" /></label>
        <div className="md:col-span-2 xl:col-span-5 flex flex-wrap justify-end gap-2"><Link href="/comercial/historico" className="ui-button-secondary">Limpar</Link><button className="ui-button-primary"><Filter className="size-4" />Aplicar filtros</button></div>
      </form>
    </section>

    <section className="mt-5 space-y-3">
      {events.length ? events.map((event) => {
        const diff = changes(event.antes, event.depois);
        const shown = diff.slice(0, 12);
        return <article key={event.id} className="his-card p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><FileClock className="size-5 text-brand-700" /><span className="font-black text-slate-950">{ENTITY_LABELS[event.entidade_tipo] ?? event.entidade_tipo}</span><span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-black uppercase text-slate-600">{ACTION_LABELS[event.acao] ?? event.acao}</span></div><p className="mt-1 text-xs text-slate-500">{formatDateTime(event.created_at)} · ID {event.entidade_id.slice(0, 8)}{event.contexto_contrato_id ? ` · ${contractMap.get(event.contexto_contrato_id) ?? `Contrato ${event.contexto_contrato_id.slice(0,8)}`}` : ""}</p></div>
            <div className="flex items-center gap-2 text-xs text-slate-500"><UserRound className="size-4" />{event.usuario_id ? userMap.get(event.usuario_id) ?? `Usuário ${event.usuario_id.slice(0,8)}` : "Processo interno"}</div>
          </div>
          <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
            <div className="grid grid-cols-[minmax(140px,0.7fr)_minmax(0,1fr)_minmax(0,1fr)] bg-slate-50 px-3 py-2 text-[10px] font-black uppercase tracking-wide text-slate-500"><span>Campo</span><span>Antes</span><span>Depois</span></div>
            {shown.length ? shown.map((item) => <div key={item.field} className="grid grid-cols-[minmax(140px,0.7fr)_minmax(0,1fr)_minmax(0,1fr)] border-t border-slate-100 px-3 py-2 text-xs"><code className="break-all font-bold text-slate-700">{item.field}</code><span className="break-all pr-3 text-slate-500">{displayValue(item.before)}</span><span className="break-all text-slate-900">{displayValue(item.after)}</span></div>) : <p className="border-t border-slate-100 px-3 py-3 text-xs text-slate-500">Evento sem diferença de campos exibível.</p>}
          </div>
          {diff.length > shown.length ? <p className="mt-2 text-xs text-slate-500">+ {diff.length - shown.length} campo(s) alterado(s) não exibidos neste resumo.</p> : null}
        </article>;
      }) : <div className="his-card p-10 text-center"><History className="mx-auto size-8 text-slate-400" /><h2 className="mt-3 font-black text-slate-900">Nenhum evento encontrado</h2><p className="mt-1 text-sm text-slate-500">Ajuste os filtros ou selecione outro contrato/período.</p></div>}
    </section>

    {total > PAGE_SIZE ? <nav className="mt-5 flex items-center justify-between gap-3"><Link href={pageHref(sp, Math.max(1, page - 1))} aria-disabled={page <= 1} className={`ui-button-secondary ${page <= 1 ? "pointer-events-none opacity-40" : ""}`}><ChevronLeft className="size-4" />Anterior</Link><span className="text-sm font-bold text-slate-600">Página {Math.min(page,pages)} de {pages}</span><Link href={pageHref(sp, Math.min(pages, page + 1))} aria-disabled={page >= pages} className={`ui-button-secondary ${page >= pages ? "pointer-events-none opacity-40" : ""}`}>Próxima<ChevronRight className="size-4" /></Link></nav> : null}
  </SectionPage>;
}
