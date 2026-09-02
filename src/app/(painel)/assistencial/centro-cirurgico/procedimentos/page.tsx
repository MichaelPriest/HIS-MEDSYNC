import Link from "next/link";
import { Activity, CheckCircle2, Clock3, ListChecks, Play, Square, UsersRound } from "lucide-react";
import { ProcedureTeamForm } from "@/components/centro-cirurgico/procedure-team-form";
import { SurgicalBackgroundForm } from "@/components/centro-cirurgico/surgical-background-form";
import { SurgeryProcedureAddForm } from "@/components/centro-cirurgico/surgery-procedure-add-form";
import { SectionPage } from "@/components/painel/section-page";
import { requireAnyPermission } from "@/lib/permissions/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Rel<T> = T | T[] | null;
type Cirurgia = {
  id: string;
  atendimento_id: string;
  procedimento: string;
  status: string;
  sala: string | null;
  inicio_previsto: string | null;
  inicio_em: string | null;
  paciente: Rel<{ nome_completo: string | null; nome_social: string | null; ra: string | null }>;
  atendimento: Rel<{ cobertura: string | null; convenio: Rel<{ nome_fantasia: string | null }> }>;
};
type Procedimento = {
  id: string;
  cirurgia_id: string;
  atendimento_id: string;
  tabela_item_id: string | null;
  codigo: string | null;
  codigo_tuss: string | null;
  descricao: string;
  porte: string | null;
  porte_anestesico: string | null;
  tabela_referencia: string | null;
  requisitos_equipe: Record<string, unknown> | null;
  sequencia: number;
  principal: boolean;
  status: string;
  inicio_em: string | null;
  fim_em: string | null;
  observacoes: string | null;
};
type Equipe = {
  id: string;
  cirurgia_procedimento_id: string | null;
  profissional_id: string | null;
  papel: string;
  principal: boolean;
  ordem_participacao: number | null;
  faturavel: boolean;
  entrada_em: string | null;
  saida_em: string | null;
  observacoes: string | null;
};
type Params = { cirurgia?: string };

const one = <T,>(value: Rel<T>): T | null => Array.isArray(value) ? value[0] ?? null : value;
const fmt = (value?: string | null) => value ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(value)) : "—";
const duration = (start?: string | null, end?: string | null) => {
  if (!start) return "—";
  const final = end ? new Date(end).getTime() : Date.now();
  const minutes = Math.max(0, Math.round((final - new Date(start).getTime()) / 60000));
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return hours ? `${hours}h ${String(rest).padStart(2, "0")}min` : `${minutes} min`;
};
const papelLabel = (value: string) => ({
  cirurgiao_principal: "Cirurgião principal",
  cirurgiao_auxiliar: "Cirurgião auxiliar",
  instrumentador: "Instrumentador",
  anestesista: "Anestesista",
  auxiliar_anestesia: "Auxiliar do anestesista",
  pediatra: "Pediatra em sala",
  neonatologista: "Neonatologista",
  perfusionista: "Perfusionista",
  enfermeiro: "Enfermeiro",
  tecnico_enfermagem: "Técnico de enfermagem",
  circulante_sala: "Circulante de sala",
  tecnico_radiologia: "Técnico de radiologia",
  outro: "Outro participante",
}[value] ?? value.replaceAll("_", " "));

export default async function ProcedimentosCirurgicosPage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const { supabase, empresaId, unidadeId } = await requireAnyPermission([
    "centro_cirurgico.visualizar",
    "centro_cirurgico.operar",
    "centro_cirurgico.gerenciar",
  ]);
  if (!unidadeId) return null;

  const { data: cirData } = await supabase
    .from("cirurgias")
    .select("id,atendimento_id,procedimento,status,sala,inicio_previsto,inicio_em,paciente:pacientes(nome_completo,nome_social,ra),atendimento:atendimentos(cobertura,convenio:convenios(nome_fantasia))")
    .eq("empresa_id", empresaId)
    .eq("unidade_id", unidadeId)
    .not("status", "in", "(concluida,cancelada)")
    .order("inicio_previsto", { ascending: true, nullsFirst: false })
    .limit(120);
  const cirurgias = (cirData ?? []) as unknown as Cirurgia[];
  const selecionada = cirurgias.find((item) => item.id === params.cirurgia) ?? cirurgias[0] ?? null;

  let procedimentos: Procedimento[] = [];
  let equipe: Equipe[] = [];
  if (selecionada) {
    const [procReq, teamReq] = await Promise.all([
      supabase.from("cirurgia_procedimentos").select("id,cirurgia_id,atendimento_id,tabela_item_id,codigo,codigo_tuss,descricao,porte,porte_anestesico,tabela_referencia,requisitos_equipe,sequencia,principal,status,inicio_em,fim_em,observacoes").eq("cirurgia_id", selecionada.id).order("sequencia"),
      supabase.from("cirurgia_equipe").select("id,cirurgia_procedimento_id,profissional_id,papel,principal,ordem_participacao,faturavel,entrada_em,saida_em,observacoes").eq("cirurgia_id", selecionada.id).order("created_at"),
    ]);
    procedimentos = (procReq.data ?? []) as unknown as Procedimento[];
    equipe = (teamReq.data ?? []) as Equipe[];
  }

  const professionalIds = [...new Set(equipe.map((item) => item.profissional_id).filter((id): id is string => Boolean(id)))];
  const profReq = professionalIds.length
    ? await supabase.from("profissionais").select("id,nome_completo,conselho,numero_conselho,uf_conselho,especialidade").eq("empresa_id", empresaId).in("id", professionalIds)
    : { data: [] as { id: string; nome_completo: string; conselho: string | null; numero_conselho: string | null; uf_conselho: string | null; especialidade: string | null }[] };
  const profissionais = new Map((profReq.data ?? []).map((item) => [item.id, item]));
  const atendimento = selecionada ? one(selecionada.atendimento) : null;
  const convenio = atendimento ? one(atendimento.convenio) : null;
  const paciente = selecionada ? one(selecionada.paciente) : null;
  const conveniado = atendimento?.cobertura === "convenio";

  return <SectionPage
    eyebrow="Assistencial / Centro Cirúrgico / Procedimentos e equipe"
    title="Procedimentos do ato cirúrgico"
    description="Vários procedimentos no mesmo ato, equipe por papel e horários individuais acionados pelo sistema."
    actions={<Link href="/assistencial/centro-cirurgico/painel-salas" className="ui-button-secondary"><Activity className="size-4" />Painel de salas</Link>}
  >
    <section className="grid gap-5 xl:grid-cols-[0.72fr_1.28fr]">
      <aside className="his-card p-5">
        <div className="mb-4"><h2 className="font-black text-slate-950">Casos ativos</h2><p className="mt-1 text-sm text-slate-500">Selecione a cirurgia para operar seus procedimentos.</p></div>
        <div className="space-y-2">{cirurgias.map((cirurgia) => { const p=one(cirurgia.paciente); const active=selecionada?.id===cirurgia.id; return <Link key={cirurgia.id} href={`/assistencial/centro-cirurgico/procedimentos?cirurgia=${encodeURIComponent(cirurgia.id)}` as never} className={`block rounded-2xl border p-4 transition ${active?"border-brand-300 bg-brand-50/60":"border-slate-100 hover:border-slate-200"}`}><div className="flex items-start justify-between gap-2"><div><p className="font-black text-slate-950">{p?.nome_social||p?.nome_completo||"Paciente"}</p><p className="mt-1 text-xs text-slate-500">RA {p?.ra??"—"} · {cirurgia.sala??"sala não definida"}</p></div><span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-black text-slate-700">{cirurgia.status.replaceAll("_"," ")}</span></div><p className="mt-2 text-sm font-semibold text-slate-700">{cirurgia.procedimento}</p><p className="mt-1 text-xs text-slate-500">Previsto {fmt(cirurgia.inicio_previsto)}</p></Link>; })}{!cirurgias.length?<p className="py-8 text-center text-sm text-slate-500">Nenhuma cirurgia ativa.</p>:null}</div>
      </aside>

      <div className="space-y-5">
        {selecionada ? <>
          <article className="his-card p-6">
            <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-wide text-brand-600">Ato selecionado</p><h2 className="mt-1 text-xl font-black text-slate-950">{paciente?.nome_social||paciente?.nome_completo||"Paciente"}</h2><p className="mt-1 text-sm text-slate-500">RA {paciente?.ra??"—"} · {selecionada.sala??"sala não definida"} · {selecionada.status.replaceAll("_"," ")}</p></div><div className="text-right text-xs text-slate-500"><p>Previsto {fmt(selecionada.inicio_previsto)}</p><p>Início do ato {fmt(selecionada.inicio_em)}</p></div></div>
          </article>

          <article className="his-card p-6"><div className="mb-4"><h2 className="font-black text-slate-950">Adicionar outro procedimento</h2><p className="mt-1 text-sm text-slate-500">O procedimento principal é preservado; os demais ficam vinculados ao mesmo ato e atendimento.</p></div><SurgeryProcedureAddForm cirurgiaId={selecionada.id} atendimentoId={selecionada.atendimento_id} conveniado={Boolean(conveniado)} convenioNome={convenio?.nome_fantasia??null} /></article>

          <div className="space-y-4">{procedimentos.map((proc) => {
            const membros=equipe.filter((item)=>item.cirurgia_procedimento_id===proc.id);
            const requisitos=(proc.requisitos_equipe??{}) as {quantidade_auxiliares?:number;anestesista?:boolean;instrumentador?:boolean;pediatra?:boolean;neonatologista?:boolean;permite_outros?:boolean};
            const auxRequired=Number(requisitos.quantidade_auxiliares??0);
            const auxPresent=membros.filter((m)=>m.papel==="cirurgiao_auxiliar").length;
            return <article key={proc.id} className={`his-card overflow-hidden ${proc.status==="em_andamento"?"ring-2 ring-rose-200":""}`}>
              <div className="border-b border-slate-100 p-5"><div className="flex flex-wrap items-start justify-between gap-4"><div><div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-black text-brand-700">#{proc.sequencia}{proc.principal?" · principal":""}</span><Status status={proc.status}/></div><h3 className="mt-3 text-lg font-black text-slate-950">{proc.descricao}</h3><p className="mt-1 text-xs text-slate-500">{proc.codigo_tuss||proc.codigo||"sem código"} · porte {proc.porte??"—"} · anest. {proc.porte_anestesico??"—"}{proc.tabela_referencia?` · ${proc.tabela_referencia}`:""}</p></div><div className="text-right text-xs text-slate-500"><p>Início {fmt(proc.inicio_em)}</p><p>Fim {fmt(proc.fim_em)}</p><p className="mt-1 font-black text-slate-700">Duração {duration(proc.inicio_em,proc.fim_em)}</p></div></div>
                <div className="mt-4 flex flex-wrap gap-2">{proc.status==="previsto"?<SurgicalBackgroundForm kind="procedure-action"><input type="hidden" name="cirurgia_id" value={selecionada.id}/><input type="hidden" name="cirurgia_procedimento_id" value={proc.id}/><input type="hidden" name="acao" value="iniciar"/><button disabled={selecionada.status!=="em_andamento"} className="ui-button-primary disabled:cursor-not-allowed disabled:opacity-50"><Play className="size-4"/>Iniciar procedimento</button></SurgicalBackgroundForm>:null}{proc.status==="em_andamento"?<SurgicalBackgroundForm kind="procedure-action"><input type="hidden" name="cirurgia_id" value={selecionada.id}/><input type="hidden" name="cirurgia_procedimento_id" value={proc.id}/><input type="hidden" name="acao" value="finalizar"/><button className="rounded-xl bg-rose-700 px-4 py-2 text-sm font-black text-white hover:bg-rose-800"><Square className="mr-2 inline size-4"/>Finalizar procedimento</button></SurgicalBackgroundForm>:null}</div>
              </div>

              <div className="grid gap-5 p-5 xl:grid-cols-[0.8fr_1.2fr]">
                <section><h4 className="font-black text-slate-900">Equipe prevista</h4><div className="mt-3 flex flex-wrap gap-2"><Requirement label="Cirurgião principal" ok={membros.some((m)=>m.papel==="cirurgiao_principal")}/>{auxRequired>0?<Requirement label={`Auxiliares ${auxPresent}/${auxRequired}`} ok={auxPresent>=auxRequired}/>:null}{requisitos.instrumentador?<Requirement label="Instrumentador" ok={membros.some((m)=>m.papel==="instrumentador")}/>:null}{requisitos.anestesista?<Requirement label="Anestesista" ok={membros.some((m)=>m.papel==="anestesista")}/>:null}{requisitos.pediatra?<Requirement label="Pediatra" ok={membros.some((m)=>m.papel==="pediatra")}/>:null}{requisitos.neonatologista?<Requirement label="Neonatologista" ok={membros.some((m)=>m.papel==="neonatologista")}/>:null}</div>
                  <div className="mt-4 space-y-2">{membros.map((membro)=>{const p=membro.profissional_id?profissionais.get(membro.profissional_id):null;return <div key={membro.id} className="rounded-xl border border-slate-100 bg-slate-50 p-3 text-sm"><div className="flex flex-wrap items-start justify-between gap-2"><div><b>{p?.nome_completo??"Profissional"}</b><p className="mt-1 text-xs text-slate-500">{papelLabel(membro.papel)}{membro.ordem_participacao?` · ${membro.ordem_participacao}º`:""}{p?.conselho?` · ${p.conselho} ${p.numero_conselho??""}/${p.uf_conselho??""}`:""}</p></div><span className={`rounded-full px-2 py-1 text-[10px] font-black ${membro.faturavel?"bg-emerald-50 text-emerald-700":"bg-slate-200 text-slate-600"}`}>{membro.faturavel?"previsto em contrato":"registro clínico"}</span></div><p className="mt-2 text-xs text-slate-500">Entrada {fmt(membro.entrada_em)} · saída {fmt(membro.saida_em)}</p></div>})}{!membros.length?<p className="text-sm text-slate-500">Equipe ainda não lançada para este procedimento.</p>:null}</div>
                </section>
                <section className="rounded-2xl border border-slate-100 p-4"><div className="mb-3 flex items-center gap-2"><UsersRound className="size-4 text-brand-700"/><h4 className="font-black text-slate-900">Lançar equipe da sala</h4></div><ProcedureTeamForm empresaId={empresaId} cirurgiaId={selecionada.id} procedimentoId={proc.id} requisitos={requisitos}/></section>
              </div>
            </article>;
          })}{!procedimentos.length?<div className="his-card p-8 text-center"><ListChecks className="mx-auto size-8 text-slate-300"/><p className="mt-3 font-black text-slate-700">Nenhum procedimento detalhado neste ato.</p></div>:null}</div>
        </> : <div className="his-card p-10 text-center text-sm text-slate-500">Selecione um caso ativo.</div>}
      </div>
    </section>
  </SectionPage>;
}

function Status({status}:{status:string}){const cls=status==="concluido"?"bg-emerald-50 text-emerald-700":status==="em_andamento"?"bg-rose-50 text-rose-700":status==="cancelado"?"bg-slate-200 text-slate-600":"bg-amber-50 text-amber-700";return <span className={`rounded-full px-2.5 py-1 text-xs font-black ${cls}`}>{status.replaceAll("_"," ")}</span>}
function Requirement({label,ok}:{label:string;ok:boolean}){return <span className={`rounded-full px-3 py-1.5 text-xs font-black ${ok?"bg-emerald-50 text-emerald-700":"bg-amber-50 text-amber-800"}`}>{ok?<CheckCircle2 className="mr-1 inline size-3.5"/>:<Clock3 className="mr-1 inline size-3.5"/>}{label}</span>}
