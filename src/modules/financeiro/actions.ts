"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAssistencialContext } from "@/modules/assistencial/context";

function text(formData:FormData,key:string){return String(formData.get(key)??"").trim();}
function money(formData:FormData,key:string){
  const raw=text(formData,key);
  if(!raw)return 0;
  const value=Number(raw.replace(/\./g,"").replace(",","."));
  return Number.isFinite(value)?value:NaN;
}
function moneyNullable(formData:FormData,key:string){
  const raw=text(formData,key);
  if(!raw)return null;
  const value=Number(raw.replace(/\./g,"").replace(",","."));
  return Number.isFinite(value)?value:null;
}
function erroFinanceiro(message?:string|null){
  const value=String(message??"");
  if(value.includes("SEM_PERMISSAO")||value.includes("NAO_AUTENTICADO"))return "permissao";
  if(value.includes("EXCEDE_SALDO"))return "excede-saldo";
  if(value.includes("COMPOSICAO_INVALIDA"))return "composicao";
  if(value.includes("FORMA_INVALIDA"))return "forma";
  if(value.includes("CANCELADO"))return "cancelado";
  if(value.includes("ESTORNADO"))return "estornado";
  if(value.includes("MOTIVO_OBRIGATORIO"))return "motivo";
  if(value.includes("DADOS_INVALIDOS"))return "dados";
  if(value.includes("NAO_LOCALIZADO"))return "nao-localizado";
  return "operacao";
}
function refresh(recebivelId:string){
  revalidatePath("/financeiro");
  revalidatePath(`/financeiro/recebiveis/${recebivelId}`);
  revalidatePath("/integracoes");
}

export async function registrarRecebimentoFinanceiro(recebivelId:string,formData:FormData){
  const {supabase}=await getAssistencialContext();
  const data=text(formData,"data_recebimento");
  const valorBaixado=money(formData,"valor_baixado");
  const retencoes=money(formData,"valor_retencoes");
  const tarifas=money(formData,"valor_tarifas");
  const creditado=moneyNullable(formData,"valor_creditado");
  if(!data||!Number.isFinite(valorBaixado)||valorBaixado<=0||!Number.isFinite(retencoes)||!Number.isFinite(tarifas)){
    redirect(`/financeiro/recebiveis/${recebivelId}?erro=dados`);
  }
  const {error}=await supabase.rpc("registrar_recebimento_financeiro_operacional",{
    p_recebivel_id:recebivelId,
    p_data_recebimento:data,
    p_valor_baixado:valorBaixado,
    p_valor_retencoes:retencoes,
    p_valor_tarifas:tarifas,
    p_valor_creditado:creditado,
    p_forma_recebimento:text(formData,"forma_recebimento")||"credito_bancario",
    p_referencia_bancaria:text(formData,"referencia_bancaria")||null,
    p_documento_operadora:text(formData,"documento_operadora")||null,
    p_observacoes:text(formData,"observacoes")||null,
  });
  if(error){
    console.error("[financeiro] registrar recebimento",{code:error.code,operation:"registrar_recebimento_financeiro_operacional"});
    redirect(`/financeiro/recebiveis/${recebivelId}?erro=${erroFinanceiro(error.message)}`);
  }
  refresh(recebivelId);
  redirect(`/financeiro/recebiveis/${recebivelId}?sucesso=recebimento`);
}

export async function conciliarRecebimentoFinanceiro(recebimentoId:string,recebivelId:string,formData:FormData){
  const {supabase}=await getAssistencialContext();
  const {error}=await supabase.rpc("conciliar_recebimento_financeiro_operacional",{
    p_recebimento_id:recebimentoId,
    p_referencia_bancaria:text(formData,"referencia_bancaria")||null,
    p_observacoes:text(formData,"observacoes")||null,
  });
  if(error){
    console.error("[financeiro] conciliar recebimento",{code:error.code,operation:"conciliar_recebimento_financeiro_operacional"});
    redirect(`/financeiro/recebiveis/${recebivelId}?erro=${erroFinanceiro(error.message)}`);
  }
  refresh(recebivelId);
  redirect(`/financeiro/recebiveis/${recebivelId}?sucesso=conciliado`);
}

export async function estornarRecebimentoFinanceiro(recebimentoId:string,recebivelId:string,formData:FormData){
  const {supabase}=await getAssistencialContext();
  const motivo=text(formData,"motivo");
  if(!motivo)redirect(`/financeiro/recebiveis/${recebivelId}?erro=motivo`);
  const {error}=await supabase.rpc("estornar_recebimento_financeiro_operacional",{
    p_recebimento_id:recebimentoId,
    p_motivo:motivo,
  });
  if(error){
    console.error("[financeiro] estornar recebimento",{code:error.code,operation:"estornar_recebimento_financeiro_operacional"});
    redirect(`/financeiro/recebiveis/${recebivelId}?erro=${erroFinanceiro(error.message)}`);
  }
  refresh(recebivelId);
  redirect(`/financeiro/recebiveis/${recebivelId}?sucesso=estornado`);
}
