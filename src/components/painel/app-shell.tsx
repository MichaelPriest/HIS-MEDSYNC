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
  Hospital,
  Landmark,
  LayoutDashboard,
  LogOut,
  MapPin,
  Menu,
  MonitorCog,
  Pill,
  Plus,
  ReceiptText,
  ScanLine,
  Search,
  Settings,
  ShieldCheck,
  ShoppingCart,
  Siren,
  Stethoscope,
  TicketCheck,
  UserCog,
  UserRound,
  UsersRound,
  WalletCards,
  X,
} from "lucide-react";
import { brand } from "@/config/brand";
import { canAccessNavigation } from "@/lib/permissions/navigation";
import { ContextualShortcuts } from "@/components/painel/contextual-shortcuts";

type Icon = typeof UsersRound;
type NavItem = { href: string; label: string; icon: Icon };
type NavGroup = {
  key: string;
  label: string;
  shortLabel: string;
  icon: Icon;
  items: NavItem[];
};

const inicioItem: NavItem = { href: "/painel", label: "Visão geral", icon: LayoutDashboard };

const fluxoAtendimentoNav: NavItem[] = [
  { href: "/agenda", label: "Agenda", icon: CalendarDays },
  { href: "/senhas", label: "Recepção e senhas", icon: TicketCheck },
  { href: "/atendimentos", label: "Atendimentos", icon: ClipboardList },
  { href: "/triagem", label: "Triagem", icon: HeartPulse },
];

const atendimentoMedicoNav: NavItem[] = [
  { href: "/fila-medica", label: "Fila médica", icon: Stethoscope },
  { href: "/prontuario", label: "Prontuário", icon: ClipboardCheck },
  { href: "/prescricao", label: "Prescrição", icon: Pill },
  { href: "/assistencial/urgencia", label: "Urgência / Emergência", icon: Siren },
  { href: "/assistencial", label: "Central Assistencial", icon: Activity },
];

const internacaoNav: NavItem[] = [
  { href: "/internacao", label: "Painel da internação", icon: BedDouble },
  { href: "/internacao/leitos", label: "Mapa de leitos", icon: BedDouble },
  { href: "/internacao/nir", label: "NIR / Gestão de leitos", icon: Hospital },
  { href: "/internacao/altas", label: "Central de altas", icon: ClipboardCheck },
];

const setoresNav: NavItem[] = [
  { href: "/setores/enfermagem", label: "Enfermagem", icon: Activity },
  { href: "/setores/farmacia", label: "Farmácia", icon: Pill },
  { href: "/setores/laboratorio", label: "Laboratório", icon: FlaskConical },
  { href: "/setores/imagem", label: "Diagnóstico por imagem", icon: ScanLine },
  { href: "/setores/internacao", label: "Fila da internação", icon: BedDouble },
];

const receitaNav: NavItem[] = [
  { href: "/central-guias", label: "Guias", icon: ClipboardCheck },
  { href: "/autorizacoes", label: "Autorizações", icon: ShieldCheck },
  { href: "/auditoria", label: "Auditoria", icon: ShieldCheck },
  { href: "/contas-medicas", label: "Contas médicas", icon: ClipboardCheck },
  { href: "/faturamento", label: "Pré-faturamento", icon: ReceiptText },
  { href: "/faturamento/lotes", label: "Lotes TISS", icon: ReceiptText },
  { href: "/faturamento/glosas", label: "Glosas e recursos", icon: ReceiptText },
  { href: "/financeiro", label: "Recebimentos", icon: WalletCards },
  { href: "/financeiro/notas-fiscais", label: "Notas fiscais", icon: FileText },
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
  { href: "/compras", label: "Compras", icon: ShoppingCart },
  { href: "/almoxarifado", label: "Estoque", icon: Boxes },
  { href: "/ged", label: "GED", icon: FileText },
];

const configuracaoNav: NavItem[] = [
  { href: "/configuracoes/acessos", label: "Usuários e acessos", icon: UserCog },
  { href: "/configuracoes/estrutura", label: "Estrutura hospitalar", icon: Building2 },
  { href: "/configuracoes/paineis", label: "Painéis e chamadas", icon: MonitorCog },
  { href: "/configuracoes/tiss-webservices", label: "Webservices TISS", icon: Cable },
  { href: "/configuracoes/nfse", label: "Prefeituras / NFS-e", icon: Landmark },
];

const navGroups: NavGroup[] = [
  { key: "fluxo", label: "Fluxo de atendimento", shortLabel: "Atendimento", icon: HeartPulse, items: fluxoAtendimentoNav },
  { key: "medico", label: "Atendimento médico", shortLabel: "Atendimento médico", icon: Stethoscope, items: atendimentoMedicoNav },
  { key: "internacao", label: "Internação", shortLabel: "Internação", icon: Hospital, items: internacaoNav },
  { key: "setores", label: "Execução por setor", shortLabel: "Setores", icon: ClipboardList, items: setoresNav },
  { key: "receita", label: "Faturamento e receita", shortLabel: "Receita", icon: WalletCards, items: receitaNav },
  { key: "cadastros", label: "Cadastros e contratos", shortLabel: "Cadastros", icon: FolderCog, items: cadastroNav },
  { key: "gestao", label: "Gestão e suprimentos", shortLabel: "Gestão", icon: Building2, items: gestaoNav },
  { key: "configuracoes", label: "Configurações", shortLabel: "Config.", icon: Settings, items: configuracaoNav },
];

const allNav = navGroups.flatMap((group) => group.items);

function pathMatches(pathname: string, item: NavItem) {
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

function activeItem(pathname: string) {
  if (pathname === inicioItem.href) return inicioItem;
  return [...allNav]
    .sort((a, b) => b.href.length - a.href.length)
    .find((item) => pathMatches(pathname, item)) ?? null;
}

function activeGroup(pathname: string) {
  const item = activeItem(pathname);
  if (!item || item.href === inicioItem.href) return null;
  return navGroups.find((group) => group.items.some((candidate) => candidate.href === item.href)) ?? null;
}

function currentTitle(pathname: string) {
  if (pathname.startsWith("/manual")) return "Manual do sistema";
  if (pathname.startsWith("/meu-perfil")) return "Meu perfil";
  return activeItem(pathname)?.label ?? "MedSync HIS";
}

function visibleItems(group: NavGroup, grantedPermissions: readonly string[] | null) {
  return group.items.filter((item) => canAccessNavigation(grantedPermissions, item.href));
}

function hasGrant(grantedPermissions: readonly string[] | null, permission: string) {
  return grantedPermissions === null || grantedPermissions.includes(permission);
}

function SidebarContent({
  onNavigate,
  unidadeId,
  unidadeNome,
  grantedPermissions,
  collapsed = false,
  onToggleCollapsed,
  onExpand,
}: {
  onNavigate?: () => void;
  unidadeId?: string | null;
  unidadeNome?: string | null;
  grantedPermissions: readonly string[] | null;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
  onExpand?: () => void;
}) {
  const pathname = usePathname();
  const selected = activeItem(pathname);
  const selectedGroup = activeGroup(pathname);
  const [openGroup, setOpenGroup] = useState<string | null>(() => selectedGroup?.key ?? "fluxo");
  const allowedGroups = navGroups
    .map((group) => ({ ...group, items: visibleItems(group, grantedPermissions) }))
    .filter((group) => group.items.length > 0);

  const navLink = (item: NavItem) => {
    const active = selected?.href === item.href;
    const ItemIcon = item.icon;
    return (
      <Link
        key={item.href}
        href={item.href as Route}
        onClick={onNavigate}
        aria-current={active ? "page" : undefined}
        title={collapsed ? item.label : undefined}
        className={`group relative flex items-center rounded-xl text-sm font-medium transition ${collapsed ? "justify-center px-2 py-2.5" : "gap-3 px-3 py-2.5"} ${active ? "bg-white/[0.13] text-white shadow-sm" : "text-white/62 hover:bg-white/[0.07] hover:text-white"}`}
      >
        {active ? <span className={`absolute h-7 w-1 rounded-r-full bg-cyan-400 ${collapsed ? "-left-2" : "-left-3"}`} /> : null}
        <span className={`grid size-8 shrink-0 place-items-center rounded-lg transition ${active ? "bg-cyan-300/10 text-cyan-300" : "text-white/42 group-hover:text-white/75"}`}>
          <ItemIcon className="size-4" />
        </span>
        {collapsed ? null : <span className="truncate">{item.label}</span>}
      </Link>
    );
  };

  const navGroup = (group: NavGroup) => {
    const active = selectedGroup?.key === group.key;
    const open = openGroup === group.key;
    const GroupIcon = group.icon;
    return (
      <div key={group.key}>
        <button
          type="button"
          onClick={() => {
            if (collapsed) {
              setOpenGroup(group.key);
              onExpand?.();
              return;
            }
            setOpenGroup((value) => value === group.key ? null : group.key);
          }}
          aria-expanded={!collapsed && open}
          title={collapsed ? group.label : undefined}
          className={`flex w-full items-center rounded-xl text-sm font-semibold transition ${collapsed ? "justify-center px-2 py-2.5" : "gap-3 px-3 py-2.5"} ${active ? "bg-white/[0.08] text-white" : "text-white/68 hover:bg-white/[0.07] hover:text-white"}`}
        >
          <span className={`grid size-8 shrink-0 place-items-center rounded-lg ${active ? "text-cyan-300" : "text-white/45"}`}>
            <GroupIcon className="size-4" />
          </span>
          {collapsed ? null : <><span className="min-w-0 flex-1 truncate text-left">{group.label}</span>{open ? <ChevronDown className="size-4 text-white/35" /> : <ChevronRight className="size-4 text-white/35" />}</>}
        </button>
        {!collapsed && open ? <div className="ml-7 mt-1 space-y-1 border-l border-white/[0.08] pl-2.5">{group.items.map(navLink)}</div> : null}
      </div>
    );
  };

  const terminalLink = (href: Route, label: string, TerminalIcon: Icon) => (
    <Link
      href={href}
      target="_blank"
      rel="noreferrer"
      onClick={onNavigate}
      title={collapsed ? label : undefined}
      className={`group flex items-center rounded-xl border border-cyan-300/10 bg-cyan-300/[0.055] text-sm font-semibold text-cyan-50/80 transition hover:border-cyan-300/20 hover:bg-cyan-300/[0.10] hover:text-white ${collapsed ? "justify-center px-2 py-2.5" : "gap-3 px-3 py-2.5"}`}
    >
      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-cyan-300/10 text-cyan-300"><TerminalIcon className="size-4" /></span>
      {collapsed ? null : <><span className="truncate">{label}</span><span className="ml-auto text-[10px] font-bold uppercase tracking-wider text-cyan-200/35">Abrir</span></>}
    </Link>
  );

  const sectionLabel = (label: string) => collapsed ? null : (
    <p className="px-3 text-[10px] font-bold uppercase tracking-[0.2em] text-white/30">{label}</p>
  );

  const canUseReceptionTerminals = canAccessNavigation(grantedPermissions, "/senhas");

  return (
    <div className="flex h-full flex-col bg-[radial-gradient(circle_at_top_left,_rgba(37,99,235,.20),_transparent_30%),linear-gradient(180deg,#0b1f44_0%,#07162f_100%)]">
      <div className={`flex items-center border-b border-white/[0.08] ${collapsed ? "justify-center px-2 py-4" : "gap-2 px-5 py-4.5"}`}>
        <Link href="/painel" onClick={onNavigate} className={`flex min-w-0 items-center ${collapsed ? "justify-center" : "flex-1 gap-3.5"}`} title={collapsed ? brand.shortName : undefined}>
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-cyan-400 to-blue-500 text-white shadow-lg shadow-blue-950/30"><HeartPulse className="size-5" /></span>
          {collapsed ? null : <span className="min-w-0"><strong className="block truncate text-[17px] font-bold tracking-tight text-white">{brand.shortName}</strong><span className="mt-0.5 block truncate text-[9px] font-semibold uppercase tracking-[0.17em] text-cyan-100/45">Hospital Information System</span></span>}
        </Link>
        {onToggleCollapsed ? <button type="button" onClick={onToggleCollapsed} aria-label={collapsed ? "Expandir menu lateral" : "Recolher menu lateral"} title={collapsed ? "Expandir menu" : "Recolher menu"} className={`hidden rounded-lg p-2 text-white/50 transition hover:bg-white/10 hover:text-white lg:grid ${collapsed ? "absolute left-[3.65rem] top-5 z-20 bg-[#0b1f44] shadow-lg" : ""}`}><ChevronRight className={`size-4 transition ${collapsed ? "" : "rotate-180"}`} /></button> : null}
      </div>

      <div className={`flex-1 overflow-y-auto py-4 ${collapsed ? "px-2" : "px-3"}`}>
        {sectionLabel("Início")}
        <nav className={`${collapsed ? "" : "mt-2"} space-y-1`} aria-label="Navegação principal">
          {navLink(inicioItem)}
        </nav>

        {allowedGroups.length ? (
          <div className={`${collapsed ? "mt-2" : "mt-4 border-t border-white/[0.07] pt-4"}`}>
            {sectionLabel("Áreas de trabalho")}
            <div className={`${collapsed ? "" : "mt-2"} space-y-1`}>{allowedGroups.map(navGroup)}</div>
          </div>
        ) : null}

        {unidadeId && canUseReceptionTerminals ? (
          <div className={`${collapsed ? "mt-3 border-t border-white/[0.07] pt-3" : "mt-5 border-t border-white/[0.07] pt-4"}`}>
            {sectionLabel("Terminais")}
            <div className={`${collapsed ? "" : "mt-2"} space-y-2`}>
              {terminalLink(`/totem/${unidadeId}` as Route, "Totem de senhas", ScanLine)}
              {terminalLink(`/painel-chamadas/${unidadeId}` as Route, "Painel de chamadas", MonitorCog)}
            </div>
          </div>
        ) : null}
      </div>

      <div className={`border-t border-white/[0.08] ${collapsed ? "p-2" : "p-3.5"}`}>
        <div className={`rounded-xl border border-white/[0.09] bg-white/[0.055] backdrop-blur ${collapsed ? "grid place-items-center p-2" : "px-3 py-2.5"}`} title={collapsed ? unidadeNome ?? "Unidade atual" : undefined}>
          <div className="flex items-center gap-2.5">
            <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-cyan-400/10 text-cyan-300"><MapPin className="size-4" /></span>
            {collapsed ? null : <div className="min-w-0"><p className="truncate text-[10px] font-bold uppercase tracking-wider text-white/35">Unidade atual</p><p className="mt-0.5 truncate text-xs font-semibold text-white/85">{unidadeNome ?? "Unidade hospitalar"}</p></div>}
          </div>
        </div>
      </div>
    </div>
  );
}

function WorkspaceBar({ pathname, grantedPermissions }: { pathname: string; grantedPermissions: readonly string[] | null }) {
  const group = activeGroup(pathname);
  const selected = activeItem(pathname);
  if (!group) return null;
  const items = visibleItems(group, grantedPermissions);
  if (!items.length) return null;
  const GroupIcon = group.icon;
  return (
    <div className="border-t border-slate-100 bg-slate-50/70">
      <div className="flex min-h-10 items-center gap-1.5 overflow-x-auto px-4 sm:px-6 xl:px-8">
        <span className="sticky left-0 z-10 mr-1 inline-flex shrink-0 items-center gap-1.5 bg-slate-50/95 pr-2 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400"><GroupIcon className="size-3.5" />{group.shortLabel}</span>
        {items.map((item) => {
          const active = selected?.href === item.href;
          const ItemIcon = item.icon;
          return <Link key={item.href} href={item.href as Route} aria-current={active ? "page" : undefined} className={`inline-flex h-10 shrink-0 items-center gap-1.5 border-b-2 px-2.5 text-xs font-semibold transition ${active ? "border-brand-600 text-brand-800" : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800"}`}><ItemIcon className="size-3.5" />{item.label}</Link>;
        })}
      </div>
    </div>
  );
}

function UserAvatar({ photoUrl, initial, size }: { photoUrl?: string | null; initial: string; size: "sm" | "md" }) {
  const dimensions = size === "sm" ? "size-8 rounded-lg" : "size-10 rounded-xl";
  return <span aria-hidden="true" className={`grid shrink-0 place-items-center bg-gradient-to-br from-brand-100 to-cyan-100 bg-cover bg-center font-bold text-brand-800 ${dimensions}`} style={photoUrl ? { backgroundImage: `url(${photoUrl})` } : undefined}>{photoUrl ? null : initial}</span>;
}

function UserMenu({ email, userName, userPhotoUrl, unidadeNome, empresaNome, profileNames, grantedPermissions, logoutAction }: { email?: string | null; userName: string; userPhotoUrl?: string | null; unidadeNome?: string | null; empresaNome?: string | null; profileNames: readonly string[]; grantedPermissions: readonly string[] | null; logoutAction: (formData: FormData) => void | Promise<void> }) {
  const initial = (userName || email || "U").slice(0, 1).toUpperCase();
  const primaryProfile = profileNames[0] ?? "Usuário";
  const canManageAccess = canAccessNavigation(grantedPermissions, "/configuracoes/acessos");
  const canOpenSettings = canAccessNavigation(grantedPermissions, "/configuracoes/paineis");
  return (
    <details className="relative">
      <summary className="flex cursor-pointer list-none items-center gap-2 rounded-xl border border-[#e1e8f1] bg-white p-1.5 pr-2 text-sm shadow-sm transition hover:border-slate-300 hover:bg-slate-50"><UserAvatar photoUrl={userPhotoUrl} initial={initial} size="sm" /><span className="hidden min-w-0 text-left md:block"><span className="block max-w-36 truncate text-xs font-bold text-slate-800">{userName}</span><span className="block max-w-36 truncate text-[10px] text-slate-400">{primaryProfile}</span></span><ChevronDown className="size-4 shrink-0 text-slate-400" /></summary>
      <div className="absolute right-0 mt-2 w-[19rem] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/12">
        <div className="border-b border-slate-100 bg-slate-50/70 p-4">
          <div className="flex items-start gap-3"><UserAvatar photoUrl={userPhotoUrl} initial={initial} size="md" /><div className="min-w-0 flex-1"><p className="truncate text-sm font-black text-slate-900">{userName}</p><p className="mt-0.5 truncate text-xs text-slate-500">{email ?? "E-mail não informado"}</p>{profileNames.length ? <div className="mt-2 flex flex-wrap gap-1">{profileNames.slice(0, 2).map((profile) => <span key={profile} className="rounded-md bg-brand-50 px-2 py-1 text-[10px] font-bold text-brand-700">{profile}</span>)}{profileNames.length > 2 ? <span className="rounded-md bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-500">+{profileNames.length - 2}</span> : null}</div> : null}</div></div>
          <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3 text-xs"><p className="flex items-center gap-2 font-semibold text-slate-700"><Building2 className="size-3.5 text-slate-400" />{empresaNome ?? "Empresa"}</p><p className="mt-1.5 flex items-center gap-2 text-slate-500"><MapPin className="size-3.5 text-slate-400" />{unidadeNome ?? "Unidade não identificada"}</p></div>
        </div>
        <div className="p-2"><Link href="/meu-perfil" className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"><UserRound className="size-4 text-slate-400" />Meu perfil</Link>{canManageAccess ? <Link href="/configuracoes/acessos" className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"><UserCog className="size-4 text-slate-400" />Usuários e acessos</Link> : null}{canOpenSettings ? <Link href="/configuracoes/paineis" className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"><Settings className="size-4 text-slate-400" />Configurações do sistema</Link> : null}<Link href="/manual" className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"><HelpCircle className="size-4 text-slate-400" />Manual do sistema</Link><div className="my-1 h-px bg-slate-100" /><form action={logoutAction}><button className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-rose-600 hover:bg-rose-50"><LogOut className="size-4" />Sair do sistema</button></form></div>
      </div>
    </details>
  );
}

export function AppShell({ children, email, userName = "Usuário", userPhotoUrl, unidadeId, unidadeNome, empresaNome, profileNames = [], grantedPermissions = null, logoutAction }: { children: React.ReactNode; email?: string | null; userName?: string; userPhotoUrl?: string | null; unidadeId?: string | null; unidadeNome?: string | null; empresaNome?: string | null; profileNames?: readonly string[]; grantedPermissions?: readonly string[] | null; logoutAction: (formData: FormData) => void | Promise<void> }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [desktopCollapsed, setDesktopCollapsed] = useState(false);
  const pathname = usePathname();
  const title = currentTitle(pathname);
  const group = activeGroup(pathname);
  const canCreateAttendance = hasGrant(grantedPermissions, "atendimentos.abrir");
  const canOpenEmergency = canAccessNavigation(grantedPermissions, "/assistencial/urgencia");

  return (
    <div className={`min-h-screen bg-[#f4f7fb] lg:grid ${desktopCollapsed ? "lg:grid-cols-[5rem_1fr]" : "lg:grid-cols-[17.5rem_1fr]"}`}>
      <aside className="hidden text-white transition-[width] lg:sticky lg:top-0 lg:block lg:h-screen">
        <SidebarContent unidadeId={unidadeId} unidadeNome={unidadeNome} grantedPermissions={grantedPermissions} collapsed={desktopCollapsed} onToggleCollapsed={() => setDesktopCollapsed((value) => !value)} onExpand={() => setDesktopCollapsed(false)} />
      </aside>

      {mobileOpen ? <div className="fixed inset-0 z-50 lg:hidden"><button aria-label="Fechar menu" className="absolute inset-0 bg-slate-950/55 backdrop-blur-sm" onClick={() => setMobileOpen(false)} /><aside className="relative h-full w-[18rem] max-w-[88vw] text-white shadow-2xl"><button aria-label="Fechar menu" onClick={() => setMobileOpen(false)} className="absolute right-3 top-3 z-10 rounded-lg p-2 text-white/60 hover:bg-white/10 hover:text-white"><X className="size-5" /></button><SidebarContent unidadeId={unidadeId} unidadeNome={unidadeNome} grantedPermissions={grantedPermissions} onNavigate={() => setMobileOpen(false)} /></aside></div> : null}

      <div className="min-w-0">
        <header className="sticky top-0 z-30 border-b border-[#e4eaf2] bg-white/95 backdrop-blur-xl">
          <div className="flex h-[68px] items-center gap-3 px-4 sm:px-6 xl:px-8">
            <button onClick={() => setMobileOpen(true)} aria-label="Abrir menu" className="rounded-xl border border-slate-200 p-2.5 text-slate-600 hover:bg-slate-50 lg:hidden"><Menu className="size-5" /></button>
            <div className="min-w-0 shrink-0"><div className="hidden items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400 sm:flex"><span>{group?.shortLabel ?? "MedSync HIS"}</span>{group ? <><ChevronRight className="size-3" /><span className="text-brand-600">Área atual</span></> : null}</div><h2 className="truncate text-[15px] font-black text-slate-850 sm:text-base">{title}</h2></div>
            <div className="hidden min-w-0 flex-1 justify-center xl:flex"><form action="/atendimentos" method="get" className="relative w-full max-w-xl"><Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" /><input name="q" aria-label="Busca global" placeholder="Buscar paciente, CPF, CNS, RA ou atendimento..." className="h-10 w-full rounded-xl border border-[#e1e8f1] bg-[#f7f9fc] pl-10 pr-4 text-sm text-slate-700 outline-none transition focus:border-brand-300 focus:bg-white focus:ring-4 focus:ring-brand-100" /></form></div>
            <div className="ml-auto flex items-center gap-2"><button onClick={() => setMobileSearchOpen((value) => !value)} aria-label="Abrir busca" className="rounded-xl border border-slate-200 p-2.5 text-slate-600 hover:bg-slate-50 xl:hidden"><Search className="size-4" /></button>{canOpenEmergency ? <Link href="/assistencial/urgencia" className="hidden items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 transition hover:bg-rose-100 2xl:inline-flex"><Siren className="size-4" />Urgência</Link> : null}{canCreateAttendance ? <Link href="/atendimentos" className="hidden items-center gap-1.5 rounded-xl bg-brand-700 px-3.5 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-brand-800 lg:inline-flex"><Plus className="size-4" />Novo atendimento</Link> : null}{unidadeNome ? <div className="hidden max-w-48 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600 2xl:flex"><MapPin className="size-3.5 shrink-0 text-brand-600" /><span className="truncate">{unidadeNome}</span></div> : null}<UserMenu email={email} userName={userName} userPhotoUrl={userPhotoUrl} unidadeNome={unidadeNome} empresaNome={empresaNome} profileNames={profileNames} grantedPermissions={grantedPermissions} logoutAction={logoutAction} /></div>
          </div>
          {mobileSearchOpen ? <div className="border-t border-slate-100 px-4 py-3 sm:px-6 xl:hidden"><form action="/atendimentos" method="get" className="relative"><Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" /><input autoFocus name="q" aria-label="Busca global" placeholder="Paciente, CPF, CNS, RA ou atendimento..." className="h-10 w-full rounded-xl border border-[#e1e8f1] bg-[#f7f9fc] pl-10 pr-4 text-sm text-slate-700 outline-none focus:border-brand-300 focus:bg-white focus:ring-4 focus:ring-brand-100" /></form></div> : null}
          <WorkspaceBar pathname={pathname} grantedPermissions={grantedPermissions} />
          <ContextualShortcuts pathname={pathname} grantedPermissions={grantedPermissions} />
        </header>
        <main className="mx-auto w-full max-w-[1700px] px-4 py-4 sm:px-6 sm:py-5 xl:px-8 xl:py-6">{children}</main>
      </div>
    </div>
  );
}
