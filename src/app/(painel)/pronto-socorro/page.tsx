import Link from "next/link";
import type { Route } from "next";
import { Activity, Ambulance, BedDouble, Clock3, FlaskConical, HeartPulse, Pill, ScanLine, Stethoscope } from "lucide-react";
import { AssumePatientBackgroundForm } from "@/components/fila-medica/assume-patient-background-form";
import { SectionPage } from "@/components/painel/section-page";
import { requireAnyPermission } from "@/lib/permissions/server";

type Rel<T> = T | T[] | null;
type Paciente = { nome_completo: string | null; ra: string | null; numero_registro: number | null; data_nascimento: string | null };
type Triagem = { classificacao_risco: string | null; queixa_principal: string | null; dor_escala: number | null; pressao_arterial: string | null; frequencia_cardiaca: number | null; saturacao_o2: number | null; temperatura_c: number | null };
type Encaminhamento = { id: string; status: string; prioridade: string; especialidade: string | null; profissional_id: string | null };
type Atendimento = {
  id: string; numero_atendimento: string | number | null; status: string; data_abertura: string | null; setor_atual: string | null; especialidade_destino: string | null;
  paciente: Rel<Paciente>; triagem: Rel<Triagem>; encaminhamentos: Rel<Encaminhamento>;
};

function one<T>(value: Rel<T>) { return Array.isArray(value) ? value[0] ?? null : value; }
function quando(value: string | null) { return value ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(value)) : "—"; }
const riskOrder: Record<string, number> = { vermelho: 0, laranja: 1, amarelo: 2, verde: 3, azul: 4 };
const riskStyle: Record<string, string> = {
  vermelho: "border-rose-300 bg-rose-50 text-rose-800", laranja: "border-orange-300 bg-orange-50 text-orange-800", amarelo: "border-amber-300 bg-amber-50 text-amber-800", verde: "border-emerald-300 bg-emerald-50 text-emerald-800", azul: "border-blue-300 bg-blue-50 text-blue-800",
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ProntoSocorroPage({ searchParams }: { searchParams: Promise<{ atendimento?: string; sucesso?: string }> }) {
  const sp = await searchParams;
  const { supabase, empresaId, unidadeId } = await requireAnyPermission(["emergencia.visualizar", "prontuario.visualizar"]);
  if (!unidadeId) return null;

  const { data, error } = await supabase.from("atendimentos")
    .select("id,numero_atendimento,status,data_abertura,setor_atual,especialidade_destino,paciente:pacientes(nome_completo,ra,numero_registro,data_nascimento),triagem:triagens(classificacao_risco,queixa_principal,dor_escala,pressao_arterial,frequencia_cardiaca,saturacao_o2,temperatura_c),encaminhamentos:encaminhamentos_assistenciais(id,status,prioridade,especialidade,profissional_id)")
    .eq("empresa_id", empresaId).eq("unidade_id", unidadeId)
    .eq("setor_atual", "pronto_socorro")
    .in("status", ["aberto", "em_espera", "em_atendimento"])
    .order("data_abertura", { ascending: true }).limit(200);

  if (error) console.error("[pronto-socorro] carregar", { code: error.code });
  const atendimentos = ((data ?? []) as Atendimento[]).sort((a, b) => {
    const ra = riskOrder[String(one(a.triagem)?.classificacao_risco ?? "").toLowerCase()] ?? 99;
    const rb = riskOrder[String(one(b.triagem)?.classificacao_risco ?? "").toLowerCase()] ?? 99;
    if (ra !== rb) return ra - rb;
    return new Date(a.data_abertura ?? 0).getTime() - new Date(b.data_abertura ?? 0).getTime();
  });

  const aguardando = atendimentos.filter((a) => a.status === "em_espera").length;
  const emAtendimento = atendimentos.filter((a) => a.status === "em_atendimento").length;
  const criticos = atendimentos.filter((a) => ["vermelho", "laranja"].includes(String(one(a.triagem)?.classificacao_risco ?? "").toLowerCase())).length;

  return <SectionPage eyebrow="Assistencial / Pronto-Socorro" title="Pronto-Socorro"
    description="Fila clínica integrada à triagem, prontuário, prescrição, laboratório, diagnóstico por imagem e internação."
    actions={<div className="flex gap-2"><Link href="/triagem" className="ui-button-secondary"><Stethoscope className="size-4"/>Triagem</Link><Link href="/assistencial/urgencia" className="ui-button-secondary"><Ambulance className="size-4"/>ABCDE / Emergência</Link></div>}>
    {sp.sucesso === "triagem" ? <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">Triagem concluída e paciente encaminhado ao Pronto-Socorro.</div> : null}
    {error ? <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">Não foi possível carregar toda a fila do Pronto-Socorro.</div> : null}

    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Kpi label="No Pronto-Socorro" value={atendimentos.length} icon={<HeartPulse className="size-5 text-brand-600"/>}/>
      <Kpi label="Aguardando médico" value={aguardando} icon={<Clock3 className="size-5 text-amber-600"/>}/>
      <Kpi label="Em atendimento" value={emAtendimento} icon={<Activity className="size-5 text-emerald-600"/>}/>
      <Kpi label="Vermelho / laranja" value={criticos} icon={<Ambulance className="size-5 text-rose-600"/>}/>
    </section>

    <section className="mt-5 space-y-3">
      <div><h2 className="text-lg font-black text-slate-950">Fila clínica</h2><p className="text-sm text-slate-500">Priorizada pela classificação de risco e pelo horário de entrada.</p></div>
      {atendimentos.length ? atendimentos.map((atendimento) => {
        const paciente = one(atendimento.paciente);
        const triagem = one(atendimento.triagem);
        const encaminhamento = Array.isArray(atendimento.encaminhamentos)
          ? atendimento.encaminhamentos.find((e) => ["aguardando_profissional", "em_atendimento"].includes(e.status)) ?? atendimento.encaminhamentos[0] ?? null
          : atendimento.encaminhamentos;
        const risco = String(triagem?.classificacao_risco ?? "não classificado").toLowerCase();
        const ativo = sp.atendimento === atendimento.id;
        const clinico = `/prontuario/${atendimento.id}/clinico` as Route;
        const prescricao = `/prontuario/${atendimento.id}/prescricao` as Route;
        const laboratorio = `/assistencial/laboratorio?atendimento=${encodeURIComponent(atendimento.id)}` as Route;
        const imagem = `/assistencial/imagem?atendimento=${encodeURIComponent(atendimento.id)}` as Route;
        const internacao = `/internacao/nova/${atendimento.id}` as Route;
        return <article key={atendimento.id} className={`ui-card p-4 sm:p-5 ${ativo ? "ring-2 ring-brand-200" : ""}`}>
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2"><span className={`rounded-full border px-2.5 py-1 text-xs font-black capitalize ${riskStyle[risco] ?? "border-slate-200 bg-slate-50 text-slate-700"}`}>{risco}</span><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">{atendimento.status.replaceAll("_", " ")}</span><span className="text-xs font-semibold text-slate-400">Entrada {quando(atendimento.data_abertura)}</span></div>
              <h3 className="mt-2 text-lg font-black text-slate-950">{paciente?.nome_completo ?? "Paciente"}</h3>
              <p className="mt-1 text-xs text-slate-500">Atend. #{atendimento.numero_atendimento ?? "—"} · RA {paciente?.ra ?? "—"} · Registro #{paciente?.numero_registro ?? "—"} · {atendimento.especialidade_destino ?? "Especialidade não definida"}</p>
              <div className="mt-3 grid gap-2 text-sm md:grid-cols-2 xl:grid-cols-4"><Info label="Queixa" value={triagem?.queixa_principal ?? "—"}/><Info label="Dor" value={triagem?.dor_escala == null ? "—" : `${triagem.dor_escala}/10`}/><Info label="PA / FC" value={`${triagem?.pressao_arterial ?? "—"} · ${triagem?.frequencia_cardiaca ?? "—"} bpm`}/><Info label="SpO₂ / Temp." value={`${triagem?.saturacao_o2 ?? "—"}% · ${triagem?.temperatura_c ?? "—"} °C`}/></div>
            </div>
            <div className="flex flex-wrap gap-2 xl:max-w-[600px] xl:justify-end">
              {encaminhamento?.status === "aguardando_profissional" ? <AssumePatientBackgroundForm encaminhamentoId={encaminhamento.id} filaSetor="ps" pontoPadrao="Box Médico 01"/> : <Link href={clinico} className="ui-button-primary"><Stethoscope className="size-4"/>Atendimento médico</Link>}
              <Link href={prescricao} className="ui-button-secondary"><Pill className="size-4"/>Prescrição</Link>
              <Link href={laboratorio} className="ui-button-secondary"><FlaskConical className="size-4"/>Laboratório</Link>
              <Link href={imagem} className="ui-button-secondary"><ScanLine className="size-4"/>Imagem</Link>
              <Link href={internacao} className="ui-button-secondary"><BedDouble className="size-4"/>Internar</Link>
            </div>
          </div>
        </article>;
      }) : <div className="ui-card p-10 text-center text-sm text-slate-500">Nenhum paciente aguardando no Pronto-Socorro.</div>}
    </section>
  </SectionPage>;
}

function Kpi({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) { return <div className="his-kpi"><div className="flex items-center justify-between"><p className="text-xs font-bold uppercase tracking-wider text-slate-400">{label}</p>{icon}</div><p className="mt-2 text-3xl font-black text-slate-950">{value}</p></div>; }
function Info({ label, value }: { label: string; value: string }) { return <div className="rounded-xl bg-slate-50 px-3 py-2"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p><p className="mt-1 font-semibold text-slate-700">{value}</p></div>; }
