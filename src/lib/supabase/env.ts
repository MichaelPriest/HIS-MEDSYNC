import { z } from "zod";

const publicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(10),
});

type SupabasePublicEnv = z.infer<typeof publicEnvSchema>;

export class SupabaseConfigurationError extends Error {
  constructor() {
    super("A configuração pública do Supabase está ausente ou é inválida.");
    this.name = "SupabaseConfigurationError";
  }
}

export function readSupabasePublicEnv(): SupabasePublicEnv | null {
  const result = publicEnvSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  });

  return result.success ? result.data : null;
}

export function getSupabasePublicEnv(): SupabasePublicEnv {
  const env = readSupabasePublicEnv();

  if (!env) {
    throw new SupabaseConfigurationError();
  }

  return env;
}
