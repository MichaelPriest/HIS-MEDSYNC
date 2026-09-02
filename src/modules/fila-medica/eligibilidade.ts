export type ElegibilidadeFilaMedica = {
  profissionalId: string;
  profissionalEspecialidade?: string | null;
  atendimentoProfissionalId?: string | null;
  encaminhamentoProfissionalId?: string | null;
  especialidadeFila?: string | null;
};

function normalizar(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function chaveEspecialidade(value: string | null | undefined) {
  const normalized = normalizar(value);

  const aliases: Array<[RegExp, string]> = [
    [/^(medico )?clinico( geral)?$|^clinica medica$|^medicina interna$/, "clinica_medica"],
    [/^(medico )?pediatra$|^pediatria$/, "pediatria"],
    [/^(medico )?cardiologista$|^cardiologia$/, "cardiologia"],
    [/^(medico )?neurologista$|^neurologia$/, "neurologia"],
    [/^(medico )?ginecologista( e obstetra)?$|^ginecologia( e obstetricia)?$|^obstetricia$/, "ginecologia_obstetricia"],
    [/^(medico )?ortopedista( e traumatologista)?$|^ortopedia( e traumatologia)?$/, "ortopedia_traumatologia"],
    [/^(medico )?psiquiatra$|^psiquiatria$/, "psiquiatria"],
    [/^(medico )?dermatologista$|^dermatologia$/, "dermatologia"],
    [/^(medico )?urologista$|^urologia$/, "urologia"],
    [/^(medico )?oftalmologista$|^oftalmologia$/, "oftalmologia"],
    [/^(medico )?otorrinolaringologista$|^otorrinolaringologia$/, "otorrinolaringologia"],
  ];

  for (const [pattern, key] of aliases) {
    if (pattern.test(normalized)) return key;
  }

  return normalized.replace(/\s+/g, "_");
}

export function especialidadesCompativeis(
  profissionalEspecialidade: string | null | undefined,
  especialidadeFila: string | null | undefined,
) {
  const profissional = chaveEspecialidade(profissionalEspecialidade);
  const fila = chaveEspecialidade(especialidadeFila);
  if (!profissional || !fila) return false;
  return profissional === fila || profissional.includes(fila) || fila.includes(profissional);
}

export function podeAtenderItemFila({
  profissionalId,
  profissionalEspecialidade,
  atendimentoProfissionalId,
  encaminhamentoProfissionalId,
  especialidadeFila,
}: ElegibilidadeFilaMedica) {
  if (atendimentoProfissionalId) return atendimentoProfissionalId === profissionalId;
  if (encaminhamentoProfissionalId) return encaminhamentoProfissionalId === profissionalId;
  return especialidadesCompativeis(profissionalEspecialidade, especialidadeFila);
}
