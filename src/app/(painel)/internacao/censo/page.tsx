import Link from "next/link";
import { AlertTriangle, CalendarDays, CheckCircle2, Clock3, Hospital } from "lucide-react";
import { SectionPage } from "@/components/painel/section-page";
import { getAssistencialContext } from "@/modules/assistencial/context";

type Rel<T> = T | T[] | null;
type Paciente = { nome_completo: string | null; ra: string | null };
type Atendimento = { numero_atendimento: string | number | null; paciente: Rel<Paciente> };
type Internacao = {
  id: string;
  atendimento_id: string;
  leito_id: string | null;
  setor: string;
  quarto: string | null;
  leito: string | null;
  acomodacao: string | null;
  status: string;
  data_internacao: string;
  atendimento: Rel<Atendimento>;
};
type Diaria = {
  id: string;
  internacao_id: string;
  atendimento_id: string;
  data_referencia: string;
  acomodacao: string | null;
  setor: string | null;
  leito_id: string | null;
  status: string;
  origem: string;
  gerada_automaticamente: boolean;
  censo_referencia_em: string | null;
};
type Pendencia = { origem_id: string; regra_chave: string; titulo: string; severidade: string };

const one = <T,>(value: Rel<T>): T | null => Array.isArray(value) ? value[0] ?? null : value;
const localDate = () => new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Sao_Paulo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).format(new Date());
const fmtDateTime = (value?: string | null) => value
  ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(value))
  : "—";

export default async function CensoInternacaoPage() {
  const { supabase, empresaId, unidadeId } = await getAssistencialContext();
  if (!unidadeId) return null;
  const hoje = localDate();

  const [internacoesReq, diariasReq, pendenciasReq] = await Promise.all([
    supabase
      .from("internacoes")
      .select("id,atendimento_id,leito_id,setor,quarto,leito,acomodacao,status,data_internacao,atendimento:atendimentos(numero_atendimento,paciente:pacientes(nome_completo,ra))")
      .eq("empresa_id", empresaId)
      .eq("unidade_id", unidadeId)
      .in("status", ["internado", "transferido", "aguardando_leito"])
      .order("data_internacao", { ascending: true }),
    supabase
      .from("internacao_diarias")
      .select("id,internacao_id,atendimento_id,data_referencia,acomodacao,setor,leito_id,status,origem,gerada_automaticamente,censo_referencia_em")
      .eq("empresa_id", empresaId)
      .eq("unidade_id", unidadeId)
      .eq("data_referencia", hoje),
    supabase
      .from("integracao_pendencias")
      .select("origem_id,regra_chave,titulo,severidade")
      .eq("empresa_id", empresaId)
      .eq("unidade_id", unidadeId)
      .eq("status", "aberta")
      .in("regra_chave", ["internacao_sem_diaria_censo", "diaria_internacao_sem_producao"]),
  ]);

  const internacoes = (internacoesReq.data ?? []) as unknown as Internacao[];
  const diarias = (diariasReq.data ?? []) as Diaria[];
  const pendencias = (pendenciasReq.data ?? []) as Pendencia[];
  const diariaPorInternacao = new Map(diarias.map((item) => [item.internacao_id, item]));
  const pendenciaPorOrigem = new Map(pendencias.map((item) => [item.origem_id, item]));
  const internadosComLeito = internacoes.filter((item) => item.status !== "aguardando_leito" && item.leito_id);
  const registrados = internadosComLeito.filter((item) => diariaPorInternacao.has(item.id)).length;
  const faltantes = internadosComLeito.length - registrados;
  const ultimaSincronizacao = diarias
    .map((item) => item.censo_referencia_em)
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1) ?? null;

  return (
    <SectionPage
      eyebrow="Assistencial / Internação"
      title="Censo de Internação"
      description="Permanência factual por dia e leito. A diária nasce automaticamente da ocupação física e alimenta o Livro de Produção; valor e código faturável continuam sendo resolvidos pelo contrato."
      actions={
        <div className="flex flex-wrap gap-2">
          <Link href="/internacao" className="ui-button-secondary"><Hospital className="size-4" />Painel</Link>
          <Link href="/integracoes" className="ui-button-secondary"><AlertTriangle className="size-4" />Pendências</Link>
        </div>
      }
    >
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Internados com leito" value={internadosComLeito.length} icon={<Hospital className="size-5 text-brand-600" />} />
        <Metric label="Diárias registradas hoje" value={registrados} icon={<CheckCircle2 className="size-5 text-emerald-600" />} />
        <Metric label="Sem diária hoje" value={faltantes} icon={<AlertTriangle className="size-5 text-amber-600" />} />
        <Metric label="Última sincronização" value={fmtDateTime(ultimaSincronizacao)} icon={<Clock3 className="size-5 text-slate-500" />} />
      </section>

      <div className="mt-5 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-800">
        <strong>{new Date(`${hoje}T12:00:00`).toLocaleDateString("pt-BR")}</strong> · O censo possui recuperação automática horária. Transferências no mesmo dia atualizam o mesmo fato diário; não geram uma segunda diária.
      </div>

      <section className="mt-5 his-card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div>
            <h2 className="font-black text-slate-950">Censo atual</h2>
            <p className="mt-1 text-sm text-slate-500">Aguardando leito não gera diária até existir ocupação física. Divergências ficam visíveis na Central de Pendências.</p>
          </div>
          <span className="rounded-xl bg-slate-50 px-3 py-2 text-xs font-bold text-slate-500">{internacoes.length} internação(ões) ativa(s)</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr><th className="px-5 py-3">Paciente</th><th className="px-4 py-3">Leito / setor</th><th className="px-4 py-3">Acomodação</th><th className="px-4 py-3">Diária</th><th className="px-4 py-3">Origem</th><th className="px-5 py-3">Situação</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {internacoes.map((internacao) => {
                const atendimento = one(internacao.atendimento);
                const paciente = one(atendimento?.paciente ?? null);
                const diaria = diariaPorInternacao.get(internacao.id);
                const pendencia = pendenciaPorOrigem.get(internacao.id) ?? (diaria ? pendenciaPorOrigem.get(diaria.id) : undefined);
                return (
                  <tr key={internacao.id} className="bg-white align-middle">
                    <td className="px-5 py-4"><p className="font-black text-slate-950">{paciente?.nome_completo ?? "Paciente"}</p><p className="mt-1 text-xs text-slate-500">Atend. #{atendimento?.numero_atendimento ?? "—"} · RA {paciente?.ra ?? "—"}</p></td>
                    <td className="px-4 py-4"><p className="font-semibold text-slate-800">{internacao.leito ?? "Aguardando leito"}</p><p className="text-xs text-slate-500">{internacao.setor}{internacao.quarto ? ` · Quarto ${internacao.quarto}` : ""}</p></td>
                    <td className="px-4 py-4 text-slate-600">{diaria?.acomodacao ?? internacao.acomodacao ?? "—"}</td>
                    <td className="px-4 py-4">{diaria ? <><p className="font-bold text-slate-800">{diaria.status}</p><p className="text-xs text-slate-500">Censo {fmtDateTime(diaria.censo_referencia_em)}</p></> : <span className="text-slate-400">Não registrada</span>}</td>
                    <td className="px-4 py-4 text-slate-600">{diaria?.gerada_automaticamente ? "Automática" : diaria ? diaria.origem : "—"}</td>
                    <td className="px-5 py-4">{pendencia ? <span title={pendencia.titulo} className="inline-flex rounded-lg bg-amber-50 px-2.5 py-1 text-xs font-black text-amber-700">Requer conciliação</span> : diaria ? <span className="inline-flex rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-black text-emerald-700">Conciliada</span> : internacao.status === "aguardando_leito" ? <span className="inline-flex rounded-lg bg-slate-50 px-2.5 py-1 text-xs font-bold text-slate-500">Aguardando leito</span> : <span className="inline-flex rounded-lg bg-amber-50 px-2.5 py-1 text-xs font-black text-amber-700">Aguardando censo</span>}</td>
                  </tr>
                );
              })}
              {!internacoes.length ? <tr><td colSpan={6} className="px-6 py-14 text-center text-slate-500">Nenhuma internação ativa nesta unidade.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>
    </SectionPage>
  );
}

function Metric({ label, value, icon }: { label: string; value: string | number; icon: React.ReactNode }) {
  return <div className="his-card p-4"><div className="flex items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wide text-slate-400">{label}</p><p className="mt-1 text-2xl font-black text-slate-950">{value}</p></div>{icon}</div></div>;
}
