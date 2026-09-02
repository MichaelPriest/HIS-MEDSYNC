"use server";

import { revalidatePath } from "next/cache";
import type { BackgroundActionState } from "@/lib/actions/background-action";
import { requirePermission } from "@/lib/permissions/server";

export type BillingActActionData = {
  kind: "create" | "update" | "update-item" | "reprice";
  groupId?: string;
  itemId?: string;
};

type EditableContext =
  | { ok: true; supabase: Awaited<ReturnType<typeof requirePermission>>["supabase"] }
  | { ok: false; code: string; message: string };

const text=(fd:FormData,k:string)=>String(fd.get(k)??"").trim();
const checked=(fd:FormData,k:string)=>fd.get(k)==="on"||fd.get(k)==="true";

function refresh(contaId:string){
  revalidatePath(`/faturamento/${contaId}`);
  revalidatePath(`/faturamento/${contaId}/procedimentos-cirurgicos`);
  revalidatePath(`/faturamento/${contaId}/lancamentos`);
}

async function contextoContaEditavel(contaId:string):Promise<EditableContext>{
  const ctx=await requirePermission("faturamento.criar");
  const {supabase,empresaId,unidadeId}=ctx;
  const {data:conta}=await supabase.from("contas_faturamento").select("id,status").eq("id",contaId).eq("empresa_id",empresaId).eq("unidade_id",unidadeId).maybeSingle();
  if(!conta)return {ok:false,code:"conta",message:"Conta não localizada no seu escopo."};
  if(["faturada","cancelada"].includes(conta.status))return {ok:false,code:"conta-nao-editavel",message:"A conta não permite mais alterações."};
  const {count}=await supabase.from("tiss_guias").select("id",{count:"exact",head:true}).eq("conta_id",contaId).neq("status","cancelada");
  if((count??0)>0)return {ok:false,code:"guia-tiss-ativa",message:"Existe Guia TISS ativa. Cancele ou trate a guia antes de alterar o ato."};
  return {ok:true,supabase};
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

export async function criarGrupoAtoBackground(contaId:string,_previous:BackgroundActionState<BillingActActionData>,formData:FormData):Promise<BackgroundActionState<BillingActActionData>>{
  const ctx=await contextoContaEditavel(contaId);if(!ctx.ok)return {status:"error",code:ctx.code,message:ctx.message};
  const codigoGrupo=text(formData,"codigo_grupo");
  if(!codigoGrupo)return {status:"error",code:"grupo-ato",message:"Informe o identificador do ato."};
  const payload=payloadAto(formData);
  if(payload.inicio_ato&&payload.fim_ato&&payload.fim_ato<payload.inicio_ato)return {status:"error",code:"horario-ato",message:"O término do ato não pode ser anterior ao início."};
  const {data,error}=await ctx.supabase.from("conta_faturamento_grupos_ato").insert({conta_id:contaId,codigo_grupo:codigoGrupo,...payload}).select("id").single();
  if(error||!data)return {status:"error",code:"grupo-ato",message:"Não foi possível criar o ato cirúrgico/SADT."};
  refresh(contaId);
  return {status:"success",code:"ato-criado",message:"Ato criado e disponível para vincular lançamentos.",data:{kind:"create",groupId:data.id}};
}

export async function atualizarGrupoAtoBackground(contaId:string,_previous:BackgroundActionState<BillingActActionData>,formData:FormData):Promise<BackgroundActionState<BillingActActionData>>{
  const ctx=await contextoContaEditavel(contaId);if(!ctx.ok)return {status:"error",code:ctx.code,message:ctx.message};
  const grupoId=text(formData,"grupo_ato_id");
  if(!grupoId)return {status:"error",code:"grupo-ato",message:"Ato não identificado."};
  const payload=payloadAto(formData);
  if(payload.inicio_ato&&payload.fim_ato&&payload.fim_ato<payload.inicio_ato)return {status:"error",code:"horario-ato",message:"O término do ato não pode ser anterior ao início."};
  const {error}=await ctx.supabase.from("conta_faturamento_grupos_ato").update(payload).eq("id",grupoId).eq("conta_id",contaId);
  if(error)return {status:"error",code:"grupo-ato",message:"Não foi possível atualizar os dados do ato."};
  refresh(contaId);
  return {status:"success",code:"ato-atualizado",message:"Dados do ato atualizados.",data:{kind:"update",groupId:grupoId}};
}

export async function atualizarItemAtoBackground(contaId:string,_previous:BackgroundActionState<BillingActActionData>,formData:FormData):Promise<BackgroundActionState<BillingActActionData>>{
  const ctx=await contextoContaEditavel(contaId);if(!ctx.ok)return {status:"error",code:ctx.code,message:ctx.message};
  const itemId=text(formData,"item_id");
  if(!itemId)return {status:"error",code:"item-ato",message:"Lançamento não identificado."};
  const sequencia=Number(text(formData,"sequencia_ato")||1);
  const auxiliares=Number(text(formData,"numero_auxiliares")||0);
  const filme=Number(text(formData,"filme_m2").replace(",",".")||0);
  if(!Number.isFinite(sequencia)||sequencia<1||!Number.isFinite(auxiliares)||auxiliares<0||!Number.isFinite(filme)||filme<0)return {status:"error",code:"item-ato",message:"Revise sequência, auxiliares e filme do lançamento."};
  const payload={grupo_ato_id:text(formData,"grupo_ato_id")||null,sequencia_ato:sequencia,via_acesso:text(formData,"via_acesso")||null,anestesia:checked(formData,"anestesia"),numero_auxiliares:auxiliares,filme_m2:filme};
  const {error}=await ctx.supabase.from("conta_faturamento_itens").update(payload).eq("id",itemId).eq("conta_id",contaId);
  if(error)return {status:"error",code:"item-ato",message:"Não foi possível atualizar o lançamento associado ao ato."};
  const {error:repriceError}=await ctx.supabase.rpc("recalcular_item_contratual_avancado",{p_item_id:itemId});
  if(repriceError)return {status:"error",code:"recalculo-contratual",message:"O vínculo foi salvo, mas o recálculo contratual não foi concluído."};
  refresh(contaId);
  return {status:"success",code:"ato-item-atualizado",message:"Lançamento associado ao ato e regra contratual recalculada.",data:{kind:"update-item",itemId}};
}

export async function recalcularGrupoAtoBackground(contaId:string,_previous:BackgroundActionState<BillingActActionData>,formData:FormData):Promise<BackgroundActionState<BillingActActionData>>{
  const ctx=await contextoContaEditavel(contaId);if(!ctx.ok)return {status:"error",code:ctx.code,message:ctx.message};
  const grupoId=text(formData,"grupo_ato_id");
  if(!grupoId)return {status:"error",code:"grupo-ato",message:"Ato não identificado."};
  const {data:itens,error}=await ctx.supabase.from("conta_faturamento_itens").select("id").eq("conta_id",contaId).eq("grupo_ato_id",grupoId).order("sequencia_ato");
  if(error)return {status:"error",code:"grupo-ato",message:"Não foi possível consultar os itens do ato."};
  for(const item of itens??[]){const {error:repriceError}=await ctx.supabase.rpc("recalcular_item_contratual_avancado",{p_item_id:item.id});if(repriceError)return {status:"error",code:"recalculo-contratual",message:"Não foi possível recalcular todos os itens do ato."};}
  refresh(contaId);
  return {status:"success",code:"ato-recalculado",message:"Itens do ato recalculados pelas regras comerciais do contrato.",data:{kind:"reprice",groupId}};
}
