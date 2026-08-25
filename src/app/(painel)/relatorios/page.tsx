import Link from "next/link";
import { Activity, BarChart3, BedDouble, CalendarDays, FileText, HeartPulse, Pill, ReceiptText, WalletCards } from "lucide-react";
import { SectionPage } from "@/components/painel/section-page";
import { requireAnyPermission } from "@/lib/permissions/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function money(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function count(result: { count: number | null }) {
  return Number(result.count ?? 0);
}

export default async function RelatoriosPage({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string }>;
}) {
  const sp = await searchParams;
  const periodo = ["7", "30", "90"].includes(String(sp.periodo)) ? Number(sp.periodo) : 30;
  const desde = new Date(Date.now() - periodo * 24 * 60 * 60 * 1000).toISOString();
  const { supabase, empresaId, unidadeId } = await requireAnyPermission([
    "diretoria.visualizar",
    "atendimentos.visualizar",
    "faturamento.visualizar",
    "financeiro.visualizar",
  ]);

  const unidade = unidadeId ?? "00000000-0000-0000-0000-000000000000";
  const [
    atendimentos,
    prescricoes,
    filas,
    agendamentos,
    internacoes,
    notas,
    lotes,
    glosas,
  ] = await Promise.all([
    supabase.from("atendimentos").select("id", { count: "exact", head: true }).eq("empresa_id", empresaId).eq("unidade_id", unidade).gte("data_abertura", desde),
    supabase.from("prescricoes").select("id", { count: "exact", head: true }).eq("empresa_id", empresaId).eq("unidade_id", unidade).gte("created_at", desde),
    supabase.from("filas_setoriais").select("id", { count: "exact", head: true }).eq("empresa_id", empresaId).eq("unidade_id", unidade).in("status", ["aguardando", "chamado", "em_atendimento"]),
    supabase.from("agendamentos").select("id", { count: "exact", head: true }).eq("empresa_id", empresaId).eq("unidade_id", unidade).gte("inicio", desde),
    supabase.from("internacoes").select("id", { count: "exact", head: true }).eq("empresa_id", empresaId).eq("unidade_id", unidade).gte("created_at", desde),
    supabase.from("notas_fiscais_servico").select("id,valor_liquido,status,created_at").eq("empresa_id", empresaId).eq("unidade_id", unidade).gte("created_at", desde).limit(1000),
    supabase.from("tiss_lotes").select("id,valor_total,status,created_at").eq("empresa_id", empresaId).eq("unidade_id", unidade).gte("created_at", desde).limit(1000),
    supabase.from("tiss_glosas").select("id,valor_glosado,status,created_at").eq("empresa_id", empresaId).eq("unidade_id", unidade).gte("created_at", desde).limit(1000),
  ]);

  const notasRows = notas.data ?? [];
  const lotesRows = lotes.data ?? [];
  const glosasRows = glosas.data ?? [];
  const valorNfse = notasRows.reduce((sum, item) => sum + Number(item.valor_liquido ?? 0), 0);
  const nfseEmitidas = notasRows.filter((item) => item.status === "emitida").length;
  const valorLotes = lotesRows.reduce((sum, item) => sum + Number(item.valor_total ?? 0), 0);
  const valorGlosas = glosasRows.reduce((sum, item) => sum + Number(item.valor_glosado ?? 0), 0);
  const erros = [atendimentos, prescricoes, filas, agendamentos, internacoes, notas, lotes, glosas].filter((item) => item.error).length;

  return (
    <SectionPage
      eyebrow="Gestão / Relatórios"
      title="Central de Relatórios"
      description={`Indicadores consolidados dos módulos já disponíveis no HIS. Período corrente: últimos ${periodo} dias.`}
      actions={<Link href="/diretoria" className="ui-button-secondary"><BarChart3 className="size-4" />Painel da Diretoria</Link>}
    >
      <form method="get" className="mb-5 flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-4">
        <label className="space-y-1 text-sm font-semibold text-slate-700"><span>Período</span><select name="periodo" defaultValue={String(periodo)} className="ui-input min-w-44"><option value="7">Últimos 7 dias</option><option value="30">Últimos 30 dias</option><option value="90">Últimos 90 dias</option></select></label>
        <button className="ui-button-primary">Atualizar relatório</button>
        <p className="text-xs text-slate-500">Os dados respeitam empresa, unidade, permissões e RLS do usuário autenticado.</p>
      </form>

      {erros ? <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">{erros} indicador(es) não puderam ser carregados. A central continua exibindo os módulos que já possuem dados disponíveis.</div> : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi icon={HeartPulse} label="Atendimentos" value={String(count(atendimentos))} detail={`abertos no período de ${periodo} dias`} />
        <Kpi icon={Pill} label="Prescrições" value={String(count(prescricoes))} detail="itens prescritos no período" />
        <Kpi icon={Activity} label="Filas ativas" value={String(count(filas))} detail="aguardando, chamados ou em atendimento" />
        <Kpi icon={CalendarDays} label="Agenda" value={String(count(agendamentos))} detail="agendamentos no período" />
        <Kpi icon={BedDouble} label="Internações" value={String(count(internacoes))} detail="registros de internação no período" />
        <Kpi icon={ReceiptText} label="Lotes TISS" value={String(lotesRows.length)} detail={money(valorLotes)} />
        <Kpi icon={FileText} label="NFS-e emitidas" value={String(nfseEmitidas)} detail={`${notasRows.length} notas · ${money(valorNfse)}`} />
        <Kpi icon={WalletCards} label="Glosas" value={String(glosasRows.length)} detail={money(valorGlosas)} />
      </section>

      <section className="mt-7">
        <div className="mb-3"><h2 className="text-lg font-black text-slate-950">Relatórios operacionais disponíveis</h2><p className="text-sm text-slate-500">Cada acesso abre o módulo de origem para conferência do detalhe e rastreabilidade.</p></div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <Report href="/atendimentos" title="Atendimentos e admissões" text="Volume assistencial, episódios ativos e histórico de atendimento." />
          <Report href="/pronto-socorro" title="Pronto-Socorro" text="Fila clínica, risco, espera e pacientes em atendimento." />
          <Report href="/prescricao" title="Prescrições" text="Prescrições vinculadas ao catálogo, situação e integração com Farmácia." />
          <Report href="/internacao" title="Internação e leitos" text="Internações, ocupação, altas e gestão de leitos/NIR." />
          <Report href="/faturamento/lotes" title="Faturamento e TISS" text="Lotes, competências, valores apresentados e protocolo de envio." />
          <Report href="/faturamento/glosas" title="Glosas e recursos" text="Ocorrências, valores glosados e acompanhamento dos recursos." />
          <Report href="/financeiro/notas-fiscais" title="Notas fiscais / NFS-e" text="Notas emitidas, RPS, valores e situação de transmissão fiscal." />
          <Report href="/almoxarifado" title="Estoque e suprimentos" text="Produtos e movimentações já disponíveis no estoque hospitalar." />
          <Report href="/diretoria" title="Consolidado executivo" text="Indicadores de assistência, faturamento, contas, auditoria e receita." />
        </div>
      </section>

      <div className="mt-6 rounded-2xl border border-brand-100 bg-brand-50 p-4 text-sm text-brand-950"><strong>Central evolutiva:</strong> os módulos que ainda forem construídos poderão entrar nesta página sem alterar os relatórios já existentes. Nenhum indicador é preenchido artificialmente quando a fonte ainda não existe.</div>
    </SectionPage>
  );
}

function Kpi({ icon: Icon, label, value, detail }: { icon: typeof Activity; label: string; value: string; detail: string }) {
  return <div className="ui-card p-5"><div className="flex items-center justify-between"><p className="text-xs font-bold uppercase tracking-wider text-slate-400">{label}</p><Icon className="size-5 text-brand-700" /></div><p className="mt-2 text-3xl font-black text-slate-950">{value}</p><p className="mt-1 text-xs text-slate-500">{detail}</p></div>;
}

function Report({ href, title, text }: { href: string; title: string; text: string }) {
  return <Link href={href as never} className="ui-card block p-5 transition hover:border-brand-200 hover:shadow-md"><h3 className="font-black text-slate-950">{title}</h3><p className="mt-2 text-sm text-slate-500">{text}</p><span className="mt-4 inline-flex text-sm font-bold text-brand-700">Abrir relatório →</span></Link>;
}
