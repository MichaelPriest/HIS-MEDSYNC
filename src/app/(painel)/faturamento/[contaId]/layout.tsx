import Link from "next/link";
import type { Route } from "next";
import { ArrowLeft, ClipboardList, ListPlus, ReceiptText, Search, Stethoscope } from "lucide-react";

export default async function ContaLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ contaId: string }>;
}) {
  const { contaId } = await params;
  const links = [
    { href: `/faturamento/${contaId}` as Route, label: "Resumo da conta", detail: "Valores, críticas e liberações", icon: ReceiptText },
    { href: `/faturamento/${contaId}/lancamentos` as Route, label: "Lançamentos", detail: "Itens e produção faturável", icon: ListPlus },
    { href: `/faturamento/${contaId}/catalogo` as Route, label: "Catálogo", detail: "Procedimentos, materiais e taxas", icon: Search },
    { href: `/faturamento/${contaId}/procedimentos-cirurgicos` as Route, label: "Cirurgia / SADT", detail: "Equipe e procedimentos vinculados", icon: Stethoscope },
  ];

  return <>
    <div className="mx-auto w-full max-w-[1680px] px-4 pt-4 sm:px-6 lg:px-8">
      <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 px-1">
          <div className="flex items-center gap-2"><ClipboardList className="size-4 text-brand-700" /><span className="text-xs font-black uppercase tracking-[.14em] text-slate-500">Workspace da conta hospitalar</span></div>
          <Link href="/faturamento" className="inline-flex items-center gap-1 text-xs font-black text-slate-500 hover:text-brand-700"><ArrowLeft className="size-4" />Voltar à central</Link>
        </div>
        <nav className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4" aria-label="Etapas da conta hospitalar">
          {links.map(({ href, label, detail, icon: Icon }) => <Link key={href} href={href} className="group flex items-center gap-3 rounded-xl border border-slate-200 p-3 transition hover:border-brand-200 hover:bg-brand-50/40">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-700 transition group-hover:bg-brand-100 group-hover:text-brand-700"><Icon className="size-5" /></span>
            <span className="min-w-0"><strong className="block text-sm text-slate-900">{label}</strong><span className="mt-0.5 block truncate text-[11px] text-slate-500">{detail}</span></span>
          </Link>)}
        </nav>
      </section>
    </div>
    {children}
  </>;
}
