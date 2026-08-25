"use server";

import { createHash } from "node:crypto";
import type { Route } from "next";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAssistencialContext } from "@/modules/assistencial/context";

const txt=(fd:FormData,key:string)=>String(fd.get(key)??"").trim();
const go=(url:string):never=>redirect(url as Route);
const hash=(value:string)=>createHash("sha256").update(value).digest("hex");

export async function registrarBiometriaPacienteAction(fd:FormData){
 const {supabase,user,empresaId}=await getAssistencialContext();
 const pacienteId=txt(fd,"paciente_id"),dedo=txt(fd,"dedo"),provedor=txt(fd,"provedor"),dispositivo=txt(fd,"dispositivo"),templateRef=txt(fd,"template_ref"),identificador=txt(fd,"identificador_externo");
 if(!pacienteId||!templateRef) go(`/pacientes/${pacienteId||""}/identificacao?erro=biometria_campos`);
 if(fd.get("consentimento")!=="on") go(`/pacientes/${pacienteId}/identificacao?erro=consentimento`);
 const {data:paciente}=await supabase.from("pacientes").select("id").eq("id",pacienteId).eq("empresa_id",empresaId).maybeSingle();
 if(!paciente) go("/pacientes?erro=paciente");
 const {error}=await supabase.from("paciente_biometrias").insert({empresa_id:empresaId,paciente_id:pacienteId,tipo:"digital",dedo:dedo||null,provedor:provedor||null,dispositivo:dispositivo||null,identificador_externo:identificador||null,template_hash:hash(templateRef),token_ref:templateRef,consentimento_registrado:true,base_legal:txt(fd,"base_legal")||"identificacao_assistencial",capturado_por:user.id,created_by:user.id,updated_by:user.id});
 if(error) go(`/pacientes/${pacienteId}/identificacao?erro=${encodeURIComponent(error.message)}`);
 revalidatePath(`/pacientes/${pacienteId}/identificacao`);go(`/pacientes/${pacienteId}/identificacao?sucesso=biometria`);
}

export async function registrarTokenConvenioPacienteAction(fd:FormData){
 const {supabase,user,empresaId}=await getAssistencialContext();
 const pacienteId=txt(fd,"paciente_id"),convenioId=txt(fd,"convenio_id"),token=txt(fd,"token"),atendimentoId=txt(fd,"atendimento_id")||null;
 if(!pacienteId||!convenioId||!token) go(`/pacientes/${pacienteId||""}/identificacao?erro=token_campos`);
 const {error}=await supabase.from("paciente_convenio_tokens").insert({empresa_id:empresaId,paciente_id:pacienteId,convenio_id:convenioId,atendimento_id:atendimentoId,tipo:"token_atendimento",token_hash:hash(token),token_ref:null,validado:false,origem:txt(fd,"origem")||"informado_pelo_beneficiario",created_by:user.id});
 if(error) go(`/pacientes/${pacienteId}/identificacao?erro=${encodeURIComponent(error.message)}`);
 revalidatePath(`/pacientes/${pacienteId}/identificacao`);go(`/pacientes/${pacienteId}/identificacao?sucesso=token_registrado`);
}

export async function configurarIdentificacaoConvenioAction(fd:FormData){
 const {supabase,user,empresaId}=await getAssistencialContext();
 const convenioId=txt(fd,"convenio_id"),metodo=txt(fd,"metodo")||"nenhum";
 if(!convenioId) go("/convenios?erro=convenio");
 const payload={empresa_id:empresaId,convenio_id:convenioId,metodo,provedor:txt(fd,"provedor")||null,endpoint:txt(fd,"endpoint")||null,credencial_ref:txt(fd,"credencial_ref")||null,exige_no_atendimento:fd.get("exige_no_atendimento")==="on",exige_na_autorizacao:fd.get("exige_na_autorizacao")==="on",faixa_etaria_min:Number(txt(fd,"faixa_etaria_min")||0)||null,faixa_etaria_max:Number(txt(fd,"faixa_etaria_max")||0)||null,ativo:true,updated_at:new Date().toISOString(),updated_by:user.id};
 const {error}=await supabase.from("convenio_identificacao_config").upsert({...payload,created_by:user.id},{onConflict:"empresa_id,convenio_id"});
 if(error) go(`/convenios?erro=${encodeURIComponent(error.message)}`);
 revalidatePath("/convenios");go("/convenios?sucesso=identificacao_configurada");
}
