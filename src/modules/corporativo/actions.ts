"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAssistencialContext } from "@/modules/assistencial/context";

const text=(fd:FormData,k:string)=>String(fd.get(k)??"").trim();

export async function iniciarAuditoria(formData:FormData){
  const {supabase,user}=await getAssistencialContext();
  const id=text(formData,"auditoria_id"); if(!id) return;
  await supabase.from("auditoria_contas").update({status:"em_auditoria",auditor_id:user.id,iniciado_em:new Date().toISOString(),updated_at:new Date().toISOString()}).eq("id",id);
  revalidatePath("/auditoria");
}
export async function adicionarPendenciaAuditoria(formData:FormData){
  const {supabase}=await getAssistencialContext(); const auditoriaId=text(formData,"auditoria_id"); const descricao=text(formData,"descricao");
  if(!auditoriaId||!descricao) return;
  await supabase.from("auditoria_conta_itens").insert({auditoria_id:auditoriaId,categoria:text(formData,"categoria")||"conta",severidade:text(formData,"severidade")||"alerta",descricao,origem:text(formData,"origem")||null});
  revalidatePath("/auditoria");
}
export async function liberarAuditoria(formData:FormData){
  const {supabase}=await getAssistencialContext(); const id=text(formData,"auditoria_id"); if(!id)return;
  const {error}=await supabase.rpc("liberar_auditoria_conta",{p_auditoria_id:id,p_observacoes:text(formData,"observacoes")||null});
  if(error) redirect("/auditoria?erro=pendencias");
  revalidatePath("/auditoria");
}
export async function criarGuiaCentral(formData:FormData){
  const {supabase,user,empresaId,unidadeId}=await getAssistencialContext();
  const atendimentoId=text(formData,"atendimento_id"); const convenioId=text(formData,"convenio_id");
  if(!convenioId) redirect("/central-guias?erro=campos");
  let pacienteId:string|null=null,planoId:string|null=null;
  if(atendimentoId){const {data:a}=await supabase.from("atendimentos").select("paciente_id,plano_id").eq("id",atendimentoId).maybeSingle();pacienteId=a?.paciente_id??null;planoId=a?.plano_id??null;}
  const {error}=await supabase.from("central_guias").insert({empresa_id:empresaId,unidade_id:unidadeId,atendimento_id:atendimentoId||null,paciente_id:pacienteId,convenio_id:convenioId,plano_id:planoId,tipo:text(formData,"tipo")||"consulta",numero_guia_prestador:text(formData,"numero_guia_prestador")||null,status:"solicitada",quantidade_solicitada:Number(text(formData,"quantidade")||1),observacoes:text(formData,"observacoes")||null,created_by:user.id,updated_by:user.id});
  if(error) redirect("/central-guias?erro=salvar"); revalidatePath("/central-guias");
}
export async function atualizarGuiaCentral(formData:FormData){
  const {supabase,user}=await getAssistencialContext(); const id=text(formData,"guia_id"); if(!id)return;
  await supabase.from("central_guias").update({status:text(formData,"status")||"em_analise",numero_guia_operadora:text(formData,"numero_guia_operadora")||null,senha:text(formData,"senha")||null,validade_senha:text(formData,"validade_senha")||null,protocolo:text(formData,"protocolo")||null,quantidade_autorizada:Number(text(formData,"quantidade_autorizada")||0)||null,data_retorno:new Date().toISOString(),updated_by:user.id,updated_at:new Date().toISOString()}).eq("id",id); revalidatePath("/central-guias");
}
export async function criarSolicitacaoCompra(formData:FormData){
  const {supabase,user,empresaId,unidadeId}=await getAssistencialContext();
  const numero=`SC${new Date().toISOString().slice(2,10).replaceAll("-","")}${String(Date.now()).slice(-4)}`;
  const {error}=await supabase.from("compras_solicitacoes").insert({empresa_id:empresaId,unidade_id:unidadeId,numero,solicitante_id:user.id,setor:text(formData,"setor")||null,justificativa:text(formData,"justificativa")||null,prioridade:text(formData,"prioridade")||"normal",status:"solicitada"});
  if(error) redirect("/compras?erro=salvar"); revalidatePath("/compras");
}
export async function criarMovimentoEstoque(formData:FormData){
  const {supabase,user,empresaId,unidadeId}=await getAssistencialContext();
  const quantidade=Number(text(formData,"quantidade")); if(!text(formData,"produto_id")||!quantidade) redirect("/almoxarifado?erro=campos");
  const {error}=await supabase.from("estoque_movimentos").insert({empresa_id:empresaId,unidade_id:unidadeId,produto_id:text(formData,"produto_id"),lote_id:text(formData,"lote_id")||null,local_origem_id:text(formData,"local_origem_id")||null,local_destino_id:text(formData,"local_destino_id")||null,atendimento_id:text(formData,"atendimento_id")||null,tipo:text(formData,"tipo")||"saida",quantidade,motivo:text(formData,"motivo")||null,created_by:user.id});
  if(error) redirect("/almoxarifado?erro=salvar"); revalidatePath("/almoxarifado");
}
export async function criarContratoCredenciamento(formData:FormData){
  const {supabase,user,empresaId}=await getAssistencialContext(); const convenioId=text(formData,"convenio_id"); if(!convenioId) return;
  await supabase.from("credenciamento_contratos").insert({empresa_id:empresaId,convenio_id:convenioId,numero_contrato:text(formData,"numero_contrato")||null,data_inicio:text(formData,"data_inicio")||null,data_fim:text(formData,"data_fim")||null,status:text(formData,"status")||"negociacao",prazo_pagamento_dias:Number(text(formData,"prazo_pagamento_dias")||0)||null,reajuste_indice:text(formData,"reajuste_indice")||null,contato_comercial:text(formData,"contato_comercial")||null,email_comercial:text(formData,"email_comercial")||null,created_by:user.id,updated_by:user.id}); revalidatePath("/comercial");
}
