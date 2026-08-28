import { describe, expect, it } from "vitest";
import { buildInternacaoAdmissionRpcParams } from "@/modules/internacao/admission";

describe("admissão transacional de internação", () => {
  it("normaliza as duas entradas da UI para o mesmo contrato RPC", () => {
    expect(buildInternacaoAdmissionRpcParams({
      atendimentoId: " atendimento-1 ",
      setor: " Clínica Médica ",
      profissionalResponsavelId: " profissional-1 ",
      leitoId: " ",
      acomodacao: " apartamento ",
      acomodacaoTuss49Codigo: " 13 ",
      motivo: " indicação clínica ",
      previsaoAlta: " 2026-08-30 ",
      observacoes: " observação ",
    })).toEqual({
      p_atendimento_id: "atendimento-1",
      p_setor: "Clínica Médica",
      p_profissional_responsavel_id: "profissional-1",
      p_leito_id: null,
      p_acomodacao: "apartamento",
      p_acomodacao_tuss49_codigo: "13",
      p_motivo: "indicação clínica",
      p_previsao_alta: "2026-08-30",
      p_observacoes: "observação",
    });
  });

  it("não permite montar o RPC sem atendimento e setor", () => {
    expect(() => buildInternacaoAdmissionRpcParams({ atendimentoId: "", setor: "Clínica" })).toThrow("INTERNACAO_CAMPOS_OBRIGATORIOS");
    expect(() => buildInternacaoAdmissionRpcParams({ atendimentoId: "atendimento-1", setor: " " })).toThrow("INTERNACAO_CAMPOS_OBRIGATORIOS");
  });
});
