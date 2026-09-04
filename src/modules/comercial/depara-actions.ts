"use server";

import { revalidatePath } from "next/cache";
import type { BackgroundActionState } from "@/lib/actions/background-action";
import { getAssistencialContext } from "@/modules/assistencial/context";

export type ComercialDeparaActionData = { id: string };

const text = (formData: FormData, key: string) => String(formData.get(key) ?? "").trim();
const nullable = (value: string) => value || null;

export async function salvarDeparaTussBackground(
  _previous: BackgroundActionState<ComercialDeparaActionData>,
  formData: FormData,
): Promise<BackgroundActionState<ComercialDeparaActionData>> {
  const { supabase } = await getAssistencialContext();
  const contratoId = text(formData, "contrato_id");
  const fonteId = text(formData, "fonte_id");
  const codigoOrigem = text(formData, "codigo_origem");
  const codigoTuss = text(formData, "codigo_tuss");
  const vigenciaInicio = text(formData, "vigencia_inicio");
  const ativo = text(formData, "ativo") !== "false";

  if (!contratoId || !fonteId || !codigoOrigem || !codigoTuss || !vigenciaInicio) {
    return {
      status: "error",
      code: "depara-campos",
      message: "Informe contrato, fonte, código de origem, código TUSS e início da vigência.",
    };
  }

  const tabelaTiss = text(formData, "tabela_tiss_codigo");
  if (tabelaTiss && !/^\d{2}$/.test(tabelaTiss)) {
    return {
      status: "error",
      code: "depara-tabela-tiss",
      message: "A tabela TISS deve possuir dois dígitos.",
    };
  }

  const { data, error } = await supabase.rpc("comercial_salvar_depara_tuss", {
    p_id: nullable(text(formData, "depara_id")),
    p_contrato_id: contratoId,
    p_fonte_id: fonteId,
    p_codigo_origem: codigoOrigem,
    p_descricao_origem: nullable(text(formData, "descricao_origem")),
    p_codigo_tuss: codigoTuss,
    p_descricao_tuss: nullable(text(formData, "descricao_tuss")),
    p_tabela_tiss_codigo: nullable(tabelaTiss),
    p_vigencia_inicio: vigenciaInicio,
    p_vigencia_fim: nullable(text(formData, "vigencia_fim")),
    p_ativo: ativo,
    p_observacoes: nullable(text(formData, "observacoes")),
  });

  if (error || !data) {
    const overlap = error?.message.toLowerCase().includes("vigência sobreposta")
      || error?.message.toLowerCase().includes("vigencia sobreposta");
    return {
      status: "error",
      code: overlap ? "depara-vigencia-sobreposta" : "depara-salvar",
      message: overlap
        ? "Já existe um DePara ativo para este código e fonte com vigência sobreposta. Encerre a vigência anterior antes de criar a próxima."
        : error?.message || "Não foi possível salvar o DePara TUSS contratual.",
    };
  }

  revalidatePath("/comercial");
  revalidatePath("/comercial/depara");
  revalidatePath("/faturamento");

  return {
    status: "success",
    code: text(formData, "depara_id") ? "depara-atualizado" : "depara-criado",
    message: text(formData, "depara_id")
      ? "DePara TUSS contratual atualizado."
      : "DePara TUSS contratual versionado e salvo.",
    data: { id: String(data) },
  };
}
