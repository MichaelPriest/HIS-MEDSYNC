"use server";

import { revalidatePath } from "next/cache";
import type { BackgroundActionState } from "@/lib/actions/background-action";
import { getAssistencialContext } from "@/modules/assistencial/context";

export type SurgicalTimelineActionData = {
  cirurgiaId?: string;
  action?: "save" | "start" | "finish" | "discharge";
  recordId?: string;
  inicioEm?: string | null;
  fimEm?: string | null;
  status?: string | null;
  altaEm?: string | null;
};

export type SurgicalTimelineActionState = BackgroundActionState<SurgicalTimelineActionData>;

const txt = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();
const checked = (fd: FormData, key: string) => fd.get(key) === "on";
const numberOrNull = (value: string) => {
  if (!value) return null;
  const number = Number(value.replace(",", "."));
  return Number.isFinite(number) ? number : null;
};
const listJson = (value: string) => value
  .split(/\r?\n/)
  .map((descricao) => descricao.trim())
  .filter(Boolean)
  .map((descricao) => ({ descricao }));

function failure(
  code: string,
  message: string,
  error?: { code?: string | null },
  data?: SurgicalTimelineActionData,
): SurgicalTimelineActionState {
  return {
    status: "error",
    code,
    message,
    detail: error?.code ? `Código técnico: ${error.code}` : undefined,
    data,
  };
}

function success(message: string, data: SurgicalTimelineActionData): SurgicalTimelineActionState {
  return { status: "success", message, data };
}

function refreshSurgicalTimeline() {
  revalidatePath("/assistencial/centro-cirurgico");
  revalidatePath("/assistencial/centro-cirurgico/em-andamento");
  revalidatePath("/assistencial/centro-cirurgico/painel-salas");
}

export async function salvarAnestesiaBackground(
  _previousState: SurgicalTimelineActionState,
  formData: FormData,
): Promise<SurgicalTimelineActionState> {
  const { supabase } = await getAssistencialContext();
  const cirurgiaId = txt(formData, "cirurgia_id");
  const requestedAction = txt(formData, "acao");
  const action: SurgicalTimelineActionData["action"] = requestedAction === "iniciar"
    ? "start"
    : requestedAction === "finalizar"
      ? "finish"
      : "save";
  if (!cirurgiaId) return failure("cirurgia", "A cirurgia não foi informada para salvar a anestesia.");

  const tecnicas = formData
    .getAll("tecnicas")
    .map((value) => String(value).trim())
    .filter(Boolean);
  if ((action === "start" || action === "finish") && !tecnicas.length) {
    return failure("tecnica-obrigatoria", "Selecione ao menos uma técnica anestésica antes de registrar início ou fim.", undefined, { cirurgiaId, action });
  }

  const { data: recordIdRaw, error } = await supabase.rpc("centro_cirurgico_salvar_anestesia_operacional", {
    p_cirurgia_id: cirurgiaId,
    p_tecnicas: tecnicas,
    p_asa: txt(formData, "asa") || null,
    p_via_aerea: txt(formData, "via_aerea") || null,
    p_monitorizacao: {
      ecg: checked(formData, "monitor_ecg"),
      spo2: checked(formData, "monitor_spo2"),
      pressao: checked(formData, "monitor_pressao"),
      capnografia: checked(formData, "monitor_capnografia"),
      temperatura: checked(formData, "monitor_temperatura"),
    },
    p_medicamentos: listJson(txt(formData, "medicamentos")),
    p_fluidos: listJson(txt(formData, "fluidos")),
    p_eventos: listJson(txt(formData, "eventos")),
    p_iniciar: action === "start",
    p_finalizar: action === "finish",
    p_observacoes: txt(formData, "observacoes") || null,
  });
  if (error || !recordIdRaw) {
    console.error("[centro-cirurgico] anestesia", {
      code: error?.code,
      operation: "centro_cirurgico_salvar_anestesia_operacional",
      action,
    });
    return failure("anestesia", "Não foi possível salvar o registro anestésico.", error ?? undefined, { cirurgiaId, action });
  }

  const recordId = String(recordIdRaw);
  const { data: record, error: readError } = await supabase
    .from("anestesia_registros")
    .select("id,inicio_em,fim_em")
    .eq("id", recordId)
    .maybeSingle();
  if (readError || !record) {
    console.error("[centro-cirurgico] reconciliar anestesia", { code: readError?.code, recordId });
    return failure(
      "anestesia-reconciliacao",
      "O registro anestésico foi salvo, mas não foi possível reconciliar os horários confirmados. Atualize a visualização antes de uma nova transição.",
      readError ?? undefined,
      { cirurgiaId, action, recordId },
    );
  }

  if (action === "start" || action === "finish") refreshSurgicalTimeline();
  const message = action === "start"
    ? "Início da anestesia registrado."
    : action === "finish"
      ? "Anestesia finalizada."
      : "Rascunho da anestesia salvo.";
  return success(message, {
    cirurgiaId,
    action,
    recordId,
    inicioEm: record.inicio_em,
    fimEm: record.fim_em,
  });
}

export async function salvarRpaBackground(
  _previousState: SurgicalTimelineActionState,
  formData: FormData,
): Promise<SurgicalTimelineActionState> {
  const { supabase } = await getAssistencialContext();
  const cirurgiaId = txt(formData, "cirurgia_id");
  const discharge = txt(formData, "acao") === "alta";
  const action: SurgicalTimelineActionData["action"] = discharge ? "discharge" : "save";
  if (!cirurgiaId) return failure("cirurgia", "A cirurgia não foi informada para salvar a RPA.");

  const aldreteAlta = numberOrNull(txt(formData, "aldrete_alta"));
  if (discharge && aldreteAlta === null) {
    return failure("aldrete-alta", "Informe o Aldrete de alta antes de registrar a alta da RPA.", undefined, { cirurgiaId, action });
  }

  const { data: recordIdRaw, error } = await supabase.rpc("centro_cirurgico_salvar_rpa_operacional", {
    p_cirurgia_id: cirurgiaId,
    p_aldrete_entrada: numberOrNull(txt(formData, "aldrete_entrada")),
    p_aldrete_alta: aldreteAlta,
    p_dor: numberOrNull(txt(formData, "dor")),
    p_nauseas: checked(formData, "nauseas"),
    p_sinais_vitais: {
      pa: txt(formData, "pa") || null,
      fc: numberOrNull(txt(formData, "fc")),
      spo2: numberOrNull(txt(formData, "spo2")),
      temperatura: numberOrNull(txt(formData, "temperatura")),
    },
    p_intercorrencias: txt(formData, "intercorrencias") || null,
    p_destino: txt(formData, "destino") || null,
    p_alta: discharge,
  });
  if (error || !recordIdRaw) {
    console.error("[centro-cirurgico] RPA", {
      code: error?.code,
      operation: "centro_cirurgico_salvar_rpa_operacional",
      action,
    });
    return failure("rpa", "Não foi possível salvar o registro da recuperação pós-anestésica.", error ?? undefined, { cirurgiaId, action });
  }

  const recordId = String(recordIdRaw);
  const { data: record, error: readError } = await supabase
    .from("rpa_registros")
    .select("id,status,alta_em")
    .eq("id", recordId)
    .maybeSingle();
  if (readError || !record) {
    console.error("[centro-cirurgico] reconciliar RPA", { code: readError?.code, recordId });
    return failure(
      "rpa-reconciliacao",
      "O registro da RPA foi salvo, mas não foi possível reconciliar o estado confirmado. Atualize a visualização antes de registrar uma nova transição.",
      readError ?? undefined,
      { cirurgiaId, action, recordId },
    );
  }

  if (discharge) refreshSurgicalTimeline();
  return success(discharge ? "Alta da RPA registrada." : "Rascunho da RPA salvo.", {
    cirurgiaId,
    action,
    recordId,
    status: record.status,
    altaEm: record.alta_em,
  });
}
