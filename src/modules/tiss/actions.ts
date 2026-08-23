"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getAssistencialContext } from "@/modules/assistencial/context";

function text(fd: FormData, key: string) { return String(fd.get(key) ?? "").trim(); }
function money(fd: FormData, key: string) { const raw=text(fd,key).replace(/\./g, "").replace(",", "."); const n=Number(raw || 0); return Number.isFinite(n) ? n : 0; }

export async function criarLoteTiss(formData: FormData) {
  const { supabase, user, empresaId, unidadeId } = await getAssistencialContext();
  const convenioId = text(formData, "convenio_id");
  const competencia = text(formData, "competencia");
  if (!convenioId || !competencia) redirect("/faturamento/lotes?erro=campos");
  const { data: versao } = await supabase.from("tiss_versoes").select("id").eq("ativo", true).order("vigente_desde", { ascending: false }).limit(1).maybeSingle();
  if (!versao) redirect("/faturamento/lotes?erro=versao");
  const { data: guias } = await supabase.from("tiss_guias").select("id,valor_total,status").eq("empresa_id", empresaId).eq("unidade_id", unidadeId).eq("convenio_id", convenioId).in("status", ["rascunho","pronta"]).limit(500);
  const elegiveis = (guias ?? []).filter((g) => ["rascunho","pronta"].includes(String(g.status)));
  if (!elegiveis.length) redirect("/faturamento/lotes?erro=sem-guias");
  const numeroLote = `L${new Date().toISOString().slice(0,10).replaceAll("-","")}${String(Date.now()).slice(-6)}`;
  const valorTotal = elegiveis.reduce((s,g)=>s+Number(g.valor_total||0),0);
  const { data: lote, error } = await supabase.from("tiss_lotes").insert({ empresa_id: empresaId, unidade_id: unidadeId, convenio_id: convenioId, versao_id: versao.id, numero_lote: numeroLote, competencia, status: "rascunho", quantidade_guias: elegiveis.length, valor_total: valorTotal, created_by: user.id }).select("id").single();
  if (error || !lote) redirect("/faturamento/lotes?erro=criar");
  const { error: linkError } = await supabase.from("tiss_lote_guias").insert(elegiveis.map((g)=>({ lote_id:lote.id, guia_id:g.id })));
  if (linkError) redirect(`/faturamento/lotes/${lote.id}?erro=vinculo`);
  await supabase.from("tiss_guias").update({ status:"em_lote", updated_by:user.id, updated_at:new Date().toISOString() }).in("id", elegiveis.map((g)=>g.id));
  redirect(`/faturamento/lotes/${lote.id}`);
}

export async function gerarXmlPreliminar(loteId: string) {
  const { supabase } = await getAssistencialContext();
  const { data: lote } = await supabase.from("tiss_lotes").select("id,numero_lote,convenio_id,versao:tiss_versoes(comunicacao_principal),guias:tiss_lote_guias(guia:tiss_guias(id,tipo_guia,numero_guia_prestador,registro_ans,numero_carteirinha,valor_total,itens:tiss_guia_itens(sequencial,tabela,codigo_procedimento,descricao,quantidade,valor_unitario,valor_total)))").eq("id", loteId).maybeSingle();
  if (!lote) redirect("/faturamento/lotes?erro=lote");
  const versaoRel = Array.isArray(lote.versao) ? lote.versao[0] : lote.versao;
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<!-- XML PRELIMINAR INTERNO. NAO ENVIAR. Requer montagem final conforme XSD oficial ANS e validacao XSD. -->\n<medsync:tissPreliminar xmlns:medsync="urn:medsync:tiss:preliminar" lote="${lote.numero_lote}">\n  <medsync:versaoComunicacao>${versaoRel?.comunicacao_principal ?? ""}</medsync:versaoComunicacao>\n  <medsync:observacao>Estrutura interna de conferencia; nao representa mensagem TISS valida para operadora.</medsync:observacao>\n</medsync:tissPreliminar>`;
  await supabase.from("tiss_xmls").delete().eq("lote_id", loteId).eq("tipo_mensagem", "PRELIMINAR_INTERNO");
  const { error } = await supabase.from("tiss_xmls").insert({ lote_id:loteId, tipo_mensagem:"PRELIMINAR_INTERNO", versao_comunicacao:versaoRel?.comunicacao_principal ?? "", xml_conteudo:xml, xsd_validado:false, erros_validacao:[{codigo:"XSD_PENDENTE",mensagem:"XSD oficial ainda não instalado/validado no gerador."}] });
  if (error) redirect(`/faturamento/lotes/${loteId}?erro=xml`);
  await supabase.from("tiss_lotes").update({ status:"invalido", xsd_validado:false, erros_validacao:[{codigo:"XSD_PENDENTE",mensagem:"Aguardando validador XSD oficial ANS."}] }).eq("id", loteId);
  revalidatePath(`/faturamento/lotes/${loteId}`);
  redirect(`/faturamento/lotes/${loteId}?xml=preliminar`);
}

export async function registrarProtocolo(loteId: string, formData: FormData) {
  const { supabase, user, empresaId, unidadeId } = await getAssistencialContext();
  const numero = text(formData,"numero_protocolo");
  if (!numero) redirect(`/faturamento/lotes/${loteId}?erro=protocolo`);
  const { error } = await supabase.from("tiss_protocolos").insert({ empresa_id:empresaId, unidade_id:unidadeId, lote_id:loteId, numero_protocolo:numero, data_protocolo:text(formData,"data_protocolo")||null, status:text(formData,"status")||"recebido", valor_apresentado:money(formData,"valor_apresentado"), valor_processado:money(formData,"valor_processado"), valor_liberado:money(formData,"valor_liberado"), valor_glosa:money(formData,"valor_glosa"), observacoes:text(formData,"observacoes")||null, created_by:user.id });
  if (error) redirect(`/faturamento/lotes/${loteId}?erro=protocolo`);
  await supabase.from("tiss_lotes").update({ status:"protocolado", protocolo_operadora:numero, retorno_em:new Date().toISOString() }).eq("id",loteId);
  revalidatePath(`/faturamento/lotes/${loteId}`);
}

export async function registrarGlosa(loteId: string, formData: FormData) {
  const { supabase, empresaId, unidadeId } = await getAssistencialContext();
  const codigo=text(formData,"codigo_glosa"); const valor=money(formData,"valor_glosado");
  if (!codigo || valor <= 0) redirect(`/faturamento/lotes/${loteId}?erro=glosa`);
  const { error } = await supabase.from("tiss_glosas").insert({ empresa_id:empresaId, unidade_id:unidadeId, lote_id:loteId, protocolo_id:text(formData,"protocolo_id")||null, guia_id:text(formData,"guia_id")||null, guia_item_id:text(formData,"guia_item_id")||null, codigo_glosa:codigo, descricao_glosa:text(formData,"descricao_glosa")||null, valor_glosado:valor });
  if (error) redirect(`/faturamento/lotes/${loteId}?erro=glosa`);
  revalidatePath(`/faturamento/lotes/${loteId}`);
}

export async function criarRecursoGlosa(formData: FormData) {
  const { supabase, user, empresaId, unidadeId } = await getAssistencialContext();
  const glosaId=text(formData,"glosa_id"); const justificativa=text(formData,"justificativa"); const valor=money(formData,"valor_recursado");
  if (!glosaId || !justificativa || valor<=0) redirect("/faturamento/glosas?erro=campos");
  const { data: glosa } = await supabase.from("tiss_glosas").select("id,valor_glosado,protocolo_id,lote:tiss_lotes(convenio_id)").eq("id",glosaId).maybeSingle();
  if (!glosa || valor > Number(glosa.valor_glosado||0)) redirect("/faturamento/glosas?erro=valor");
  const lote = Array.isArray(glosa.lote) ? glosa.lote[0] : glosa.lote;
  if (!lote?.convenio_id) redirect("/faturamento/glosas?erro=convenio");
  const numero=`R${new Date().toISOString().slice(0,10).replaceAll("-","")}${String(Date.now()).slice(-6)}`;
  const { data: recurso, error } = await supabase.from("tiss_recursos_glosa").insert({ empresa_id:empresaId, unidade_id:unidadeId, convenio_id:lote.convenio_id, protocolo_id:glosa.protocolo_id, numero_recurso:numero, status:"rascunho", valor_total_recursado:valor, created_by:user.id, updated_by:user.id }).select("id").single();
  if (error || !recurso) redirect("/faturamento/glosas?erro=recurso");
  const { error: itemError } = await supabase.from("tiss_recurso_itens").insert({ recurso_id:recurso.id, glosa_id:glosaId, valor_recursado:valor, justificativa });
  if (itemError) redirect("/faturamento/glosas?erro=recurso-item");
  await supabase.from("tiss_glosas").update({ status:"em_recurso" }).eq("id",glosaId);
  redirect(`/faturamento/recursos/${recurso.id}`);
}
