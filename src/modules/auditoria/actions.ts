"use server";

import { revalidatePath } from "next/cache";
import type { BackgroundActionState } from "@/lib/actions/background-action";
import { getRequestAuthContext } from "@/lib/auth/request-context";
import type { Permission } from "@/lib/permissions/catalog";

const txt = (formData: FormData, key: string) => String(formData.get(key) ?? "").trim();

type RequestContext = Awaited<ReturnType<typeof getRequestAuthContext>>;
type ReadyContext = RequestContext & {
  user: NonNullable<RequestContext["user"]>;
  empresaId: string;
  unidadeId: string;
};

function failure(code: string, message: string, detail?: string): BackgroundActionState {
  return { status: "error", code, message, detail };
}

function success(message: string): BackgroundActionState {
  return { status: "success", message };
}

function databaseFailure(
  error: { message?: string | null; code?: string | null } | null,
  fallback: string,
): BackgroundActionState {
  const raw = String(error?.message ?? "");
  if (raw.includes("Existem pendencias impeditivas")) {
    return failure(
      "pendencias",
      "A conta ainda possui pendência impeditiva após a revalidação automática.",
      "O motor foi executado novamente e a liberação permaneceu bloqueada.",
    );
  }
  if (raw.includes("SEM_PERMISSAO") || error?.code === "42501") {
    return failure(
      "permissao",
      "Seu perfil não possui permissão para concluir esta operação de Auditoria.",
    );
  }
  return failure(
    "falha-operacao",
    fallback,
    error?.code ? `Código técnico: ${error.code}` : undefined,
  );
}

async function resolveActionContext(
  required: readonly Permission[],
): Promise<
  | { context: ReadyContext; error: null }
  | { context: null; error: BackgroundActionState }
> {
  const context = await getRequestAuthContext();

  if (!context.user) {
    return {
      context: null,
      error: failure("sessao", "Sua sessão expirou. Entre novamente antes de continuar."),
    };
  }
  if (!context.empresaId || !context.unidadeId) {
    return {
      context: null,
      error: failure("unidade", "Selecione uma unidade operacional antes de continuar."),
    };
  }

  const checks = await Promise.all(
    required.map((permission) =>
      context.supabase.rpc("tem_permissao", {
        p_empresa: context.empresaId,
        p_unidade: context.unidadeId,
        p_codigo: permission,
      }),
    ),
  );

  if (!checks.some(({ data, error }) => !error && data === true)) {
    return {
      context: null,
      error: failure(
        "permissao",
        "Seu perfil não possui permissão para concluir esta operação de Auditoria.",
      ),
    };
  }

  return { context: context as ReadyContext, error: null };
}

export async function executarAuditoriaAutomatica(
  _previousState: BackgroundActionState,
  formData: FormData,
): Promise<BackgroundActionState> {
  const auth = await resolveActionContext([
    "auditoria.executar",
    "auditoria.analisar",
    "auditoria.liberar",
  ]);
  if (!auth.context) return auth.error;

  const auditoriaId = txt(formData, "auditoria_id");
  if (!auditoriaId) return failure("auditoria", "Auditoria não informada.");

  const { data, error } = await auth.context.supabase.rpc(
    "executar_auditoria_conta_automatica",
    { p_auditoria_id: auditoriaId },
  );

  if (error) {
    return databaseFailure(error, "Não foi possível executar a auditoria automática.");
  }

  const gerados = Number(data ?? 0);
  revalidatePath("/auditoria");
  return success(
    gerados
      ? `Auditoria reexecutada. ${gerados} pendência(s) atual(is) identificada(s).`
      : "Auditoria reexecutada sem pendências atuais.",
  );
}

export async function resolverPendenciaAuditoria(
  _previousState: BackgroundActionState,
  formData: FormData,
): Promise<BackgroundActionState> {
  const auth = await resolveActionContext(["auditoria.executar", "auditoria.analisar"]);
  if (!auth.context) return auth.error;

  const itemId = txt(formData, "item_id");
  if (!itemId) return failure("pendencia", "Pendência não informada.");

  const { error } = await auth.context.supabase.rpc("resolver_item_auditoria", {
    p_item_id: itemId,
    p_resolucao: txt(formData, "resolucao") || null,
  });

  if (error) return databaseFailure(error, "Não foi possível resolver a pendência.");

  revalidatePath("/auditoria");
  return success("Pendência marcada como resolvida.");
}

export async function reabrirPendenciaAuditoria(
  _previousState: BackgroundActionState,
  formData: FormData,
): Promise<BackgroundActionState> {
  const auth = await resolveActionContext(["auditoria.executar", "auditoria.analisar"]);
  if (!auth.context) return auth.error;

  const itemId = txt(formData, "item_id");
  if (!itemId) return failure("pendencia", "Pendência não informada.");

  const { error } = await auth.context.supabase.rpc("reabrir_item_auditoria", {
    p_item_id: itemId,
  });

  if (error) return databaseFailure(error, "Não foi possível reabrir a pendência.");

  revalidatePath("/auditoria");
  return success("Pendência reaberta.");
}

export async function iniciarAuditoria(
  _previousState: BackgroundActionState,
  formData: FormData,
): Promise<BackgroundActionState> {
  const auth = await resolveActionContext(["auditoria.executar", "auditoria.analisar"]);
  if (!auth.context) return auth.error;

  const auditoriaId = txt(formData, "auditoria_id");
  if (!auditoriaId) return failure("auditoria", "Auditoria não informada.");

  const now = new Date().toISOString();
  const { data, error } = await auth.context.supabase
    .from("auditoria_contas")
    .update({
      status: "em_auditoria",
      auditor_id: auth.context.user.id,
      iniciado_em: now,
      updated_at: now,
    })
    .eq("id", auditoriaId)
    .eq("empresa_id", auth.context.empresaId)
    .eq("unidade_id", auth.context.unidadeId)
    .neq("status", "liberada")
    .select("id")
    .maybeSingle();

  if (error) return databaseFailure(error, "Não foi possível iniciar a auditoria.");
  if (!data) return failure("auditoria", "Auditoria não encontrada ou já liberada.");

  revalidatePath("/auditoria");
  return success("Auditoria iniciada.");
}

export async function adicionarPendenciaAuditoria(
  _previousState: BackgroundActionState,
  formData: FormData,
): Promise<BackgroundActionState> {
  const auth = await resolveActionContext(["auditoria.executar", "auditoria.analisar"]);
  if (!auth.context) return auth.error;

  const auditoriaId = txt(formData, "auditoria_id");
  const descricao = txt(formData, "descricao");
  if (!auditoriaId || !descricao) {
    return failure("campos", "Informe a descrição da pendência manual.");
  }

  const { data: auditoria, error: auditoriaError } = await auth.context.supabase
    .from("auditoria_contas")
    .select("id,status")
    .eq("id", auditoriaId)
    .eq("empresa_id", auth.context.empresaId)
    .eq("unidade_id", auth.context.unidadeId)
    .maybeSingle();

  if (auditoriaError) {
    return databaseFailure(auditoriaError, "Não foi possível validar a Auditoria.");
  }
  if (!auditoria) return failure("auditoria", "Auditoria não encontrada nesta unidade.");
  if (auditoria.status === "liberada") {
    return failure("auditoria-liberada", "A Auditoria já foi liberada e não aceita nova pendência.");
  }

  const { error } = await auth.context.supabase.from("auditoria_conta_itens").insert({
    auditoria_id: auditoriaId,
    categoria: txt(formData, "categoria") || "conta",
    severidade: txt(formData, "severidade") || "alerta",
    descricao,
    origem: "manual",
    automatizada: false,
    resolvida: false,
  });

  if (error) return databaseFailure(error, "Não foi possível adicionar a pendência.");

  revalidatePath("/auditoria");
  return success("Pendência manual adicionada.");
}

export async function liberarAuditoria(
  _previousState: BackgroundActionState,
  formData: FormData,
): Promise<BackgroundActionState> {
  const auth = await resolveActionContext(["auditoria.liberar", "auditoria.executar"]);
  if (!auth.context) return auth.error;

  const auditoriaId = txt(formData, "auditoria_id");
  if (!auditoriaId) return failure("auditoria", "Auditoria não informada.");

  const { error } = await auth.context.supabase.rpc("liberar_auditoria_conta", {
    p_auditoria_id: auditoriaId,
    p_observacoes: txt(formData, "observacoes") || null,
  });

  if (error) {
    return databaseFailure(error, "Não foi possível liberar a Auditoria para Contas Médicas.");
  }

  revalidatePath("/auditoria");
  revalidatePath("/contas-medicas");
  return success("Auditoria revalidada e liberada para Contas Médicas.");
}
