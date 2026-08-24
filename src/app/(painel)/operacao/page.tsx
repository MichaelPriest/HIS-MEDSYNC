import Link from "next/link";
import type { Route } from "next";
import { CalendarDays, ClipboardCheck, ClipboardList, HeartPulse, ShieldCheck, Stethoscope, TicketCheck } from "lucide-react";
import { SectionPage } from "@/components/painel/section-page";

const etapas = [
  { href: "/senhas", title: "Recepção e senhas", description: "Fila de chegada, chamada, identificação e início do atendimento.", icon: TicketCheck, step: "1" },
  { href: "/agenda", title: "Agenda", description: "Consultas, encaixes e organização da recepção programada.", icon: CalendarDays, step: "2" },
  { href: "/atendimentos", title: "Atendimento / ADT", description: "Admissão, dados do episódio, paciente e movimentação administrativa.", icon: ClipboardList, step: "3" },
  { href: "/central-guias", title: "Guias e autorizações", description: "Centralize guias, solicitações e acompanhamento junto ao convênio.", icon: ClipboardCheck, step: "4" },
  { href: "/autorizacoes", title: "Autorizações", description: "Controle de senhas, procedimentos e validade das autorizações.", icon: ShieldCheck, step: "5" },
  { href: "/triagem", title: "Triagem", description: "Sinais vitais, classificação e encaminhamento para a assistência.", icon: HeartPulse, step: "6" },
  { href: "/fila-medica", title: "Fila médica", description: "Próximos pacientes e acesso rápido ao atendimento clínico.", icon: Stethoscope, step: "7" },
] as const;

export default function OperacaoPage() {
  return (
    <SectionPage eyebrow="Operação" title="Recepção e jornada do paciente" description="Acompanhe o paciente desde a chegada até o encaminhamento clínico em uma sequência simples e previsível.">
      <section className="rounded-[24px] bg-[linear-gradient(120deg,#0b1f44_0%,#173273_60%,#2563eb_100%)] p-6 text-white shadow-his-float sm:p-7">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-200/70">Fluxo principal</p>
        <h2 className="mt-2 text-2xl font-black tracking-tight">Chegada → admissão → autorização → triagem → assistência</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-blue-100/70">Cada etapa abaixo abre a tela operacional correspondente. O usuário entra pelo fluxo, não por uma lista extensa de módulos.</p>
      </section>

      <section className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {etapas.map(({ href, title, description, icon: Icon, step }) => (
          <Link key={href} href={href as Route} className="group his-card p-5 transition hover:-translate-y-0.5">
            <div className="flex items-center justify-between gap-3">
              <span className="grid size-11 place-items-center rounded-2xl bg-brand-50 text-brand-700"><Icon className="size-5" /></span>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-slate-500">Etapa {step}</span>
            </div>
            <h2 className="mt-4 text-base font-black text-slate-950">{title}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">{description}</p>
            <span className="mt-4 inline-flex text-xs font-black text-brand-600 transition group-hover:translate-x-1">Abrir →</span>
          </Link>
        ))}
      </section>
    </SectionPage>
  );
}
