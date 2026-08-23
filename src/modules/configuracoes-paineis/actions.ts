"use server";

import { redirect } from "next/navigation";
import { getAssistencialContext } from "@/modules/assistencial/context";

export async function salvarConfiguracaoPaineis(formData: FormData) {
  const { supabase, user, empresaId, unidadeId } = await getAssistencialContext();
  const modo = String(formData.get("modo") ?? "integrado");
  if (!["integrado","setorial"].includes(modo)) redirect("/configuracoes/paineis?erro=modo");
  const payload = {
    empresa_id: empresaId,
    unidade_id: unidadeId,
    modo,
    recepcao_chama_todos: formData.get("recepcao_chama_todos") === "on",
    chamar_por_nome_apos_identificacao: formData.get("chamar_por_nome_apos_identificacao") === "on",
    exibir_senha_apoio: formData.get("exibir_senha_apoio") === "on",
    tocar_audio: formData.get("tocar_audio") === "on",
    updated_at: new Date().toISOString(),
    updated_by: user.id,
  };
  const { error } = await supabase.from("configuracoes_painel_chamadas").upsert(payload, { onConflict: "unidade_id" });
  if (error) redirect("/configuracoes/paineis?erro=salvar");
  redirect("/configuracoes/paineis?sucesso=1");
}
