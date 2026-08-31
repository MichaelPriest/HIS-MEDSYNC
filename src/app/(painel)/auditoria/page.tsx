import { CheckCircle2, RefreshCw, ShieldAlert, ShieldCheck, Sparkles } from "lucide-react";
import { SectionPage } from "@/components/painel/section-page";
import { createClient } from "@/lib/supabase/server";
import {
  executarAuditoriaAutomatica,
  reabrirPendenciaAuditoria,
  resolverPendenciaAuditoria,
} from "@/modules/auditoria/actions";
import {
  adicionarPendenciaAuditoria,
  iniciarAuditoria,
  liberarAuditoria,
} from "@/modules/corporativo/actions";

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

type PacienteRow = { nome_completo: string | null; ra: string | null; numero_registro: string | null };
type AtendimentoRow = { numero_atendimento: number | string | null; paciente: PacienteRow | PacienteRow[] | null };
type ContaRow = { id: string; valor_bruto: number | null; valor_liquido: number | null; status: string | null };
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

export default async function AuditoriaPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string; sucesso?: string; gerados?: string }>;
}) {
  const qs = await searchParams;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("auditoria_contas")
    .select(
      "id,status,iniciado_em,finalizado_em,observacoes,atendimento:atendimentos(numero_atendimento,paciente:pacientes(nome_completo,ra,numero_registro)),conta:contas_faturamento!auditoria_contas_conta_id_fkey(id,valor_bruto,valor_liquido,status),itens:auditoria_conta_itens(id,codigo,categoria,severidade,descricao,origem,automatizada,resolvida,resolucao,ultima_verificacao_em)",
    )
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    console.error("[auditoria] falha ao carregar contas", { code: error.code, message: error.message });
  }

  const auditorias = (data ?? []) as unknown as AuditoriaRow[];
  const abertas = auditorias.filter((audit) => audit.status !== "liberada");
  const pendenciasAbertas = auditorias.flatMap((audit) => audit.itens ?? []).filter((item) => !item.resolvida);
  const bloqueios = pendenciasAbertas.filter((item) => item.severidade === "erro" || item.severidade === "bloqueio");
  const prontas = abertas.filter((audit) =>
    !(audit.itens ?? []).some(
      (item) => !item.resolvida && (item.severidade === "erro" || item.severidade === "bloqueio"),
    ),
  ).length;

  return (
    <SectionPage
      eyebrow="Receita / Auditoria"
      title="Auditoria de Contas"
      description="Varredura automática pós-alta, tratamento de pendências e liberação controlada para Contas Médicas."
    >
      {qs.sucesso ? (
        <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
          Operação concluída{qs.gerados ? ` · ${qs.gerados} pendência(s) identificada(s)` : ""}.
        </div>
      ) : null}
      {qs.erro ? (
        <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
          Operação bloqueada: {decodeURIComponent(qs.erro)}.
        </div>
      ) : null}
      {error ? (
        <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
          Não foi possível carregar a fila de Auditoria. Atualize a página; se persistir, informe o código {error.code} ao suporte.
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
            const impeditivas = abertasDaConta.filter(
              (item) => item.severidade === "erro" || item.severidade === "bloqueio",
            );
            const liberada = audit.status === "liberada";

            return (
              <section key={audit.id} className="ui-card overflow-hidden">
                <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 p-5">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-black text-slate-900">{paciente?.nome_completo ?? "Paciente"}</h2>
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
                    </div>
                    <p className="mt-1 text-sm text-slate-500">
                      Atendimento #{atendimento?.numero_atendimento ?? "—"} · Registro #{paciente?.numero_registro ?? "—"} · {paciente?.ra ?? "—"}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      Conta bruta R$ {money(conta?.valor_bruto)} · líquida R$ {money(conta?.valor_liquido)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {impeditivas.length ? <ShieldAlert className="size-6 text-rose-600" /> : <ShieldCheck className="size-6 text-emerald-600" />}
                  </div>
                </div>

                <div className="p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="font-black text-slate-900">Pendências e críticas</h3>
                      <p className="text-sm text-slate-500">O motor é executado novamente antes de cada liberação.</p>
                    </div>
                    {!liberada ? (
                      <form action={executarAuditoriaAutomatica}>
                        <input type="hidden" name="auditoria_id" value={audit.id} />
                        <button className="ui-button-secondary">
                          <Sparkles className="size-4" />
                          Executar auditoria automática
                        </button>
                      </form>
                    ) : null}
                  </div>

                  <div className="mt-4 space-y-3">
                    {itens.length ? (
                      itens.map((item) => {
                        const critica = item.severidade === "bloqueio" || item.severidade === "erro";
                        return (
                          <article
                            key={item.id}
                            className={`rounded-xl border p-4 ${
                              item.resolvida
                                ? "border-emerald-200 bg-emerald-50"
                                : critica
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
                                  {item.codigo ? <span className="rounded-md bg-white/70 px-2 py-0.5">{item.codigo}</span> : null}
                                  <span className="rounded-md bg-white/70 px-2 py-0.5">
                                    {item.automatizada ? "Automática" : "Manual"}
                                  </span>
                                </div>
                                <p className="mt-1 text-sm font-semibold text-slate-800">{item.descricao}</p>
                                {item.resolucao ? <p className="mt-2 text-xs text-emerald-800">Resolução: {item.resolucao}</p> : null}
                              </div>
                              {item.resolvida ? <CheckCircle2 className="size-5 text-emerald-600" /> : null}
                            </div>

                            {!liberada ? (
                              item.resolvida ? (
                                <form action={reabrirPendenciaAuditoria} className="mt-3">
                                  <input type="hidden" name="item_id" value={item.id} />
                                  <button className="ui-button-secondary">
                                    <RefreshCw className="size-4" />
                                    Reabrir pendência
                                  </button>
                                </form>
                              ) : (
                                <form action={resolverPendenciaAuditoria} className="mt-3 flex flex-col gap-2 sm:flex-row">
                                  <input type="hidden" name="item_id" value={item.id} />
                                  <input name="resolucao" className="ui-input flex-1" placeholder="Descreva como a pendência foi tratada" />
                                  <button className="ui-button-secondary">Marcar como resolvida</button>
                                </form>
                              )
                            ) : null}
                          </article>
                        );
                      })
                    ) : (
                      <p className="rounded-xl bg-emerald-50 p-4 text-sm font-semibold text-emerald-700">Sem pendências registradas.</p>
                    )}
                  </div>

                  {!liberada ? (
                    <div className="mt-5 grid gap-3 xl:grid-cols-3">
                      <form action={iniciarAuditoria}>
                        <input type="hidden" name="auditoria_id" value={audit.id} />
                        <button className="ui-button-secondary w-full">Iniciar auditoria</button>
                      </form>

                      <form action={adicionarPendenciaAuditoria} className="grid gap-2 rounded-xl border border-slate-200 p-3">
                        <input type="hidden" name="auditoria_id" value={audit.id} />
                        <div className="grid grid-cols-2 gap-2">
                          <select name="severidade" className="ui-input">
                            <option value="alerta">Alerta</option>
                            <option value="erro">Erro</option>
                            <option value="bloqueio">Bloqueio</option>
                          </select>
                          <input name="categoria" placeholder="Categoria" className="ui-input" />
                        </div>
                        <input name="descricao" required placeholder="Descreva a pendência manual" className="ui-input" />
                        <button className="ui-button-secondary">Adicionar pendência</button>
                      </form>

                      <form action={liberarAuditoria} className="grid gap-2 rounded-xl border border-brand-100 bg-brand-50/50 p-3">
                        <input type="hidden" name="auditoria_id" value={audit.id} />
                        <textarea name="observacoes" rows={2} className="ui-input" placeholder="Observações finais" />
                        <button className="ui-button-primary" disabled={impeditivas.length > 0}>
                          Liberar para Contas Médicas
                        </button>
                        {impeditivas.length ? (
                          <p className="text-xs font-semibold text-rose-700">Resolva {impeditivas.length} pendência(s) impeditiva(s) antes da liberação.</p>
                        ) : null}
                      </form>
                    </div>
                  ) : null}
                </div>
              </section>
            );
          })
        ) : error ? null : (
          <div className="ui-card p-8 text-center text-slate-500">Nenhuma conta aguardando auditoria.</div>
        )}
      </div>
    </SectionPage>
  );
}

function Kpi({ label, value, tone = "brand" }: { label: string; value: number; tone?: "brand" | "amber" | "rose" | "emerald" }) {
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
