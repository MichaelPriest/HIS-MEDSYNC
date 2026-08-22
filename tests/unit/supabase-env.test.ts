import { afterEach, describe, expect, it } from "vitest";
import {
  getSupabasePublicEnv,
  readSupabasePublicEnv,
  SupabaseConfigurationError,
} from "@/lib/supabase/env";

const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const originalKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

afterEach(() => {
  if (originalUrl === undefined) {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  } else {
    process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl;
  }

  if (originalKey === undefined) {
    delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  } else {
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = originalKey;
  }
});

describe("configuração pública do Supabase", () => {
  it("retorna null sem lançar quando a configuração está ausente", () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

    expect(readSupabasePublicEnv()).toBeNull();
  });

  it("mantém falha explícita fora da borda do middleware", () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

    expect(() => getSupabasePublicEnv()).toThrow(SupabaseConfigurationError);
  });

  it("aceita configuração válida", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://teste.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY =
      "sb_publishable_teste_seguro";

    expect(readSupabasePublicEnv()).toEqual({
      NEXT_PUBLIC_SUPABASE_URL: "https://teste.supabase.co",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_teste_seguro",
    });
  });
});
