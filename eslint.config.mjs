import { FlatCompat } from "@eslint/eslintrc";
import path from "node:path";
import { fileURLToPath } from "node:url";

const compat = new FlatCompat({
  baseDirectory: path.dirname(fileURLToPath(import.meta.url)),
});

const assistencialSupabaseSemTiposGerados = [
  "src/app/(painel)/assistencial/imagem/page.tsx",
  "src/app/(painel)/assistencial/laboratorio/page.tsx",
  "src/app/(painel)/assistencial/medicamentos/page.tsx",
  "src/app/(painel)/assistencial/sae/page.tsx",
  "src/app/(painel)/internacao/page.tsx",
  "src/modules/assistencial/imagem-actions.ts",
  "src/modules/assistencial/laboratorio-actions.ts",
  "src/modules/internacao/actions.ts",
];

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  { ignores: [".next/**", "node_modules/**", "playwright-report/**"] },
  {
    // Compatibilidade temporária e restrita aos módulos novos que ainda usam
    // joins relacionais do Supabase sem Database types gerados no projeto.
    files: assistencialSupabaseSemTiposGerados,
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
  {
    // Estes painéis usam links de recarga do próprio módulo; manter a exceção
    // local até a próxima refatoração para componentes Link tipados.
    files: [
      "src/app/(painel)/assistencial/laboratorio/page.tsx",
      "src/app/(painel)/internacao/page.tsx",
    ],
    rules: {
      "@next/next/no-html-link-for-pages": "off",
    },
  },
];

export default eslintConfig;
