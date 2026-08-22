import { z } from "zod";

const supabaseUrlSchema = z.string().trim().url();
const supabaseKeySchema = z.string().trim().min(10);

type SupabasePublicEnv = {
  NEXT_PUBLIC_SUPABASE_URL: string;
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: string;
};

export class SupabaseConfigurationError extends Error {
  constructor() {
    super("A configuração pública do Supabase está ausente ou é inválida.");
    this.name = "SupabaseConfigurationError";
  }
}

function firstConfigured(...values: Array<string | undefined>) {
  return values.find((value) => value?.trim());
}

export function readSupabasePublicEnv(): SupabasePublicEnv | null {
  const url = supabaseUrlSchema.safeParse(
    firstConfigured(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_PROJECT_URL,
    ),
  );
  const key = supabaseKeySchema.safeParse(
    firstConfigured(
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    ),
  );

  if (!url.success || !key.success) {
    return null;
  }

  return {
    NEXT_PUBLIC_SUPABASE_URL: url.data,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: key.data,
  };
}

export function getSupabasePublicEnv(): SupabasePublicEnv {
  const env = readSupabasePublicEnv();

  if (!env) {
    throw new SupabaseConfigurationError();
  }

  return env;
}
