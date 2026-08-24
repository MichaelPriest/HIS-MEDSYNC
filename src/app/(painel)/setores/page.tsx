import Link from "next/link";
import type { Route } from "next";
import { Activity, BedDouble, FlaskConical, Pill, ScanLine } from "lucide-react";
import { SectionPage } from "@/components/painel/section-page";

const setores = [
  { href: "/setores/enfermagem", title: "Enfermagem", description: "Fila assistencial e atividades da equipe de enfermagem.", icon: Activity },
  { href: "/setores/farmacia", title: "Farmácia", description: "Pendências de validação, dispensação e atendimento farmacêutico.", icon: Pill },
  { href: "/setores/laboratorio", title: "Laboratório", description: "Solicitações e pacientes aguardando coleta ou processamento.", icon: FlaskConical },
  { href: "/setores/imagem", title: "Imagem", description: "Fila de exames, execução e acompanhamento do diagnóstico por imagem.", icon: ScanLine },
  { href: "/setores/internacao", title: "Internação", description: "Pacientes aguardando admissão, leito ou movimentação hospitalar.", icon: BedDouble },
] as const;

export default function SetoresPage() {
  return (
    <SectionPage eyebrow="Assistencial" title="Filas por setor" description="Acesse as filas operacionais por área sem ocupar o menu principal com vários atalhos separados.">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {setores.map(({ href, title, description, icon: Icon }) => (
          <Link key={href} href={href as Route} className="group his-card p-5 transition hover:-translate-y-0.5">
            <span className="grid size-11 place-items-center rounded-2xl bg-brand-50 text-brand-700"><Icon className="size-5" /></span>
            <h2 className="mt-4 text-base font-black text-slate-950">{title}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">{description}</p>
            <span className="mt-4 inline-flex text-xs font-black text-brand-600 transition group-hover:translate-x-1">Abrir fila →</span>
          </Link>
        ))}
      </section>
    </SectionPage>
  );
}
