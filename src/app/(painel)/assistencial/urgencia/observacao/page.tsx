import Link from "next/link";
import { Clock3, Eye, HeartPulse, Stethoscope } from "lucide-react";
import { requirePermission } from "@/lib/permissions/server";
import { encerrarObservacaoEmergencia, iniciarObservacaoEmergencia } from "@/modules/urgencia/actions";

type Rel<T> = T | T[] | null;
type Paciente = { nome_completo: string | null; ra: string | null; numero_registro: number | null };
type Atendimento = { numero_atendimento: string | number | null; paciente: Rel<Paciente> };
type Emergencia = {
  id: string;
  atendimento_id: string;
  classificacao_risco: string | null;
  protocolo: string | null;
  sala: string | null;
  reavaliacao_em: string | null;
  destino: string | null;
  atendimento: Rel<Atendimento>;
};
type Observacao = {
  id: string;
  emergencia_id: string;
  atendimento_id: string;
  status: string;
  motivo: string | null;
  local_observacao: string | null;
  iniciado_em: string;
  encerrado_em: string | null;
  destino_final: string | null;
  observacoes_inicio: string | null;
  observacoes_fim: string | null;
  emergencia: Rel<Emergencia>;
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

function one<T>(value: Rel<T>): T | null {
  return Array.isArray(value) ? value[0] ?? null : value;
}

function dateTime(value?: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(value));
}

function elapsed(start: string, end?: string | null) {
  const started = new Date(start).getTime();
  const finished = end ? new Date(end).getTime() : Date.now();
  const minutes = Math.max(0, Math.floor((finished - started) / 60_000));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours}h ${rest}min` : `${hours}h`;
}

function destinationLabel(value?: string | null) {
  const labels: Record<string, string> = {
    alta: "Alta",
    internacao: "Internação",
    uti: "UTI",
    centro_cirurgico: "Centro Cirúrgico",
    transferencia: "Transferência",
    observacao: "Observação",
  };
  return value ? labels[value] ?? value : "—";
}

export default async function UrgenciaObservacaoPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string; sucesso?: string; observacao?: string }>;
}) {
  const params = await searchParams;
  const { supabase, empresaId, unidadeId } = await requirePermission("emergencia.gerenciar");

  if (!empresaId || !unidadeId) {
    return <main className="p-6">Selecione uma empresa e unidade para operar a Observação da Urgência.</main>;
  }

  const [observacoesReq, emergenciasReq] = await Promise.all([
    supabase
      .from("emergencia_observacoes")
      .select("id,emergencia_id,atendimento_id,status,motivo,local_observacao,iniciado_em,encerrado_em,destino_final,observacoes_inicio,observacoes_fim,emergencia:emergencia_registros(id,atendimento_id,classificacao_risco,protocolo,sala,reavaliacao_em,destino,atendimento:atendimentos(numero_atendimento,paciente:pacientes(nome_completo,ra,numero_registro)))")
      .eq("empresa_id", empresaId)
      .eq("unidade_id", unidadeId)
      .order("iniciado_em", { ascending: false })
      .limit(200),
    supabase
      .from("emergencia_registros")
      .select("id,atendimento_id,classificacao_risco,protocolo,sala,reavaliacao_em,destino,atendimento:atendimentos(numero_atendimento,paciente:pacientes(nome_completo,ra,numero_registro))")
      .eq("empresa_id", empresaId)
      .eq("unidade_id", unidadeId)
      .neq("status", "encerrado")
      .order("created_at", { ascending: false })
      .limit(200),
  ]);

  const observacoes = (observacoesReq.data ?? []) as Observacao[];
  const emergencias = (emergenciasReq.data ?? []) as Emergencia[];
  const ativas = observacoes.filter((item) => item.status === "ativa");
  const encerradas = observacoes.filter((item) => item.status === "encerrada").slice(0, 50);
  const emergenciasEmObservacao = new Set(ativas.map((item) => item.emergencia_id));
  const candidatas = emergencias.filter((item) => !emergenciasEmObservacao.has(item.id));
  const now = Date.now();
  const reavaliacoesVencidas = ativas.filter((item) => {
    const emergencia = one(item.emergencia);
    return Boolean(emergencia?.reavaliacao_em && new Date(emergencia.reavaliacao_em).getTime() <= now);
  }).length;

  return (
    <main className="mx-auto max-w-7xl space-y-6 p-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-500">Urgência / Emergência</p>
          <h1 className="mt-1 text-2xl font-black text-slate-950">Observação</h1>
          <p className="mt-1 max-w-3xl text-sm text-slate-600">
            Permanência operacional no mesmo atendimento/RA. Local é opcional e não cria leito físico; reavaliações continuam registradas na Urgência e no prontuário longitudinal.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link className="ui-button-secondary" href="/assistencial/urgencia/sla"><Clock3 className="size-4" />SLA e reavaliações</Link>
          <Link className="ui-button-secondary" href="/assistencial/urgencia"><Stethoscope className="size-4" />Voltar para Urgência</Link>
        </div>
      </header>

      {params.sucesso ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">Operação concluída: {params.sucesso}.</div> : null}
      {params.erro ? <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">Não foi possível concluir a operação: {params.erro}.</div> : null}
      {observacoesReq.error || emergenciasReq.error ? <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">Falha ao carregar a fila de Observação.</div> : null}

      <section className="grid gap-3 sm:grid-cols-3">
        <Kpi label="Em observação" value={ativas.length} />
        <Kpi label="Reavaliação vencida" value={reavaliacoesVencidas} attention />
        <Kpi label="Urgências elegíveis" value={candidatas.length} />
      </section>

      <section className="rounded-2xl border bg-white p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="rounded-xl bg-brand-50 p-2 text-brand-700"><Eye className="size-5" /></span>
          <div>
            <h2 className="font-black text-slate-950">Iniciar observação</h2>
            <p className="text-sm text-slate-500">Somente registros ativos da Urgência e ainda sem Observação ativa.</p>
          </div>
        </div>

        {candidatas.length ? (
          <form action={iniciarObservacaoEmergencia} className="mt-5 grid gap-3 lg:grid-cols-4">
            <label className="text-sm font-semibold text-slate-700 lg:col-span-2">Atendimento
              <select required name="emergencia_id" defaultValue="" className="ui-input mt-1.5">
                <option value="" disabled>Selecione...</option>
                {candidatas.map((registro) => {
                  const atendimento = one(registro.atendimento);
                  const paciente = one(atendimento?.paciente ?? null);
                  return <option key={registro.id} value={registro.id}>{paciente?.nome_completo ?? "Paciente"} · Atend. #{atendimento?.numero_atendimento ?? "—"} · RA {paciente?.ra ?? "—"}</option>;
                })}
              </select>
            </label>
            <label className="text-sm font-semibold text-slate-700">Motivo<input name="motivo" className="ui-input mt-1.5" placeholder="Motivo assistencial da permanência" /></label>
            <label className="text-sm font-semibold text-slate-700">Local opcional<input name="local_observacao" className="ui-input mt-1.5" placeholder="Box/sala real, se aplicável" /></label>
            <label className="text-sm font-semibold text-slate-700">Próxima reavaliação<input name="proxima_reavaliacao_em" type="datetime-local" className="ui-input mt-1.5" /></label>
            <label className="text-sm font-semibold text-slate-700 lg:col-span-3">Observações<input name="observacoes" className="ui-input mt-1.5" /></label>
            <div className="lg:col-span-4 flex justify-end"><button className="ui-button-primary"><HeartPulse className="size-4" />Iniciar observação</button></div>
          </form>
        ) : <p className="mt-5 rounded-xl border border-dashed p-5 text-sm text-slate-500">Não há registro ativo elegível para iniciar Observação.</p>}
      </section>

      <section className="space-y-3">
        <div><h2 className="text-lg font-black text-slate-950">Pacientes em observação</h2><p className="text-sm text-slate-500">A saída encerra a Observação e o registro de Urgência na mesma transação.</p></div>
        {ativas.length ? ativas.map((observacao) => {
          const emergencia = one(observacao.emergencia);
          const atendimento = one(emergencia?.atendimento ?? null);
          const paciente = one(atendimento?.paciente ?? null);
          const due = Boolean(emergencia?.reavaliacao_em && new Date(emergencia.reavaliacao_em).getTime() <= now);
          return (
            <article key={observacao.id} className={`rounded-2xl border bg-white p-5 shadow-sm ${params.observacao === observacao.id ? "ring-2 ring-brand-200" : ""}`}>
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="truncate font-black text-slate-950">{paciente?.nome_completo ?? "Paciente"}</h3>
                    {emergencia?.classificacao_risco ? <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold capitalize">{emergencia.classificacao_risco}</span> : null}
                    {due ? <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-black text-amber-900">Reavaliação vencida</span> : null}
                  </div>
                  <p className="mt-1 text-xs text-slate-500">Atend. #{atendimento?.numero_atendimento ?? "—"} · RA {paciente?.ra ?? "—"} · Registro #{paciente?.numero_registro ?? "—"}</p>
                  <p className="mt-3 text-sm text-slate-700">Motivo: {observacao.motivo ?? "—"} · Local: {observacao.local_observacao ?? "não informado"}</p>
                  <p className="mt-1 text-xs text-slate-500">Início: {dateTime(observacao.iniciado_em)} · Permanência: {elapsed(observacao.iniciado_em)} · Próxima reavaliação: {dateTime(emergencia?.reavaliacao_em)}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link className="ui-button-secondary" href={`/prontuario/${observacao.atendimento_id}`}>Abrir prontuário</Link>
                  <Link className="ui-button-secondary" href={`/assistencial/urgencia?registro=${observacao.emergencia_id}`}>Reavaliar na Urgência</Link>
                </div>
              </div>

              <form action={encerrarObservacaoEmergencia} className="mt-5 grid gap-3 border-t pt-5 lg:grid-cols-[240px_1fr_auto]">
                <input type="hidden" name="observacao_id" value={observacao.id} />
                <select required name="destino_final" defaultValue="" className="ui-input">
                  <option value="" disabled>Destino final...</option>
                  <option value="alta">Alta</option>
                  <option value="internacao">Internação</option>
                  <option value="uti">UTI</option>
                  <option value="centro_cirurgico">Centro Cirúrgico</option>
                  <option value="transferencia">Transferência</option>
                </select>
                <input name="observacoes" className="ui-input" placeholder="Condição/orientação na saída da Observação" />
                <button className="ui-button-primary">Encerrar observação</button>
              </form>
            </article>
          );
        }) : <div className="rounded-2xl border border-dashed bg-white p-8 text-center text-sm text-slate-500">Nenhum paciente em Observação neste momento.</div>}
      </section>

      <section className="space-y-3">
        <div><h2 className="text-lg font-black text-slate-950">Histórico recente</h2><p className="text-sm text-slate-500">Permanências encerradas, preservadas para rastreabilidade.</p></div>
        <div className="overflow-x-auto rounded-2xl border bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Atendimento</th><th className="px-4 py-3">Início</th><th className="px-4 py-3">Fim</th><th className="px-4 py-3">Permanência</th><th className="px-4 py-3">Destino</th></tr></thead>
            <tbody className="divide-y">
              {encerradas.length ? encerradas.map((item) => {
                const emergencia = one(item.emergencia);
                const atendimento = one(emergencia?.atendimento ?? null);
                const paciente = one(atendimento?.paciente ?? null);
                return <tr key={item.id}><td className="px-4 py-3"><div className="font-semibold text-slate-900">{paciente?.nome_completo ?? "Paciente"}</div><div className="text-xs text-slate-500">#{atendimento?.numero_atendimento ?? "—"} · RA {paciente?.ra ?? "—"}</div></td><td className="px-4 py-3">{dateTime(item.iniciado_em)}</td><td className="px-4 py-3">{dateTime(item.encerrado_em)}</td><td className="px-4 py-3">{elapsed(item.iniciado_em, item.encerrado_em)}</td><td className="px-4 py-3 font-semibold">{destinationLabel(item.destino_final)}</td></tr>;
              }) : <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-500">Nenhum histórico de Observação.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

function Kpi({ label, value, attention = false }: { label: string; value: number; attention?: boolean }) {
  return <div className={`rounded-2xl border p-4 ${attention && value ? "border-amber-200 bg-amber-50" : "bg-white"}`}><p className="text-xs font-black uppercase tracking-wide text-slate-500">{label}</p><p className="mt-2 text-3xl font-black text-slate-950">{value}</p></div>;
}
