"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/permissions/server";

const text=(fd:FormData,k:string)=>String(fd.get(k)??"").trim();

async function contextoContaEditavel(contaId:string){
  const ctx=await requirePermission("faturamento.criar");
  const {supabase,empresaId,unidadeId}=ctx;
  const {data:conta}=await supabase.from("contas_faturamento").select("id,status").eq("id",contaId).eq("empresa_id",empresaId).eq("unidade_id",unidadeId).maybeSingle();
  if(!conta) redirect("/faturamento?erro=conta");
  if(["faturada","cancelada"].includes(conta.status)) redirect(`/faturamento/${contaId}?erro=conta-nao-editavel#atos`);
  const {count}=await supabase.from("tiss_guias").select("id",{count:"exact",head:true}).eq("conta_id",contaId).neq("status","cancelada");
  if((count??0)>0) redirect(`/faturamento/${contaId}?erro=guia-tiss-ativa#atos`);
  return ctx;
}

export async function criarGrupoAto(contaId:string, formData:FormData){
  const {supabase}=await contextoContaEditavel(contaId);
  const codigoGrupo=text(formData,"codigo_grupo"); if(!codigoGrupo) redirect(`/faturamento/${contaId}?erro=grupo-ato#atos`);
  const acomodacao=text(formData,"acomodacao");
  const {error}=await supabase.from("conta_faturamento_grupos_ato").insert({
    conta_id:contaId,
    codigo_grupo:codigoGrupo,
    data_ato:text(formData,"data_ato")||new Date().toISOString().slice(0,10),
    via_acesso:text(formData,"via_acesso")||null,
    acomodacao:acomodacao||null,
    urgencia:formData.get("urgencia")==="on",
    horario_especial:formData.get("horario_especial")==="on",
    observacoes:text(formData,"observacoes")||null,
  });
  if(error) redirect(`/faturamento/${contaId}?erro=grupo-ato#atos`);
  revalidatePath(`/faturamento/${contaId}`);
  redirect(`/faturamento/${contaId}?sucesso=ato-criado#atos`);
}

export async function atualizarGrupoAto(contaId:string, formData:FormData){
  const {supabase}=await contextoContaEditavel(contaId);
  const grupoId=text(formData,"grupo_ato_id"); if(!grupoId)return;
  const {error}=await supabase.from("conta_faturamento_grupos_ato").update({
    data_ato:text(formData,"data_ato")||null,
    via_acesso:text(formData,"via_acesso")||null,
    acomodacao:text(formData,"acomodacao")||null,
    urgencia:formData.get("urgencia")==="on",
    horario_especial:formData.get("horario_especial")==="on",
    observacoes:text(formData,"observacoes")||null,
  }).eq("id",grupoId).eq("conta_id",contaId);
  if(error) redirect(`/faturamento/${contaId}?erro=grupo-ato#atos`);
  revalidatePath(`/faturamento/${contaId}`);
  redirect(`/faturamento/${contaId}?sucesso=ato-atualizado#atos`);
}

export async function atualizarItemAto(contaId:string, formData:FormData){
  const {supabase}=await contextoContaEditavel(contaId);
  const itemId=text(formData,"item_id"); if(!itemId) return;
  const payload={
    grupo_ato_id:text(formData,"grupo_ato_id")||null,
    sequencia_ato:Number(text(formData,"sequencia_ato")||1),
    via_acesso:text(formData,"via_acesso")||null,
    anestesia:formData.get("anestesia")==="on",
    numero_auxiliares:Number(text(formData,"numero_auxiliares")||0),
    filme_m2:Number(text(formData,"filme_m2").replace(",",".")||0),
  };
  const {error}=await supabase.from("conta_faturamento_itens").update(payload).eq("id",itemId).eq("conta_id",contaId);
  if(error) redirect(`/faturamento/${contaId}?erro=item-ato#atos`);
  await supabase.rpc("recalcular_item_contratual_avancado",{p_item_id:itemId});
  revalidatePath(`/faturamento/${contaId}`);
  redirect(`/faturamento/${contaId}?sucesso=ato-item-atualizado#atos`);
}

export async function recalcularGrupoAto(contaId:string, formData:FormData){
  const {supabase}=await contextoContaEditavel(contaId);
  const grupoId=text(formData,"grupo_ato_id"); if(!grupoId) return;
  const {data:itens}=await supabase.from("conta_faturamento_itens").select("id").eq("conta_id",contaId).eq("grupo_ato_id",grupoId).order("sequencia_ato");
  for(const item of itens??[]){await supabase.rpc("recalcular_item_contratual_avancado",{p_item_id:item.id});}
  revalidatePath(`/faturamento/${contaId}`);
  redirect(`/faturamento/${contaId}?sucesso=ato-recalculado#atos`);
}
