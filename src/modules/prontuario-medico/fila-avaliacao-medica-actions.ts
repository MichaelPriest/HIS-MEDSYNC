"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAssistencialContext } from "@/modules/assistencial/context";
import { asRoute } from "@/lib/route-cast";

const texto=(fd:FormData,n:string)=>String(fd.get(n)??"").trim();
const normalizar=(v:string)=>v.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().trim();

async function contextoProfissional(){
  const ctx=await getAssistencialContext();
  let {data:profissional}=await ctx.supabase.from("profissionais").select("id,nome_completo,especialidade").eq("empresa_id",ctx.empresaId).eq("usuario_id",ctx.user.id).eq("ativo",true).limit(1).maybeSingle();
  if(!profissional&&ctx.user.email) profissional=(await ctx.supabase.from("profissionais").select("id,nome_completo,especialidade").eq("empresa_id",ctx.empresaId).ilike("email",ctx.user.email).eq("ativo",true).limit(1).maybeSingle()).data;
  return {...ctx,profissional};
}

export async function assumirAvaliacaoMedicaAction(formData:FormData){
  const id=texto(formData,"solicitacao_id"); if(!id) redirect("/assistencial/avaliacoes-medicas?erro=solicitacao");
  const {supabase,user,empresaId,unidadeId,profissional}=await contextoProfissional();
  if(!profissional?.id) redirect("/assistencial/avaliacoes-medicas?erro=profissional");
  const {data:sol}=await supabase.from("solicitacoes_avaliacao_medica").select("id,especialidade,status").eq("id",id).eq("empresa_id",empresaId).eq("unidade_id",unidadeId).maybeSingle();
  if(!sol||sol.status!=="solicitada") redirect("/assistencial/avaliacoes-medicas?erro=indisponivel");
  const especialidades=String(profissional.especialidade??"").split(",").map(normalizar).filter(Boolean);
  if(!especialidades.includes(normalizar(sol.especialidade))) redirect("/assistencial/avaliacoes-medicas?erro=especialidade");
  const now=new Date().toISOString();
  const {data,error}=await supabase.from("solicitacoes_avaliacao_medica").update({status:"aceita",profissional_responsavel_id:profissional.id,aceita_em:now,updated_by:user.id,updated_at:now}).eq("id",id).eq("status","solicitada").select("id").maybeSingle();
  if(error||!data) redirect("/assistencial/avaliacoes-medicas?erro=assumir");
  revalidatePath("/assistencial/avaliacoes-medicas"); redirect("/assistencial/avaliacoes-medicas?sucesso=assumida");
}

export async function iniciarAvaliacaoMedicaAction(formData:FormData){
  const id=texto(formData,"solicitacao_id"); const {supabase,user,empresaId,unidadeId,profissional}=await contextoProfissional();
  if(!id||!profissional?.id) redirect("/assistencial/avaliacoes-medicas?erro=profissional");
  const now=new Date().toISOString();
  const {data,error}=await supabase.from("solicitacoes_avaliacao_medica").update({status:"em_avaliacao",iniciada_em:now,updated_by:user.id,updated_at:now}).eq("id",id).eq("empresa_id",empresaId).eq("unidade_id",unidadeId).eq("profissional_responsavel_id",profissional.id).eq("status","aceita").select("id").maybeSingle();
  if(error||!data) redirect("/assistencial/avaliacoes-medicas?erro=iniciar");
  revalidatePath("/assistencial/avaliacoes-medicas"); redirect("/assistencial/avaliacoes-medicas?sucesso=iniciada");
}

export async function concluirAvaliacaoMedicaAction(formData:FormData){
  const id=texto(formData,"solicitacao_id"),parecer=texto(formData,"parecer"); const atendimentoId=texto(formData,"atendimento_id");
  const {supabase,user,empresaId,unidadeId,profissional}=await contextoProfissional();
  if(!id||!parecer||!profissional?.id) redirect("/assistencial/avaliacoes-medicas?erro=parecer");
  const now=new Date().toISOString();
  const {data,error}=await supabase.from("solicitacoes_avaliacao_medica").update({status:"concluida",parecer,concluida_em:now,updated_by:user.id,updated_at:now}).eq("id",id).eq("empresa_id",empresaId).eq("unidade_id",unidadeId).eq("profissional_responsavel_id",profissional.id).in("status",["aceita","em_avaliacao"]).select("id").maybeSingle();
  if(error||!data) redirect("/assistencial/avaliacoes-medicas?erro=concluir");
  revalidatePath("/assistencial/avaliacoes-medicas"); if(atendimentoId) revalidatePath(`/prontuario/${atendimentoId}/avaliacoes`);
  redirect(asRoute(`/assistencial/avaliacoes-medicas?sucesso=concluida`));
}
