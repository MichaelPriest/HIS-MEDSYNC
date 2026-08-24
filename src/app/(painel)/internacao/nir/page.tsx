import Link from "next/link";
import type { Route } from "next";
import { AlertTriangle, BedDouble, Building2, Clock3, DoorOpen, Filter, HeartPulse, RefreshCw, Search, ShieldCheck, Sparkles, UserRoundCheck } from "lucide-react";
import { SectionPage } from "@/components/painel/section-page";
import { requireAnyPermission } from "@/lib/permissions/server";
import { alocarLeitoNir } from "@/modules/internacao/nir-actions";

type Rel<T> = T | T[] | null;
type Patient = { nome_completo: string | null; ra: string | null; numero_registro: number | null };
type Encounter = { numero_atendimento: string | number | null; paciente_sexo: string | null; paciente: Rel<Patient> };
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
type Structure = { id: string; nome: string; tipo: string };
type Bed = {
  id: string;
  setor: string;
  quarto: string | null;
  codigo: string;
  tipo: string | null;
  acomodacao: string | null;
  sexo_restricao: string | null;
  isolamento_capaz: boolean | null;
  status: string;
  estrutura: Rel<Structure>;
};
type Emergency = { atendimento_id: string; classificacao_risco: string | null; status: string; reavaliacao_em: string | null };
type Triage = { atendimento_id: string; classificacao_risco: string | null; updated_at: string };
type Params = { sucesso?: string; erro?: string; q?: string; risco?: string; setor?: string };

function one<T>(value: Rel<T>): T | null { return Array.isArray(value) ? value[0] ?? null : value; }
const riskWeight: Record<string, number> = { vermelho: 0, laranja: 1, amarelo: 2, verde: 3, azul: 4 };
const riskStyle: Record<string, string> = {
  vermelho: "bg-rose-100 text-rose-800",
  laranja: "bg-orange-100 text-orange-800",
  amarelo: "bg-amber-100 text-amber-800",
  verde: "bg-emerald-100 text-emerald-800",
  azul: "bg-blue-100 text-blue-800",
};

function areaName(bed: Bed) {
  return one(bed.estrutura)?.nome ?? bed.setor ?? "Sem área definida";
}

function waitTone(minutes: number) {
  if (minutes >= 120) return "bg-rose-50 text-rose-700";
  if (minutes >= 60) return "bg-amber-50 text-amber-800";
  return "bg-slate-100 text-slate-600";
}

function bedCompatible(admission: Admission, bed: Bed) {
  const encounter = one(admission.atendimento);
  const sex = encounter?.paciente_sexo?.toLowerCase() ?? null;
  if (bed.status !== "livre") return false;
  if (admission.acomodacao && bed.acomodacao && admission.acomodacao !== bed.acomodacao) return false;
  if (bed.sexo_restricao && sex && bed.sexo_restricao.toLowerCase() !== sex) return false;
  return true;
}

function bedScore(admission: Admission, bed: Bed) {
  let score = 0;
  if (admission.setor && areaName(bed).toLowerCase().includes(admission.setor.toLowerCase())) score += 5;
  if (admission.acomodacao && bed.acomodacao === admission.acomodacao) score += 3;
  if (bed.isolamento_capaz) score += 1;
  return score;
}

export default async function NirPage({ searchParams }: { searchParams: Promise<Params> }) {
  const sp = await searchParams;
  const { supabase, empresaId, unidadeId } = await requireAnyPermission([
    "internacao.visualizar",
    "internacao.movimentar",
    "internacao.gerenciar",
  ]);
  if (!unidadeId) return null;

  const [waitReq, bedsReq, emergencyReq, triageReq] = await Promise.all([
    supabase
      .from("internacoes")
      .select("id,atendimento_id,setor,acomodacao,motivo,previsao_alta,data_internacao,status,atendimento:atendimentos(numero_atendimento,paciente_sexo,paciente:pacientes(nome_completo,ra,numero_registro))")
      .eq("empresa_id", empresaId)
      .eq("unidade_id", unidadeId)
      .eq("status", "aguardando_leito")
      .order("data_internacao", { ascending: true })
      .limit(300),
    supabase
      .from("leitos")
      .select("id,setor,quarto,codigo,tipo,acomodacao,sexo_restricao,isolamento_capaz,status,estrutura:estruturas_fisicas(id,nome,tipo)")
      .eq("empresa_id", empresaId)
      .eq("unidade_id", unidadeId)
      .eq("ativo", true)
      .order("setor")
      .order("codigo")
      .limit(1000),
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
  ]);

  const admissions = (waitReq.data ?? []) as Admission[];
  const beds = (bedsReq.data ?? []) as Bed[];
  const emergencies = (emergencyReq.data ?? []) as Emergency[];
  const triages = (triageReq.data ?? []) as Triage[];
  const freeBeds = beds.filter((item) => item.status === "livre");
  const occupiedBeds = beds.filter((item) => item.status === "ocupado");
  const hygieneBeds = beds.filter((item) => item.status === "higienizacao");
  const unavailableBeds = beds.filter((item) => ["bloqueado", "manutencao"].includes(item.status));
  const occupancy = beds.length ? Math.round((occupiedBeds.length / beds.length) * 100) : 0;

  const rawQueue = admissions.map((admission) => {
    const emergency = emergencies.find((item) => item.atendimento_id === admission.atendimento_id);
    const triage = triages.find((item) => item.atendimento_id === admission.atendimento_id);
    const risk = String(emergency?.classificacao_risco ?? triage?.classificacao_risco ?? "não classificado").toLowerCase();
    const waitMinutes = Math.max(0, Math.floor((Date.now() - new Date(admission.data_internacao).getTime()) / 60000));
    const compatible = freeBeds
      .filter((bed) => bedCompatible(admission, bed))
      .sort((a, b) => bedScore(admission, b) - bedScore(admission, a) || areaName(a).localeCompare(areaName(b), "pt-BR"));
    return { admission, risk, weight: riskWeight[risk] ?? 99, emergency, waitMinutes, compatible };
  }).sort((a, b) => a.weight - b.weight || new Date(a.admission.data_internacao).getTime() - new Date(b.admission.data_internacao).getTime());

  const query = sp.q?.trim().toLowerCase() ?? "";
  const riskFilter = sp.risco?.trim().toLowerCase() ?? "";
  const sectorFilter = sp.setor?.trim() ?? "";
  const sectors = [...new Set(beds.map(areaName))].sort((a, b) => a.localeCompare(b, "pt-BR"));
  const queue = rawQueue.filter((item) => {
    if (riskFilter && item.risk !== riskFilter) return false;
    if (sectorFilter && item.admission.setor !== sectorFilter && !item.compatible.some((bed) => areaName(bed) === sectorFilter)) return false;
    if (query) {
      const encounter = one(item.admission.atendimento);
      const patient = one(encounter?.paciente ?? null);
      const haystack = `${patient?.nome_completo ?? ""} ${patient?.ra ?? ""} ${encounter?.numero_atendimento ?? ""}`.toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    return true;
  });

  const highRisk = rawQueue.filter((item) => item.weight <= 1).length;
  const oldestMinutes = rawQueue.length ? Math.max(...rawQueue.map((item) => item.waitMinutes)) : 0;
  const noCompatible = rawQueue.filter((item) => !item.compatible.length).length;
  const areaStats = new Map<string, { total: number; livre: number; ocupado: number; giro: number; bloqueado: number }>();
  for (const bed of beds) {
    const key = areaName(bed);
    const current = areaStats.get(key) ?? { total: 0, livre: 0, ocupado: 0, giro: 0, bloqueado: 0 };
    current.total += 1;
    if (bed.status === "livre") current.livre += 1;
    else if (bed.status === "ocupado") current.ocupado += 1;
    else if (bed.status === "higienizacao") current.giro += 1;
    else if (["bloqueado", "manutencao"].includes(bed.status)) current.bloqueado += 1;
    areaStats.set(key, current);
  }

  return (
    <SectionPage
      eyebrow="Assistencial / Internação"
      title="NIR · Central de Gestão de Leitos"
      description="Regulação interna com fila priorizada, compatibilidade, disponibilidade por ala/UTI e alocação conectada ao prontuário."
      actions={<div className="flex gap-2"><Link href="/internacao/leitos" className="ui-button-primary"><BedDouble className="size-4"/>Mapa de leitos</Link><Link href="/internacao" className="ui-button-secondary">Internação e alta</Link></div>}
    >
      {sp.sucesso ? <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">Operação concluída: {sp.sucesso.replaceAll("-", " ")}.</div> : null}
      {sp.erro ? <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">Não foi possível concluir: {sp.erro.replaceAll("-", " ")}.</div> : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-7">
        <Kpi label="Aguardando" value={rawQueue.length} icon={<Clock3 className="size-5 text-amber-600" />} />
        <Kpi label="Alta prioridade" value={highRisk} icon={<HeartPulse className="size-5 text-rose-600" />} />
        <Kpi label="Leitos livres" value={freeBeds.length} icon={<DoorOpen className="size-5 text-emerald-600" />} />
        <Kpi label="Ocupados" value={occupiedBeds.length} icon={<UserRoundCheck className="size-5 text-blue-600" />} />
        <Kpi label="Em giro" value={hygieneBeds.length} icon={<Sparkles className="size-5 text-amber-600" />} />
        <Kpi label="Sem compatível" value={noCompatible} icon={<AlertTriangle className="size-5 text-rose-600" />} />
        <div className="his-kpi"><p className="text-xs font-black uppercase tracking-wider text-slate-400">Ocupação</p><p className="mt-2 text-3xl font-black text-brand-950">{occupancy}%</p><p className="mt-1 text-[11px] font-semibold text-slate-400">Maior espera: {oldestMinutes} min</p></div>
      </section>

      <section className="mt-5 his-card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4"><div><p className="text-[10px] font-black uppercase tracking-[.14em] text-slate-400">Censo por área</p><h2 className="mt-1 font-black text-slate-950">Disponibilidade por ala / UTI</h2></div><Link href="/internacao/nir" className="ui-button-secondary"><RefreshCw className="size-4"/>Atualizar</Link></div>
        <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {[...areaStats.entries()].map(([area, stat]) => {
            const areaOccupancy = stat.total ? Math.round((stat.ocupado / stat.total) * 100) : 0;
            return <article key={area} className="rounded-2xl border border-slate-200 bg-white p-4"><div className="flex items-start justify-between gap-2"><div><p className="text-xs font-black text-slate-950">{area}</p><p className="mt-1 text-[11px] text-slate-400">{stat.total} leitos cadastrados</p></div><Building2 className="size-4 text-brand-600"/></div><div className="mt-3 grid grid-cols-4 gap-1 text-center text-[10px] font-black"><span className="rounded-lg bg-emerald-50 px-1 py-2 text-emerald-700">{stat.livre}<small className="block font-semibold">livres</small></span><span className="rounded-lg bg-blue-50 px-1 py-2 text-blue-700">{stat.ocupado}<small className="block font-semibold">ocup.</small></span><span className="rounded-lg bg-amber-50 px-1 py-2 text-amber-700">{stat.giro}<small className="block font-semibold">giro</small></span><span className="rounded-lg bg-rose-50 px-1 py-2 text-rose-700">{stat.bloqueado}<small className="block font-semibold">bloq.</small></span></div><div className="mt-3 flex items-center gap-2"><div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-brand-600" style={{ width: `${Math.min(100, areaOccupancy)}%` }}/></div><span className="text-[10px] font-black text-slate-500">{areaOccupancy}%</span></div></article>;
          })}
        </div>
      </section>

      <section className="mt-5">
        <div className="mb-3"><h2 className="text-lg font-black text-slate-950">Fila regulatória</h2><p className="text-sm text-slate-500">Ordenação por risco clínico e tempo de espera, com leitos compatíveis sugeridos automaticamente.</p></div>
        <form className="his-card mb-4 grid gap-3 p-4 md:grid-cols-[1fr_190px_220px_auto]">
          <label className="relative"><Search className="absolute left-3 top-3 size-4 text-slate-400"/><input name="q" defaultValue={sp.q ?? ""} placeholder="Paciente, RA ou atendimento..." className="ui-input pl-9"/></label>
          <select name="risco" defaultValue={riskFilter} className="ui-input"><option value="">Todos os riscos</option>{["vermelho", "laranja", "amarelo", "verde", "azul"].map((risk) => <option key={risk} value={risk}>{risk}</option>)}</select>
          <select name="setor" defaultValue={sectorFilter} className="ui-input"><option value="">Todas as alas/UTI</option>{sectors.map((sector) => <option key={sector} value={sector}>{sector}</option>)}</select>
          <button className="ui-button-secondary"><Filter className="size-4"/>Filtrar</button>
        </form>

        <div className="space-y-3">
          {queue.length ? queue.map(({ admission, risk, emergency, waitMinutes, compatible }, index) => {
            const encounter = one(admission.atendimento);
            const patient = one(encounter?.paciente ?? null);
            const prontuarioHref = `/prontuario/${admission.atendimento_id}` as Route;
            const urgencyHref = `/assistencial/urgencia?atendimento=${admission.atendimento_id}` as Route;
            const recommendations = compatible.slice(0, 6);
            return <article key={admission.id} className="his-card overflow-hidden">
              <div className="grid xl:grid-cols-[minmax(0,1fr)_minmax(420px,.8fr)]">
                <div className="p-5">
                  <div className="flex flex-wrap items-center gap-2"><span className="grid size-7 place-items-center rounded-full bg-brand-950 text-xs font-black text-white">{index + 1}</span><span className={`rounded-full px-2.5 py-1 text-xs font-black capitalize ${riskStyle[risk] ?? "bg-slate-100 text-slate-700"}`}>{risk}</span><span className={`rounded-full px-2.5 py-1 text-xs font-black ${waitTone(waitMinutes)}`}>{waitMinutes} min de espera</span>{!compatible.length ? <span className="rounded-full bg-rose-100 px-2.5 py-1 text-xs font-black text-rose-700"><AlertTriangle className="mr-1 inline size-3"/>Sem leito compatível</span> : null}</div>
                  <h3 className="mt-3 text-lg font-black text-slate-950">{patient?.nome_completo ?? "Paciente"}</h3>
                  <p className="mt-1 text-xs text-slate-500">Atend. #{encounter?.numero_atendimento ?? "—"} · RA {patient?.ra ?? "—"} · Registro #{patient?.numero_registro ?? "—"}</p>
                  <div className="mt-4 grid gap-2 sm:grid-cols-3"><Mini label="Setor solicitado" value={admission.setor ?? "—"}/><Mini label="Acomodação" value={admission.acomodacao ?? "—"}/><Mini label="Motivo" value={admission.motivo ?? "—"}/></div>
                  {emergency?.reavaliacao_em ? <p className="mt-3 text-xs font-semibold text-amber-700">Reavaliação clínica prevista: {new Date(emergency.reavaliacao_em).toLocaleString("pt-BR")}</p> : null}
                  <div className="mt-4 flex flex-wrap gap-2"><Link href={prontuarioHref} className="ui-button-secondary">Prontuário</Link><Link href={urgencyHref} className="ui-button-secondary">Urgência</Link></div>
                </div>

                <div className="border-t border-slate-100 bg-slate-50/70 p-5 xl:border-l xl:border-t-0">
                  <div className="flex items-center justify-between gap-2"><div><p className="text-[10px] font-black uppercase tracking-[.14em] text-slate-400">Regulação NIR</p><h4 className="mt-1 font-black text-slate-950">Selecionar leito</h4></div><span className="rounded-lg bg-white px-2.5 py-1 text-xs font-black text-slate-500 ring-1 ring-slate-200">{compatible.length} compatíveis</span></div>
                  {recommendations.length ? <div className="mt-3 flex flex-wrap gap-1.5">{recommendations.map((bed) => <span key={bed.id} className="rounded-lg bg-white px-2 py-1 text-[10px] font-bold text-slate-600 ring-1 ring-slate-200">{areaName(bed)} · {bed.quarto ? `${bed.quarto}/` : ""}{bed.codigo}{bed.isolamento_capaz ? " · isolamento" : ""}</span>)}</div> : <div className="mt-3 rounded-xl bg-rose-50 p-3 text-xs font-semibold text-rose-700">Revise acomodação, restrição por sexo ou disponibilidade no Mapa de Leitos.</div>}
                  <form action={alocarLeitoNir} className="mt-4 grid gap-2">
                    <input type="hidden" name="internacao_id" value={admission.id}/>
                    <select name="leito_id" required defaultValue="" className="ui-input"><option value="">Selecione o leito...</option>{compatible.map((bed) => <option key={bed.id} value={bed.id}>{areaName(bed)} · {bed.quarto ? `${bed.quarto} · ` : ""}{bed.codigo}{bed.acomodacao ? ` · ${bed.acomodacao}` : ""}{bed.isolamento_capaz ? " · isolamento" : ""}</option>)}</select>
                    <input name="motivo" className="ui-input" placeholder="Justificativa / observação do NIR"/>
                    <button disabled={!compatible.length} className="ui-button-primary disabled:cursor-not-allowed disabled:opacity-50">Alocar leito</button>
                  </form>
                </div>
              </div>
            </article>;
          }) : <div className="his-card p-12 text-center"><BedDouble className="mx-auto size-10 text-slate-300"/><p className="mt-3 font-black text-slate-700">Nenhum paciente nesta fila</p><p className="mt-1 text-sm text-slate-500">Não há pacientes aguardando ou os filtros atuais não retornaram resultados.</p></div>}
        </div>
      </section>

      {unavailableBeds.length ? <p className="mt-4 text-xs text-slate-400"><ShieldCheck className="mr-1 inline size-3"/>{unavailableBeds.length} leito(s) estão bloqueados ou em manutenção e não entram nas sugestões da NIR.</p> : null}
    </SectionPage>
  );
}

function Kpi({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return <div className="his-kpi"><div className="flex items-center justify-between"><p className="text-xs font-black uppercase tracking-wider text-slate-400">{label}</p>{icon}</div><p className="mt-2 text-3xl font-black text-brand-950">{value}</p></div>;
}

function Mini({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl bg-slate-50 px-3 py-2"><p className="text-[10px] font-black uppercase tracking-wider text-slate-400">{label}</p><p className="mt-0.5 line-clamp-2 text-xs font-semibold capitalize text-slate-700">{value}</p></div>;
}
