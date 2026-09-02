import Link from "next/link";
import { CircleDollarSign, ReceiptText, ShieldCheck } from "lucide-react";
import { notFound } from "next/navigation";
import {
  ReceivableLedgerActions,
  ReceivablePaymentForm,
} from "@/components/financeiro/receivable-background-forms";
import { SectionPage } from "@/components/painel/section-page";
import { requireAnyPermission } from "@/lib/permissions/server";

function one<T>(rel: T | T[] | null | undefined): T | null {
  return Array.isArray(rel) ? rel[0] ?? null : rel ?? null;
}

function brl(value: number | null | undefined) {
  return `R$ ${Number(value ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function date(value: string | null | undefined) {
  return value ? new Date(`${value.slice(0, 10)}T12:00:00`).toLocaleDateString("pt-BR") : "—";
}

function dateTime(value: string | null | undefined) {
  return value ? new Date(value).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "—";
}

function today() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function statusLabel(value: string) {
  return value.replaceAll("_", " ");
}

export default async function RecebivelPage({ params }: { params: Promise<{ recebivelId: string }> }) {
  const { recebivelId } = await params;
  const { supabase } = await requireAnyPermission([
    "financeiro.visualizar",
    "financeiro.receber",
    "financeiro.conciliar",
    "financeiro.gerenciar",
  ]);

  const { data: recebivel } = await supabase
    .from("financeiro_recebiveis")
    .select("id,empresa_id,unidade_id,lote_id,competencia,previsao_pagamento,data_pagamento,valor_bruto,valor_glosa,valor_liquido_previsto,valor_recebido,status,created_at,updated_at,lote:tiss_lotes(id,numero_lote,status,protocolo_operadora,protocolo_envio_operadora),convenio:convenios(nome_fantasia,registro_ans)")
    .eq("id", recebivelId)
    .maybeSingle();
  if (!recebivel) notFound();

  const [pagamentosRes, notaRes, receiveScoped, conciliateScoped, manageScoped] = await Promise.all([
    supabase
      .from("financeiro_recebimentos")
      .select("id,data_recebimento,valor_baixado,valor_retencoes,valor_tarifas,valor_creditado,forma_recebimento,referencia_bancaria,documento_operadora,observacoes,status,conciliado_em,estornado_em,motivo_estorno,created_at")
      .eq("recebivel_id", recebivelId)
      .order("created_at", { ascending: false }),
    recebivel.lote_id
      ? supabase
          .from("notas_fiscais_servico")
          .select("id,numero_nfse,numero_rps,status,valor_servicos,valor_liquido,data_emissao")
          .eq("lote_id", recebivel.lote_id)
          .neq("status", "cancelada")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.rpc("tem_permissao", {
      p_empresa: recebivel.empresa_id,
      p_unidade: recebivel.unidade_id,
      p_codigo: "financeiro.receber",
    }),
    supabase.rpc("tem_permissao", {
      p_empresa: recebivel.empresa_id,
      p_unidade: recebivel.unidade_id,
      p_codigo: "financeiro.conciliar",
    }),
    supabase.rpc("tem_permissao", {
      p_empresa: recebivel.empresa_id,
      p_unidade: recebivel.unidade_id,
      p_codigo: "financeiro.gerenciar",
    }),
  ]);

  const canManage = manageScoped.data === true;
  const canReceive = receiveScoped.data === true || canManage;
  const canConciliate = conciliateScoped.data === true || canManage;
  const pagamentos = pagamentosRes.data ?? [];
  const lote = one(recebivel.lote);
  const convenio = one(recebivel.convenio);
  const nota = notaRes.data;
  const saldo = Math.max(0, Number(recebivel.valor_liquido_previsto || 0) - Number(recebivel.valor_recebido || 0));
  const vencido = Boolean(
    recebivel.previsao_pagamento &&
      recebivel.previsao_pagamento < today() &&
      saldo > 0 &&
      recebivel.status !== "cancelado",
  );

  return <SectionPage
    eyebrow="Ciclo da Receita / Recebíveis"
    title={lote ? `Recebível do lote ${lote.numero_lote}` : "Recebível financeiro"}
    description={`${convenio?.nome_fantasia ?? "Convênio não informado"} · Competência ${recebivel.competencia}`}
    actions={<Link href="/financeiro/recebiveis" className="ui-button-secondary">Voltar à fila</Link>}
  >
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      <Kpi label="Bruto" value={brl(recebivel.valor_bruto)} />
      <Kpi label="Glosa" value={brl(recebivel.valor_glosa)} />
      <Kpi label="Líquido previsto" value={brl(recebivel.valor_liquido_previsto)} />
      <Kpi label="Baixado" value={brl(recebivel.valor_recebido)} />
      <Kpi label={vencido ? "Saldo vencido" : "Saldo"} value={brl(saldo)} alert={vencido} />
    </section>

    {vencido ? <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
      A previsão de pagamento passou e este título ainda possui saldo. A sinalização é derivada da data; nenhuma baixa é criada automaticamente.
    </div> : null}

    <div className="mt-5 grid gap-5 xl:grid-cols-[.9fr_1.1fr]">
      <section className="ui-card p-5">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-xl bg-brand-50 text-brand-700"><ReceiptText className="size-5" /></span>
          <div><h2 className="font-black text-slate-900">Origem do título</h2><p className="text-sm text-slate-500">TISS, protocolo e documento fiscal vinculados.</p></div>
        </div>
        <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2">
          <Info label="Status" value={statusLabel(recebivel.status)} />
          <Info label="Previsão de pagamento" value={date(recebivel.previsao_pagamento)} alert={vencido} />
          <Info label="Data da última baixa" value={date(recebivel.data_pagamento)} />
          <Info label="Registro ANS" value={convenio?.registro_ans ?? "—"} />
          <Info label="Protocolo operadora" value={lote?.protocolo_operadora ?? lote?.protocolo_envio_operadora ?? "—"} />
          <Info label="NFS-e" value={nota?.numero_nfse ? `NFS-e ${nota.numero_nfse}` : nota?.numero_rps ? `RPS ${nota.numero_rps}` : "Não emitida"} />
        </dl>
        <div className="mt-5 flex flex-wrap gap-2">
          {lote ? <Link href={`/faturamento/lotes/${lote.id}`} className="ui-button-secondary">Abrir lote TISS</Link> : null}
          {nota ? <Link href={`/financeiro/notas-fiscais/${nota.id}`} className="ui-button-secondary">Abrir NFS-e</Link> : null}
        </div>
      </section>

      <section className="ui-card p-5">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-xl bg-emerald-50 text-emerald-700"><CircleDollarSign className="size-5" /></span>
          <div><h2 className="font-black text-slate-900">Registrar recebimento</h2><p className="text-sm text-slate-500">Crédito efetivo, retenções e tarifas continuam validados pelo ledger transacional.</p></div>
        </div>
        {canReceive && saldo > 0 && recebivel.status !== "cancelado"
          ? <ReceivablePaymentForm recebivelId={recebivelId} saldo={saldo} defaultDate={today()} />
          : <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
              {saldo <= 0 ? "Título sem saldo pendente." : recebivel.status === "cancelado" ? "Título cancelado." : "Seu perfil não possui permissão para registrar recebimentos."}
            </div>}
      </section>
    </div>

    <section className="ui-card mt-5 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <div><h2 className="font-black text-slate-900">Ledger de recebimentos</h2><p className="mt-1 text-xs text-slate-500">Baixas nunca são apagadas. Conciliação e estorno permanecem auditáveis e são executados sem reload.</p></div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">{pagamentos.length} movimento(s)</span>
      </div>
      <div className="divide-y divide-slate-100">
        {pagamentos.length ? pagamentos.map((pagamento) => <article key={pagamento.id} className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <strong className="text-lg text-slate-900">{brl(pagamento.valor_baixado)}</strong>
                <span className={`rounded-full px-2 py-1 text-[11px] font-black uppercase ${pagamento.status === "conciliado" ? "bg-emerald-50 text-emerald-700" : pagamento.status === "estornado" ? "bg-rose-50 text-rose-700" : "bg-amber-50 text-amber-700"}`}>{pagamento.status}</span>
              </div>
              <p className="mt-1 text-xs text-slate-500">{date(pagamento.data_recebimento)} · {statusLabel(pagamento.forma_recebimento)} · crédito {brl(pagamento.valor_creditado)} · retenções {brl(pagamento.valor_retencoes)} · tarifas {brl(pagamento.valor_tarifas)}</p>
              <p className="mt-1 text-xs text-slate-500">Ref. {pagamento.referencia_bancaria ?? "—"} · Documento {pagamento.documento_operadora ?? "—"}</p>
              {pagamento.observacoes ? <p className="mt-2 text-sm text-slate-600">{pagamento.observacoes}</p> : null}
              {pagamento.conciliado_em ? <p className="mt-2 text-xs font-semibold text-emerald-600">Conciliado em {dateTime(pagamento.conciliado_em)}</p> : null}
              {pagamento.estornado_em ? <p className="mt-2 text-xs font-semibold text-rose-600">Estornado em {dateTime(pagamento.estornado_em)} · {pagamento.motivo_estorno ?? "motivo não informado"}</p> : null}
            </div>
          </div>
          <ReceivableLedgerActions
            recebimentoId={pagamento.id}
            recebivelId={recebivelId}
            referenciaBancaria={pagamento.referencia_bancaria}
            canConciliate={canConciliate}
            canManage={canManage}
            status={pagamento.status}
          />
        </article>) : <div className="px-5 py-10 text-center text-sm text-slate-500">Nenhum recebimento registrado.</div>}
      </div>
    </section>
  </SectionPage>;
}

function Kpi({ label, value, alert = false }: { label: string; value: string; alert?: boolean }) {
  return <div className={`ui-card p-4 ${alert ? "border-amber-200 bg-amber-50" : ""}`}>
    <ShieldCheck className={`size-4 ${alert ? "text-amber-700" : "text-brand-700"}`} />
    <p className="mt-2 text-xs font-semibold text-slate-500">{label}</p>
    <p className={`mt-1 text-xl font-black ${alert ? "text-amber-800" : "text-slate-950"}`}>{value}</p>
  </div>;
}

function Info({ label, value, alert = false }: { label: string; value: string; alert?: boolean }) {
  return <div><dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</dt><dd className={`mt-1 font-semibold capitalize ${alert ? "text-amber-700" : "text-slate-800"}`}>{value}</dd></div>;
}
