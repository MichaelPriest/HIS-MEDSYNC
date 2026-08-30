"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAssistencialContext } from "@/modules/assistencial/context";

const base = "/internacao/transferencias";
const txt = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();

function errorKey(message?: string | null) {
  const value = String(message ?? "");
  if (value.includes("SEM_PERMISSAO") || value.includes("FORA_ESCOPO") || value.includes("NAO_AUTENTICADO")) return "permissao";
  if (value.includes("UNIDADE_DESTINO_INVALIDA")) return "destino";
  if (value.includes("ORIGEM_SEM_LEITO")) return "sem-leito";
  if (value.includes("NAO_ATIVA") || value.includes("NAO_PENDENTE")) return "estado";
  if (value.includes("LEITO_RESERVADO_PARA_OUTRO_ATENDIMENTO")) return "leito-reservado";
  if (value.includes("LEITO_DESTINO")) return "leito";
  if (value.includes("MOTIVO")) return "motivo";
  return "operacao";
}

function done(kind: string): never {
  revalidatePath(base);
  revalidatePath("/internacao");
  revalidatePath("/internacao/nir");
  redirect(`${base}?sucesso=${kind}` as never);
}

function fail(message?: string | null): never {
  redirect(`${base}?erro=${errorKey(message)}` as never);
}

export async function solicitarTransferenciaInterunidade(formData: FormData) {
  const { supabase } = await getAssistencialContext();
  const internacaoId = txt(formData, "internacao_id");
  const unidadeDestinoId = txt(formData, "unidade_destino_id");
  const motivo = txt(formData, "motivo");
  if (!internacaoId || !unidadeDestinoId || !motivo) return fail("MOTIVO_OBRIGATORIO");

  const { error } = await supabase.rpc("solicitar_transferencia_interunidade", {
    p_internacao_id: internacaoId,
    p_unidade_destino_id: unidadeDestinoId,
    p_motivo: motivo,
    p_prioridade: txt(formData, "prioridade") || "normal",
    p_resumo_clinico: txt(formData, "resumo_clinico") || null,
    p_condicoes_transporte: txt(formData, "condicoes_transporte") || null,
    p_numero_autorizacao_destino: txt(formData, "numero_autorizacao_destino") || null,
    p_senha_autorizacao_destino: txt(formData, "senha_autorizacao_destino") || null,
    p_observacoes: txt(formData, "observacoes") || null,
  });
  if (error) return fail(error.message);
  return done("solicitada");
}

export async function aceitarTransferenciaInterunidade(formData: FormData) {
  const { supabase } = await getAssistencialContext();
  const { error } = await supabase.rpc("aceitar_transferencia_interunidade", {
    p_transferencia_id: txt(formData, "transferencia_id"),
    p_leito_destino_id: txt(formData, "leito_destino_id"),
    p_observacoes: txt(formData, "observacoes") || null,
  });
  if (error) return fail(error.message);
  return done("aceita");
}

export async function recusarTransferenciaInterunidade(formData: FormData) {
  const { supabase } = await getAssistencialContext();
  const { error } = await supabase.rpc("recusar_transferencia_interunidade", {
    p_transferencia_id: txt(formData, "transferencia_id"),
    p_motivo: txt(formData, "motivo"),
  });
  if (error) return fail(error.message);
  return done("recusada");
}

export async function cancelarTransferenciaInterunidade(formData: FormData) {
  const { supabase } = await getAssistencialContext();
  const { error } = await supabase.rpc("cancelar_transferencia_interunidade", {
    p_transferencia_id: txt(formData, "transferencia_id"),
    p_motivo: txt(formData, "motivo"),
  });
  if (error) return fail(error.message);
  return done("cancelada");
}
