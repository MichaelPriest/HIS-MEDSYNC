"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAssistencialContext } from "@/modules/assistencial/context";
import { anexarDocumentoLote as anexarDocumentoLoteBase } from "@/modules/tiss/actions";

function text(formData:FormData,key:string){return String(formData.get(key)??"").trim();}
function errorKey(message?:string|null){
  const value=String(message??"");
  if(value.includes("SEM_PERMISSAO")||value.includes("NAO_AUTENTICADO"))return "permissao";
  if(value.includes("COMPETENCIA_INVALIDA"))return "competencia";
  if(value.includes("PROTOCOLO_ENVIO_OBRIGATORIO"))return "protocolo-envio";
  if(value.includes("NAO_EDITAVEL"))return "lote-nao-editavel";
  if(value.includes("NAO_LOCALIZADO"))return "lote";
  return "operacao";
}
function refresh(loteId:string){
  revalidatePath(`/faturamento/lotes/${loteId}`);
  revalidatePath(`/faturamento/lotes/${loteId}/financeiro`);
  revalidatePath("/financeiro");
}

export async function anexarDocumentoLote(loteId:string,formData:FormData){
  await anexarDocumentoLoteBase(loteId,formData);
}

export async function atualizarDadosFinanceirosLote(loteId:string,formData:FormData){
  const {supabase}=await getAssistencialContext();
  const competencia=text(formData,"competencia");
  if(!competencia)redirect(`/faturamento/lotes/${loteId}/financeiro?erro=competencia`);
  const {error}=await supabase.rpc("atualizar_dados_financeiros_lote_operacional",{
    p_lote_id:loteId,
    p_competencia:competencia,
    p_previsao_pagamento:text(formData,"previsao_pagamento")||null,
  });
  if(error){
    console.error("[tiss] atualizar dados financeiros do lote",{code:error.code,operation:"atualizar_dados_financeiros_lote_operacional"});
    redirect(`/faturamento/lotes/${loteId}/financeiro?erro=${errorKey(error.message)}`);
  }
  refresh(loteId);
  redirect(`/faturamento/lotes/${loteId}/financeiro?sucesso=dados`);
}

export async function registrarProtocoloEnvioOperadora(loteId:string,formData:FormData){
  const {supabase}=await getAssistencialContext();
  const protocolo=text(formData,"protocolo_envio_operadora");
  if(!protocolo)redirect(`/faturamento/lotes/${loteId}/financeiro?erro=protocolo-envio`);
  const {error}=await supabase.rpc("registrar_protocolo_envio_tiss_operacional",{
    p_lote_id:loteId,
    p_protocolo:protocolo,
    p_origem:text(formData,"origem_protocolo")||"portal",
    p_observacoes:text(formData,"observacoes_envio")||null,
  });
  if(error){
    console.error("[tiss] registrar protocolo de envio",{code:error.code,operation:"registrar_protocolo_envio_tiss_operacional"});
    redirect(`/faturamento/lotes/${loteId}/financeiro?erro=${errorKey(error.message)}`);
  }
  refresh(loteId);
  redirect(`/faturamento/lotes/${loteId}/financeiro?sucesso=protocolo`);
}
