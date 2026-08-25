"use server";

import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAssistencialContext } from "@/modules/assistencial/context";
import { detectXmlLayout, parseCommercialXml, parseEquivalenciasXml, parseGlosasXml } from "@/modules/comercial/xml-reference-parser";

const text=(fd:FormData,key:string)=>String(fd.get(key)??"").trim();
const BATCH=500;

type SourcePreset={codigo:string;nome:string;tipo:string;edicao:string;metodo:"fixo"|"ch_hm_sadt"|"cbhpm";proprietaria:boolean};
function preset(filename:string):SourcePreset|null{
  const name=filename.toUpperCase();
  if(name.includes("AMB90"))return {codigo:"AMB90",nome:"AMB 1990",tipo:"amb90",edicao:"AMB 1990",metodo:"ch_hm_sadt",proprietaria:false};
  if(name.includes("AMB92"))return {codigo:"AMB92",nome:"AMB 1992",tipo:"amb92",edicao:"AMB 1992",metodo:"ch_hm_sadt",proprietaria:false};
  if(name.includes("AMB96"))return {codigo:"AMB96",nome:"AMB 1996",tipo:"amb96",edicao:"AMB 1996",metodo:"ch_hm_sadt",proprietaria:false};
  if(name.includes("AMB99"))return {codigo:"AMB99",nome:"AMB 1999",tipo:"amb99",edicao:"AMB 1999",metodo:"ch_hm_sadt",proprietaria:false};
  if(name.includes("AMIL_PAR_06"))return {codigo:"AMIL_PAR_06",nome:"AMIL PAR 06",tipo:"procedimentos_convenio",edicao:"AMIL PAR 06",metodo:"ch_hm_sadt",proprietaria:true};
  if(name.includes("CBHPM2014"))return {codigo:"CBHPM",nome:"CBHPM",tipo:"cbhpm",edicao:"CBHPM 2014",metodo:"cbhpm",proprietaria:false};
  if(name.includes("CBHPM5VER2009"))return {codigo:"CBHPM",nome:"CBHPM",tipo:"cbhpm",edicao:"CBHPM 5 versão 2009",metodo:"cbhpm",proprietaria:false};
  if(name.includes("CBHPM5"))return {codigo:"CBHPM",nome:"CBHPM",tipo:"cbhpm",edicao:"CBHPM 5",metodo:"cbhpm",proprietaria:false};
  if(name.includes("CBHPM4"))return {codigo:"CBHPM",nome:"CBHPM",tipo:"cbhpm",edicao:"CBHPM 4",metodo:"cbhpm",proprietaria:false};
  if(name.includes("CBHPM3"))return {codigo:"CBHPM",nome:"CBHPM",tipo:"cbhpm",edicao:"CBHPM 3",metodo:"cbhpm",proprietaria:false};
  return null;
}

export async function importarXmlReferencia(formData:FormData){
  const {supabase,user,empresaId,unidadeId}=await getAssistencialContext();
  const arquivo=formData.get("arquivo");
  if(!(arquivo instanceof File)||arquivo.size===0||arquivo.size>25*1024*1024)redirect("/comercial/tabelas/xml?erro=arquivo");
  if(!arquivo.name.toLowerCase().endsWith(".xml"))redirect("/comercial/tabelas/xml?erro=extensao");
  const raw=(await arquivo.text()).replace(/^\uFEFF/,"");
  const layout=detectXmlLayout(raw);
  if(layout==="desconhecido")redirect("/comercial/tabelas/xml?erro=layout");

  if(layout==="glosas"){
    const parsed=parseGlosasXml(raw,arquivo.name);
    for(let start=0;start<parsed.itens.length;start+=BATCH){
      const {error}=await supabase.rpc("importar_referencia_lote",{p_empresa:empresaId,p_unidade:unidadeId,p_target:"glosas",p_payload:parsed.itens.slice(start,start+BATCH)});
      if(error){console.error("[xml-ref] glosas",error.code);redirect("/comercial/tabelas/xml?erro=glosas");}
    }
    revalidatePath("/faturamento/glosas");
    redirect(`/comercial/tabelas/xml?importado=${parsed.itens.length}&tipo=glosas&rejeitados=${parsed.rejeitados}`);
  }

  if(layout==="equivalencias"){
    const parsed=parseEquivalenciasXml(raw,arquivo.name);
    for(let start=0;start<parsed.itens.length;start+=BATCH){
      const {error}=await supabase.rpc("importar_referencia_lote",{p_empresa:empresaId,p_unidade:unidadeId,p_target:"equivalencias",p_payload:parsed.itens.slice(start,start+BATCH)});
      if(error){console.error("[xml-ref] equivalencias",error.code);redirect("/comercial/tabelas/xml?erro=equivalencias");}
    }
    revalidatePath("/comercial/tabelas/xml");
    redirect(`/comercial/tabelas/xml?importado=${parsed.itens.length}&tipo=equivalencias&rejeitados=${parsed.rejeitados}`);
  }

  const config=preset(arquivo.name);
  if(!config)redirect("/comercial/tabelas/xml?erro=arquivo-nao-mapeado");
  const vigenciaInicio=text(formData,"vigencia_inicio");
  if(!vigenciaInicio)redirect("/comercial/tabelas/xml?erro=vigencia");
  const parsed=parseCommercialXml(raw,layout);
  if(!parsed.itens.length)redirect("/comercial/tabelas/xml?erro=sem-itens");

  const {data:fonteExistente}=await supabase.from("tabelas_comerciais_fontes").select("id").eq("empresa_id",empresaId).eq("codigo",config.codigo).maybeSingle();
  let fonteId=fonteExistente?.id as string|undefined;
  if(!fonteId){
    const {data,error}=await supabase.from("tabelas_comerciais_fontes").insert({empresa_id:empresaId,codigo:config.codigo,nome:config.nome,tipo:config.tipo,proprietaria:config.proprietaria,observacoes:`Importado de ${arquivo.name}`,created_by:user.id}).select("id").single();
    if(error||!data)redirect("/comercial/tabelas/xml?erro=fonte");
    fonteId=data.id;
  }

  const hash=createHash("sha256").update(raw).digest("hex");
  const {data:edicaoExistente}=await supabase.from("tabelas_comerciais_edicoes").select("id").eq("fonte_id",fonteId).eq("nome_edicao",config.edicao).maybeSingle();
  let edicaoId=edicaoExistente?.id as string|undefined;
  if(!edicaoId){
    const {data,error}=await supabase.from("tabelas_comerciais_edicoes").insert({fonte_id:fonteId,nome_edicao:config.edicao,referencia:config.edicao,vigencia_inicio:vigenciaInicio,status:"rascunho",metodo_calculo:config.metodo,origem_arquivo:arquivo.name,hash_arquivo:hash,observacoes:"Importação XML histórica; validar vigência e regras contratuais antes de marcar como vigente.",created_by:user.id}).select("id").single();
    if(error||!data)redirect("/comercial/tabelas/xml?erro=edicao");
    edicaoId=data.id;
  }

  const tussMap=new Map<string,string>();
  if(layout==="amb"){
    const codigos=parsed.itens.map(i=>i.codigo);
    for(let start=0;start<codigos.length;start+=300){
      const {data}=await supabase.from("referencia_equivalencias").select("codigo_origem,codigo_destino,status").eq("sistema_origem","AMB").eq("sistema_destino","TUSS").in("codigo_origem",codigos.slice(start,start+300)).in("status",["ativa","revisar"]);
      for(const row of data??[])if(!tussMap.has(row.codigo_origem))tussMap.set(row.codigo_origem,row.codigo_destino);
    }
  }

  const rows=parsed.itens.map(item=>{
    const codigoTuss=tussMap.get(item.codigo)??null;
    return {edicao_id:edicaoId,codigo:item.codigo,descricao:item.descricao,categoria_item:"procedimento",tabela_tiss_codigo:codigoTuss?"22":"00",familia_tuss:codigoTuss?22:null,codigo_tuss:codigoTuss,valor_referencia:item.valor_referencia,pontos_ch:item.pontos_ch,porte:item.porte,quantidade_uco:item.quantidade_uco,porte_anestesico:item.porte_anestesico,exige_autorizacao:false,ativo:true,metadata:{...item.metadata,arquivo_origem:arquivo.name,hash_arquivo:hash}};
  });
  for(let start=0;start<rows.length;start+=BATCH){
    const {error}=await supabase.from("tabelas_comerciais_itens").upsert(rows.slice(start,start+BATCH),{onConflict:"edicao_id,codigo"});
    if(error){console.error("[xml-ref] itens",{code:error.code,start});redirect("/comercial/tabelas/xml?erro=itens");}
  }
  revalidatePath("/comercial/tabelas");revalidatePath("/comercial/tabelas/itens");revalidatePath("/comercial/tabelas/xml");
  redirect(`/comercial/tabelas/xml?importado=${rows.length}&tipo=${layout}&rejeitados=${parsed.rejeitados}`);
}
