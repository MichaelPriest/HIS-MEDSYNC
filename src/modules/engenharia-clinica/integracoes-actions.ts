"use server";

import type { Route } from "next";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAssistencialContext } from "@/modules/assistencial/context";

function text(fd: FormData, key: string) { const v = String(fd.get(key) ?? "").trim(); return v || null; }
function numberValue(fd: FormData, key: string) { const v = text(fd, key); if (!v) return null; const n = Number(v); return Number.isFinite(n) ? n : null; }
function go(url: string): never { redirect(url as Route); }

async function canManage(supabase: Awaited<ReturnType<typeof getAssistencialContext>>["supabase"], empresaId: string, unidadeId: string) {
  const { data } = await supabase.rpc("tem_permissao", { p_empresa: empresaId, p_unidade: unidadeId, p_codigo: "engenharia_clinica.gerenciar" });
  return data === true;
}

export async function salvarIntegracaoEquipamentoAction(fd: FormData) {
  const { supabase, user, empresaId, unidadeId } = await getAssistencialContext();
  if (!unidadeId) go("/engenharia-clinica/integracoes?erro=unidade");
  if (!(await canManage(supabase, empresaId, unidadeId))) go("/engenharia-clinica/integracoes?erro=permissao");
  const equipamentoId = text(fd, "equipamento_id"), sistemaOrigem = text(fd, "sistema_origem"), tipoIntegracao = text(fd, "tipo_integracao");
  if (!equipamentoId || !sistemaOrigem || !tipoIntegracao) go("/engenharia-clinica/integracoes?erro=campos");
  const payload = {
    empresa_id: empresaId, unidade_id: unidadeId, equipamento_id: equipamentoId, sistema_origem: sistemaOrigem,
    tipo_integracao: tipoIntegracao, protocolo: text(fd, "protocolo"), host: text(fd, "host"), porta: numberValue(fd, "porta"),
    ae_title: text(fd, "ae_title"), modalidade_dicom: text(fd, "modalidade_dicom"), endpoint: text(fd, "endpoint"),
    identificador_externo: text(fd, "identificador_externo"), ativo: fd.get("ativo") === "on", status: text(fd, "status") ?? "nao_testado",
    updated_at: new Date().toISOString(), updated_by: user.id,
  };
  const { error } = await supabase.from("engenharia_integracoes_equipamentos").upsert({ ...payload, created_by: user.id }, { onConflict: "empresa_id,unidade_id,equipamento_id,sistema_origem,tipo_integracao" });
  if (error) go(`/engenharia-clinica/integracoes?erro=${encodeURIComponent(error.message)}`);
  revalidatePath("/engenharia-clinica/integracoes"); go("/engenharia-clinica/integracoes?sucesso=integracao_salva");
}

export async function registrarTesteIntegracaoAction(fd: FormData) {
  const { supabase, user, empresaId, unidadeId } = await getAssistencialContext();
  if (!unidadeId) go("/engenharia-clinica/integracoes?erro=unidade");
  if (!(await canManage(supabase, empresaId, unidadeId))) go("/engenharia-clinica/integracoes?erro=permissao");
  const id = text(fd, "integracao_id"), status = text(fd, "status") ?? "ok", mensagem = text(fd, "mensagem");
  if (!id) go("/engenharia-clinica/integracoes?erro=integracao");
  const agora = new Date().toISOString();
  const { error } = await supabase.from("engenharia_integracoes_equipamentos").update({ status, ultimo_contato_em: status === "ok" ? agora : undefined, ultima_falha_em: status === "falha" ? agora : undefined, ultima_mensagem: mensagem, updated_at: agora, updated_by: user.id }).eq("id", id).eq("empresa_id", empresaId).eq("unidade_id", unidadeId);
  if (error) go(`/engenharia-clinica/integracoes?erro=${encodeURIComponent(error.message)}`);
  await supabase.from("engenharia_integracao_eventos").insert({ integracao_id: id, tipo: "teste_manual", status, mensagem, autor_usuario_id: user.id });
  revalidatePath("/engenharia-clinica/integracoes"); go("/engenharia-clinica/integracoes?sucesso=teste_registrado");
}

export async function vincularEquipamentoLaboratorioAction(fd: FormData) {
  const { supabase, empresaId, unidadeId } = await getAssistencialContext();
  if (!unidadeId) go("/engenharia-clinica/integracoes?erro=unidade");
  if (!(await canManage(supabase, empresaId, unidadeId))) go("/engenharia-clinica/integracoes?erro=permissao");
  const laboratorioId = text(fd, "laboratorio_equipamento_id"), equipamentoId = text(fd, "equipamento_id");
  if (!laboratorioId || !equipamentoId) go("/engenharia-clinica/integracoes?erro=campos");
  const { error } = await supabase.from("laboratorio_equipamentos").update({ engenharia_equipamento_id: equipamentoId }).eq("id", laboratorioId).eq("empresa_id", empresaId).eq("unidade_id", unidadeId);
  if (error) go(`/engenharia-clinica/integracoes?erro=${encodeURIComponent(error.message)}`);
  revalidatePath("/engenharia-clinica/integracoes"); go("/engenharia-clinica/integracoes?sucesso=laboratorio_vinculado");
}

export async function vincularEquipamentoSalaAction(fd: FormData) {
  const { supabase, user, empresaId, unidadeId } = await getAssistencialContext();
  if (!unidadeId) go("/engenharia-clinica/integracoes?erro=unidade");
  if (!(await canManage(supabase, empresaId, unidadeId))) go("/engenharia-clinica/integracoes?erro=permissao");
  const salaId = text(fd, "sala_cirurgica_id"), equipamentoId = text(fd, "equipamento_id");
  if (!salaId || !equipamentoId) go("/engenharia-clinica/integracoes?erro=campos");
  const { error } = await supabase.from("engenharia_sala_equipamentos").upsert({ empresa_id: empresaId, unidade_id: unidadeId, sala_cirurgica_id: salaId, equipamento_id: equipamentoId, obrigatorio: fd.get("obrigatorio") === "on", principal: fd.get("principal") === "on", ativo: true, created_by: user.id }, { onConflict: "sala_cirurgica_id,equipamento_id" });
  if (error) go(`/engenharia-clinica/integracoes?erro=${encodeURIComponent(error.message)}`);
  revalidatePath("/engenharia-clinica/integracoes"); go("/engenharia-clinica/integracoes?sucesso=sala_vinculada");
}
