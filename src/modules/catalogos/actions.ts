"use server";

import { redirect } from "next/navigation";
import { getCadastroContext, optional } from "@/modules/cadastros/context";

const tiposPermitidos = new Set(["especialidade", "cbo", "cid10", "tuss", "tipo_atendimento", "motivo_classificacao", "tipo_profissional"]);

export async function criarCatalogo(formData: FormData) {
  const { supabase, user, empresaId } = await getCadastroContext();
  const tipo = String(formData.get("tipo") ?? "");
  const codigo = String(formData.get("codigo") ?? "").trim();
  const descricao = String(formData.get("descricao") ?? "").trim();
  const vigenciaInicio = optional(formData.get("vigencia_inicio"));
  const vigenciaFim = optional(formData.get("vigencia_fim"));

  if (!tiposPermitidos.has(tipo) || !codigo || !descricao) {
    redirect("/catalogos/novo?erro=campos-obrigatorios");
  }

  if (vigenciaInicio && vigenciaFim && vigenciaFim < vigenciaInicio) {
    redirect("/catalogos/novo?erro=vigencia-invalida");
  }

  const { data: podeCriar, error: permissaoError } = await supabase.rpc("tem_permissao", {
    p_empresa: empresaId,
    p_unidade: null,
    p_codigo: "catalogos.criar",
  });

  if (permissaoError) {
    console.error("[catalogos.criar] falha ao consultar permissao", {
      userId: user.id,
      empresaId,
      code: permissaoError.code,
      message: permissaoError.message,
      details: permissaoError.details,
      hint: permissaoError.hint,
    });
    redirect("/catalogos/novo?erro=erro-permissao");
  }

  if (!podeCriar) {
    redirect("/catalogos/novo?erro=sem-permissao");
  }

  const { error } = await supabase.from("catalogos").insert({
    empresa_id: empresaId,
    tipo,
    codigo,
    descricao,
    vigencia_inicio: vigenciaInicio,
    vigencia_fim: vigenciaFim,
    created_by: user.id,
    updated_by: user.id,
  });

  if (error) {
    console.error("[catalogos.criar] insert recusado", {
      userId: user.id,
      empresaId,
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });

    if (error.code === "23505") redirect("/catalogos/novo?erro=duplicado");
    if (error.code === "42501") redirect("/catalogos/novo?erro=sem-permissao");
    if (error.code === "22P02" || error.code === "42703" || error.code === "42P01") redirect("/catalogos/novo?erro=schema-desatualizado");
    if (error.code === "23514" || error.code === "22007") redirect("/catalogos/novo?erro=dados-invalidos");
    redirect("/catalogos/novo?erro=falha-cadastro");
  }

  redirect("/catalogos?sucesso=cadastrado");
}
