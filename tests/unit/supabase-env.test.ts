import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  getSupabasePublicEnv,
  readSupabasePublicEnv,
  SupabaseConfigurationError,
} from "@/lib/supabase/env";

const variableNames = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PROJECT_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
] as const;
const originalEnvironment = Object.fromEntries(
  variableNames.map((name) => [name, process.env[name]]),
);

beforeEach(() => {
  variableNames.forEach((name) => delete process.env[name]);
});

afterEach(() => {
  variableNames.forEach((name) => {
    const originalValue = originalEnvironment[name];
    if (originalValue === undefined) {
      delete process.env[name];
    } else {
      process.env[name] = originalValue;
    }
  });
});

describe("configuração pública do Supabase", () => {
  it("retorna null sem lançar quando a configuração está ausente", () => {
    expect(readSupabasePublicEnv()).toBeNull();
  });

  it("mantém falha explícita fora da borda do middleware", () => {
    expect(() => getSupabasePublicEnv()).toThrow(SupabaseConfigurationError);
  });

  it("normaliza espaços da configuração preferencial", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = " https://teste.supabase.co ";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY =
      " sb_publishable_teste_seguro ";

    expect(readSupabasePublicEnv()).toEqual({
      NEXT_PUBLIC_SUPABASE_URL: "https://teste.supabase.co",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_teste_seguro",
    });
  });

  it("aceita os nomes criados pela integração e projetos legados", () => {
    process.env.NEXT_PUBLIC_SUPABASE_PROJECT_URL =
      "https://integracao.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon_key_ficticia_valida";

    expect(readSupabasePublicEnv()).toEqual({
      NEXT_PUBLIC_SUPABASE_URL: "https://integracao.supabase.co",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "anon_key_ficticia_valida",
    });
  });

  it("prioriza a chave publicável atual", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://teste.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "chave_publicavel_atual";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "chave_anon_legada";

    expect(readSupabasePublicEnv()?.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY).toBe(
      "chave_publicavel_atual",
    );
  });
});
