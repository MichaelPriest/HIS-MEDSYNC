import Link from "next/link";
import { BedDouble, ClipboardCheck, HeartPulse, Stethoscope } from "lucide-react";
import { NursingEvolutionBackgroundForm } from "@/components/enfermagem/nursing-evolution-background-form";
import { SectionPage } from "@/components/painel/section-page";
import { getAssistencialContext } from "@/modules/assistencial/context";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Paciente = { nome_completo:string|null; ra:string|null; numero_registro:string|null };
type Atendimento = { id:string; numero_atendimento:string|number|null; paciente:Paciente|Paciente[]|null };
type Internacao = { id:string; atendimento_id:string; setor:string|null; quarto:string|null; leito:string|null; acomodacao:string|null; atendimento:Atendimento|Atendimento[]|null };
type Prescricao = { id:string; atendimento_id:string; tipo:string; item:string; dose:string|null; via:string|null; frequencia:string|null; horarios:unknown; status:string };
type Evolucao = { id:string; atendimento_id:string; avaliacao:string|null; intervencoes:string|null; resposta:string|null; plano:string|null; assinado_em:string|null; profissional:{nome_completo:string}|{nome_completo:string}[]|null };

function one<T>(v:T|T[]|null){return Array.isArray(v)?v[0]??null:v;}
function fmt(v:string|null|undefined){return v?new Intl.DateTimeFormat("pt-BR",{dateStyle:"short",timeStyle:"short",timeZone:"America/Sao_Paulo"}).format(new Date(v)):"—";}

export default async function EnfermagemAndaresPage({ searchParams }:{ searchParams:Promise<{sucesso?:string;erro?:string;setor?:string}>}){
  const sp=await searchParams;
  const {supabase,empresaId,unidadeId}=await getAssistencialContext();
  let internacoesQuery=supabase.from("internacoes").select("id,atendimento_id,setor,quarto,leito,acomodacao,atendimento:atendimentos(id,numero_atendimento,paciente:pacientes(nome_completo,ra,numero_registro))").eq("empresa_id",empresaId).eq("unidade_id",unidadeId).is("data_alta",null).order("setor").order("leito");
  if(sp.setor) internacoesQuery=internacoesQuery.eq("setor",sp.setor);
  const {data:internacoesData}=await internacoesQuery;
  const internacoes=(internacoesData??[]) as unknown as Internacao[];
  const ids=internacoes.map(i=>i.atendimento_id);
  const [prescRes,evolRes]=ids.length?await Promise.all([
    supabase.from("prescricoes").select("id,atendimento_id,tipo,item,dose,via,frequencia,horarios,status").in("atendimento_id",ids).eq("empresa_id",empresaId).eq("unidade_id",unidadeId).in("status",["ativa","assinada"]).order("created_at"),
    supabase.from("evolucoes_multiprofissionais").select("id,atendimento_id,avaliacao,intervencoes,resposta,plano,assinado_em,profissional:profissionais(nome_completo)").in("atendimento_id",ids).eq("empresa_id",empresaId).eq("unidade_id",unidadeId).eq("area","enfermagem").order("assinado_em",{ascending:false}),
  ]):[{data:[]},{data:[]}];
  const prescricoes=(prescRes.data??[]) as unknown as Prescricao[];
  const evolucoes=(evolRes.data??[]) as unknown as Evolucao[];
  const setores=[...new Set(internacoes.map(i=>i.setor).filter(Boolean))] as string[];

  return <SectionPage eyebrow="Assistencial / Enfermagem" title="Andares e Unidades de Internação" description="Visão assistencial por setor, quarto e leito, com prescrição ativa, checagem e evolução de Enfermagem.">
    {sp.sucesso?<div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">Registro realizado com sucesso.</div>:null}
    {sp.erro?<div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">Não foi possível concluir: {decodeURIComponent(sp.erro)}.</div>:null}
    <div className="mb-5 flex flex-wrap gap-2"><Link href="/assistencial/enfermagem/andares" className="btn-secondary">Todos os setores</Link>{setores.map(s=><Link key={s} href={`/assistencial/enfermagem/andares?setor=${encodeURIComponent(s)}`} className="btn-secondary">{s}</Link>)}<Link href="/assistencial/enfermagem/pronto-socorro" className="btn-secondary">Pronto-Socorro</Link></div>
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><div className="his-kpi"><p className="text-xs font-black uppercase text-slate-400">Pacientes internados</p><p className="mt-2 text-3xl font-black text-brand-700">{internacoes.length}</p></div><div className="his-kpi"><p className="text-xs font-black uppercase text-slate-400">Setores</p><p className="mt-2 text-3xl font-black text-slate-800">{setores.length}</p></div><div className="his-kpi"><p className="text-xs font-black uppercase text-slate-400">Prescrições ativas</p><p className="mt-2 text-3xl font-black text-emerald-700">{prescricoes.length}</p></div><div className="his-kpi"><p className="text-xs font-black uppercase text-slate-400">Evoluções enfermagem</p><p className="mt-2 text-3xl font-black text-violet-700">{evolucoes.length}</p></div></section>
    <div className="mt-6 space-y-4">{internacoes.map(internacao=>{const atendimento=one(internacao.atendimento);const paciente=one(atendimento?.paciente??null);const itens=prescricoes.filter(p=>p.atendimento_id===internacao.atendimento_id);const ultima=evolucoes.find(e=>e.atendimento_id===internacao.atendimento_id);return <article key={internacao.id} className="his-card p-5"><div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between"><div><div className="flex items-center gap-2"><BedDouble className="size-5 text-brand-700"/><h2 className="font-black text-slate-950">{paciente?.nome_completo??"Paciente"}</h2></div><p className="mt-1 text-sm text-slate-600">{internacao.setor??"Setor"} · Quarto {internacao.quarto??"—"} · Leito {internacao.leito??"—"} · Atend. #{atendimento?.numero_atendimento??"—"}</p><p className="mt-1 text-xs text-slate-500">RA {paciente?.ra??"—"} · Registro {paciente?.numero_registro??"—"}</p></div><div className="flex flex-wrap gap-2"><Link href={`/assistencial/enfermagem?atendimento=${internacao.atendimento_id}&retorno=${encodeURIComponent('/assistencial/enfermagem/andares')}`} className="ui-button-primary"><ClipboardCheck className="size-4"/>Checar prescrição</Link><Link href={`/prontuario/${internacao.atendimento_id}`} className="btn-secondary"><Stethoscope className="size-4"/>Prontuário</Link></div></div>
      <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200"><table className="min-w-full text-sm"><thead className="bg-slate-50 text-left text-xs uppercase text-slate-500"><tr><th className="px-3 py-2">Tipo</th><th className="px-3 py-2">Item</th><th className="px-3 py-2">Dose/Via</th><th className="px-3 py-2">Frequência</th><th className="px-3 py-2">Horários</th></tr></thead><tbody>{itens.length?itens.map(p=><tr key={p.id} className="border-t"><td className="px-3 py-2 font-bold">{p.tipo}</td><td className="px-3 py-2">{p.item}</td><td className="px-3 py-2">{[p.dose,p.via].filter(Boolean).join(" · ")||"—"}</td><td className="px-3 py-2">{p.frequencia??"—"}</td><td className="px-3 py-2">{Array.isArray(p.horarios)?p.horarios.join(", "):"—"}</td></tr>):<tr><td colSpan={5} className="px-3 py-5 text-center text-slate-500">Sem itens ativos.</td></tr>}</tbody></table></div>
      {ultima?<div className="mt-4 rounded-xl bg-violet-50 p-3 text-sm"><p className="font-black text-violet-900">Última evolução · {fmt(ultima.assinado_em)} · {one(ultima.profissional)?.nome_completo??"Enfermagem"}</p><p className="mt-1 text-violet-800">{ultima.avaliacao??ultima.intervencoes??ultima.resposta??ultima.plano??"—"}</p></div>:null}
      <details className="mt-4 rounded-xl border border-slate-200"><summary className="cursor-pointer px-4 py-3 font-black text-slate-800"><span className="inline-flex items-center gap-2"><HeartPulse className="size-4"/>Registrar evolução de Enfermagem</span></summary><NursingEvolutionBackgroundForm atendimentoId={internacao.atendimento_id}><textarea name="avaliacao" className="ui-input min-h-24" placeholder="Avaliação de Enfermagem"/><textarea name="intervencoes" className="ui-input min-h-24" placeholder="Intervenções realizadas"/><textarea name="resposta" className="ui-input min-h-24" placeholder="Resposta/evolução do paciente"/><textarea name="plano" className="ui-input min-h-24" placeholder="Plano e cuidados para o próximo período"/></NursingEvolutionBackgroundForm></details>
    </article>})}{!internacoes.length?<div className="his-card p-8 text-center text-sm text-slate-500">Nenhum paciente internado encontrado para o filtro atual.</div>:null}</div>
  </SectionPage>;
}