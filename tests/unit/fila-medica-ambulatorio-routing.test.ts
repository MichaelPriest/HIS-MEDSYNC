import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(process.cwd(), "supabase/migrations/20260902223056_fix_ambulatorio_fila_medica_profissional.sql"),
  "utf8",
);

describe("fila médica do ambulatório", () => {
  it("usa a especialidade canônica do profissional já atribuído ao atendimento", () => {
    expect(migration).toContain("v_atendimento.profissional_id is not null");
    expect(migration).toContain("from public.profissionais p");
    expect(migration).toContain("v_especialidade_destino");
    expect(migration).toContain("v_especialidade_destino, 'aguardando_profissional'");
  });

  it("reconcilia somente filas ainda aguardando e com contexto ambulatorial", () => {
    expect(migration).toContain("e.status = 'aguardando_profissional'");
    expect(migration).toContain("p.id = a.profissional_id");
    expect(migration).toContain("like '%consult%'");
    expect(migration).toContain("in ('agenda', 'agendamento', 'checkin', 'check-in')");
  });

  it("não cria pacientes, atendimentos ou profissionais artificiais", () => {
    expect(migration).not.toMatch(/insert\s+into\s+public\.(pacientes|atendimentos|profissionais)/i);
  });
});
