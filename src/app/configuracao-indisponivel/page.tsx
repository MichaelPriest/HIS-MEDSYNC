import type { Metadata } from "next";
import { brand } from "@/config/brand";

export const metadata: Metadata = {
  title: "Configuração indisponível",
};

export default function ConfigurationUnavailablePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <section
        aria-labelledby="configuration-title"
        className="w-full max-w-xl rounded-xl border border-amber-200 bg-white p-8 shadow-sm"
      >
        <p className="text-sm font-semibold uppercase tracking-wide text-amber-700">
          Serviço temporariamente indisponível
        </p>
        <h1 id="configuration-title" className="mt-2 text-2xl font-semibold">
          Não foi possível iniciar o {brand.shortName}
        </h1>
        <p className="mt-4 text-slate-700">
          A configuração segura de autenticação deste ambiente ainda não está
          disponível. Nenhum dado hospitalar foi acessado.
        </p>
        <p className="mt-3 text-sm text-slate-600">
          Se você administra o sistema, revise as variáveis públicas do Supabase
          no ambiente de implantação e publique novamente. Não envie chaves por
          canais de suporte ou pelo navegador.
        </p>
      </section>
    </main>
  );
}
