import Link from "next/link";
import type { Route } from "next";
import { BookOpenCheck, Building2, Stethoscope, UsersRound } from "lucide-react";
import { SectionPage } from "@/components/painel/section-page";

const cadastros = [
  { href: "/pacientes", title: "Pacientes", description: "Identificação, documentos, contatos, convênio e registro permanente.", icon: UsersRound },
  { href: "/profissionais", title: "Profissionais", description: "Equipe assistencial, conselho, especialidade, CBO e vínculo de usuário.", icon: Stethoscope },
  { href: "/convenios", title: "Convênios e planos", description: "Operadoras, planos, regras contratuais e dados de cobrança.", icon: Building2 },
  { href: "/catalogos", title: "Catálogos", description: "Especialidades, tipos profissionais, procedimentos e referências do sistema.", icon: BookOpenCheck },
] as const;

export default function CadastrosPage() {
  return (
    <SectionPage eyebrow="Administração" title="Cadastros essenciais" description="Um único ponto de entrada para os cadastros mestres usados em toda a operação hospitalar.">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {cadastros.map(({ href, title, description, icon: Icon }) => (
          <Link key={href} href={href as Route} className="group his-card p-5 transition hover:-translate-y-0.5">
            <span className="grid size-11 place-items-center rounded-2xl bg-brand-50 text-brand-700"><Icon className="size-5" /></span>
            <h2 className="mt-4 text-base font-black text-slate-950">{title}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">{description}</p>
            <span className="mt-4 inline-flex text-xs font-black text-brand-600 transition group-hover:translate-x-1">Gerenciar →</span>
          </Link>
        ))}
      </section>
    </SectionPage>
  );
}
