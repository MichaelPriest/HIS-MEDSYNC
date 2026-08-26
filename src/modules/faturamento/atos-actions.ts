"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/permissions/server";

const text=(fd:FormData,k:string)=>String(fd.get(k)??"").trim();
const checked=(fd:FormData,k:string)=>fd.get(k)==="on"||fd.get(k)==="true";
const tela=(contaId:string)=>`/faturamento/${contaId}/procedimentos-cirurgicos`;

async function contextoContaEditavel(contaId:string){
  const ctx=await requirePermission("faturamento.criar");
  const {supabase,empresaId,unidadeId}=ctx;
  const {data:conta}=await supabase.from("contas_faturamento").select("id,status").eq("id",contaId).eq("empresa_id",empresaId).eq("unidade_id",unidadeId).maybeSingle();
  if(!conta) redirect("/faturamento?erro=conta");
  if(["faturada","cancelada"].includes(conta.status)) redirect(`${tela(contaId)}?erro=conta-nao-editavel`);
  const {count}=await supabase.from("tiss_guias").select("id",{count:"exact",head:true}).eq("conta_id",contaId).neq("status","cancelada");
  if((count??0)>0) redirect(`${tela(contaId)}?erro=guia-tiss-ativa`);
  return ctx;
}

function payloadAto(formData:FormData){
  const inicio=text(formData,"inicio_ato");
  const fim=text(formData,"fim_ato");
  return {
    data_ato:text(formData,"data_ato")||new Date().toISOString().slice(0,10),
    procedimento_principal_codigo:text(formData,"procedimento_principal_codigo")||null,
    procedimento_principal_descricao:text(formData,"procedimento_principal_descricao")||null,
    sala:text(formData,"sala")||null,
    inicio_ato:inicio?new Date(inicio).toISOString():null,
    fim_ato:fim?new Date(fim).toISOString():null,
    porte_sala:text(formData,"porte_sala")||null,
    porte_anestesico:text(formData,"porte_anestesico")||null,
    potencial_contaminacao:text(formData,"potencial_contaminacao")||null,
    sala_contaminada:checked(formData,"sala_contaminada"),
    via_acesso:text(formData,"via_acesso")||null,
    acomodacao:text(formData,"acomodacao")||null,
    urgencia:checked(formData,"urgencia"),
    horario_especial:checked(formData,"horario_especial"),
    observacoes:text(formData,"observacoes")||null,
  };
}

export async function criarGrupoAto(contaId:string, formData:FormData){
  const {supabase}=await contextoContaEditavel(contaId);
  const codigoGrupo=text(formData,"codigo_grupo");
  if(!codigoGrupo) redirect(`${tela(contaId)}?erro=grupo-ato`);
  const payload=payloadAto(formData);
  if(payload.inicio_ato&&payload.fim_ato&&payload.fim_ato<payload.inicio_ato) redirect(`${tela(contaId)}?erro=horario-ato`);
  const {error}=await supabase.from("conta_faturamento_grupos_ato").insert({conta_id:contaId,codigo_grupo:codigoGrupo,...payload});
  if(error) redirect(`${tela(contaId)}?erro=grupo-ato`);
  revalidatePath(tela(contaId));
  revalidatePath(`/faturamento/${contaId}`);
  redirect(`${tela(contaId)}?sucesso=ato-criado`);
}

export async function atualizarGrupoAto(contaId:string, formData:FormData){
  const {supabase}=await contextoContaEditavel(contaId);
  const grupoId=text(formData,"grupo_ato_id");
  if(!grupoId)return;
  const payload=payloadAto(formData);
  if(payload.inicio_ato&&payload.fim_ato&&payload.fim_ato<payload.inicio_ato) redirect(`${tela(contaId)}?erro=horario-ato`);
  const {error}=await supabase.from("conta_faturamento_grupos_ato").update(payload).eq("id",grupoId).eq("conta_id",contaId);
  if(error) redirect(`${tela(contaId)}?erro=grupo-ato`);
  revalidatePath(tela(contaId));
  revalidatePath(`/faturamento/${contaId}`);
  redirect(`${tela(contaId)}?sucesso=ato-atualizado`);
}

export async function atualizarItemAto(contaId:string, formData:FormData){
  const {supabase}=await contextoContaEditavel(contaId);
  const itemId=text(formData,"item_id"); if(!itemId) return;
  const payload={
    grupo_ato_id:text(formData,"grupo_ato_id")||null,
    sequencia_ato:Number(text(formData,"sequencia_ato")||1),
    via_acesso:text(formData,"via_acesso")||null,
    anestesia:checked(formData,"anestesia"),
    numero_auxiliares:Number(text(formData,"numero_auxiliares")||0),
    filme_m2:Number(text(formData,"filme_m2").replace(",",".")||0),
  };
  const {error}=await supabase.from("conta_faturamento_itens").update(payload).eq("id",itemId).eq("conta_id",contaId);
  if(error) redirect(`${tela(contaId)}?erro=item-ato`);
  await supabase.rpc("recalcular_item_contratual_avancado",{p_item_id:itemId});
  revalidatePath(tela(contaId));
  revalidatePath(`/faturamento/${contaId}`);
  redirect(`${tela(contaId)}?sucesso=ato-item-atualizado`);
}

export async function recalcularGrupoAto(contaId:string, formData:FormData){
  const {supabase}=await contextoContaEditavel(contaId);
  const grupoId=text(formData,"grupo_ato_id"); if(!grupoId) return;
  const {data:itens}=await supabase.from("conta_faturamento_itens").select("id").eq("conta_id",contaId).eq("grupo_ato_id",grupoId).order("sequencia_ato");
  for(const item of itens??[]){await supabase.rpc("recalcular_item_contratual_avancado",{p_item_id:item.id});}
  revalidatePath(tela(contaId));
  revalidatePath(`/faturamento/${contaId}`);
  redirect(`${tela(contaId)}?sucesso=ato-recalculado`);
}
