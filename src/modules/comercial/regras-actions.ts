"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAssistencialContext } from "@/modules/assistencial/context";

const text=(fd:FormData,k:string)=>String(fd.get(k)??"").trim();
const num=(v:string)=>{const n=Number(v.replace(/\./g,"").replace(",","."));return Number.isFinite(n)?n:null};

export async function salvarRegraFaturamento(formData:FormData){
  const {supabase}=await getAssistencialContext();
  const contratoId=text(formData,"contrato_id"), categoria=text(formData,"categoria"), codigo=text(formData,"codigo_regra"), descricao=text(formData,"descricao");
  if(!contratoId||!categoria||!codigo||!descricao) redirect("/comercial/regras?erro=campos");
  const condicoesRaw=text(formData,"condicoes_json");
  let condicoes:Record<string,unknown>={};
  if(condicoesRaw){try{condicoes=JSON.parse(condicoesRaw)}catch{redirect("/comercial/regras?erro=json")}}
  const {error}=await supabase.from("contrato_regras_faturamento").insert({contrato_id:contratoId,categoria,codigo_regra:codigo,descricao,percentual:num(text(formData,"percentual")),valor_fixo:num(text(formData,"valor_fixo")),prioridade:Number(text(formData,"prioridade")||100),condicoes,ativo:true,vigencia_inicio:text(formData,"vigencia_inicio")||null,vigencia_fim:text(formData,"vigencia_fim")||null});
  if(error) redirect("/comercial/regras?erro=salvar"); revalidatePath("/comercial/regras");
}

export async function salvarPacoteContrato(formData:FormData){
  const {supabase}=await getAssistencialContext();
  const contratoId=text(formData,"contrato_id"),codigo=text(formData,"codigo"),nome=text(formData,"nome"),valor=num(text(formData,"valor"));
  if(!contratoId||!codigo||!nome||valor===null) redirect("/comercial/regras?erro=pacote");
  const parse=(v:string)=>v? v.split(/\r?\n|,/).map(x=>x.trim()).filter(Boolean):[];
  const {error}=await supabase.from("contrato_pacotes").insert({contrato_id:contratoId,codigo,nome,valor,vigencia_inicio:text(formData,"vigencia_inicio")||null,vigencia_fim:text(formData,"vigencia_fim")||null,inclusoes:parse(text(formData,"inclusoes")),exclusoes:parse(text(formData,"exclusoes")),observacoes:text(formData,"observacoes")||null,ativo:true});
  if(error) redirect("/comercial/regras?erro=pacote-salvar"); revalidatePath("/comercial/regras");
}

export async function adicionarItemPacote(formData:FormData){
  const {supabase}=await getAssistencialContext();
  const pacoteId=text(formData,"pacote_id"),codigo=text(formData,"codigo"),tabela=text(formData,"tabela");
  if(!pacoteId||!codigo) redirect("/comercial/regras?erro=item-pacote");
  const payload={quantidade_inclusa:num(text(formData,"quantidade_inclusa")),cobranca_excedente:formData.get("cobranca_excedente")==="on"};
  let consulta=supabase.from("contrato_pacote_itens").select("id").eq("pacote_id",pacoteId).eq("codigo",codigo);
  consulta=tabela?consulta.eq("tabela",tabela):consulta.is("tabela",null);
  const {data:existente,error:consultaError}=await consulta.limit(1).maybeSingle();
  if(consultaError) redirect("/comercial/regras?erro=item-pacote-salvar");
  const resultado=existente
    ? await supabase.from("contrato_pacote_itens").update(payload).eq("id",existente.id)
    : await supabase.from("contrato_pacote_itens").insert({pacote_id:pacoteId,codigo,tabela:tabela||null,...payload});
  if(resultado.error) redirect("/comercial/regras?erro=item-pacote-salvar");
  revalidatePath("/comercial/regras");
}
