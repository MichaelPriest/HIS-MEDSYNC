"use server";

import type { Route } from "next";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAssistencialContext } from "@/modules/assistencial/context";

const base = "/assistencial/centro-cirurgico/suprimentos";

function text(fd: FormData, key: string) {
  const value = String(fd.get(key) ?? "").trim();
  return value || null;
}

function numeric(fd: FormData, key: string) {
  const raw = text(fd, key);
  if (!raw) return null;
  const value = Number(raw.replace(",", "."));
  return Number.isFinite(value) ? value : null;
}

function detailPath(cirurgiaId: string, query?: string) {
  return `${base}/${encodeURIComponent(cirurgiaId)}${query ? `?${query}` : ""}`;
}

function go(url: string): never {
  redirect(url as Route);
}

function fail(cirurgiaId: string, message?: string | null): never {
  go(detailPath(cirurgiaId, `erro=${encodeURIComponent(message || "Não foi possível concluir a operação")}`));
}

function refresh(cirurgiaId: string) {
  revalidatePath("/assistencial/centro-cirurgico");
  revalidatePath(base);
  revalidatePath(`${base}/${cirurgiaId}`);
  revalidatePath("/almoxarifado");
  revalidatePath("/almoxarifado/requisicoes");
  revalidatePath("/faturamento/producao");
  revalidatePath("/integracoes");
}

export async function requisitarSuprimentosCirurgicosAction(fd: FormData) {
  const { supabase } = await getAssistencialContext();
  const cirurgiaId = text(fd, "cirurgia_id");
  const localDestinoId = text(fd, "local_destino_id");
  const prioridade = text(fd, "prioridade") ?? "normal";
  if (!cirurgiaId || !localDestinoId) go(`${base}?erro=campos_obrigatorios`);

  const itens = Array.from({ length: 8 }, (_, index) => index + 1)
    .map((n) => ({
      produto_id: text(fd, `produto_${n}_id`),
      quantidade: numeric(fd, `produto_${n}_quantidade`),
      observacoes: text(fd, `produto_${n}_observacoes`),
    }))
    .filter((item) => item.produto_id && item.quantidade && item.quantidade > 0);

  if (!itens.length) fail(cirurgiaId, "Inclua pelo menos um suprimento com quantidade válida.");

  const { data, error } = await supabase.rpc("centro_cirurgico_requisitar_suprimentos_operacional", {
    p_cirurgia_id: cirurgiaId,
    p_local_destino_id: localDestinoId,
    p_prioridade: prioridade,
    p_justificativa: text(fd, "justificativa"),
    p_itens: itens,
  });
  if (error) fail(cirurgiaId, error.message);

  refresh(cirurgiaId);
  go(detailPath(cirurgiaId, `sucesso=requisicao_criada&id=${encodeURIComponent(String(data ?? ""))}`));
}

export async function receberSuprimentosCirurgicosAction(fd: FormData) {
  const { supabase } = await getAssistencialContext();
  const cirurgiaId = text(fd, "cirurgia_id");
  const requisicaoId = text(fd, "requisicao_id");
  if (!cirurgiaId || !requisicaoId) go(`${base}?erro=requisicao_invalida`);

  const { error } = await supabase.rpc("centro_cirurgico_receber_suprimentos_operacional", {
    p_requisicao_id: requisicaoId,
  });
  if (error) fail(cirurgiaId, error.message);

  refresh(cirurgiaId);
  go(detailPath(cirurgiaId, "sucesso=requisicao_recebida"));
}

export async function consumirSuprimentoCirurgicoAction(fd: FormData) {
  const { supabase } = await getAssistencialContext();
  const cirurgiaId = text(fd, "cirurgia_id");
  const loteId = text(fd, "estoque_lote_id");
  const quantidade = numeric(fd, "quantidade");
  if (!cirurgiaId || !loteId || !quantidade || quantidade <= 0) go(`${base}?erro=consumo_invalido`);

  const { error } = await supabase.rpc("centro_cirurgico_consumir_suprimento_operacional", {
    p_cirurgia_id: cirurgiaId,
    p_estoque_lote_id: loteId,
    p_quantidade: quantidade,
    p_opme_id: text(fd, "opme_id"),
    p_requisicao_item_id: text(fd, "requisicao_item_id"),
    p_serie: text(fd, "serie"),
    p_observacoes: text(fd, "observacoes"),
  });
  if (error) fail(cirurgiaId, error.message);

  refresh(cirurgiaId);
  go(detailPath(cirurgiaId, "sucesso=consumo_registrado"));
}

export async function estornarConsumoCirurgicoAction(fd: FormData) {
  const { supabase } = await getAssistencialContext();
  const cirurgiaId = text(fd, "cirurgia_id");
  const movimentoId = text(fd, "movimento_id");
  if (!cirurgiaId || !movimentoId) go(`${base}?erro=movimento_invalido`);

  const { error } = await supabase.rpc("centro_cirurgico_estornar_consumo_operacional", {
    p_movimento_id: movimentoId,
    p_quantidade: numeric(fd, "quantidade"),
    p_motivo: text(fd, "motivo"),
  });
  if (error) fail(cirurgiaId, error.message);

  refresh(cirurgiaId);
  go(detailPath(cirurgiaId, "sucesso=consumo_estornado"));
}
