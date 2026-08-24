import { HeartPulse, LockKeyhole, ShieldCheck } from "lucide-react";
import { brand } from "@/config/brand";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="grid min-h-screen bg-[#f4f7fb] lg:grid-cols-[1.05fr_.95fr]">
      <section className="relative hidden overflow-hidden bg-[linear-gradient(145deg,#07162f_0%,#0b1f44_48%,#173273_100%)] p-12 text-white lg:flex lg:flex-col lg:justify-between xl:p-16">
        <div className="pointer-events-none absolute -left-24 -top-24 size-96 rounded-full bg-blue-500/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-28 right-0 size-80 rounded-full bg-cyan-400/15 blur-3xl" />

        <div className="relative flex items-center gap-3.5">
          <span className="grid size-12 place-items-center rounded-2xl bg-gradient-to-br from-cyan-400 to-blue-500 shadow-xl shadow-blue-950/30"><HeartPulse className="size-6" /></span>
          <div><strong className="block text-xl font-bold tracking-tight">{brand.name}</strong><span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-100/45">Hospital Information System</span></div>
        </div>

        <div className="relative max-w-xl">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-cyan-300/70">Tecnologia para o cuidado</p>
          <h1 className="mt-4 text-4xl font-bold leading-tight tracking-tight xl:text-5xl">Informação segura para uma operação hospitalar mais inteligente.</h1>
          <p className="mt-5 max-w-lg text-base leading-7 text-blue-100/65">Assistência, recepção, faturamento, auditoria e gestão integrados em uma experiência única.</p>
          <div className="mt-8 grid max-w-lg grid-cols-2 gap-3">
            <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-4 backdrop-blur"><ShieldCheck className="size-5 text-cyan-300" /><p className="mt-3 text-sm font-semibold">Acesso protegido</p><p className="mt-1 text-xs leading-5 text-white/45">Perfis, escopo e RLS por empresa e unidade.</p></div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-4 backdrop-blur"><LockKeyhole className="size-5 text-cyan-300" /><p className="mt-3 text-sm font-semibold">Ambiente auditado</p><p className="mt-1 text-xs leading-5 text-white/45">Operações rastreáveis e dados centralizados.</p></div>
          </div>
        </div>

        <small className="relative text-xs text-white/35">MedSync · Ambiente institucional seguro</small>
      </section>

      <section className="flex items-center justify-center p-5 sm:p-8 lg:p-12">
        <div className="w-full max-w-md">{children}</div>
      </section>
    </main>
  );
}
