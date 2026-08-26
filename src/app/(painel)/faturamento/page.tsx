import Link from "next/link";
import { FileCheck2, ReceiptText, RefreshCcw, ShieldAlert } from "lucide-react";
import { ActionPanel } from "@/components/painel/action-panel";
import { SectionPage } from "@/components/painel/section-page";
import { EncounterPicker } from "@/components/atendimentos/encounter-picker";
import { createClient } from "@/lib/supabase/server";
import { criarContaAtendimento } from "@/modules/faturamento/actions";
import { reprocessarContaPosAlta } from "@/modules/faturamento/pos-alta-actions";

function one<T>(rel: T | T[] | null): T | null { return Array.isArray(rel) ? rel[0] ?? null : rel; }

const STATUS_REPROCESSAVEIS = new Set(["aberta", "pre_faturamento", "com_criticas"]);
const FILTROS = [
  ["todas", "Todas"],
  ["pre_faturamento", "Pré-faturamento"],
  ["com_criticas", "Com críticas"],
  ["pronta", "Prontas"],
  ["faturada", "Faturadas"],
] as const;

export default async function FaturamentoPage({ searchParams }: { searchParams: Promise<{ erro?: string; sucesso?: string; status?: string }> }) {
  const { erro, sucesso, status } = await searchParams;
  const supabase = await createClient();
  const [{ data: atendimentos }, { data: contas }] = await Promise.all([
    supabase.from("atendimentos").select("id,numero_atendimento,data_abertura,status,paciente:pacientes(nome_completo,cpf,ra,numero_registro)").in("status", ["aberto","em_espera","em_atendimento","alta"]).order("data_abertura", { ascending: false }).limit(300),
    supabase.from("contas_faturamento").select("id,atendimento_id,competencia,tipo_cobranca,status,valor_bruto,valor_liquido,updated_at,atendimento:atendimentos(numero_atendimento),paciente:pacientes(nome_completo,ra,numero_registro),convenio:convenios(nome_fantasia)").order("updated_at", { ascending: false }).limit(300),
  ]);

  const contaPorAtendimento = new Map<string, { id: string; status: string }>();
  for (const conta of contas ?? []) {
    if (conta.atendimento_id) contaPorAtendimento.set(conta.atendimento_id, { id: conta.id, status: conta.status });
  }

  const atendimentosAtivos = (atendimentos ?? []).filter((item) => item.status !== "alta");
  const encounters = atendimentosAtivos.map((item) => { const p=one(item.paciente); return { id:item.id, numero_atendimento:item.numero_atendimento, data_abertura:item.data_abertura, paciente:{ nome_completo:p?.nome_completo ?? "Paciente", cpf:p?.cpf ?? null, ra:p?.ra ?? "—", numero_registro:p?.numero_registro ?? 0 } }; });
  const altasReprocessaveis = (atendimentos ?? []).filter((item) => {
    if (item.status !== "alta") return false;
    const conta = contaPorAtendimento.get(item.id);
    return !conta || STATUS_REPROCESSAVEIS.has(conta.status);
  });
  const altasSemConta = altasReprocessaveis.filter((item) => !contaPorAtendimento.has(item.id)).length;
  const criticas = (contas ?? []).filter((c) => c.status === "com_criticas").length;
  const prontas = (contas ?? []).filter((c) => c.status === "pronta").length;
  const filtro = FILTROS.some(([key]) => key === status) ? status ?? "todas" : "todas";
  const contasExibidas = filtro === "todas" ? contas ?? [] : (contas ?? []).filter((c) => c.status === filtro);

  const mensagemErro = erro === "alta-invalida"
    ? "O atendimento selecionado não está em alta ou não pertence à unidade ativa."
    : erro === "integracao-pos-alta"
      ? "Não foi possível preparar a conta pós-alta. O atendimento clínico permanece encerrado e pode ser reprocessado."
      : "Não foi possível processar a solicitação de faturamento.";

  return <SectionPage
    eyebrow="Ciclo da receita / Faturamento"
    title="Central de Faturamento"
    description="Workspace operacional da conta hospitalar: produção, lançamentos, autorizações, críticas, Guia TISS, lotes e continuidade do ciclo da receita."
    actions={<div className="flex flex-wrap gap-2"><Link href="/faturamento/producao" className="ui-button-secondary">Produção</Link><Link href="/faturamento/guias" className="ui-button-secondary">Guias TISS</Link><Link href="/faturamento/lotes" className="ui-button-secondary">Lotes</Link><Link href="/faturamento/glosas" className="ui-button-secondary">Glosas</Link><Link href="/faturamento/recursos" className="ui-button-secondary">Recursos</Link></div>}
  >
    {erro ? <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{mensagemErro}</div> : null}
    {sucesso === "pos-alta" ? <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">Alta integrada ao pré-faturamento e encaminhada para auditoria.</div> : null}

    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <Card icon={ReceiptText} label="Contas" value={String(contas?.length ?? 0)}/>
      <Card icon={ShieldAlert} label="Com críticas" value={String(criticas)}/>
      <Card icon={FileCheck2} label="Prontas para guia" value={String(prontas)}/>
      <Card icon={RefreshCcw} label="Altas sem conta" value={String(altasSemConta)}/>
    </div>

    <section className="ui-card mt-5 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="font-bold text-slate-900">Fluxo operacional</h2><p className="mt-1 text-xs text-slate-500">Acesso rápido às etapas que alimentam e recebem dados da conta.</p></div>
        <div className="flex flex-wrap gap-2 text-xs"><Link href="/auditoria" className="ui-button-secondary">Auditoria pós-alta</Link><Link href="/contas-medicas" className="ui-button-secondary">Contas Médicas</Link><Link href="/faturamento/producao" className="ui-button-secondary">Livro de Produção</Link><Link href="/faturamento/guias" className="ui-button-secondary">Central TISS</Link></div>
      </div>
    </section>

    <section className="ui-card mt-5 overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <div>
          <h2 className="font-bold text-slate-900">Altas aguardando consolidação</h2>
          <p className="mt-1 max-w-3xl text-xs text-slate-500">As novas altas são integradas automaticamente. Esta fila permite recuperar episódios antigos ou reprocessar contas ainda em pré-faturamento sem duplicar itens.</p>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{altasReprocessaveis.length} reprocessável(is)</span>
      </div>
      <div className="divide-y divide-slate-100">
        {altasReprocessaveis.length ? altasReprocessaveis.slice(0, 30).map((item) => {
          const p = one(item.paciente);
          const conta = contaPorAtendimento.get(item.id);
          return <div key={item.id} className="flex flex-wrap items-center justify-between gap-4 px-5 py-4">
            <div>
              <p className="font-medium text-slate-900">{p?.nome_completo ?? "Paciente"}</p>
              <p className="text-xs text-slate-500">Atend. #{item.numero_atendimento ?? "—"} · Registro #{p?.numero_registro ?? "—"} · {p?.ra ?? "—"}</p>
              <p className="mt-1 text-xs text-slate-500">{conta ? `Conta existente: ${conta.status.replaceAll("_", " ")}` : "Sem conta de faturamento vinculada"}</p>
            </div>
            <form action={reprocessarContaPosAlta}>
              <input type="hidden" name="atendimento_id" value={item.id}/>
              <button className="ui-button-secondary">{conta ? "Reprocessar produção" : "Processar alta"}</button>
            </form>
          </div>;
        }) : <div className="px-5 py-6"><p className="text-sm font-medium text-emerald-700">Nenhuma alta pendente de integração.</p><p className="mt-1 text-xs text-slate-500">As próximas altas médicas seguirão automaticamente para pré-faturamento e auditoria.</p></div>}
      </div>
    </section>

    <div className="mt-5"><ActionPanel title="Abrir pré-faturamento durante o episódio" description="Use para atendimentos ainda ativos. Após a alta médica, a conta é criada e consolidada automaticamente."><form action={criarContaAtendimento}><EncounterPicker encounters={encounters} name="atendimento_id"/><div className="mt-4 flex justify-end"><button className="ui-button-primary">Abrir conta</button></div></form></ActionPanel></div>

    <section className="ui-card mt-5 overflow-hidden">
      <div className="border-b border-slate-100 px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-bold text-slate-900">Fila de contas</h2><p className="mt-1 text-xs text-slate-500">Abra uma conta para trabalhar lançamentos, produção, autorizações, cálculos e críticas em uma única tela.</p></div><span className="text-xs font-semibold text-slate-500">{contasExibidas.length} conta(s)</span></div>
        <div className="mt-3 flex flex-wrap gap-2">{FILTROS.map(([key,label])=><Link key={key} href={key === "todas" ? "/faturamento" : `/faturamento?status=${key}`} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${filtro===key?"bg-brand-600 text-white":"bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>{label}</Link>)}</div>
      </div>
      <div className="divide-y divide-slate-100">{contasExibidas.length ? contasExibidas.map((item) => { const p=one(item.paciente); const a=one(item.atendimento); const c=one(item.convenio); return <Link key={item.id} href={`/faturamento/${item.id}`} className="grid gap-3 px-5 py-4 hover:bg-slate-50 md:grid-cols-[1fr_auto]"><div><p className="font-medium text-slate-900">{p?.nome_completo ?? "Paciente"}</p><p className="text-xs text-slate-500">Atend. #{a?.numero_atendimento ?? "—"} · Registro #{p?.numero_registro ?? "—"} · {p?.ra ?? "—"}</p><p className="mt-1 text-xs text-slate-500">{item.tipo_cobranca === "convenio" ? c?.nome_fantasia ?? "Convênio" : "Particular"} · Comp. {item.competencia}</p></div><div className="text-right"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${item.status === "com_criticas" ? "bg-rose-50 text-rose-700" : item.status === "pronta" ? "bg-emerald-50 text-emerald-700" : item.status === "faturada" ? "bg-brand-50 text-brand-700" : "bg-slate-100 text-slate-600"}`}>{item.status.replaceAll("_"," ")}</span><p className="mt-2 text-sm font-semibold text-slate-800">R$ {Number(item.valor_liquido ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p></div></Link>; }) : <p className="p-6 text-sm text-slate-500">Nenhuma conta neste filtro.</p>}</div>
    </section>
  </SectionPage>;
}

function Card({ icon: Icon, label, value }: { icon: typeof ReceiptText; label: string; value: string }) { return <div className="ui-card p-5"><div className="flex items-center justify-between"><span className="grid size-10 place-items-center rounded-xl bg-brand-50 text-brand-700"><Icon className="size-5"/></span><strong className="text-2xl text-slate-950">{value}</strong></div><p className="mt-3 text-sm font-medium text-slate-600">{label}</p></div>; }
