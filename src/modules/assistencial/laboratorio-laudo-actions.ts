"use server";

import { redirect } from "next/navigation";
import { getAssistencialContext } from "@/modules/assistencial/context";

const base = "/assistencial/laboratorio";
const txt = (formData: FormData, key: string) => String(formData.get(key) ?? "").trim();

function editor(laudoId: string, query?: string): never {
  redirect(`${base}/laudos/${laudoId}${query ? `?${query}` : ""}` as never);
}

export async function abrirLaudoLaboratorio(formData: FormData) {
  const { supabase } = await getAssistencialContext();
  const solicitacaoId = txt(formData, "solicitacao_id");
  if (!solicitacaoId) redirect(`${base}/laudos?erro=solicitacao` as never);

  const { data: laudoId, error } = await supabase.rpc("salvar_laudo_laboratorio", {
    p_solicitacao_id: solicitacaoId,
    p_titulo: null,
    p_material: null,
    p_metodo: null,
    p_corpo: null,
    p_conclusao: null,
    p_observacoes: null,
  });

  if (error || !laudoId) {
    redirect(`${base}/laudos?erro=${encodeURIComponent(error?.message ?? "Não foi possível abrir o laudo")}` as never);
  }
  editor(String(laudoId));
}

export async function salvarLaudoLaboratorio(formData: FormData) {
  const { supabase } = await getAssistencialContext();
  const solicitacaoId = txt(formData, "solicitacao_id");
  const laudoIdAtual = txt(formData, "laudo_id");
  if (!solicitacaoId) redirect(`${base}/laudos?erro=solicitacao` as never);

  const { data: laudoId, error } = await supabase.rpc("salvar_laudo_laboratorio", {
    p_solicitacao_id: solicitacaoId,
    p_titulo: txt(formData, "titulo") || null,
    p_material: txt(formData, "material") || null,
    p_metodo: txt(formData, "metodo") || null,
    p_corpo: txt(formData, "corpo") || null,
    p_conclusao: txt(formData, "conclusao") || null,
    p_observacoes: txt(formData, "observacoes") || null,
  });

  if (error || !laudoId) {
    const retorno = laudoIdAtual || String(laudoId ?? "");
    if (retorno) editor(retorno, `erro=${encodeURIComponent(error?.message ?? "Falha ao salvar")}`);
    redirect(`${base}/laudos?erro=${encodeURIComponent(error?.message ?? "Falha ao salvar")}` as never);
  }
  editor(String(laudoId), "sucesso=rascunho");
}

export async function liberarLaudoLaboratorio(formData: FormData) {
  const { supabase } = await getAssistencialContext();
  const laudoId = txt(formData, "laudo_id");
  if (!laudoId) redirect(`${base}/laudos?erro=laudo` as never);

  const { error } = await supabase.rpc("liberar_laudo_laboratorio", { p_laudo_id: laudoId });
  if (error) editor(laudoId, `erro=${encodeURIComponent(error.message)}`);
  editor(laudoId, "sucesso=liberado");
}

export async function abrirRetificacaoLaudoLaboratorio(formData: FormData) {
  const { supabase } = await getAssistencialContext();
  const laudoId = txt(formData, "laudo_id");
  const motivo = txt(formData, "motivo");
  if (!laudoId) redirect(`${base}/laudos?erro=laudo` as never);

  const { error } = await supabase.rpc("abrir_retificacao_laudo_laboratorio", {
    p_laudo_id: laudoId,
    p_motivo: motivo,
  });
  if (error) editor(laudoId, `erro=${encodeURIComponent(error.message)}`);
  editor(laudoId, "sucesso=retificacao");
}
