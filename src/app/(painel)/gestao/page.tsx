import Link from "next/link";
import type { Route } from "next";
import { Boxes, Handshake, ShieldCheck, ShoppingCart } from "lucide-react";
import { SectionPage } from "@/components/painel/section-page";

const modulos = [
  { href: "/compras", title: "Compras", description: "Solicitações, cotações, fornecedores, pedidos e recebimento.", icon: ShoppingCart },
  { href: "/almoxarifado", title: "Estoque e almoxarifado", description: "Entradas, saídas, saldos, lotes e movimentações de materiais.", icon: Boxes },
  { href: "/comercial", title: "Comercial e credenciamento", description: "Contratos, tabelas, regras comerciais e relacionamento com operadoras.", icon: Handshake },
  { href: "/auditoria", title: "Auditoria de contas", description: "Críticas, conferência, rastreabilidade e preparação para faturamento.", icon: ShieldCheck },
] as const;

export default function GestaoPage() {
  return (
    <SectionPage eyebrow="Administração" title="Gestão e suprimentos" description="Agrupe processos administrativos e de abastecimento sem misturar a operação clínica com rotinas corporativas.">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {modulos.map(({ href, title, description, icon: Icon }) => (
          <Link key={href} href={href as Route} className="group his-card p-5 transition hover:-translate-y-0.5">
            <span className="grid size-11 place-items-center rounded-2xl bg-brand-50 text-brand-700"><Icon className="size-5" /></span>
            <h2 className="mt-4 text-base font-black text-slate-950">{title}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">{description}</p>
            <span className="mt-4 inline-flex text-xs font-black text-brand-600 transition group-hover:translate-x-1">Abrir gestão →</span>
          </Link>
        ))}
      </section>
    </SectionPage>
  );
}
