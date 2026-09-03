import type { Route } from "next";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  FileWarning,
  SearchCheck,
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
  numero_contrato: string | null;
  data_inicio: string | null;
  data_fim: string | null;
  status: string;
  convenio: Rel<Convenio>;
};
type Plano = { id: string; convenio_id: string; nome: string };
type Diagnostico = {
  severidade: "bloqueio" | "aviso" | "ok" | string;
  codigo: string;
  categoria: string;
  mensagem: string;
  contexto: Record<string, unknown> | null;
};
type SearchParams = { contrato?: string; data?: string };

const one = <T,>(value: Rel<T>): T | null => Array.isArray(value) ? value[0] ?? null : value;
const localToday = () => new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Sao_Paulo" }).format(new Date());
const validDate = (value: string | undefined) => value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : localToday();

function pageHref(contratoId: string, data?: string): Route {
  const qs = new URLSearchParams({ contrato: contratoId });
  if (data) qs.set("data", data);
  return `/comercial/prontidao?${qs.toString()}` as Route;
}

function fixHref(item: Diagnostico, contratoId: string): Route {
  if (item.codigo === "TUSS_NAO_MAPEADO") return `/comercial/depara?contrato=${contratoId}` as Route;
  if (item.codigo.startsWith("CBHPM_")) return `/comercial/regras?contrato=${contratoId}` as Route;
  if (["PRAZO_PAGAMENTO_AUSENTE", "CONTRATO_INATIVO", "CONTRATO_FORA_VIGENCIA"].includes(item.codigo)) {
    return `/comercial?contrato=${contratoId}&aba=resumo` as Route;
  }
  return `/comercial?contrato=${contratoId}&aba=negociacao` as Route;
}

function fixLabel(item: Diagnostico) {
  if (item.codigo === "TUSS_NAO_MAPEADO") return "Revisar DePara TUSS";
  if (item.codigo.startsWith("CBHPM_")) return "Revisar CBHPM";
  if (["PRAZO_PAGAMENTO_AUSENTE", "CONTRATO_INATIVO", "CONTRATO_FORA_VIGENCIA"].includes(item.codigo)) return "Revisar contrato";
  return "Revisar negociação";
}

function contextDetails(context: Record<string, unknown> | null) {
  if (!context) return [];
  const labels: Array<[string, string]> = [
    ["fonte", "Fonte"],
    ["edicao", "Edição"],
    ["base_preco", "Base"],
    ["itens_afetados", "Itens afetados"],
    ["grupos_empatados", "Empates"],
    ["data_referencia", "Data"],
    ["inicio", "Início"],
    ["fim", "Fim"],
    ["modo_edicao", "Modo da edição"],
  ];
  return labels.flatMap(([key, label]) => {
    const value = context[key];
    return value === null || value === undefined || value === "" ? [] : [`${label}: ${String(value)}`];
  });
}

function SeverityIcon({ severity }: { severity: string }) {
  if (severity === "bloqueio") return <ShieldAlert className="size-5 text-rose-600" />;
  if (severity === "aviso") return <AlertTriangle className="size-5 text-amber-600" />;
  return <CheckCircle2 className="size-5 text-emerald-600" />;
}

function severityStyles(severity: string) {
  if (severity === "bloqueio") return "border-rose-200 bg-rose-50/70";
  if (severity === "aviso") return "border-amber-200 bg-amber-50/70";
  return "border-emerald-200 bg-emerald-50/70";
}

export default async function ComercialProntidaoPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
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
      .select("id,convenio_id,plano_id,numero_contrato,data_inicio,data_fim,status,convenio:convenios(nome_fantasia,registro_ans)")
      .eq("empresa_id", empresaId)
      .order("created_at", { ascending: false })
      .limit(250),
    supabase
      .from("convenio_planos")
      .select("id,convenio_id,nome")
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
  const dataReferencia = validDate(sp.data);

  let diagnosticos: Diagnostico[] = [];
  let rpcError: string | null = null;
  if (selected) {
    const result = await supabase.rpc("comercial_prontidao_contrato", {
      p_contrato_id: selected.id,
      p_data: dataReferencia,
    });
    diagnosticos = (result.data ?? []) as Diagnostico[];
    rpcError = result.error?.message ?? null;
  }

  const blockers = diagnosticos.filter((item) => item.severidade === "bloqueio");
  const warnings = diagnosticos.filter((item) => item.severidade === "aviso");
  const ok = !rpcError && blockers.length === 0 && warnings.length === 0 && diagnosticos.some((item) => item.severidade === "ok");
  const sorted = [...diagnosticos].sort((a, b) => {
    const weight = (value: string) => value === "bloqueio" ? 0 : value === "aviso" ? 1 : 2;
    return weight(a.severidade) - weight(b.severidade) || a.categoria.localeCompare(b.categoria) || a.codigo.localeCompare(b.codigo);
  });
  const selectedConvenio = selected ? one(selected.convenio) : null;
  const selectedPlan = selected?.plano_id ? planoMap.get(selected.plano_id) ?? null : null;
  const statusLabel = rpcError ? "Falha no diagnóstico" : blockers.length ? "Bloqueado" : warnings.length ? "Revisão necessária" : ok ? "Pronto" : "Sem resultado";

  return (
    <SectionPage
      eyebrow="Comercial / Prontidão"
      title="Prontidão contratual para cobrança"
      description="Diagnóstico somente leitura da configuração comercial na data informada. A tela aponta a origem da pendência, mas nunca cria preço, porte, edição ou DePara automaticamente."
      actions={selected ? <Link href={`/comercial?contrato=${selected.id}` as Route} className="ui-button-secondary"><ClipboardCheck className="size-4" />Abrir contrato</Link> : null}
    >
      <CadastrosWorkspaceNav active="/comercial/prontidao" />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <CadastroKpi label="Resultado" value={statusLabel} detail={`Referência ${dataReferencia}`} />
        <CadastroKpi label="Bloqueios" value={blockers.length} detail="Impedem considerar o contrato pronto" />
        <CadastroKpi label="Avisos" value={warnings.length} detail="Exigem revisão operacional" />
        <CadastroKpi label="Contratos" value={contratos.length} detail="No escopo da empresa" />
        <CadastroKpi label="Regra" value="Sem inferência" detail="Nenhum dado é preenchido pelo diagnóstico" />
      </section>

      <div className="mt-5 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm leading-6 text-blue-900">
        <b>Prontidão não significa homologação.</b> Resultado verde indica apenas que o motor comercial não encontrou pendências conhecidas nessa configuração e data. Homologação continua dependendo do contrato real, operadora, dados importados e validação institucional.
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[330px_minmax(0,1fr)]">
        <aside className="his-card h-fit p-4">
          <div className="mb-3 flex items-center gap-2"><SearchCheck className="size-5 text-brand-700" /><div><h2 className="font-black text-slate-900">Contratos</h2><p className="text-xs text-slate-500">Selecione o contexto que será simulado.</p></div></div>
          <div className="max-h-[640px] space-y-2 overflow-y-auto pr-1">
            {contratos.map((contrato) => {
              const convenio = one(contrato.convenio);
              const plano = contrato.plano_id ? planoMap.get(contrato.plano_id) : null;
              const active = contrato.id === selected?.id;
              return <Link key={contrato.id} href={pageHref(contrato.id, dataReferencia)} className={`block rounded-xl border p-3 transition ${active ? "border-brand-300 bg-brand-50" : "border-slate-100 hover:border-slate-200"}`}>
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
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div><p className="text-xs font-black uppercase tracking-wider text-brand-600">Contrato em análise</p><h2 className="mt-1 text-xl font-black text-slate-950">{selectedConvenio?.nome_fantasia ?? "Convênio"} · {selected.numero_contrato || "Sem nº"}</h2><p className="mt-1 text-sm text-slate-500">{selectedPlan?.nome ?? "Todos os planos"} · ANS {selectedConvenio?.registro_ans || "—"}</p></div>
                <form className="flex flex-wrap items-end gap-2"><input type="hidden" name="contrato" value={selected.id} /><label className="text-xs font-bold text-slate-600">Data de referência<input type="date" name="data" defaultValue={dataReferencia} className="ui-input mt-1" /></label><button className="ui-button-secondary"><CalendarDays className="size-4" />Recalcular</button></form>
              </div>
            </section>

            {rpcError ? <section className="rounded-2xl border border-rose-200 bg-rose-50 p-5"><div className="flex gap-3"><FileWarning className="mt-0.5 size-5 shrink-0 text-rose-600" /><div><h2 className="font-black text-rose-900">Não foi possível executar a prontidão</h2><p className="mt-1 text-sm leading-6 text-rose-800">{rpcError}</p></div></div></section> : null}

            {!rpcError && sorted.map((item) => {
              const details = contextDetails(item.contexto);
              return <article key={`${item.codigo}-${item.categoria}-${JSON.stringify(item.contexto)}`} className={`rounded-2xl border p-5 ${severityStyles(item.severidade)}`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex min-w-0 gap-3"><span className="mt-0.5"><SeverityIcon severity={item.severidade} /></span><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="text-[10px] font-black uppercase tracking-wider text-slate-500">{item.categoria}</span><code className="rounded bg-white/70 px-2 py-0.5 text-[10px] font-bold text-slate-500">{item.codigo}</code></div><p className="mt-1 text-sm font-bold leading-6 text-slate-900">{item.mensagem}</p>{details.length ? <p className="mt-2 text-xs leading-5 text-slate-600">{details.join(" · ")}</p> : null}</div></div>
                  {item.severidade !== "ok" ? <Link href={fixHref(item, selected.id)} className="ui-button-secondary shrink-0">{fixLabel(item)}<ArrowRight className="size-4" /></Link> : null}
                </div>
              </article>;
            })}

            {!rpcError && ok ? <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6"><div className="flex gap-3"><CheckCircle2 className="mt-0.5 size-6 shrink-0 text-emerald-600" /><div><h2 className="font-black text-emerald-950">Configuração comercial sem pendências conhecidas</h2><p className="mt-1 text-sm leading-6 text-emerald-800">Na data {dataReferencia}, o diagnóstico encontrou contrato vigente, cadeia de tabelas resolvível e componentes comerciais necessários configurados. Continue a homologação com dados e regras reais da instituição.</p></div></div></section> : null}

            {!rpcError && !sorted.length ? <section className="his-card p-8 text-center"><AlertTriangle className="mx-auto size-8 text-amber-500" /><h2 className="mt-3 font-black text-slate-900">Sem resultado de prontidão</h2><p className="mt-1 text-sm text-slate-500">O RPC não retornou diagnósticos para este contrato. Revise a função antes de considerar o contrato pronto.</p></section> : null}
          </> : <section className="his-card p-8 text-center"><AlertTriangle className="mx-auto size-8 text-amber-500" /><h2 className="mt-3 font-black text-slate-900">Nenhum contrato disponível</h2><p className="mt-1 text-sm text-slate-500">Cadastre um contrato comercial antes de executar a prontidão.</p></section>}
        </main>
      </div>
    </SectionPage>
  );
}
