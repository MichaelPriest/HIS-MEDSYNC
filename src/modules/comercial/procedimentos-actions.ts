"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAssistencialContext } from "@/modules/assistencial/context";

const text=(fd:FormData,k:string)=>String(fd.get(k)??"").trim();
const num=(v:string)=>{const n=Number(v.replace(/\./g,"").replace(",","."));return Number.isFinite(n)?n:0};

export async function criarFonteProcedimentos(formData:FormData){
  const {supabase,user,empresaId}=await getAssistencialContext();
  const codigo=text(formData,"codigo"),nome=text(formData,"nome"),metodologia=text(formData,"metodologia");
  if(!codigo||!nome||!metodologia) redirect("/comercial/procedimentos?erro=campos");
  const {error}=await supabase.from("tabelas_procedimentos_fontes").insert({empresa_id:empresaId,codigo,nome,metodologia,descricao:text(formData,"descricao")||null,created_by:user.id});
  if(error) redirect("/comercial/procedimentos?erro=fonte"); revalidatePath("/comercial/procedimentos");
}

export async function criarEdicaoProcedimentos(formData:FormData){
  const {supabase,user}=await getAssistencialContext();
  const fonteId=text(formData,"fonte_id"),nome=text(formData,"nome_edicao"),inicio=text(formData,"vigencia_inicio");
  if(!fonteId||!nome||!inicio) redirect("/comercial/procedimentos?erro=edicao");
  const {error}=await supabase.from("tabelas_procedimentos_edicoes").insert({fonte_id:fonteId,nome_edicao:nome,referencia:text(formData,"referencia")||null,vigencia_inicio:inicio,vigencia_fim:text(formData,"vigencia_fim")||null,status:text(formData,"status")||"ativa",observacoes:text(formData,"observacoes")||null,created_by:user.id});
  if(error) redirect("/comercial/procedimentos?erro=edicao"); revalidatePath("/comercial/procedimentos");
}

export async function importarItensProcedimentos(formData:FormData){
  const {supabase}=await getAssistencialContext(); const edicaoId=text(formData,"edicao_id"); const arquivo=formData.get("arquivo");
  if(!edicaoId||!(arquivo instanceof File)||arquivo.size===0) redirect("/comercial/procedimentos?erro=arquivo");
  const raw=await arquivo.text(); const linhas=raw.replace(/^\uFEFF/,"").split(/\r?\n/).filter(Boolean); if(linhas.length<2) redirect("/comercial/procedimentos?erro=arquivo-vazio");
  const sep=linhas[0].includes(";")?";":","; const headers=linhas[0].split(sep).map(h=>h.trim().toLowerCase()); const idx=(...n:string[])=>headers.findIndex(h=>n.includes(h));
  const iCodigo=idx("codigo","código"),iDesc=idx("descricao","descrição"); if(iCodigo<0||iDesc<0) redirect("/comercial/procedimentos?erro=colunas");
  const get=(c:string[],...names:string[])=>{const i=idx(...names);return i>=0?(c[i]||null):null};
  const rows=linhas.slice(1).map(l=>l.split(sep).map(v=>v.trim().replace(/^"|"$/g,""))).filter(c=>c[iCodigo]&&c[iDesc]).map(c=>({
    edicao_id:edicaoId,codigo:c[iCodigo],descricao:c[iDesc],codigo_tuss:get(c,"codigo_tuss","tuss"),grupo:get(c,"grupo"),subgrupo:get(c,"subgrupo"),tipo_item:get(c,"tipo_item","tipo")||"procedimento",
    valor_fixo:num(get(c,"valor_fixo","valor","preco","preço")||"0")||null,ch_hm:num(get(c,"ch_hm","hm","ch_honorario")||"0")||null,ch_sadt:num(get(c,"ch_sadt","sadt","ch_sadt_pontos")||"0")||null,
    porte:get(c,"porte"),porte_anestesico:get(c,"porte_anestesico","anestesico","anestésico"),uco:num(get(c,"uco","quantidade_uco")||"0")||null,numero_auxiliares:Number(get(c,"numero_auxiliares","auxiliares")||0)||null,filme_m2:num(get(c,"filme_m2","filme")||"0")||null
  }));
  if(!rows.length) redirect("/comercial/procedimentos?erro=sem-itens");
  const {error}=await supabase.from("tabelas_procedimentos_itens").upsert(rows,{onConflict:"edicao_id,codigo"}); if(error) redirect("/comercial/procedimentos?erro=importacao");
  revalidatePath("/comercial/procedimentos"); redirect("/comercial/procedimentos?importado=1");
}

export async function vincularRegraProcedimentos(formData:FormData){
  const {supabase,user}=await getAssistencialContext(); const contratoId=text(formData,"contrato_id"),fonteId=text(formData,"fonte_id");
  if(!contratoId||!fonteId) redirect("/comercial/procedimentos?erro=vinculo");
  const payload={contrato_id:contratoId,categoria:text(formData,"categoria")||"procedimentos",fonte_id:fonteId,modo_edicao:text(formData,"modo_edicao")||"vigente_data",edicao_fixa_id:text(formData,"edicao_fixa_id")||null,
    valor_ch_hm:num(text(formData,"valor_ch_hm")||"0")||null,valor_ch_sadt:num(text(formData,"valor_ch_sadt")||"0")||null,valor_uco:num(text(formData,"valor_uco")||"0")||null,percentual_ajuste:num(text(formData,"percentual_ajuste")||"0"),
    adicional_urgencia_percentual:num(text(formData,"adicional_urgencia_percentual")||"0")||null,adicional_apartamento_percentual:num(text(formData,"adicional_apartamento_percentual")||"0")||null,
    aplicar_urgencia:formData.get("aplicar_urgencia")==="on",aplicar_acomodacao:formData.get("aplicar_acomodacao")==="on",vigencia_inicio:text(formData,"vigencia_inicio")||null,vigencia_fim:text(formData,"vigencia_fim")||null,created_by:user.id};
  const {error}=await supabase.from("contrato_regras_procedimentos").insert(payload); if(error) redirect("/comercial/procedimentos?erro=regra"); revalidatePath("/comercial/procedimentos");
}
