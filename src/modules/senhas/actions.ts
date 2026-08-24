"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getAssistencialContext } from "@/modules/assistencial/context";

const somenteDigitos = (valor: string) => valor.replace(/\D/g, "");

function erroTotem(message?: string | null, code?: string | null) {
  const msg = String(message ?? "");
  if (msg.includes("TOTEM_UNIDADE_INDISPONIVEL")) return "unidade-indisponivel";
  if (msg.includes("TOTEM_SETOR_INDISPONIVEL")) return "setor-indisponivel";
  if (msg.includes("TOTEM_PRIORIDADE_INVALIDA")) return "prioridade-invalida";
  if (msg.includes("TOTEM_CPF_INVALIDO")) return "cpf-invalido";
  if (msg.includes("TOTEM_CPF_NAO_LOCALIZADO")) return "cpf-nao-localizado";
  if (code === "PGRST202" || code === "42883" || msg.toLowerCase().includes("function") && msg.toLowerCase().includes("not found")) return "rpc-indisponivel";
  if (code === "42501" || msg.toLowerCase().includes("permission denied")) return "permissao-rpc";
  return "falha-emissao";
}

function erroSemanticoTotem(message?: string | null) {
  const msg = String(message ?? "");
  return [
    "TOTEM_UNIDADE_INDISPONIVEL",
    "TOTEM_SETOR_INDISPONIVEL",
    "TOTEM_PRIORIDADE_INVALIDA",
    "TOTEM_CPF_INVALIDO",
    "TOTEM_CPF_NAO_LOCALIZADO",
  ].some((codigo) => msg.includes(codigo));
}

function primeiraLinha(data: unknown) {
  return Array.isArray(data) ? data[0] : data;
}

export async function emitirSenhaTotem(formData: FormData) {
  const supabase = await createClient();
  const unidadeId = String(formData.get("unidade_id") ?? "").trim();
  const setorCodigo = String(formData.get("setor_codigo") ?? "recepcao").trim() || "recepcao";
  const prioridade = String(formData.get("prioridade") ?? "normal").trim() || "normal";
  const cpfInformado = String(formData.get("cpf") ?? "").trim();
  const cpf = somenteDigitos(cpfInformado);
  const acao = String(formData.get("acao") ?? "emitir");

  if (!unidadeId) redirect("/totem/invalido?erro=unidade-indisponivel");
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(unidadeId)) {
    redirect("/totem/invalido?erro=unidade-indisponivel");
  }
  if (acao === "identificar" && cpf.length !== 11) redirect(`/totem/${unidadeId}?erro=cpf-invalido`);

  const v2 = await supabase.rpc("emitir_senha_totem_v2", {
    p_unidade_id: unidadeId,
    p_setor_codigo: setorCodigo,
    p_prioridade: prioridade,
    p_cpf: acao === "identificar" ? cpf : null,
  });

  let emitida = primeiraLinha(v2.data) as { senha?: unknown; identificado?: unknown } | null;
  let senha = emitida?.senha ? String(emitida.senha) : null;
  let identificado = Boolean(emitida?.identificado);
  let erroFinal = v2.error;

  // Compatibilidade com bancos que ainda nao recarregaram a assinatura V2 no PostgREST.
  // Erros funcionais conhecidos (CPF/unidade/setor/prioridade) nunca sao mascarados pelo fallback.
  if ((!senha || v2.error) && !erroSemanticoTotem(v2.error?.message)) {
    const legado = await supabase.rpc("emitir_senha_totem", {
      p_unidade_id: unidadeId,
      p_setor_codigo: setorCodigo,
      p_prioridade: prioridade,
    });
    const emitidaLegada = primeiraLinha(legado.data) as { senha?: unknown } | null;
    const senhaLegada = emitidaLegada?.senha ? String(emitidaLegada.senha) : null;

    if (senhaLegada) {
      senha = senhaLegada;
      identificado = false;
      erroFinal = null;
      console.warn("[totem] emissao realizada por RPC legada; aplicar migration de reparo V2", {
        unidadeId,
        setorCodigo,
        prioridade,
        acao,
        v2Code: v2.error?.code,
        v2Message: v2.error?.message,
      });
    } else if (legado.error) {
      erroFinal = legado.error;
      console.error("[totem] falha tambem na RPC legada", {
        unidadeId,
        setorCodigo,
        prioridade,
        acao,
        v2Code: v2.error?.code,
        v2Message: v2.error?.message,
        legadoCode: legado.error.code,
        legadoMessage: legado.error.message,
        legadoDetails: legado.error.details,
        legadoHint: legado.error.hint,
      });
    }
  }

  if (erroFinal || !senha) {
    console.error("[totem] falha ao emitir senha", {
      unidadeId,
      setorCodigo,
      prioridade,
      acao,
      code: erroFinal?.code,
      message: erroFinal?.message,
      details: erroFinal?.details,
      hint: erroFinal?.hint,
      v2Code: v2.error?.code,
      v2Message: v2.error?.message,
    });
    redirect(`/totem/${unidadeId}?erro=${erroTotem(erroFinal?.message ?? v2.error?.message, erroFinal?.code ?? v2.error?.code)}`);
  }

  redirect(`/totem/${unidadeId}?senha=${encodeURIComponent(senha)}${identificado ? "&identificado=1" : ""}`);
}

async function efetivarChamada(senhaId: string, ponto: string) {
  const { supabase, user, unidadeId } = await getAssistencialContext();
  const { data: atual } = await supabase.from("senhas_atendimento").select("id,primeira_chamada_em").eq("id", senhaId).eq("unidade_id", unidadeId).maybeSingle();
  if (!atual) redirect("/senhas?erro=1");
  const now = new Date().toISOString();
  const { error } = await supabase.from("senhas_atendimento").update({ status: "chamada", ponto_atendimento: ponto, primeira_chamada_em: atual.primeira_chamada_em || now, ultima_chamada_em: now, chamado_por: user.id, updated_by: user.id, updated_at: now }).eq("id", senhaId);
  if (error) redirect("/senhas?erro=1");
  revalidatePath("/senhas");
}

export async function chamarSenha(formData: FormData) {
  const senhaId = String(formData.get("senha_id") ?? "").trim();
  const ponto = String(formData.get("ponto_atendimento") ?? "").trim();
  if (!senhaId || !ponto) redirect("/senhas?erro=1");
  await efetivarChamada(senhaId, ponto);
}

export async function chamarProximaSenha(formData: FormData) {
  const { supabase, unidadeId } = await getAssistencialContext();
  const ponto = String(formData.get("ponto_atendimento") ?? "").trim();
  const setorId = String(formData.get("setor_id") ?? "").trim();
  if (!ponto || !setorId) redirect("/senhas?erro=1");
  const hoje = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
  const { data: fila } = await supabase.from("senhas_atendimento").select("id,prioridade,sequencial").eq("unidade_id", unidadeId).eq("setor_id", setorId).eq("data_referencia", hoje).eq("status", "aguardando").limit(200);
  const peso: Record<string, number> = { emergencia: 0, preferencial: 1, normal: 2 };
  const proxima = (fila ?? []).sort((a, b) => (peso[String(a.prioridade)] ?? 9) - (peso[String(b.prioridade)] ?? 9) || Number(a.sequencial) - Number(b.sequencial))[0];
  if (!proxima) redirect("/senhas?erro=sem-fila");
  await efetivarChamada(proxima.id, ponto);
}

export async function iniciarAtendimentoSenha(formData: FormData) {
  const { supabase, user, unidadeId } = await getAssistencialContext();
  const senhaId = String(formData.get("senha_id") ?? "").trim();
  if (!senhaId) redirect("/senhas?erro=1");
  const { data: senha } = await supabase.from("senhas_atendimento").select("id,status").eq("id", senhaId).eq("unidade_id", unidadeId).maybeSingle();
  if (!senha || !["chamada","aguardando"].includes(String(senha.status))) redirect("/senhas?erro=1");
  const { error } = await supabase.from("senhas_atendimento").update({ status: "em_atendimento", iniciado_em: new Date().toISOString(), updated_by: user.id }).eq("id", senhaId);
  if (error) redirect("/senhas?erro=1");
  redirect(`/atendimentos/novo?senha=${encodeURIComponent(senhaId)}`);
}
