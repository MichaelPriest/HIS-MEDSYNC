"use server";

import type { Route } from "next";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAssistencialContext } from "@/modules/assistencial/context";

function text(fd:FormData,key:string){const v=String(fd.get(key)??"").trim();return v||null;}
function numberValue(fd:FormData,key:string){const v=text(fd,key);if(!v)return null;const n=Number(v.replace(",","."));return Number.isFinite(n)?n:null;}
function go(url:string):never{redirect(url as Route);}
async function allowed(supabase:Awaited<ReturnType<typeof getAssistencialContext>>["supabase"],empresaId:string,unidadeId:string,codigo:string){const {data}=await supabase.rpc("tem_permissao",{p_empresa:empresaId,p_unidade:unidadeId,p_codigo:codigo});return data===true;}

export async function cadastrarEquipamentoAction(fd:FormData){
 const {supabase,user,empresaId,unidadeId}=await getAssistencialContext();if(!unidadeId)go("/engenharia-clinica?erro=unidade");
 if(!(await allowed(supabase,empresaId,unidadeId,"engenharia_clinica.gerenciar")))go("/engenharia-clinica?erro=permissao");
 const patrimonio=text(fd,"patrimonio"),nome=text(fd,"nome"),categoria=text(fd,"categoria");if(!patrimonio||!nome||!categoria)go("/engenharia-clinica?aba=equipamentos&erro=campos");
 const {error}=await supabase.from("engenharia_equipamentos").insert({empresa_id:empresaId,unidade_id:unidadeId,setor_id:text(fd,"setor_id"),patrimonio,nome,categoria,fabricante:text(fd,"fabricante"),modelo:text(fd,"modelo"),numero_serie:text(fd,"numero_serie"),registro_anvisa:text(fd,"registro_anvisa"),criticidade:text(fd,"criticidade")??"media",status:text(fd,"status")??"operacional",localizacao:text(fd,"localizacao"),responsavel_setor:text(fd,"responsavel_setor"),fornecedor:text(fd,"fornecedor"),data_aquisicao:text(fd,"data_aquisicao"),garantia_ate:text(fd,"garantia_ate"),proxima_preventiva:text(fd,"proxima_preventiva"),proxima_calibracao:text(fd,"proxima_calibracao"),intervalo_preventiva_dias:numberValue(fd,"intervalo_preventiva_dias"),intervalo_calibracao_dias:numberValue(fd,"intervalo_calibracao_dias"),valor_aquisicao:numberValue(fd,"valor_aquisicao"),observacoes:text(fd,"observacoes"),created_by:user.id,updated_by:user.id});
 if(error)go(`/engenharia-clinica?aba=equipamentos&erro=${encodeURIComponent(error.message)}`);revalidatePath("/engenharia-clinica");go("/engenharia-clinica?aba=equipamentos&sucesso=equipamento_cadastrado");
}

export async function abrirOrdemServicoAction(fd:FormData){
 const {supabase,user,empresaId,unidadeId}=await getAssistencialContext();if(!unidadeId)go("/engenharia-clinica?erro=unidade");
 if(!(await allowed(supabase,empresaId,unidadeId,"engenharia_clinica.solicitar")))go("/engenharia-clinica?erro=permissao");
 const equipamentoId=text(fd,"equipamento_id"),problema=text(fd,"problema_relatado");if(!equipamentoId||!problema)go("/engenharia-clinica?erro=campos");
 const prioridade=text(fd,"prioridade")??"media";const prazoHoras={critica:2,alta:8,media:24,baixa:72}[prioridade]??24;
 const {data:equip}=await supabase.from("engenharia_equipamentos").select("setor_id").eq("id",equipamentoId).eq("empresa_id",empresaId).eq("unidade_id",unidadeId).maybeSingle();
 const {data:os,error}=await supabase.from("engenharia_ordens_servico").insert({empresa_id:empresaId,unidade_id:unidadeId,equipamento_id:equipamentoId,setor_id:text(fd,"setor_id")??equip?.setor_id??null,tipo:text(fd,"tipo")??"corretiva",prioridade,status:"aberta",solicitante_usuario_id:user.id,solicitante_nome:text(fd,"solicitante_nome")??user.email??"Usuário",problema_relatado:problema,parada_inicio:fd.get("equipamento_indisponivel")==="on"?new Date().toISOString():null,prazo:new Date(Date.now()+prazoHoras*3600000).toISOString(),created_by:user.id,updated_by:user.id}).select("id").single();
 if(error||!os)go(`/engenharia-clinica?erro=${encodeURIComponent(error?.message??"falha_os")}`);
 if(fd.get("equipamento_indisponivel")==="on")await supabase.from("engenharia_equipamentos").update({status:"indisponivel",updated_at:new Date().toISOString(),updated_by:user.id}).eq("id",equipamentoId).eq("empresa_id",empresaId).eq("unidade_id",unidadeId);
 await supabase.from("engenharia_os_eventos").insert({ordem_servico_id:os.id,tipo:"abertura",descricao:`OS aberta com prioridade ${prioridade}.`,autor_usuario_id:user.id});
 revalidatePath("/engenharia-clinica");go("/engenharia-clinica?sucesso=os_aberta");
}

export async function atualizarOrdemServicoAction(fd:FormData){
 const {supabase,user,empresaId,unidadeId}=await getAssistencialContext();if(!unidadeId)go("/engenharia-clinica?erro=unidade");
 if(!(await allowed(supabase,empresaId,unidadeId,"engenharia_clinica.gerenciar")))go("/engenharia-clinica?erro=permissao");
 const id=text(fd,"ordem_servico_id"),status=text(fd,"status");if(!id||!status)go("/engenharia-clinica?erro=os");
 const {data:atual}=await supabase.from("engenharia_ordens_servico").select("equipamento_id,status").eq("id",id).eq("empresa_id",empresaId).eq("unidade_id",unidadeId).maybeSingle();if(!atual)go("/engenharia-clinica?erro=os_nao_encontrada");
 const agora=new Date().toISOString();const payload:Record<string,unknown>={status,responsavel:text(fd,"responsavel"),fornecedor:text(fd,"fornecedor"),diagnostico:text(fd,"diagnostico"),servico_executado:text(fd,"servico_executado"),pecas_materiais:text(fd,"pecas_materiais"),custo:numberValue(fd,"custo"),observacoes:text(fd,"observacoes"),proxima_preventiva:text(fd,"proxima_preventiva"),proxima_calibracao:text(fd,"proxima_calibracao"),updated_at:agora,updated_by:user.id};
 if(status==="em_execucao")payload.iniciado_em=agora;if(status==="concluida"){payload.concluido_em=agora;payload.parada_fim=agora;}
 const {error}=await supabase.from("engenharia_ordens_servico").update(payload).eq("id",id).eq("empresa_id",empresaId).eq("unidade_id",unidadeId);if(error)go(`/engenharia-clinica?erro=${encodeURIComponent(error.message)}`);
 if(status==="em_execucao")await supabase.from("engenharia_equipamentos").update({status:"em_manutencao",updated_at:agora,updated_by:user.id}).eq("id",atual.equipamento_id);
 if(status==="concluida")await supabase.from("engenharia_equipamentos").update({status:"operacional",proxima_preventiva:text(fd,"proxima_preventiva"),proxima_calibracao:text(fd,"proxima_calibracao"),updated_at:agora,updated_by:user.id}).eq("id",atual.equipamento_id);
 const descricao=text(fd,"evento")??`Status alterado de ${atual.status} para ${status}.`;await supabase.from("engenharia_os_eventos").insert({ordem_servico_id:id,tipo:"atualizacao",descricao,autor_usuario_id:user.id});
 revalidatePath("/engenharia-clinica");go("/engenharia-clinica?sucesso=os_atualizada");
}
