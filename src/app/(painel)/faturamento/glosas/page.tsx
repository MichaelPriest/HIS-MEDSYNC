import Link from "next/link";
import { CircleDollarSign } from "lucide-react";
import { SectionPage } from "@/components/painel/section-page";
import { createClient } from "@/lib/supabase/server";
import { criarRecursoGlosa } from "@/modules/tiss/actions";

function one<T>(rel:T|T[]|null){return Array.isArray(rel)?rel[0]??null:rel;}

export default async function GlosasPage({searchParams}:{searchParams:Promise<{erro?:string}>}){
  const {erro}=await searchParams; const supabase=await createClient();
  const {data:glosas}=await supabase.from("tiss_glosas").select("id,codigo_glosa,descricao_glosa,valor_glosado,status,created_at,guia:tiss_guias(numero_guia_prestador,paciente:pacientes(nome_completo,ra,numero_registro)),lote:tiss_lotes(numero_lote,convenio:convenios(nome_fantasia))").order("created_at",{ascending:false}).limit(200);
  return <SectionPage eyebrow="Financeiro / TISS" title="Glosas e recursos" description="Controle glosas recebidas, valores recursáveis e recursos vinculados às guias TISS.">
    {erro?<div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">Não foi possível criar o recurso: {erro}.</div>:null}
    <div className="space-y-4">{glosas?.length?glosas.map(g=>{const guia=one(g.guia);const paciente=guia?one(guia.paciente):null;const lote=one(g.lote);const conv=lote?one(lote.convenio):null;return <article key={g.id} className="ui-card p-5"><div className="flex flex-wrap items-start justify-between gap-4"><div><div className="flex items-center gap-2"><CircleDollarSign className="size-5 text-rose-600"/><h2 className="font-semibold text-slate-900">Glosa {g.codigo_glosa}</h2><span className="rounded-full bg-rose-50 px-2 py-1 text-xs font-semibold text-rose-700">{g.status}</span></div><p className="mt-2 text-sm text-slate-600">{paciente?.nome_completo??"Paciente"} · Registro #{paciente?.numero_registro??"—"} · {paciente?.ra??"—"}</p><p className="text-sm text-slate-500">Guia {guia?.numero_guia_prestador??"—"} · Lote {lote?.numero_lote??"—"} · {conv?.nome_fantasia??"Convênio"}</p><p className="mt-2 text-sm text-slate-700">{g.descricao_glosa??"Sem descrição informada."}</p></div><div className="text-right"><p className="text-xs uppercase text-slate-400">Valor glosado</p><p className="text-xl font-bold text-rose-700">R$ {Number(g.valor_glosado).toLocaleString("pt-BR",{minimumFractionDigits:2})}</p></div></div>{g.status==="aberta"?<form action={criarRecursoGlosa} className="mt-5 grid gap-3 border-t border-slate-100 pt-4 md:grid-cols-[180px_1fr_auto]"><input type="hidden" name="glosa_id" value={g.id}/><input name="valor_recursado" required defaultValue={Number(g.valor_glosado).toLocaleString("pt-BR",{minimumFractionDigits:2})} className="ui-input"/><input name="justificativa" required placeholder="Justificativa técnica/administrativa do recurso" className="ui-input"/><button className="ui-button-primary">Criar recurso</button></form>:null}</article>}):<div className="ui-card p-8 text-center text-sm text-slate-500">Nenhuma glosa registrada.</div>}</div>
    <div className="mt-6"><Link href="/faturamento/lotes" className="ui-button-secondary">Voltar aos lotes</Link></div>
  </SectionPage>;
}
