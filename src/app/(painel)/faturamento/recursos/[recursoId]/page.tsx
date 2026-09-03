import Link from "next/link";
import {
  ArrowLeft,
  ArrowUpRight,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  FileText,
  ShieldAlert,
  XCircle,
} from "lucide-react";
import { notFound } from "next/navigation";
import { SectionPage } from "@/components/painel/section-page";
import { createClient } from "@/lib/supabase/server";

function one<T>(rel:T|T[]|null){return Array.isArray(rel)?rel[0]??null:rel;}
function brl(value:number|string|null|undefined){return Number(value??0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});}
function dt(value:string|null|undefined){return value?new Date(value).toLocaleString("pt-BR"):"—";}

export default async function RecursoPage({params}:{params:Promise<{recursoId:string}>}){
  const {recursoId}=await params;
  const supabase=await createClient();
  const [{data:recurso},{data:itens}] = await Promise.all([
    supabase.from("tiss_recursos_glosa").select("id,numero_recurso,numero_lote_recurso,status,valor_total_recursado,protocolo_operadora,enviado_em,retorno_em,created_at,updated_at,convenio:convenios(nome_fantasia,registro_ans)").eq("id",recursoId).maybeSingle(),
    supabase.from("tiss_recurso_itens").select("id,valor_recursado,justificativa,valor_deferido,valor_indeferido,glosa:tiss_glosas(id,codigo_glosa,descricao_glosa,valor_glosado,status,guia:tiss_guias(id,numero_guia_prestador,paciente:pacientes(nome_completo,ra,numero_registro)))").eq("recurso_id",recursoId).order("created_at")
  ]);
  if(!recurso) notFound();

  const conv=one(recurso.convenio);
  const rows=itens??[];
  const totalRecursado=Number(recurso.valor_total_recursado??0);
  const totalGlosado=rows.reduce((sum,item)=>sum+Number(one(item.glosa)?.valor_glosado??0),0);
  const totalDeferido=rows.reduce((sum,item)=>sum+Number(item.valor_deferido??0),0);
  const totalIndeferido=rows.reduce((sum,item)=>sum+Number(item.valor_indeferido??0),0);
  const totalPendente=Math.max(totalRecursado-totalDeferido-totalIndeferido,0);
  const percentualAnalisado=totalRecursado>0?Math.min(100,((totalDeferido+totalIndeferido)/totalRecursado)*100):0;

  return <SectionPage
    eyebrow="Ciclo da receita / Glosas / Recurso"
    title={`Recurso ${recurso.numero_recurso}`}
    description={`${conv?.nome_fantasia??"Convênio"} · ANS ${conv?.registro_ans??"—"}`}
    actions={<Link href="/faturamento/recursos" className="ui-button-secondary"><ArrowLeft className="size-4"/>Voltar aos recursos</Link>}
  >
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      <Info label="Status" value={String(recurso.status).replaceAll("_"," ")} detail={`${rows.length} item(ns)`}/>
      <Info label="Glosa relacionada" value={brl(totalGlosado)} detail="Soma dos itens vinculados"/>
      <Info label="Valor recursado" value={brl(totalRecursado)} detail={`Lote ${recurso.numero_lote_recurso??"—"}`}/>
      <Info label="Deferido" value={brl(totalDeferido)} detail="Reconhecido pela operadora" tone="success"/>
      <Info label="Pendente" value={brl(totalPendente)} detail={`${percentualAnalisado.toFixed(0)}% analisado`} tone={totalPendente>0?"warning":"success"}/>
    </section>

    <section className="mt-5 grid gap-5 xl:grid-cols-[1.15fr_.85fr]">
      <article className="ui-card p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3"><CircleDollarSign className="mt-0.5 size-5 text-brand-700"/><div><h2 className="font-bold text-slate-900">Resultado financeiro do recurso</h2><p className="text-sm text-slate-500">Acompanhe o valor recursado contra o retorno efetivamente registrado pela operadora.</p></div></div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold capitalize text-slate-600">{String(recurso.status).replaceAll("_"," ")}</span>
        </div>
        <div className="mt-5 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-slate-900" style={{width:`${percentualAnalisado}%`}}/></div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <Metric icon={<CheckCircle2 className="size-4 text-emerald-600"/>} label="Deferido" value={brl(totalDeferido)}/>
          <Metric icon={<XCircle className="size-4 text-rose-600"/>} label="Indeferido" value={brl(totalIndeferido)}/>
          <Metric icon={<Clock3 className="size-4 text-amber-600"/>} label="Aguardando retorno" value={brl(totalPendente)}/>
        </div>
      </article>

      <article className="ui-card p-5">
        <div className="flex items-start gap-3"><Clock3 className="mt-0.5 size-5 text-brand-700"/><div><h2 className="font-bold text-slate-900">Linha do tempo</h2><p className="text-sm text-slate-500">Eventos persistidos do recurso.</p></div></div>
        <ol className="mt-5 space-y-4 text-sm">
          <Timeline label="Recurso criado" value={dt(recurso.created_at)} done/>
          <Timeline label="Enviado à operadora" value={dt(recurso.enviado_em)} done={Boolean(recurso.enviado_em)}/>
          <Timeline label="Protocolo da operadora" value={recurso.protocolo_operadora??"—"} done={Boolean(recurso.protocolo_operadora)}/>
          <Timeline label="Retorno recebido" value={dt(recurso.retorno_em)} done={Boolean(recurso.retorno_em)}/>
        </ol>
      </article>
    </section>

    <section className="ui-card mt-5 p-5">
      <div className="flex items-start gap-3"><ShieldAlert className="mt-0.5 size-5 text-amber-600"/><div><h2 className="font-semibold text-slate-900">Governança do retorno e XML</h2><p className="mt-1 text-sm text-slate-600">A criação do recurso é transacional. O registro manual de deferimento/indeferimento e a geração/envio do XML permanecem somente leitura nesta tela até existir RPC transacional e validação XSD oficial da mensagem de Recurso de Glosa. O sistema não grava retorno financeiro por DML direto.</p></div></div>
    </section>

    <section className="ui-card mt-6 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4"><div className="flex items-center gap-2"><FileText className="size-5 text-brand-700"/><div><h2 className="font-semibold text-slate-900">Itens do recurso</h2><p className="text-sm text-slate-500">Justificativa, glosa original e resultado por item.</p></div></div><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{rows.length} item(ns)</span></div>
      {rows.length?<div className="overflow-x-auto"><table className="min-w-[1120px] w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">Guia/Paciente</th><th className="px-4 py-3">Glosa</th><th className="px-4 py-3">Justificativa</th><th className="px-4 py-3 text-right">Glosado</th><th className="px-4 py-3 text-right">Recursado</th><th className="px-4 py-3 text-right">Deferido</th><th className="px-4 py-3 text-right">Indeferido</th><th className="px-4 py-3 text-right">Pendente</th></tr></thead><tbody className="divide-y divide-slate-100">{rows.map(i=>{const glosa=one(i.glosa);const guia=glosa?one(glosa.guia):null;const paciente=guia?one(guia.paciente):null;const pendente=Math.max(Number(i.valor_recursado??0)-Number(i.valor_deferido??0)-Number(i.valor_indeferido??0),0);return <tr key={i.id} className="align-top"><td className="px-4 py-4"><div className="flex items-start justify-between gap-2"><div><p className="font-semibold">{guia?.numero_guia_prestador??"—"}</p><p className="mt-1 text-xs text-slate-500">{paciente?.nome_completo??"Paciente"}</p><p className="text-xs text-slate-400">Registro #{paciente?.numero_registro??"—"} · {paciente?.ra??"—"}</p></div>{guia?.id?<Link href={`/faturamento/guias/${guia.id}`} className="grid size-8 place-items-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50" title="Abrir Guia TISS"><ArrowUpRight className="size-4"/></Link>:null}</div></td><td className="px-4 py-4"><p className="font-medium">{glosa?.codigo_glosa??"—"}</p><p className="mt-1 max-w-64 text-xs text-slate-500">{glosa?.descricao_glosa??""}</p><span className="mt-2 inline-flex rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold capitalize text-slate-600">{glosa?.status??"—"}</span></td><td className="px-4 py-4"><p className="max-w-md whitespace-pre-wrap text-slate-700">{i.justificativa}</p></td><td className="px-4 py-4 text-right font-medium">{brl(glosa?.valor_glosado)}</td><td className="px-4 py-4 text-right font-semibold">{brl(i.valor_recursado)}</td><td className="px-4 py-4 text-right font-semibold text-emerald-700">{brl(i.valor_deferido)}</td><td className="px-4 py-4 text-right font-semibold text-rose-700">{brl(i.valor_indeferido)}</td><td className="px-4 py-4 text-right font-semibold text-amber-700">{brl(pendente)}</td></tr>})}</tbody></table></div>:<p className="p-8 text-center text-sm text-slate-500">Nenhum item vinculado ao recurso.</p>}
    </section>
  </SectionPage>;
}

function Info({label,value,detail,tone="default"}:{label:string;value:string;detail:string;tone?:"default"|"success"|"warning"}){const toneClass=tone==="success"?"text-emerald-700":tone==="warning"?"text-amber-700":"text-slate-950";return <div className="ui-card p-4"><p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p><p className={`mt-2 text-lg font-black capitalize ${toneClass}`}>{value}</p><p className="mt-1 text-xs text-slate-500">{detail}</p></div>}
function Metric({icon,label,value}:{icon:React.ReactNode;label:string;value:string}){return <div className="rounded-xl border border-slate-100 p-3"><div className="flex items-center gap-2 text-xs font-semibold text-slate-500">{icon}{label}</div><p className="mt-2 font-black text-slate-950">{value}</p></div>}
function Timeline({label,value,done}:{label:string;value:string;done:boolean}){return <li className="flex gap-3"><span className={`mt-1 size-2.5 shrink-0 rounded-full ${done?"bg-emerald-500":"bg-slate-200"}`}/><div><p className="font-semibold text-slate-800">{label}</p><p className="mt-0.5 text-xs text-slate-500">{value}</p></div></li>}
