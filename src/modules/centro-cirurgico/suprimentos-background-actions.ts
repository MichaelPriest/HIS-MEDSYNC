"use server";

import { revalidatePath } from "next/cache";
import type { BackgroundActionState } from "@/lib/actions/background-action";
import { getAssistencialContext } from "@/modules/assistencial/context";

export type SurgicalSupplyActionData = {
  cirurgiaId?: string;
  requisicaoId?: string;
  movimentoId?: string;
  estornoId?: string;
  opmeId?: string | null;
  action?: "request" | "receive" | "consume" | "reverse";
};

export type SurgicalSupplyActionState = BackgroundActionState<SurgicalSupplyActionData>;

const text = (fd: FormData, key: string) => {
  const value = String(fd.get(key) ?? "").trim();
  return value || null;
};

const numeric = (fd: FormData, key: string) => {
  const raw = text(fd, key);
  if (!raw) return null;
  const value = Number(raw.replace(",", "."));
  return Number.isFinite(value) ? value : null;
};

const operationalMessages: Record<string, string> = {
  CC_AUTENTICACAO_OBRIGATORIA: "Sua sessão não está válida para esta operação. Entre novamente no sistema.",
  CC_CIRURGIA_NAO_LOCALIZADA: "A cirurgia não foi localizada no contexto atual.",
  CC_UNIDADE_FORA_ESCOPO: "A cirurgia ou o estoque não pertence à unidade selecionada.",
  CC_SEM_PERMISSAO_OPERAR: "Seu perfil não possui permissão para operar suprimentos do Centro Cirúrgico.",
  CC_SUPRIMENTO_CIRURGIA_FORA_FLUXO: "A cirurgia não está em uma etapa que permita novas requisições de suprimentos.",
  CC_SUPRIMENTO_PRIORIDADE_INVALIDA: "A prioridade informada para a requisição é inválida.",
  CC_SUPRIMENTO_LOCAL_DESTINO_INVALIDO: "Selecione um local de estoque ativo da unidade como destino.",
  CC_SUPRIMENTO_SEM_ITENS: "Inclua pelo menos um item na requisição.",
  CC_SUPRIMENTO_SEM_ITENS_VALIDOS: "A requisição não possui itens com produto e quantidade válidos.",
  CC_SUPRIMENTO_PRODUTO_INVALIDO: "Um dos produtos selecionados não está ativo ou não pertence à empresa.",
  CC_SUPRIMENTO_TIPO_NAO_ASSISTENCIAL: "Um dos produtos selecionados não é um suprimento assistencial permitido.",
  CC_REQUISICAO_CIRURGICA_NAO_LOCALIZADA: "A requisição cirúrgica não foi localizada.",
  CC_REQUISICAO_AINDA_NAO_ATENDIDA: "A requisição ainda não foi atendida pelo setor de estoque.",
  CC_REQUISICAO_POSSUI_ITENS_PENDENTES: "Ainda existem itens pendentes na requisição; o recebimento não pode ser confirmado.",
  CC_SUPRIMENTO_QUANTIDADE_INVALIDA: "Informe uma quantidade de consumo maior que zero.",
  CC_CONSUMO_EXIGE_CIRURGIA_EM_ANDAMENTO: "O consumo físico só pode ser registrado enquanto a cirurgia estiver em andamento.",
  CC_SUPRIMENTO_LOTE_NAO_LOCALIZADO: "O lote selecionado não foi localizado.",
  CC_SUPRIMENTO_LOTE_FORA_ESCOPO: "O lote selecionado não pertence à empresa/unidade da cirurgia.",
  CC_SUPRIMENTO_LOTE_NAO_DISPONIVEL: "O lote selecionado não está disponível para consumo.",
  CC_SUPRIMENTO_LOTE_VENCIDO: "O lote selecionado está vencido e não pode ser consumido.",
  CC_SUPRIMENTO_ESTOQUE_INSUFICIENTE: "O saldo do lote é insuficiente para a quantidade informada.",
  CC_SUPRIMENTO_LOCAL_INATIVO: "O local de estoque do lote está inativo.",
  CC_MEDICAMENTO_EXIGE_FLUXO_FARMACIA_PRESCRICAO: "Medicamentos devem seguir Prescrição → Farmácia → Dispensação → Administração; não podem ser baixados diretamente nesta tela.",
  CC_SUPRIMENTO_TIPO_NAO_CONSUMIVEL: "Este tipo de produto não pode ser consumido diretamente pelo Centro Cirúrgico.",
  CC_OPME_ITEM_ASSISTENCIAL_ATIVO_OBRIGATORIO: "A OPME precisa estar vinculada a um item assistencial ativo antes do consumo.",
  CC_OPME_CATALOGO_INCONSISTENTE: "O produto OPME possui vínculo inconsistente com o catálogo assistencial.",
  CC_OPME_VINCULO_EM_PRODUTO_NAO_OPME: "Um planejamento OPME só pode ser vinculado a um produto do tipo OPME.",
  CC_REQUISICAO_ITEM_FORA_CIRURGIA: "O item de requisição selecionado não pertence a esta cirurgia.",
  CC_REQUISICAO_ITEM_PRODUTO_DIVERGENTE: "O lote e o item da requisição correspondem a produtos diferentes.",
  CC_REQUISICAO_ITEM_LOCAL_DIVERGENTE: "O lote não está no mesmo local de destino da requisição selecionada.",
  CC_REQUISICAO_ITEM_NAO_DISPONIVEL: "O item da requisição ainda não está disponível para consumo.",
  CC_CONSUMO_SUPERA_REQUISICAO_ATENDIDA: "A quantidade excede o saldo atendido ainda disponível na requisição.",
  CC_OPME_SERIE_JA_UTILIZADA: "A série informada para a OPME já foi utilizada em outro registro.",
  CC_OPME_PLANEJADA_NAO_LOCALIZADA: "A OPME planejada não foi localizada nesta cirurgia.",
  CC_OPME_PLANEJADA_JA_PROCESSADA: "A OPME planejada já foi processada e não pode receber novo consumo.",
  CC_ESTORNO_EXIGE_MOTIVO: "Informe o motivo do estorno.",
  CC_MOVIMENTO_CONSUMO_NAO_LOCALIZADO: "O consumo original não foi localizado para estorno.",
  CC_ESTORNO_POS_CONCLUSAO_EXIGE_AUDITORIA: "Após conclusão/cancelamento da cirurgia, o estorno deve seguir o fluxo de Auditoria.",
  CC_CONSUMO_JA_ESTORNADO: "Este consumo já foi totalmente estornado.",
  CC_ESTORNO_QUANTIDADE_INVALIDA: "A quantidade de estorno é inválida ou supera o saldo líquido do consumo.",
  CC_ESTORNO_LOTE_NAO_LOCALIZADO: "O lote original do consumo não foi localizado para devolução.",
  CC_OPME_ESTORNO_DEVE_SER_INTEGRAL: "OPME só pode ser estornada integralmente.",
  CC_OPME_NAO_ELEGIVEL_ESTORNO: "A OPME vinculada não está elegível para estorno.",
};

function databaseMessage(error: { message?: string | null }) {
  const raw = String(error.message ?? "");
  const key = Object.keys(operationalMessages).find((code) => raw.includes(code));
  return key ? operationalMessages[key] : null;
}

function failure(
  code: string,
  fallback: string,
  error?: { code?: string | null; message?: string | null },
  data?: SurgicalSupplyActionData,
): SurgicalSupplyActionState {
  return {
    status: "error",
    code,
    message: error ? databaseMessage(error) ?? fallback : fallback,
    detail: error?.code ? `Código técnico: ${error.code}` : undefined,
    data,
  };
}

function refresh(cirurgiaId: string) {
  revalidatePath("/assistencial/centro-cirurgico");
  revalidatePath("/assistencial/centro-cirurgico/suprimentos");
  revalidatePath(`/assistencial/centro-cirurgico/suprimentos/${cirurgiaId}`);
  revalidatePath("/almoxarifado");
  revalidatePath("/almoxarifado/requisicoes");
  revalidatePath("/faturamento/producao");
  revalidatePath("/integracoes");
}

function success(message: string, data: SurgicalSupplyActionData): SurgicalSupplyActionState {
  refresh(data.cirurgiaId ?? "");
  return { status: "success", message, data };
}

export async function requisitarSuprimentosCirurgicosBackground(
  _previousState: SurgicalSupplyActionState,
  fd: FormData,
): Promise<SurgicalSupplyActionState> {
  const { supabase } = await getAssistencialContext();
  const cirurgiaId = text(fd, "cirurgia_id");
  const localDestinoId = text(fd, "local_destino_id");
  const prioridade = text(fd, "prioridade") ?? "normal";
  if (!cirurgiaId || !localDestinoId) {
    return failure("campos-obrigatorios", "Selecione a cirurgia e o local de destino da requisição.", undefined, cirurgiaId ? { cirurgiaId } : undefined);
  }

  const itens = Array.from({ length: 8 }, (_, index) => index + 1)
    .map((n) => ({
      produto_id: text(fd, `produto_${n}_id`),
      quantidade: numeric(fd, `produto_${n}_quantidade`),
      observacoes: text(fd, `produto_${n}_observacoes`),
    }))
    .filter((item) => item.produto_id && item.quantidade && item.quantidade > 0);

  if (!itens.length) {
    return failure("sem-itens", "Inclua pelo menos um suprimento com quantidade válida.", undefined, { cirurgiaId });
  }

  const { data, error } = await supabase.rpc("centro_cirurgico_requisitar_suprimentos_operacional", {
    p_cirurgia_id: cirurgiaId,
    p_local_destino_id: localDestinoId,
    p_prioridade: prioridade,
    p_justificativa: text(fd, "justificativa"),
    p_itens: itens,
  });
  if (error || !data) {
    console.error("[centro-cirurgico] requisitar suprimentos", { code: error?.code, operation: "centro_cirurgico_requisitar_suprimentos_operacional" });
    return failure("requisicao", "Não foi possível criar a requisição de suprimentos.", error ?? undefined, { cirurgiaId });
  }

  const requisicaoId = String(data);
  return success("Requisição criada e enviada para a cadeia de estoque.", { cirurgiaId, requisicaoId, action: "request" });
}

export async function receberSuprimentosCirurgicosBackground(
  _previousState: SurgicalSupplyActionState,
  fd: FormData,
): Promise<SurgicalSupplyActionState> {
  const { supabase } = await getAssistencialContext();
  const cirurgiaId = text(fd, "cirurgia_id");
  const requisicaoId = text(fd, "requisicao_id");
  if (!cirurgiaId || !requisicaoId) {
    return failure("requisicao-invalida", "A requisição selecionada é inválida.", undefined, cirurgiaId ? { cirurgiaId } : undefined);
  }

  const { error } = await supabase.rpc("centro_cirurgico_receber_suprimentos_operacional", {
    p_requisicao_id: requisicaoId,
  });
  if (error) {
    console.error("[centro-cirurgico] receber suprimentos", { code: error.code, operation: "centro_cirurgico_receber_suprimentos_operacional" });
    return failure("recebimento", "Não foi possível confirmar o recebimento da requisição.", error, { cirurgiaId, requisicaoId });
  }

  return success("Recebimento da requisição confirmado no bloco cirúrgico.", { cirurgiaId, requisicaoId, action: "receive" });
}

export async function consumirSuprimentoCirurgicoBackground(
  _previousState: SurgicalSupplyActionState,
  fd: FormData,
): Promise<SurgicalSupplyActionState> {
  const { supabase } = await getAssistencialContext();
  const cirurgiaId = text(fd, "cirurgia_id");
  const loteId = text(fd, "estoque_lote_id");
  const quantidade = numeric(fd, "quantidade");
  if (!cirurgiaId || !loteId || !quantidade || quantidade <= 0) {
    return failure("consumo-invalido", "Selecione um lote e informe uma quantidade válida.", undefined, cirurgiaId ? { cirurgiaId } : undefined);
  }

  const { data, error } = await supabase.rpc("centro_cirurgico_consumir_suprimento_operacional", {
    p_cirurgia_id: cirurgiaId,
    p_estoque_lote_id: loteId,
    p_quantidade: quantidade,
    p_opme_id: text(fd, "opme_id"),
    p_requisicao_item_id: text(fd, "requisicao_item_id"),
    p_serie: text(fd, "serie"),
    p_observacoes: text(fd, "observacoes"),
  });
  if (error) {
    console.error("[centro-cirurgico] consumir suprimento", { code: error.code, operation: "centro_cirurgico_consumir_suprimento_operacional" });
    return failure("consumo", "Não foi possível registrar o consumo físico do suprimento.", error, { cirurgiaId });
  }

  const payload = data && typeof data === "object" && !Array.isArray(data) ? data as Record<string, unknown> : {};
  return success("Consumo físico registrado com lote e rastreabilidade.", {
    cirurgiaId,
    movimentoId: typeof payload.movimento_id === "string" ? payload.movimento_id : undefined,
    opmeId: typeof payload.opme_id === "string" ? payload.opme_id : null,
    action: "consume",
  });
}

export async function estornarConsumoCirurgicoBackground(
  _previousState: SurgicalSupplyActionState,
  fd: FormData,
): Promise<SurgicalSupplyActionState> {
  const { supabase } = await getAssistencialContext();
  const cirurgiaId = text(fd, "cirurgia_id");
  const movimentoId = text(fd, "movimento_id");
  const motivo = text(fd, "motivo");
  if (!cirurgiaId || !movimentoId || !motivo) {
    return failure("estorno-invalido", "Informe o consumo e o motivo do estorno.", undefined, cirurgiaId ? { cirurgiaId, movimentoId: movimentoId ?? undefined } : undefined);
  }

  const { data, error } = await supabase.rpc("centro_cirurgico_estornar_consumo_operacional", {
    p_movimento_id: movimentoId,
    p_quantidade: numeric(fd, "quantidade"),
    p_motivo: motivo,
  });
  if (error || !data) {
    console.error("[centro-cirurgico] estornar consumo", { code: error?.code, operation: "centro_cirurgico_estornar_consumo_operacional" });
    return failure("estorno", "Não foi possível estornar o consumo.", error ?? undefined, { cirurgiaId, movimentoId });
  }

  return success("Consumo estornado e saldo do lote recomposto.", {
    cirurgiaId,
    movimentoId,
    estornoId: String(data),
    action: "reverse",
  });
}
