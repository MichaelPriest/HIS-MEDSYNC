"use server";

import { revalidatePath } from "next/cache";
import type { BackgroundActionState } from "@/lib/actions/background-action";
import { getAssistencialContext } from "@/modules/assistencial/context";

export type CommercialLinkMaintenanceData = {
  id: string;
  count?: number;
};

const text = (formData: FormData, key: string) => String(formData.get(key) ?? "").trim();

function refreshCommercial() {
  for (const path of [
    "/comercial",
    "/comercial/vinculos",
    "/comercial/depara",
    "/comercial/prontidao",
    "/comercial/simulador",
    "/comercial/homologacao",
    "/faturamento",
  ]) revalidatePath(path);
}

function friendly(message: string, fallback: string) {
  if (message.includes("COMERCIAL_MOTIVO_DESVINCULO_OBRIGATORIO")) {
    return "Informe o motivo do desvínculo para preservar a rastreabilidade comercial.";
  }
  if (message.includes("COMERCIAL_VINCULO_NAO_LOCALIZADO")) {
    return "Vínculo comercial não localizado.";
  }
  if (message.includes("COMERCIAL_SEM_PERMISSAO_EDITAR")) {
    return "Seu perfil não possui permissão para alterar este vínculo comercial.";
  }
  return message || fallback;
}

export async function desvincularTabelaComercialBackground(
  _previous: BackgroundActionState<CommercialLinkMaintenanceData>,
  formData: FormData,
): Promise<BackgroundActionState<CommercialLinkMaintenanceData>> {
  const { supabase } = await getAssistencialContext();
  const vinculoId = text(formData, "vinculo_id");
  const motivo = text(formData, "motivo");

  if (!vinculoId) return { status: "error", code: "vinculo-obrigatorio", message: "Vínculo não informado." };
  if (!motivo) return { status: "error", code: "motivo-obrigatorio", message: "Informe o motivo do desvínculo." };

  const { data, error } = await supabase.rpc("comercial_desvincular_tabela", {
    p_vinculo_id: vinculoId,
    p_motivo: motivo,
  });

  if (error || !data) {
    return { status: "error", code: "desvinculo-falhou", message: friendly(error?.message ?? "", "Não foi possível desvincular a tabela.") };
  }

  refreshCommercial();
  return {
    status: "success",
    code: "tabela-desvinculada",
    message: "Tabela desvinculada sem apagar o histórico.",
    data: { id: String(data) },
  };
}

export async function reativarTabelaComercialBackground(
  _previous: BackgroundActionState<CommercialLinkMaintenanceData>,
  formData: FormData,
): Promise<BackgroundActionState<CommercialLinkMaintenanceData>> {
  const { supabase } = await getAssistencialContext();
  const vinculoId = text(formData, "vinculo_id");

  if (!vinculoId) return { status: "error", code: "vinculo-obrigatorio", message: "Vínculo não informado." };

  const { data, error } = await supabase.rpc("comercial_reativar_vinculo_tabela", {
    p_vinculo_id: vinculoId,
  });

  if (error || !data) {
    return { status: "error", code: "reativacao-falhou", message: friendly(error?.message ?? "", "Não foi possível reativar a tabela.") };
  }

  refreshCommercial();
  return {
    status: "success",
    code: "tabela-reativada",
    message: "Vínculo reativado e DePara automático ressincronizado.",
    data: { id: String(data) },
  };
}

export async function sincronizarDeparaVinculoBackground(
  _previous: BackgroundActionState<CommercialLinkMaintenanceData>,
  formData: FormData,
): Promise<BackgroundActionState<CommercialLinkMaintenanceData>> {
  const { supabase } = await getAssistencialContext();
  const vinculoId = text(formData, "vinculo_id");

  if (!vinculoId) return { status: "error", code: "vinculo-obrigatorio", message: "Vínculo não informado." };

  const { data, error } = await supabase.rpc("comercial_sincronizar_depara_vinculo", {
    p_vinculo_id: vinculoId,
  });

  if (error || data == null) {
    return { status: "error", code: "sincronizacao-falhou", message: friendly(error?.message ?? "", "Não foi possível sincronizar o DePara TUSS.") };
  }

  const count = Number(data) || 0;
  refreshCommercial();
  return {
    status: "success",
    code: "depara-sincronizado",
    message: `${count} DePara(s) automático(s) sincronizado(s).`,
    data: { id: vinculoId, count },
  };
}
