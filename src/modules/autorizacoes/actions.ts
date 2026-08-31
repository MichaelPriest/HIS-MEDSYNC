"use server";

import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import type { BackgroundActionState } from "@/lib/actions/background-action";
import { getAssistencialContext } from "@/modules/assistencial/context";
import { encaminharPosTriagem } from "@/modules/triagem/fluxo-pos-triagem";

type AuthorizationActionData = { redirectTo?: string };
type AuthorizationActionState = BackgroundActionState<AuthorizationActionData>;

const ERROR_MESSAGES: Record<string, string> = {
  "identificacao-obrigatoria": "Este convênio exige identificação do beneficiário antes de autorizar. Valide a biometria ou o token.",
  "metodo-identificacao": "O método informado não é aceito pela configuração deste convênio.",
  "identificacao-dados": "Informe o método e a referência retornada pelo leitor ou o token apresentado pelo beneficiário.",
  "identificacao-contexto": "Não foi possível relacionar paciente, atendimento e convênio para a validação.",
  "identificacao-salvar": "A validação de identificação não pôde ser registrada.",
  dados: "Revise os dados da autorização antes de salvar.",
  "nao-encontrada": "A autorização não foi localizada nesta unidade.",
  salvar: "Não foi possível salvar a autorização.",
  "sincronizar-atendimento": "A autorização foi salva, mas não foi possível sincronizar os dados no atendimento.",
  encaminhar: "A autorização foi salva, mas não foi possível encaminhar o paciente para a próxima etapa assistencial.",
};

function failure(code: string, detail?: string): AuthorizationActionState {
  return {
    status: "error",
    code,
    message: ERROR_MESSAGES[code] ?? "Não foi possível concluir a operação de autorização.",
    detail,
  };
}

function success(message: string, redirectTo?: string): AuthorizationActionState {
  return {
    status: "success",
    message,
    data: redirectTo ? { redirectTo } : {},
  };
}

function optional(formData: FormData, name: string) {
  const value = String(formData.get(name) ?? "").trim();
  return value || null;
}

function hashRef(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function metodoPermitido(config: string, metodo: string) {
  if (config === "biometria_ou_token") return metodo === "biometria_digital" || metodo === "token";
  return config === metodo;
}

export async function registrarIdentificacaoAutorizacao(
  _previousState: AuthorizationActionState,
  formData: FormData,
): Promise<AuthorizationActionState> {
  const { supabase, user, empresaId, unidadeId } = await getAssistencialContext();
  const autorizacaoId = String(formData.get("autorizacao_id") ?? "").trim();
  const metodo = String(formData.get("metodo") ?? "").trim();
  const referencia = String(formData.get("referencia") ?? "").trim();
  const provedor = optional(formData, "provedor");
  const dispositivo = optional(formData, "dispositivo");

  if (!autorizacaoId || !["biometria_digital", "token"].includes(metodo) || !referencia) {
    return failure("identificacao-dados");
  }

  const { data: autorizacao, error: autorizacaoError } = await supabase
    .from("autorizacoes_atendimento")
    .select("id,atendimento_id,paciente_id,convenio_id")
    .eq("id", autorizacaoId)
    .eq("unidade_id", unidadeId)
    .maybeSingle();

  if (autorizacaoError) {
    console.error("[autorizacoes.identificacao] falha ao consultar contexto", { code: autorizacaoError.code });
    return failure("identificacao-contexto");
  }
  if (!autorizacao?.paciente_id || !autorizacao.convenio_id) return failure("identificacao-contexto");

  const { data: config } = await supabase
    .from("convenio_identificacao_config")
    .select("metodo,provedor,exige_na_autorizacao,ativo")
    .eq("empresa_id", empresaId)
    .eq("convenio_id", autorizacao.convenio_id)
    .eq("ativo", true)
    .maybeSingle();

  if (config?.exige_na_autorizacao && !metodoPermitido(config.metodo, metodo)) {
    return failure("metodo-identificacao");
  }

  const { error } = await supabase.from("autorizacao_identificacao_eventos").insert({
    empresa_id: empresaId,
    unidade_id: unidadeId,
    autorizacao_id: autorizacao.id,
    atendimento_id: autorizacao.atendimento_id,
    paciente_id: autorizacao.paciente_id,
    convenio_id: autorizacao.convenio_id,
    metodo,
    referencia_hash: hashRef(referencia),
    provedor: provedor ?? config?.provedor ?? null,
    dispositivo,
    validado: true,
    validado_em: new Date().toISOString(),
    created_by: user.id,
  });

  if (error) {
    console.error("[autorizacoes.identificacao] falha ao registrar", { code: error.code });
    return failure("identificacao-salvar");
  }

  revalidatePath("/autorizacoes");
  return success("Identificação do beneficiário validada e vinculada ao atendimento.");
}

export async function atualizarAutorizacao(
  _previousState: AuthorizationActionState,
  formData: FormData,
): Promise<AuthorizationActionState> {
  const { supabase, user, empresaId, unidadeId } = await getAssistencialContext();
  const id = String(formData.get("autorizacao_id") ?? "").trim();
  const status = String(formData.get("status") ?? "pendente").trim();
  if (!id || !["pendente", "solicitada", "autorizada", "negada", "dispensada"].includes(status)) {
    return failure("dados");
  }

  const { data: autorizacao, error: autorizacaoConsultaError } = await supabase
    .from("autorizacoes_atendimento")
    .select("id,atendimento_id,paciente_id,convenio_id")
    .eq("id", id)
    .eq("unidade_id", unidadeId)
    .maybeSingle();
  if (autorizacaoConsultaError) {
    console.error("[autorizacoes] falha ao consultar autorização", { id, code: autorizacaoConsultaError.code });
    return failure("nao-encontrada");
  }
  if (!autorizacao) return failure("nao-encontrada");

  if (status === "autorizada" && autorizacao.convenio_id) {
    const { data: config } = await supabase
      .from("convenio_identificacao_config")
      .select("metodo,exige_na_autorizacao,ativo")
      .eq("empresa_id", empresaId)
      .eq("convenio_id", autorizacao.convenio_id)
      .eq("ativo", true)
      .maybeSingle();

    if (config?.exige_na_autorizacao && config.metodo !== "nenhum") {
      const limite = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
      const [{ data: eventosAutorizacao }, { data: eventosAtendimento }] = await Promise.all([
        supabase.from("autorizacao_identificacao_eventos").select("metodo,validado,validado_em").eq("empresa_id", empresaId).eq("unidade_id", unidadeId).eq("autorizacao_id", id).eq("validado", true).gte("created_at", limite).order("created_at", { ascending: false }).limit(10),
        supabase.from("atendimento_identificacao_eventos").select("metodo,validado,validado_em").eq("empresa_id", empresaId).eq("unidade_id", unidadeId).eq("atendimento_id", autorizacao.atendimento_id).eq("convenio_id", autorizacao.convenio_id).eq("validado", true).gte("created_at", limite).order("created_at", { ascending: false }).limit(10),
      ]);
      const eventos = [...(eventosAutorizacao ?? []), ...(eventosAtendimento ?? [])];
      if (!eventos.some((evento) => metodoPermitido(config.metodo, evento.metodo))) {
        return failure("identificacao-obrigatoria");
      }
    }
  }

  const payload = {
    numero_guia_prestador: optional(formData, "numero_guia_prestador"),
    numero_guia_operadora: optional(formData, "numero_guia_operadora"),
    senha_autorizacao: optional(formData, "senha_autorizacao"),
    validade: optional(formData, "validade"),
    status,
    observacao: optional(formData, "observacao"),
    updated_at: new Date().toISOString(),
    updated_by: user.id,
  };

  const { error } = await supabase.from("autorizacoes_atendimento").update(payload).eq("id", id).eq("unidade_id", unidadeId);
  if (error) {
    console.error("[autorizacoes] falha ao atualizar", { id, atendimentoId: autorizacao.atendimento_id, code: error.code, message: error.message });
    return failure("salvar");
  }

  if (status === "autorizada" || status === "dispensada") {
    const { error: atendimentoSyncError } = await supabase.from("atendimentos").update({
      numero_autorizacao: payload.numero_guia_operadora,
      senha_autorizacao: payload.senha_autorizacao,
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    }).eq("id", autorizacao.atendimento_id).eq("unidade_id", unidadeId);

    if (atendimentoSyncError) {
      console.error("[autorizacoes] guia salva, mas falhou sincronização do atendimento", { atendimentoId: autorizacao.atendimento_id, code: atendimentoSyncError.code });
      revalidatePath("/autorizacoes");
      return failure("sincronizar-atendimento", "A guia permanece salva; revise a pendência antes de prosseguir.");
    }

    const { data: atendimento } = await supabase
      .from("atendimentos")
      .select("id,paciente_id,tipo_atendimento,especialidade_destino,triagem_concluida_em")
      .eq("id", autorizacao.atendimento_id)
      .eq("unidade_id", unidadeId)
      .maybeSingle();

    if (atendimento?.triagem_concluida_em && atendimento.especialidade_destino) {
      const { data: triagem } = await supabase
        .from("triagens")
        .select("classificacao_risco,queixa_principal")
        .eq("atendimento_id", atendimento.id)
        .maybeSingle();

      let destino: Awaited<ReturnType<typeof encaminharPosTriagem>>;
      try {
        destino = await encaminharPosTriagem({
          supabase,
          userId: user.id,
          empresaId,
          unidadeId,
          atendimentoId: atendimento.id,
          pacienteId: atendimento.paciente_id,
          tipoAtendimento: atendimento.tipo_atendimento,
          especialidade: atendimento.especialidade_destino,
          classificacao: triagem?.classificacao_risco ?? null,
          queixaPrincipal: triagem?.queixa_principal ?? null,
        });
      } catch (encaminhamentoError) {
        console.error("[autorizacoes] guia liberada, mas falhou encaminhamento", { atendimentoId: atendimento.id, encaminhamentoError });
        revalidatePath("/autorizacoes");
        return failure("encaminhar", "A guia permanece liberada e deve ser encaminhada novamente pela operação.");
      }

      revalidatePath("/autorizacoes");
      revalidatePath("/fila-medica");
      revalidatePath("/pronto-socorro");
      revalidatePath("/assistencial/urgencia");
      return success(
        "Autorização salva e paciente encaminhado.",
        destino.prontoSocorro
          ? `/pronto-socorro?atendimento=${atendimento.id}&sucesso=autorizacao`
          : `/fila-medica?atendimento=${atendimento.id}&sucesso=autorizacao`,
      );
    }

    if (atendimento && !atendimento.triagem_concluida_em) {
      revalidatePath("/autorizacoes");
      revalidatePath("/triagem");
      return success(
        "Autorização salva. Encaminhando para Triagem…",
        `/triagem?atendimento=${atendimento.id}&sucesso=autorizacao`,
      );
    }
  }

  revalidatePath("/autorizacoes");
  return success("Autorização salva.");
}
