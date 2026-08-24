import Link from "next/link";
import { ArrowRight, KeyRound, Mail } from "lucide-react";
import { login } from "@/modules/auth/actions";

export default async function Login({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const { erro } = await searchParams;

  return (
    <div className="ui-page-enter rounded-[24px] border border-[#e4eaf2] bg-white p-6 shadow-his-float sm:p-8">
      <div>
        <p className="his-eyebrow">Acesso institucional</p>
        <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">Bem-vindo ao MedSync</h2>
        <p className="mt-2 text-sm leading-6 text-slate-500">Entre com sua conta autorizada para acessar o ambiente hospitalar.</p>
      </div>

      {erro ? <p role="alert" className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 p-3.5 text-sm font-medium text-rose-700">Não foi possível autenticar. Revise e-mail e senha.</p> : null}

      <form action={login} className="mt-7 space-y-4.5">
        <label className="block text-sm font-semibold text-slate-700">
          E-mail
          <span className="relative mt-2 block">
            <Mail className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <input name="email" type="email" autoComplete="username" required placeholder="nome@hospital.com.br" className="ui-input h-12 pl-10" />
          </span>
        </label>

        <label className="block text-sm font-semibold text-slate-700">
          Senha
          <span className="relative mt-2 block">
            <KeyRound className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <input name="senha" type="password" autoComplete="current-password" minLength={8} required placeholder="••••••••" className="ui-input h-12 pl-10" />
          </span>
        </label>

        <button className="ui-button-primary mt-2 h-12 w-full text-sm">
          Entrar no sistema
          <ArrowRight className="size-4" />
        </button>
      </form>

      <div className="mt-6 border-t border-slate-100 pt-5 text-center">
        <Link href="/recuperar-senha" className="text-sm font-semibold text-brand-600 hover:text-brand-700">Esqueci minha senha</Link>
      </div>
    </div>
  );
}
