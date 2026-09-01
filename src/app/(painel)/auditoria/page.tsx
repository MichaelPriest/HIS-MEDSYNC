import { CheckCircle2, ShieldAlert, ShieldCheck } from "lucide-react";
import {
  AdicionarPendenciaForm,
  ExecutarAuditoriaButton,
  IniciarAuditoriaButton,
  LiberarAuditoriaForm,
  ReabrirPendenciaButton,
  ResolverPendenciaForm,
} from "@/components/auditoria/auditoria-background-actions";
import { SectionPage } from "@/components/painel/section-page";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function one<T>(value: T | T[] | null) {
  return Array.isArray(value) ? value[0] ?? null : value;
}

function money(value: number | string | null | undefined) {
  return Number(value ?? 0).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function dateTime(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleString("pt-BR");
}

type PacienteRow = {
  nome_completo: string | null;
  ra: string | null;
  numero_registro: string | null;
};
type AtendimentoRow = {
  numero_atendimento: number | string | null;
  paciente: PacienteRow | PacienteRow[] | null;
};
type ContaRow = {
  id: string;
  valor_bruto: number | null;
  valor_liquido: number | null;
  status: string | null;
};
type ItemAuditoriaRow = {
  id: string;
  codigo: string | null;
  categoria: string;
  severidade: string;
  descricao: string;
  origem: string | null;
  automatizada: boolean;
  resolvida: boolean;
  resolucao: string | null;
  resolvida_em: string | null;
  ultima_verificacao_em: string | null;
};
type AuditoriaRow = {
  id: string;
  status: string;
  iniciado_em: string | null;
  finalizado_em: string | null;
  observacoes: string | null;
  atendimento: AtendimentoRow | AtendimentoRow[] | null;
  conta: ContaRow | ContaRow[] | null;
  itens: ItemAuditoriaRow[] | null;
};

type ResolvedGroup = {
  latest: ItemAuditoriaRow;
  count: number;
};

function resolvedHistoryGroups(items: ItemAuditoriaRow[]) {
  const groups = new Map<string, ResolvedGroup>();

  for (const item of items) {
    if (!item.resolvida) continue;
    const key = [
      item.automatizada ? "auto" : "manual",
      item.codigo ?? "",
      item.categoria,
      item.severidade,
      item.descricao,
    ].join("|");
    const current = groups.get(key);
    const itemWhen = item.resolvida_em ?? item.ultima_verificacao_em ?? "";
    const currentWhen =
      current?.latest.resolvida_em ?? current?.latest.ultima_verificacao_em ?? "";

    if (!current) {
      groups.set(key, { latest: item, count: 1 });
      continue;
    }

    groups.set(key, {
      latest: itemWhen >= currentWhen ? item : current.latest,
      count: current.count + 1,
    });
  }

  return [...groups.values()].sort((a, b) => {
    const aWhen = a.latest.resolvida_em ?? a.latest.ultima_verificacao_em ?? "";
    const bWhen = b.latest.resolvida_em ?? b.latest.ultima_verificacao_em ?? "";
    return bWhen.localeCompare(aWhen);
  });
}

export default async function AuditoriaPage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("auditoria_contas")
    .select(
      "id,status,iniciado_em,finalizado_em,observacoes,atendimento:atendimentos(numero_atendimento,paciente:pacientes(nome_completo,ra,numero_registro)),conta:contas_faturamento!auditoria_contas_conta_id_fkey(id,valor_bruto,valor_liquido,status),itens:auditoria_conta_itens(id,codigo,categoria,severidade,descricao,origem,automatizada,resolvida,resolucao,resolvida_em,ultima_verificacao_em)",
    )
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    console.error("[auditoria] falha ao carregar contas", {
      code: error.code,
      message: error.message,
    });
  }

  const auditorias = (data ?? []) as unknown as AuditoriaRow[];
  const abertas = auditorias.filter((audit) => audit.status !== "liberada");
  const pendenciasAbertas = auditorias
    .flatMap((audit) => audit.itens ?? [])
    .filter((item) => !item.resolvida);
  const bloqueios = pendenciasAbertas.filter(
    (item) => item.severidade === "erro" || item.severidade === "bloqueio",
  );
  const prontas = abertas.filter(
    (audit) =>
      !(audit.itens ?? []).some(
        (item) =>
          !item.resolvida &&
          (item.severidade === "erro" || item.severidade === "bloqueio"),
      ),
  ).length;

  return (
    <SectionPage
      eyebrow="Receita / Auditoria"
      title="Auditoria de Contas"
      description="Varredura automática pós-alta, tratamento de pendências e liberação controlada para Contas Médicas."
    >
      {error ? (
        <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
          Não foi possível carregar a fila de Auditoria. Se persistir, informe o código{" "}
          {error.code} ao suporte.
        </div>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Auditorias abertas" value={abertas.length} />
        <Kpi label="Pendências abertas" value={pendenciasAbertas.length} tone="amber" />
        <Kpi label="Bloqueios / erros" value={bloqueios.length} tone="rose" />
        <Kpi label="Prontas para liberação" value={prontas} tone="emerald" />
      </section>

      <div className="mt-5 space-y-4">
        {auditorias.length ? (
          auditorias.map((audit) => {
            const atendimento = one(audit.atendimento);
            const paciente = atendimento ? one(atendimento.paciente) : null;
            const conta = one(audit.conta);
            const itens = audit.itens ?? [];
            const abertasDaConta = itens.filter((item) => !item.resolvida);
            const historico = resolvedHistoryGroups(itens);
            const historicoRegistros = itens.filter((item) => item.resolvida).length;
            const impeditivas = abertasDaConta.filter(
              (item) =>
                item.severidade === "erro" || item.severidade === "bloqueio",
            );
            const liberada = audit.status === "liberada";

            return (
              <section key={audit.id} className="ui-card overflow-hidden">
                <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 p-5">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-black text-slate-900">
                        {paciente?.nome_completo ?? "Paciente"}
                      </h2>
                      <span
                        className={`rounded-full px-2.5 py-1 text-[11px] font-black uppercase ${
                          liberada
                            ? "bg-emerald-50 text-emerald-700"
                            : impeditivas.length
                              ? "bg-rose-50 text-rose-700"
                              : "bg-brand-50 text-brand-700"
                        }`}
                      >
                        {audit.status.replaceAll("_", " ")}
                      </span>
                      {!liberada && !impeditivas.length ? (
                        <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-black uppercase text-emerald-700">
                          pronta para revalidação
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-sm text-slate-500">
                      Atendimento #{atendimento?.numero_atendimento ?? "—"} · Registro #{paciente?.numero_registro ?? "—"} · {paciente?.ra ?? "—"}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      Conta bruta R$ {money(conta?.valor_bruto)} · líquida R${" "}
                      {money(conta?.valor_liquido)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {impeditivas.length ? (
                      <ShieldAlert className="size-6 text-rose-600" />
                    ) : (
                      <ShieldCheck className="size-6 text-emerald-600" />
                    )}
                  </div>
                </div>

                <div className="p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="font-black text-slate-900">
                        Pendências e críticas atuais
                      </h3>
                      <p className="text-sm text-slate-500">
                        Somente itens abertos aparecem aqui. O histórico resolvido fica
                        separado abaixo.
                      </p>
                    </div>
                    {!liberada ? (
                      <ExecutarAuditoriaButton auditoriaId={audit.id} />
                    ) : null}
                  </div>

                  <div className="mt-4 space-y-3">
                    {abertasDaConta.length ? (
                      abertasDaConta.map((item) => {
                        const critica =
                          item.severidade === "bloqueio" ||
                          item.severidade === "erro";
                        return (
                          <article
                            key={item.id}
                            className={`rounded-xl border p-4 ${
                              critica
                                ? "border-rose-200 bg-rose-50"
                                : "border-amber-200 bg-amber-50"
                            }`}
                          >
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div>
                                <div className="flex flex-wrap items-center gap-2 text-xs font-black uppercase">
                                  <span>{item.severidade}</span>
                                  <span>·</span>
                                  <span>{item.categoria}</span>
                                  {item.codigo ? (
                                    <span className="rounded-md bg-white/70 px-2 py-0.5">
                                      {item.codigo}
                                    </span>
                                  ) : null}
                                  <span className="rounded-md bg-white/70 px-2 py-0.5">
                                    {item.automatizada ? "Automática" : "Manual"}
                                  </span>
                                </div>
                                <p className="mt-1 text-sm font-semibold text-slate-800">
                                  {item.descricao}
                                </p>
                              </div>
                            </div>

                            {!liberada ? (
                              <ResolverPendenciaForm itemId={item.id} />
                            ) : null}
                          </article>
                        );
                      })
                    ) : (
                      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-700">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="size-4" />
                          Sem pendências abertas nesta Auditoria.
                        </div>
                        <p className="mt-1 text-xs font-medium text-emerald-700">
                          A liberação ainda executará o motor novamente no banco.
                        </p>
                      </div>
                    )}
                  </div>

                  {historico.length ? (
                    <details className="mt-4 rounded-xl border border-slate-200 bg-slate-50/70">
                      <summary className="cursor-pointer px-4 py-3 text-sm font-bold text-slate-700">
                        Histórico resolvido · {historicoRegistros} registro(s) em{" "}
                        {historico.length} regra(s)
                      </summary>
                      <div className="space-y-3 border-t border-slate-200 p-4">
                        {historico.map(({ latest, count }) => (
                          <article
                            key={`${latest.automatizada ? "auto" : "manual"}-${latest.codigo ?? latest.id}-${latest.descricao}`}
                            className="rounded-xl border border-emerald-100 bg-white p-3"
                          >
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div>
                                <div className="flex flex-wrap items-center gap-2 text-xs font-black uppercase text-slate-500">
                                  <span>{latest.severidade}</span>
                                  <span>·</span>
                                  <span>{latest.categoria}</span>
                                  {latest.codigo ? (
                                    <span className="rounded-md bg-slate-100 px-2 py-0.5">
                                      {latest.codigo}
                                    </span>
                                  ) : null}
                                  <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-emerald-700">
                                    Resolvida
                                  </span>
                                  <span className="rounded-md bg-slate-100 px-2 py-0.5">
                                    {latest.automatizada ? "Automática" : "Manual"}
                                  </span>
                                  {count > 1 ? (
                                    <span className="rounded-md bg-slate-100 px-2 py-0.5">
                                      {count} verificações históricas
                                    </span>
                                  ) : null}
                                </div>
                                <p className="mt-1 text-sm font-semibold text-slate-700">
                                  {latest.descricao}
                                </p>
                                <p className="mt-1 text-xs text-slate-500">
                                  Última resolução:{" "}
                                  {dateTime(
                                    latest.resolvida_em ??
                                      latest.ultima_verificacao_em,
                                  )}
                                </p>
                                {latest.resolucao ? (
                                  <p className="mt-1 text-xs text-emerald-800">
                                    Resolução: {latest.resolucao}
                                  </p>
                                ) : null}
                              </div>
                            </div>

                            {!liberada && !latest.automatizada ? (
                              <ReabrirPendenciaButton itemId={latest.id} />
                            ) : null}
                          </article>
                        ))}
                      </div>
                    </details>
                  ) : null}

                  {!liberada ? (
                    <div className="mt-5 grid gap-3 xl:grid-cols-3">
                      <IniciarAuditoriaButton auditoriaId={audit.id} />
                      <AdicionarPendenciaForm auditoriaId={audit.id} />
                      <LiberarAuditoriaForm
                        auditoriaId={audit.id}
                        impeditivasNaUltimaVerificacao={impeditivas.length}
                      />
                    </div>
                  ) : null}
                </div>
              </section>
            );
          })
        ) : error ? null : (
          <div className="ui-card p-8 text-center text-slate-500">
            Nenhuma conta aguardando auditoria.
          </div>
        )}
      </div>
    </SectionPage>
  );
}

function Kpi({
  label,
  value,
  tone = "brand",
}: {
  label: string;
  value: number;
  tone?: "brand" | "amber" | "rose" | "emerald";
}) {
  const toneClass = {
    brand: "text-brand-950",
    amber: "text-amber-700",
    rose: "text-rose-700",
    emerald: "text-emerald-700",
  }[tone];

  return (
    <div className="his-kpi">
      <p className="text-xs font-black uppercase text-slate-400">{label}</p>
      <p className={`mt-2 text-3xl font-black ${toneClass}`}>{value}</p>
    </div>
  );
}
