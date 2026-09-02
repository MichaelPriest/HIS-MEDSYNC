import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  BadgeDollarSign,
  Banknote,
  Boxes,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  FileCheck2,
  ReceiptText,
  RefreshCcw,
  Search,
  ShieldAlert,
  WalletCards,
} from "lucide-react";
import {
  NewBillingAccountModal,
  NewTissBatchModal,
} from "@/components/faturamento/billing-workspace-actions";
import { SectionPage } from "@/components/painel/section-page";
import { createClient } from "@/lib/supabase/server";
import { reprocessarContaPosAlta } from "@/modules/faturamento/pos-alta-actions";

function one<T>(rel: T | T[] | null): T | null {
  return Array.isArray(rel) ? rel[0] ?? null : rel;
}

function brl(value: number) {
  return `R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function today() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

const STATUS_REPROCESSAVEIS = new Set(["aberta", "pre_faturamento", "com_criticas"]);
const FILTROS = [
  ["todas", "Todas"],
  ["pre_faturamento", "Pré-faturamento"],
  ["com_criticas", "Com críticas"],
  ["pronta", "Prontas"],
  ["faturada", "Faturadas"],
] as const;

const statusStyle: Record<string, string> = {
  aberta: "bg-slate-100 text-slate-700",
  pre_faturamento: "bg-blue-50 text-blue-700",
  com_criticas: "bg-rose-50 text-rose-700",
  pronta: "bg-emerald-50 text-emerald-700",
  faturada: "bg-brand-50 text-brand-700",
  cancelada: "bg-slate-100 text-slate-500",
};

export default async function FaturamentoPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  const { status, q } = await searchParams;
  const supabase = await createClient();

  const [
    { data: atendimentos },
    { data: contas },
    { data: glosas },
    { data: recursos },
    { data: lotes },
    { data: recebiveis },
    { data: convenios },
  ] = await Promise.all([
    supabase
      .from("atendimentos")
      .select("id,numero_atendimento,data_abertura,status,paciente:pacientes(nome_completo,cpf,ra,numero_registro)")
      .in("status", ["aberto", "em_espera", "em_atendimento", "alta"])
      .order("data_abertura", { ascending: false })
      .limit(300),
    supabase
      .from("contas_faturamento")
      .select("id,atendimento_id,competencia,tipo_cobranca,status,valor_bruto,valor_liquido,updated_at,atendimento:atendimentos(numero_atendimento),paciente:pacientes(nome_completo,ra,numero_registro),convenio:convenios(nome_fantasia)")
      .order("updated_at", { ascending: false })
      .limit(300),
    supabase.from("tiss_glosas").select("id,status,valor_glosado").order("created_at", { ascending: false }).limit(500),
    supabase.from("tiss_recursos_glosa").select("id,status,valor_total_recursado").order("created_at", { ascending: false }).limit(500),
    supabase
      .from("tiss_lotes")
      .select("id,numero_lote,competencia,status,valor_total,previsao_pagamento,created_at,convenio:convenios(nome_fantasia)")
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("financeiro_recebiveis")
      .select("id,status,previsao_pagamento,valor_liquido_previsto,valor_recebido")
      .order("previsao_pagamento", { ascending: true })
      .limit(500),
    supabase.from("convenios").select("id,nome_fantasia,registro_ans").eq("ativo", true).order("nome_fantasia"),
  ]);

  const contasRows = contas ?? [];
  const contaPorAtendimento = new Map<string, { id: string; status: string }>();
  for (const conta of contasRows) {
    if (conta.atendimento_id) contaPorAtendimento.set(conta.atendimento_id, { id: conta.id, status: conta.status });
  }

  const atendimentosAtivos = (atendimentos ?? []).filter((item) => item.status !== "alta");
  const encounters = atendimentosAtivos.map((item) => {
    const paciente = one(item.paciente);
    return {
      id: item.id,
      numero_atendimento: item.numero_atendimento,
      data_abertura: item.data_abertura,
      paciente: {
        nome_completo: paciente?.nome_completo ?? "Paciente",
        cpf: paciente?.cpf ?? null,
        ra: paciente?.ra ?? "—",
        numero_registro: paciente?.numero_registro ?? 0,
      },
    };
  });

  const altasReprocessaveis = (atendimentos ?? []).filter((item) => {
    if (item.status !== "alta") return false;
    const conta = contaPorAtendimento.get(item.id);
    return !conta || STATUS_REPROCESSAVEIS.has(conta.status);
  });
  const altasSemConta = altasReprocessaveis.filter((item) => !contaPorAtendimento.has(item.id)).length;

  const criticas = contasRows.filter((conta) => conta.status === "com_criticas");
  const prontas = contasRows.filter((conta) => conta.status === "pronta");
  const faturadas = contasRows.filter((conta) => conta.status === "faturada");
  const valorContas = contasRows.reduce((sum, conta) => sum + Number(conta.valor_liquido ?? 0), 0);

  const glosasRows = glosas ?? [];
  const glosasAbertas = glosasRows.filter((glosa) => glosa.status === "aberta");
  const valorGlosadoAberto = glosasAbertas.reduce((sum, glosa) => sum + Number(glosa.valor_glosado ?? 0), 0);

  const recursosRows = recursos ?? [];
  const recursosAbertos = recursosRows.filter((recurso) => !["concluido", "cancelado", "deferido", "indeferido"].includes(String(recurso.status)));
  const valorRecursado = recursosAbertos.reduce((sum, recurso) => sum + Number(recurso.valor_total_recursado ?? 0), 0);

  const recebiveisRows = recebiveis ?? [];
  const hoje = today();
  const saldoReceber = recebiveisRows.reduce(
    (sum, item) => sum + Math.max(0, Number(item.valor_liquido_previsto ?? 0) - Number(item.valor_recebido ?? 0)),
    0,
  );
  const vencidos = recebiveisRows.filter((item) => {
    const saldo = Math.max(0, Number(item.valor_liquido_previsto ?? 0) - Number(item.valor_recebido ?? 0));
    return Boolean(item.previsao_pagamento && item.previsao_pagamento < hoje && saldo > 0.01 && !["recebido", "cancelado"].includes(String(item.status)));
  });

  const filtro = FILTROS.some(([key]) => key === status) ? status ?? "todas" : "todas";
  const query = q?.trim().toLocaleLowerCase("pt-BR") ?? "";
  const contasExibidas = contasRows.filter((conta) => {
    if (filtro !== "todas" && conta.status !== filtro) return false;
    if (!query) return true;
    const paciente = one(conta.paciente);
    const atendimento = one(conta.atendimento);
    const convenio = one(conta.convenio);
    const haystack = `${paciente?.nome_completo ?? ""} ${paciente?.ra ?? ""} ${paciente?.numero_registro ?? ""} ${atendimento?.numero_atendimento ?? ""} ${convenio?.nome_fantasia ?? ""}`.toLocaleLowerCase("pt-BR");
    return haystack.includes(query);
  });

  const ultimosLotes = (lotes ?? []).slice(0, 5);

  return <SectionPage
    eyebrow="Ciclo da Receita / Faturamento"
    title="Central do Ciclo da Receita"
    description="Visão operacional única de contas, produção, TISS, glosas, recursos e recebimentos. Priorize pendências sem navegar por telas desconectadas."
    actions={(
      <div className="flex flex-wrap gap-2">
        <NewBillingAccountModal encounters={encounters} />
        <NewTissBatchModal convenios={convenios ?? []} />
      </div>
    )}
  >
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-8">
      <MetricCard icon={ReceiptText} label="Contas" value={String(contasRows.length)} detail={brl(valorContas)} />
      <MetricCard icon={ShieldAlert} label="Com críticas" value={String(criticas.length)} tone="danger" detail="Exigem correção" />
      <MetricCard icon={FileCheck2} label="Prontas" value={String(prontas.length)} tone="success" detail="Aptas a guia" />
      <MetricCard icon={Boxes} label="Faturadas" value={String(faturadas.length)} detail="Contas finalizadas" />
      <MetricCard icon={CircleDollarSign} label="Glosas abertas" value={String(glosasAbertas.length)} tone="danger" detail={brl(valorGlosadoAberto)} />
      <MetricCard icon={BadgeDollarSign} label="Recursos ativos" value={String(recursosAbertos.length)} tone="warning" detail={brl(valorRecursado)} />
      <MetricCard icon={WalletCards} label="A receber" value={brl(saldoReceber)} compact detail={`${vencidos.length} vencido(s)`} tone={vencidos.length ? "warning" : "default"} />
      <MetricCard icon={RefreshCcw} label="Altas sem conta" value={String(altasSemConta)} tone={altasSemConta ? "warning" : "success"} detail="Reprocessáveis" />
    </section>

    <section className="mt-5 grid gap-4 xl:grid-cols-[1.35fr_.65fr]">
      <div className="his-card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[.14em] text-slate-400">Fila prioritária</p>
            <h2 className="mt-1 font-black text-slate-950">O que precisa de ação agora</h2>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">{criticas.length + glosasAbertas.length + vencidos.length + altasSemConta} pendência(s)</span>
        </div>
        <div className="grid gap-3 p-4 md:grid-cols-2">
          <PriorityCard icon={ShieldAlert} title="Contas com críticas" description="Corrija bloqueios de auditoria, cadastro e TISS antes de gerar a guia." value={criticas.length} href="/faturamento?status=com_criticas" tone="danger" />
          <PriorityCard icon={CircleDollarSign} title="Glosas abertas" description="Analise valores glosados e abra recurso com justificativa documentada." value={glosasAbertas.length} href="/faturamento/glosas" tone="danger" />
          <PriorityCard icon={AlertTriangle} title="Recebíveis vencidos" description="Previsão de pagamento passou e ainda existe saldo em aberto." value={vencidos.length} href="/financeiro" tone="warning" />
          <PriorityCard icon={RefreshCcw} title="Altas para consolidar" description="Episódios antigos ou contas em pré-faturamento podem ser reprocessados." value={altasReprocessaveis.length} href="#altas-pendentes" tone="default" />
        </div>
      </div>

      <div className="his-card p-5">
        <p className="text-[10px] font-black uppercase tracking-[.14em] text-slate-400">Fluxo do setor</p>
        <h2 className="mt-1 font-black text-slate-950">Atalhos operacionais</h2>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
          <QuickLink icon={ReceiptText} label="Contas e produção" detail="Trabalhar conta hospitalar" href="/faturamento/producao" />
          <QuickLink icon={FileCheck2} label="Guias TISS" detail="Validar e revisar guias" href="/faturamento/guias" />
          <QuickLink icon={Boxes} label="Lotes TISS" detail="Agrupar e protocolar" href="/faturamento/lotes" />
          <QuickLink icon={CircleDollarSign} label="Glosas e recursos" detail="Recuperação de receita" href="/faturamento/glosas" />
          <QuickLink icon={Banknote} label="Recebimentos" detail="Baixa e conciliação" href="/financeiro" />
        </div>
      </div>
    </section>

    <section className="mt-5 grid gap-4 xl:grid-cols-[1fr_.8fr]">
      <div className="his-card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div><p className="text-[10px] font-black uppercase tracking-[.14em] text-slate-400">TISS</p><h2 className="mt-1 font-black text-slate-950">Lotes recentes</h2></div>
          <Link href="/faturamento/lotes" className="ui-button-secondary">Ver todos</Link>
        </div>
        <div className="divide-y divide-slate-100">
          {ultimosLotes.length ? ultimosLotes.map((lote) => {
            const convenio = one(lote.convenio);
            return <Link key={lote.id} href={`/faturamento/lotes/${lote.id}`} className="flex items-center justify-between gap-4 px-5 py-4 transition hover:bg-slate-50">
              <div><p className="font-black text-slate-900">Lote {lote.numero_lote}</p><p className="mt-1 text-xs text-slate-500">{convenio?.nome_fantasia ?? "Convênio"} · Comp. {lote.competencia ?? "—"}</p></div>
              <div className="text-right"><p className="font-black text-slate-900">{brl(Number(lote.valor_total ?? 0))}</p><span className="mt-1 inline-flex rounded-full bg-slate-100 px-2 py-1 text-[10px] font-black uppercase text-slate-600">{String(lote.status).replaceAll("_", " ")}</span></div>
            </Link>;
          }) : <p className="px-5 py-8 text-sm text-slate-500">Nenhum lote criado.</p>}
        </div>
      </div>

      <div id="altas-pendentes" className="his-card overflow-hidden">
        <div className="border-b border-slate-100 px-5 py-4"><p className="text-[10px] font-black uppercase tracking-[.14em] text-slate-400">Pós-alta</p><h2 className="mt-1 font-black text-slate-950">Consolidação pendente</h2></div>
        <div className="divide-y divide-slate-100">
          {altasReprocessaveis.length ? altasReprocessaveis.slice(0, 8).map((item) => {
            const paciente = one(item.paciente);
            const conta = contaPorAtendimento.get(item.id);
            return <div key={item.id} className="px-5 py-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div><p className="font-bold text-slate-900">{paciente?.nome_completo ?? "Paciente"}</p><p className="mt-1 text-xs text-slate-500">Atend. #{item.numero_atendimento ?? "—"} · RA {paciente?.ra ?? "—"}</p></div>
                <form action={reprocessarContaPosAlta}><input type="hidden" name="atendimento_id" value={item.id} /><button className="ui-button-secondary">{conta ? "Reprocessar" : "Processar"}</button></form>
              </div>
            </div>;
          }) : <div className="px-5 py-8 text-sm text-emerald-700"><CheckCircle2 className="mr-2 inline size-4" />Nenhuma alta pendente de integração.</div>}
        </div>
      </div>
    </section>

    <section className="his-card mt-5 overflow-hidden">
      <div className="border-b border-slate-100 px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><p className="text-[10px] font-black uppercase tracking-[.14em] text-slate-400">Contas hospitalares</p><h2 className="mt-1 font-black text-slate-950">Fila de faturamento</h2></div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">{contasExibidas.length} conta(s)</span>
        </div>
        <form className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
          <label className="relative"><Search className="absolute left-3 top-3 size-4 text-slate-400" /><input name="q" defaultValue={q ?? ""} className="ui-input pl-9" placeholder="Paciente, RA, registro, atendimento ou convênio..." /></label>
          {filtro !== "todas" ? <input type="hidden" name="status" value={filtro} /> : null}
          <button className="ui-button-secondary">Buscar</button>
        </form>
        <div className="mt-3 flex flex-wrap gap-2">
          {FILTROS.map(([key, label]) => {
            const queryParam = key === "todas" ? (q ? `?q=${encodeURIComponent(q)}` : "") : `?status=${key}${q ? `&q=${encodeURIComponent(q)}` : ""}`;
            return <Link key={key} href={`/faturamento${queryParam}`} className={`rounded-full px-3 py-1.5 text-xs font-black ${filtro === key ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>{label}</Link>;
          })}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[920px] text-left text-sm">
          <thead className="bg-slate-50 text-[11px] font-black uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Paciente / Atendimento</th><th className="px-4 py-3">Pagador</th><th className="px-4 py-3">Competência</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Valor líquido</th><th className="px-4 py-3 text-right">Ação</th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {contasExibidas.length ? contasExibidas.map((conta) => {
              const paciente = one(conta.paciente);
              const atendimento = one(conta.atendimento);
              const convenio = one(conta.convenio);
              return <tr key={conta.id} className="transition hover:bg-slate-50/80">
                <td className="px-4 py-4"><p className="font-black text-slate-900">{paciente?.nome_completo ?? "Paciente"}</p><p className="mt-1 text-xs text-slate-500">Atend. #{atendimento?.numero_atendimento ?? "—"} · Registro #{paciente?.numero_registro ?? "—"} · RA {paciente?.ra ?? "—"}</p></td>
                <td className="px-4 py-4"><p className="font-semibold text-slate-800">{conta.tipo_cobranca === "convenio" ? convenio?.nome_fantasia ?? "Convênio" : "Particular"}</p></td>
                <td className="px-4 py-4 font-semibold text-slate-600">{conta.competencia ?? "—"}</td>
                <td className="px-4 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-black capitalize ${statusStyle[conta.status] ?? "bg-slate-100 text-slate-600"}`}>{conta.status.replaceAll("_", " ")}</span></td>
                <td className="px-4 py-4 text-right font-black text-slate-900">{brl(Number(conta.valor_liquido ?? 0))}</td>
                <td className="px-4 py-4 text-right"><Link href={`/faturamento/${conta.id}`} className="inline-flex items-center gap-1 text-sm font-black text-brand-700 hover:underline">Abrir <ArrowRight className="size-4" /></Link></td>
              </tr>;
            }) : <tr><td colSpan={6} className="px-4 py-10 text-center text-slate-500">Nenhuma conta encontrada com os filtros atuais.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  </SectionPage>;
}

function MetricCard({
  icon: Icon,
  label,
  value,
  detail,
  tone = "default",
  compact = false,
}: {
  icon: typeof ReceiptText;
  label: string;
  value: string;
  detail: string;
  tone?: "default" | "success" | "warning" | "danger";
  compact?: boolean;
}) {
  const tones = {
    default: "bg-brand-50 text-brand-700",
    success: "bg-emerald-50 text-emerald-700",
    warning: "bg-amber-50 text-amber-700",
    danger: "bg-rose-50 text-rose-700",
  };
  return <div className="his-kpi min-w-0">
    <div className="flex items-center justify-between gap-2"><span className={`grid size-9 shrink-0 place-items-center rounded-xl ${tones[tone]}`}><Icon className="size-4" /></span><span className={`font-black text-slate-950 ${compact ? "text-base" : "text-2xl"}`}>{value}</span></div>
    <p className="mt-3 text-xs font-black uppercase tracking-wider text-slate-400">{label}</p>
    <p className="mt-1 truncate text-[11px] font-semibold text-slate-500">{detail}</p>
  </div>;
}

function PriorityCard({ icon: Icon, title, description, value, href, tone }: { icon: typeof ShieldAlert; title: string; description: string; value: number; href: string; tone: "default" | "warning" | "danger" }) {
  const toneClass = tone === "danger" ? "bg-rose-50 text-rose-700" : tone === "warning" ? "bg-amber-50 text-amber-700" : "bg-brand-50 text-brand-700";
  return <Link href={href} className="rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-brand-200 hover:shadow-sm">
    <div className="flex items-start justify-between gap-3"><span className={`grid size-10 place-items-center rounded-xl ${toneClass}`}><Icon className="size-5" /></span><span className="text-2xl font-black text-slate-950">{value}</span></div>
    <h3 className="mt-3 font-black text-slate-900">{title}</h3><p className="mt-1 text-xs leading-5 text-slate-500">{description}</p>
  </Link>;
}

function QuickLink({ icon: Icon, label, detail, href }: { icon: typeof ReceiptText; label: string; detail: string; href: string }) {
  return <Link href={href} className="flex items-center gap-3 rounded-2xl border border-slate-200 p-3 transition hover:border-brand-200 hover:bg-brand-50/40"><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-700"><Icon className="size-4" /></span><span className="min-w-0 flex-1"><strong className="block text-sm text-slate-900">{label}</strong><span className="block truncate text-[11px] text-slate-500">{detail}</span></span><ArrowRight className="size-4 text-slate-400" /></Link>;
}
