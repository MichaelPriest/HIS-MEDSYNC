"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { asRoute } from "@/lib/route-cast";
import { getAssistencialContext } from "@/modules/assistencial/context";

type Especializado = "dialise" | "oncologia" | "radioterapia" | "hemodinamica" | "endoscopia" | "anatomia-patologica" | "transplantes" | "home-care" | "paliativos" | "imunizacao";

const MODULOS: Especializado[] = ["dialise","oncologia","radioterapia","hemodinamica","endoscopia","anatomia-patologica","transplantes","home-care","paliativos","imunizacao"];

function texto(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();
  return value || null;
}

function numero(formData: FormData, key: string) {
  const raw = texto(formData, key);
  if (!raw) return null;
  const value = Number(raw.replace(",", "."));
  return Number.isFinite(value) ? value : null;
}

function inteiro(formData: FormData, key: string) {
  const value = numero(formData, key);
  return value === null ? null : Math.trunc(value);
}

function moduloValido(value: string): value is Especializado {
  return MODULOS.includes(value as Especializado);
}

async function episodio(formData: FormData) {
  const contexto = await getAssistencialContext();
  const atendimentoId = String(formData.get("atendimento_id") ?? "").trim();
  if (!atendimentoId) redirect(asRoute("/assistencial?erro=atendimento"));

  const { data: atendimento } = await contexto.supabase
    .from("atendimentos")
    .select("id,paciente_id,empresa_id,unidade_id")
    .eq("id", atendimentoId)
    .eq("empresa_id", contexto.empresaId)
    .eq("unidade_id", contexto.unidadeId)
    .maybeSingle();
  if (!atendimento) redirect(asRoute("/assistencial?erro=atendimento"));

  const { data: profissional } = await contexto.supabase
    .from("profissionais")
    .select("id")
    .eq("empresa_id", contexto.empresaId)
    .eq("usuario_id", contexto.user.id)
    .eq("ativo", true)
    .limit(1)
    .maybeSingle();

  return { ...contexto, atendimento, profissionalId: profissional?.id ?? null };
}

export async function registrarEspecializado(formData: FormData) {
  const modulo = String(formData.get("modulo") ?? "").trim();
  if (!moduloValido(modulo)) redirect(asRoute("/assistencial?erro=modulo"));

  const { supabase, user, empresaId, unidadeId, atendimento, profissionalId } = await episodio(formData);
  const base = {
    empresa_id: empresaId,
    unidade_id: unidadeId,
    paciente_id: atendimento.paciente_id,
    created_by: user.id,
  };

  let error: { message?: string; code?: string } | null = null;

  switch (modulo) {
    case "dialise": {
      const result = await supabase.from("dialise_sessoes").insert({
        ...base,
        atendimento_id: atendimento.id,
        profissional_id: profissionalId,
        peso_pre_kg: numero(formData, "peso_pre_kg"),
        inicio_em: texto(formData, "inicio_em"),
        intercorrencias: texto(formData, "intercorrencias"),
        status: "programada",
        updated_by: user.id,
      });
      error = result.error;
      break;
    }
    case "oncologia": {
      const diagnostico = texto(formData, "diagnostico");
      if (!diagnostico) redirect(asRoute("/assistencial/oncologia?erro=campos"));
      const result = await supabase.from("oncologia_planos").insert({
        ...base,
        atendimento_id: atendimento.id,
        profissional_id: profissionalId,
        diagnostico,
        cid10: texto(formData, "cid10"),
        estadiamento: texto(formData, "estadiamento"),
        intencao: texto(formData, "intencao"),
        protocolo: texto(formData, "protocolo"),
        linha_tratamento: texto(formData, "linha_tratamento"),
        inicio_previsto: texto(formData, "inicio_previsto"),
        observacoes: texto(formData, "observacoes"),
        status: "planejado",
        updated_by: user.id,
      });
      error = result.error;
      break;
    }
    case "radioterapia": {
      const sitioAlvo = texto(formData, "sitio_alvo");
      if (!sitioAlvo) redirect(asRoute("/assistencial/radioterapia?erro=campos"));
      const result = await supabase.from("radioterapia_planos").insert({
        ...base,
        atendimento_id: atendimento.id,
        profissional_id: profissionalId,
        diagnostico: texto(formData, "diagnostico"),
        cid10: texto(formData, "cid10"),
        sitio_alvo: sitioAlvo,
        tecnica: texto(formData, "tecnica"),
        equipamento: texto(formData, "equipamento"),
        dose_total_gy: numero(formData, "dose_total_gy"),
        numero_fracoes: inteiro(formData, "numero_fracoes"),
        dose_fracao_gy: numero(formData, "dose_fracao_gy"),
        inicio_previsto: texto(formData, "inicio_previsto"),
        observacoes: texto(formData, "observacoes"),
        status: "planejado",
        updated_by: user.id,
      });
      error = result.error;
      break;
    }
    case "hemodinamica": {
      const procedimento = texto(formData, "procedimento");
      if (!procedimento) redirect(asRoute("/assistencial/hemodinamica?erro=campos"));
      const result = await supabase.from("hemodinamica_procedimentos").insert({
        ...base,
        atendimento_id: atendimento.id,
        profissional_id: profissionalId,
        procedimento,
        codigo_tuss: texto(formData, "codigo_tuss"),
        indicacao: texto(formData, "indicacao"),
        acesso_vascular: texto(formData, "acesso_vascular"),
        contraste: texto(formData, "contraste"),
        volume_contraste_ml: numero(formData, "volume_contraste_ml"),
        dose_radiacao: texto(formData, "dose_radiacao"),
        status: "programado",
        updated_by: user.id,
      });
      error = result.error;
      break;
    }
    case "endoscopia": {
      const tipo = texto(formData, "tipo");
      if (!tipo) redirect(asRoute("/assistencial/endoscopia?erro=campos"));
      const result = await supabase.from("endoscopia_procedimentos").insert({
        ...base,
        atendimento_id: atendimento.id,
        profissional_id: profissionalId,
        tipo,
        indicacao: texto(formData, "indicacao"),
        preparo: texto(formData, "preparo"),
        sedacao: texto(formData, "sedacao"),
        aparelho: texto(formData, "aparelho"),
        status: "programado",
        updated_by: user.id,
      });
      error = result.error;
      break;
    }
    case "anatomia-patologica": {
      const tipoExame = texto(formData, "tipo_exame");
      const material = texto(formData, "material");
      if (!tipoExame || !material) redirect(asRoute("/assistencial/anatomia-patologica?erro=campos"));
      const result = await supabase.from("anatomia_patologica_solicitacoes").insert({
        ...base,
        atendimento_id: atendimento.id,
        solicitante_id: profissionalId,
        tipo_exame: tipoExame,
        material,
        sitio_anatomico: texto(formData, "sitio_anatomico"),
        hipotese_diagnostica: texto(formData, "hipotese_diagnostica"),
        cid10: texto(formData, "cid10"),
        prioridade: texto(formData, "prioridade") ?? "rotina",
        updated_by: user.id,
      });
      error = result.error;
      break;
    }
    case "transplantes": {
      const orgao = texto(formData, "orgao");
      if (!orgao) redirect(asRoute("/assistencial/transplantes?erro=campos"));
      const result = await supabase.from("transplante_avaliacoes").insert({
        ...base,
        atendimento_id: atendimento.id,
        profissional_id: profissionalId,
        orgao,
        indicacao: texto(formData, "indicacao"),
        contraindicacoes: texto(formData, "contraindicacoes"),
        parecer: texto(formData, "parecer"),
        status: "em_avaliacao",
        updated_by: user.id,
      });
      error = result.error;
      break;
    }
    case "home-care": {
      const result = await supabase.from("homecare_planos").insert({
        ...base,
        atendimento_origem_id: atendimento.id,
        profissional_responsavel_id: profissionalId,
        complexidade: texto(formData, "complexidade"),
        objetivos: texto(formData, "objetivos"),
        frequencia_visitas: texto(formData, "frequencia_visitas"),
        inicio_em: texto(formData, "inicio_em") ?? new Date().toISOString().slice(0, 10),
        observacoes: texto(formData, "observacoes"),
        status: "ativo",
        updated_by: user.id,
      });
      error = result.error;
      break;
    }
    case "paliativos": {
      const result = await supabase.from("cuidados_paliativos_planos").insert({
        ...base,
        atendimento_id: atendimento.id,
        profissional_id: profissionalId,
        pps: inteiro(formData, "pps"),
        elegibilidade: texto(formData, "elegibilidade"),
        objetivos_cuidado: texto(formData, "objetivos_cuidado"),
        diretivas_antecipadas: texto(formData, "diretivas_antecipadas"),
        limitacao_suporte: texto(formData, "limitacao_suporte"),
        comunicacao_familia: texto(formData, "comunicacao_familia"),
        plano_familiar: texto(formData, "plano_familiar"),
        status: "ativo",
        updated_by: user.id,
      });
      error = result.error;
      break;
    }
    case "imunizacao": {
      const vacina = texto(formData, "vacina");
      if (!vacina) redirect(asRoute("/assistencial/imunizacao?erro=campos"));
      const result = await supabase.from("imunizacoes").insert({
        ...base,
        atendimento_id: atendimento.id,
        profissional_id: profissionalId,
        vacina,
        dose: texto(formData, "dose"),
        fabricante: texto(formData, "fabricante"),
        lote: texto(formData, "lote"),
        validade: texto(formData, "validade"),
        via: texto(formData, "via"),
        local_aplicacao: texto(formData, "local_aplicacao"),
        evento_adverso: texto(formData, "evento_adverso"),
        observacoes: texto(formData, "observacoes"),
      });
      error = result.error;
      break;
    }
  }

  if (error) {
    console.error(`[assistencial/${modulo}] registrar`, { code: error.code, message: error.message });
    redirect(asRoute(`/assistencial/${modulo}?erro=salvar`));
  }

  revalidatePath("/assistencial");
  revalidatePath(`/assistencial/${modulo}`);
  redirect(asRoute(`/assistencial/${modulo}?sucesso=registrado`));
}
