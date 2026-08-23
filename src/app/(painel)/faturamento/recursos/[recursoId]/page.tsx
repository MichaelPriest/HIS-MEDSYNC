import { FileText, ShieldAlert } from "lucide-react";
import { notFound } from "next/navigation";
import { SectionPage } from "@/components/painel/section-page";
import { createClient } from "@/lib/supabase/server";

function one<T>(rel:T|T[]|null){return Array.isArray(rel)?rel[0]??null:rel;}

export default async function RecursoPage({params}:{params:Promise<{recursoId:string}>}){
  const {recursoId}=await params; const supabase=await createClient();
  const [{data:recurso},{data:itens}] = await Promise.all([
    supabase.from("tiss_recursos_glosa").select("id,numero_recurso,numero_lote_recurso,status,valor_total_recursado,protocolo_operadora,enviado_em,retorno_em,created_at,convenio:convenios(nome_fantasia,registro_ans)").eq("id",recursoId).maybeSingle(),
    supabase.from("tiss_recurso_itens").select("id,valor_recursado,justificativa,valor_deferido,valor_indeferido,glosa:tiss_glosas(codigo_glosa,descricao_glosa,valor_glosado,guia:tiss_guias(numero_guia_prestador,paciente:pacientes(nome_completo,ra,numero_registro)))").eq("recurso_id",recursoId).order("created_at")
  ]);
  if(!recurso) notFound(); const conv=one(recurso.convenio);
  return <SectionPage eyebrow="Financeiro / TISS / Recurso" title={`Recurso ${recurso.numero_recurso}`} description={`${conv?.nome_fantasia??"Convênio"} · ANS ${conv?.registro_ans??"—"}`}>
    <div className="grid gap-4 md:grid-cols-4"><Info label="Status" value={String(recurso.status).replaceAll("_"," ")}/><Info label="Valor recursado" value={`R$ ${Number(recurso.valor_total_recursado||0).toLocaleString("pt-BR",{minimumFractionDigits:2})}`}/><Info label="Protocolo" value={recurso.protocolo_operadora??"—"}/><Info label="Lote recurso" value={recurso.numero_lote_recurso??"—"}/></div>
    <section className="ui-card mt-6 p-5"><div className="flex items-start gap-3"><ShieldAlert className="mt-0.5 size-5 text-amber-600"/><div><h2 className="font-semibold text-slate-900">Geração XML do recurso</h2><p className="mt-1 text-sm text-slate-600">O recurso está estruturado no banco, mas a geração/envio do XML permanece bloqueada até validação contra o XSD oficial da mensagem de Recurso de Glosa da versão TISS configurada.</p></div></div></section>
    <section className="ui-card mt-6 overflow-hidden"><div className="flex items-center gap-2 border-b border-slate-100 px-5 py-4"><FileText className="size-5 text-brand-700"/><h2 className="font-semibold text-slate-900">Itens do recurso</h2></div><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">Guia/Paciente</th><th className="px-4 py-3">Glosa</th><th className="px-4 py-3">Justificativa</th><th className="px-4 py-3 text-right">Recursado</th><th className="px-4 py-3 text-right">Deferido</th></tr></thead><tbody className="divide-y divide-slate-100">{itens?.map(i=>{const glosa=one(i.glosa);const guia=glosa?one(glosa.guia):null;const paciente=guia?one(guia.paciente):null;return <tr key={i.id}><td className="px-4 py-3"><p className="font-semibold">{guia?.numero_guia_prestador??"—"}</p><p className="text-xs text-slate-500">{paciente?.nome_completo??"Paciente"} · Registro #{paciente?.numero_registro??"—"} · {paciente?.ra??"—"}</p></td><td className="px-4 py-3"><p className="font-medium">{glosa?.codigo_glosa??"—"}</p><p className="text-xs text-slate-500">{glosa?.descricao_glosa??""}</p></td><td className="px-4 py-3 text-slate-700">{i.justificativa}</td><td className="px-4 py-3 text-right">R$ {Number(i.valor_recursado||0).toLocaleString("pt-BR",{minimumFractionDigits:2})}</td><td className="px-4 py-3 text-right">R$ {Number(i.valor_deferido||0).toLocaleString("pt-BR",{minimumFractionDigits:2})}</td></tr>})}</tbody></table></div></section>
  </SectionPage>;
}
function Info({label,value}:{label:string;value:string}){return <div className="ui-card p-4"><p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p><p className="mt-2 font-semibold capitalize text-slate-900">{value}</p></div>}
