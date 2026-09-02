"use server";

import { revalidatePath } from "next/cache";
import type { BackgroundActionState } from "@/lib/actions/background-action";
import { getAssistencialContext } from "@/modules/assistencial/context";

export type CmeActionData = {
  cicloId?: string;
  status?: string;
  inicioEm?: string | null;
  fimEm?: string | null;
  liberadoEm?: string | null;
  action?: "create" | "update" | "release";
};

export type CmeActionState = BackgroundActionState<CmeActionData>;

const text = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();
const nullable = (value: string) => value || null;
const checked = (fd: FormData, key: string) => fd.get(key) === "on";

const messages: Record<string, string> = {
  CME_AUTENTICACAO_OBRIGATORIA: "Sua sessão não está válida para operar a CME.",
  CME_SEM_PERMISSAO_GERENCIAR: "Seu perfil não possui permissão para gerenciar ciclos da CME nesta unidade.",
  CME_STATUS_INVALIDO: "O status selecionado para o ciclo é inválido.",
  CME_LIBERACAO_EXIGE_RESULTADO_E_INDICADORES: "A liberação exige resultado técnico e indicadores de esterilização.",
  CME_USUARIO_SEM_PROFISSIONAL: "A liberação definitiva exige vínculo do usuário com um profissional.",
  CME_CICLO_NAO_LOCALIZADO: "O ciclo não foi localizado no contexto atual.",
  CME_CODIGO_CICLO_OBRIGATORIO: "Informe o código do novo ciclo CME.",
};

function databaseMessage(error: { message?: string | null }) {
  const raw = String(error.message ?? "");
  const key = Object.keys(messages).find((code) => raw.includes(code));
  return key ? messages[key] : null;
}

function failure(code: string, fallback: string, error?: { code?: string | null; message?: string | null }, data?: CmeActionData): CmeActionState {
  return {
    status: "error",
    code,
    message: error ? databaseMessage(error) ?? fallback : fallback,
    detail: error?.code ? `Código técnico: ${error.code}` : undefined,
    data,
  };
}

function refresh() {
  revalidatePath("/assistencial/centro-cirurgico/cme");
  revalidatePath("/assistencial/centro-cirurgico");
}

export async function salvarCicloCmeBackground(
  _previousState: CmeActionState,
  formData: FormData,
): Promise<CmeActionState> {
  const { supabase, empresaId, unidadeId } = await getAssistencialContext();
  const cicloId = text(formData, "ciclo_id");
  const liberar = checked(formData, "liberar");
  const resultado = text(formData, "resultado");
  const indicadores = {
    quimico: checked(formData, "indicador_quimico"),
    biologico: checked(formData, "indicador_biologico"),
    fisico: checked(formData, "indicador_fisico"),
    observacao: nullable(text(formData, "indicador_observacao")),
  };

  if (!cicloId && !text(formData, "codigo_ciclo")) {
    return failure("codigo-obrigatorio", "Informe o código do novo ciclo CME.");
  }
  if (liberar && !resultado) {
    return failure("liberacao-exige-resultado", "Informe o resultado técnico antes da liberação definitiva.", undefined, cicloId ? { cicloId } : undefined);
  }
  if (liberar && !indicadores.quimico && !indicadores.biologico && !indicadores.fisico) {
    return failure("liberacao-exige-indicador", "Marque pelo menos um indicador de esterilização conforme antes da liberação definitiva.", undefined, cicloId ? { cicloId } : undefined);
  }

  const { data, error } = await supabase.rpc("cme_salvar_ciclo_operacional", {
    p_empresa_id: empresaId,
    p_unidade_id: unidadeId,
    p_ciclo_id: nullable(cicloId),
    p_codigo_ciclo: nullable(text(formData, "codigo_ciclo")),
    p_equipamento: nullable(text(formData, "equipamento")),
    p_metodo: nullable(text(formData, "metodo")),
    p_carga: nullable(text(formData, "carga")),
    p_indicadores: indicadores,
    p_resultado: nullable(resultado),
    p_status: text(formData, "status") || "em_processamento",
    p_observacoes: nullable(text(formData, "observacoes")),
    p_liberar: liberar,
  });

  if (error || !data) {
    console.error("[cme] salvar ciclo", { code: error?.code, operation: "cme_salvar_ciclo_operacional" });
    return failure("ciclo", "Não foi possível salvar o ciclo CME.", error ?? undefined, cicloId ? { cicloId } : undefined);
  }

  const persistedId = String(data);
  const persisted = await supabase
    .from("cme_ciclos")
    .select("id,status,inicio_em,fim_em,liberado_em")
    .eq("id", persistedId)
    .eq("empresa_id", empresaId)
    .eq("unidade_id", unidadeId)
    .maybeSingle();

  if (persisted.error || !persisted.data) {
    console.error("[cme] reler ciclo", { code: persisted.error?.code, operation: "cme_ciclos.select" });
    refresh();
    return failure(
      "ciclo-persistido-sem-confirmacao",
      "O ciclo foi salvo, mas a confirmação do estado persistido não pôde ser carregada. Atualize a listagem antes de nova operação.",
      persisted.error ?? undefined,
      { cicloId: persistedId },
    );
  }

  refresh();
  return {
    status: "success",
    message: liberar ? "Ciclo CME liberado definitivamente." : cicloId ? "Ciclo CME atualizado." : "Ciclo CME criado.",
    data: {
      cicloId: persisted.data.id,
      status: persisted.data.status,
      inicioEm: persisted.data.inicio_em,
      fimEm: persisted.data.fim_em,
      liberadoEm: persisted.data.liberado_em,
      action: liberar ? "release" : cicloId ? "update" : "create",
    },
  };
}
