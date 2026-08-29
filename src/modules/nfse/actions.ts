"use server";

import https from "node:https";
import { gzipSync, gunzipSync } from "node:zlib";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getAssistencialContext } from "@/modules/assistencial/context";
import { nfseNationalEndpoint, nfseProviderDefaults, type NfseAmbiente } from "@/modules/nfse/providers";

const t=(fd:FormData,k:string)=>String(fd.get(k)??"").trim();
const m=(fd:FormData,k:string)=>{const raw=t(fd,k);if(!raw)return 0;const n=Number(raw.replace(/\./g,"").replace(",","."));return Number.isFinite(n)?n:0};
const mn=(fd:FormData,k:string)=>{const raw=t(fd,k);if(!raw)return null;const n=Number(raw.replace(/\./g,"").replace(",","."));return Number.isFinite(n)?n:null};

function envRef(name:string|null|undefined){return name?.trim()?process.env[name.trim()]??null:null;}
function nfseError(message?:string|null){
  const value=String(message??"");
  if(value.includes("NFSE_CONFIG_SEM_PERMISSAO")||value.includes("NFSE_SEM_PERMISSAO")||value.includes("NFSE_NAO_AUTENTICADO")) return "permissao";
  if(value.includes("NFSE_LOTE_NAO_ELEGIVEL")) return "lote-nao-elegivel";
  if(value.includes("NFSE_VALORES_INVALIDOS")) return "valores";
  if(value.includes("NFSE_NUMERO_OBRIGATORIO")) return "numero";
  if(value.includes("NFSE_CONFIG_DADOS_INVALIDOS")||value.includes("NFSE_CONFIG_DOMINIO_INVALIDO")) return "campos";
  return "operacao";
}

async function postJsonMtls(url:string,payload:unknown,pfxBase64:string,passphrase?:string|null){
  return new Promise<{status:number;body:string}>((resolve,reject)=>{
    const target=new URL(url);
    const body=JSON.stringify(payload);
    const request=https.request({protocol:target.protocol,hostname:target.hostname,port:target.port||undefined,path:`${target.pathname}${target.search}`,method:"POST",pfx:Buffer.from(pfxBase64,"base64"),passphrase:passphrase||undefined,minVersion:"TLSv1.2",headers:{"Content-Type":"application/json","Accept":"application/json","Content-Length":Buffer.byteLength(body)}},response=>{
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
  const {supabase,unidadeId}=await getAssistencialContext();
  if(!unidadeId) redirect("/configuracoes/nfse?erro=unidade");
  const municipioIbge=t(formData,"municipio_ibge");
  const municipioNome=t(formData,"municipio_nome");
  const uf=t(formData,"uf").toUpperCase();
  if(!municipioIbge||!municipioNome||uf.length!==2) redirect("/configuracoes/nfse?erro=campos");
  const provedor=t(formData,"provedor")||null;
  const ambiente=(t(formData,"ambiente")||"homologacao") as NfseAmbiente;
  const defaults=nfseProviderDefaults(provedor,ambiente);
  const {error}=await supabase.rpc("salvar_configuracao_nfse_operacional",{
    p_unidade_id:unidadeId,
    p_municipio_ibge:municipioIbge,
    p_municipio_nome:municipioNome,
    p_uf:uf,
    p_provedor:provedor,
    p_modo:defaults?.modo??(t(formData,"modo")||"manual"),
    p_ambiente:ambiente,
    p_endpoint_url:t(formData,"endpoint_url")||defaults?.endpoint||null,
    p_wsdl_url:t(formData,"wsdl_url")||null,
    p_versao:t(formData,"versao")||defaults?.versao||null,
    p_codigo_servico_municipal:t(formData,"codigo_servico_municipal")||null,
    p_item_lista_servico:t(formData,"item_lista_servico")||null,
    p_codigo_tributacao_municipio:t(formData,"codigo_tributacao_municipio")||null,
    p_inscricao_municipal:t(formData,"inscricao_municipal")||null,
    p_auth_tipo:defaults?.authTipo??(t(formData,"auth_tipo")||"nenhuma"),
    p_auth_usuario_ref:t(formData,"auth_usuario_ref")||null,
    p_auth_segredo_ref:t(formData,"auth_segredo_ref")||null,
    p_certificado_ref:t(formData,"certificado_ref")||null,
  });
  if(error){
    console.error("[nfse] salvar configuracao",{code:error.code,operation:"salvar_configuracao_nfse_operacional"});
    redirect(`/configuracoes/nfse?erro=${nfseError(error.message)}`);
  }
  revalidatePath("/configuracoes/nfse");
  redirect("/configuracoes/nfse?sucesso=1");
}

export async function criarNotaFiscalLote(formData:FormData){
  const {supabase}=await getAssistencialContext();
  const loteId=t(formData,"lote_id");
  if(!loteId) redirect("/financeiro/notas-fiscais?erro=lote");
  const {data:notaId,error}=await supabase.rpc("criar_nfse_lote_operacional",{
    p_lote_id:loteId,
    p_numero_rps:t(formData,"numero_rps")||null,
    p_serie_rps:t(formData,"serie_rps")||null,
    p_aliquota_iss:mn(formData,"aliquota_iss"),
    p_valor_iss:m(formData,"valor_iss"),
    p_valor_deducoes:m(formData,"valor_deducoes"),
  });
  if(error||!notaId){
    console.error("[nfse] criar nota",{code:error?.code,operation:"criar_nfse_lote_operacional"});
    redirect(`/financeiro/notas-fiscais?erro=${nfseError(error?.message)}`);
  }
  revalidatePath("/financeiro/notas-fiscais");
  redirect(`/financeiro/notas-fiscais/${notaId}`);
}

export async function registrarEmissaoManualNfse(notaId:string,formData:FormData){
  const {supabase}=await getAssistencialContext();
  const numero=t(formData,"numero_nfse");
  if(!numero) redirect(`/financeiro/notas-fiscais/${notaId}?erro=numero`);
  const dataEmissao=t(formData,"data_emissao")||new Date().toISOString();
  const {error}=await supabase.rpc("registrar_estado_nfse_operacional",{
    p_nota_id:notaId,
    p_status:"emitida",
    p_numero_nfse:numero,
    p_codigo_verificacao:t(formData,"codigo_verificacao")||null,
    p_protocolo_prefeitura:t(formData,"protocolo_prefeitura")||null,
    p_xml_retorno:null,
    p_data_emissao:dataEmissao,
  });
  if(error){
    console.error("[nfse] registrar emissao manual",{code:error.code,operation:"registrar_estado_nfse_operacional"});
    redirect(`/financeiro/notas-fiscais/${notaId}?erro=${nfseError(error.message)}`);
  }
  revalidatePath(`/financeiro/notas-fiscais/${notaId}`);
  revalidatePath("/financeiro/notas-fiscais");
  revalidatePath("/financeiro");
  redirect(`/financeiro/notas-fiscais/${notaId}?sucesso=emitida-manual`);
}

async function registrarTransacao(
  supabase:Awaited<ReturnType<typeof getAssistencialContext>>["supabase"],
  notaId:string,
  args:{tipo:string;status:string;httpStatus?:number|null;protocolo?:string|null;erro?:string|null;request?:string|null;response?:string|null},
){
  const {error}=await supabase.rpc("registrar_transacao_nfse_operacional",{
    p_nota_id:notaId,
    p_tipo_operacao:args.tipo,
    p_status:args.status,
    p_http_status:args.httpStatus??null,
    p_protocolo:args.protocolo??null,
    p_mensagem_erro:args.erro??null,
    p_request_payload:args.request??null,
    p_response_payload:args.response??null,
  });
  if(error) console.error("[nfse] registrar transacao",{code:error.code,operation:"registrar_transacao_nfse_operacional"});
}

async function registrarEstado(
  supabase:Awaited<ReturnType<typeof getAssistencialContext>>["supabase"],
  notaId:string,
  status:"rascunho"|"pronta"|"enviando"|"emitida"|"rejeitada"|"cancelada"|"erro",
  fields?:{numero?:string|null;codigo?:string|null;protocolo?:string|null;xml?:string|null;data?:string|null},
){
  return supabase.rpc("registrar_estado_nfse_operacional",{
    p_nota_id:notaId,
    p_status:status,
    p_numero_nfse:fields?.numero??null,
    p_codigo_verificacao:fields?.codigo??null,
    p_protocolo_prefeitura:fields?.protocolo??null,
    p_xml_retorno:fields?.xml??null,
    p_data_emissao:fields?.data??null,
  });
}

export async function emitirNfseIntegracao(notaId:string){
  const {supabase}=await getAssistencialContext();
  const {data:nota}=await supabase.from("notas_fiscais_servico").select("id,lote_id,configuracao_id,status,xml_envio,config:nfse_configuracoes(modo,endpoint_url,wsdl_url,provedor,ambiente,auth_tipo,auth_segredo_ref,certificado_ref)").eq("id",notaId).maybeSingle();
  if(!nota) redirect("/financeiro/notas-fiscais?erro=nota");
  const cfg=Array.isArray(nota.config)?nota.config[0]:nota.config;
  if(!cfg||cfg.modo==="manual") redirect(`/financeiro/notas-fiscais/${notaId}?erro=config-manual`);

  if(cfg.provedor!=="padrao_nacional"){
    await registrarTransacao(supabase,notaId,{tipo:"emitir_nfse",status:"erro",erro:`Provedor ${cfg.provedor||"municipal"} exige adapter/layout específico da prefeitura. Configure o endpoint e mantenha emissão manual até a homologação do conector.`});
    redirect(`/financeiro/notas-fiscais/${notaId}?erro=adapter-municipal`);
  }
  if(!nota.xml_envio){
    await registrarTransacao(supabase,notaId,{tipo:"emitir_nfse",status:"erro",erro:"DPS XML assinada ainda não foi gerada para esta nota."});
    redirect(`/financeiro/notas-fiscais/${notaId}?erro=dps-pendente`);
  }
  const pfx=envRef(cfg.certificado_ref);
  const passphrase=envRef(cfg.auth_segredo_ref);
  if(!pfx){
    await registrarTransacao(supabase,notaId,{tipo:"emitir_nfse",status:"erro",erro:"Certificado A1 não encontrado. certificado_ref deve apontar para variável segura contendo o PFX em Base64."});
    redirect(`/financeiro/notas-fiscais/${notaId}?erro=certificado-a1`);
  }

  const endpoint=`${nfseNationalEndpoint(cfg.ambiente as NfseAmbiente,cfg.endpoint_url)}/nfse`;
  const dpsXmlGZipB64=gzipSync(Buffer.from(nota.xml_envio,"utf8"),{level:9}).toString("base64");
  const {error:enviandoError}=await registrarEstado(supabase,notaId,"enviando");
  if(enviandoError) redirect(`/financeiro/notas-fiscais/${notaId}?erro=${nfseError(enviandoError.message)}`);

  let response:{status:number;body:string};
  try{
    response=await postJsonMtls(endpoint,{dpsXmlGZipB64},pfx,passphrase);
  }catch(error){
    const message=error instanceof Error?error.message:"Falha de comunicação com SEFIN Nacional";
    await registrarTransacao(supabase,notaId,{tipo:"emitir_nfse_nacional",status:"erro",erro:message.slice(0,4000)});
    await registrarEstado(supabase,notaId,"erro");
    redirect(`/financeiro/notas-fiscais/${notaId}?erro=sefin-indisponivel`);
  }

  let parsed:Record<string,unknown>={};
  try{parsed=JSON.parse(response.body) as Record<string,unknown>;}catch{parsed={raw:response.body};}
  const ok=response.status>=200&&response.status<300&&typeof parsed.chaveAcesso==="string";
  await registrarTransacao(supabase,notaId,{
    tipo:"emitir_nfse_nacional",
    status:ok?"sucesso":"erro",
    httpStatus:response.status,
    protocolo:typeof parsed.idDps==="string"?parsed.idDps:null,
    erro:ok?null:response.body.slice(0,4000),
    request:JSON.stringify({endpoint,dpsXmlGZipB64:"[GZIP_BASE64_OMITIDO]"}),
    response:response.body.slice(0,20000),
  });

  if(!ok){
    await registrarEstado(supabase,notaId,response.status===400?"rejeitada":"erro");
    redirect(`/financeiro/notas-fiscais/${notaId}?erro=rejeitada-sefin`);
  }

  let xmlRetorno:string|null=null;
  if(typeof parsed.nfseXmlGZipB64==="string"){
    try{xmlRetorno=gunzipSync(Buffer.from(parsed.nfseXmlGZipB64,"base64")).toString("utf8");}catch{xmlRetorno=null;}
  }
  const numero=xmlRetorno?.match(/<nNFSe>([^<]+)<\/nNFSe>/)?.[1]??null;
  const chave=String(parsed.chaveAcesso);
  const {error:emitidaError}=await registrarEstado(supabase,notaId,"emitida",{
    numero,
    codigo:chave,
    protocolo:typeof parsed.idDps==="string"?parsed.idDps:null,
    xml:xmlRetorno,
    data:new Date().toISOString(),
  });
  if(emitidaError){
    console.error("[nfse] concluir emissao",{code:emitidaError.code,operation:"registrar_estado_nfse_operacional"});
    redirect(`/financeiro/notas-fiscais/${notaId}?erro=${nfseError(emitidaError.message)}`);
  }
  revalidatePath(`/financeiro/notas-fiscais/${notaId}`);
  revalidatePath("/financeiro/notas-fiscais");
  revalidatePath("/financeiro");
  redirect(`/financeiro/notas-fiscais/${notaId}?sucesso=emitida-sefin`);
}
