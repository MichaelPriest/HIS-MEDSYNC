"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAssistencialContext } from "@/modules/assistencial/context";

const text=(fd:FormData,k:string)=>String(fd.get(k)??"").trim();
const money=(v:string)=>{const n=Number(v.replace(/\./g,"").replace(",","."));return Number.isFinite(n)?n:0};

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
  const {data:guia,error}=await supabase.from("central_guias").insert({empresa_id:empresaId,unidade_id:unidadeId,atendimento_id:atendimentoId||null,paciente_id:pacienteId,convenio_id:convenioId,plano_id:planoId,tipo:text(formData,"tipo")||"consulta",numero_guia_prestador:text(formData,"numero_guia_prestador")||null,codigo_procedimento:text(formData,"codigo_procedimento")||null,descricao_procedimento:text(formData,"descricao_procedimento")||null,categoria_preco:text(formData,"categoria_preco")||"procedimentos",valor_solicitado:money(text(formData,"valor_solicitado")||"0")||null,status:"solicitada",quantidade_solicitada:Number(text(formData,"quantidade")||1),observacoes:text(formData,"observacoes")||null,created_by:user.id,updated_by:user.id}).select("id").single();
  if(error||!guia) redirect("/central-guias?erro=salvar");
  if(text(formData,"codigo_procedimento")) await supabase.rpc("calcular_preco_central_guia",{p_guia_id:guia.id});
  revalidatePath("/central-guias");
}
export async function atualizarGuiaCentral(formData:FormData){
  const {supabase,user}=await getAssistencialContext(); const id=text(formData,"guia_id"); if(!id)return;
  await supabase.from("central_guias").update({status:text(formData,"status")||"em_analise",numero_guia_operadora:text(formData,"numero_guia_operadora")||null,senha:text(formData,"senha")||null,validade_senha:text(formData,"validade_senha")||null,protocolo:text(formData,"protocolo")||null,quantidade_autorizada:Number(text(formData,"quantidade_autorizada")||0)||null,valor_autorizado:money(text(formData,"valor_autorizado")||"0")||null,data_retorno:new Date().toISOString(),updated_by:user.id,updated_at:new Date().toISOString()}).eq("id",id); revalidatePath("/central-guias");
}
export async function criarSolicitacaoCompra(formData:FormData){
  const {supabase,user,empresaId,unidadeId}=await getAssistencialContext();
  const numero=`SC${new Date().toISOString().slice(2,10).replaceAll("-","")}${String(Date.now()).slice(-4)}`;
  const {error}=await supabase.from("compras_solicitacoes").insert({empresa_id:empresaId,unidade_id:unidadeId,numero,solicitante_id:user.id,setor:text(formData,"setor")||null,justificativa:text(formData,"justificativa")||null,prioridade:text(formData,"prioridade")||"normal",status:"solicitada"});
  if(error) redirect("/compras?erro=salvar"); revalidatePath("/compras");
}
export async function criarCotacaoCompra(formData:FormData){
  const {supabase,user,empresaId,unidadeId}=await getAssistencialContext();
  const solicitacaoId=text(formData,"solicitacao_id"); if(!solicitacaoId) redirect("/compras?erro=solicitacao");
  const numero=`CT${new Date().toISOString().slice(2,10).replaceAll("-","")}${String(Date.now()).slice(-4)}`;
  const {error}=await supabase.from("compras_cotacoes").insert({empresa_id:empresaId,unidade_id:unidadeId,solicitacao_id:solicitacaoId,numero,status:"aberta",validade:text(formData,"validade")||null,observacoes:text(formData,"observacoes")||null,created_by:user.id});
  if(error) redirect("/compras?erro=cotacao");
  await supabase.from("compras_solicitacoes").update({status:"em_cotacao"}).eq("id",solicitacaoId);
  revalidatePath("/compras");
}
export async function adicionarFornecedorCotacao(formData:FormData){
  const {supabase}=await getAssistencialContext(); const cotacaoId=text(formData,"cotacao_id"); const fornecedorId=text(formData,"fornecedor_id");
  if(!cotacaoId||!fornecedorId) redirect("/compras?erro=fornecedor-cotacao");
  const valor=money(text(formData,"valor_total")); const frete=money(text(formData,"frete"));
  const {error}=await supabase.from("compras_cotacao_fornecedores").upsert({cotacao_id:cotacaoId,fornecedor_id:fornecedorId,valor_total:valor,prazo_entrega_dias:Number(text(formData,"prazo_entrega_dias")||0)||null,condicao_pagamento:text(formData,"condicao_pagamento")||null,frete,observacoes:text(formData,"observacoes")||null},{onConflict:"cotacao_id,fornecedor_id"});
  if(error) redirect("/compras?erro=fornecedor-cotacao"); revalidatePath("/compras");
}
export async function aprovarFornecedorCotacao(formData:FormData){
  const {supabase}=await getAssistencialContext(); const cotacaoId=text(formData,"cotacao_id"); const fornecedorId=text(formData,"fornecedor_id");
  if(!cotacaoId||!fornecedorId)return;
  await supabase.from("compras_cotacao_fornecedores").update({selecionado:false}).eq("cotacao_id",cotacaoId);
  await supabase.from("compras_cotacao_fornecedores").update({selecionado:true}).eq("cotacao_id",cotacaoId).eq("fornecedor_id",fornecedorId);
  await supabase.from("compras_cotacoes").update({status:"aprovada"}).eq("id",cotacaoId);
  revalidatePath("/compras");
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
export async function gerarChecklistContaMedica(formData:FormData){
  const {supabase}=await getAssistencialContext(); const processoId=text(formData,"processo_id"); if(!processoId)return;
  const {error}=await supabase.rpc("gerar_checklist_conta_medica",{p_processo_id:processoId});
  if(error) redirect(`/contas-medicas/${processoId}?erro=checklist`); revalidatePath(`/contas-medicas/${processoId}`);
}
export async function auditarPrecosContaMedica(formData:FormData){
  const {supabase}=await getAssistencialContext(); const processoId=text(formData,"processo_id"); if(!processoId)return;
  const {error}=await supabase.rpc("auditar_precos_conta_medica",{p_processo_id:processoId});
  if(error) redirect(`/contas-medicas/${processoId}?erro=precos`); revalidatePath(`/contas-medicas/${processoId}`);
}
export async function atualizarChecklistContaMedica(formData:FormData){
  const {supabase,user}=await getAssistencialContext(); const itemId=text(formData,"item_id"); const processoId=text(formData,"processo_id"); if(!itemId||!processoId)return;
  await supabase.from("contas_medicas_checklist_itens").update({status:text(formData,"status")||"pendente",ged_documento_id:text(formData,"ged_documento_id")||null,observacoes:text(formData,"observacoes")||null,conferido_em:new Date().toISOString(),conferido_por:user.id}).eq("id",itemId);
  await supabase.rpc("validar_checklist_conta_medica",{p_processo_id:processoId});
  revalidatePath(`/contas-medicas/${processoId}`);
}
export async function liberarContaMedica(formData:FormData){
  const {supabase,user}=await getAssistencialContext(); const processoId=text(formData,"processo_id"); if(!processoId)return;
  const {data:processo}=await supabase.from("contas_medicas_processos").select("id,conta_id").eq("id",processoId).maybeSingle();
  if(!processo) redirect("/contas-medicas?erro=processo");
  await supabase.rpc("auditar_precos_conta_medica",{p_processo_id:processoId});
  const {data:checkOk}=await supabase.rpc("validar_checklist_conta_medica",{p_processo_id:processoId});
  const {count:pendencias}=await supabase.from("contas_medicas_pendencias").select("id",{count:"exact",head:true}).eq("processo_id",processoId).eq("resolvida",false).in("severidade",["erro","bloqueio"]);
  if(!checkOk || (pendencias??0)>0) redirect(`/contas-medicas/${processoId}?erro=pendencias`);
  const now=new Date().toISOString();
  await supabase.from("contas_medicas_processos").update({status:"liberada_tiss",concluido_em:now,analisado_por:user.id,updated_at:now}).eq("id",processoId);
  await supabase.from("contas_faturamento").update({contas_medicas_liberada:true,contas_medicas_liberada_em:now}).eq("id",processo.conta_id);
  revalidatePath("/contas-medicas"); redirect(`/faturamento/${processo.conta_id}?contas-medicas=liberada`);
}
