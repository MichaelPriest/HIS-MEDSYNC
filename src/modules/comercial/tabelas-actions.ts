"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAssistencialContext } from "@/modules/assistencial/context";

const text=(fd:FormData,k:string)=>String(fd.get(k)??"").trim();
const num=(v:string)=>{const normalized=v.replace(/\s/g,"").replace(/\.(?=\d{3}(?:\D|$))/g,"").replace(",",".");const n=Number(normalized);return Number.isFinite(n)?n:0};
const nullableNum=(v:string)=>v.trim()===""?null:num(v);

const categorias=new Set(["diaria","taxa","gas_medicinal","material","opme","medicamento","procedimento","pacote","outro"]);
function familia(categoria:string){if(["diaria","taxa","gas_medicinal"].includes(categoria))return 18;if(["material","opme"].includes(categoria))return 19;if(categoria==="medicamento")return 20;if(categoria==="procedimento")return 22;return null;}
function tabelaTiss(categoria:string,codigoTuss:string){if(categoria==="pacote")return "98";const f=familia(categoria);return codigoTuss&&f?String(f):"00";}
function splitCsv(line:string,sep:string){const out:string[]=[];let cur="",quoted=false;for(let i=0;i<line.length;i++){const ch=line[i];if(ch==='"'){if(quoted&&line[i+1]==='"'){cur+='"';i++;}else quoted=!quoted;}else if(ch===sep&&!quoted){out.push(cur.trim());cur="";}else cur+=ch;}out.push(cur.trim());return out;}
function header(v:string){return v.normalize("NFD").replace(/[\u0300-\u036f]/g,"").trim().toLowerCase().replace(/[\s-]+/g,"_");}

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
  if(text(formData,"status")==="vigente") await supabase.from("tabelas_comerciais_edicoes").update({status:"encerrada",vigencia_fim:new Date(new Date(`${inicio}T12:00:00`).getTime()-86400000).toISOString().slice(0,10)}).eq("fonte_id",fonteId).eq("status","vigente");
  const {error}=await supabase.from("tabelas_comerciais_edicoes").insert({fonte_id:fonteId,convenio_id:text(formData,"convenio_id")||null,nome_edicao:nomeEdicao,referencia:text(formData,"referencia")||null,data_publicacao:text(formData,"data_publicacao")||null,vigencia_inicio:inicio,vigencia_fim:text(formData,"vigencia_fim")||null,status:text(formData,"status")||"rascunho",metodo_calculo:text(formData,"metodo_calculo")||"fixo",valor_uco:nullableNum(text(formData,"valor_uco")),observacoes:text(formData,"observacoes")||null,created_by:user.id});
  if(error) redirect("/comercial/tabelas?erro=edicao"); revalidatePath("/comercial/tabelas");
}

export async function importarItensTabela(formData:FormData){
  const {supabase,empresaId}=await getAssistencialContext(); const edicaoId=text(formData,"edicao_id"); const arquivo=formData.get("arquivo");
  if(!edicaoId||!(arquivo instanceof File)||arquivo.size===0||arquivo.size>20*1024*1024) redirect("/comercial/tabelas?erro=arquivo");
  const {data:edicao}=await supabase.from("tabelas_comerciais_edicoes").select("id,fonte:tabelas_comerciais_fontes(empresa_id,tipo)").eq("id",edicaoId).maybeSingle();
  const fonte=Array.isArray(edicao?.fonte)?edicao?.fonte[0]:edicao?.fonte;
  if(!edicao||!fonte||fonte.empresa_id!==empresaId) redirect("/comercial/tabelas?erro=edicao");

  const raw=(await arquivo.text()).replace(/^\uFEFF/,"");const linhas=raw.split(/\r?\n/).filter(l=>l.trim());if(linhas.length<2)redirect("/comercial/tabelas?erro=arquivo-vazio");
  const sep=linhas[0].includes(";")?";":",";const headers=splitCsv(linhas[0],sep).map(header);
  const idx=(...nomes:string[])=>headers.findIndex(h=>nomes.includes(h));const value=(c:string[],...nomes:string[])=>{const i=idx(...nomes);return i>=0?String(c[i]??"").trim():""};
  const iCodigo=idx("codigo","codigo_item","codigo_fonte");const iDesc=idx("descricao","nome");if(iCodigo<0||iDesc<0)redirect("/comercial/tabelas?erro=colunas");

  const parsed=linhas.slice(1).map(l=>splitCsv(l,sep)).filter(c=>c[iCodigo]&&c[iDesc]);
  const codigosInternos=[...new Set(parsed.map(c=>value(c,"codigo_interno")).filter(Boolean))];
  const masterMap=new Map<string,string>();
  for(let start=0;start<codigosInternos.length;start+=300){const {data}=await supabase.from("itens_assistenciais").select("id,codigo_interno").eq("empresa_id",empresaId).in("codigo_interno",codigosInternos.slice(start,start+300));for(const item of data??[])masterMap.set(item.codigo_interno,item.id);}

  const rows=parsed.map(c=>{
    const categoriaRaw=value(c,"categoria","tipo_item","tipo").toLowerCase().replaceAll(" ","_");
    const categoria=categorias.has(categoriaRaw)?categoriaRaw:"outro";
    const codigoTuss=value(c,"codigo_tuss","tuss");
    const codigoInterno=value(c,"codigo_interno");
    const tabela=tabelaTiss(categoria,codigoTuss);
    const codigoProprio=value(c,"codigo_tabela_propria","codigo_proprio","codigo_operadora")||null;
    return {
      edicao_id:edicaoId,
      item_assistencial_id:codigoInterno?masterMap.get(codigoInterno)??null:null,
      codigo:c[iCodigo],descricao:c[iDesc],categoria_item:categoria,tabela_tiss_codigo:tabela,familia_tuss:familia(categoria),
      codigo_tuss:codigoTuss||null,codigo_tabela_propria:codigoProprio,
      valor_referencia:num(value(c,"valor","valor_referencia","preco","preco_referencia")||"0"),
      valor_fabrica:nullableNum(value(c,"valor_fabrica","pf","preco_fabrica")),valor_maximo:nullableNum(value(c,"valor_maximo","pmvg")),valor_pmc:nullableNum(value(c,"valor_pmc","pmc")),
      codigo_fabricante:value(c,"codigo_fabricante")||null,codigo_anvisa:value(c,"codigo_anvisa","anvisa","registro_anvisa")||null,
      codigo_brasindice:value(c,"codigo_brasindice","brasindice")||null,codigo_simpro:value(c,"codigo_simpro","simpro")||null,
      ean:value(c,"ean","gtin","codigo_barras")||null,ggrem:value(c,"ggrem")||null,
      fabricante:value(c,"fabricante","laboratorio")||null,apresentacao:value(c,"apresentacao")||null,unidade:value(c,"unidade","unidade_medida")||null,
      percentual_acrescimo:nullableNum(value(c,"percentual_acrescimo","acrescimo_percentual")),icms_percentual:nullableNum(value(c,"icms","icms_percentual")),tipo_lista_cmed:value(c,"tipo_lista_cmed","lista_cmed")||null,
      pontos_ch:nullableNum(value(c,"ch","pontos_ch","quantidade_ch")),pontos_hm:nullableNum(value(c,"hm","pontos_hm","quantidade_hm")),pontos_sadt:nullableNum(value(c,"sadt","pontos_sadt","quantidade_sadt")),
      porte:value(c,"porte")||null,quantidade_uco:nullableNum(value(c,"uco","quantidade_uco","qtd_uco")),porte_anestesico:value(c,"porte_anestesico")||null,
      exige_autorizacao:["1","true","sim","s"].includes(value(c,"exige_autorizacao","autorizacao_previa").toLowerCase())
    };
  });
  if(!rows.length)redirect("/comercial/tabelas?erro=sem-itens");
  for(let start=0;start<rows.length;start+=500){const {error}=await supabase.from("tabelas_comerciais_itens").upsert(rows.slice(start,start+500),{onConflict:"edicao_id,codigo"});if(error){console.error("[tabelas] importar",{code:error.code,start});redirect("/comercial/tabelas?erro=importacao");}}
  revalidatePath("/comercial/tabelas");revalidatePath("/comercial/tabelas/itens");redirect(`/comercial/tabelas?importado=${rows.length}`);
}

export async function vincularTabelaContrato(formData:FormData){
  const {supabase}=await getAssistencialContext();
  const contratoId=text(formData,"contrato_id"), fonteId=text(formData,"fonte_id"); if(!contratoId||!fonteId) redirect("/comercial/tabelas?erro=vinculo");
  const regrasAdicionais={urgencia_percentual:num(text(formData,"urgencia_percentual")||"0"),apartamento_percentual:num(text(formData,"apartamento_percentual")||"0"),horario_especial_regra:text(formData,"horario_especial_regra")||null};
  const payload={contrato_id:contratoId,fonte_id:fonteId,edicao_fixa_id:text(formData,"edicao_fixa_id")||null,categoria:text(formData,"categoria")||"geral",modo_edicao:text(formData,"modo_edicao")||"vigente_na_data",percentual_ajuste:num(text(formData,"percentual_ajuste")||"0"),prioridade:Number(text(formData,"prioridade")||100),valor_ch:nullableNum(text(formData,"valor_ch")),valor_hm:nullableNum(text(formData,"valor_hm")),valor_sadt:nullableNum(text(formData,"valor_sadt")),valor_uco_contratual:nullableNum(text(formData,"valor_uco_contratual")),regras_adicionais:regrasAdicionais,arredondamento_casas:Number(text(formData,"arredondamento_casas")||2),ativo:true,observacoes:text(formData,"observacoes")||null};
  const {error}=await supabase.from("contrato_tabelas_comerciais").upsert(payload,{onConflict:"contrato_id,fonte_id,categoria"}); if(error) redirect("/comercial/tabelas?erro=vinculo"); revalidatePath("/comercial/tabelas");
}

export async function salvarValoresPortesCbhpm(formData:FormData){
  const {supabase}=await getAssistencialContext(); const edicaoId=text(formData,"edicao_id"); if(!edicaoId) redirect("/comercial/tabelas?erro=cbhpm-edicao");
  const portes=[] as Array<{edicao_id:string;porte:string;valor:number}>;
  for(let n=1;n<=14;n++) for(const letra of ["A","B","C"]){const porte=`${n}${letra}`;const bruto=text(formData,`porte_${porte}`);if(bruto!=="") portes.push({edicao_id:edicaoId,porte,valor:num(bruto)});}
  if(!portes.length) redirect("/comercial/tabelas?erro=cbhpm-portes");
  const {error}=await supabase.from("cbhpm_valores_portes").upsert(portes,{onConflict:"edicao_id,porte"}); if(error) redirect("/comercial/tabelas?erro=cbhpm-portes");
  revalidatePath("/comercial/tabelas"); redirect("/comercial/tabelas?portes=1");
}
