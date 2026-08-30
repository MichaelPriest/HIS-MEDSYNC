import Link from "next/link";
import { requireAnyPermission } from "@/lib/permissions/server";

type Registro = {
  id: string;
  status: string;
  classificacao_risco: string | null;
  destino: string | null;
  created_at: string;
  encerrado_em: string | null;
  classificado_em: string | null;
  sla_minutos: number | null;
  sla_cumprido_em: string | null;
};

type Reavaliacao = {
  emergencia_id: string;
  reavaliado_em: string;
  atraso_minutos: number | null;
};

type Observacao = {
  status: string;
  iniciado_em: string;
  encerrado_em: string | null;
  destino_final: string | null;
};

const PERIODOS = [7, 30, 90] as const;
const RISCOS = ["vermelho", "laranja", "amarelo", "verde", "azul"] as const;

function periodoValido(value?: string) {
  const numero = Number(value);
  return PERIODOS.includes(numero as (typeof PERIODOS)[number]) ? numero : 30;
}

function minutosEntre(inicio: string | null, fim: string | null) {
  if (!inicio || !fim) return null;
  const diferenca = new Date(fim).getTime() - new Date(inicio).getTime();
  if (!Number.isFinite(diferenca) || diferenca < 0) return null;
  return Math.round(diferenca / 60_000);
}

function media(valores: Array<number | null>) {
  const validos = valores.filter((item): item is number => item !== null && Number.isFinite(item));
  if (validos.length === 0) return null;
  return validos.reduce((total, item) => total + item, 0) / validos.length;
}

function percentual(parte: number, total: number) {
  return total > 0 ? (parte / total) * 100 : 0;
}

function numero(value: number | null, digits = 0) {
  if (value === null) return "—";
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

function minutos(value: number | null) {
  return value === null ? "—" : `${numero(value)} min`;
}

function labelDestino(value: string | null) {
  if (!value) return "Sem destino registrado";
  return value.replaceAll("_", " ").replace(/^./, (char) => char.toUpperCase());
}

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function UrgenciaIndicadoresPage({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string }>;
}) {
  const params = await searchParams;
  const periodo = periodoValido(params.periodo);
  const desde = new Date(Date.now() - periodo * 24 * 60 * 60 * 1000).toISOString();
  const agora = Date.now();

  const { supabase, empresaId, unidadeId } = await requireAnyPermission([
    "emergencia.visualizar",
    "emergencia.gerenciar",
    "emergencia.reavaliar",
  ]);

  if (!empresaId || !unidadeId) {
    return <main className="p-6">Selecione uma empresa e unidade para consultar os indicadores da Urgência.</main>;
  }

  const [registrosReq, reavaliacoesReq, observacoesReq] = await Promise.all([
    supabase
      .from("emergencia_registros")
      .select("id,status,classificacao_risco,destino,created_at,encerrado_em,classificado_em,sla_minutos,sla_cumprido_em")
      .eq("empresa_id", empresaId)
      .eq("unidade_id", unidadeId)
      .gte("created_at", desde)
      .order("created_at", { ascending: false })
      .limit(5000),
    supabase
      .from("emergencia_reavaliacoes")
      .select("emergencia_id,reavaliado_em,atraso_minutos")
      .eq("empresa_id", empresaId)
      .eq("unidade_id", unidadeId)
      .gte("reavaliado_em", desde)
      .order("reavaliado_em", { ascending: false })
      .limit(10000),
    supabase
      .from("emergencia_observacoes")
      .select("status,iniciado_em,encerrado_em,destino_final")
      .eq("empresa_id", empresaId)
      .eq("unidade_id", unidadeId)
      .gte("iniciado_em", desde)
      .order("iniciado_em", { ascending: false })
      .limit(5000),
  ]);

  const registros = (registrosReq.data ?? []) as Registro[];
  const reavaliacoes = (reavaliacoesReq.data ?? []) as Reavaliacao[];
  const observacoes = (observacoesReq.data ?? []) as Observacao[];
  const erro = registrosReq.error ?? reavaliacoesReq.error ?? observacoesReq.error;

  const ativos = registros.filter((item) => item.status !== "encerrado");
  const encerrados = registros.filter((item) => item.status === "encerrado");
  const slaConfigurado = registros.filter((item) => item.sla_minutos && item.classificado_em);
  const slaComDesfecho = slaConfigurado.filter((item) => item.sla_cumprido_em);
  const slaNoPrazo = slaComDesfecho.filter((item) => {
    const limite = new Date(item.classificado_em as string).getTime() + (item.sla_minutos as number) * 60_000;
    return new Date(item.sla_cumprido_em as string).getTime() <= limite;
  });
  const slaVencidoAberto = slaConfigurado.filter((item) => {
    if (item.status === "encerrado" || item.sla_cumprido_em) return false;
    const limite = new Date(item.classificado_em as string).getTime() + (item.sla_minutos as number) * 60_000;
    return agora > limite;
  });

  const tempoPrimeiraReavaliacao = media(
    slaComDesfecho.map((item) => minutosEntre(item.classificado_em, item.sla_cumprido_em)),
  );
  const reavaliacoesAtrasadas = reavaliacoes.filter((item) => (item.atraso_minutos ?? 0) > 0);
  const atrasoMedioReavaliacao = media(reavaliacoesAtrasadas.map((item) => item.atraso_minutos));

  const observacoesAtivas = observacoes.filter((item) => item.status === "ativa");
  const observacoesEncerradas = observacoes.filter((item) => item.encerrado_em);
  const permanenciaMediaObservacao = media(
    observacoesEncerradas.map((item) => minutosEntre(item.iniciado_em, item.encerrado_em)),
  );

  const riscos = RISCOS.map((risco) => ({
    risco,
    quantidade: registros.filter((item) => item.classificacao_risco?.toLowerCase() === risco).length,
  }));
  const semClassificacao = registros.filter((item) => !item.classificacao_risco).length;

  const destinos = Array.from(
    registros.reduce((acc, item) => {
      const chave = item.destino ?? "";
      acc.set(chave, (acc.get(chave) ?? 0) + 1);
      return acc;
    }, new Map<string, number>()),
  )
    .map(([destino, quantidade]) => ({ destino: destino || null, quantidade }))
    .sort((a, b) => b.quantidade - a.quantidade);

  const destinosObservacao = Array.from(
    observacoesEncerradas.reduce((acc, item) => {
      const chave = item.destino_final ?? "";
      acc.set(chave, (acc.get(chave) ?? 0) + 1);
      return acc;
    }, new Map<string, number>()),
  )
    .map(([destino, quantidade]) => ({ destino: destino || null, quantidade }))
    .sort((a, b) => b.quantidade - a.quantidade);

  return (
    <main className="mx-auto max-w-7xl space-y-6 p-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-slate-500">Urgência / Emergência</p>
          <h1 className="text-2xl font-semibold text-slate-950">Indicadores operacionais</h1>
          <p className="mt-1 max-w-3xl text-sm text-slate-600">
            Métricas derivadas dos registros reais da unidade. O painel mede o SLA institucional configurado e a operação registrada; não cria nem presume protocolo clínico.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-slate-50" href="/assistencial/urgencia/sla">SLA e reavaliações</Link>
          <Link className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-slate-50" href="/assistencial/urgencia/observacao">Observação</Link>
          <Link className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-slate-50" href="/assistencial/urgencia">Voltar para Urgência</Link>
        </div>
      </header>

      <section className="flex flex-wrap items-center gap-2 rounded-xl border bg-white p-4">
        <span className="mr-2 text-sm font-medium text-slate-600">Período:</span>
        {PERIODOS.map((dias) => (
          <Link
            key={dias}
            href={`/assistencial/urgencia/indicadores?periodo=${dias}`}
            className={`rounded-lg px-3 py-2 text-sm font-semibold ${periodo === dias ? "bg-slate-950 text-white" : "border text-slate-700 hover:bg-slate-50"}`}
          >
            {dias} dias
          </Link>
        ))}
        <span className="ml-auto text-xs text-slate-500">Janela móvel até o momento atual.</span>
      </section>

      {erro ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
          Não foi possível carregar todos os indicadores operacionais.
        </div>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Registros no período" value={numero(registros.length)} detail={`${numero(ativos.length)} ativos · ${numero(encerrados.length)} encerrados`} />
        <Kpi label="SLA configurado" value={`${numero(percentual(slaConfigurado.length, registros.length), 1)}%`} detail={`${numero(slaConfigurado.length)} de ${numero(registros.length)} registros`} />
        <Kpi label="SLA cumprido no prazo" value={`${numero(percentual(slaNoPrazo.length, slaComDesfecho.length), 1)}%`} detail={`${numero(slaNoPrazo.length)} de ${numero(slaComDesfecho.length)} com desfecho mensurável`} />
        <Kpi label="SLA vencido ainda aberto" value={numero(slaVencidoAberto.length)} detail="Pendência operacional derivada; não altera o fato clínico" />
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <MetricCard label="Tempo médio até 1ª reavaliação" value={minutos(tempoPrimeiraReavaliacao)} detail="Entre classificação e primeiro cumprimento de SLA registrado." />
        <MetricCard label="Reavaliações atrasadas" value={`${numero(reavaliacoesAtrasadas.length)} / ${numero(reavaliacoes.length)}`} detail={`Atraso médio quando houve atraso: ${minutos(atrasoMedioReavaliacao)}.`} />
        <MetricCard label="Observação" value={`${numero(observacoesAtivas.length)} ativa(s)`} detail={`${numero(observacoesEncerradas.length)} encerrada(s) · permanência média ${minutos(permanenciaMediaObservacao)}.`} />
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <div className="rounded-xl border bg-white p-5">
          <h2 className="text-lg font-semibold text-slate-950">Classificação de risco</h2>
          <p className="mt-1 text-sm text-slate-500">Distribuição registrada no período, sem inferência automática.</p>
          <div className="mt-5 space-y-3">
            {riscos.map((item) => {
              const share = percentual(item.quantidade, registros.length);
              return (
                <div key={item.risco}>
                  <div className="mb-1 flex items-center justify-between gap-3 text-sm">
                    <span className="font-medium capitalize text-slate-700">{item.risco}</span>
                    <span className="text-slate-500">{numero(item.quantidade)} · {numero(share, 1)}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-slate-700" style={{ width: `${Math.min(100, share)}%` }} />
                  </div>
                </div>
              );
            })}
            <div className="flex items-center justify-between border-t pt-3 text-sm">
              <span className="font-medium text-slate-700">Sem classificação registrada</span>
              <span className="text-slate-500">{numero(semClassificacao)} · {numero(percentual(semClassificacao, registros.length), 1)}%</span>
            </div>
          </div>
        </div>

        <div className="rounded-xl border bg-white p-5">
          <h2 className="text-lg font-semibold text-slate-950">Destino assistencial</h2>
          <p className="mt-1 text-sm text-slate-500">Destino atualmente registrado nos episódios iniciados no período.</p>
          <div className="mt-4 divide-y">
            {destinos.length === 0 ? <p className="py-5 text-sm text-slate-500">Nenhum registro no período.</p> : destinos.map((item) => (
              <div key={item.destino ?? "sem-destino"} className="flex items-center justify-between gap-3 py-3 text-sm">
                <span className="font-medium text-slate-700">{labelDestino(item.destino)}</span>
                <span className="text-slate-500">{numero(item.quantidade)} · {numero(percentual(item.quantidade, registros.length), 1)}%</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-xl border bg-white p-5">
        <h2 className="text-lg font-semibold text-slate-950">Saídas da Observação</h2>
        <p className="mt-1 text-sm text-slate-500">Somente permanências efetivamente encerradas no período selecionado.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {destinosObservacao.length === 0 ? (
            <p className="text-sm text-slate-500">Nenhuma saída de Observação registrada nesta janela.</p>
          ) : destinosObservacao.map((item) => (
            <div key={item.destino ?? "sem-destino"} className="rounded-lg border p-4">
              <p className="text-sm text-slate-500">{labelDestino(item.destino)}</p>
              <p className="mt-1 text-xl font-semibold text-slate-950">{numero(item.quantidade)}</p>
            </div>
          ))}
        </div>
      </section>

      <p className="text-xs leading-relaxed text-slate-500">
        Os indicadores são derivados dos timestamps e estados persistidos no HIS. Registros sem configuração, sem classificação ou sem desfecho permanecem explicitamente fora dos denominadores que exigem esses fatos; o painel não preenche lacunas automaticamente.
      </p>
    </main>
  );
}

function Kpi({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-xl border bg-white p-4">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-950">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{detail}</p>
    </div>
  );
}

function MetricCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-xl border bg-white p-5">
      <p className="text-sm font-medium text-slate-600">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-950">{value}</p>
      <p className="mt-2 text-sm text-slate-500">{detail}</p>
    </div>
  );
}
