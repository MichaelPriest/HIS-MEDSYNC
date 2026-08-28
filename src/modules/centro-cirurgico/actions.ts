"use server";

import { redirect } from "next/navigation";
import { getAssistencialContext } from "@/modules/assistencial/context";

const base = "/assistencial/centro-cirurgico";
const txt = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();
const nullable = (value: string) => value || null;
const checked = (fd: FormData, key: string) => fd.get(key) === "on";
const numberOrNull = (value: string) => {
  if (value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};
const lines = (value: string) => value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
const go = (query: string, path = base): never => redirect(`${path}?${query}` as never);
const saoPauloTimestamp = (value: string) => {
  const normalized = value.length === 16 ? `${value}:00` : value;
  return `${normalized}-03:00`;
};

function rpcError(message: string | undefined, path = base): never {
  return go(`erro=${encodeURIComponent(message || "Não foi possível concluir a operação")}`, path);
}

export async function agendarCirurgia(formData: FormData) {
  const { supabase } = await getAssistencialContext();
  const atendimentoId = txt(formData, "atendimento_id");
  const procedimento = txt(formData, "procedimento");
  const inicioPrevisto = txt(formData, "inicio_previsto");
  const tipoInternacaoAnsCodigo = txt(formData, "tipo_internacao_ans_codigo");
  if (!atendimentoId || !procedimento || !inicioPrevisto || !tipoInternacaoAnsCodigo) return go("erro=campos-obrigatorios");

  const { error: classificacaoError } = await supabase.rpc("centro_cirurgico_classificar_internacao_ans", {
    p_atendimento_id: atendimentoId,
    p_codigo: tipoInternacaoAnsCodigo,
  });
  if (classificacaoError) return rpcError(classificacaoError.message);

  const { data: cirurgiaId, error } = await supabase.rpc("centro_cirurgico_agendar_operacional", {
    p_atendimento_id: atendimentoId,
    p_cirurgia_id: nullable(txt(formData, "cirurgia_id")),
    p_procedimento: procedimento,
    p_codigo_tuss: nullable(txt(formData, "codigo_tuss")),
    p_cirurgia: nullable(txt(formData, "cirurgia")),
    p_lateralidade: nullable(txt(formData, "lateralidade")),
    p_sala: nullable(txt(formData, "sala")),
    p_classificacao: nullable(txt(formData, "classificacao")),
    p_porte: nullable(txt(formData, "porte")),
    p_inicio_previsto: saoPauloTimestamp(inicioPrevisto),
    p_cirurgiao_id: nullable(txt(formData, "cirurgiao_id")),
    p_anestesista_id: nullable(txt(formData, "anestesista_id")),
    p_diagnostico_pre: nullable(txt(formData, "diagnostico_pre")),
  });
  if (error) return rpcError(error.message);
  const adicionaisContratuais = (() => {
    try {
      const parsed: unknown = JSON.parse(txt(formData, "procedimentos_adicionais") || "[]");
      return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string" && Boolean(id)) : [];
    } catch { return []; }
  })();
  const adicionaisLivres = lines(txt(formData, "procedimentos_adicionais_livres"));
  for (const tabelaItemId of adicionaisContratuais) {
    const { error: additionalError } = await supabase.rpc("centro_cirurgico_adicionar_procedimento_operacional", {
      p_cirurgia_id: cirurgiaId,
      p_tabela_item_id: tabelaItemId,
      p_codigo: null,p_descricao: null,p_porte: null,p_porte_anestesico: null,p_observacoes: null,
    });
    if (additionalError) return rpcError(additionalError.message);
  }
  for (const descricao of adicionaisLivres) {
    const { error: additionalError } = await supabase.rpc("centro_cirurgico_adicionar_procedimento_operacional", {
      p_cirurgia_id: cirurgiaId,
      p_tabela_item_id: null,p_codigo: null,p_descricao: descricao,p_porte: null,p_porte_anestesico: null,p_observacoes: null,
    });
    if (additionalError) return rpcError(additionalError.message);
  }
  return go("sucesso=agendamento");
}

export async function transicionarCirurgia(formData: FormData) {
  const { supabase } = await getAssistencialContext();
  const cirurgiaId = txt(formData, "cirurgia_id");
  const novoStatus = txt(formData, "novo_status");
  if (!cirurgiaId || !novoStatus) return go("erro=transicao-invalida");

  const { error } = await supabase.rpc("centro_cirurgico_transicionar_operacional", {
    p_cirurgia_id: cirurgiaId,
    p_novo_status: novoStatus,
    p_observacoes: nullable(txt(formData, "observacoes")),
  });
  if (error) return rpcError(error.message);
  return go(`sucesso=status&cirurgia=${encodeURIComponent(cirurgiaId)}`);
}

const checklistKeys: Record<string, string[]> = {
  entrada: ["identidade", "procedimento", "lateralidade", "consentimento", "jejum", "alergias"],
  pausa: ["equipe", "procedimento_confirmado", "antibiotico", "equipamentos", "esterilidade"],
  saida: ["contagem", "amostras", "opme", "intercorrencias", "destino"],
};

export async function salvarChecklistCirurgico(formData: FormData) {
  const { supabase } = await getAssistencialContext();
  const cirurgiaId = txt(formData, "cirurgia_id");
  const etapa = txt(formData, "etapa").toLowerCase();
  const keys = checklistKeys[etapa];
  if (!cirurgiaId || !keys) return go("erro=checklist-invalido");

  const itens = Object.fromEntries(keys.map((key) => [key, checked(formData, key)]));
  const { error } = await supabase.rpc("centro_cirurgico_salvar_checklist_operacional", {
    p_cirurgia_id: cirurgiaId,
    p_etapa: etapa,
    p_itens: itens,
    p_concluido: checked(formData, "concluido"),
    p_observacoes: nullable(txt(formData, "observacoes")),
  });
  if (error) return rpcError(error.message);
  return go(`sucesso=checklist&cirurgia=${encodeURIComponent(cirurgiaId)}`);
}

export async function salvarAnestesia(formData: FormData) {
  const { supabase } = await getAssistencialContext();
  const cirurgiaId = txt(formData, "cirurgia_id");
  if (!cirurgiaId) return go("erro=cirurgia");

  const monitorizacao = {
    ecg: checked(formData, "monitor_ecg"),
    spo2: checked(formData, "monitor_spo2"),
    pressao: checked(formData, "monitor_pressao"),
    capnografia: checked(formData, "monitor_capnografia"),
    temperatura: checked(formData, "monitor_temperatura"),
  };
  const medicamentos = lines(txt(formData, "medicamentos")).map((descricao) => ({ descricao }));
  const fluidos = lines(txt(formData, "fluidos")).map((descricao) => ({ descricao }));
  const eventos = lines(txt(formData, "eventos")).map((descricao) => ({ descricao }));

  const { error } = await supabase.rpc("centro_cirurgico_salvar_anestesia_operacional", {
    p_cirurgia_id: cirurgiaId,
    p_tecnicas: formData.getAll("tecnicas").map(String).filter(Boolean),
    p_asa: nullable(txt(formData, "asa")),
    p_via_aerea: nullable(txt(formData, "via_aerea")),
    p_monitorizacao: monitorizacao,
    p_medicamentos: medicamentos,
    p_fluidos: fluidos,
    p_eventos: eventos,
    p_iniciar: checked(formData, "iniciar"),
    p_finalizar: checked(formData, "finalizar"),
    p_observacoes: nullable(txt(formData, "observacoes")),
  });
  if (error) return rpcError(error.message);
  return go(`sucesso=anestesia&cirurgia=${encodeURIComponent(cirurgiaId)}`);
}

export async function salvarRpa(formData: FormData) {
  const { supabase } = await getAssistencialContext();
  const cirurgiaId = txt(formData, "cirurgia_id");
  if (!cirurgiaId) return go("erro=cirurgia");

  const sinaisVitais = {
    pa: nullable(txt(formData, "pa")),
    fc: numberOrNull(txt(formData, "fc")),
    spo2: numberOrNull(txt(formData, "spo2")),
    temperatura: numberOrNull(txt(formData, "temperatura")),
  };
  const { error } = await supabase.rpc("centro_cirurgico_salvar_rpa_operacional", {
    p_cirurgia_id: cirurgiaId,
    p_aldrete_entrada: numberOrNull(txt(formData, "aldrete_entrada")),
    p_aldrete_alta: numberOrNull(txt(formData, "aldrete_alta")),
    p_dor: numberOrNull(txt(formData, "dor")),
    p_nauseas: checked(formData, "nauseas"),
    p_sinais_vitais: sinaisVitais,
    p_intercorrencias: nullable(txt(formData, "intercorrencias")),
    p_destino: nullable(txt(formData, "destino")),
    p_alta: checked(formData, "alta"),
  });
  if (error) return rpcError(error.message);
  return go(`sucesso=rpa&cirurgia=${encodeURIComponent(cirurgiaId)}`);
}

export async function movimentarPosOperatorioParaAla(formData: FormData) {
  const { supabase } = await getAssistencialContext();
  const cirurgiaId = txt(formData, "cirurgia_id");
  const leitoId = txt(formData, "leito_id");
  if (!cirurgiaId || !leitoId) return go("erro=movimentacao-ala-campos");
  const { error } = await supabase.rpc("centro_cirurgico_movimentar_para_ala_operacional", {
    p_cirurgia_id: cirurgiaId,
    p_leito_destino_id: leitoId,
    p_motivo: nullable(txt(formData, "motivo")),
  });
  if (error) return rpcError(error.message);
  return go(`sucesso=movimentacao-ala&cirurgia=${encodeURIComponent(cirurgiaId)}`);
}

export async function registrarOpme(formData: FormData) {
  const { supabase } = await getAssistencialContext();
  const cirurgiaId = txt(formData, "cirurgia_id");
  const item = txt(formData, "item");
  const quantidade = numberOrNull(txt(formData, "quantidade") || "1");
  if (!cirurgiaId || !item || !quantidade || quantidade <= 0) return go("erro=opme-campos");

  const { error } = await supabase.rpc("centro_cirurgico_registrar_opme_operacional", {
    p_cirurgia_id: cirurgiaId,
    p_item: item,
    p_codigo: nullable(txt(formData, "codigo")),
    p_fabricante: nullable(txt(formData, "fabricante")),
    p_lote: nullable(txt(formData, "lote")),
    p_serie: nullable(txt(formData, "serie")),
    p_registro_anvisa: nullable(txt(formData, "registro_anvisa")),
    p_quantidade: quantidade,
    p_status: txt(formData, "status") || "previsto",
    p_observacoes: nullable(txt(formData, "observacoes")),
  });
  if (error) return rpcError(error.message);
  return go(`sucesso=opme&cirurgia=${encodeURIComponent(cirurgiaId)}`);
}

export async function salvarCicloCme(formData: FormData) {
  const { supabase, empresaId, unidadeId } = await getAssistencialContext();
  const path = `${base}/cme`;
  const liberar = checked(formData, "liberar");
  const resultado = txt(formData, "resultado");
  const indicadores = {
    quimico: checked(formData, "indicador_quimico"),
    biologico: checked(formData, "indicador_biologico"),
    fisico: checked(formData, "indicador_fisico"),
    observacao: nullable(txt(formData, "indicador_observacao")),
  };
  if (liberar && !resultado) return go("erro=liberacao-exige-resultado", path);
  if (liberar && !indicadores.quimico && !indicadores.biologico && !indicadores.fisico) return go("erro=liberacao-exige-indicador", path);

  const { error } = await supabase.rpc("cme_salvar_ciclo_operacional", {
    p_empresa_id: empresaId,
    p_unidade_id: unidadeId,
    p_ciclo_id: nullable(txt(formData, "ciclo_id")),
    p_codigo_ciclo: nullable(txt(formData, "codigo_ciclo")),
    p_equipamento: nullable(txt(formData, "equipamento")),
    p_metodo: nullable(txt(formData, "metodo")),
    p_carga: nullable(txt(formData, "carga")),
    p_indicadores: indicadores,
    p_resultado: nullable(resultado),
    p_status: txt(formData, "status") || "em_processamento",
    p_observacoes: nullable(txt(formData, "observacoes")),
    p_liberar: liberar,
  });
  if (error) return rpcError(error.message, path);
  return go("sucesso=ciclo", path);
}

export async function vincularCicloCme(formData: FormData) {
  const { supabase } = await getAssistencialContext();
  const cirurgiaId = txt(formData, "cirurgia_id");
  const cicloId = txt(formData, "ciclo_id");
  if (!cirurgiaId || !cicloId) return go("erro=cme-vinculo");

  const { error } = await supabase.rpc("centro_cirurgico_vincular_ciclo_cme_operacional", {
    p_cirurgia_id: cirurgiaId,
    p_ciclo_id: cicloId,
    p_observacoes: nullable(txt(formData, "observacoes")),
  });
  if (error) return rpcError(error.message);
  return go(`sucesso=cme-vinculado&cirurgia=${encodeURIComponent(cirurgiaId)}`);
}
