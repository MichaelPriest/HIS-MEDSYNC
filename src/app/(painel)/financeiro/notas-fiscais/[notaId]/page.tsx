import { Building2, Send } from "lucide-react";
import { notFound } from "next/navigation";
import { NfseManualBackgroundForm } from "@/components/financeiro/nfse-manual-background-form";
import { SectionPage } from "@/components/painel/section-page";
import { requireAnyPermission } from "@/lib/permissions/server";
import { emitirNfseIntegracao } from "@/modules/nfse/actions";

function one<T>(rel:T|T[]|null){return Array.isArray(rel)?rel[0]??null:rel;}
export default async function NotaFiscalPage({params,searchParams}:{params:Promise<{notaId:string}>;searchParams:Promise<{erro?:string;sucesso?:string}>}){
  const {notaId}=await params;
  const qs=await searchParams;
  const {supabase}=await requireAnyPermission(["nfse.visualizar","nfse.emitir","nfse.gerenciar","financeiro.visualizar","financeiro.gerenciar"]);
  const {data:nota}=await supabase.from("notas_fiscais_servico").select("id,empresa_id,unidade_id,competencia,tomador_cnpj,tomador_razao_social,valor_servicos,valor_deducoes,valor_iss,aliquota_iss,valor_liquido,numero_rps,serie_rps,numero_nfse,codigo_verificacao,protocolo_prefeitura,status,data_emissao,lote:tiss_lotes(numero_lote),config:nfse_configuracoes(municipio_nome,uf,provedor,modo,ambiente)").eq("id",notaId).maybeSingle();
  if(!nota)notFound();
  const [txsRes,emitGrant,manageGrant]=await Promise.all([
    supabase.from("nfse_transacoes").select("id,tipo_operacao,status,http_status,protocolo,mensagem_erro,created_at").eq("nota_id",notaId).order("created_at",{ascending:false}).limit(20),
    supabase.rpc("tem_permissao",{p_empresa:nota.empresa_id,p_unidade:nota.unidade_id,p_codigo:"nfse.emitir"}),
    supabase.rpc("tem_permissao",{p_empresa:nota.empresa_id,p_unidade:nota.unidade_id,p_codigo:"nfse.gerenciar"}),
  ]);
  const txs=txsRes.data??[];
  const canEmit=emitGrant.data===true||manageGrant.data===true;
  const lote=one(nota.lote);
  const cfg=one(nota.config);
  const integrar=emitirNfseIntegracao.bind(null,notaId);
  const finalizada=nota.status==="emitida"||nota.status==="cancelada";
  const errorLabels:Record<string,string>={permissao:"Seu perfil não possui permissão para emitir NFS-e.","config-manual":"A configuração está em modo manual.","adapter-municipal":"O provedor municipal ainda não possui adapter homologado para emissão automática.","dps-pendente":"A DPS XML assinada ainda não foi gerada.","certificado-a1":"Certificado A1 não está disponível na variável segura configurada.","sefin-indisponivel":"Não foi possível comunicar com a SEFIN Nacional.","rejeitada-sefin":"A SEFIN rejeitou a emissão; consulte o histórico abaixo.",numero:"Informe o número oficial da NFS-e.",operacao:"Operação NFS-e não concluída."};

  return <SectionPage eyebrow="Financeiro / NFS-e" title={nota.numero_nfse?`NFS-e ${nota.numero_nfse}`:`RPS ${nota.numero_rps??"sem número"}`} description={`${nota.tomador_razao_social??"Tomador"} · Lote ${lote?.numero_lote??"—"} · Competência ${nota.competencia}`}>
    {qs.erro?<div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{errorLabels[qs.erro]??`Operação não concluída: ${qs.erro}.`}</div>:null}
    {qs.sucesso?<div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">NFS-e emitida pela integração oficial.</div>:null}
    <div className="grid gap-4 md:grid-cols-4"><Card label="Status" value={nota.status}/><Card label="Serviços" value={`R$ ${Number(nota.valor_servicos||0).toLocaleString("pt-BR",{minimumFractionDigits:2})}`}/><Card label="ISS" value={`R$ ${Number(nota.valor_iss||0).toLocaleString("pt-BR",{minimumFractionDigits:2})}`}/><Card label="Líquido" value={`R$ ${Number(nota.valor_liquido||0).toLocaleString("pt-BR",{minimumFractionDigits:2})}`}/></div>
    <div className="mt-6 grid gap-6 xl:grid-cols-2">
      <section className="ui-card p-5"><div className="flex items-center gap-3"><Building2 className="size-5 text-brand-700"/><div><h2 className="font-semibold text-slate-900">Configuração municipal</h2><p className="text-sm text-slate-500">{cfg?`${cfg.municipio_nome}/${cfg.uf} · ${cfg.provedor||"provedor não informado"} · ${cfg.modo} · ${cfg.ambiente}`:"Configuração não visível ou não vinculada."}</p></div></div>{canEmit&&!finalizada?<form action={integrar} className="mt-5"><button disabled={!cfg||cfg.modo==="manual"} className="ui-button-primary disabled:cursor-not-allowed disabled:opacity-50"><Send className="mr-2 inline size-4"/>Emitir via integração</button></form>:<p className="mt-5 text-sm text-slate-500">{finalizada?"A nota está em estado final para esta operação.":"Seu perfil possui acesso de consulta, sem permissão de emissão."}</p>}<p className="mt-3 text-xs text-slate-400">A existência de configuração não comprova homologação municipal. Emissão automática permanece restrita aos conectores efetivamente suportados.</p></section>
      {canEmit&&!finalizada?<NfseManualBackgroundForm notaId={notaId} numeroNfse={nota.numero_nfse} codigoVerificacao={nota.codigo_verificacao} protocoloPrefeitura={nota.protocolo_prefeitura}/>:<section className="ui-card p-5"><h2 className="font-semibold text-slate-900">Dados oficiais</h2><dl className="mt-4 grid gap-3 text-sm"><div><dt className="text-xs text-slate-400">Número</dt><dd className="font-semibold">{nota.numero_nfse??"—"}</dd></div><div><dt className="text-xs text-slate-400">Código de verificação</dt><dd className="font-semibold">{nota.codigo_verificacao??"—"}</dd></div><div><dt className="text-xs text-slate-400">Protocolo</dt><dd className="font-semibold">{nota.protocolo_prefeitura??"—"}</dd></div></dl></section>}
    </div>
    {txs.length?<section className="ui-card mt-6 p-5"><h2 className="font-semibold text-slate-900">Histórico de integração</h2><div className="mt-4 space-y-2">{txs.map(tx=><div key={tx.id} className="rounded-xl border border-slate-200 p-3 text-sm"><div className="flex justify-between"><strong>{tx.tipo_operacao}</strong><span>{tx.status}</span></div><p className="mt-1 text-xs text-slate-500">HTTP {tx.http_status??"—"} · Protocolo {tx.protocolo??"—"}</p>{tx.mensagem_erro?<p className="mt-1 text-xs text-rose-600">{tx.mensagem_erro}</p>:null}</div>)}</div></section>:null}
  </SectionPage>;
}
function Card({label,value}:{label:string;value:string}){return <div className="ui-card p-4"><p className="text-xs uppercase tracking-wide text-slate-400">{label}</p><p className="mt-2 font-semibold capitalize text-slate-900">{value}</p></div>}
