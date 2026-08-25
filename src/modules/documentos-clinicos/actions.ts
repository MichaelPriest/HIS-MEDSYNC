"use server";

import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAssistencialContext } from "@/modules/assistencial/context";

const tipos = new Set(["atestado","declaracao_comparecimento","alta_ambulatorial","alta_pronto_atendimento","alta_hospitalar","encaminhamento_svo","declaracao_obito","resumo_alta","orientacoes_alta","relatorio_medico","outro"]);
function t(fd:FormData,k:string){const v=String(fd.get(k)??"").trim();return v||null}
export async function salvarDocumentoClinico(fd:FormData){
 const ctx=await getAssistencialContext(); const atendimentoId=t(fd,"atendimento_id"); const tipo=t(fd,"tipo"); const titulo=t(fd,"titulo"); const conteudo=t(fd,"conteudo");
 if(!atendimentoId||!tipo||!tipos.has(tipo)||!titulo||!conteudo) redirect(`/prontuario/${atendimentoId??""}/documentos?erro=campos`);
 const [{data:at},{data:prof}]=await Promise.all([
  ctx.supabase.from("atendimentos").select("id,paciente_id,ambiente_assistencial").eq("id",atendimentoId).eq("empresa_id",ctx.empresaId).eq("unidade_id",ctx.unidadeId).maybeSingle(),
  ctx.supabase.from("profissionais").select("id").eq("usuario_id",ctx.user.id).eq("ativo",true).limit(1).maybeSingle(),
 ]);
 if(!at||!prof) redirect(`/prontuario/${atendimentoId}/documentos?erro=contexto`);
 const assinar=String(fd.get("acao")??"salvar")==="assinar"; const agora=new Date().toISOString();
 const payload={empresa_id:ctx.empresaId,unidade_id:ctx.unidadeId,atendimento_id:atendimentoId,paciente_id:at.paciente_id,profissional_id:prof.id,tipo,titulo,conteudo,cid10:t(fd,"cid10"),dias_afastamento:t(fd,"dias_afastamento")?Number(t(fd,"dias_afastamento")):null,data_inicio:t(fd,"data_inicio"),data_fim:t(fd,"data_fim"),acompanhante_nome:t(fd,"acompanhante_nome"),destino_svo:t(fd,"destino_svo"),causa_obito_imediata:t(fd,"causa_obito_imediata"),causa_obito_antecedente:t(fd,"causa_obito_antecedente"),causa_obito_basica:t(fd,"causa_obito_basica"),status:assinar?"assinado":"rascunho",assinado_em:assinar?agora:null,created_by:ctx.user.id,updated_by:ctx.user.id};
 const {error}=await ctx.supabase.from("documentos_clinicos_atendimento").insert(payload); if(error){console.error("[documentos-clinicos] inserir",error);redirect(`/prontuario/${atendimentoId}/documentos?erro=salvar`)}
 revalidatePath(`/prontuario/${atendimentoId}/documentos`); redirect(`/prontuario/${atendimentoId}/documentos?sucesso=${assinar?"assinado":"rascunho"}`);
}
export async function cancelarDocumentoClinico(fd:FormData){
 const ctx=await getAssistencialContext(); const atendimentoId=t(fd,"atendimento_id"); const id=t(fd,"documento_id"); const motivo=t(fd,"motivo_cancelamento"); if(!atendimentoId||!id||!motivo) redirect(`/prontuario/${atendimentoId??""}/documentos?erro=cancelar`);
 const {error}=await ctx.supabase.from("documentos_clinicos_atendimento").update({status:"cancelado",cancelado_em:new Date().toISOString(),motivo_cancelamento:motivo,updated_by:ctx.user.id}).eq("id",id).eq("atendimento_id",atendimentoId).eq("empresa_id",ctx.empresaId).eq("unidade_id",ctx.unidadeId);
 if(error) redirect(`/prontuario/${atendimentoId}/documentos?erro=cancelar`); revalidatePath(`/prontuario/${atendimentoId}/documentos`); redirect(`/prontuario/${atendimentoId}/documentos?sucesso=cancelado`);
}
export function hashDocumento(conteudo:string,usuarioId:string,instante:string){return createHash("sha256").update(`${conteudo}|${usuarioId}|${instante}`).digest("hex")}
