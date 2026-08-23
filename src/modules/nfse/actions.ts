"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getAssistencialContext } from "@/modules/assistencial/context";

const t=(fd:FormData,k:string)=>String(fd.get(k)??"").trim();
const m=(fd:FormData,k:string)=>{const n=Number(t(fd,k).replace(/\./g,"").replace(",","."));return Number.isFinite(n)?n:0};

export async function salvarConfiguracaoNfse(formData:FormData){
  const {supabase,user,empresaId,unidadeId}=await getAssistencialContext();
  const municipioIbge=t(formData,"municipio_ibge"); const municipioNome=t(formData,"municipio_nome"); const uf=t(formData,"uf").toUpperCase();
  if(!municipioIbge||!municipioNome||uf.length!==2) redirect("/configuracoes/nfse?erro=campos");
  const payload={empresa_id:empresaId,unidade_id:unidadeId,municipio_ibge:municipioIbge,municipio_nome:municipioNome,uf,provedor:t(formData,"provedor")||null,modo:t(formData,"modo")||"manual",ambiente:t(formData,"ambiente")||"homologacao",endpoint_url:t(formData,"endpoint_url")||null,wsdl_url:t(formData,"wsdl_url")||null,versao:t(formData,"versao")||null,codigo_servico_municipal:t(formData,"codigo_servico_municipal")||null,item_lista_servico:t(formData,"item_lista_servico")||null,codigo_tributacao_municipio:t(formData,"codigo_tributacao_municipio")||null,inscricao_municipal:t(formData,"inscricao_municipal")||null,auth_tipo:t(formData,"auth_tipo")||"nenhuma",auth_usuario_ref:t(formData,"auth_usuario_ref")||null,auth_segredo_ref:t(formData,"auth_segredo_ref")||null,certificado_ref:t(formData,"certificado_ref")||null,updated_by:user.id,updated_at:new Date().toISOString()};
  const {error}=await supabase.from("nfse_configuracoes").upsert({...payload,created_by:user.id},{onConflict:"empresa_id,unidade_id,municipio_ibge,ambiente"});
  if(error) redirect("/configuracoes/nfse?erro=salvar");
  redirect("/configuracoes/nfse?sucesso=1");
}

export async function criarNotaFiscalLote(formData:FormData){
  const {supabase,user,empresaId,unidadeId}=await getAssistencialContext();
  const loteId=t(formData,"lote_id"); if(!loteId) redirect("/financeiro/notas-fiscais?erro=lote");
  const {data:lote}=await supabase.from("tiss_lotes").select("id,competencia,valor_total,convenio_id,convenio:convenios(cnpj,razao_social,nome_fantasia)").eq("id",loteId).maybeSingle();
  if(!lote) redirect("/financeiro/notas-fiscais?erro=lote");
  const convenio=Array.isArray(lote.convenio)?lote.convenio[0]:lote.convenio;
  const {data:cfg}=await supabase.from("nfse_configuracoes").select("id").eq("empresa_id",empresaId).eq("unidade_id",unidadeId).eq("ativo",true).limit(1).maybeSingle();
  const valor=Number(lote.valor_total||0); const deducoes=m(formData,"valor_deducoes"); const iss=m(formData,"valor_iss");
  const {data:nota,error}=await supabase.from("notas_fiscais_servico").insert({empresa_id:empresaId,unidade_id:unidadeId,lote_id:loteId,convenio_id:lote.convenio_id,configuracao_id:cfg?.id??null,competencia:lote.competencia,tomador_cnpj:convenio?.cnpj??null,tomador_razao_social:convenio?.razao_social??convenio?.nome_fantasia??null,valor_servicos:valor,valor_deducoes:deducoes,valor_iss:iss,aliquota_iss:m(formData,"aliquota_iss")||null,valor_liquido:Math.max(0,valor-deducoes-iss),numero_rps:t(formData,"numero_rps")||null,serie_rps:t(formData,"serie_rps")||null,status:"rascunho",created_by:user.id,updated_by:user.id}).select("id").single();
  if(error||!nota) redirect("/financeiro/notas-fiscais?erro=criar");
  redirect(`/financeiro/notas-fiscais/${nota.id}`);
}

export async function registrarEmissaoManualNfse(notaId:string,formData:FormData){
  const {supabase,user}=await getAssistencialContext();
  const numero=t(formData,"numero_nfse"); if(!numero) redirect(`/financeiro/notas-fiscais/${notaId}?erro=numero`);
  const {data:nota}=await supabase.from("notas_fiscais_servico").select("id,lote_id").eq("id",notaId).maybeSingle(); if(!nota) redirect("/financeiro/notas-fiscais?erro=nota");
  await supabase.from("notas_fiscais_servico").update({numero_nfse:numero,codigo_verificacao:t(formData,"codigo_verificacao")||null,protocolo_prefeitura:t(formData,"protocolo_prefeitura")||null,data_emissao:t(formData,"data_emissao")||new Date().toISOString(),status:"emitida",updated_by:user.id,updated_at:new Date().toISOString()}).eq("id",notaId);
  await supabase.from("financeiro_recebiveis").update({status:"aguardando_pagamento",updated_by:user.id,updated_at:new Date().toISOString()}).eq("lote_id",nota.lote_id);
  revalidatePath(`/financeiro/notas-fiscais/${notaId}`);
}

export async function emitirNfseIntegracao(notaId:string){
  const {supabase}=await getAssistencialContext();
  const {data:nota}=await supabase.from("notas_fiscais_servico").select("id,configuracao_id,status,config:nfse_configuracoes(modo,endpoint_url,wsdl_url,provedor,ambiente)").eq("id",notaId).maybeSingle();
  if(!nota) redirect("/financeiro/notas-fiscais?erro=nota");
  const cfg=Array.isArray(nota.config)?nota.config[0]:nota.config;
  if(!cfg||cfg.modo==="manual") redirect(`/financeiro/notas-fiscais/${notaId}?erro=config-manual`);
  // Adaptadores municipais serão implementados por provedor/prefeitura. Mantemos bloqueio explícito até o adapter correspondente existir.
  await supabase.from("nfse_transacoes").insert({nota_id:notaId,configuracao_id:nota.configuracao_id,tipo_operacao:"emitir_nfse",status:"erro",mensagem_erro:`Adapter municipal ainda não implementado para ${cfg.provedor||cfg.endpoint_url||"configuração atual"}.`});
  redirect(`/financeiro/notas-fiscais/${notaId}?erro=adapter-pendente`);
}
