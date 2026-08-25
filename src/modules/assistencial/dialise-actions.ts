"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getAssistencialContext } from "@/modules/assistencial/context";

const txt=(fd:FormData,key:string)=>String(fd.get(key)??"").trim();
const num=(fd:FormData,key:string)=>{const raw=txt(fd,key).replace(",",".");if(!raw)return null;const n=Number(raw);return Number.isFinite(n)?n:null;};

export async function iniciarSessaoDialiseAction(fd:FormData){
  const {supabase,user,empresaId,unidadeId}=await getAssistencialContext();
  const atendimentoId=txt(fd,"atendimento_id"),maquinaId=txt(fd,"maquina_id");
  if(!atendimentoId||!maquinaId) redirect("/assistencial/dialise/sessoes?erro=campos");

  const [{data:atendimento},{data:maquina},{data:profissional}]=await Promise.all([
    supabase.from("atendimentos").select("id,paciente_id").eq("id",atendimentoId).eq("empresa_id",empresaId).eq("unidade_id",unidadeId).maybeSingle(),
    supabase.from("dialise_maquinas").select("id,ativo,status,engenharia_equipamento_id,engenharia:engenharia_equipamentos(status)").eq("id",maquinaId).eq("empresa_id",empresaId).eq("unidade_id",unidadeId).maybeSingle(),
    supabase.from("profissionais").select("id").eq("empresa_id",empresaId).eq("usuario_id",user.id).eq("ativo",true).limit(1).maybeSingle(),
  ]);
  if(!atendimento?.paciente_id) redirect("/assistencial/dialise/sessoes?erro=atendimento");
  if(!maquina?.ativo) redirect("/assistencial/dialise/sessoes?erro=maquina");
  const eng=Array.isArray(maquina.engenharia)?maquina.engenharia[0]??null:maquina.engenharia;
  if(eng&&!["operacional","reserva"].includes(eng.status)) redirect("/assistencial/dialise/sessoes?erro=maquina-indisponivel");

  const {error}=await supabase.from("dialise_sessoes").insert({
    empresa_id:empresaId,unidade_id:unidadeId,atendimento_id:atendimento.id,paciente_id:atendimento.paciente_id,
    maquina_id:maquina.id,profissional_id:profissional?.id??null,peso_pre_kg:num(fd,"peso_pre_kg"),
    inicio_em:txt(fd,"inicio_em")||new Date().toISOString(),intercorrencias:txt(fd,"observacoes")||null,
    status:"em_andamento",created_by:user.id,updated_by:user.id,
  });
  if(error) redirect(`/assistencial/dialise/sessoes?erro=${encodeURIComponent(error.message)}`);
  revalidatePath("/assistencial/dialise/sessoes");
  redirect("/assistencial/dialise/sessoes?sucesso=iniciada");
}

export async function concluirSessaoDialiseAction(fd:FormData){
  const {supabase,user,empresaId,unidadeId}=await getAssistencialContext();
  const id=txt(fd,"sessao_id");
  if(!id) redirect("/assistencial/dialise/sessoes?erro=sessao");
  const {error}=await supabase.from("dialise_sessoes").update({
    status:"concluida",fim_em:new Date().toISOString(),peso_pos_kg:num(fd,"peso_pos_kg"),
    ultrafiltracao_real_ml:num(fd,"ultrafiltracao_real_ml"),ktv:num(fd,"ktv"),urr:num(fd,"urr"),
    intercorrencias:txt(fd,"intercorrencias")||null,updated_at:new Date().toISOString(),updated_by:user.id,
  }).eq("id",id).eq("empresa_id",empresaId).eq("unidade_id",unidadeId);
  if(error) redirect(`/assistencial/dialise/sessoes?erro=${encodeURIComponent(error.message)}`);
  revalidatePath("/assistencial/dialise/sessoes");
  redirect("/assistencial/dialise/sessoes?sucesso=concluida");
}
