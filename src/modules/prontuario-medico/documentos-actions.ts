"use server";

import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAssistencialContext } from "@/modules/assistencial/context";

const TIPOS_RECEITA = new Set(["receituario_comum", "controle_especial", "b1_azul"]);
const TIPOS_DOCUMENTO = new Set([...TIPOS_RECEITA, "orientacao_nao_medicamentosa"]);

function texto(formData: FormData, campo: string) {
  const valor = String(formData.get(campo) ?? "").trim();
  return valor || null;
}

function hashRegistro(payload: unknown, usuarioId: string, instante: string) {
  return createHash("sha256").update(JSON.stringify({ payload, usuarioId, instante })).digest("hex");
}

function itensReceita(valor: string | null) {
  if (!valor) return [];
  return valor.split(/\r?\n/).map((linha) => linha.trim()).filter(Boolean).map((linha, index) => ({ ordem: index + 1, texto: linha }));
}

function tituloDocumento(tipo: string) {
  if (tipo === "controle_especial") return "Receita de Controle Especial";
  if (tipo === "b1_azul") return "Notificação de Receita B1 (registro)";
  if (tipo === "orientacao_nao_medicamentosa") return "Orientações não medicamentosas";
  return "Receituário médico";
}

async function possuiPermissao(supabase: Awaited<ReturnType<typeof getAssistencialContext>>["supabase"], empresaId: string, unidadeId: string, codigo: string) {
  const { data, error } = await supabase.rpc("tem_permissao", { p_empresa: empresaId, p_unidade: unidadeId, p_codigo: codigo });
  return !error && data === true;
}

export async function emitirDocumentoClinicoAction(formData: FormData) {
  const ctx = await getAssistencialContext();
  const atendimentoId = String(formData.get("atendimento_id") ?? "").trim();
  const tipoDocumento = String(formData.get("tipo_documento") ?? "").trim();
  const acao = String(formData.get("acao") ?? "salvar").trim();
  const assinar = acao === "assinar";

  if (!atendimentoId || !TIPOS_DOCUMENTO.has(tipoDocumento)) redirect(`/prontuario/${atendimentoId || ""}/documentos?erro=campos`);

  const [{ data: atendimento }, { data: profissional }] = await Promise.all([
    ctx.supabase.from("atendimentos")
      .select("id,paciente_id,status,paciente:pacientes(id,nome_completo,nome_social,cpf,cns,rg,data_nascimento,sexo,logradouro,numero,complemento,bairro,cidade,uf,cep)")
      .eq("id", atendimentoId).eq("empresa_id", ctx.empresaId).eq("unidade_id", ctx.unidadeId).maybeSingle(),
    ctx.supabase.from("profissionais")
      .select("id,nome_completo,conselho,numero_conselho,uf_conselho,especialidade,cbo")
      .eq("empresa_id", ctx.empresaId).eq("usuario_id", ctx.user.id).eq("ativo", true).limit(1).maybeSingle(),
  ]);

  if (!atendimento) redirect(`/prontuario/${atendimentoId}/documentos?erro=atendimento`);
  if (["alta", "cancelado"].includes(String(atendimento.status))) redirect(`/prontuario/${atendimentoId}/documentos?erro=atendimento-encerrado`);
  if (!profissional) redirect(`/prontuario/${atendimentoId}/documentos?erro=profissional`);

  const permissaoCriar = TIPOS_RECEITA.has(tipoDocumento) ? "prescricao.criar" : "prontuario.evoluir";
  const permissaoAssinar = TIPOS_RECEITA.has(tipoDocumento) ? "prescricao.assinar" : "prontuario.assinar";
  if (!(await possuiPermissao(ctx.supabase, ctx.empresaId, ctx.unidadeId, permissaoCriar))) redirect(`/prontuario/${atendimentoId}/documentos?erro=permissao`);
  if (assinar && !(await possuiPermissao(ctx.supabase, ctx.empresaId, ctx.unidadeId, permissaoAssinar))) redirect(`/prontuario/${atendimentoId}/documentos?erro=assinatura`);

  const paciente = Array.isArray(atendimento.paciente) ? atendimento.paciente[0] : atendimento.paciente;
  if (!paciente) redirect(`/prontuario/${atendimentoId}/documentos?erro=paciente`);

  const linhas = itensReceita(texto(formData, "itens_texto"));
  const orientacoes = texto(formData, "orientacoes");
  const numeroNotificacao = texto(formData, "numero_notificacao");
  if (tipoDocumento === "orientacao_nao_medicamentosa" ? !orientacoes : linhas.length === 0) redirect(`/prontuario/${atendimentoId}/documentos?erro=conteudo`);
  if (tipoDocumento === "b1_azul" && assinar && !numeroNotificacao) redirect(`/prontuario/${atendimentoId}/documentos?erro=notificacao`);

  const [{ data: empresa }, { data: unidade }] = await Promise.all([
    ctx.supabase.from("empresas").select("razao_social,nome_fantasia,cnpj,cnes,telefone,email,logradouro,numero,complemento,bairro,cidade,uf,cep,rodape_documentos").eq("id", ctx.empresaId).maybeSingle(),
    ctx.supabase.from("unidades").select("nome,cnes").eq("id", ctx.unidadeId).eq("empresa_id", ctx.empresaId).maybeSingle(),
  ]);

  const instante = new Date().toISOString();
  const conteudoHash = {
    atendimentoId,
    tipoDocumento,
    linhas,
    orientacoes,
    numeroNotificacao,
    pacienteId: paciente.id,
    profissionalId: profissional.id,
  };

  const payload = {
    empresa_id: ctx.empresaId,
    unidade_id: ctx.unidadeId,
    atendimento_id: atendimentoId,
    paciente_id: paciente.id,
    profissional_id: profissional.id,
    tipo_documento: tipoDocumento,
    titulo: tituloDocumento(tipoDocumento),
    itens: linhas,
    orientacoes,
    observacoes: texto(formData, "observacoes"),
    numero_notificacao: numeroNotificacao,
    status: assinar ? "assinado" : "rascunho",
    emitido_em: instante,
    assinado_em: assinar ? instante : null,
    assinatura_hash: assinar ? hashRegistro(conteudoHash, ctx.user.id, instante) : null,
    paciente_snapshot: {
      nome_completo: paciente.nome_completo,
      nome_social: paciente.nome_social,
      cpf: paciente.cpf,
      cns: paciente.cns,
      rg: paciente.rg,
      data_nascimento: paciente.data_nascimento,
      sexo: paciente.sexo,
      endereco: [paciente.logradouro, paciente.numero, paciente.complemento, paciente.bairro, paciente.cidade, paciente.uf, paciente.cep].filter(Boolean).join(", "),
    },
    profissional_snapshot: {
      nome_completo: profissional.nome_completo,
      conselho: profissional.conselho,
      numero_conselho: profissional.numero_conselho,
      uf_conselho: profissional.uf_conselho,
      especialidade: profissional.especialidade,
      cbo: profissional.cbo,
    },
    estabelecimento_snapshot: {
      razao_social: empresa?.razao_social,
      nome_fantasia: empresa?.nome_fantasia,
      cnpj: empresa?.cnpj,
      cnes: unidade?.cnes || empresa?.cnes,
      unidade: unidade?.nome,
      telefone: empresa?.telefone,
      email: empresa?.email,
      endereco: [empresa?.logradouro, empresa?.numero, empresa?.complemento, empresa?.bairro, empresa?.cidade, empresa?.uf, empresa?.cep].filter(Boolean).join(", "),
      rodape: empresa?.rodape_documentos,
    },
    created_by: ctx.user.id,
    updated_by: ctx.user.id,
  };

  const { data: documento, error } = await ctx.supabase.from("documentos_clinicos_medicos").insert(payload).select("id").single();
  if (error || !documento) {
    console.error("[prontuario] emitir documento clinico", { code: error?.code });
    redirect(`/prontuario/${atendimentoId}/documentos?erro=salvar`);
  }

  revalidatePath(`/prontuario/${atendimentoId}/documentos`);
  revalidatePath(`/prontuario/${atendimentoId}/historico`);
  redirect(`/prontuario/${atendimentoId}/documentos/${documento.id}`);
}