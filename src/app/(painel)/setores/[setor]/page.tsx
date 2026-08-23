import { Activity, BedDouble, FlaskConical, Pill, ScanLine } from "lucide-react";
import { SectionPage } from "@/components/painel/section-page";
import { createClient } from "@/lib/supabase/server";
import { assumirFilaSetorial, concluirFilaSetorial } from "@/modules/fluxo-setorial/actions";

const META: Record<string,{titulo:string;descricao:string;Icon:typeof Pill}> = {
  enfermagem:{titulo:"Fila da Enfermagem",descricao:"Pacientes encaminhados para cuidados e procedimentos de enfermagem.",Icon:Activity},
  farmacia:{titulo:"Fila da Farmácia",descricao:"Pacientes encaminhados para dispensação ou orientação farmacêutica.",Icon:Pill},
  laboratorio:{titulo:"Fila do Laboratório",descricao:"Pacientes encaminhados para coleta e exames laboratoriais.",Icon:FlaskConical},
  imagem:{titulo:"Fila de Diagnóstico por Imagem",descricao:"Pacientes encaminhados para exames de imagem.",Icon:ScanLine},
  internacao:{titulo:"Fila de Internação",descricao:"Pacientes aguardando admissão hospitalar ou movimentação para leito.",Icon:BedDouble},
};

function one<T>(rel:T|T[]|null){return Array.isArray(rel)?rel[0]??null:rel;}

export default async function SetorPage({ params, searchParams }:{params:Promise<{setor:string}>;searchParams:Promise<{atendimento?:string;erro?:string;sucesso?:string}>}){
  const { setor }=await params; const sp=await searchParams; const meta=META[setor] ?? {titulo:"Fila Setorial",descricao:"Fila operacional do setor.",Icon:Activity}; const supabase=await createClient();
  const { data:fila }=await supabase.from("filas_setoriais").select("id,status,prioridade,motivo,created_at,atendimento_id,paciente:pacientes(nome_completo,ra,numero_registro),atendimento:atendimentos(numero_atendimento,setor_atual)").eq("setor_codigo",setor).in("status",["aguardando","chamado","em_atendimento"]).order("created_at",{ascending:true}).limit(200);
  const atual=sp.atendimento ? (fila??[]).find(i=>String(i.atendimento_id)===sp.atendimento) : null;
  const Icon=meta.Icon;
  return <SectionPage eyebrow={`Assistencial / Setores / ${setor}`} title={meta.titulo} description={meta.descricao}>
    {sp.erro?<div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">Não foi possível atualizar esta fila.</div>:null}{sp.sucesso?<div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">Atendimento setorial concluído.</div>:null}
    {atual?<div className="ui-card mb-5 p-5"><div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-brand-50 text-brand-700"><Icon className="size-5"/></span><div><h2 className="font-semibold text-slate-900">Em atendimento no setor</h2><p className="text-sm text-slate-500">Finalize quando a etapa estiver concluída. O paciente retornará ao fluxo assistencial.</p></div></div><form action={concluirFilaSetorial} className="mt-4"><input type="hidden" name="fila_id" value={atual.id}/><input type="hidden" name="setor_codigo" value={setor}/><button className="ui-button-primary">Concluir etapa do setor</button></form></div>:null}
    <div className="space-y-3">{fila?.length?fila.map(item=>{const p=one(item.paciente);const a=one(item.atendimento);return <div key={item.id} className="ui-card p-5"><div className="flex flex-wrap items-start justify-between gap-4"><div><div className="flex items-center gap-2"><h2 className="font-semibold text-slate-900">{p?.nome_completo??"Paciente"}</h2><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${item.prioridade==="emergencia"?"bg-rose-100 text-rose-700":item.prioridade==="preferencial"?"bg-amber-100 text-amber-700":"bg-emerald-100 text-emerald-700"}`}>{item.prioridade}</span></div><p className="mt-1 text-sm text-slate-500">Atendimento #{a?.numero_atendimento??"—"} · Registro #{p?.numero_registro??"—"} · {p?.ra??"—"}</p>{item.motivo?<p className="mt-2 text-sm text-slate-700"><b>Motivo:</b> {item.motivo}</p>:null}</div>{item.status!=="em_atendimento"?<form action={assumirFilaSetorial}><input type="hidden" name="fila_id" value={item.id}/><input type="hidden" name="setor_codigo" value={setor}/><button className="ui-button-primary">Iniciar atendimento</button></form>:<span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">Em atendimento</span>}</div></div>;}):<div className="ui-card p-8 text-center text-sm text-slate-500">Nenhum paciente aguardando neste setor.</div>}</div>
  </SectionPage>;
}
