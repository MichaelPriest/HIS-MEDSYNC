import Link from "next/link";
import { Boxes, Plus } from "lucide-react";
import { SectionPage } from "@/components/painel/section-page";
import { createClient } from "@/lib/supabase/server";
import { criarLoteTiss } from "@/modules/tiss/actions";

function one<T>(rel:T|T[]|null){return Array.isArray(rel)?rel[0]??null:rel;}

export default async function LotesPage({ searchParams }:{searchParams:Promise<{erro?:string}>}){
  const { erro } = await searchParams;
  const supabase=await createClient();
  const [{data:lotes},{data:convenios}] = await Promise.all([
    supabase.from("tiss_lotes").select("id,numero_lote,competencia,status,quantidade_guias,valor_total,xsd_validado,protocolo_operadora,created_at,convenio:convenios(nome_fantasia,registro_ans)").order("created_at",{ascending:false}).limit(100),
    supabase.from("convenios").select("id,nome_fantasia,registro_ans").eq("ativo",true).order("nome_fantasia")
  ]);
  return <SectionPage eyebrow="Financeiro / Faturamento / TISS" title="Lotes TISS" description="Agrupe guias por operadora e competência, acompanhe validação, protocolo e retorno.">
    {erro ? <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">Não foi possível processar o lote: {erro}.</div>:null}
    <form action={criarLoteTiss} className="ui-card mb-6 p-5"><div className="mb-4 flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-brand-50 text-brand-700"><Plus className="size-5"/></span><div><h2 className="font-semibold text-slate-900">Novo lote</h2><p className="text-sm text-slate-500">Inclui guias elegíveis da operadora no lote.</p></div></div><div className="grid gap-4 md:grid-cols-[1fr_220px_auto]"><select name="convenio_id" required defaultValue="" className="ui-input"><option value="">Selecione o convênio</option>{convenios?.map(c=><option key={c.id} value={c.id}>{c.nome_fantasia} · ANS {c.registro_ans||"—"}</option>)}</select><input name="competencia" required pattern="\d{4}-\d{2}" placeholder="2026-08" className="ui-input"/><button className="ui-button-primary">Criar lote</button></div></form>
    <section className="ui-card overflow-hidden"><div className="border-b border-slate-100 px-5 py-4"><div className="flex items-center gap-2"><Boxes className="size-5 text-brand-700"/><h2 className="font-semibold text-slate-900">Lotes recentes</h2></div></div><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">Lote</th><th className="px-4 py-3">Convênio</th><th className="px-4 py-3">Competência</th><th className="px-4 py-3">Guias</th><th className="px-4 py-3">Valor</th><th className="px-4 py-3">XSD</th><th className="px-4 py-3">Status</th></tr></thead><tbody className="divide-y divide-slate-100">{lotes?.length?lotes.map(l=>{const c=one(l.convenio);return <tr key={l.id}><td className="px-4 py-3"><Link href={`/faturamento/lotes/${l.id}`} className="font-semibold text-brand-700 hover:underline">{l.numero_lote}</Link></td><td className="px-4 py-3">{c?.nome_fantasia??"—"}</td><td className="px-4 py-3">{l.competencia??"—"}</td><td className="px-4 py-3">{l.quantidade_guias}</td><td className="px-4 py-3">R$ {Number(l.valor_total||0).toLocaleString("pt-BR",{minimumFractionDigits:2})}</td><td className="px-4 py-3"><span className={`rounded-full px-2 py-1 text-xs font-semibold ${l.xsd_validado?"bg-emerald-50 text-emerald-700":"bg-amber-50 text-amber-700"}`}>{l.xsd_validado?"Validado":"Pendente"}</span></td><td className="px-4 py-3 capitalize">{String(l.status).replaceAll("_"," ")}</td></tr>}):<tr><td colSpan={7} className="px-4 py-8 text-center text-slate-500">Nenhum lote criado.</td></tr>}</tbody></table></div></section>
  </SectionPage>;
}
