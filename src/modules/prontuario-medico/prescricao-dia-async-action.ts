"use server";

import { adicionarItemPrescricaoDiaAction } from "@/modules/prontuario-medico/prescricao-dia-actions";

type ResultadoInclusao = { ok: true } | { ok: false; erro: string };

function destinoRedirect(error: unknown) {
  if (!error || typeof error !== "object") return null;
  const digest = (error as { digest?: unknown }).digest;
  if (typeof digest !== "string" || !digest.startsWith("NEXT_REDIRECT;")) return null;
  const partes = digest.split(";");
  return partes.length >= 3 ? partes[2] : null;
}

const mensagens: Record<string, string> = {
  campos: "Preencha os campos obrigatórios do item.",
  catalogo: "Selecione um item ativo do catálogo assistencial.",
  categoria: "O item selecionado não pertence a esta aba.",
  atendimento: "O atendimento não está ativo nesta unidade.",
  profissional: "Seu usuário não está vinculado a um profissional clínico ativo.",
  salvar: "Não foi possível salvar o item da prescrição.",
};

export async function adicionarItemPrescricaoDiaAsyncAction(formData: FormData): Promise<ResultadoInclusao> {
  try {
    await adicionarItemPrescricaoDiaAction(formData);
    return { ok: true };
  } catch (error) {
    const destino = destinoRedirect(error);
    if (!destino) throw error;

    const url = new URL(destino, "http://medsync.local");
    const erro = url.searchParams.get("erro");
    if (erro) return { ok: false, erro: mensagens[erro] ?? "Não foi possível adicionar o item." };
    return { ok: true };
  }
}
