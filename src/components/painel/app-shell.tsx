"use client";

import Link from "next/link";
import type { Route } from "next";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  Activity,
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
  FileText,
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
type NavGroup = { key: string; label: string; shortLabel: string; icon: typeof UsersRound; items: NavItem[] };

const jornadaNav: NavItem[] = [
  { href: "/agenda", label: "Agenda", icon: CalendarDays },
  { href: "/senhas", label: "Recepção", icon: TicketCheck },
  { href: "/atendimentos", label: "Atendimentos", icon: ClipboardList },
  { href: "/central-guias", label: "Guias", icon: ClipboardCheck },
  { href: "/autorizacoes", label: "Autorizações", icon: ShieldCheck },
  { href: "/triagem", label: "Triagem", icon: HeartPulse },
  { href: "/fila-medica", label: "Fila médica", icon: Stethoscope },
  { href: "/prontuario", label: "Prontuário", icon: ClipboardCheck },
];

const assistenciaNav: NavItem[] = [
  { href: "/assistencial", label: "Central Assistencial", icon: Activity },
  { href: "/prescricao", label: "Prescrição", icon: Pill },
  { href: "/internacao", label: "Internação e leitos", icon: BedDouble },
];

const setoresNav: NavItem[] = [
  { href: "/setores/enfermagem", label: "Enfermagem", icon: Activity },
  { href: "/setores/farmacia", label: "Farmácia", icon: Pill },
  { href: "/setores/laboratorio", label: "Laboratório", icon: FlaskConical },
  { href: "/setores/imagem", label: "Imagem", icon: ScanLine },
  { href: "/setores/internacao", label: "Internação", icon: BedDouble },
];

const cadastroNav: NavItem[] = [
  { href: "/pacientes", label: "Pacientes", icon: UsersRound },
  { href: "/profissionais", label: "Profissionais", icon: Stethoscope },
  { href: "/convenios", label: "Convênios", icon: Building2 },
  { href: "/catalogos", label: "Catálogos", icon: BookOpenCheck },
  { href: "/comercial", label: "Credenciamento", icon: Handshake },
  { href: "/comercial/procedimentos", label: "Procedimentos", icon: ClipboardList },
  { href: "/comercial/regras", label: "Regras contratuais", icon: ShieldCheck },
  { href: "/comercial/tabelas", label: "Tabelas comerciais", icon: ReceiptText },
];

const gestaoNav: NavItem[] = [
  { href: "/diretoria", label: "Diretoria", icon: LayoutDashboard },
  { href: "/ged", label: "GED", icon: FileText },
  { href: "/compras", label: "Compras", icon: ShoppingCart },
  { href: "/almoxarifado", label: "Estoque", icon: Boxes },
];

const receitaNav: NavItem[] = [
  { href: "/auditoria", label: "Auditoria", icon: ShieldCheck },
  { href: "/contas-medicas", label: "Contas médicas", icon: ClipboardCheck },
  { href: "/faturamento", label: "Pré-faturamento", icon: ReceiptText },
  { href: "/faturamento/lotes", label: "Lotes TISS", icon: ReceiptText },
  { href: "/faturamento/glosas", label: "Glosas e recursos", icon: ReceiptText },
  { href: "/financeiro", label: "Recebimentos", icon: WalletCards },
  { href: "/financeiro/notas-fiscais", label: "Notas fiscais", icon: FileText },
];

const configuracaoNav: NavItem[] = [
  { href: "/configuracoes/paineis", label: "Painéis e chamadas", icon: MonitorCog },
  { href: "/configuracoes/tiss-webservices", label: "Webservices TISS", icon: Cable },
  { href: "/configuracoes/nfse", label: "Prefeituras / NFS-e", icon: Landmark },
];

const navGroups: NavGroup[] = [
  { key: "jornada", label: "Jornada do paciente", shortLabel: "Jornada", icon: HeartPulse, items: jornadaNav },
  { key: "assistencia", label: "Assistência clínica", shortLabel: "Assistência", icon: Stethoscope, items: assistenciaNav },
  { key: "setores", label: "Execução por setor", shortLabel: "Setores", icon: ClipboardList, items: setoresNav },
  { key: "cadastros", label: "Cadastros e contratos", shortLabel: "Cadastros", icon: FolderCog, items: cadastroNav },
  { key: "gestao", label: "Gestão e suprimentos", shortLabel: "Gestão", icon: Building2, items: gestaoNav },
  { key: "receita", label: "Ciclo da receita", shortLabel: "Receita", icon: WalletCards, items: receitaNav },
  { key: "configuracoes", label: "Configurações", shortLabel: "Config.", icon: MonitorCog, items: configuracaoNav },
];

const allNav = navGroups.flatMap((group) => group.items);

function pathMatches(pathname: string, item: NavItem) {
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

function activeItem(pathname: string) {
  return [...allNav].sort((a, b) => b.href.length - a.href.length).find((item) => pathMatches(pathname, item)) ?? null;
}

function activeGroup(pathname: string) {
  const item = activeItem(pathname);
  if (!item) return null;
  return navGroups.find((group) => group.items.some((candidate) => candidate.href === item.href)) ?? null;
}

function currentTitle(pathname: string) {
  if (pathname === "/painel") return "Visão geral";
  if (pathname.startsWith("/manual")) return "Manual do sistema";
  if (pathname.startsWith("/meu-perfil")) return "Meu perfil";
  return activeItem(pathname)?.label ?? "MedSync HIS";
}

function SidebarContent({ onNavigate, unidadeId }: { onNavigate?: () => void; unidadeId?: string | null }) {
  const pathname = usePathname();
  const selected = activeItem(pathname);
  const selectedGroup = activeGroup(pathname);
  const [openGroup, setOpenGroup] = useState<string | null>(() => selectedGroup?.key ?? "jornada");

  const navLink = (item: NavItem) => {
    const active = selected?.href === item.href;
    const Icon = item.icon;
    return (
      <Link
        key={item.href}
        href={item.href as Route}
        onClick={onNavigate}
        aria-current={active ? "page" : undefined}
        className={`group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${active ? "bg-white/[0.12] text-white shadow-sm" : "text-white/62 hover:bg-white/[0.07] hover:text-white"}`}
      >
        {active ? <span className="absolute -left-3 h-7 w-1 rounded-r-full bg-cyan-400" /> : null}
        <span className={`grid size-8 place-items-center rounded-lg transition ${active ? "bg-white/10 text-cyan-300" : "text-white/42 group-hover:text-white/75"}`}><Icon className="size-4" /></span>
        <span className="truncate">{item.label}</span>
      </Link>
    );
  };

  const navGroup = (group: NavGroup) => {
    const active = selectedGroup?.key === group.key;
    const open = openGroup === group.key;
    const Icon = group.icon;
    return (
      <div key={group.key}>
        <button
          type="button"
          onClick={() => setOpenGroup((value) => value === group.key ? null : group.key)}
          aria-expanded={open}
          className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${active ? "bg-white/[0.08] text-white" : "text-white/68 hover:bg-white/[0.07] hover:text-white"}`}
        >
          <span className={`grid size-8 place-items-center rounded-lg ${active ? "text-cyan-300" : "text-white/45"}`}><Icon className="size-4" /></span>
          <span className="min-w-0 flex-1 truncate text-left">{group.label}</span>
          {open ? <ChevronDown className="size-4 text-white/35" /> : <ChevronRight className="size-4 text-white/35" />}
        </button>
        {open ? <div className="ml-7 mt-1.5 space-y-1 border-l border-white/[0.08] pl-2.5">{group.items.map(navLink)}</div> : null}
      </div>
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
        {sectionLabel("Início")}
        <nav className="mt-3 space-y-1" aria-label="Navegação principal">
          {navLink({ href: "/painel", label: "Visão geral", icon: LayoutDashboard })}
        </nav>

        <div className="mt-5 border-t border-white/[0.07] pt-5">
          {sectionLabel("Áreas de trabalho")}
          <div className="mt-3 space-y-1">{navGroups.map(navGroup)}</div>
        </div>

        {unidadeId ? (
          <div className="mt-6 border-t border-white/[0.07] pt-5">
            {sectionLabel("Terminais")}
            <div className="mt-3 space-y-2">
              {terminalLink(`/totem/${unidadeId}` as Route, "Abrir Totem", ScanLine)}
              {terminalLink(`/painel-chamadas/${unidadeId}` as Route, "Painel de Chamadas", MonitorCog)}
            </div>
          </div>
        ) : null}
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

function WorkspaceBar({ pathname }: { pathname: string }) {
  const group = activeGroup(pathname);
  const selected = activeItem(pathname);
  if (!group) return null;
  const GroupIcon = group.icon;
  return (
    <div className="border-t border-slate-100 bg-white">
      <div className="flex min-h-11 items-center gap-2 overflow-x-auto px-4 sm:px-6 xl:px-8">
        <span className="sticky left-0 z-10 mr-1 inline-flex shrink-0 items-center gap-1.5 bg-white pr-2 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">
          <GroupIcon className="size-3.5" />{group.shortLabel}
        </span>
        {group.items.map((item) => {
          const active = selected?.href === item.href;
          const Icon = item.icon;
          return <Link key={item.href} href={item.href as Route} aria-current={active ? "page" : undefined} className={`inline-flex h-11 shrink-0 items-center gap-1.5 border-b-2 px-2.5 text-xs font-semibold transition ${active ? "border-brand-600 text-brand-800" : "border-transparent text-slate-500 hover:border-slate-200 hover:text-slate-800"}`}><Icon className="size-3.5" />{item.label}</Link>;
        })}
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
          <div className="flex h-16 items-center gap-3 px-4 sm:px-6 xl:px-8">
            <button onClick={() => setMobileOpen(true)} aria-label="Abrir menu" className="rounded-xl border border-slate-200 p-2.5 text-slate-600 hover:bg-slate-50 lg:hidden"><Menu className="size-5" /></button>

            <div className="min-w-0">
              <p className="hidden text-[10px] font-bold uppercase tracking-[0.17em] text-slate-400 sm:block">MedSync · HIS</p>
              <h2 className="truncate text-[15px] font-bold text-slate-800 sm:text-base">{title}</h2>
            </div>

            <div className="hidden min-w-0 flex-1 justify-center lg:flex">
              <form action="/atendimentos" method="get" className="relative w-full max-w-lg">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                <input name="q" aria-label="Busca global" placeholder="Paciente, CPF, CNS, RA ou atendimento..." className="h-10 w-full rounded-xl border border-[#e1e8f1] bg-[#f7f9fc] pl-10 pr-4 text-sm text-slate-700 outline-none transition focus:border-brand-300 focus:bg-white focus:ring-4 focus:ring-brand-100" />
              </form>
            </div>

            <div className="ml-auto flex items-center gap-2.5">
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
          <WorkspaceBar pathname={pathname} />
        </header>

        <main className="mx-auto w-full max-w-[1700px] px-4 py-4 sm:px-6 sm:py-5 xl:px-8 xl:py-6">{children}</main>
      </div>
    </div>
  );
}
