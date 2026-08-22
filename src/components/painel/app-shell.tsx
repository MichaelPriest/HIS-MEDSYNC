"use client";

import Link from "next/link";
import type { Route } from "next";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Bell, BookOpenCheck, Building2, CalendarDays, ChevronDown, ChevronRight, ClipboardList, FolderCog, HeartPulse, LayoutDashboard, Menu, Search, ShieldCheck, Stethoscope, UserRound, UsersRound, X } from "lucide-react";
import { brand } from "@/config/brand";

const cadastroNav: Array<{ href: Route; label: string; icon: typeof UsersRound }> = [
  { href: "/pacientes", label: "Pacientes", icon: UsersRound },
  { href: "/profissionais", label: "Profissionais", icon: Stethoscope },
  { href: "/convenios", label: "Convênios", icon: Building2 },
  { href: "/catalogos", label: "Catálogos", icon: BookOpenCheck },
];
const assistencialNav: Array<{ href: Route; label: string; icon: typeof ClipboardList }> = [
  { href: "/atendimentos", label: "Atendimento / ADT", icon: ClipboardList },
  { href: "/agenda", label: "Agenda e recepção", icon: CalendarDays },
  { href: "/triagem", label: "Triagem", icon: HeartPulse },
  { href: "/prontuario", label: "Prontuário", icon: ShieldCheck },
];

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const cadastrosAtivo = cadastroNav.some((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));
  const [cadastrosOpen, setCadastrosOpen] = useState<boolean>(true);
  return <div className="flex h-full flex-col">
    <div className="border-b border-white/10 px-5 py-5"><Link href="/painel" onClick={onNavigate} className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-2xl bg-white text-brand-950 shadow-lg shadow-black/10"><HeartPulse className="size-5" /></span><span><strong className="block text-base font-semibold tracking-tight">{brand.shortName}</strong><span className="block text-[11px] uppercase tracking-[0.18em] text-white/45">Hospital Information System</span></span></Link></div>
    <div className="flex-1 overflow-y-auto px-3 py-5">
      <p className="px-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/35">Principal</p>
      <nav className="mt-3 space-y-1" aria-label="Principal">
        <Link href="/painel" onClick={onNavigate} className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${pathname === "/painel" ? "bg-white text-brand-950 shadow-sm" : "text-white/70 hover:bg-white/10 hover:text-white"}`}><LayoutDashboard className={`size-4.5 ${pathname === "/painel" ? "text-brand-700" : "text-white/45"}`} /><span>Visão geral</span></Link>
        <div className="pt-1"><button type="button" onClick={() => setCadastrosOpen((value) => !value)} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${cadastrosAtivo ? "bg-white/10 text-white" : "text-white/70 hover:bg-white/10 hover:text-white"}`}><FolderCog className="size-4.5 text-white/55" /><span>Cadastros</span>{cadastrosOpen ? <ChevronDown className="ml-auto size-4 text-white/40" /> : <ChevronRight className="ml-auto size-4 text-white/40" />}</button>{cadastrosOpen ? <div className="ml-5 mt-1 space-y-1 border-l border-white/10 pl-3">{cadastroNav.map((item) => { const active = pathname === item.href || pathname.startsWith(`${item.href}/`); const Icon = item.icon; return <Link key={item.href} href={item.href} onClick={onNavigate} className={`group flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition ${active ? "bg-white text-brand-950 shadow-sm" : "text-white/60 hover:bg-white/10 hover:text-white"}`}><Icon className={`size-4 ${active ? "text-brand-700" : "text-white/40"}`} /><span>{item.label}</span></Link>; })}</div> : null}</div>
      </nav>
      <div className="mt-7 border-t border-white/10 pt-5"><p className="px-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/35">Assistencial</p><div className="mt-3 space-y-1">{assistencialNav.map(({ href, label, icon: Icon }) => { const active = pathname === href || pathname.startsWith(`${href}/`); return <Link key={href} href={href} onClick={onNavigate} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${active ? "bg-white text-brand-950" : "text-white/65 hover:bg-white/10 hover:text-white"}`}><Icon className="size-4" /><span>{label}</span></Link>; })}</div></div>
    </div>
    <div className="border-t border-white/10 p-4"><div className="rounded-2xl border border-white/10 bg-white/5 p-3"><div className="flex items-center gap-3"><span className="grid size-9 place-items-center rounded-full bg-white/10 text-xs font-semibold">HS</span><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-white">Ambiente hospitalar</p><p className="truncate text-xs text-white/45">Acesso seguro</p></div></div></div></div>
  </div>;
}

export function AppShell({ children, email, logoutAction }: { children: React.ReactNode; email?: string | null; logoutAction: (formData: FormData) => void | Promise<void> }) {
  const [mobileOpen, setMobileOpen] = useState<boolean>(false);
  return <div className="min-h-screen bg-slate-50 lg:grid lg:grid-cols-[17.5rem_1fr]">
    <aside className="hidden bg-brand-950 text-white lg:sticky lg:top-0 lg:block lg:h-screen"><SidebarContent /></aside>
    {mobileOpen ? <div className="fixed inset-0 z-50 lg:hidden"><button aria-label="Fechar menu" className="absolute inset-0 bg-slate-950/45 backdrop-blur-sm" onClick={() => setMobileOpen(false)} /><aside className="relative h-full w-[18rem] max-w-[88vw] bg-brand-950 text-white shadow-2xl"><button aria-label="Fechar menu" onClick={() => setMobileOpen(false)} className="absolute right-3 top-3 z-10 rounded-lg p-2 text-white/60 hover:bg-white/10 hover:text-white"><X className="size-5" /></button><SidebarContent onNavigate={() => setMobileOpen(false)} /></aside></div> : null}
    <div className="min-w-0"><header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl"><div className="flex h-16 items-center gap-3 px-4 sm:px-6"><button onClick={() => setMobileOpen(true)} aria-label="Abrir menu" className="rounded-xl border border-slate-200 p-2 text-slate-600 hover:bg-slate-50 lg:hidden"><Menu className="size-5" /></button><div className="hidden min-w-0 flex-1 md:block"><div className="relative max-w-md"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" /><input aria-label="Busca global" placeholder="Buscar pacientes, profissionais, convênios..." className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm text-slate-700 outline-none transition focus:border-brand-300 focus:bg-white focus:ring-4 focus:ring-brand-100" /></div></div><div className="ml-auto flex items-center gap-2"><button aria-label="Notificações" className="relative rounded-xl border border-slate-200 bg-white p-2.5 text-slate-600 hover:bg-slate-50"><Bell className="size-4.5" /><span className="absolute right-2 top-2 size-1.5 rounded-full bg-rose-500" /></button><details className="relative"><summary className="flex cursor-pointer list-none items-center gap-2 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-sm hover:bg-slate-50"><span className="grid size-8 place-items-center rounded-full bg-brand-100 font-semibold text-brand-800">{email?.slice(0, 1).toUpperCase() || "U"}</span><span className="hidden max-w-40 truncate text-slate-700 sm:block">{email || "Usuário"}</span><ChevronDown className="size-4 text-slate-400" /></summary><div className="absolute right-0 mt-2 w-56 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl shadow-slate-900/10"><Link href="/meu-perfil" className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"><UserRound className="size-4" /> Meu Perfil</Link><div className="my-1 h-px bg-slate-100" /><form action={logoutAction}><button className="w-full rounded-xl px-3 py-2 text-left text-sm font-medium text-rose-600 hover:bg-rose-50">Sair do sistema</button></form></div></details></div></div></header><main className="px-4 py-5 sm:px-6 sm:py-6 xl:px-8">{children}</main></div>
  </div>;
}
