import Link from "next/link";
import { ArrowRightLeft, Ban, BedDouble, CheckCircle2, Clock3, Hospital, Send, XCircle } from "lucide-react";
import { SectionPage } from "@/components/painel/section-page";
import { requireAnyPermission } from "@/lib/permissions/server";
import {
  aceitarTransferenciaInterunidade,
  cancelarTransferenciaInterunidade,
  recusarTransferenciaInterunidade,
  solicitarTransferenciaInterunidade,
} from "@/modules/internacao/transferencias-actions";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
type Transferencia = {
  id: string;
  internacao_origem_id: string;
  atendimento_origem_id: string;
  unidade_origem_id: string;
  unidade_origem_nome: string;
  unidade_destino_id: string;
  unidade_destino_nome: string;
  leito_origem_codigo: string | null;
  leito_destino_id: string | null;
  atendimento_destino_id: string | null;
  internacao_destino_id: string | null;
  status: string;
  prioridade: string;
  motivo: string;
  resumo_clinico: string | null;
  condicoes_transporte: string | null;
  observacoes: string | null;
  solicitada_em: string;
  concluida_em: string | null;
  motivo_recusa: string | null;
  motivo_cancelamento: string | null;
  paciente_id: string;
  paciente_nome: string | null;
  paciente_cpf: string | null;
  paciente_cns: string | null;
  acomodacao: string | null;
  isolamento: boolean;
};
type Internacao = {
  id: string;
  atendimento_id: string;
  setor: string;
  quarto: string | null;
  leito: string | null;
  acomodacao: string | null;
  motivo: string | null;
  status: string;
  atendimento: { paciente_nome: string | null; paciente_cpf: string | null; paciente_cns: string | null } | { paciente_nome: string | null; paciente_cpf: string | null; paciente_cns: string | null }[] | null;
};
type Destino = { id: string; nome: string; cnes: string | null };
type Leito = { id: string; codigo: string; setor: string; quarto: string | null; acomodacao: string | null; isolamento_capaz: boolean | null };

const one = <T,>(value: T | T[] | null): T | null => Array.isArray(value) ? value[0] ?? null : value;
const fmt = (value?: string | null) => value
  ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(value))
  : "—";
const statusLabel: Record<string, string> = { solicitada: "Solicitada", concluida: "Concluída", recusada: "Recusada", cancelada: "Cancelada" };
const prioridadeLabel: Record<string, string> = { normal: "Normal", alta: "Alta", urgente: "Urgente", emergencia: "Emergência" };

export default async function TransferenciasInterunidadesPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const { supabase, empresaId, unidadeId } = await requireAnyPermission(["internacao.visualizar", "internacao.movimentar", "internacao.gerenciar"]);
  if (!unidadeId) return null;

  const [moveReq, manageReq, filaReq, internacoesReq, leitosReq] = await Promise.all([
    supabase.rpc("tem_permissao", { p_empresa: empresaId, p_unidade: unidadeId, p_codigo: "internacao.movimentar" }),
    supabase.rpc("tem_permissao", { p_empresa: empresaId, p_unidade: unidadeId, p_codigo: "internacao.gerenciar" }),
    supabase.rpc("listar_transferencias_interunidades_operacionais", { p_unidade_id: unidadeId }),
    supabase
      .from("internacoes")
      .select("id,atendimento_id,setor,quarto,leito,acomodacao,motivo,status,atendimento:atendimentos(paciente_nome,paciente_cpf,paciente_cns)")
      .eq("empresa_id", empresaId)
      .eq("unidade_id", unidadeId)
      .in("status", ["internado", "transferido"])
      .not("leito_id", "is", null)
      .order("data_internacao", { ascending: true }),
    supabase
      .from("leitos")
      .select("id,codigo,setor,quarto,acomodacao,isolamento_capaz")
      .eq("empresa_id", empresaId)
      .eq("unidade_id", unidadeId)
      .eq("ativo", true)
      .eq("status", "livre")
      .order("setor")
      .order("quarto")
      .order("codigo"),
  ]);

  const canMove = moveReq.data === true || manageReq.data === true;
  const destinosReq = canMove
    ? await supabase.rpc("listar_unidades_destino_transferencia_interunidade", { p_unidade_origem_id: unidadeId })
    : { data: [] as Destino[], error: null };

  const transferencias = (filaReq.data ?? []) as Transferencia[];
  const internacoes = (internacoesReq.data ?? []) as unknown as Internacao[];
  const destinos = (destinosReq.data ?? []) as Destino[];
  const leitos = (leitosReq.data ?? []) as Leito[];
  const recebidas = transferencias.filter((item) => item.status === "solicitada" && item.unidade_destino_id === unidadeId);
  const enviadas = transferencias.filter((item) => item.status === "solicitada" && item.unidade_origem_id === unidadeId);
  const concluidas = transferencias.filter((item) => item.status === "concluida");
  const historico = transferencias.filter((item) => item.status !== "solicitada");
  const erro = typeof params.erro === "string" ? params.erro : null;
  const sucesso = typeof params.sucesso === "string" ? params.sucesso : null;

  return (
    <SectionPage
      eyebrow="Assistencial / Internação / NIR"
      title="Transferências interunidades"
      description="Continuidade assistencial entre unidades da mesma empresa. A origem encerra seu segmento/conta e o destino recebe um novo atendimento/RA, preservando o vínculo longitudinal pela transferência."
      actions={<Link href="/internacao/nir" className="ui-button-secondary"><Hospital className="size-4" />NIR</Link>}
    >
      {erro ? <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">Não foi possível concluir a operação ({erro}). Revalide estado, leito, escopo e permissões.</div> : null}
      {sucesso ? <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">Operação de transferência registrada com sucesso.</div> : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Recebidas pendentes" value={recebidas.length} icon={<Clock3 className="size-5 text-amber-600" />} />
        <Metric label="Enviadas pendentes" value={enviadas.length} icon={<Send className="size-5 text-blue-600" />} />
        <Metric label="Concluídas" value={concluidas.length} icon={<CheckCircle2 className="size-5 text-emerald-600" />} />
        <Metric label="Leitos livres nesta unidade" value={leitos.length} icon={<BedDouble className="size-5 text-slate-600" />} />
      </section>

      {canMove ? (
        <section className="mt-5 his-card p-5">
          <div className="mb-4">
            <h2 className="font-black text-slate-950">Solicitar transferência</h2>
            <p className="mt-1 text-sm text-slate-500">Somente internações ativas com leito podem sair. A unidade destino decide e seleciona o leito físico no aceite.</p>
          </div>
          {destinos.length === 0 ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Não há outra unidade ativa cadastrada nesta empresa. O fluxo está operacional, mas uma transferência real depende de um destino institucional verdadeiro; nenhum destino fictício é criado pelo sistema.
            </div>
          ) : internacoes.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">Não há internação ativa com leito para transferir nesta unidade.</div>
          ) : (
            <form action={solicitarTransferenciaInterunidade} className="grid gap-3 lg:grid-cols-2">
              <label className="text-sm font-bold text-slate-700">Internação
                <select name="internacao_id" required className="ui-input mt-1 w-full">
                  <option value="">Selecione</option>
                  {internacoes.map((item) => { const a = one(item.atendimento); return <option key={item.id} value={item.id}>{a?.paciente_nome ?? "Paciente"} · {item.setor} · {item.leito ?? item.quarto ?? "leito"}</option>; })}
                </select>
              </label>
              <label className="text-sm font-bold text-slate-700">Unidade destino
                <select name="unidade_destino_id" required className="ui-input mt-1 w-full">
                  <option value="">Selecione</option>
                  {destinos.map((item) => <option key={item.id} value={item.id}>{item.nome}{item.cnes ? ` · CNES ${item.cnes}` : ""}</option>)}
                </select>
              </label>
              <label className="text-sm font-bold text-slate-700">Prioridade
                <select name="prioridade" defaultValue="normal" className="ui-input mt-1 w-full">
                  <option value="normal">Normal</option><option value="alta">Alta</option><option value="urgente">Urgente</option><option value="emergencia">Emergência</option>
                </select>
              </label>
              <label className="text-sm font-bold text-slate-700">Motivo
                <input name="motivo" required className="ui-input mt-1 w-full" placeholder="Motivo assistencial/regulatório" />
              </label>
              <label className="text-sm font-bold text-slate-700 lg:col-span-2">Resumo clínico
                <textarea name="resumo_clinico" rows={3} className="ui-input mt-1 w-full" placeholder="Quadro atual e pontos essenciais para continuidade" />
              </label>
              <label className="text-sm font-bold text-slate-700 lg:col-span-2">Condições de transporte
                <textarea name="condicoes_transporte" rows={2} className="ui-input mt-1 w-full" placeholder="Oxigênio, monitorização, isolamento, equipe necessária..." />
              </label>
              <label className="text-sm font-bold text-slate-700">Autorização destino<input name="numero_autorizacao_destino" className="ui-input mt-1 w-full" /></label>
              <label className="text-sm font-bold text-slate-700">Senha autorização<input name="senha_autorizacao_destino" className="ui-input mt-1 w-full" /></label>
              <label className="text-sm font-bold text-slate-700 lg:col-span-2">Observações<textarea name="observacoes" rows={2} className="ui-input mt-1 w-full" /></label>
              <div className="lg:col-span-2"><button className="ui-button-primary"><ArrowRightLeft className="size-4" />Solicitar transferência</button></div>
            </form>
          )}
        </section>
      ) : null}

      <section className="mt-5 grid gap-5 xl:grid-cols-2">
        <Queue title="Solicitações recebidas" empty="Nenhuma transferência aguardando decisão desta unidade.">
          {recebidas.map((item) => (
            <TransferCard key={item.id} item={item}>
              {canMove ? <div className="mt-4 grid gap-3 border-t border-slate-100 pt-4">
                <form action={aceitarTransferenciaInterunidade} className="grid gap-2 sm:grid-cols-[1fr_auto]">
                  <input type="hidden" name="transferencia_id" value={item.id} />
                  <select name="leito_destino_id" required className="ui-input">
                    <option value="">Selecione um leito livre</option>
                    {leitos.map((leito) => <option key={leito.id} value={leito.id}>{leito.setor} · {leito.quarto ?? "—"} · {leito.codigo} · {leito.acomodacao ?? "sem acomodação"}</option>)}
                  </select>
                  <button className="ui-button-primary"><CheckCircle2 className="size-4" />Aceitar</button>
                </form>
                <form action={recusarTransferenciaInterunidade} className="grid gap-2 sm:grid-cols-[1fr_auto]">
                  <input type="hidden" name="transferencia_id" value={item.id} />
                  <input name="motivo" required className="ui-input" placeholder="Motivo obrigatório da recusa" />
                  <button className="ui-button-secondary"><XCircle className="size-4" />Recusar</button>
                </form>
              </div> : null}
            </TransferCard>
          ))}
        </Queue>

        <Queue title="Solicitações enviadas" empty="Nenhuma transferência enviada aguardando decisão.">
          {enviadas.map((item) => (
            <TransferCard key={item.id} item={item}>
              {canMove ? <form action={cancelarTransferenciaInterunidade} className="mt-4 grid gap-2 border-t border-slate-100 pt-4 sm:grid-cols-[1fr_auto]">
                <input type="hidden" name="transferencia_id" value={item.id} />
                <input name="motivo" required className="ui-input" placeholder="Motivo obrigatório do cancelamento" />
                <button className="ui-button-secondary"><Ban className="size-4" />Cancelar</button>
              </form> : null}
            </TransferCard>
          ))}
        </Queue>
      </section>

      <section className="mt-5 his-card overflow-hidden">
        <div className="border-b border-slate-100 px-5 py-4"><h2 className="font-black text-slate-950">Histórico</h2><p className="mt-1 text-sm text-slate-500">Concluídas, recusadas e canceladas permanecem auditáveis com os vínculos de origem e destino.</p></div>
        {historico.length === 0 ? <p className="p-5 text-sm text-slate-500">Nenhum histórico de transferência nesta unidade.</p> : <div className="divide-y divide-slate-100">{historico.map((item) => <TransferCard key={item.id} item={item} />)}</div>}
      </section>
    </SectionPage>
  );
}

function Metric({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return <div className="his-card flex items-center justify-between gap-3 p-4"><div><p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p><p className="mt-1 text-2xl font-black text-slate-950">{value}</p></div>{icon}</div>;
}
function Queue({ title, empty, children }: { title: string; empty: string; children: React.ReactNode }) {
  const list = Array.isArray(children) ? children : [children];
  return <div className="his-card overflow-hidden"><div className="border-b border-slate-100 px-5 py-4"><h2 className="font-black text-slate-950">{title}</h2></div>{list.length === 0 ? <p className="p-5 text-sm text-slate-500">{empty}</p> : <div className="divide-y divide-slate-100">{children}</div>}</div>;
}
function TransferCard({ item, children }: { item: Transferencia; children?: React.ReactNode }) {
  return <article className="p-5">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex flex-wrap gap-2"><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">{statusLabel[item.status] ?? item.status}</span><span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700">{prioridadeLabel[item.prioridade] ?? item.prioridade}</span>{item.isolamento ? <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700">Isolamento</span> : null}</div><h3 className="mt-2 font-black text-slate-950">{item.paciente_nome ?? "Paciente"}</h3><p className="text-sm text-slate-500">CPF {item.paciente_cpf ?? "—"} · CNS {item.paciente_cns ?? "—"}</p></div><p className="text-xs font-semibold text-slate-400">{fmt(item.solicitada_em)}</p></div>
    <div className="mt-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-700"><strong>{item.unidade_origem_nome}</strong> <span className="mx-2">→</span> <strong>{item.unidade_destino_nome}</strong><br />Leito origem: {item.leito_origem_codigo ?? "—"} · Acomodação: {item.acomodacao ?? "—"}</div>
    <dl className="mt-3 grid gap-2 text-sm"><div><dt className="font-bold text-slate-700">Motivo</dt><dd className="text-slate-600">{item.motivo}</dd></div>{item.resumo_clinico ? <div><dt className="font-bold text-slate-700">Resumo clínico</dt><dd className="whitespace-pre-wrap text-slate-600">{item.resumo_clinico}</dd></div> : null}{item.condicoes_transporte ? <div><dt className="font-bold text-slate-700">Transporte</dt><dd className="whitespace-pre-wrap text-slate-600">{item.condicoes_transporte}</dd></div> : null}{item.motivo_recusa ? <div><dt className="font-bold text-red-700">Recusa</dt><dd className="text-red-600">{item.motivo_recusa}</dd></div> : null}{item.motivo_cancelamento ? <div><dt className="font-bold text-slate-700">Cancelamento</dt><dd className="text-slate-600">{item.motivo_cancelamento}</dd></div> : null}{item.atendimento_destino_id ? <div><dt className="font-bold text-emerald-700">Continuidade criada</dt><dd className="text-emerald-700">Atendimento destino {item.atendimento_destino_id.slice(0, 8)}… · Internação {item.internacao_destino_id?.slice(0, 8)}… · {fmt(item.concluida_em)}</dd></div> : null}</dl>
    {children}
  </article>;
}
