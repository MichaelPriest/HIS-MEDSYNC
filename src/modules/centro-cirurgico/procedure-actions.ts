"use server";

import { redirect } from "next/navigation";
import { getAssistencialContext } from "@/modules/assistencial/context";

const base = "/assistencial/centro-cirurgico/procedimentos";
const txt = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();
const nullable = (value: string) => value || null;
const bool = (fd: FormData, key: string) => fd.get(key) === "on";
const numberOrNull = (value: string) => value === "" ? null : Number(value);

function go(cirurgiaId: string | null, query: string): never {
  redirect(`${base}?${cirurgiaId ? `cirurgia=${encodeURIComponent(cirurgiaId)}&` : ""}${query}` as never);
}

export async function adicionarProcedimentoAoAto(formData: FormData) {
  const { supabase } = await getAssistencialContext();
  const cirurgiaId = txt(formData, "cirurgia_id");
  if (!cirurgiaId) return go(null, "erro=cirurgia-obrigatoria");

  const { error } = await supabase.rpc("centro_cirurgico_adicionar_procedimento_operacional", {
    p_cirurgia_id: cirurgiaId,
    p_tabela_item_id: nullable(txt(formData, "tabela_item_id")),
    p_codigo: nullable(txt(formData, "codigo")),
    p_descricao: nullable(txt(formData, "descricao")),
    p_porte: nullable(txt(formData, "porte")),
    p_porte_anestesico: nullable(txt(formData, "porte_anestesico")),
    p_observacoes: nullable(txt(formData, "observacoes")),
  });
  if (error) return go(cirurgiaId, `erro=${encodeURIComponent(error.message)}`);
  return go(cirurgiaId, "sucesso=procedimento-adicionado");
}

export async function salvarMembroEquipeProcedimento(formData: FormData) {
  const { supabase } = await getAssistencialContext();
  const cirurgiaId = txt(formData, "cirurgia_id");
  const procedimentoId = txt(formData, "cirurgia_procedimento_id");
  const profissionalId = txt(formData, "profissional_id");
  const papel = txt(formData, "papel");
  if (!cirurgiaId || !procedimentoId || !profissionalId || !papel) return go(cirurgiaId || null, "erro=equipe-incompleta");

  const { error } = await supabase.rpc("centro_cirurgico_salvar_membro_equipe_operacional", {
    p_cirurgia_procedimento_id: procedimentoId,
    p_profissional_id: profissionalId,
    p_papel: papel,
    p_ordem: numberOrNull(txt(formData, "ordem")),
    p_principal: bool(formData, "principal"),
    p_registrar_entrada: bool(formData, "registrar_entrada"),
    p_registrar_saida: bool(formData, "registrar_saida"),
    p_observacoes: nullable(txt(formData, "observacoes")),
  });
  if (error) return go(cirurgiaId, `erro=${encodeURIComponent(error.message)}`);
  return go(cirurgiaId, "sucesso=equipe-atualizada");
}

export async function acionarProcedimentoCirurgico(formData: FormData) {
  const { supabase } = await getAssistencialContext();
  const cirurgiaId = txt(formData, "cirurgia_id");
  const procedimentoId = txt(formData, "cirurgia_procedimento_id");
  const acao = txt(formData, "acao");
  if (!cirurgiaId || !procedimentoId || !acao) return go(cirurgiaId || null, "erro=acao-procedimento-invalida");

  const { error } = await supabase.rpc("centro_cirurgico_acionar_procedimento_operacional", {
    p_cirurgia_procedimento_id: procedimentoId,
    p_acao: acao,
    p_observacoes: nullable(txt(formData, "observacoes")),
  });
  if (error) return go(cirurgiaId, `erro=${encodeURIComponent(error.message)}`);
  return go(cirurgiaId, `sucesso=procedimento-${encodeURIComponent(acao)}`);
}
