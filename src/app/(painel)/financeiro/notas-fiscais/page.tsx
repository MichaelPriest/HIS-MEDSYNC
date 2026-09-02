import Link from "next/link";
import { ArrowRight, CheckCircle2, Clock3, FileWarning, ReceiptText, Search } from "lucide-react";
import { NewNfseModal } from "@/components/faturamento/billing-workspace-actions";
import { SectionPage } from "@/components/painel/section-page";
import { requireAnyPermission } from "@/lib/permissions/server";

function one<T>(rel: T | T[] | null): T | null {
  return Array.isArray(rel) ? rel[0] ?? null : rel;
}

function brl(value: number) {
  return `R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(value?: string | null) {
  return value ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(value)) : "—";
}

const statusStyle: Record<string, string> = {
  rascunho: "bg-slate-100 text-slate-700",
  pronta: "bg-blue-50 text-blue-700",
  enviando: "bg-amber-50 text-amber-700",
  emitida: "bg-emerald-50 text-emerald-700",
  rejeitada: "bg-rose-50 text-rose-700",
  erro: "bg-rose-50 text-rose-700",
  cancelada: "bg-slate-100 text-slate-500",
};

export default async function NotasFiscaisPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; competencia?: string }>;
}) {
  const { q, status, competencia } = await searchParams;
  const { supabase, empresaId, unidadeId } = await requireAnyPermission(["nfse.visualizar", "nfse.emitir", "nfse.gerenciar", "financeiro.visualizar", "financeiro.gerenciar"]);
  const [notasRes, lotesRes, emitGrant, manageGrant] = await Promise.all([
    supabase
      .from("notas_fiscais_servico")
      .select("id,competencia,numero_nfse,numero_rps,status,valor_servicos,valor_liquido,data_emissao,created_at,lote:tiss_lotes(id,numero_lote),convenio:convenios(nome_fantasia,registro_ans)")
      .order("created_at", { ascending: false })
      .limit(400),
    supabase
      .from("tiss_lotes")
      .select("id,numero_lote,competencia,valor_total,convenio:convenios(nome_fantasia)")
      .in("status", ["enviado", "protocolado", "aceito"])
      .order("created_at", { ascending: false })
      .limit(300),
    unidadeId ? supabase.rpc("tem_permissao", { p_empresa: empresaId, p_unidade: unidadeId, p_codigo: "nfse.emitir" }) : Promise.resolve({ data: false }),
    unidadeId ? supabase.rpc("tem_permissao", { p_empresa: empresaId, p_unidade: unidadeId, p_codigo: "nfse.gerenciar" }) : Promise.resolve({ data: false }),
  ]);

  const notas = notasRes.data ?? [];
  const canCreate = emitGrant.data === true || manageGrant.data === true;
  const fiscalLots = (lotesRes.data ?? []).map((lote) => ({
    id: lote.id,
    numero_lote: lote.numero_lote,
    competencia: lote.competencia,
    valor_total: lote.valor_total,
    convenio_nome: one(lote.convenio)?.nome_fantasia ?? "Convênio",
  }));
  const statuses = [...new Set(notas.map((nota) => String(nota.status)).filter(Boolean))].sort();
  const query = q?.trim().toLocaleLowerCase("pt-BR") ?? "";
  const filtered = notas.filter((nota) => {
    if (status && nota.status !== status) return false;
    if (competencia && nota.competencia !== competencia) return false;
    if (!query) return true;
    const lote = one(nota.lote);
    const convenio = one(nota.convenio);
    const haystack = `${nota.numero_nfse ?? ""} ${nota.numero_rps ?? ""} ${lote?.numero_lote ?? ""} ${convenio?.nome_fantasia ?? ""} ${convenio?.registro_ans ?? ""}`.toLocaleLowerCase("pt-BR");
    return haystack.includes(query);
  });

  const valorTotal = notas.reduce((sum, nota) => sum + Number(nota.valor_liquido ?? 0), 0);
  const emitidas = notas.filter((nota) => nota.status === "emitida");
  const pendentes = notas.filter((nota) => ["rascunho", "pronta", "enviando"].includes(String(nota.status)));
  const problemas = notas.filter((nota) => ["rejeitada", "erro"].includes(String(nota.status)));

  return <SectionPage
    eyebrow="Ciclo da Receita / Fiscal"
    title="Central de Notas Fiscais"
    description="Controle rascunhos, emissão, rejeições e vínculo com lotes TISS. A criação fiscal acontece em modal e mantém validações do RPC operacional."
    actions={canCreate ? <NewNfseModal lotes={fiscalLots} /> : undefined}
  >
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Kpi icon={ReceiptText} label="Valor líquido" value={brl(valorTotal)} detail={`${notas.length} documento(s)`} />
      <Kpi icon={CheckCircle2} label="Emitidas" value={String(emitidas.length)} detail="Documentos confirmados" tone="success" />
      <Kpi icon={Clock3} label="Pendentes" value={String(pendentes.length)} detail="Rascunho / prontas / enviando" tone="warning" />
      <Kpi icon={FileWarning} label="Com problema" value={String(problemas.length)} detail="Rejeição ou erro" tone={problemas.length ? "danger" : "success"} />
    </section>

    {!canCreate ? <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">Seu perfil pode consultar os documentos, mas não criar novos rascunhos de NFS-e.</div> : null}

    <section className="his-card mt-5 overflow-hidden">
      <div className="border-b border-slate-100 p-4 sm:p-5">
        <form className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_220px_190px_auto]">
          <label className="relative"><Search className="absolute left-3 top-3 size-4 text-slate-400" /><input name="q" defaultValue={q ?? ""} className="ui-input pl-9" placeholder="NFS-e, RPS, lote, operadora ou ANS..." /></label>
          <select name="status" defaultValue={status ?? ""} className="ui-input"><option value="">Todos os status</option>{statuses.map((value) => <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}</select>
          <input name="competencia" defaultValue={competencia ?? ""} type="month" className="ui-input" aria-label="Competência" />
          <button className="ui-button-secondary">Filtrar</button>
        </form>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1040px] text-left text-sm">
          <thead className="bg-slate-50 text-[11px] font-black uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Documento / Lote</th><th className="px-4 py-3">Operadora</th><th className="px-4 py-3">Competência</th><th className="px-4 py-3">Emissão</th><th className="px-4 py-3 text-right">Valor líquido</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Ação</th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.length ? filtered.map((nota) => {
              const lote = one(nota.lote);
              const convenio = one(nota.convenio);
              return <tr key={nota.id} className="transition hover:bg-slate-50/80">
                <td className="px-4 py-4"><p className="font-black text-slate-900">{nota.numero_nfse ? `NFS-e ${nota.numero_nfse}` : `RPS ${nota.numero_rps ?? "—"}`}</p><p className="mt-1 text-xs text-slate-500">Lote {lote?.numero_lote ?? "—"}</p>{lote?.id ? <Link href={`/faturamento/lotes/${lote.id}`} className="mt-1 inline-flex text-[11px] font-bold text-brand-700 hover:underline">Abrir lote</Link> : null}</td>
                <td className="px-4 py-4"><p className="font-semibold text-slate-800">{convenio?.nome_fantasia ?? "—"}</p><p className="mt-1 text-xs text-slate-400">ANS {convenio?.registro_ans ?? "—"}</p></td>
                <td className="px-4 py-4 font-semibold text-slate-700">{nota.competencia ?? "—"}</td>
                <td className="px-4 py-4 text-slate-600">{fmtDate(nota.data_emissao)}</td>
                <td className="px-4 py-4 text-right font-black text-slate-900">{brl(Number(nota.valor_liquido ?? 0))}</td>
                <td className="px-4 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-black capitalize ${statusStyle[String(nota.status)] ?? "bg-slate-100 text-slate-600"}`}>{String(nota.status).replaceAll("_", " ")}</span></td>
                <td className="px-4 py-4 text-right"><Link href={`/financeiro/notas-fiscais/${nota.id}`} className="inline-flex items-center gap-1 font-black text-brand-700 hover:underline">Abrir <ArrowRight className="size-4" /></Link></td>
              </tr>;
            }) : <tr><td colSpan={7} className="px-4 py-10 text-center text-slate-500">Nenhuma nota fiscal encontrada.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>

    <div className="mt-5 flex justify-end"><Link href="/configuracoes/nfse" className="ui-button-secondary"><ReceiptText className="size-4" />Configuração municipal / NFS-e</Link></div>
  </SectionPage>;
}

function Kpi({ icon: Icon, label, value, detail, tone = "default" }: { icon: typeof ReceiptText; label: string; value: string; detail: string; tone?: "default" | "success" | "warning" | "danger" }) {
  const tones = { default: "bg-brand-50 text-brand-700", success: "bg-emerald-50 text-emerald-700", warning: "bg-amber-50 text-amber-700", danger: "bg-rose-50 text-rose-700" };
  return <div className="his-kpi"><div className="flex items-center justify-between gap-3"><span className={`grid size-10 shrink-0 place-items-center rounded-xl ${tones[tone]}`}><Icon className="size-5" /></span><span className="text-xl font-black text-slate-950">{value}</span></div><p className="mt-3 text-xs font-black uppercase tracking-wider text-slate-400">{label}</p><p className="mt-1 text-[11px] font-semibold text-slate-500">{detail}</p></div>;
}
