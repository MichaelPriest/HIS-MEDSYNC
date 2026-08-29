import Link from "next/link";
import { FilePlus2, ReceiptText } from "lucide-react";
import { SectionPage } from "@/components/painel/section-page";
import { requireAnyPermission } from "@/lib/permissions/server";
import { criarNotaFiscalLote } from "@/modules/nfse/actions";

function one<T>(rel:T|T[]|null){return Array.isArray(rel)?rel[0]??null:rel;}
export default async function NotasFiscaisPage({searchParams}:{searchParams:Promise<{erro?:string}>}){
  const qs=await searchParams;
  const {supabase,empresaId,unidadeId}=await requireAnyPermission(["nfse.visualizar","nfse.emitir","nfse.gerenciar","financeiro.visualizar","financeiro.gerenciar"]);
  const [notasRes,lotesRes,emitGrant,manageGrant]=await Promise.all([
    supabase.from("notas_fiscais_servico").select("id,competencia,numero_nfse,numero_rps,status,valor_servicos,valor_liquido,data_emissao,lote:tiss_lotes(numero_lote),convenio:convenios(nome_fantasia)").order("created_at",{ascending:false}).limit(200),
    supabase.from("tiss_lotes").select("id,numero_lote,competencia,valor_total,convenio:convenios(nome_fantasia)").in("status",["enviado","protocolado","aceito"]).order("created_at",{ascending:false}).limit(200),
    unidadeId?supabase.rpc("tem_permissao",{p_empresa:empresaId,p_unidade:unidadeId,p_codigo:"nfse.emitir"}):Promise.resolve({data:false}),
    unidadeId?supabase.rpc("tem_permissao",{p_empresa:empresaId,p_unidade:unidadeId,p_codigo:"nfse.gerenciar"}):Promise.resolve({data:false}),
  ]);
  const notas=notasRes.data??[];
  const lotes=lotesRes.data??[];
  const canCreate=emitGrant.data===true||manageGrant.data===true;
  const errorMessage=qs.erro==="permissao"?"Seu perfil não possui permissão para emitir NFS-e.":qs.erro==="lote-nao-elegivel"?"O lote ainda não está em uma etapa elegível para NFS-e.":qs.erro==="valores"?"ISS e deduções estão incompatíveis com o valor do lote.":qs.erro?"Não foi possível criar a NFS-e.":null;

  return <SectionPage eyebrow="Financeiro / NFS-e" title="Notas fiscais de serviço" description="Emissão manual pelo portal municipal ou por integração somente quando o conector configurado estiver efetivamente homologado.">
    {errorMessage?<div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{errorMessage}</div>:null}
    <div className={`grid gap-6 ${canCreate?"xl:grid-cols-[0.75fr_1.25fr]":""}`}>
      {canCreate?<form action={criarNotaFiscalLote} className="ui-card p-5"><div className="flex items-center gap-3"><FilePlus2 className="size-5 text-brand-700"/><div><h2 className="font-semibold text-slate-900">Nova NFS-e</h2><p className="text-sm text-slate-500">Um lote mantém no máximo uma nota ativa; nova tentativa reutiliza o rascunho existente.</p></div></div><div className="mt-4 space-y-4"><select name="lote_id" required defaultValue="" className="ui-input"><option value="">Selecione o lote</option>{lotes.map(l=>{const c=one(l.convenio);return <option key={l.id} value={l.id}>{l.numero_lote} · {c?.nome_fantasia??"Convênio"} · {l.competencia} · R$ {Number(l.valor_total||0).toLocaleString("pt-BR",{minimumFractionDigits:2})}</option>})}</select><div className="grid grid-cols-2 gap-3"><input name="numero_rps" placeholder="Número RPS" className="ui-input"/><input name="serie_rps" placeholder="Série RPS" className="ui-input"/><input name="aliquota_iss" placeholder="Alíquota ISS %" className="ui-input"/><input name="valor_iss" placeholder="Valor ISS" className="ui-input"/><input name="valor_deducoes" placeholder="Deduções" className="ui-input col-span-2"/></div><button className="ui-button-primary w-full">Criar rascunho de NFS-e</button></div></form>:null}
      <section className="ui-card overflow-hidden"><div className="border-b border-slate-100 px-5 py-4"><h2 className="font-semibold text-slate-900">Notas fiscais</h2></div><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">NFS-e / RPS</th><th className="px-4 py-3">Lote</th><th className="px-4 py-3">Convênio</th><th className="px-4 py-3">Competência</th><th className="px-4 py-3 text-right">Valor</th><th className="px-4 py-3">Status</th></tr></thead><tbody className="divide-y divide-slate-100">{notas.length?notas.map(n=>{const l=one(n.lote);const c=one(n.convenio);return <tr key={n.id}><td className="px-4 py-3"><Link className="font-semibold text-brand-700 hover:underline" href={`/financeiro/notas-fiscais/${n.id}`}>{n.numero_nfse?`NFS-e ${n.numero_nfse}`:`RPS ${n.numero_rps??"—"}`}</Link></td><td className="px-4 py-3">{l?.numero_lote??"—"}</td><td className="px-4 py-3">{c?.nome_fantasia??"—"}</td><td className="px-4 py-3">{n.competencia}</td><td className="px-4 py-3 text-right">R$ {Number(n.valor_liquido||0).toLocaleString("pt-BR",{minimumFractionDigits:2})}</td><td className="px-4 py-3 capitalize">{n.status}</td></tr>}):<tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500">Nenhuma nota fiscal criada.</td></tr>}</tbody></table></div></section>
    </div>
    <div className="mt-5"><Link href="/configuracoes/nfse" className="ui-button-secondary"><ReceiptText className="mr-2 inline size-4"/>Configuração municipal / NFS-e</Link></div>
  </SectionPage>;
}
