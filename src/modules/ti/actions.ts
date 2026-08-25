"use server";

import type { Route } from "next";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAssistencialContext } from "@/modules/assistencial/context";

function text(fd: FormData,key:string){const v=String(fd.get(key)??"").trim();return v||null;}
function numberValue(fd:FormData,key:string){const v=text(fd,key);if(!v)return null;const n=Number(v.replace(",","."));return Number.isFinite(n)?n:null;}
function go(url:string):never{redirect(url as Route);}
async function allowed(supabase:Awaited<ReturnType<typeof getAssistencialContext>>["supabase"],empresaId:string,unidadeId:string,codigo:string){const {data}=await supabase.rpc("tem_permissao",{p_empresa:empresaId,p_unidade:unidadeId,p_codigo:codigo});return data===true;}

export async function abrirChamadoTiAction(fd:FormData){
 const {supabase,user,empresaId,unidadeId}=await getAssistencialContext(); if(!unidadeId)go("/ti?erro=unidade");
 if(!(await allowed(supabase,empresaId,unidadeId,"ti.chamados.abrir")))go("/ti?erro=permissao");
 const titulo=text(fd,"titulo"),descricao=text(fd,"descricao");if(!titulo||!descricao)go("/ti?erro=campos");
 const prioridade=text(fd,"prioridade")??"media";
 const sla={critica:[15,120],alta:[30,240],media:[60,480],baixa:[240,1440]}[prioridade]??[60,480];
 const {error}=await supabase.from("ti_chamados").insert({empresa_id:empresaId,unidade_id:unidadeId,setor_id:text(fd,"setor_id"),ativo_id:text(fd,"ativo_id"),solicitante_usuario_id:user.id,solicitante_nome:text(fd,"solicitante_nome")??user.email??"Usuário",titulo,descricao,categoria:text(fd,"categoria")??"suporte",subcategoria:text(fd,"subcategoria"),tipo:text(fd,"tipo")??"incidente",prioridade,impacto:text(fd,"impacto")??"medio",urgencia:text(fd,"urgencia")??"media",status:"aberto",grupo_responsavel:text(fd,"grupo_responsavel")??"Service Desk",sla_resposta_minutos:sla[0],sla_solucao_minutos:sla[1],prazo_sla:new Date(Date.now()+sla[1]*60000).toISOString(),created_by:user.id,updated_by:user.id});
 if(error){console.error("[ti] abrir chamado",error);go(`/ti?erro=${encodeURIComponent(error.message)}`);} revalidatePath("/ti");go("/ti?sucesso=chamado_aberto");
}

export async function atualizarChamadoTiAction(fd:FormData){
 const {supabase,user,empresaId,unidadeId}=await getAssistencialContext();if(!unidadeId)go("/ti?erro=unidade");
 if(!(await allowed(supabase,empresaId,unidadeId,"ti.chamados.atender")))go("/ti?erro=permissao");
 const id=text(fd,"chamado_id"),status=text(fd,"status");if(!id||!status)go("/ti?erro=chamado");
 const agora=new Date().toISOString();const payload:Record<string,unknown>={status,tecnico_responsavel_id:text(fd,"tecnico_responsavel_id"),grupo_responsavel:text(fd,"grupo_responsavel"),resolucao:text(fd,"resolucao"),causa_raiz:text(fd,"causa_raiz"),updated_at:agora,updated_by:user.id};
 if(status==="em_atendimento")payload.primeira_resposta_em=agora;if(status==="resolvido")payload.resolvido_em=agora;if(status==="fechado")payload.fechado_em=agora;
 const {error}=await supabase.from("ti_chamados").update(payload).eq("id",id).eq("empresa_id",empresaId).eq("unidade_id",unidadeId);if(error)go(`/ti?erro=${encodeURIComponent(error.message)}`);
 const mensagem=text(fd,"mensagem");if(mensagem)await supabase.from("ti_chamado_interacoes").insert({chamado_id:id,tipo:"tecnico",mensagem,publico_solicitante:true,autor_usuario_id:user.id});
 revalidatePath("/ti");go("/ti?sucesso=chamado_atualizado");
}

export async function cadastrarAtivoTiAction(fd:FormData){
 const {supabase,user,empresaId,unidadeId}=await getAssistencialContext();if(!unidadeId)go("/ti?erro=unidade");if(!(await allowed(supabase,empresaId,unidadeId,"ti.ativos.gerenciar")))go("/ti?erro=permissao");
 const patrimonio=text(fd,"patrimonio"),categoria=text(fd,"categoria");if(!patrimonio||!categoria)go("/ti?erro=campos");
 const {error}=await supabase.from("ti_ativos").insert({empresa_id:empresaId,unidade_id:unidadeId,setor_id:text(fd,"setor_id"),patrimonio,categoria,fabricante:text(fd,"fabricante"),modelo:text(fd,"modelo"),numero_serie:text(fd,"numero_serie"),hostname:text(fd,"hostname"),ip:text(fd,"ip"),mac:text(fd,"mac"),sistema_operacional:text(fd,"sistema_operacional"),responsavel:text(fd,"responsavel"),localizacao:text(fd,"localizacao"),status:text(fd,"status")??"ativo",criticidade:text(fd,"criticidade")??"media",data_aquisicao:text(fd,"data_aquisicao"),garantia_ate:text(fd,"garantia_ate"),fornecedor:text(fd,"fornecedor"),valor_aquisicao:numberValue(fd,"valor_aquisicao"),observacoes:text(fd,"observacoes"),created_by:user.id,updated_by:user.id});if(error)go(`/ti?aba=ativos&erro=${encodeURIComponent(error.message)}`);revalidatePath("/ti");go("/ti?aba=ativos&sucesso=ativo_cadastrado");
}

export async function cadastrarContratoTiAction(fd:FormData){
 const {supabase,user,empresaId,unidadeId}=await getAssistencialContext();if(!unidadeId)go("/ti?erro=unidade");if(!(await allowed(supabase,empresaId,unidadeId,"ti.contratos.gerenciar")))go("/ti?erro=permissao");
 const fornecedor=text(fd,"fornecedor"),produto=text(fd,"produto_servico");if(!fornecedor||!produto)go("/ti?aba=contratos&erro=campos");
 const {error}=await supabase.from("ti_licencas_contratos").insert({empresa_id:empresaId,unidade_id:unidadeId,tipo:text(fd,"tipo")??"licenca",fornecedor,produto_servico:produto,numero_contrato:text(fd,"numero_contrato"),quantidade:numberValue(fd,"quantidade")??1,valor_mensal:numberValue(fd,"valor_mensal"),valor_anual:numberValue(fd,"valor_anual"),inicio_vigencia:text(fd,"inicio_vigencia"),fim_vigencia:text(fd,"fim_vigencia"),renovacao_automatica:fd.get("renovacao_automatica")==="on",responsavel:text(fd,"responsavel"),status:text(fd,"status")??"ativo",observacoes:text(fd,"observacoes"),created_by:user.id,updated_by:user.id});if(error)go(`/ti?aba=contratos&erro=${encodeURIComponent(error.message)}`);revalidatePath("/ti");go("/ti?aba=contratos&sucesso=contrato_cadastrado");
}

export async function cadastrarMudancaTiAction(fd:FormData){
 const {supabase,user,empresaId,unidadeId}=await getAssistencialContext();if(!unidadeId)go("/ti?erro=unidade");if(!(await allowed(supabase,empresaId,unidadeId,"ti.mudancas.gerenciar")))go("/ti?erro=permissao");
 const titulo=text(fd,"titulo"),descricao=text(fd,"descricao");if(!titulo||!descricao)go("/ti?aba=mudancas&erro=campos");
 const {error}=await supabase.from("ti_mudancas").insert({empresa_id:empresaId,unidade_id:unidadeId,titulo,descricao,tipo:text(fd,"tipo")??"normal",risco:text(fd,"risco")??"medio",impacto:text(fd,"impacto")??"medio",status:"planejada",janela_inicio:text(fd,"janela_inicio"),janela_fim:text(fd,"janela_fim"),plano_implementacao:text(fd,"plano_implementacao"),plano_rollback:text(fd,"plano_rollback"),validacao:text(fd,"validacao"),created_by:user.id,updated_by:user.id});if(error)go(`/ti?aba=mudancas&erro=${encodeURIComponent(error.message)}`);revalidatePath("/ti");go("/ti?aba=mudancas&sucesso=mudanca_cadastrada");
}

export async function cadastrarArtigoTiAction(fd:FormData){
 const {supabase,user,empresaId,unidadeId}=await getAssistencialContext();if(!unidadeId)go("/ti?erro=unidade");if(!(await allowed(supabase,empresaId,unidadeId,"ti.base.gerenciar")))go("/ti?erro=permissao");
 const titulo=text(fd,"titulo"),conteudo=text(fd,"conteudo");if(!titulo||!conteudo)go("/ti?aba=base&erro=campos");const publicado=fd.get("publicado")==="on";
 const {error}=await supabase.from("ti_base_conhecimento").insert({empresa_id:empresaId,unidade_id:unidadeId,titulo,categoria:text(fd,"categoria")??"geral",resumo:text(fd,"resumo"),conteudo,palavras_chave:(text(fd,"palavras_chave")??"").split(",").map(v=>v.trim()).filter(Boolean),publicado,autor_id:user.id,publicado_em:publicado?new Date().toISOString():null});if(error)go(`/ti?aba=base&erro=${encodeURIComponent(error.message)}`);revalidatePath("/ti");go("/ti?aba=base&sucesso=artigo_cadastrado");
}
