"use server";

import type { Route } from "next";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAssistencialContext } from "@/modules/assistencial/context";

function text(fd:FormData,key:string){const v=String(fd.get(key)??"").trim();return v||null;}
function numberValue(fd:FormData,key:string){const v=text(fd,key);if(!v)return 0;const n=Number(v.replace(",","."));return Number.isFinite(n)?n:0;}
function go(url:string):never{redirect(url as Route);}

export async function criarAuditoriaInLocoAction(fd:FormData){
 const {supabase,user,empresaId,unidadeId}=await getAssistencialContext();
 const operadora=text(fd,"operadora_nome"),inicio=text(fd,"data_inicio"); if(!operadora||!inicio||!unidadeId)go("/auditoria/in-loco?erro=campos");
 const {error}=await supabase.from("auditorias_in_loco").insert({empresa_id:empresaId,unidade_id:unidadeId,convenio_id:text(fd,"convenio_id"),operadora_nome:operadora,protocolo_operadora:text(fd,"protocolo_operadora"),escopo:text(fd,"escopo"),data_inicio:new Date(inicio).toISOString(),data_fim_prevista:text(fd,"data_fim_prevista")?new Date(String(fd.get("data_fim_prevista"))).toISOString():null,status:"agendada",sala_local:text(fd,"sala_local"),observacoes:text(fd,"observacoes"),created_by:user.id,updated_by:user.id});
 if(error)go(`/auditoria/in-loco?erro=${encodeURIComponent(error.message)}`); revalidatePath("/auditoria/in-loco");go("/auditoria/in-loco?sucesso=auditoria");
}

export async function adicionarAuditorExternoAction(fd:FormData){
 const {supabase}=await getAssistencialContext(); const auditoriaId=text(fd,"auditoria_id"),nome=text(fd,"nome"); if(!auditoriaId||!nome)go("/auditoria/in-loco?erro=auditor");
 const {error}=await supabase.from("auditoria_in_loco_auditores").insert({auditoria_id:auditoriaId,nome,documento:text(fd,"documento"),conselho:text(fd,"conselho"),numero_conselho:text(fd,"numero_conselho"),cargo:text(fd,"cargo"),email:text(fd,"email"),telefone:text(fd,"telefone"),empresa:text(fd,"empresa")});
 if(error)go(`/auditoria/in-loco?erro=${encodeURIComponent(error.message)}`);revalidatePath("/auditoria/in-loco");go("/auditoria/in-loco?sucesso=auditor");
}

export async function adicionarAchadoInLocoAction(fd:FormData){
 const {supabase,user}=await getAssistencialContext(); const auditoriaId=text(fd,"auditoria_id"),descricao=text(fd,"descricao"),categoria=text(fd,"categoria"); if(!auditoriaId||!descricao||!categoria)go("/auditoria/in-loco?erro=achado");
 const {error}=await supabase.from("auditoria_in_loco_achados").insert({auditoria_id:auditoriaId,amostra_id:text(fd,"amostra_id"),categoria,codigo_glosa:text(fd,"codigo_glosa"),descricao,fundamentacao:text(fd,"fundamentacao"),valor_questionado:numberValue(fd,"valor_questionado"),severidade:text(fd,"severidade")??"media",status:"aberto",prazo_resposta:text(fd,"prazo_resposta")?new Date(String(fd.get("prazo_resposta"))).toISOString():null,created_by:user.id,updated_by:user.id});
 if(error)go(`/auditoria/in-loco?erro=${encodeURIComponent(error.message)}`);revalidatePath("/auditoria/in-loco");go("/auditoria/in-loco?sucesso=achado");
}

export async function responderAchadoInLocoAction(fd:FormData){
 const {supabase,user}=await getAssistencialContext();const id=text(fd,"id"),resposta=text(fd,"resposta_hospital");if(!id||!resposta)go("/auditoria/in-loco?erro=resposta");
 const {error}=await supabase.from("auditoria_in_loco_achados").update({resposta_hospital:resposta,status:"contestado",respondido_em:new Date().toISOString(),updated_at:new Date().toISOString(),updated_by:user.id}).eq("id",id);
 if(error)go(`/auditoria/in-loco?erro=${encodeURIComponent(error.message)}`);revalidatePath("/auditoria/in-loco");go("/auditoria/in-loco?sucesso=resposta");
}

export async function atualizarStatusAuditoriaInLocoAction(fd:FormData){
 const {supabase,user}=await getAssistencialContext();const id=text(fd,"id"),status=text(fd,"status");if(!id||!status)go("/auditoria/in-loco?erro=status");
 const patch:Record<string,unknown>={status,updated_at:new Date().toISOString(),updated_by:user.id};if(status==="concluida")patch.data_fim_real=new Date().toISOString();
 const {error}=await supabase.from("auditorias_in_loco").update(patch).eq("id",id);if(error)go(`/auditoria/in-loco?erro=${encodeURIComponent(error.message)}`);revalidatePath("/auditoria/in-loco");go("/auditoria/in-loco?sucesso=status");
}
