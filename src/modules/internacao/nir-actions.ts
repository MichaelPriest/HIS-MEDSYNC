"use server";

import { revalidatePath } from "next/cache";
import type { BackgroundActionState } from "@/lib/actions/background-action";
import { requireAnyPermission } from "@/lib/permissions/server";

export type NirBedAllocationData = {
  internacaoId?: string;
  atendimentoId?: string;
  leitoId?: string;
  movimentacaoId?: string;
};

export type NirBedAllocationState = BackgroundActionState<NirBedAllocationData>;

function text(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();
  return value || null;
}

const errorMessages: Record<string, string> = {
  LEITO_USUARIO_NAO_AUTENTICADO: "Sua sessão não está válida para a alocação de leito.",
  LEITO_INTERNACAO_NAO_LOCALIZADA: "A internação não foi localizada no contexto atual.",
  LEITO_INTERNACAO_NAO_ATIVA: "A internação não está em situação ativa para receber um leito.",
  LEITO_UNIDADE_FORA_ESCOPO: "A internação não pertence à unidade selecionada.",
  LEITO_SEM_PERMISSAO: "Seu perfil não possui permissão para alocar este leito.",
  LEITO_DESTINO_NAO_LOCALIZADO: "O leito selecionado não foi localizado.",
  LEITO_DESTINO_FORA_ESCOPO: "O leito selecionado não pertence à unidade da internação.",
  LEITO_DESTINO_INDISPONIVEL: "O leito deixou de estar disponível. Selecione outro leito.",
  LEITO_DESTINO_OCUPADO: "O leito foi ocupado por outra internação. Selecione outro leito.",
  LEITO_INCOMPATIVEL_ISOLAMENTO: "O paciente necessita isolamento e o leito selecionado não é compatível.",
  LEITO_INCOMPATIVEL_SEXO: "O leito possui restrição de sexo incompatível com o paciente.",
  LEITO_INCOMPATIVEL_ACOMODACAO: "A acomodação do leito não corresponde à necessidade da internação.",
  LEITO_RESERVADO_PARA_OUTRO_ATENDIMENTO: "O leito está reservado para outro atendimento.",
};

function messageFromDatabase(error: { message?: string | null }) {
  const raw = String(error.message ?? "");
  const code = Object.keys(errorMessages).find((item) => raw.includes(item));
  return code ? errorMessages[code] : null;
}

function failure(
  code: string,
  message: string,
  error?: { code?: string | null; message?: string | null },
  data?: NirBedAllocationData,
): NirBedAllocationState {
  return {
    status: "error",
    code,
    message: error ? messageFromDatabase(error) ?? message : message,
    detail: error?.code ? `Código técnico: ${error.code}` : undefined,
    data,
  };
}

function refresh(atendimentoId: string) {
  revalidatePath("/internacao/nir");
  revalidatePath("/internacao");
  revalidatePath("/internacao/leitos");
  revalidatePath(`/prontuario/${atendimentoId}`);
}

export async function alocarLeitoNir(
  _previousState: NirBedAllocationState,
  formData: FormData,
): Promise<NirBedAllocationState> {
  const { supabase, empresaId, unidadeId } = await requireAnyPermission([
    "internacao.movimentar",
    "internacao.gerenciar",
    "leitos.gerenciar",
  ]);
  const internacaoId = text(formData, "internacao_id");
  const leitoId = text(formData, "leito_id");
  if (!internacaoId || !leitoId || !unidadeId) {
    return failure("campos", "Informe a internação e o leito de destino.", undefined, {
      internacaoId: internacaoId ?? undefined,
      leitoId: leitoId ?? undefined,
    });
  }

  const [{ data: internacao, error: internacaoError }, { data: leito, error: leitoError }] = await Promise.all([
    supabase
      .from("internacoes")
      .select("id,atendimento_id,status,leito_id")
      .eq("id", internacaoId)
      .eq("empresa_id", empresaId)
      .eq("unidade_id", unidadeId)
      .maybeSingle(),
    supabase
      .from("leitos")
      .select("id,status,ativo")
      .eq("id", leitoId)
      .eq("empresa_id", empresaId)
      .eq("unidade_id", unidadeId)
      .maybeSingle(),
  ]);

  if (internacaoError || !internacao || !["aguardando_leito", "internado", "transferido"].includes(internacao.status)) {
    return failure("internacao", "A internação não está disponível para alocação.", internacaoError ?? undefined, { internacaoId, leitoId });
  }
  if (internacao.leito_id) {
    refresh(internacao.atendimento_id);
    return failure("internacao-ja-alocada", "O paciente já recebeu um leito. A fila foi atualizada.", undefined, {
      internacaoId,
      atendimentoId: internacao.atendimento_id,
      leitoId: internacao.leito_id,
    });
  }
  if (leitoError || !leito?.ativo || !["livre", "reservado"].includes(leito.status)) {
    return failure("leito-indisponivel", "O leito deixou de estar disponível. Selecione outro leito.", leitoError ?? undefined, {
      internacaoId,
      atendimentoId: internacao.atendimento_id,
      leitoId,
    });
  }

  const { data, error } = await supabase.rpc("movimentar_internacao_leito", {
    p_internacao_id: internacao.id,
    p_leito_destino_id: leito.id,
    p_motivo: text(formData, "motivo") ?? "Alocação pelo NIR",
  });

  if (error || !data) {
    console.error("[nir] alocar leito", { code: error?.code, operation: "movimentar_internacao_leito" });
    return failure("alocacao", "A alocação não pôde ser concluída. A disponibilidade foi revalidada no banco.", error ?? undefined, {
      internacaoId,
      atendimentoId: internacao.atendimento_id,
      leitoId,
    });
  }

  refresh(internacao.atendimento_id);
  return {
    status: "success",
    message: "Leito alocado e censo atualizado.",
    data: {
      internacaoId,
      atendimentoId: internacao.atendimento_id,
      leitoId,
      movimentacaoId: String(data),
    },
  };
}
