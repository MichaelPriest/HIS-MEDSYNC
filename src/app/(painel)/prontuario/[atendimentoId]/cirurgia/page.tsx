import Link from "next/link";
import {
  Activity,
  CheckCircle2,
  ClipboardCheck,
  PackageCheck,
  Scissors,
  ShieldCheck,
  Syringe,
} from "lucide-react";
import { notFound } from "next/navigation";
import { SectionPage } from "@/components/painel/section-page";
import { requireAnyPermission } from "@/lib/permissions/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Rel<T> = T | T[] | null;
type Paciente = {
  nome_completo: string | null;
  nome_social: string | null;
  ra: string | null;
  numero_registro: string | number | null;
};
type Cirurgia = {
  id: string;
  atendimento_id: string;
  unidade_id: string;
  procedimento: string;
  codigo_tuss: string | null;
  cirurgia: string | null;
  lateralidade: string | null;
  sala: string | null;
  classificacao: string | null;
  porte: string | null;
  status: string;
  inicio_previsto: string | null;
  inicio_em: string | null;
  fim_em: string | null;
  cirurgiao_id: string | null;
  anestesista_id: string | null;
  diagnostico_pre: string | null;
  diagnostico_pos: string | null;
  intercorrencias: string | null;
  atendimento: Rel<{ numero_atendimento: string | number | null; data_abertura: string | null }>;
};
type Checklist = {
  cirurgia_id: string;
  etapa: string;
  concluido: boolean;
  concluido_em: string | null;
  observacoes: string | null;
};
type Anestesia = {
  cirurgia_id: string;
  tecnica: string | null;
  asa: string | null;
  via_aerea: string | null;
  inicio_em: string | null;
  fim_em: string | null;
  observacoes: string | null;
};
type Rpa = {
  cirurgia_id: string;
  aldrete_entrada: number | null;
  aldrete_alta: number | null;
  dor: number | null;
  nauseas: boolean;
  destino: string | null;
  status: string;
  alta_em: string | null;
  intercorrencias: string | null;
};
type Opme = {
  id: string;
  cirurgia_id: string;
  item: string;
  codigo: string | null;
  fabricante: string | null;
  lote: string | null;
  serie: string | null;
  registro_anvisa: string | null;
  quantidade: number;
  status: string;
  utilizado_em: string | null;
};
type VinculoCme = { cirurgia_id: string; ciclo_id: string; observacoes: string | null };
type CicloCme = {
  id: string;
  codigo_ciclo: string;
  equipamento: string | null;
  metodo: string | null;
  carga: string | null;
  resultado: string | null;
  status: string;
  liberado_em: string | null;
};
type Evento = {
  id: string;
  cirurgia_id: string;
  tipo_evento: string;
  status_anterior: string | null;
  status_novo: string | null;
  created_at: string;
};
type Profissional = { id: string; nome_completo: string | null };

const one = <T,>(value: Rel<T>): T | null => Array.isArray(value) ? value[0] ?? null : value;
const fmt = (value?: string | null) => value
  ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(value))
  : "—";
const statusLabel = (value: string) => ({
  agendada: "Agendada",
  em_preparo: "Em preparo",
  em_andamento: "Em cirurgia",
  recuperacao: "Recuperação",
  concluida: "Concluída",
  cancelada: "Cancelada",
}[value] ?? value.replaceAll("_", " "));
const eventoLabel = (value: string) => ({
  cirurgia_agendada: "Cirurgia agendada",
  agendamento_atualizado: "Agendamento atualizado",
  status_alterado: "Mudança de etapa",
  checklist_atualizado: "Checklist atualizado",
  anestesia_iniciada: "Anestesia iniciada",
  anestesia_finalizada: "Anestesia finalizada",
  anestesia_atualizada: "Anestesia atualizada",
  rpa_alta: "Alta da RPA",
  rpa_atualizada: "RPA atualizada",
  opme_registrada: "OPME registrada",
  cme_vinculado: "Ciclo CME vinculado",
}[value] ?? value.replaceAll("_", " "));

export default async function CirurgiaProntuarioPage({ params }: { params: Promise<{ atendimentoId: string }> }) {
  const { atendimentoId } = await params;
  const { supabase, empresaId, unidadeId } = await requireAnyPermission(["prontuario.visualizar"]);
  if (!unidadeId) return null;

  const { data: atual } = await supabase
    .from("atendimentos")
    .select("id,paciente_id,numero_atendimento,paciente:pacientes(nome_completo,nome_social,ra,numero_registro)")
    .eq("id", atendimentoId)
    .eq("empresa_id", empresaId)
    .eq("unidade_id", unidadeId)
    .maybeSingle();
  if (!atual) notFound();
  const paciente = one(atual.paciente) as Paciente | null;

  const { data: cirurgiasData } = await supabase
    .from("cirurgias")
    .select("id,atendimento_id,unidade_id,procedimento,codigo_tuss,cirurgia,lateralidade,sala,classificacao,porte,status,inicio_previsto,inicio_em,fim_em,cirurgiao_id,anestesista_id,diagnostico_pre,diagnostico_pos,intercorrencias,atendimento:atendimentos(numero_atendimento,data_abertura)")
    .eq("empresa_id", empresaId)
    .eq("paciente_id", atual.paciente_id)
    .order("inicio_previsto", { ascending: false, nullsFirst: false })
    .limit(100);
  const cirurgias = (cirurgiasData ?? []) as unknown as Cirurgia[];
  const cirurgiaIds = cirurgias.map((item) => item.id);

  const vazio = { data: [] as unknown[] };
  const [checklistsRes, anestesiasRes, rpasRes, opmesRes, vinculosRes, eventosRes] = cirurgiaIds.length
    ? await Promise.all([
        supabase.from("cirurgia_checklist").select("cirurgia_id,etapa,concluido,concluido_em,observacoes").in("cirurgia_id", cirurgiaIds).order("created_at", { ascending: false }),
        supabase.from("anestesia_registros").select("cirurgia_id,tecnica,asa,via_aerea,inicio_em,fim_em,observacoes").in("cirurgia_id", cirurgiaIds).order("created_at", { ascending: false }),
        supabase.from("rpa_registros").select("cirurgia_id,aldrete_entrada,aldrete_alta,dor,nauseas,destino,status,alta_em,intercorrencias").in("cirurgia_id", cirurgiaIds).order("created_at", { ascending: false }),
        supabase.from("cirurgia_opme").select("id,cirurgia_id,item,codigo,fabricante,lote,serie,registro_anvisa,quantidade,status,utilizado_em").in("cirurgia_id", cirurgiaIds).order("created_at", { ascending: false }),
        supabase.from("cirurgia_cme_ciclos").select("cirurgia_id,ciclo_id,observacoes").in("cirurgia_id", cirurgiaIds).order("created_at", { ascending: false }),
        supabase.from("cirurgia_eventos").select("id,cirurgia_id,tipo_evento,status_anterior,status_novo,created_at").in("cirurgia_id", cirurgiaIds).order("created_at", { ascending: false }),
      ])
    : [vazio, vazio, vazio, vazio, vazio, vazio];

  const checklists = (checklistsRes.data ?? []) as unknown as Checklist[];
  const anestesias = (anestesiasRes.data ?? []) as unknown as Anestesia[];
  const rpas = (rpasRes.data ?? []) as unknown as Rpa[];
  const opmes = (opmesRes.data ?? []) as unknown as Opme[];
  const vinculos = (vinculosRes.data ?? []) as unknown as VinculoCme[];
  const eventos = (eventosRes.data ?? []) as unknown as Evento[];

  const cicloIds = [...new Set(vinculos.map((item) => item.ciclo_id))];
  const { data: ciclosData } = cicloIds.length
    ? await supabase.from("cme_ciclos").select("id,codigo_ciclo,equipamento,metodo,carga,resultado,status,liberado_em").in("id", cicloIds)
    : { data: [] as unknown[] };
  const ciclos = (ciclosData ?? []) as unknown as CicloCme[];
  const cicloMap = new Map(ciclos.map((item) => [item.id, item]));

  const profissionalIds = [...new Set(cirurgias.flatMap((item) => [item.cirurgiao_id, item.anestesista_id]).filter((id): id is string => Boolean(id)))];
  const { data: profissionaisData } = profissionalIds.length
    ? await supabase.from("profissionais").select("id,nome_completo").in("id", profissionalIds)
    : { data: [] as unknown[] };
  const profissionais = (profissionaisData ?? []) as unknown as Profissional[];
  const profissionalMap = new Map(profissionais.map((item) => [item.id, item.nome_completo ?? "Profissional"]));

  return (
    <SectionPage
      eyebrow="Prontuário / Centro Cirúrgico"
      title="Histórico cirúrgico longitudinal"
      description={`${paciente?.nome_social || paciente?.nome_completo || "Paciente"} · Registro #${paciente?.numero_registro ?? "—"} · ${paciente?.ra ?? "—"}`}
      actions={<Link href="/assistencial/centro-cirurgico" className="ui-button-secondary"><Scissors className="size-4" />Central Cirúrgica</Link>}
    >
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Kpi label="Cirurgias" value={cirurgias.length} />
        <Kpi label="Concluídas" value={cirurgias.filter((item) => item.status === "concluida").length} />
        <Kpi label="Em fluxo" value={cirurgias.filter((item) => ["em_preparo", "em_andamento", "recuperacao"].includes(item.status)).length} />
        <Kpi label="OPME utilizada" value={opmes.filter((item) => item.status === "utilizado").length} />
        <Kpi label="Ciclos CME vinculados" value={vinculos.length} />
      </section>

      <div className="mt-5 space-y-5">
        {cirurgias.map((cirurgia) => {
          const atendimento = one(cirurgia.atendimento);
          const checks = checklists.filter((item) => item.cirurgia_id === cirurgia.id);
          const anestesia = anestesias.find((item) => item.cirurgia_id === cirurgia.id) ?? null;
          const rpa = rpas.find((item) => item.cirurgia_id === cirurgia.id) ?? null;
          const itensOpme = opmes.filter((item) => item.cirurgia_id === cirurgia.id);
          const ciclosVinculados = vinculos.filter((item) => item.cirurgia_id === cirurgia.id);
          const timeline = eventos.filter((item) => item.cirurgia_id === cirurgia.id).slice(0, 30);
          const episodioAtual = cirurgia.atendimento_id === atendimentoId;

          return (
            <article key={cirurgia.id} className={`his-card overflow-hidden ${episodioAtual ? "ring-2 ring-brand-200" : ""}`}>
              <div className="border-b border-slate-100 p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2"><Status status={cirurgia.status} />{episodioAtual ? <span className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-black text-brand-700">Episódio atual</span> : null}</div>
                    <h2 className="mt-3 text-lg font-black text-slate-950">{cirurgia.cirurgia || cirurgia.procedimento}</h2>
                    <p className="mt-1 text-sm font-semibold text-slate-700">{cirurgia.procedimento}{cirurgia.codigo_tuss ? ` · TUSS ${cirurgia.codigo_tuss}` : ""}</p>
                    <p className="mt-1 text-xs text-slate-500">Atendimento #{atendimento?.numero_atendimento ?? "—"} · Sala {cirurgia.sala ?? "—"} · {cirurgia.lateralidade ?? "lateralidade não informada"}</p>
                  </div>
                  <div className="text-right text-xs text-slate-500"><p>Previsto {fmt(cirurgia.inicio_previsto)}</p><p>Início {fmt(cirurgia.inicio_em)}</p><p>Fim {fmt(cirurgia.fim_em)}</p></div>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <Info label="Cirurgião" value={cirurgia.cirurgiao_id ? profissionalMap.get(cirurgia.cirurgiao_id) : null} />
                  <Info label="Anestesista" value={cirurgia.anestesista_id ? profissionalMap.get(cirurgia.anestesista_id) : null} />
                  <Info label="Classificação" value={cirurgia.classificacao} />
                  <Info label="Porte" value={cirurgia.porte} />
                </div>
                {(cirurgia.diagnostico_pre || cirurgia.diagnostico_pos || cirurgia.intercorrencias) ? <div className="mt-4 grid gap-3 lg:grid-cols-3"><Texto label="Diagnóstico pré" value={cirurgia.diagnostico_pre} /><Texto label="Diagnóstico pós" value={cirurgia.diagnostico_pos} /><Texto label="Intercorrências" value={cirurgia.intercorrencias} /></div> : null}
              </div>

              <div className="grid gap-4 p-5 xl:grid-cols-3">
                <ResumoCard icon={<ClipboardCheck className="size-4 text-emerald-600" />} title="Cirurgia segura">
                  {["entrada", "pausa", "saida"].map((etapa) => { const item = checks.find((check) => check.etapa === etapa); return <div key={etapa} className="mb-2 flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2 text-sm"><span className="font-bold capitalize">{etapa}</span><span className={item?.concluido ? "font-black text-emerald-700" : "font-bold text-amber-700"}>{item?.concluido ? `Concluído ${fmt(item.concluido_em)}` : "Pendente"}</span></div>; })}
                </ResumoCard>

                <ResumoCard icon={<Syringe className="size-4 text-violet-600" />} title="Anestesia">
                  {anestesia ? <div className="space-y-1 text-sm text-slate-700"><p><b>Técnica:</b> {anestesia.tecnica ?? "—"}</p><p><b>ASA:</b> {anestesia.asa ?? "—"}</p><p><b>Via aérea:</b> {anestesia.via_aerea ?? "—"}</p><p className="text-xs text-slate-500">{fmt(anestesia.inicio_em)} → {fmt(anestesia.fim_em)}</p>{anestesia.observacoes ? <p className="mt-2 text-xs">{anestesia.observacoes}</p> : null}</div> : <Vazio />}
                </ResumoCard>

                <ResumoCard icon={<Activity className="size-4 text-cyan-600" />} title="RPA">
                  {rpa ? <div className="space-y-1 text-sm text-slate-700"><p><b>Status:</b> {rpa.status}</p><p><b>Aldrete:</b> {rpa.aldrete_entrada ?? "—"} → {rpa.aldrete_alta ?? "—"}</p><p><b>Dor:</b> {rpa.dor ?? "—"} · <b>Destino:</b> {rpa.destino ?? "—"}</p><p className="text-xs text-slate-500">Alta {fmt(rpa.alta_em)}</p>{rpa.intercorrencias ? <p className="mt-2 text-xs">{rpa.intercorrencias}</p> : null}</div> : <Vazio />}
                </ResumoCard>
              </div>

              <div className="grid gap-4 px-5 pb-5 xl:grid-cols-2">
                <ResumoCard icon={<PackageCheck className="size-4 text-brand-600" />} title="OPME / implantes">
                  {itensOpme.length ? <div className="space-y-2">{itensOpme.map((item) => <div key={item.id} className="rounded-xl bg-slate-50 p-3 text-sm"><div className="flex justify-between gap-2"><b>{item.item}</b><span className="text-xs font-black text-brand-700">{item.status}</span></div><p className="mt-1 text-xs text-slate-500">Qtd. {item.quantidade} · código {item.codigo ?? "—"} · lote {item.lote ?? "—"} · série {item.serie ?? "—"} · ANVISA {item.registro_anvisa ?? "—"}</p></div>)}</div> : <Vazio />}
                </ResumoCard>

                <ResumoCard icon={<ShieldCheck className="size-4 text-emerald-600" />} title="Rastreabilidade CME">
                  {ciclosVinculados.length ? <div className="space-y-2">{ciclosVinculados.map((vinculo) => { const ciclo = cicloMap.get(vinculo.ciclo_id); return <div key={vinculo.ciclo_id} className="rounded-xl bg-emerald-50/60 p-3 text-sm"><div className="flex justify-between gap-2"><b>{ciclo?.codigo_ciclo ?? vinculo.ciclo_id}</b><span className="text-xs font-black text-emerald-700">{ciclo?.status ?? "vinculado"}</span></div><p className="mt-1 text-xs text-slate-500">{ciclo?.metodo ?? "método não informado"} · {ciclo?.equipamento ?? "equipamento não informado"} · liberado {fmt(ciclo?.liberado_em)}</p>{vinculo.observacoes ? <p className="mt-1 text-xs font-semibold text-slate-700">{vinculo.observacoes}</p> : null}</div>; })}</div> : <Vazio />}
                </ResumoCard>
              </div>

              <div className="border-t border-slate-100 p-5">
                <div className="mb-3 flex items-center gap-2"><Scissors className="size-4 text-brand-600" /><h3 className="font-black text-slate-900">Linha do tempo operacional</h3></div>
                {timeline.length ? <div className="grid gap-2 md:grid-cols-2">{timeline.map((evento) => <div key={evento.id} className="rounded-xl bg-slate-50 px-3 py-2"><p className="text-sm font-bold text-slate-800">{eventoLabel(evento.tipo_evento)}{evento.status_novo ? ` · ${statusLabel(evento.status_novo)}` : ""}</p><p className="text-xs text-slate-500">{fmt(evento.created_at)}</p></div>)}</div> : <Vazio />}
              </div>
            </article>
          );
        })}

        {!cirurgias.length ? <div className="his-card p-10 text-center"><Scissors className="mx-auto size-8 text-slate-300" /><p className="mt-3 font-black text-slate-700">Nenhum registro cirúrgico acessível para este paciente.</p><p className="mt-1 text-sm text-slate-500">Quando uma cirurgia for programada ou executada, o registro aparecerá aqui automaticamente.</p></div> : null}
      </div>
    </SectionPage>
  );
}

function Kpi({ label, value }: { label: string; value: number }) { return <div className="his-kpi"><p className="text-xs font-black uppercase tracking-wide text-slate-400">{label}</p><p className="mt-2 text-3xl font-black text-slate-950">{value}</p></div>; }
function Info({ label, value }: { label: string; value?: string | null }) { return <div className="rounded-xl bg-slate-50 p-3"><p className="text-[10px] font-black uppercase tracking-wide text-slate-400">{label}</p><p className="mt-1 text-sm font-bold text-slate-800">{value || "—"}</p></div>; }
function Texto({ label, value }: { label: string; value?: string | null }) { return <div className="rounded-xl border border-slate-100 p-3"><p className="text-[10px] font-black uppercase tracking-wide text-slate-400">{label}</p><p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{value || "—"}</p></div>; }
function ResumoCard({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) { return <section className="rounded-2xl border border-slate-100 p-4"><div className="mb-3 flex items-center gap-2">{icon}<h3 className="font-black text-slate-900">{title}</h3></div>{children}</section>; }
function Vazio() { return <p className="text-sm text-slate-500">Sem registro.</p>; }
function Status({ status }: { status: string }) { const classes = status === "concluida" ? "bg-emerald-50 text-emerald-700" : status === "cancelada" ? "bg-rose-50 text-rose-700" : status === "em_andamento" ? "bg-rose-50 text-rose-700" : status === "recuperacao" ? "bg-violet-50 text-violet-700" : status === "em_preparo" ? "bg-amber-50 text-amber-700" : "bg-brand-50 text-brand-700"; return <span className={`rounded-full px-3 py-1 text-xs font-black ${classes}`}>{statusLabel(status)}</span>; }
