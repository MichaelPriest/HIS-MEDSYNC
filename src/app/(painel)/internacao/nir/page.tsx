import Link from "next/link";
import type { Route } from "next";
import { AlertTriangle, BedDouble, Clock3, DoorOpen, HeartPulse, RefreshCw } from "lucide-react";
import { SectionPage } from "@/components/painel/section-page";
import { requireAnyPermission } from "@/lib/permissions/server";
import { alocarLeitoNir } from "@/modules/internacao/nir-actions";

type Rel<T> = T | T[] | null;
type Patient = { nome_completo: string | null; ra: string | null; numero_registro: number | null };
type Encounter = { numero_atendimento: string | number | null; paciente: Rel<Patient> };
type Admission = {
  id: string;
  atendimento_id: string;
  setor: string | null;
  acomodacao: string | null;
  motivo: string | null;
  previsao_alta: string | null;
  data_internacao: string;
  status: string;
  atendimento: Rel<Encounter>;
};
type Bed = { id: string; setor: string; quarto: string | null; codigo: string; acomodacao: string | null; isolamento_capaz: boolean | null };
type Emergency = { atendimento_id: string; classificacao_risco: string | null; status: string; reavaliacao_em: string | null };
type Triage = { atendimento_id: string; classificacao_risco: string | null; updated_at: string };

function one<T>(value: Rel<T>): T | null { return Array.isArray(value) ? value[0] ?? null : value; }
const riskWeight: Record<string, number> = { vermelho: 0, laranja: 1, amarelo: 2, verde: 3, azul: 4 };
const riskStyle: Record<string, string> = {
  vermelho: "bg-rose-100 text-rose-800",
  laranja: "bg-orange-100 text-orange-800",
  amarelo: "bg-amber-100 text-amber-800",
  verde: "bg-emerald-100 text-emerald-800",
  azul: "bg-blue-100 text-blue-800",
};

export default async function NirPage({ searchParams }: { searchParams: Promise<{ sucesso?: string; erro?: string }> }) {
  const sp = await searchParams;
  const { supabase, empresaId, unidadeId } = await requireAnyPermission([
    "internacao.visualizar",
    "internacao.movimentar",
    "internacao.gerenciar",
  ]);
  if (!unidadeId) return null;

  const [waitReq, bedsReq, emergencyReq, triageReq, hygieneReq] = await Promise.all([
    supabase
      .from("internacoes")
      .select("id,atendimento_id,setor,acomodacao,motivo,previsao_alta,data_internacao,status,atendimento:atendimentos(numero_atendimento,paciente:pacientes(nome_completo,ra,numero_registro))")
      .eq("empresa_id", empresaId)
      .eq("unidade_id", unidadeId)
      .eq("status", "aguardando_leito")
      .order("data_internacao", { ascending: true })
      .limit(300),
    supabase
      .from("leitos")
      .select("id,setor,quarto,codigo,acomodacao,isolamento_capaz")
      .eq("empresa_id", empresaId)
      .eq("unidade_id", unidadeId)
      .eq("ativo", true)
      .eq("status", "livre")
      .order("setor")
      .order("codigo")
      .limit(500),
    supabase
      .from("emergencia_registros")
      .select("atendimento_id,classificacao_risco,status,reavaliacao_em")
      .eq("empresa_id", empresaId)
      .eq("unidade_id", unidadeId)
      .neq("status", "encerrado")
      .order("created_at", { ascending: false })
      .limit(500),
    supabase
      .from("triagens")
      .select("atendimento_id,classificacao_risco,updated_at")
      .eq("empresa_id", empresaId)
      .eq("unidade_id", unidadeId)
      .order("updated_at", { ascending: false })
      .limit(1000),
    supabase
      .from("leitos")
      .select("id")
      .eq("empresa_id", empresaId)
      .eq("unidade_id", unidadeId)
      .eq("ativo", true)
      .eq("status", "higienizacao"),
  ]);

  const admissions = (waitReq.data ?? []) as Admission[];
  const beds = (bedsReq.data ?? []) as Bed[];
  const emergencies = (emergencyReq.data ?? []) as Emergency[];
  const triages = (triageReq.data ?? []) as Triage[];

  const queue = admissions.map((admission) => {
    const emergency = emergencies.find((item) => item.atendimento_id === admission.atendimento_id);
    const triage = triages.find((item) => item.atendimento_id === admission.atendimento_id);
    const risk = String(emergency?.classificacao_risco ?? triage?.classificacao_risco ?? "não classificado").toLowerCase();
    return { admission, risk, weight: riskWeight[risk] ?? 99, emergency };
  }).sort((a, b) => a.weight - b.weight || new Date(a.admission.data_internacao).getTime() - new Date(b.admission.data_internacao).getTime());

  const highRisk = queue.filter((item) => item.weight <= 1).length;
  const oldest = queue[0]?.admission.data_internacao ?? null;
  const hygieneCount = hygieneReq.data?.length ?? 0;

  return (
    <SectionPage
      eyebrow="Assistencial / Internação"
      title="NIR · Gestão de Leitos"
      description="Fila de admissão, prioridade clínica e alocação de leitos conectadas ao mesmo atendimento e prontuário."
      actions={<Link href="/internacao" className="ui-button-secondary"><BedDouble className="size-4" />Mapa de leitos</Link>}
    >
      {sp.sucesso ? <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">Operação concluída: {sp.sucesso.replaceAll("-", " ")}.</div> : null}
      {sp.erro ? <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">Não foi possível concluir: {sp.erro.replaceAll("-", " ")}.</div> : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Kpi label="Aguardando leito" value={queue.length} icon={<Clock3 className="size-5 text-amber-600" />} />
        <Kpi label="Alta prioridade" value={highRisk} icon={<HeartPulse className="size-5 text-rose-600" />} />
        <Kpi label="Leitos livres" value={beds.length} icon={<DoorOpen className="size-5 text-emerald-600" />} />
        <Kpi label="Em higienização" value={hygieneCount} icon={<RefreshCw className="size-5 text-brand-600" />} />
        <div className="his-kpi"><p className="text-xs font-black uppercase tracking-wider text-slate-400">Espera mais antiga</p><p className="mt-3 text-sm font-black text-brand-950">{oldest ? new Date(oldest).toLocaleString("pt-BR") : "Sem espera"}</p></div>
      </section>

      <section className="mt-6">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-black text-slate-950">Fila de admissão</h2><p className="text-sm text-slate-500">Prioriza risco da urgência/triagem e, depois, tempo de espera.</p></div><Link href="/internacao/nir" className="ui-button-secondary"><RefreshCw className="size-4" />Atualizar</Link></div>
        <div className="space-y-3">
          {queue.length ? queue.map(({ admission, risk, emergency }) => {
            const encounter = one(admission.atendimento);
            const patient = one(encounter?.paciente ?? null);
            const waitMinutes = Math.max(0, Math.floor((Date.now() - new Date(admission.data_internacao).getTime()) / 60000));
            const prontuarioHref = `/prontuario/${admission.atendimento_id}` as Route;
            const urgencyHref = `/assistencial/urgencia?atendimento=${admission.atendimento_id}` as Route;
            const compatibleBeds = beds.filter((bed) => !admission.acomodacao || !bed.acomodacao || bed.acomodacao === admission.acomodacao);
            return <article key={admission.id} className="ui-card p-4 sm:p-5">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-start">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2"><span className={`rounded-full px-2.5 py-1 text-xs font-black capitalize ${riskStyle[risk] ?? "bg-slate-100 text-slate-700"}`}>{risk}</span>{waitMinutes >= 120 ? <span className="rounded-full bg-rose-50 px-2.5 py-1 text-xs font-black text-rose-700"><AlertTriangle className="mr-1 inline size-3" />{waitMinutes} min de espera</span> : <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">{waitMinutes} min de espera</span>}<span className="text-xs font-semibold text-slate-400">Solicitado {new Date(admission.data_internacao).toLocaleString("pt-BR")}</span></div>
                  <h3 className="mt-2 truncate text-base font-black text-slate-950">{patient?.nome_completo ?? "Paciente"}</h3>
                  <p className="mt-1 text-xs text-slate-500">Atend. #{encounter?.numero_atendimento ?? "—"} · RA {patient?.ra ?? "—"} · Registro #{patient?.numero_registro ?? "—"}</p>
                  <div className="mt-3 grid gap-2 sm:grid-cols-3"><Mini label="Setor solicitado" value={admission.setor ?? "—"} /><Mini label="Acomodação" value={admission.acomodacao ?? "—"} /><Mini label="Motivo" value={admission.motivo ?? "—"} /></div>
                  {emergency?.reavaliacao_em ? <p className="mt-3 text-xs font-semibold text-amber-700">Próxima reavaliação da urgência: {new Date(emergency.reavaliacao_em).toLocaleString("pt-BR")}</p> : null}
                  <div className="mt-3 flex flex-wrap gap-2"><Link href={prontuarioHref} className="ui-button-secondary">Prontuário</Link><Link href={urgencyHref} className="ui-button-secondary">Urgência</Link></div>
                </div>

                <form action={alocarLeitoNir} className="w-full rounded-xl border border-slate-200 bg-slate-50 p-4 xl:max-w-xl">
                  <input type="hidden" name="internacao_id" value={admission.id} />
                  <p className="text-xs font-black uppercase tracking-wider text-slate-500">Alocar leito</p>
                  <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                    <select name="leito_id" required defaultValue="" className="ui-input">
                      <option value="">Selecione leito livre...</option>
                      {compatibleBeds.map((bed) => <option key={bed.id} value={bed.id}>{bed.setor} · {bed.quarto ? `${bed.quarto} · ` : ""}{bed.codigo}{bed.acomodacao ? ` · ${bed.acomodacao}` : ""}{bed.isolamento_capaz ? " · isolamento" : ""}</option>)}
                    </select>
                    <input name="motivo" className="ui-input" placeholder="Motivo / observação do NIR" />
                    <button className="ui-button-primary">Alocar</button>
                  </div>
                  {!compatibleBeds.length ? <p className="mt-2 text-xs font-semibold text-rose-600">Nenhum leito livre compatível com a acomodação informada. Revise o mapa de leitos.</p> : <p className="mt-2 text-xs text-slate-400">{compatibleBeds.length} leito(s) compatível(is) disponível(is) neste momento.</p>}
                </form>
              </div>
            </article>;
          }) : <div className="ui-card p-10 text-center"><BedDouble className="mx-auto size-9 text-slate-300" /><p className="mt-3 font-semibold text-slate-700">Nenhum paciente aguardando leito.</p><p className="mt-1 text-sm text-slate-500">Novas admissões sem leito aparecerão automaticamente aqui.</p></div>}
        </div>
      </section>
    </SectionPage>
  );
}

function Kpi({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) { return <div className="his-kpi"><div className="flex items-center justify-between"><p className="text-xs font-black uppercase tracking-wider text-slate-400">{label}</p>{icon}</div><p className="mt-2 text-3xl font-black text-brand-950">{value}</p></div>; }
function Mini({ label, value }: { label: string; value: string }) { return <div className="rounded-lg bg-slate-50 px-3 py-2"><p className="text-[10px] font-black uppercase tracking-wider text-slate-400">{label}</p><p className="mt-0.5 line-clamp-2 text-xs font-semibold capitalize text-slate-700">{value}</p></div>; }
