import Link from "next/link";
import type { Route } from "next";
import { Cable, Landmark, MonitorCog } from "lucide-react";
import { SectionPage } from "@/components/painel/section-page";

const itens = [
  { href: "/configuracoes/paineis", title: "Painéis e chamadas", description: "Painéis, filas, setores de chamada e terminais públicos.", icon: MonitorCog },
  { href: "/configuracoes/tiss-webservices", title: "Integrações TISS", description: "Parâmetros de comunicação e integração com operadoras.", icon: Cable },
  { href: "/configuracoes/nfse", title: "Prefeituras / NFS-e", description: "Parâmetros fiscais e emissão por unidade.", icon: Landmark },
] as const;

export default function ConfiguracoesPage() {
  return (
    <SectionPage eyebrow="Administração" title="Configurações do sistema" description="Centralize integrações e parâmetros técnicos fora da operação diária.">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {itens.map(({ href, title, description, icon: Icon }) => (
          <Link key={href} href={href as Route} className="group his-card p-5 transition hover:-translate-y-0.5">
            <span className="grid size-11 place-items-center rounded-2xl bg-brand-50 text-brand-700"><Icon className="size-5" /></span>
            <h2 className="mt-4 text-base font-black text-slate-950">{title}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">{description}</p>
            <span className="mt-4 inline-flex text-xs font-black text-brand-600 transition group-hover:translate-x-1">Configurar →</span>
          </Link>
        ))}
      </section>
    </SectionPage>
  );
}
