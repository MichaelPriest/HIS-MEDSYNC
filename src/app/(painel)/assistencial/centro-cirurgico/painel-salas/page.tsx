import Link from "next/link";
import { Activity, AlertTriangle, CalendarClock, CheckCircle2, Clock3, DoorOpen, ListChecks, Monitor, Scissors, UserRound } from "lucide-react";
import { RoomBoardAutoRefresh } from "@/components/centro-cirurgico/room-board-auto-refresh";
import { SectionPage } from "@/components/painel/section-page";
import { requireAnyPermission } from "@/lib/permissions/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Rel<T> = T | T[] | null;
type Sala = { sala_id: string; codigo: string; nome: string; status: string | null; equipamentos_prontos: boolean; equipamentos_obrigatorios_indisponiveis: number };
type Cirurgia = {
  id: string; atendimento_id: string; paciente_id: string; procedimento: string; codigo_tuss: string | null; codigo_contratado: string | null;
  porte: string | null; porte_anestesico: string | null; sala: string | null; sala_id: string | null; status: string;
  inicio_previsto: string | null; inicio_em: string | null; fim_em: string | null; cirurgiao_id: string | null; anestesista_id: string | null;
  paciente: Rel<{ nome_completo: string | null; nome_social: string | null; ra: string | null }>;
};
type Procedimento = {
  id: string; cirurgia_id: string; codigo: string | null; codigo_tuss: string | null; descricao: string; porte: string | null; porte_anestesico: string | null;
  sequencia: number; principal: boolean; status: string; inicio_em: string | null; fim_em: string | null;
};
type Profissional = { id: string; nome_completo: string };

const one = <T,>(value: Rel<T>): T | null => Array.isArray(value) ? value[0] ?? null : value;
const fmtDateTime = (value?: string | null) => value ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(value)) : "—";
const fmtTime = (value?: string | null) => value ? new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }).format(new Date(value)) : "—";

function elapsed(value?: string | null) {
  if (!value) return null;
  const total = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60000));
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  return hours ? `${hours}h ${String(minutes).padStart(2, "0")}min` : `${minutes} min`;
}
function until(value?: string | null) {
  if (!value) return null;
  const total = Math.round((new Date(value).getTime() - Date.now()) / 60000);
  if (total < 0) return `${Math.abs(total)} min de atraso`;
  if (total === 0) return "agora";
  if (total < 60) return `em ${total} min`;
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  return `em ${hours}h${minutes ? ` ${minutes}min` : ""}`;
}
function salaKey(cirurgia: Cirurgia) { return cirurgia.sala_id ?? `nome:${String(cirurgia.sala ?? "").trim().toLowerCase()}`; }

export default async function PainelSalasCentroCirurgicoPage() {
  const { supabase, empresaId, unidadeId } = await requireAnyPermission(["centro_cirurgico.visualizar", "centro_cirurgico.operar", "centro_cirurgico.gerenciar"]);
  if (!unidadeId) return null;

  const now = Date.now();
  const horizon = new Date(now + 48 * 60 * 60 * 1000).toISOString();
  const [salasReq, cirurgiasReq] = await Promise.all([
    supabase.from("vw_salas_cirurgicas_prontidao").select("sala_id,codigo,nome,status,equipamentos_prontos,equipamentos_obrigatorios_indisponiveis").eq("empresa_id", empresaId).eq("unidade_id", unidadeId).order("nome"),
    supabase.from("cirurgias").select("id,atendimento_id,paciente_id,procedimento,codigo_tuss,codigo_contratado,porte,porte_anestesico,sala,sala_id,status,inicio_previsto,inicio_em,fim_em,cirurgiao_id,anestesista_id,paciente:pacientes(nome_completo,nome_social,ra)").eq("empresa_id", empresaId).eq("unidade_id", unidadeId).in("status", ["agendada", "em_preparo", "em_andamento", "recuperacao"]).or(`inicio_previsto.is.null,inicio_previsto.lte.${horizon}`).order("inicio_previsto", { ascending: true, nullsFirst: false }).limit(300),
  ]);
  const salas = (salasReq.data ?? []) as Sala[];
  const cirurgias = (cirurgiasReq.data ?? []) as unknown as Cirurgia[];
  const cirurgiaIds = cirurgias.map((item) => item.id);

  const [procedimentosReq, profissionaisReq] = await Promise.all([
    cirurgiaIds.length ? supabase.from("cirurgia_procedimentos").select("id,cirurgia_id,codigo,codigo_tuss,descricao,porte,porte_anestesico,sequencia,principal,status,inicio_em,fim_em").in("cirurgia_id", cirurgiaIds).order("sequencia") : Promise.resolve({ data: [] as Procedimento[] }),
    (() => {
      const ids = [...new Set(cirurgias.flatMap((item) => [item.cirurgiao_id, item.anestesista_id]).filter((id): id is string => Boolean(id)))];
      return ids.length ? supabase.from("profissionais").select("id,nome_completo").eq("empresa_id", empresaId).in("id", ids) : Promise.resolve({ data: [] as Profissional[] });
    })(),
  ]);
  const procedimentos = (procedimentosReq.data ?? []) as Procedimento[];
  const profissionalNome = new Map(((profissionaisReq.data ?? []) as Profissional[]).map((item) => [item.id, item.nome_completo]));
  const procBySurgery = new Map<string, Procedimento[]>();
  for (const proc of procedimentos) procBySurgery.set(proc.cirurgia_id, [...(procBySurgery.get(proc.cirurgia_id) ?? []), proc]);

  const atuais = cirurgias.filter((item) => ["em_preparo", "em_andamento"].includes(item.status));
  const futuros = cirurgias.filter((item) => item.status === "agendada" || (item.status === "em_preparo" && !item.inicio_em));
  const currentByRoom = new Map<string, Cirurgia>();
  for (const cirurgia of atuais) {
    const key = salaKey(cirurgia);
    const existing = currentByRoom.get(key);
    if (!existing || cirurgia.status === "em_andamento") currentByRoom.set(key, cirurgia);
  }
  const nextByRoom = new Map<string, Cirurgia>();
  for (const cirurgia of futuros) {
    if (!cirurgia.inicio_previsto) continue;
    const key = salaKey(cirurgia);
    if (currentByRoom.get(key)?.id === cirurgia.id) continue;
    const existing = nextByRoom.get(key);
    if (!existing || new Date(cirurgia.inicio_previsto).getTime() < new Date(existing.inicio_previsto ?? "9999-12-31").getTime()) nextByRoom.set(key, cirurgia);
  }

  const agenda = cirurgias.filter((item) => item.status === "agendada" && item.inicio_previsto && new Date(item.inicio_previsto).getTime() >= now - 30 * 60 * 1000).sort((a, b) => new Date(a.inicio_previsto ?? 0).getTime() - new Date(b.inicio_previsto ?? 0).getTime()).slice(0, 20);
  const semSala = agenda.filter((item) => !item.sala_id && !item.sala);
  const emAndamento = cirurgias.filter((item) => item.status === "em_andamento").length;
  const procedimentosEmAndamento = procedimentos.filter((item) => item.status === "em_andamento").length;
  const emPreparo = cirurgias.filter((item) => item.status === "em_preparo").length;
  const salasLivres = salas.filter((sala) => !currentByRoom.has(sala.sala_id) && !currentByRoom.has(`nome:${sala.codigo.toLowerCase()}`) && !currentByRoom.has(`nome:${sala.nome.toLowerCase()}`)).length;

  return <SectionPage eyebrow="Assistencial / Centro Cirúrgico / Painel de salas" title="Procedimentos em andamento e próxima agenda" description="Visão operacional das salas cirúrgicas: procedimento individual em execução, tempo real e próximos casos programados." actions={<div className="flex flex-wrap gap-2"><Link href="/assistencial/centro-cirurgico/procedimentos" className="ui-button-primary"><ListChecks className="size-4" />Procedimentos e equipe</Link><Link href="/assistencial/centro-cirurgico/equipamentos" className="ui-button-secondary"><Monitor className="size-4" />Prontidão</Link></div>}>
    <div className="mb-4 flex justify-end"><RoomBoardAutoRefresh /></div>
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
      <Kpi label="Salas" value={salas.length} icon={<DoorOpen className="size-5 text-brand-600" />} />
      <Kpi label="Cirurgias em sala" value={emAndamento} icon={<Activity className="size-5 text-rose-600" />} />
      <Kpi label="Procedimentos ativos" value={procedimentosEmAndamento} icon={<Scissors className="size-5 text-rose-600" />} />
      <Kpi label="Em preparo" value={emPreparo} icon={<Clock3 className="size-5 text-amber-600" />} />
      <Kpi label="Salas livres" value={salasLivres} icon={<CheckCircle2 className="size-5 text-emerald-600" />} />
      <Kpi label="Agenda sem sala" value={semSala.length} icon={<AlertTriangle className="size-5 text-orange-600" />} />
    </section>

    <section className="mt-5">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-lg font-black text-slate-950">Mapa das salas</h2><p className="mt-1 text-sm text-slate-500">Se houver procedimento individual iniciado, ele substitui o procedimento principal no destaque da sala.</p></div><span className="rounded-xl bg-slate-50 px-3 py-2 text-xs font-bold text-slate-500">Horário de Brasília</span></div>
      <div className="grid gap-4 xl:grid-cols-2 2xl:grid-cols-3">
        {salas.map((sala) => {
          const keys = [sala.sala_id, `nome:${sala.codigo.toLowerCase()}`, `nome:${sala.nome.toLowerCase()}`];
          const atual = keys.map((key) => currentByRoom.get(key)).find(Boolean) ?? null;
          const proximo = keys.map((key) => nextByRoom.get(key)).find((item) => item && item.id !== atual?.id) ?? null;
          const procAtual = atual ? (procBySurgery.get(atual.id) ?? []).find((item) => item.status === "em_andamento") ?? null : null;
          const procPrevisto = atual ? (procBySurgery.get(atual.id) ?? []).find((item) => item.status === "previsto") ?? null : null;
          return <RoomCard key={sala.sala_id} sala={sala} atual={atual} proximo={proximo} procedimentoAtual={procAtual} procedimentoPrevisto={procPrevisto} profissionalNome={profissionalNome} />;
        })}
        {!salas.length ? <div className="his-card p-10 text-center xl:col-span-2 2xl:col-span-3"><DoorOpen className="mx-auto size-8 text-slate-300" /><p className="mt-3 font-black text-slate-700">Nenhuma sala cirúrgica cadastrada nesta unidade.</p></div> : null}
      </div>
    </section>

    <section className="mt-6 his-card overflow-hidden">
      <div className="border-b border-slate-100 p-5"><div className="flex items-center gap-3"><CalendarClock className="size-5 text-brand-700" /><div><h2 className="font-black text-slate-950">Próximos procedimentos da agenda</h2><p className="mt-1 text-sm text-slate-500">Próximos casos nas próximas 48 horas, em ordem cronológica.</p></div></div></div>
      <div className="divide-y divide-slate-100">{agenda.map((cirurgia, index) => { const paciente=one(cirurgia.paciente); const proc=(procBySurgery.get(cirurgia.id)??[]).find((item)=>item.principal)??null; return <div key={cirurgia.id} className="grid gap-3 p-4 md:grid-cols-[70px_1.5fr_1fr_1fr_auto] md:items-center"><div><p className="text-xs font-black uppercase text-slate-400">#{index+1}</p><p className="mt-1 text-lg font-black text-brand-800">{fmtTime(cirurgia.inicio_previsto)}</p></div><div><p className="font-black text-slate-900">{paciente?.nome_social||paciente?.nome_completo||"Paciente"}</p><p className="text-xs text-slate-500">RA {paciente?.ra??"—"}</p></div><div><p className="text-sm font-bold text-slate-800">{proc?.descricao??cirurgia.procedimento}</p><p className="text-xs text-slate-500">{proc?.codigo_tuss||proc?.codigo||cirurgia.codigo_contratado||cirurgia.codigo_tuss||"sem código"}{(proc?.porte??cirurgia.porte)?` · porte ${proc?.porte??cirurgia.porte}`:""}</p></div><div><p className="text-sm font-bold text-slate-800">{cirurgia.sala||"Sala a definir"}</p><p className="text-xs text-slate-500">{cirurgia.cirurgiao_id?profissionalNome.get(cirurgia.cirurgiao_id)??"Cirurgião":"Cirurgião a definir"}</p></div><span className={`rounded-full px-3 py-1 text-xs font-black ${until(cirurgia.inicio_previsto)?.includes("atraso")?"bg-rose-50 text-rose-700":"bg-brand-50 text-brand-700"}`}>{until(cirurgia.inicio_previsto)}</span></div>; })}{!agenda.length?<div className="p-10 text-center text-sm text-slate-500">Não há procedimentos agendados para as próximas 48 horas.</div>:null}</div>
    </section>
  </SectionPage>;
}

function RoomCard({ sala, atual, proximo, procedimentoAtual, procedimentoPrevisto, profissionalNome }: { sala: Sala; atual: Cirurgia | null; proximo: Cirurgia | null; procedimentoAtual: Procedimento | null; procedimentoPrevisto: Procedimento | null; profissionalNome: Map<string,string> }) {
  const pacienteAtual=atual?one(atual.paciente):null;
  const pacienteProximo=proximo?one(proximo.paciente):null;
  const emCirurgia=atual?.status==="em_andamento";
  const statusClass=emCirurgia?"border-rose-200 bg-rose-50/30":atual?"border-amber-200 bg-amber-50/30":"border-emerald-200 bg-emerald-50/20";
  const destaque=procedimentoAtual??procedimentoPrevisto;
  return <article className={`rounded-2xl border-2 p-5 shadow-sm ${statusClass}`}>
    <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-wide text-slate-400">{sala.codigo}</p><h3 className="mt-1 text-xl font-black text-slate-950">{sala.nome}</h3></div><div className="text-right"><span className={`rounded-full px-3 py-1 text-xs font-black ${emCirurgia?"bg-rose-100 text-rose-800":atual?"bg-amber-100 text-amber-800":"bg-emerald-100 text-emerald-800"}`}>{emCirurgia?"EM CIRURGIA":atual?"EM PREPARO":"LIVRE"}</span><p className={`mt-2 text-[11px] font-bold ${sala.equipamentos_prontos?"text-emerald-700":"text-rose-700"}`}>{sala.equipamentos_prontos?"Equipamentos prontos":`${sala.equipamentos_obrigatorios_indisponiveis} pendência(s) de equipamento`}</p></div></div>
    {atual?<div className="mt-5 rounded-2xl border border-white bg-white/80 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-wide text-slate-400">Agora na sala</p><p className="mt-1 text-base font-black text-slate-950">{pacienteAtual?.nome_social||pacienteAtual?.nome_completo||"Paciente"}</p><p className="text-xs text-slate-500">RA {pacienteAtual?.ra??"—"}</p></div><div className="text-right"><p className="text-xs font-bold text-slate-500">Início do ato</p><p className="font-black text-slate-900">{fmtTime(atual.inicio_em??atual.inicio_previsto)}</p>{atual.inicio_em?<p className="text-xs font-black text-rose-700">{elapsed(atual.inicio_em)} em sala</p>:null}</div></div><div className="mt-3 border-t border-slate-100 pt-3"><p className="text-[10px] font-black uppercase tracking-wide text-brand-600">{procedimentoAtual?"Procedimento em execução":"Procedimento previsto"}</p><p className="mt-1 text-sm font-black text-slate-900">{destaque?.descricao??atual.procedimento}</p><p className="mt-1 text-xs text-slate-500">{destaque?.codigo_tuss||destaque?.codigo||atual.codigo_contratado||atual.codigo_tuss||"sem código"}{(destaque?.porte??atual.porte)?` · porte ${destaque?.porte??atual.porte}`:""}{(destaque?.porte_anestesico??atual.porte_anestesico)?` · anest. ${destaque?.porte_anestesico??atual.porte_anestesico}`:""}</p>{procedimentoAtual?<p className="mt-1 text-xs font-black text-rose-700">Iniciado {fmtTime(procedimentoAtual.inicio_em)} · {elapsed(procedimentoAtual.inicio_em)} decorridos</p>:null}<p className="mt-2 text-xs font-semibold text-slate-600"><UserRound className="mr-1 inline size-3.5" />{atual.cirurgiao_id?profissionalNome.get(atual.cirurgiao_id)??"Cirurgião":"Cirurgião a definir"}{atual.anestesista_id?` · Anest.: ${profissionalNome.get(atual.anestesista_id)??"definido"}`:""}</p></div></div>:<div className="mt-5 rounded-2xl border border-dashed border-emerald-200 bg-white/60 p-5 text-center"><CheckCircle2 className="mx-auto size-6 text-emerald-500"/><p className="mt-2 font-black text-emerald-800">Sala disponível</p></div>}
    <div className="mt-4 border-t border-slate-200/70 pt-4"><p className="text-[10px] font-black uppercase tracking-wide text-slate-400">Próximo caso</p>{proximo?<div className="mt-2 flex items-start justify-between gap-3"><div><p className="font-black text-slate-900">{fmtTime(proximo.inicio_previsto)} · {pacienteProximo?.nome_social||pacienteProximo?.nome_completo||"Paciente"}</p><p className="mt-1 text-xs font-semibold text-slate-600">{proximo.procedimento}</p><p className="mt-1 text-xs text-slate-500">{fmtDateTime(proximo.inicio_previsto)}</p></div><span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-black ${until(proximo.inicio_previsto)?.includes("atraso")?"bg-rose-100 text-rose-800":"bg-slate-100 text-slate-700"}`}>{until(proximo.inicio_previsto)}</span></div>:<p className="mt-2 text-sm text-slate-500">Sem próximo caso programado.</p>}</div>
  </article>;
}

function Kpi({label,value,icon}:{label:string;value:number;icon:React.ReactNode}){return <div className="his-kpi"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-wide text-slate-400">{label}</p><p className="mt-2 text-3xl font-black text-slate-950">{value}</p></div>{icon}</div></div>}
