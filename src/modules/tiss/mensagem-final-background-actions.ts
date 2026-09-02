"use server";

import { revalidatePath } from "next/cache";
import type { BackgroundActionState } from "@/lib/actions/background-action";
import { getAssistencialContext } from "@/modules/assistencial/context";
import {
  TISS_FINAL_VERSION,
  type TissFinalGuide040300,
  type TissFinalItem040300,
  type TissGuideType040300,
} from "@/modules/tiss/mensagem-final-040300";
import { serializeTissWireLoteGuias040300 } from "@/modules/tiss/mensagem-final-wire-040300";
import { validateTissXmlXsd } from "@/modules/tiss/xsd-validator";

export type TissFinalGenerationData = {
  xmlId: string;
  hashTissMd5: string;
  hashSha256: string;
  quantidadeGuias: number;
  tipoGuia: TissGuideType040300;
};

type GuideRow = Omit<TissFinalGuide040300, "itens"> & { empresa_id: string; unidade_id: string; convenio_id: string; versao_id: string; status: string };

function one<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

function nowSaoPaulo() {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = Object.fromEntries(formatter.formatToParts(new Date()).map((part) => [part.type, part.value]));
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${parts.hour}:${parts.minute}:${parts.second}`,
  };
}

function generationMessage(error: unknown) {
  const value = error instanceof Error ? error.message : String(error ?? "");
  if (value.includes("TISS040300_CARACTERE_FORA_ISO_8859_1")) return "Há caractere fora do ISO-8859-1 em um campo da mensagem. Corrija o texto antes de gerar o TISS.";
  if (value.includes("TISS040300_ITEM_UNIDADE_OBRIGATORIA")) return "Existe despesa sem unidade de medida TISS. Complete o item na guia antes de gerar o XML.";
  if (value.includes("TISS040300_ORIGEM_ITEM_NAO_SUPORTADA")) return "Existe item sem categoria TISS reconhecida para procedimentos ou outras despesas.";
  if (value.includes("TISS040300_PRESTADOR_SEM_IDENTIFICACAO")) return "Não há código do prestador na operadora nem CNPJ válido para identificar o prestador.";
  if (value.includes("TISS040300_CAMPO_OBRIGATORIO")) return `A mensagem final ainda possui campo obrigatório incompleto (${value.split(":").slice(1).join(":")}).`;
  return "Não foi possível compor a mensagem TISS final com os dados atuais.";
}

export async function gerarMensagemTissFinalBackground(
  loteId: string,
  _previous: BackgroundActionState<TissFinalGenerationData>,
  _formData: FormData,
): Promise<BackgroundActionState<TissFinalGenerationData>> {
  const { supabase, empresaId, unidadeId } = await getAssistencialContext();

  const { data: lote, error: loteError } = await supabase
    .from("tiss_lotes")
    .select("id,empresa_id,unidade_id,convenio_id,versao_id,numero_lote,status,versao:tiss_versoes(comunicacao_principal),convenio:convenios(registro_ans)")
    .eq("id", loteId)
    .eq("empresa_id", empresaId)
    .eq("unidade_id", unidadeId)
    .maybeSingle();
  if (loteError || !lote) return { status: "error", code: "lote", message: "Lote TISS não localizado no escopo ativo." };
  if (["enviado", "protocolado", "aceito", "rejeitado"].includes(String(lote.status))) return { status: "error", code: "lote-finalizado", message: "O lote já entrou em etapa que não permite regenerar a mensagem." };

  const versao = one(lote.versao);
  const convenio = one(lote.convenio);
  if (versao?.comunicacao_principal !== TISS_FINAL_VERSION) return { status: "error", code: "versao", message: `Este gerador atende Comunicação ${TISS_FINAL_VERSION}; a versão do lote é ${versao?.comunicacao_principal ?? "não informada"}.` };
  const registroAns = String(convenio?.registro_ans ?? "").trim();

  const [{ data: empresa }, { data: links }] = await Promise.all([
    supabase.from("empresas").select("id,cnpj").eq("id", empresaId).maybeSingle(),
    supabase.from("tiss_lote_guias").select("guia_id").eq("lote_id", loteId).order("guia_id"),
  ]);
  if (!empresa) return { status: "error", code: "empresa", message: "Empresa do lote não localizada." };
  const cnpj = String(empresa.cnpj ?? "").replace(/\D/g, "");
  const guideIds = (links ?? []).map((link) => link.guia_id);
  if (!guideIds.length) return { status: "error", code: "sem-guias", message: "O lote não possui guias vinculadas." };

  const [{ data: guides, error: guidesError }, { data: items, error: itemsError }, { count: criticalCount }] = await Promise.all([
    supabase
      .from("tiss_guias")
      .select("id,empresa_id,unidade_id,convenio_id,versao_id,status,tipo_guia,numero_guia_prestador,numero_guia_operadora,registro_ans,codigo_prestador_operadora,numero_carteirinha,atendimento_rn,data_atendimento,hora_inicio,validade_senha,senha_autorizacao,data_autorizacao,cnes_snapshot,profissional_nome_snapshot,codigo_conselho_ans_snapshot,profissional_numero_conselho_snapshot,profissional_uf_conselho_snapshot,profissional_cbo_snapshot,indicador_acidente,regime_atendimento_tiss,carater_atendimento,tipo_atendimento_tuss50_codigo,tipo_consulta_tuss52_codigo,numero_solicitacao_internacao,tipo_faturamento_tiss,data_inicio_faturamento,hora_inicio_faturamento,data_fim_faturamento,hora_fim_faturamento,tipo_internacao_tiss,regime_internacao_tiss,motivo_encerramento_tiss,solicitante_codigo_prestador_snapshot,solicitante_cnpj_snapshot,solicitante_nome_contratado_snapshot,solicitante_nome_profissional_snapshot,solicitante_codigo_conselho_ans_snapshot,solicitante_numero_conselho_snapshot,solicitante_uf_conselho_snapshot,solicitante_cbo_snapshot")
      .in("id", guideIds)
      .order("data_atendimento", { ascending: true })
      .order("id", { ascending: true }),
    supabase
      .from("tiss_guia_itens")
      .select("guia_id,sequencial,data_execucao,hora_inicial,hora_final,tabela,codigo_procedimento,descricao,quantidade,valor_unitario,valor_total,via_acesso,tecnica_utilizada,reducao_acrescimo,origem_tipo,unidade_medida_tiss")
      .in("guia_id", guideIds)
      .order("guia_id", { ascending: true })
      .order("sequencial", { ascending: true }),
    supabase
      .from("tiss_guia_criticas")
      .select("id", { count: "exact", head: true })
      .in("guia_id", guideIds)
      .eq("resolvida", false)
      .eq("severidade", "erro"),
  ]);
  if (guidesError || itemsError || !guides || guides.length !== guideIds.length) return { status: "error", code: "dados", message: "Não foi possível carregar todas as guias e itens do lote." };
  if ((criticalCount ?? 0) > 0) return { status: "error", code: "criticas", message: `O lote possui ${criticalCount} crítica(s) impeditiva(s). Revalide as guias antes de gerar o XML final.` };

  const itemsByGuide = new Map<string, TissFinalItem040300[]>();
  for (const item of items ?? []) {
    const list = itemsByGuide.get(item.guia_id) ?? [];
    list.push({
      sequencial: Number(item.sequencial),
      data_execucao: String(item.data_execucao ?? ""),
      hora_inicial: item.hora_inicial,
      hora_final: item.hora_final,
      tabela: String(item.tabela ?? ""),
      codigo_procedimento: String(item.codigo_procedimento ?? ""),
      descricao: item.descricao,
      quantidade: Number(item.quantidade),
      valor_unitario: Number(item.valor_unitario),
      valor_total: Number(item.valor_total),
      via_acesso: item.via_acesso,
      tecnica_utilizada: item.tecnica_utilizada,
      reducao_acrescimo: item.reducao_acrescimo == null ? null : Number(item.reducao_acrescimo),
      origem_tipo: item.origem_tipo,
      unidade_medida_tiss: item.unidade_medida_tiss,
    });
    itemsByGuide.set(item.guia_id, list);
  }

  const mappedGuides = guides.map((guide) => ({ ...guide, itens: itemsByGuide.get(guide.id) ?? [] })) as unknown as GuideRow[];
  for (const guide of mappedGuides) {
    if (guide.empresa_id !== empresaId || guide.unidade_id !== unidadeId || guide.convenio_id !== lote.convenio_id || guide.versao_id !== lote.versao_id) return { status: "error", code: "escopo-divergente", message: "Uma guia do lote diverge de empresa, unidade, convênio ou versão TISS." };
    if (guide.status !== "em_lote") return { status: "error", code: "status-guia", message: "Todas as guias precisam estar vinculadas e bloqueadas no lote antes da geração final." };
  }

  const now = nowSaoPaulo();
  let serialized;
  try {
    serialized = serializeTissWireLoteGuias040300({
      numero_lote: lote.numero_lote,
      registro_ans: registroAns,
      prestador_codigo_operadora: null,
      prestador_cnpj: cnpj,
      data_transacao: now.date,
      hora_transacao: now.time,
      guias: mappedGuides as unknown as TissFinalGuide040300[],
    });
  } catch (error) {
    console.error("[tiss.final] preflight/serializacao", { loteId, error: error instanceof Error ? error.message : String(error) });
    return { status: "error", code: "preflight", message: generationMessage(error) };
  }

  const validation = await validateTissXmlXsd(serialized.xml);
  if (!validation.valid) {
    const details = validation.errors.slice(0, 3).map((error) => error.linha ? `linha ${error.linha}: ${error.mensagem}` : error.mensagem).join(" · ");
    return { status: "error", code: "xsd-invalido", message: `O XML final não passou no XSD ANS ${validation.version}. ${details || "Revise as críticas estruturais."}` };
  }
  if (validation.hashSha256 !== serialized.hashSha256) return { status: "error", code: "hash-divergente", message: "A validação produziu hash técnico divergente; o XML não foi persistido." };

  const { data: xmlId, error: stageError } = await supabase.rpc("salvar_xml_candidato_tiss_operacional", {
    p_lote_id: loteId,
    p_xml_conteudo: serialized.xml,
    p_versao_comunicacao: TISS_FINAL_VERSION,
    p_hash_sha256: serialized.hashSha256,
    p_hash_tiss_md5: serialized.hashTissMd5,
  });
  if (stageError || !xmlId) {
    console.error("[tiss.final] staging", { code: stageError?.code, loteId });
    return { status: "error", code: "persistencia", message: "O XML passou no XSD, mas não pôde ser persistido na trilha transacional." };
  }

  const { error: promoteError } = await supabase.rpc("registrar_validacao_xsd_tiss_operacional", {
    p_xml_id: xmlId,
    p_xsd_validado: true,
    p_erros: [],
    p_hash: serialized.hashSha256,
    p_versao: TISS_FINAL_VERSION,
  });
  if (promoteError) {
    console.error("[tiss.final] promocao XSD", { code: promoteError.code, loteId, xmlId });
    return { status: "error", code: "promocao", message: "O XML validado foi registrado como candidato, mas não foi promovido para envio. Ele permanece bloqueado para transmissão." };
  }

  revalidatePath("/faturamento");
  revalidatePath("/faturamento/lotes");
  revalidatePath(`/faturamento/lotes/${loteId}`);

  return {
    status: "success",
    code: "xml-final-validado",
    message: `Mensagem ENVIO_LOTE_GUIAS ${TISS_FINAL_VERSION} gerada e validada pelo XSD oficial. MD5 TISS ${serialized.hashTissMd5}.`,
    data: {
      xmlId: String(xmlId),
      hashTissMd5: serialized.hashTissMd5,
      hashSha256: serialized.hashSha256,
      quantidadeGuias: serialized.quantidadeGuias,
      tipoGuia: serialized.tipoGuia,
    },
  };
}
