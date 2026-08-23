"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAssistencialContext } from "@/modules/assistencial/context";

const text=(fd:FormData,k:string)=>String(fd.get(k)??"").trim();
const num=(v:string)=>{const n=Number(v.replace(/\./g,"").replace(",","."));return Number.isFinite(n)?n:0};

export async function criarFonteTabela(formData:FormData){
  const {supabase,user,empresaId}=await getAssistencialContext();
  const codigo=text(formData,"codigo"); const nome=text(formData,"nome"); const tipo=text(formData,"tipo");
  if(!codigo||!nome||!tipo) redirect("/comercial/tabelas?erro=campos");
  const {error}=await supabase.from("tabelas_comerciais_fontes").insert({empresa_id:empresaId,codigo,nome,tipo,proprietaria:formData.get("proprietaria")==="on",observacoes:text(formData,"observacoes")||null,created_by:user.id});
  if(error) redirect("/comercial/tabelas?erro=fonte"); revalidatePath("/comercial/tabelas");
}

export async function criarEdicaoTabela(formData:FormData){
  const {supabase,user}=await getAssistencialContext();
  const fonteId=text(formData,"fonte_id"); const nomeEdicao=text(formData,"nome_edicao"); const inicio=text(formData,"vigencia_inicio");
  if(!fonteId||!nomeEdicao||!inicio) redirect("/comercial/tabelas?erro=edicao-campos");
  if(text(formData,"status")==="vigente") await supabase.from("tabelas_comerciais_edicoes").update({status:"encerrada",vigencia_fim:new Date(new Date(inicio).getTime()-86400000).toISOString().slice(0,10)}).eq("fonte_id",fonteId).eq("status","vigente");
  const {error}=await supabase.from("tabelas_comerciais_edicoes").insert({fonte_id:fonteId,convenio_id:text(formData,"convenio_id")||null,nome_edicao:nomeEdicao,referencia:text(formData,"referencia")||null,data_publicacao:text(formData,"data_publicacao")||null,vigencia_inicio:inicio,vigencia_fim:text(formData,"vigencia_fim")||null,status:text(formData,"status")||"rascunho",observacoes:text(formData,"observacoes")||null,created_by:user.id});
  if(error) redirect("/comercial/tabelas?erro=edicao"); revalidatePath("/comercial/tabelas");
}

export async function importarItensTabela(formData:FormData){
  const {supabase}=await getAssistencialContext(); const edicaoId=text(formData,"edicao_id"); const arquivo=formData.get("arquivo");
  if(!edicaoId||!(arquivo instanceof File)||arquivo.size===0) redirect("/comercial/tabelas?erro=arquivo");
  const raw=await arquivo.text(); const linhas=raw.replace(/^\uFEFF/,"").split(/\r?\n/).filter(Boolean); if(linhas.length<2) redirect("/comercial/tabelas?erro=arquivo-vazio");
  const sep=linhas[0].includes(";")?";":","; const headers=linhas[0].split(sep).map(h=>h.trim().toLowerCase());
  const idx=(...nomes:string[])=>headers.findIndex(h=>nomes.includes(h));
  const iCodigo=idx("codigo","código","codigo_item"); const iDesc=idx("descricao","descrição"); const iValor=idx("valor","valor_referencia","preco","preço");
  if(iCodigo<0||iDesc<0||iValor<0) redirect("/comercial/tabelas?erro=colunas");
  const rows=linhas.slice(1).map(l=>l.split(sep).map(v=>v.trim().replace(/^"|"$/g,""))).filter(c=>c[iCodigo]&&c[iDesc]).map(c=>({edicao_id:edicaoId,codigo:c[iCodigo],descricao:c[iDesc],valor_referencia:num(c[iValor]),codigo_fabricante:c[idx("codigo_fabricante","código_fabricante")]||null,codigo_anvisa:c[idx("codigo_anvisa","anvisa")]||null,codigo_tuss:c[idx("codigo_tuss","tuss")]||null,fabricante:c[idx("fabricante")]||null,apresentacao:c[idx("apresentacao","apresentação")]||null,unidade:c[idx("unidade")]||null}));
  if(!rows.length) redirect("/comercial/tabelas?erro=sem-itens");
  const {error}=await supabase.from("tabelas_comerciais_itens").upsert(rows,{onConflict:"edicao_id,codigo"}); if(error) redirect("/comercial/tabelas?erro=importacao");
  revalidatePath("/comercial/tabelas"); redirect("/comercial/tabelas?importado=1");
}

export async function vincularTabelaContrato(formData:FormData){
  const {supabase}=await getAssistencialContext();
  const contratoId=text(formData,"contrato_id"), fonteId=text(formData,"fonte_id"); if(!contratoId||!fonteId) redirect("/comercial/tabelas?erro=vinculo");
  const payload={contrato_id:contratoId,fonte_id:fonteId,edicao_fixa_id:text(formData,"edicao_fixa_id")||null,categoria:text(formData,"categoria")||"geral",modo_edicao:text(formData,"modo_edicao")||"vigente_na_data",percentual_ajuste:num(text(formData,"percentual_ajuste")||"0"),prioridade:Number(text(formData,"prioridade")||100),ativo:true,observacoes:text(formData,"observacoes")||null};
  const {error}=await supabase.from("contrato_tabelas_comerciais").upsert(payload,{onConflict:"contrato_id,fonte_id,categoria"}); if(error) redirect("/comercial/tabelas?erro=vinculo"); revalidatePath("/comercial/tabelas");
}
