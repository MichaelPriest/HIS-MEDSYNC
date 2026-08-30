import Link from "next/link";
import { requirePermission } from "@/lib/permissions/server";
import { atualizarRegistroEmergencia } from "@/modules/urgencia/actions";

type FilaRegistro = {
  id: string;
  atendimento_id: string;
  status: string;
  classificacao_risco: string | null;
  prioridade: number | null;
  sla_minutos: number | null;
  classificado_em: string | null;
  sla_cumprido_em: string | null;
  reavaliado_em: string | null;
  reavaliacao_em: string | null;
  destino: string | null;
  sla_vencimento_em: string | null;
  sla_vencido: boolean;
  reavaliacao_vencida: boolean;
  minutos_atraso_sla: number;
  minutos_atraso_reavaliacao: number;
};

function dateTime(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(value));
}

function riskLabel(value: string | null) {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : "Não classificado";
}

export default async function UrgenciaSlaPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string; sucesso?: string; registro?: string }>;
}) {
  const params = await searchParams;
  const { supabase, empresaId, unidadeId } = await requirePermission("emergencia.gerenciar");

  if (!empresaId || !unidadeId) {
    return <main className="p-6">Selecione uma empresa e unidade para acompanhar a fila da Urgência.</main>;
  }

  const { data, error } = await supabase
    .from("emergencia_fila_operacional")
    .select("id,atendimento_id,status,classificacao_risco,prioridade,sla_minutos,classificado_em,sla_cumprido_em,reavaliado_em,reavaliacao_em,destino,sla_vencimento_em,sla_vencido,reavaliacao_vencida,minutos_atraso_sla,minutos_atraso_reavaliacao")
    .eq("empresa_id", empresaId)
    .eq("unidade_id", unidadeId)
    .neq("status", "encerrado");

  if (error) {
    console.error("[urgencia] carregar fila SLA", { code: error.code });
  }

  const registros = ((data ?? []) as FilaRegistro[]).sort((a, b) => {
    if (a.sla_vencido !== b.sla_vencido) return a.sla_vencido ? -1 : 1;
    if (a.reavaliacao_vencida !== b.reavaliacao_vencida) return a.reavaliacao_vencida ? -1 : 1;
    const prioridadeA = a.prioridade ?? Number.MAX_SAFE_INTEGER;
    const prioridadeB = b.prioridade ?? Number.MAX_SAFE_INTEGER;
    if (prioridadeA !== prioridadeB) return prioridadeA - prioridadeB;
    return (a.sla_vencimento_em ?? "9999").localeCompare(b.sla_vencimento_em ?? "9999");
  });

  const slaVencidos = registros.filter((item) => item.sla_vencido).length;
  const reavaliacoesVencidas = registros.filter((item) => item.reavaliacao_vencida).length;

  return (
    <main className="mx-auto max-w-7xl space-y-6 p-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-slate-500">Urgência / Emergência</p>
          <h1 className="text-2xl font-semibold text-slate-950">SLA e reavaliações</h1>
          <p className="mt-1 max-w-3xl text-sm text-slate-600">
            Fila derivada do registro de emergência. Os tempos são configurados pela instituição; o sistema não aplica intervalos de Manchester automaticamente.
          </p>
        </div>
        <Link className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-slate-50" href="/assistencial/urgencia">
          Voltar para Urgência
        </Link>
      </header>

      {params.sucesso ? <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">Configuração atualizada.</div> : null}
      {params.erro ? <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">Não foi possível atualizar o registro: {params.erro}.</div> : null}
      {error ? <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">Falha ao carregar a fila operacional.</div> : null}

      <section className="grid gap-3 md:grid-cols-3">
        <div className="rounded-xl border bg-white p-4"><p className="text-sm text-slate-500">Registros ativos</p><p className="mt-1 text-2xl font-semibold">{registros.length}</p></div>
        <div className="rounded-xl border bg-white p-4"><p className="text-sm text-slate-500">SLA vencido</p><p className="mt-1 text-2xl font-semibold">{slaVencidos}</p></div>
        <div className="rounded-xl border bg-white p-4"><p className="text-sm text-slate-500">Reavaliação vencida</p><p className="mt-1 text-2xl font-semibold">{reavaliacoesVencidas}</p></div>
      </section>

      <section className="space-y-4">
        {registros.length === 0 ? (
          <div className="rounded-xl border border-dashed p-8 text-center text-sm text-slate-500">Nenhum registro ativo na fila de Urgência.</div>
        ) : registros.map((registro) => (
          <article key={registro.id} className="rounded-xl border bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-semibold text-slate-950">Atendimento {registro.atendimento_id.slice(0, 8)}</h2>
                  <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium">{riskLabel(registro.classificacao_risco)}</span>
                  {registro.sla_vencido ? <span className="rounded-full bg-rose-100 px-2 py-1 text-xs font-semibold text-rose-800">SLA +{registro.minutos_atraso_sla} min</span> : null}
                  {registro.reavaliacao_vencida ? <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-900">Reavaliação +{registro.minutos_atraso_reavaliacao} min</span> : null}
                </div>
                <p className="mt-2 text-sm text-slate-600">
                  Prioridade: {registro.prioridade ?? "—"} · SLA: {registro.sla_minutos ? `${registro.sla_minutos} min` : "não configurado"} · Destino: {registro.destino ?? "—"}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Classificado: {dateTime(registro.classificado_em)} · SLA vence: {dateTime(registro.sla_vencimento_em)} · Última reavaliação: {dateTime(registro.reavaliado_em)} · Próxima: {dateTime(registro.reavaliacao_em)}
                </p>
              </div>
              <Link className="text-sm font-medium text-slate-700 underline" href={`/prontuario/${registro.atendimento_id}`}>Abrir prontuário</Link>
            </div>

            <form action={atualizarRegistroEmergencia} className="mt-5 grid gap-3 border-t pt-5 md:grid-cols-2 lg:grid-cols-4">
              <input type="hidden" name="emergencia_id" value={registro.id} />
              <label className="text-sm">Classificação
                <select className="mt-1 w-full rounded-lg border px-3 py-2" name="classificacao_risco" defaultValue={registro.classificacao_risco ?? ""}>
                  <option value="">Manter atual</option><option value="vermelho">Vermelho</option><option value="laranja">Laranja</option><option value="amarelo">Amarelo</option><option value="verde">Verde</option><option value="azul">Azul</option>
                </select>
              </label>
              <label className="text-sm">Prioridade
                <input className="mt-1 w-full rounded-lg border px-3 py-2" type="number" min="1" name="prioridade" defaultValue={registro.prioridade ?? ""} placeholder="Sem prioridade" />
              </label>
              <label className="text-sm">SLA institucional (min)
                <input className="mt-1 w-full rounded-lg border px-3 py-2" type="number" min="1" name="sla_minutos" defaultValue={registro.sla_minutos ?? ""} placeholder="Não configurado" />
              </label>
              <label className="text-sm">Próxima reavaliação
                <input className="mt-1 w-full rounded-lg border px-3 py-2" type="datetime-local" name="reavaliacao_em" />
              </label>
              <label className="text-sm">Destino
                <select className="mt-1 w-full rounded-lg border px-3 py-2" name="destino" defaultValue={registro.destino ?? ""}>
                  <option value="">Manter atual</option><option value="observacao">Observação</option><option value="internacao">Internação</option><option value="uti">UTI</option><option value="centro_cirurgico">Centro Cirúrgico</option><option value="alta">Alta</option><option value="transferencia">Transferência</option>
                </select>
              </label>
              <label className="text-sm md:col-span-2 lg:col-span-2">Observações operacionais
                <input className="mt-1 w-full rounded-lg border px-3 py-2" name="observacoes" placeholder="Registrar somente informação pertinente à gestão da fila" />
              </label>
              <div className="flex items-end">
                <button className="w-full rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800" type="submit">Atualizar SLA</button>
              </div>
            </form>
          </article>
        ))}
      </section>
    </main>
  );
}
