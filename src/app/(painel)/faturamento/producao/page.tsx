import { Activity, Ban, CheckCircle2, CircleDollarSign, RefreshCcw, ShieldCheck, Sparkles } from "lucide-react";
import { SectionPage } from "@/components/painel/section-page";
import { requirePermission } from "@/lib/permissions/server";
import { sincronizarProducaoAtendimentoAction } from "@/modules/faturamento/producao-actions";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Paciente = { nome_completo: string | null; ra: string | null; numero_registro: string | null };
type Atendimento = { numero_atendimento: number | string | null; status: string | null; paciente: Paciente | Paciente[] | null };
type AtendimentoLista = Atendimento & { id: string };
type ItemAssistencial = { descricao: string | null; tabela_tiss_codigo: string | null; codigo_tuss: string | null; codigo_tabela_propria: string | null };
type Evento = {
  id: string;
  atendimento_id: string;
  tipo_evento: string;
  origem_tipo: string;
  ocorrido_em: string;
  quantidade: number | string;
  setor: string | null;
  codigo_tuss_fallback: string | null;
  cobravel: boolean;
  status: string;
  categoria_contratual: string;
  autorizacao_id: string | null;
  metadados: Record<string, unknown> | null;
  atendimento: Atendimento | Atendimento[] | null;
  item: ItemAssistencial | ItemAssistencial[] | null;
};
type ContaItem = {
  producao_evento_id: string | null;
  origem_tipo: string;
  tabela: string | null;
  codigo: string | null;
  quantidade: number | string;
  cobravel: boolean;
  observacao: string | null;
  pacote_id: string | null;
  valor_total: number | null;
};
type PacoteConsumo = {
  producao_evento_id: string;
  quantidade_evento: number | string;
  quantidade_absorvida: number | string;
  quantidade_excedente: number | string;
  codigo: string;
  tabela: string | null;
};
type AutorizacaoConsumo = {
  producao_evento_id: string;
  central_guia_id: string;
  quantidade_evento: number | string;
  quantidade_alocada: number | string;
  codigo: string;
  tabela: string | null;
};

function one<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

function dateTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(value));
}

function money(value: number | null | undefined) {
  return Number(value ?? 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function decimal(value: number | string | null | undefined) {
  return Number(value ?? 0).toLocaleString("pt-BR", { maximumFractionDigits: 4 });
}

function title(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function metadataText(metadata: Record<string, unknown> | null, key: string) {
  const value = metadata?.[key];
  return typeof value === "string" ? value : null;
}

export default async function LivroProducaoPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string; sucesso?: string; atendimento?: string }>;
}) {
  const qs = await searchParams;
  const { supabase, unidadeId } = await requirePermission("producao.visualizar");

  let eventosQuery = supabase
    .from("producao_assistencial_eventos")
    .select("id,atendimento_id,tipo_evento,origem_tipo,ocorrido_em,quantidade,setor,codigo_tuss_fallback,cobravel,status,categoria_contratual,autorizacao_id,metadados,atendimento:atendimentos(numero_atendimento,status,paciente:pacientes(nome_completo,ra,numero_registro)),item:itens_assistenciais(descricao,tabela_tiss_codigo,codigo_tuss,codigo_tabela_propria)")
    .order("ocorrido_em", { ascending: false })
    .limit(250);
  let atendimentosQuery = supabase
    .from("atendimentos")
    .select("id,numero_atendimento,status,paciente:pacientes(nome_completo,ra,numero_registro)")
    .order("data_abertura", { ascending: false })
    .limit(300);

  if (unidadeId) {
    eventosQuery = eventosQuery.eq("unidade_id", unidadeId);
    atendimentosQuery = atendimentosQuery.eq("unidade_id", unidadeId);
  }

  const [eventosResult, atendimentosResult] = await Promise.all([eventosQuery, atendimentosQuery]);
  if (eventosResult.error) console.error("[producao] falha ao carregar eventos", { code: eventosResult.error.code });
  if (atendimentosResult.error) console.error("[producao] falha ao carregar atendimentos", { code: atendimentosResult.error.code });

  const eventos = (eventosResult.data ?? []) as unknown as Evento[];
  const atendimentosRecentes = (atendimentosResult.data ?? []) as unknown as AtendimentoLista[];
  const ids = eventos.map((item) => item.id);

  const [contaItensResult, pacoteResult, autorizacaoResult] = ids.length
    ? await Promise.all([
        supabase
          .from("conta_faturamento_itens")
          .select("producao_evento_id,origem_tipo,tabela,codigo,quantidade,cobravel,observacao,pacote_id,valor_total")
          .in("producao_evento_id", ids),
        supabase
          .from("atendimento_pacote_consumos")
          .select("producao_evento_id,quantidade_evento,quantidade_absorvida,quantidade_excedente,codigo,tabela")
          .in("producao_evento_id", ids),
        supabase
          .from("producao_autorizacao_consumos")
          .select("producao_evento_id,central_guia_id,quantidade_evento,quantidade_alocada,codigo,tabela")
          .in("producao_evento_id", ids),
      ])
    : [{ data: [], error: null }, { data: [], error: null }, { data: [], error: null }];

  if (contaItensResult.error) console.error("[producao] falha ao carregar itens consolidados", { code: contaItensResult.error.code });
  if (pacoteResult.error) console.error("[producao] falha ao carregar consumo de pacotes", { code: pacoteResult.error.code });
  if (autorizacaoResult.error) console.error("[producao] falha ao carregar consumo de autorizacoes", { code: autorizacaoResult.error.code });

  const contaItens = (contaItensResult.data ?? []) as ContaItem[];
  const pacotes = (pacoteResult.data ?? []) as PacoteConsumo[];
  const autorizacoes = (autorizacaoResult.data ?? []) as AutorizacaoConsumo[];

  const contasPorEvento = new Map<string, ContaItem[]>();
  for (const item of contaItens) {
    if (!item.producao_evento_id) continue;
    contasPorEvento.set(item.producao_evento_id, [...(contasPorEvento.get(item.producao_evento_id) ?? []), item]);
  }
  const pacotePorEvento = new Map(pacotes.map((item) => [item.producao_evento_id, item]));
  const autorizacoesPorEvento = new Map<string, AutorizacaoConsumo[]>();
  for (const item of autorizacoes) {
    autorizacoesPorEvento.set(item.producao_evento_id, [...(autorizacoesPorEvento.get(item.producao_evento_id) ?? []), item]);
  }

  const registrados = eventos.filter((item) => item.status === "registrado").length;
  const consolidados = eventos.filter((item) => item.status === "consolidado").length;
  const cancelados = eventos.filter((item) => item.status === "cancelado" || item.status === "estornado").length;
  const sessoesTea = eventos.filter((item) => item.tipo_evento === "sessao_tea_aba" && !["cancelado", "estornado"].includes(item.status)).length;
  const pendentesAutorizacao = eventos.filter((item) => ["ausente", "insuficiente", "codigo_pendente"].includes(metadataText(item.metadados, "autorizacao_status") ?? "")).length;
  const comExcedente = pacotes.filter((item) => Number(item.quantidade_excedente) > 0).length;
  const pendentesCodigo = eventos.filter((evento) => {
    const itens = contasPorEvento.get(evento.id) ?? [];
    return evento.cobravel && itens.length > 0 && itens.every((item) => !item.codigo);
  }).length;

  const atendimentos = atendimentosRecentes.map((item) => {
    const paciente = one(item.paciente);
    return {
      id: item.id,
      numero: item.numero_atendimento ?? "—",
      status: item.status ?? "—",
      paciente: paciente?.nome_completo ?? "Paciente",
    };
  });

  const erro = qs.erro === "acesso-negado"
    ? "Seu perfil não permite reprocessar produção."
    : qs.erro === "atendimento-nao-localizado"
      ? "Atendimento não localizado no escopo atual."
      : qs.erro
        ? "Não foi possível sincronizar a produção do atendimento."
        : null;

  return (
    <SectionPage
      eyebrow="Ciclo da receita / Produção"
      title="Livro de Produção Assistencial"
      description="Fatos assistenciais capturados automaticamente antes do pré-faturamento. O evento clínico é preservado separado do código de cobrança; pacote, autorização e contrato são resolvidos somente na consolidação."
    >
      {qs.sucesso === "sincronizado" ? (
        <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
          Produção sincronizada sem criar lançamentos clínicos manuais.
        </div>
      ) : null}
      {erro ? <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{erro}</div> : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-7">
        <Kpi icon={Activity} label="Eventos recentes" value={eventos.length} />
        <Kpi icon={RefreshCcw} label="Aguardando consolidação" value={registrados} tone="amber" />
        <Kpi icon={CheckCircle2} label="Consolidados" value={consolidados} tone="emerald" />
        <Kpi icon={Sparkles} label="Sessões TEA / ABA" value={sessoesTea} tone="violet" />
        <Kpi icon={ShieldCheck} label="Autorização pendente" value={pendentesAutorizacao} tone="rose" />
        <Kpi icon={CircleDollarSign} label="Excedentes de pacote" value={comExcedente} tone="amber" />
        <Kpi icon={Ban} label={`Cancelados · cód. pendente ${pendentesCodigo}`} value={cancelados} tone="slate" />
      </section>

      <section className="ui-card mt-5 overflow-hidden">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
          <div>
            <h2 className="font-black text-slate-900">Sincronização de contingência</h2>
            <p className="mt-1 max-w-3xl text-xs text-slate-500">Os lançamentos nascem automaticamente nos setores. Use esta ação somente para recuperar um episódio antigo ou repetir a captura idempotente após correção operacional.</p>
          </div>
          <form action={sincronizarProducaoAtendimentoAction} className="flex flex-wrap items-center gap-2">
            <select name="atendimento_id" required className="ui-input min-w-64">
              <option value="">Selecione um atendimento</option>
              {atendimentos.map((item) => <option key={item.id} value={item.id}>#{item.numero} · {item.paciente} · {item.status.replaceAll("_", " ")}</option>)}
            </select>
            <button className="ui-button-secondary"><RefreshCcw className="size-4" />Sincronizar</button>
          </form>
        </div>
      </section>

      <section className="ui-card mt-5 overflow-hidden">
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 className="font-black text-slate-900">Produção capturada</h2>
          <p className="mt-1 text-xs text-slate-500">Consulta ambulatorial 10101012, pronto atendimento 10101039 e visita/avaliação 10102019 são fallback quando não houver pacote/regra contratual. Sessões TEA/ABA usam o código do catálogo/contrato e, em convênio, exigem autorização por padrão. Diárias e taxas continuam dependentes do contrato.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-[11px] font-black uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Atendimento / paciente</th>
                <th className="px-4 py-3">Evento</th>
                <th className="px-4 py-3">Data / setor</th>
                <th className="px-4 py-3">Código</th>
                <th className="px-4 py-3">Qtd.</th>
                <th className="px-4 py-3">Pacote / autorização</th>
                <th className="px-4 py-3">Cobrança</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {eventos.length ? eventos.map((evento) => {
                const atendimento = one(evento.atendimento);
                const paciente = atendimento ? one(atendimento.paciente) : null;
                const item = one(evento.item);
                const contaItensEvento = contasPorEvento.get(evento.id) ?? [];
                const conta = contaItensEvento.find((entry) => entry.codigo) ?? contaItensEvento[0] ?? null;
                const pacote = pacotePorEvento.get(evento.id) ?? null;
                const auths = autorizacoesPorEvento.get(evento.id) ?? [];
                const authAlocada = auths.reduce((sum, entry) => sum + Number(entry.quantidade_alocada), 0);
                const authStatus = metadataText(evento.metadados, "autorizacao_status");
                const authExigida = evento.metadados?.autorizacao_exigida === true;
                const codigoCatalogo = item?.tabela_tiss_codigo === "00" || item?.tabela_tiss_codigo === "98" ? item.codigo_tabela_propria : item?.codigo_tuss;
                const codigo = conta?.codigo ?? pacote?.codigo ?? codigoCatalogo ?? evento.codigo_tuss_fallback;
                const tabela = conta?.tabela ?? pacote?.tabela ?? item?.tabela_tiss_codigo ?? (evento.codigo_tuss_fallback ? "22" : null);
                const pendente = evento.cobravel && contaItensEvento.length > 0 && contaItensEvento.every((entry) => !entry.codigo);
                const cobraveis = contaItensEvento.filter((entry) => entry.cobravel);
                const total = cobraveis.reduce((sum, entry) => sum + Number(entry.valor_total ?? 0), 0);
                const bloqueadoAuth = authExigida && authStatus && authStatus !== "autorizada";

                return (
                  <tr key={evento.id} className="align-top">
                    <td className="px-4 py-3">
                      <p className="font-bold text-slate-900">{paciente?.nome_completo ?? "Paciente"}</p>
                      <p className="text-xs text-slate-500">Atend. #{atendimento?.numero_atendimento ?? "—"} · {paciente?.ra ?? "—"}</p>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <p className="font-semibold text-slate-800">{title(evento.tipo_evento)}</p>
                        {evento.tipo_evento === "sessao_tea_aba" ? <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-black uppercase text-violet-700">TEA / ABA</span> : null}
                      </div>
                      <p className="text-xs text-slate-500">{evento.origem_tipo} · {title(evento.categoria_contratual)}</p>
                      {item?.descricao ? <p className="mt-1 max-w-72 text-xs text-slate-500">{item.descricao}</p> : null}
                    </td>
                    <td className="px-4 py-3"><p className="text-slate-700">{dateTime(evento.ocorrido_em)}</p><p className="text-xs text-slate-500">{evento.setor ?? "Sem setor"}</p></td>
                    <td className="px-4 py-3">{codigo ? <><p className="font-mono font-bold text-slate-800">{codigo}</p><p className="text-xs text-slate-500">Tabela {tabela ?? "—"}{pacote ? " · pacote" : conta ? " · consolidado" : " · candidato"}</p></> : <span className="font-semibold text-amber-700">Resolver no contrato</span>}</td>
                    <td className="px-4 py-3 font-semibold text-slate-700">{decimal(evento.quantidade)}</td>
                    <td className="px-4 py-3">
                      {pacote ? <div className="rounded-lg bg-indigo-50 px-2.5 py-2 text-xs text-indigo-800"><strong>Pacote</strong><p className="mt-0.5">Absorvido {decimal(pacote.quantidade_absorvida)} · excedente {decimal(pacote.quantidade_excedente)}</p></div> : <p className="text-xs text-slate-400">Sem consumo de pacote</p>}
                      {authExigida ? <div className={`mt-1.5 rounded-lg px-2.5 py-2 text-xs ${authStatus === "autorizada" ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-800"}`}><strong>Autorização {authStatus ? title(authStatus) : "pendente"}</strong><p className="mt-0.5">Alocado {decimal(authAlocada)} de {decimal(evento.quantidade)} · {auths.length} guia(s)</p></div> : <p className="mt-1 text-[11px] text-slate-400">Autorização não exigida</p>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${pendente || bloqueadoAuth ? "bg-rose-50 text-rose-700" : evento.cobravel ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
                        {pendente ? "Código pendente" : bloqueadoAuth ? "Bloqueado autorização" : evento.cobravel ? contaItensEvento.length ? money(total) : "Cobrável" : "Não cobrável"}
                      </span>
                      {conta?.observacao ? <p className="mt-1 max-w-64 text-xs text-slate-500">{conta.observacao}</p> : null}
                    </td>
                    <td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-black uppercase ${evento.status === "consolidado" ? "bg-emerald-50 text-emerald-700" : evento.status === "registrado" ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-600"}`}>{evento.status}</span></td>
                  </tr>
                );
              }) : <tr><td colSpan={8} className="px-5 py-8 text-center text-sm text-slate-500">Ainda não há produção capturada. Novos eventos assistenciais passarão a alimentar o livro automaticamente.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </SectionPage>
  );
}

function Kpi({ icon: Icon, label, value, tone = "brand" }: { icon: typeof Activity; label: string; value: number; tone?: "brand" | "amber" | "emerald" | "rose" | "slate" | "violet" }) {
  const tones = {
    brand: "bg-brand-50 text-brand-700",
    amber: "bg-amber-50 text-amber-700",
    emerald: "bg-emerald-50 text-emerald-700",
    rose: "bg-rose-50 text-rose-700",
    slate: "bg-slate-100 text-slate-600",
    violet: "bg-violet-50 text-violet-700",
  };
  return <div className="ui-card p-4"><div className="flex items-center justify-between"><span className={`grid size-9 place-items-center rounded-xl ${tones[tone]}`}><Icon className="size-4" /></span><strong className="text-2xl text-slate-950">{value}</strong></div><p className="mt-3 text-xs font-semibold text-slate-600">{label}</p></div>;
}
