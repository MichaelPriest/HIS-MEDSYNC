import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { logout } from "@/modules/auth/actions";
import { brand } from "@/config/brand";

const navigation = [
  { href: "/painel", label: "Visão geral" },
  { href: "/pacientes", label: "Pacientes" },
  { href: "/profissionais", label: "Profissionais" },
  { href: "/convenios", label: "Convênios" },
  { href: "/catalogos", label: "Catálogos" },
];

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return (
    <div className="min-h-screen bg-slate-50 lg:grid lg:grid-cols-[17rem_1fr]">
      <aside className="bg-brand-950 p-5 text-white">
        <Link href="/painel" className="text-xl font-semibold">
          {brand.shortName}
        </Link>
        <p className="mt-1 text-xs text-white/60">Hospital Information System</p>
        <nav aria-label="Principal" className="mt-8 space-y-1">
          {navigation.map((item) => (
            <Link key={item.href} className="block rounded-lg px-3 py-2 text-sm text-white/85 transition hover:bg-white/10 hover:text-white" href={item.href}>
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="mt-8 border-t border-white/10 pt-5">
          <p className="px-3 text-xs font-semibold uppercase tracking-wide text-white/50">Próximos módulos</p>
          <div className="mt-2 space-y-1 px-3 text-sm text-white/45">
            <p>Atendimento / ADT</p>
            <p>Agenda e recepção</p>
            <p>Triagem</p>
            <p>Prontuário</p>
          </div>
        </div>
      </aside>
      <div className="min-w-0">
        <header className="flex min-h-16 items-center justify-between border-b bg-white px-6">
          <span className="text-sm text-slate-600">Unidade definida pelo vínculo ativo</span>
          <form action={logout}>
            <button className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700">Sair</button>
          </form>
        </header>
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}
