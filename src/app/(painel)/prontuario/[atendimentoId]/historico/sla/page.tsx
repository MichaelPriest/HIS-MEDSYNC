import Link from "next/link";
import type { Route } from "next";
import { Clock3, History, RefreshCcw } from "lucide-react";
import { notFound } from "next/navigation";
import { SectionPage } from "@/components/painel/section-page";
import { requireAnyPermission } from "@/lib/permissions/server";

type Rel<T> = T | T[] | null;
type Paciente = {
  nome_completo: string | null;
  nome_social: string | null;
  ra: string | null;
  numero_registro: number | null;
};
type Atendimento = {
  id: string;
  numero_atendimento: string | number | null;
  tipo_atendimento: string | null;
  origem: string | null;
  data_abertura: string;
};
type AplicacaoSla = {
  id: string;
  atendimento_id: string;
  emergencia_id: string;
  sla_anterior_minutos: number | null;
  sla_aplicado_minutos: number;
  aplicado_em: string;
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

function attendanceLabel(atendimento?: Atendimento) {
  if (!atendimento) return "Atendimento não acessível";
  return `Atend. #${atendimento.numero_atendimento ?? "—"}`;
}

export default async function HistoricoSlaUrgenciaPage({
  params,
  searchParams,
}: {
  params: Promise<{ atendimentoId: string }>;
  searchParams: Promise<{ periodo?: string }>;
}) {
  const { atendimentoId } = await params;
  const sp = await searchParams;
  const { supabase, empresaId, unidadeId } = await requireAnyPermission(["prontuario.visualizar"]);
  if (!empresaId || !unidadeId) return null;

  const { data: atual } = await supabase
    .from("atendimentos")
    .select("id,paciente_id,paciente:pacientes(nome_completo,nome_social,ra,numero_registro)")
    .eq("id", atendimentoId)
    .eq("empresa_id", empresaId)
    .eq("unidade_id", unidadeId)
    .maybeSingle();

  if (!atual) notFound();
  const paciente = one(atual.paciente as Rel<Paciente>);

  let atendimentosQuery = supabase
    .from("atendimentos")
    .select("id,numero_atendimento,tipo_atendimento,origem,data_abertura")
    .eq("empresa_id", empresaId)
    .eq("paciente_id", atual.paciente_id)
    .order("data_abertura", { ascending: false })
    .limit(100);

  const dias = Number(sp.periodo ?? "0");
  if ([30, 90, 180, 365].includes(dias)) {
    atendimentosQuery = atendimentosQuery.gte(
      "data_abertura",
      new Date(Date.now() - dias * 86_400_000).toISOString(),
    );
  }

  const { data: atendimentosData, error: atendimentosError } = await atendimentosQuery;
  const atendimentos = (atendimentosData ?? []) as Atendimento[];
  const atendimentoPorId = new Map(atendimentos.map((item) => [item.id, item]));
  const ids = atendimentos.map((item) => item.id);

  let aplicacoes: AplicacaoSla[] = [];
  let aplicacoesError: { code?: string } | null = null;
  if (ids.length) {
    let query = supabase
      .from("emergencia_sla_aplicacoes")
      .select("id,atendimento_id,emergencia_id,sla_anterior_minutos,sla_aplicado_minutos,aplicado_em")
      .in("atendimento_id", ids)
      .order("aplicado_em", { ascending: false })
      .limit(200);

    if ([30, 90, 180, 365].includes(dias)) {
      query = query.gte("aplicado_em", new Date(Date.now() - dias * 86_400_000).toISOString());
    }

    const result = await query;
    aplicacoes = (result.data ?? []) as AplicacaoSla[];
    aplicacoesError = result.error;
  }

  if (atendimentosError) {
    console.error("[prontuario] carregar episódios para histórico SLA", { code: atendimentosError.code });
  }
  if (aplicacoesError) {
    console.error("[prontuario] carregar aplicações SLA", { code: aplicacoesError.code });
  }

  const episodiosComAplicacao = new Set(aplicacoes.map((item) => item.atendimento_id)).size;
  const substituicoes = aplicacoes.filter(
    (item) => item.sla_anterior_minutos !== null && item.sla_anterior_minutos !== item.sla_aplicado_minutos,
  ).length;
  const ultimaAplicacao = aplicacoes[0]?.aplicado_em ?? null;

  return (
    <SectionPage
      eyebrow="Assistencial / Prontuário longitudinal"
      title="SLA da Urgência no histórico"
      description={`${paciente?.nome_social || paciente?.nome_completo || "Paciente"} · Registro #${paciente?.numero_registro ?? "—"} · ${paciente?.ra ?? "—"}`}
    >
      <section className="mb-5 rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
        Esta visão mostra somente <strong>aplicações efetivamente registradas em atendimentos do paciente</strong>. A política institucional vigente, por si só, não é um fato clínico e não aparece aqui até ser aplicada explicitamente a um episódio.
      </section>

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <Filtro href={`/prontuario/${atendimentoId}/historico/sla`} ativo={!dias}>Todo o histórico</Filtro>
          <Filtro href={`/prontuario/${atendimentoId}/historico/sla?periodo=30`} ativo={dias === 30}>30 dias</Filtro>
          <Filtro href={`/prontuario/${atendimentoId}/historico/sla?periodo=90`} ativo={dias === 90}>90 dias</Filtro>
          <Filtro href={`/prontuario/${atendimentoId}/historico/sla?periodo=180`} ativo={dias === 180}>6 meses</Filtro>
          <Filtro href={`/prontuario/${atendimentoId}/historico/sla?periodo=365`} ativo={dias === 365}>1 ano</Filtro>
        </div>
        <Link
          className="rounded-lg border px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          href={`/prontuario/${atendimentoId}/historico` as Route}
        >
          Voltar ao histórico clínico
        </Link>
      </div>

      <section className="grid gap-3 sm:grid-cols-3">
        <Kpi label="Aplicações registradas" value={aplicacoes.length} icon={<Clock3 className="size-5 text-brand-600" />} />
        <Kpi label="Episódios com SLA aplicado" value={episodiosComAplicacao} icon={<History className="size-5 text-violet-600" />} />
        <Kpi label="Mudanças de snapshot" value={substituicoes} icon={<RefreshCcw className="size-5 text-amber-600" />} />
      </section>

      <section className="mt-5 rounded-xl border bg-white">
        <div className="border-b px-5 py-4">
          <h2 className="font-semibold text-slate-950">Linha factual de aplicações</h2>
          <p className="mt-1 text-sm text-slate-500">Última aplicação acessível: {dateTime(ultimaAplicacao)}.</p>
        </div>

        {atendimentosError || aplicacoesError ? (
          <div className="m-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
            Parte do histórico não pôde ser carregada. Nenhum dado foi substituído por valor estimado.
          </div>
        ) : null}

        {aplicacoes.length ? (
          <div className="divide-y">
            {aplicacoes.map((aplicacao) => {
              const atendimento = atendimentoPorId.get(aplicacao.atendimento_id);
              const mudou = aplicacao.sla_anterior_minutos !== null
                && aplicacao.sla_anterior_minutos !== aplicacao.sla_aplicado_minutos;
              return (
                <article key={aplicacao.id} className="flex flex-col gap-3 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold text-slate-950">{attendanceLabel(atendimento)}</h3>
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                        SLA aplicado: {aplicacao.sla_aplicado_minutos} min
                      </span>
                      {mudou ? (
                        <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-900">
                          Snapshot anterior: {aplicacao.sla_anterior_minutos} min
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-sm text-slate-600">
                      Aplicado em {dateTime(aplicacao.aplicado_em)} · {atendimento?.tipo_atendimento ?? "tipo não informado"} · origem {atendimento?.origem ?? "não informada"}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Registro factual de aplicação do parâmetro ao episódio. Não representa, isoladamente, cumprimento de protocolo ou desfecho clínico.
                    </p>
                  </div>
                  <Link
                    className="rounded-lg border px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                    href={`/prontuario/${aplicacao.atendimento_id}` as Route}
                  >
                    Abrir episódio
                  </Link>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="px-5 py-10 text-center text-sm text-slate-500">
            Nenhuma aplicação real de SLA da Urgência foi registrada nos episódios acessíveis deste paciente.
          </div>
        )}
      </section>
    </SectionPage>
  );
}

function Filtro({ href, ativo, children }: { href: string; ativo: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href as Route}
      className={`rounded-lg border px-3 py-2 text-sm font-semibold ${ativo ? "border-brand-700 bg-brand-50 text-brand-800" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}
    >
      {children}
    </Link>
  );
}

function Kpi({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-slate-500">{label}</p>
        {icon}
      </div>
      <p className="mt-1 text-2xl font-semibold text-slate-950">{value}</p>
    </div>
  );
}
