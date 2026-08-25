"use server";

import https from "node:https";
import { gzipSync, gunzipSync } from "node:zlib";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getAssistencialContext } from "@/modules/assistencial/context";
import { nfseNationalEndpoint, nfseProviderDefaults, type NfseAmbiente } from "@/modules/nfse/providers";

const t=(fd:FormData,k:string)=>String(fd.get(k)??"").trim();
const m=(fd:FormData,k:string)=>{const n=Number(t(fd,k).replace(/\./g,"").replace(",","."));return Number.isFinite(n)?n:0};

function envRef(name:string|null|undefined){return name?.trim()?process.env[name.trim()]??null:null;}

async function postJsonMtls(url:string,payload:unknown,pfxBase64:string,passphrase?:string|null){
  return new Promise<{status:number;body:string}>((resolve,reject)=>{
    const target=new URL(url);
    const body=JSON.stringify(payload);
    const request=https.request({
      protocol:target.protocol,
      hostname:target.hostname,
      port:target.port||undefined,
      path:`${target.pathname}${target.search}`,
      method:"POST",
      pfx:Buffer.from(pfxBase64,"base64"),
      passphrase:passphrase||undefined,
      minVersion:"TLSv1.2",
      headers:{"Content-Type":"application/json","Accept":"application/json","Content-Length":Buffer.byteLength(body)},
    },response=>{
      const chunks:Buffer[]=[];
      response.on("data",chunk=>chunks.push(Buffer.isBuffer(chunk)?chunk:Buffer.from(chunk)));
      response.on("end",()=>resolve({status:response.statusCode??0,body:Buffer.concat(chunks).toString("utf8")}));
    });
    request.on("error",reject);
    request.setTimeout(30000,()=>request.destroy(new Error("Timeout na API NFS-e")));
    request.write(body);
    request.end();
  });
}

export async function salvarConfiguracaoNfse(formData:FormData){
  const {supabase,user,empresaId,unidadeId}=await getAssistencialContext();
  const municipioIbge=t(formData,"municipio_ibge"); const municipioNome=t(formData,"municipio_nome"); const uf=t(formData,"uf").toUpperCase();
  if(!municipioIbge||!municipioNome||uf.length!==2) redirect("/configuracoes/nfse?erro=campos");
  const provedor=t(formData,"provedor")||null;
  const ambiente=(t(formData,"ambiente")||"homologacao") as NfseAmbiente;
  const defaults=nfseProviderDefaults(provedor,ambiente);
  const payload={empresa_id:empresaId,unidade_id:unidadeId,municipio_ibge:municipioIbge,municipio_nome:municipioNome,uf,provedor,modo:defaults?.modo??t(formData,"modo")||"manual",ambiente,endpoint_url:t(formData,"endpoint_url")||defaults?.endpoint||null,wsdl_url:t(formData,"wsdl_url")||null,versao:t(formData,"versao")||defaults?.versao||null,codigo_servico_municipal:t(formData,"codigo_servico_municipal")||null,item_lista_servico:t(formData,"item_lista_servico")||null,codigo_tributacao_municipio:t(formData,"codigo_tributacao_municipio")||null,inscricao_municipal:t(formData,"inscricao_municipal")||null,auth_tipo:defaults?.authTipo??t(formData,"auth_tipo")||"nenhuma",auth_usuario_ref:t(formData,"auth_usuario_ref")||null,auth_segredo_ref:t(formData,"auth_segredo_ref")||null,certificado_ref:t(formData,"certificado_ref")||null,updated_by:user.id,updated_at:new Date().toISOString()};
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
  const {supabase,user}=await getAssistencialContext();
  const {data:nota}=await supabase.from("notas_fiscais_servico").select("id,lote_id,configuracao_id,status,xml_envio,config:nfse_configuracoes(modo,endpoint_url,wsdl_url,provedor,ambiente,auth_tipo,auth_segredo_ref,certificado_ref)").eq("id",notaId).maybeSingle();
  if(!nota) redirect("/financeiro/notas-fiscais?erro=nota");
  const cfg=Array.isArray(nota.config)?nota.config[0]:nota.config;
  if(!cfg||cfg.modo==="manual") redirect(`/financeiro/notas-fiscais/${notaId}?erro=config-manual`);

  if(cfg.provedor!=="padrao_nacional"){
    await supabase.from("nfse_transacoes").insert({nota_id:notaId,configuracao_id:nota.configuracao_id,tipo_operacao:"emitir_nfse",status:"erro",mensagem_erro:`Provedor ${cfg.provedor||"municipal"} exige adapter/layout específico da prefeitura. Configure o endpoint e mantenha emissão manual até a homologação do conector.`});
    redirect(`/financeiro/notas-fiscais/${notaId}?erro=adapter-municipal`);
  }

  if(!nota.xml_envio){
    await supabase.from("nfse_transacoes").insert({nota_id:notaId,configuracao_id:nota.configuracao_id,tipo_operacao:"emitir_nfse",status:"erro",mensagem_erro:"DPS XML assinada ainda não foi gerada para esta nota."});
    redirect(`/financeiro/notas-fiscais/${notaId}?erro=dps-pendente`);
  }

  const pfx=envRef(cfg.certificado_ref);
  const passphrase=envRef(cfg.auth_segredo_ref);
  if(!pfx){
    await supabase.from("nfse_transacoes").insert({nota_id:notaId,configuracao_id:nota.configuracao_id,tipo_operacao:"emitir_nfse",status:"erro",mensagem_erro:"Certificado A1 não encontrado. certificado_ref deve apontar para variável segura contendo o PFX em Base64."});
    redirect(`/financeiro/notas-fiscais/${notaId}?erro=certificado-a1`);
  }

  const endpoint=`${nfseNationalEndpoint(cfg.ambiente as NfseAmbiente,cfg.endpoint_url)}/nfse`;
  const dpsXmlGZipB64=gzipSync(Buffer.from(nota.xml_envio,"utf8"),{level:9}).toString("base64");
  await supabase.from("notas_fiscais_servico").update({status:"enviando",updated_by:user.id,updated_at:new Date().toISOString()}).eq("id",notaId);

  try{
    const response=await postJsonMtls(endpoint,{dpsXmlGZipB64},pfx,passphrase);
    let parsed:Record<string,unknown>={};
    try{parsed=JSON.parse(response.body) as Record<string,unknown>;}catch{parsed={raw:response.body};}
    const ok=response.status>=200&&response.status<300&&typeof parsed.chaveAcesso==="string";

    await supabase.from("nfse_transacoes").insert({nota_id:notaId,configuracao_id:nota.configuracao_id,tipo_operacao:"emitir_nfse_nacional",status:ok?"sucesso":"erro",http_status:response.status,protocolo:typeof parsed.idDps==="string"?parsed.idDps:null,mensagem_erro:ok?null:response.body.slice(0,4000),request_payload:JSON.stringify({endpoint,dpsXmlGZipB64:"[GZIP_BASE64_OMITIDO]"}),response_payload:response.body.slice(0,20000)});

    if(!ok){
      await supabase.from("notas_fiscais_servico").update({status:response.status===400?"rejeitada":"erro",updated_by:user.id,updated_at:new Date().toISOString()}).eq("id",notaId);
      redirect(`/financeiro/notas-fiscais/${notaId}?erro=rejeitada-sefin`);
    }

    let xmlRetorno:string|null=null;
    if(typeof parsed.nfseXmlGZipB64==="string"){
      try{xmlRetorno=gunzipSync(Buffer.from(parsed.nfseXmlGZipB64,"base64")).toString("utf8");}catch{xmlRetorno=null;}
    }
    const numero=xmlRetorno?.match(/<nNFSe>([^<]+)<\/nNFSe>/)?.[1]??null;
    const chave=String(parsed.chaveAcesso);
    await supabase.from("notas_fiscais_servico").update({status:"emitida",numero_nfse:numero,codigo_verificacao:chave,protocolo_prefeitura:typeof parsed.idDps==="string"?parsed.idDps:null,xml_retorno:xmlRetorno,data_emissao:new Date().toISOString(),updated_by:user.id,updated_at:new Date().toISOString()}).eq("id",notaId);
    if(nota.lote_id) await supabase.from("financeiro_recebiveis").update({status:"aguardando_pagamento",updated_by:user.id,updated_at:new Date().toISOString()}).eq("lote_id",nota.lote_id);
    revalidatePath(`/financeiro/notas-fiscais/${notaId}`);
    revalidatePath("/financeiro/notas-fiscais");
    redirect(`/financeiro/notas-fiscais/${notaId}?sucesso=emitida-sefin`);
  }catch(error){
    const message=error instanceof Error?error.message:"Falha de comunicação com SEFIN Nacional";
    await supabase.from("nfse_transacoes").insert({nota_id:notaId,configuracao_id:nota.configuracao_id,tipo_operacao:"emitir_nfse_nacional",status:"erro",mensagem_erro:message.slice(0,4000)});
    await supabase.from("notas_fiscais_servico").update({status:"erro",updated_by:user.id,updated_at:new Date().toISOString()}).eq("id",notaId);
    redirect(`/financeiro/notas-fiscais/${notaId}?erro=sefin-indisponivel`);
  }
}
