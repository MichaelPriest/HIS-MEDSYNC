"use client";

import Link from "next/link";
import type { Route } from "next";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  Activity,
  Bell,
  BedDouble,
  BookOpenCheck,
  Boxes,
  Building2,
  Cable,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  ClipboardList,
  FlaskConical,
  FolderCog,
  Handshake,
  HeartPulse,
  HelpCircle,
  Landmark,
  LayoutDashboard,
  Menu,
  MonitorCog,
  Pill,
  ReceiptText,
  ScanLine,
  Search,
  ShieldCheck,
  ShoppingCart,
  Stethoscope,
  TicketCheck,
  UserRound,
  UsersRound,
  WalletCards,
  X,
} from "lucide-react";
import { brand } from "@/config/brand";

type NavItem = { href: string; label: string; icon: typeof UsersRound };

const cadastroNav: NavItem[] = [
  { href: "/pacientes", label: "Pacientes", icon: UsersRound },
  { href: "/profissionais", label: "Profissionais", icon: Stethoscope },
  { href: "/convenios", label: "Convênios", icon: Building2 },
  { href: "/catalogos", label: "Catálogos", icon: BookOpenCheck },
];
const assistencialNav: NavItem[] = [
  { href: "/assistencial", label: "Central Assistencial", icon: Activity },
  { href: "/senhas", label: "Senhas / Recepção", icon: TicketCheck },
  { href: "/atendimentos", label: "Atendimento / ADT", icon: ClipboardList },
  { href: "/central-guias", label: "Central de Guias", icon: ClipboardCheck },
  { href: "/autorizacoes", label: "Autorizações", icon: ShieldCheck },
  { href: "/agenda", label: "Agenda e recepção", icon: CalendarDays },
  { href: "/triagem", label: "Triagem", icon: HeartPulse },
  { href: "/fila-medica", label: "Minha fila médica", icon: Stethoscope },
  { href: "/prontuario", label: "Prontuário", icon: ShieldCheck },
  { href: "/prescricao", label: "Prescrição", icon: Pill },
  { href: "/internacao", label: "Internação", icon: BedDouble },
];
const setoresNav: NavItem[] = [
  { href: "/setores/enfermagem", label: "Enfermagem", icon: Activity },
  { href: "/setores/farmacia", label: "Farmácia", icon: Pill },
  { href: "/setores/laboratorio", label: "Laboratório", icon: FlaskConical },
  { href: "/setores/imagem", label: "Imagem", icon: ScanLine },
  { href: "/setores/internacao", label: "Fila de internação", icon: BedDouble },
];
const corporativoNav: NavItem[] = [
  { href: "/compras", label: "Compras", icon: ShoppingCart },
  { href: "/almoxarifado", label: "Almoxarifado / Estoque", icon: Boxes },
  { href: "/auditoria", label: "Auditoria de contas", icon: ShieldCheck },
  { href: "/comercial", label: "Comercial / Credenciamento", icon: Handshake },
];
const financeiroNav: NavItem[] = [
  { href: "/faturamento", label: "Pré-faturamento", icon: ReceiptText },
  { href: "/faturamento/lotes", label: "Lotes TISS", icon: ReceiptText },
  { href: "/faturamento/glosas", label: "Glosas e recursos", icon: ReceiptText },
  { href: "/financeiro", label: "Contas a receber", icon: WalletCards },
  { href: "/financeiro/notas-fiscais", label: "Notas fiscais / NFS-e", icon: ReceiptText },
];

const allNav = [...cadastroNav, ...assistencialNav, ...setoresNav, ...corporativoNav, ...financeiroNav];

function currentTitle(pathname: string) {
  if (pathname === "/painel") return "Visão geral";
  if (pathname.startsWith("/manual")) return "Manual do sistema";
  const item = [...allNav].sort((a, b) => b.href.length - a.href.length).find((nav) => pathname === nav.href || pathname.startsWith(`${nav.href}/`));
  if (item) return item.label;
  if (pathname.startsWith("/configuracoes/paineis")) return "Painéis e chamadas";
  if (pathname.startsWith("/configuracoes/tiss-webservices")) return "Webservices TISS";
  if (pathname.startsWith("/configuracoes/nfse")) return "Prefeituras / NFS-e";
  return "MedSync HIS";
}

function SidebarContent({ onNavigate, unidadeId }: { onNavigate?: () => void; unidadeId?: string | null }) {
  const pathname = usePathname();
  const cadastrosAtivo = cadastroNav.some((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));
  const [cadastrosOpen, setCadastrosOpen] = useState(true);

  const navLink = (item: NavItem) => {
    const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
    const Icon = item.icon;
    return (
      <Link
        key={item.href}
        href={item.href as Route}
        onClick={onNavigate}
        className={`group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${active ? "bg-white/[0.12] text-white shadow-sm" : "text-white/62 hover:bg-white/[0.07] hover:text-white"}`}
      >
        {active ? <span className="absolute -left-3 h-7 w-1 rounded-r-full bg-cyan-400" /> : null}
        <span className={`grid size-8 place-items-center rounded-lg transition ${active ? "bg-white/10 text-cyan-300" : "text-white/42 group-hover:text-white/75"}`}><Icon className="size-4" /></span>
        <span className="truncate">{item.label}</span>
      </Link>
    );
  };

  const terminalLink = (href: Route, label: string, Icon: typeof ScanLine) => (
    <Link
      href={href}
      target="_blank"
      rel="noreferrer"
      onClick={onNavigate}
      className="group flex items-center gap-3 rounded-xl border border-cyan-300/10 bg-cyan-300/[0.055] px-3 py-2.5 text-sm font-semibold text-cyan-50/80 transition hover:border-cyan-300/20 hover:bg-cyan-300/[0.10] hover:text-white"
    >
      <span className="grid size-8 place-items-center rounded-lg bg-cyan-300/10 text-cyan-300"><Icon className="size-4" /></span>
      <span className="truncate">{label}</span>
      <span className="ml-auto text-[10px] font-bold uppercase tracking-wider text-cyan-200/35">Abrir</span>
    </Link>
  );

  const sectionLabel = (label: string) => <p className="px-3 text-[10px] font-bold uppercase tracking-[0.2em] text-white/30">{label}</p>;

  return (
    <div className="flex h-full flex-col bg-[radial-gradient(circle_at_top_left,_rgba(37,99,235,.20),_transparent_30%),linear-gradient(180deg,#0b1f44_0%,#07162f_100%)]">
      <div className="border-b border-white/[0.08] px-5 py-5">
        <Link href="/painel" onClick={onNavigate} className="flex items-center gap-3.5">
          <span className="grid size-11 place-items-center rounded-2xl bg-gradient-to-br from-cyan-400 to-blue-500 text-white shadow-lg shadow-blue-950/30"><HeartPulse className="size-5.5" /></span>
          <span className="min-w-0">
            <strong className="block truncate text-[17px] font-bold tracking-tight text-white">{brand.shortName}</strong>
            <span className="mt-0.5 block truncate text-[10px] font-semibold uppercase tracking-[0.17em] text-cyan-100/45">Hospital Information System</span>
          </span>
        </Link>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-5">
        {sectionLabel("Principal")}
        <nav className="mt-3 space-y-1" aria-label="Principal">
          {navLink({ href: "/painel", label: "Visão geral", icon: LayoutDashboard })}
          {navLink({ href: "/manual", label: "Manual do sistema", icon: HelpCircle })}
          <div className="pt-1">
            <button
              type="button"
              onClick={() => setCadastrosOpen((value) => !value)}
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${cadastrosAtivo ? "bg-white/[0.08] text-white" : "text-white/62 hover:bg-white/[0.07] hover:text-white"}`}
            >
              <span className="grid size-8 place-items-center rounded-lg text-white/45"><FolderCog className="size-4" /></span>
              <span>Cadastros</span>
              {cadastrosOpen ? <ChevronDown className="ml-auto size-4 text-white/35" /> : <ChevronRight className="ml-auto size-4 text-white/35" />}
            </button>
            {cadastrosOpen ? <div className="ml-7 mt-1.5 space-y-1 border-l border-white/[0.08] pl-2.5">{cadastroNav.map(navLink)}</div> : null}
          </div>
        </nav>

        {unidadeId ? (
          <div className="mt-6 border-t border-white/[0.07] pt-5">
            {sectionLabel("Terminais")}
            <div className="mt-3 space-y-2">
              {terminalLink(`/totem/${unidadeId}` as Route, "Abrir Totem", ScanLine)}
              {terminalLink(`/painel-chamadas/${unidadeId}` as Route, "Painel de Chamadas", MonitorCog)}
            </div>
          </div>
        ) : null}

        <div className="mt-6 border-t border-white/[0.07] pt-5">{sectionLabel("Assistencial")}<div className="mt-3 space-y-1">{assistencialNav.map(navLink)}</div></div>
        <div className="mt-6 border-t border-white/[0.07] pt-5">{sectionLabel("Filas por setor")}<div className="mt-3 space-y-1">{setoresNav.map(navLink)}</div></div>
        <div className="mt-6 border-t border-white/[0.07] pt-5">{sectionLabel("Corporativo")}<div className="mt-3 space-y-1">{corporativoNav.map(navLink)}</div></div>
        <div className="mt-6 border-t border-white/[0.07] pt-5">{sectionLabel("Financeiro")}<div className="mt-3 space-y-1">{financeiroNav.map(navLink)}</div></div>

        <div className="mt-6 border-t border-white/[0.07] pt-5">
          {sectionLabel("Configurações")}
          <div className="mt-3 space-y-1">
            {navLink({ href: "/configuracoes/paineis", label: "Painéis e chamadas", icon: MonitorCog })}
            {navLink({ href: "/configuracoes/tiss-webservices", label: "Webservices TISS", icon: Cable })}
            {navLink({ href: "/configuracoes/nfse", label: "Prefeituras / NFS-e", icon: Landmark })}
          </div>
        </div>
      </div>

      <div className="border-t border-white/[0.08] p-4">
        <div className="rounded-2xl border border-white/[0.09] bg-white/[0.055] p-3.5 backdrop-blur">
          <div className="flex items-center gap-3">
            <span className="relative grid size-9 place-items-center rounded-xl bg-cyan-400/10 text-cyan-300"><ShieldCheck className="size-4" /><span className="absolute -right-0.5 -top-0.5 size-2 rounded-full border-2 border-[#0b1f44] bg-emerald-400" /></span>
            <div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold text-white/90">Ambiente hospitalar</p><p className="mt-0.5 truncate text-[11px] text-white/38">Conexão protegida</p></div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function AppShell({ children, email, unidadeId, logoutAction }: { children: React.ReactNode; email?: string | null; unidadeId?: string | null; logoutAction: (formData: FormData) => void | Promise<void> }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const title = currentTitle(pathname);

  return (
    <div className="min-h-screen bg-[#f4f7fb] lg:grid lg:grid-cols-[18rem_1fr]">
      <aside className="hidden text-white lg:sticky lg:top-0 lg:block lg:h-screen"><SidebarContent unidadeId={unidadeId} /></aside>

      {mobileOpen ? <div className="fixed inset-0 z-50 lg:hidden"><button aria-label="Fechar menu" className="absolute inset-0 bg-slate-950/55 backdrop-blur-sm" onClick={() => setMobileOpen(false)} /><aside className="relative h-full w-[18rem] max-w-[88vw] text-white shadow-2xl"><button aria-label="Fechar menu" onClick={() => setMobileOpen(false)} className="absolute right-3 top-3 z-10 rounded-lg p-2 text-white/60 hover:bg-white/10 hover:text-white"><X className="size-5" /></button><SidebarContent unidadeId={unidadeId} onNavigate={() => setMobileOpen(false)} /></aside></div> : null}

      <div className="min-w-0">
        <header className="sticky top-0 z-30 border-b border-[#e4eaf2] bg-white/95 backdrop-blur-xl">
          <div className="flex h-[72px] items-center gap-3 px-4 sm:px-6 xl:px-8">
            <button onClick={() => setMobileOpen(true)} aria-label="Abrir menu" className="rounded-xl border border-slate-200 p-2.5 text-slate-600 hover:bg-slate-50 lg:hidden"><Menu className="size-5" /></button>

            <div className="min-w-0">
              <p className="hidden text-[10px] font-bold uppercase tracking-[0.17em] text-slate-400 sm:block">MedSync · HIS</p>
              <h2 className="truncate text-[15px] font-bold text-slate-800 sm:text-base">{title}</h2>
            </div>

            <div className="hidden min-w-0 flex-1 justify-center lg:flex">
              <div className="relative w-full max-w-lg">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                <input aria-label="Busca global" placeholder="Buscar paciente, RA, atendimento, guia..." className="h-11 w-full rounded-2xl border border-[#e1e8f1] bg-[#f7f9fc] pl-10 pr-4 text-sm text-slate-700 outline-none transition focus:border-brand-300 focus:bg-white focus:ring-4 focus:ring-brand-100" />
              </div>
            </div>

            <div className="ml-auto flex items-center gap-2.5">
              <span className="hidden items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1.5 text-[11px] font-bold text-emerald-700 md:inline-flex"><span className="size-1.5 rounded-full bg-emerald-500" />Online</span>
              <button aria-label="Notificações" className="relative grid size-10 place-items-center rounded-xl border border-[#e1e8f1] bg-white text-slate-600 shadow-sm hover:bg-slate-50"><Bell className="size-4.5" /><span className="ui-notification-dot absolute right-2.5 top-2.5 size-1.5 rounded-full bg-rose-500" /></button>
              <details className="relative">
                <summary className="flex cursor-pointer list-none items-center gap-2.5 rounded-xl border border-[#e1e8f1] bg-white px-2 py-1.5 text-sm shadow-sm hover:bg-slate-50">
                  <span className="grid size-8 place-items-center rounded-xl bg-gradient-to-br from-brand-100 to-cyan-100 font-bold text-brand-800">{email?.slice(0, 1).toUpperCase() || "U"}</span>
                  <span className="hidden max-w-44 truncate text-slate-700 sm:block">{email || "Usuário"}</span>
                  <ChevronDown className="size-4 text-slate-400" />
                </summary>
                <div className="absolute right-0 mt-2 w-60 rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl shadow-slate-900/10">
                  <Link href="/meu-perfil" className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"><UserRound className="size-4" /> Meu Perfil</Link>
                  <Link href="/manual" className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"><HelpCircle className="size-4" /> Manual do sistema</Link>
                  <div className="my-1 h-px bg-slate-100" />
                  <form action={logoutAction}><button className="w-full rounded-xl px-3 py-2.5 text-left text-sm font-medium text-rose-600 hover:bg-rose-50">Sair do sistema</button></form>
                </div>
              </details>
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1700px] px-4 py-5 sm:px-6 sm:py-6 xl:px-8 xl:py-7">{children}</main>
      </div>
    </div>
  );
}
