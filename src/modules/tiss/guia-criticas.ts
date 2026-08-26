export type TissGuiaSeveridade = "erro" | "alerta";

export type TissGuiaCritica = {
  codigo: string;
  severidade: TissGuiaSeveridade;
  campo: string | null;
  mensagem: string;
  item_id?: string | null;
};

export function resumirCriticas(criticas: readonly TissGuiaCritica[]) {
  const erros = criticas.filter((critica) => critica.severidade === "erro").length;
  const alertas = criticas.filter((critica) => critica.severidade === "alerta").length;
  return { erros, alertas, total: erros + alertas, semBloqueios: erros === 0 };
}

export function origemCriticaTiss(codigo: string) {
  if (codigo.includes("-AUT-")) return "Autorização";
  if (codigo.includes("-BEN-")) return "Beneficiário";
  if (codigo.includes("-PROF-") || codigo.includes("-CBO-") || codigo.includes("-CNES-")) return "Cadastro prestador";
  if (codigo.includes("-DOM-")) return "Domínio ANS / TUSS";
  if (codigo.includes("-ITEM-") || codigo.includes("-VAL-") || codigo.includes("-CONS-")) return "Faturamento";
  if (codigo.includes("-PLANO-")) return "Convênio / plano";
  return "Guia TISS";
}

export function acaoCriticaTiss(critica: Pick<TissGuiaCritica, "codigo" | "campo">) {
  const { codigo, campo } = critica;
  if (codigo.includes("-AUT-")) return "Revisar a autorização do atendimento, sincronizar guia/senha e revalidar.";
  if (codigo.includes("-BEN-")) return "Corrigir os dados do beneficiário, carteirinha ou validade na origem e revalidar.";
  if (codigo.includes("-PROF-") || codigo.includes("-CBO-")) return "Completar o cadastro do profissional executante e revalidar a guia.";
  if (codigo.includes("-CNES-")) return "Corrigir o CNES da unidade prestadora e revalidar a guia.";
  if (codigo.includes("-DOM-")) return "Selecionar um código válido do domínio ANS/TUSS aplicável e revalidar.";
  if (codigo.includes("-ITEM-") || codigo.includes("-CONS-")) return "Corrigir o item faturável na conta/guia e executar nova validação.";
  if (codigo.includes("-VAL-")) return "Recalcular os itens e conferir o valor total antes de revalidar.";
  if (codigo.includes("-PLANO-")) return "Revisar convênio e plano vinculados ao atendimento e revalidar.";
  if (codigo.includes("-VERSAO-")) return "Revisar a versão TISS aplicada à guia antes de continuar.";
  if (campo) return `Revisar o campo ${campo} e executar nova validação.`;
  return "Revisar os dados indicados e executar nova validação.";
}
