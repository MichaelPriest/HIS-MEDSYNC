import Link from "next/link";
import { requirePermission } from "@/lib/permissions/server";
import {
  desativarConfiguracaoSlaEmergencia,
  salvarConfiguracaoSlaEmergencia,
} from "@/modules/urgencia/actions";

type ConfiguracaoSla = {
  id: string;
  classificacao_risco: string;
  sla_minutos: number;
  referencia_institucional: string | null;
  observacoes: string | null;
  ativo: boolean;
  vigente_desde: string;
  vigente_ate: string | null;
};

const RISCOS = [
  { codigo: "vermelho", label: "Vermelho" },
  { codigo: "laranja", label: "Laranja" },
  { codigo: "amarelo", label: "Amarelo" },
  { codigo: "verde", label: "Verde" },
  { codigo: "azul", label: "Azul" },
] as const;

export const dynamic = "force-dynamic";
export const revalidate = 0;

function dateTime(value?: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(value));
}

export default async function ConfiguracoesSlaUrgenciaPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string; sucesso?: string }>;
}) {
  const params = await searchParams;
  const { supabase, empresaId, unidadeId } = await requirePermission("emergencia.gerenciar");

  if (!empresaId || !unidadeId) {
    return <main className="p-6">Selecione uma empresa e unidade para parametrizar o SLA da Urgência.</main>;
  }

  const { data, error } = await supabase
    .from("emergencia_sla_configuracoes")
    .select("id,classificacao_risco,sla_minutos,referencia_institucional,observacoes,ativo,vigente_desde,vigente_ate")
    .eq("empresa_id", empresaId)
    .eq("unidade_id", unidadeId)
    .order("vigente_desde", { ascending: false })
    .limit(100);

  if (error) {
    console.error("[urgencia] carregar configurações SLA", { code: error.code });
  }

  const configuracoes = (data ?? []) as ConfiguracaoSla[];
  const ativas = new Map(
    configuracoes.filter((item) => item.ativo).map((item) => [item.classificacao_risco, item]),
  );

  return (
    <main className="mx-auto max-w-7xl space-y-6 p-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-slate-500">Urgência / Emergência</p>
          <h1 className="text-2xl font-semibold text-slate-950">Parâmetros institucionais de SLA</h1>
          <p className="mt-1 max-w-3xl text-sm text-slate-600">
            Os tempos são definidos pela própria instituição e por unidade. O sistema não preenche, sugere nem grava automaticamente tempos de protocolos clínicos externos.
          </p>
        </div>
        <Link className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-slate-50" href="/assistencial/urgencia/sla">
          Voltar para SLA e reavaliações
        </Link>
      </header>

      {params.sucesso ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
          Configuração institucional atualizada e nova vigência registrada.
        </div>
      ) : null}
      {params.erro ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
          Não foi possível concluir a operação: {params.erro}.
        </div>
      ) : null}
      {error ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
          Falha ao carregar as configurações institucionais.
        </div>
      ) : null}

      <section className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
        <strong>Sem valores presumidos.</strong> Classificações sem parametrização permanecem como “não configurado”. Salvar uma nova versão não altera retrospectivamente atendimentos já registrados.
      </section>

      <section className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {RISCOS.map((risco) => {
          const atual = ativas.get(risco.codigo);
          return (
            <article key={risco.codigo} className="rounded-xl border bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Classificação</p>
                  <h2 className="mt-1 text-lg font-semibold text-slate-950">{risco.label}</h2>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${atual ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"}`}>
                  {atual ? `${atual.sla_minutos} min` : "Não configurado"}
                </span>
              </div>

              {atual ? (
                <div className="mt-4 rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
                  <p>Vigente desde: {dateTime(atual.vigente_desde)}</p>
                  <p className="mt-1">Referência: {atual.referencia_institucional ?? "não informada"}</p>
                  {atual.observacoes ? <p className="mt-1">Observação: {atual.observacoes}</p> : null}
                </div>
              ) : null}

              <form action={salvarConfiguracaoSlaEmergencia} className="mt-4 space-y-3 border-t pt-4">
                <input type="hidden" name="classificacao_risco" value={risco.codigo} />
                <label className="block text-sm font-medium text-slate-700">
                  SLA institucional (minutos)
                  <input
                    className="mt-1 w-full rounded-lg border px-3 py-2"
                    type="number"
                    min="1"
                    name="sla_minutos"
                    required
                    placeholder="Informe o valor aprovado"
                  />
                </label>
                <label className="block text-sm font-medium text-slate-700">
                  Referência institucional
                  <input
                    className="mt-1 w-full rounded-lg border px-3 py-2"
                    name="referencia_institucional"
                    placeholder="Documento, política ou versão, se aplicável"
                  />
                </label>
                <label className="block text-sm font-medium text-slate-700">
                  Observações
                  <textarea
                    className="mt-1 min-h-20 w-full rounded-lg border px-3 py-2"
                    name="observacoes"
                    placeholder="Contexto institucional opcional"
                  />
                </label>
                <button className="w-full rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800" type="submit">
                  Salvar nova versão
                </button>
              </form>

              {atual ? (
                <form action={desativarConfiguracaoSlaEmergencia} className="mt-2">
                  <input type="hidden" name="configuracao_id" value={atual.id} />
                  <button className="w-full rounded-lg border px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50" type="submit">
                    Encerrar vigência sem substituição
                  </button>
                </form>
              ) : null}
            </article>
          );
        })}
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-950">Histórico de vigências</h2>
          <p className="text-sm text-slate-500">Alterações anteriores são preservadas; não há exclusão operacional de versões.</p>
        </div>
        <div className="overflow-x-auto rounded-xl border bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Classificação</th>
                <th className="px-4 py-3">SLA</th>
                <th className="px-4 py-3">Início</th>
                <th className="px-4 py-3">Fim</th>
                <th className="px-4 py-3">Referência</th>
                <th className="px-4 py-3">Situação</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {configuracoes.length ? configuracoes.map((item) => (
                <tr key={item.id}>
                  <td className="px-4 py-3 font-medium capitalize text-slate-900">{item.classificacao_risco}</td>
                  <td className="px-4 py-3">{item.sla_minutos} min</td>
                  <td className="px-4 py-3">{dateTime(item.vigente_desde)}</td>
                  <td className="px-4 py-3">{dateTime(item.vigente_ate)}</td>
                  <td className="px-4 py-3">{item.referencia_institucional ?? "—"}</td>
                  <td className="px-4 py-3">{item.ativo ? "Vigente" : "Encerrada"}</td>
                </tr>
              )) : (
                <tr><td className="px-4 py-6 text-center text-slate-500" colSpan={6}>Nenhum SLA institucional foi configurado para esta unidade.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
