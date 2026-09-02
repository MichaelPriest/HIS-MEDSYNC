function normalizar(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function codigo(value: string | null | undefined) {
  return normalizar(value)
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

const ESPECIALIDADES_EQUIVALENTES: Record<string, string> = {
  clinica_geral: "clinica_medica",
  clinica_medica: "clinica_medica",
  clinico_geral: "clinica_medica",
  medico_clinico: "clinica_medica",
  medico_clinico_geral: "clinica_medica",
  medico_generalista: "clinica_medica",
  medicina_clinica: "clinica_medica",
  medicina_interna: "clinica_medica",
};

function especialidadeCanonica(value: string | null | undefined) {
  const key = codigo(value);
  return ESPECIALIDADES_EQUIVALENTES[key] ?? key;
}

export function especialidadesCompativeis(
  especialidadeProfissional: string | null | undefined,
  especialidadeFila: string | null | undefined,
) {
  const profissional = normalizar(especialidadeProfissional);
  const fila = normalizar(especialidadeFila);
  if (!profissional || !fila) return false;

  // Preserva a regra histórica para descrições já equivalentes por inclusão.
  if (profissional.includes(fila) || fila.includes(profissional)) return true;

  const profissionalCanonico = especialidadeCanonica(especialidadeProfissional);
  const filaCanonica = especialidadeCanonica(especialidadeFila);
  return Boolean(
    profissionalCanonico
      && filaCanonica
      && (
        profissionalCanonico === filaCanonica
        || profissionalCanonico.includes(filaCanonica)
        || filaCanonica.includes(profissionalCanonico)
      )
  );
}
