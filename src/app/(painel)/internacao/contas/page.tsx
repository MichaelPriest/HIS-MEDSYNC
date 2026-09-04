import type { Route } from "next";
import Link from "next/link";
import { CalendarRange, CircleDollarSign, FileCheck2, Hospital, ScissorsLineDashed } from "lucide-react";
import { SectionPage } from "@/components/painel/section-page";
import { getAssistencialContext } from "@/modules/assistencial/context";
import { fecharContaParcialInternacao } from "@/modules/internacao/faturamento-actions";

type Rel<T> = T | T[] | null;
type Paciente = { nome_completo: string | null; ra: string | null };
type Atendimento = { id: string; numero_atendimento: number | string | null; paciente: Rel<Paciente> };
type Internacao = {
  id: string;
  atendimento_id: string;
  status: string;
  setor: string;
  quarto: string | null;
  leito: string | null;
  data_internacao: string;
  data_alta: string | null;
  atendimento: Rel<Atendimento>;
};
type Conta = {
  id: string;
  internacao_id: string | null;
  modalidade_conta: string;
  parcial_numero: number | null;
  periodo_inicio: string | null;
  periodo_fim: string | null;
  status: string;
  valor_bruto: number | string | null;
  valor_liquido: number | string | null;
  motivo_encerramento_tiss_descricao: string | null;
  observacao_fechamento: string | null;
};
type Motivo = { codigo: string; display: string };
type Search = { sucesso?: string; erro?: string; parcial?: string };

const one = <T,>(value: Rel<T>): T | null => Array.isArray(value) ? value[0] ?? null : value;
const money = (value: number | string | null | undefined) => Number(value ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const date = (value: string | null | undefined) => value ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(value.length === 10 ? `${value}T12:00:00-03:00` : value)) : "—";

function saoPauloDate() {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function addDay(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  const next = new Date(Date.UTC(year, month - 1, day + 1));
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}-${String(next.getUTCDate()).padStart(2, "0")}`;
}

const errorMessages: Record<string, string> = {
  "campos-parcial": "Informe período e motivo da permanência.",
  "internacao-inativa": "A internação não está ativa para fechamento parcial.",
  "periodo-sobreposto": "O período informado já possui conta fechada.",
  "periodo-continuo": "O novo período deve começar no dia seguinte ao último período fechado.",
  "periodo-futuro": "Não é possível fechar produção futura.",
  "motivo-permanencia": "Selecione um motivo de permanência válido.",
  "fechar-parcial": "Não foi possível fechar a conta parcial. Revise os dados e tente novamente.",
};

export default async function ContasInternacaoPage({ searchParams }: { searchParams: Promise<Search> }) {
  const query = await searchParams;
  const { supabase, empresaId, unidadeId } = await getAssistencialContext();

  const [{ data: internacoesData, error: internacoesError }, { data: motivosData }] = await Promise.all([
    supabase
      .from("internacoes")
      .select("id,atendimento_id,status,setor,quarto,leito,data_internacao,data_alta,atendimento:atendimentos(id,numero_atendimento,paciente:pacientes(nome_completo,ra))")
      .eq("empresa_id", empresaId)
      .eq("unidade_id", unidadeId)
      .order("data_internacao", { ascending: false })
      .limit(150),
    supabase
      .from("ans_fhir_dominios_ativos")
      .select("codigo,display,ordem")
      .eq("tabela", 39)
      .in("codigo", ["21", "22", "23", "24", "25", "26", "27", "28"])
      .order("ordem"),
  ]);

  if (internacoesError) console.error("[internacao.contas] falha ao carregar internações", { code: internacoesError.code });
  const internacoes = (internacoesData ?? []) as unknown as Internacao[];
  const ids = internacoes.map((item) => item.id);
  const { data: contasData, error: contasError } = ids.length
    ? await supabase
      .from("contas_faturamento")
      .select("id,internacao_id,modalidade_conta,parcial_numero,periodo_inicio,periodo_fim,status,valor_bruto,valor_liquido,motivo_encerramento_tiss_descricao,observacao_fechamento")
      .in("internacao_id", ids)
      .neq("status", "cancelada")
      .order("created_at", { ascending: true })
    : { data: [], error: null };

  if (contasError) console.error("[internacao.contas] falha ao carregar contas", { code: contasError.code });
  const contas = (contasData ?? []) as Conta[];
  const motivos = (motivosData ?? []) as Motivo[];
  const today = saoPauloDate();
  const active = internacoes.filter((item) => ["internado", "transferido", "aguardando_leito"].includes(item.status) && !item.data_alta).length;
  const partialCount = contas.filter((item) => item.modalidade_conta === "parcial").length;
  const partialTotal = contas.filter((item) => item.modalidade_conta === "parcial").reduce((sum, item) => sum + Number(item.valor_liquido ?? 0), 0);

  return <SectionPage
    eyebrow="Internação / Faturamento"
    title="Contas da internação"
    description="Feche períodos parciais sem encerrar a internação. Cada período permanece separado, congelado e rastreável até a conta final."
    actions={<Link href="/faturamento/contas?tipo=internacao" className="ui-button-secondary">Ver no faturamento</Link>}
  >
    {query.sucesso === "parcial" ? <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">Conta parcial {query.parcial ? `#${query.parcial} ` : ""}fechada. A internação continua ativa e o próximo período começa após o último dia faturado.</div> : null}
    {query.erro ? <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">{errorMessages[query.erro] ?? "Não foi possível concluir a operação."}</div> : null}

    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Metric icon={Hospital} label="Internações ativas" value={String(active)} detail="Continuam assistencialmente abertas" />
      <Metric icon={ScissorsLineDashed} label="Parciais fechadas" value={String(partialCount)} detail="Períodos já congelados" />
      <Metric icon={CircleDollarSign} label="Valor das parciais" value={money(partialTotal)} detail="Somatório líquido congelado" />
      <Metric icon={FileCheck2} label="Internações listadas" value={String(internacoes.length)} detail="Ativas e histórico recente" />
    </section>

    <section className="mt-5 space-y-4">
      {internacoes.length ? internacoes.map((internacao) => {
        const atendimento = one(internacao.atendimento);
        const paciente = one(atendimento?.paciente ?? null);
        const contasDaInternacao = contas.filter((conta) => conta.internacao_id === internacao.id);
        const parciais = contasDaInternacao.filter((conta) => conta.modalidade_conta === "parcial").sort((a, b) => Number(a.parcial_numero ?? 0) - Number(b.parcial_numero ?? 0));
        const final = contasDaInternacao.find((conta) => conta.modalidade_conta === "final") ?? null;
        const corrente = contasDaInternacao.find((conta) => ["corrente", "unica"].includes(conta.modalidade_conta) && conta.status !== "cancelada") ?? null;
        const ultimaParcial = parciais.at(-1) ?? null;
        const admissionDate = internacao.data_internacao.slice(0, 10);
        const nextStart = ultimaParcial?.periodo_fim ? addDay(ultimaParcial.periodo_fim) : admissionDate;
        const isActive = ["internado", "transferido", "aguardando_leito"].includes(internacao.status) && !internacao.data_alta;

        return <article key={internacao.id} className="his-card overflow-hidden">
          <header className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 p-5">
            <div>
              <div className="flex flex-wrap items-center gap-2"><h2 className="text-lg font-black text-slate-950">{paciente?.nome_completo ?? "Paciente"}</h2><span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase ${isActive ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>{isActive ? "Internado" : "Encerrado"}</span></div>
              <p className="mt-1 text-sm font-semibold text-slate-600">Atendimento / Guia #{atendimento?.numero_atendimento ?? "—"} · RA {paciente?.ra ?? "—"}</p>
              <p className="mt-1 text-xs text-slate-500">Entrada {date(internacao.data_internacao)} · {internacao.setor}{internacao.quarto ? ` · quarto ${internacao.quarto}` : ""}{internacao.leito ? ` · leito ${internacao.leito}` : ""}{internacao.data_alta ? ` · saída ${date(internacao.data_alta)}` : ""}</p>
            </div>
            <div className="text-right"><p className="text-[10px] font-black uppercase tracking-wide text-slate-400">Conta corrente</p><p className="mt-1 text-lg font-black text-slate-950">{money(corrente?.valor_liquido)}</p>{corrente ? <Link href={`/faturamento/${corrente.id}` as Route} className="mt-2 inline-flex text-xs font-black text-brand-700 hover:underline">Abrir conta atual</Link> : <p className="mt-1 text-xs text-amber-700">Aguardando conta</p>}</div>
          </header>

          <div className="grid gap-5 p-5 xl:grid-cols-[minmax(0,1fr)_400px]">
            <div>
              <div className="mb-3 flex items-center justify-between"><div><p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Histórico de períodos</p><h3 className="mt-1 font-black text-slate-900">Parciais e conta final</h3></div><span className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">{parciais.length} parcial(is)</span></div>
              {parciais.length || final ? <div className="overflow-x-auto rounded-xl border border-slate-200"><table className="w-full min-w-[720px] text-left text-xs"><thead className="bg-slate-50 text-[10px] font-black uppercase tracking-wide text-slate-500"><tr><th className="px-3 py-2.5">Conta</th><th className="px-3 py-2.5">Período</th><th className="px-3 py-2.5">Motivo</th><th className="px-3 py-2.5">Status</th><th className="px-3 py-2.5 text-right">Líquido</th><th className="px-3 py-2.5"></th></tr></thead><tbody className="divide-y divide-slate-100">{[...parciais, ...(final ? [final] : [])].map((conta) => <tr key={conta.id}><td className="px-3 py-3 font-black text-slate-800">{conta.modalidade_conta === "parcial" ? `Parcial #${conta.parcial_numero ?? "—"}` : "Final"}</td><td className="px-3 py-3 text-slate-600">{date(conta.periodo_inicio)} → {date(conta.periodo_fim)}</td><td className="max-w-64 px-3 py-3 text-slate-600">{conta.motivo_encerramento_tiss_descricao ?? "—"}</td><td className="px-3 py-3"><span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-600">{conta.status.replaceAll("_", " ")}</span></td><td className="px-3 py-3 text-right font-black text-slate-800">{money(conta.valor_liquido)}</td><td className="px-3 py-3 text-right"><Link href={`/faturamento/${conta.id}` as Route} className="font-black text-brand-700 hover:underline">Abrir</Link></td></tr>)}</tbody></table></div> : <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-500">Nenhum período parcial foi fechado nesta internação.</div>}
            </div>

            <aside className={`rounded-2xl border p-4 ${isActive ? "border-brand-200 bg-brand-50/40" : "border-slate-200 bg-slate-50"}`}>
              <div className="flex items-center gap-2"><CalendarRange className={`size-5 ${isActive ? "text-brand-700" : "text-slate-400"}`} /><div><p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Novo fechamento</p><h3 className="font-black text-slate-900">Fechar conta parcial</h3></div></div>
              {isActive ? <form action={fecharContaParcialInternacao} className="mt-4 space-y-3">
                <input type="hidden" name="internacao_id" value={internacao.id} />
                <div className="grid grid-cols-2 gap-2"><label className="space-y-1 text-xs font-bold text-slate-600"><span>Início *</span><input name="periodo_inicio" type="date" required min={nextStart} defaultValue={nextStart} className="ui-input" /></label><label className="space-y-1 text-xs font-bold text-slate-600"><span>Fim *</span><input name="periodo_fim" type="date" required min={nextStart} max={today} defaultValue={today >= nextStart ? today : nextStart} className="ui-input" /></label></div>
                <label className="space-y-1 text-xs font-bold text-slate-600"><span>Motivo da permanência *</span><select name="motivo_permanencia_codigo" required defaultValue="" className="ui-input"><option value="">Selecione</option>{motivos.map((motivo) => <option key={motivo.codigo} value={motivo.codigo}>{motivo.display}</option>)}</select></label>
                <label className="space-y-1 text-xs font-bold text-slate-600"><span>Observação do fechamento</span><textarea name="observacao" rows={2} className="ui-input" placeholder="Opcional" /></label>
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-800">Ao fechar, os lançamentos deste período são fotografados na parcial e não podem reaparecer em outra conta. A internação permanece aberta.</div>
                <button className="ui-button-primary w-full justify-center">Fechar período {date(nextStart)} → ...</button>
              </form> : <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">Internação encerrada. Novas contas parciais não podem ser criadas.</div>}
            </aside>
          </div>
        </article>;
      }) : <div className="his-card p-10 text-center text-sm text-slate-500">Nenhuma internação encontrada para esta unidade.</div>}
    </section>
  </SectionPage>;
}

function Metric({ icon: Icon, label, value, detail }: { icon: typeof Hospital; label: string; value: string; detail: string }) {
  return <div className="his-kpi"><div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-wide text-slate-400">{label}</p><p className="mt-2 text-xl font-black text-slate-950">{value}</p><p className="mt-1 text-[11px] font-semibold text-slate-500">{detail}</p></div><span className="grid size-10 place-items-center rounded-xl bg-brand-50 text-brand-700"><Icon className="size-5" /></span></div></div>;
}
