import { AlertTriangle, Clock3, Stethoscope, UserRoundSearch } from "lucide-react";
import { SectionPage } from "@/components/painel/section-page";
import { requireAnyPermission } from "@/lib/permissions/server";
import { solicitarAvaliacaoMedicaAction } from "@/modules/prontuario-medico/avaliacao-medica-actions";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Solicitacao = {
  id:string; especialidade:string; prioridade:string; motivo:string; observacoes:string|null; status:string; solicitada_em:string; parecer:string|null;
  solicitante:{nome_completo:string|null}|{nome_completo:string|null}[]|null;
  responsavel:{nome_completo:string|null}|{nome_completo:string|null}[]|null;
};
const one=<T,>(v:T|T[]|null):T|null=>Array.isArray(v)?v[0]??null:v;
const fmt=(v:string)=>new Intl.DateTimeFormat("pt-BR",{dateStyle:"short",timeStyle:"short",timeZone:"America/Sao_Paulo"}).format(new Date(v));

export default async function AvaliacoesMedicasPage({params,searchParams}:{params:Promise<{atendimentoId:string}>;searchParams:Promise<{sucesso?:string;erro?:string}>}){
  const {atendimentoId}=await params; const sp=await searchParams;
  const {supabase,empresaId,unidadeId}=await requireAnyPermission(["prontuario.visualizar","prescricao.visualizar"]);
  const [solRes,profRes]=await Promise.all([
    supabase.from("solicitacoes_avaliacao_medica").select("id,especialidade,prioridade,motivo,observacoes,status,solicitada_em,parecer,solicitante:profissionais!solicitante_profissional_id(nome_completo),responsavel:profissionais!profissional_responsavel_id(nome_completo)").eq("empresa_id",empresaId).eq("unidade_id",unidadeId).eq("atendimento_id",atendimentoId).order("solicitada_em",{ascending:false}),
    supabase.from("profissionais").select("especialidade").eq("empresa_id",empresaId).eq("ativo",true).not("especialidade","is",null).limit(1000),
  ]);
  const solicitacoes=(solRes.data??[]) as unknown as Solicitacao[];
  const especialidades=[...new Set((profRes.data??[]).flatMap((p)=>String(p.especialidade??"").split(",")).map((v)=>v.trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"pt-BR"));
  const abertas=solicitacoes.filter((s)=>!["concluida","cancelada"].includes(s.status));
  return <SectionPage eyebrow="Prontuário / Episódio" title="Avaliações médicas e pareceres" description="Solicite avaliação de outra especialidade sem criar outro prontuário ou perder o vínculo com o atendimento atual.">
    {sp.sucesso?<div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">Avaliação solicitada e vinculada ao episódio.</div>:null}
    {sp.erro?<div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">Não foi possível registrar a solicitação. Revise os dados e tente novamente.</div>:null}
    <section className="grid gap-3 sm:grid-cols-3"><div className="his-kpi"><p className="text-xs font-black uppercase text-slate-400">Solicitações</p><p className="mt-2 text-3xl font-black">{solicitacoes.length}</p></div><div className="his-kpi"><p className="text-xs font-black uppercase text-slate-400">Em aberto</p><p className="mt-2 text-3xl font-black text-amber-700">{abertas.length}</p></div><div className="his-kpi"><p className="text-xs font-black uppercase text-slate-400">Concluídas</p><p className="mt-2 text-3xl font-black text-emerald-700">{solicitacoes.filter(s=>s.status==="concluida").length}</p></div></section>
    <section className="mt-5 grid gap-5 xl:grid-cols-[0.85fr_1.15fr]">
      <form action={solicitarAvaliacaoMedicaAction} className="his-card p-6"><input type="hidden" name="atendimento_id" value={atendimentoId}/><div className="mb-4 flex items-center gap-3"><UserRoundSearch className="size-5 text-brand-700"/><div><h2 className="font-black">Solicitar avaliação médica</h2><p className="text-sm text-slate-500">A solicitação permanece dentro deste episódio.</p></div></div><div className="grid gap-3"><label className="text-sm font-bold">Especialidade<select name="especialidade" required defaultValue="" className="ui-input mt-1 w-full"><option value="">Selecione</option>{especialidades.map(e=><option key={e} value={e}>{e}</option>)}</select></label><label className="text-sm font-bold">Prioridade<select name="prioridade" className="ui-input mt-1 w-full" defaultValue="rotina"><option value="rotina">Rotina</option><option value="urgente">Urgente</option><option value="emergencia">Emergência</option></select></label><label className="text-sm font-bold">Motivo<textarea name="motivo" required rows={4} className="ui-input mt-1 w-full" placeholder="Descreva objetivamente a razão da avaliação."/></label><label className="text-sm font-bold">Observações<textarea name="observacoes" rows={3} className="ui-input mt-1 w-full" placeholder="Informações adicionais, hipótese, exames ou condutas já realizadas."/></label><button className="ui-button-primary justify-self-end"><Stethoscope className="size-4"/>Solicitar avaliação</button></div></form>
      <div className="his-card overflow-hidden"><div className="border-b border-slate-100 p-5"><h2 className="font-black">Histórico do episódio</h2><p className="text-sm text-slate-500">Solicitações, responsáveis e pareceres ficam rastreados no mesmo atendimento.</p></div><div className="divide-y divide-slate-100">{solicitacoes.map(s=>{const solicitante=one(s.solicitante),responsavel=one(s.responsavel);return <article key={s.id} className="p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-black text-slate-950">{s.especialidade}</p><p className="mt-1 text-sm text-slate-600">{s.motivo}</p></div><span className={`rounded-full px-2.5 py-1 text-xs font-black ${s.prioridade==="emergencia"?"bg-rose-100 text-rose-700":s.prioridade==="urgente"?"bg-amber-100 text-amber-700":"bg-slate-100 text-slate-700"}`}>{s.prioridade}</span></div><div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500"><span className="inline-flex items-center gap-1"><Clock3 className="size-3"/>{fmt(s.solicitada_em)}</span><span>Solicitante: {solicitante?.nome_completo??"—"}</span><span>Status: <b>{s.status}</b></span>{responsavel?<span>Responsável: {responsavel.nome_completo}</span>:null}</div>{s.observacoes?<p className="mt-3 text-xs text-slate-500">Obs.: {s.observacoes}</p>:null}{s.parecer?<div className="mt-3 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900"><b>Parecer:</b> {s.parecer}</div>:null}</article>})}{!solicitacoes.length?<div className="p-10 text-center text-sm text-slate-500"><AlertTriangle className="mx-auto mb-2 size-5"/>Nenhuma avaliação solicitada neste episódio.</div>:null}</div></div>
    </section>
  </SectionPage>;
}
