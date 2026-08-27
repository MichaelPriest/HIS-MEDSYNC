"use client";

import Link from "next/link";
import type { Route } from "next";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";
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
  Droplets,
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
  Scissors,
  Search,
  Settings,
  ShieldAlert,
  ShieldCheck,
  ShoppingCart,
  Siren,
  Stethoscope,
  Syringe,
  TicketCheck,
  Truck,
  UserCog,
  UserRound,
  UsersRound,
  WalletCards,
  Wind,
  X,
} from "lucide-react";
import { brand } from "@/config/brand";
import {
  allNavigationItems,
  inicioItem,
  navigationAreaKeysForProfile,
  navigationAreas,
  personalNavigationItems,
  type NavigationAreaConfig,
  type NavigationIconKey,
  type NavigationItemConfig,
  type ProfileNavigationMeta,
} from "@/config/navigation-map";
import { canAccessNavigation } from "@/lib/permissions/navigation";
import { ContextualShortcuts } from "@/components/painel/contextual-shortcuts";
import { ContextSwitcher } from "@/components/painel/context-switcher";

type Icon = typeof UsersRound;
type ContextOption = { id: string; nome: string };
type ResolvedGroup = NavigationAreaConfig & { items: readonly NavigationItemConfig[] };

const iconMap: Record<NavigationIconKey, Icon> = {
  activity: Activity,
  bed: BedDouble,
  book: BookOpenCheck,
  boxes: Boxes,
  building: Building2,
  cable: Cable,
  calendar: CalendarDays,
  "clipboard-check": ClipboardCheck,
  "clipboard-list": ClipboardList,
  droplets: Droplets,
  file: FileText,
  flask: FlaskConical,
  folder: FolderCog,
  handshake: Handshake,
  heart: HeartPulse,
  hospital: Hospital,
  landmark: Landmark,
  layout: LayoutDashboard,
  monitor: MonitorCog,
  pill: Pill,
  receipt: ReceiptText,
  scan: ScanLine,
  scissors: Scissors,
  settings: Settings,
  "shield-alert": ShieldAlert,
  "shield-check": ShieldCheck,
  "shopping-cart": ShoppingCart,
  siren: Siren,
  stethoscope: Stethoscope,
  syringe: Syringe,
  ticket: TicketCheck,
  truck: Truck,
  "user-cog": UserCog,
  users: UsersRound,
  wallet: WalletCards,
  wind: Wind,
};

function pathMatches(pathname: string, item: NavigationItemConfig) {
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

function activeItem(pathname: string) {
  if (pathname === inicioItem.href) return inicioItem;
  return [...allNavigationItems]
    .sort((a, b) => b.href.length - a.href.length)
    .find((item) => pathMatches(pathname, item)) ?? null;
}

function currentTitle(pathname: string) {
  if (pathname.startsWith("/manual")) return "Manual do sistema";
  if (pathname.startsWith("/meu-perfil")) return "Meu perfil";
  return activeItem(pathname)?.label ?? "MedSync HIS";
}

function hasGrant(grantedPermissions: readonly string[] | null, permission: string) {
  return grantedPermissions === null || grantedPermissions.includes(permission);
}

function visibleItem(item: NavigationItemConfig, grantedPermissions: readonly string[] | null) {
  return canAccessNavigation(grantedPermissions, item.href);
}

function resolvedGroups(
  activeProfile: ProfileNavigationMeta | null,
  grantedPermissions: readonly string[] | null,
): ResolvedGroup[] {
  const allowedAreaKeys = new Set(navigationAreaKeysForProfile(activeProfile));
  const personalItems = activeProfile
    ? personalNavigationItems(activeProfile.setorChave).filter((item) => visibleItem(item, grantedPermissions))
    : [];
  const personalHrefs = new Set(personalItems.map((item) => item.href));

  const groups = navigationAreas
    .filter((area) => allowedAreaKeys.has(area.key))
    .map((area) => ({
      ...area,
      items: area.items.filter((item) => visibleItem(item, grantedPermissions) && !personalHrefs.has(item.href)),
    }))
    .filter((area) => area.items.length > 0);

  if (!personalItems.length || !activeProfile) return groups;

  const primaryIcon = personalItems[0]?.icon ?? "activity";
  return [
    {
      key: "meu-setor",
      label: `Meu setor · ${activeProfile.nome}`,
      shortLabel: "Meu setor",
      icon: primaryIcon,
      items: personalItems,
    },
    ...groups,
  ];
}

function groupForPath(pathname: string, groups: readonly ResolvedGroup[]) {
  const item = activeItem(pathname);
  if (!item || item.href === inicioItem.href) return null;
  return groups.find((group) => group.items.some((candidate) => candidate.href === item.href)) ?? null;
}

function levelLabel(profile: ProfileNavigationMeta | null) {
  if (!profile) return "Todos os perfis";
  if (profile.nivelAcesso === "administrador") return "Administrador";
  if (profile.nivelAcesso === "gestao") return "Gestão";
  if (profile.nivelAcesso === "supervisao") return "Supervisão";
  return "Operacional";
}

function SidebarContent({
  onNavigate,
  unidadeId,
  unidadeNome,
  grantedPermissions,
  activeProfile,
  collapsed = false,
  onToggleCollapsed,
  onExpand,
}: {
  onNavigate?: () => void;
  unidadeId?: string | null;
  unidadeNome?: string | null;
  grantedPermissions: readonly string[] | null;
  activeProfile: ProfileNavigationMeta | null;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
  onExpand?: () => void;
}) {
  const pathname = usePathname();
  const groups = useMemo(
    () => resolvedGroups(activeProfile, grantedPermissions),
    [activeProfile, grantedPermissions],
  );
  const selected = activeItem(pathname);
  const selectedGroup = groupForPath(pathname, groups);
  const [openGroup, setOpenGroup] = useState<string | null>(() => selectedGroup?.key ?? groups[0]?.key ?? null);

  const navLink = (item: NavigationItemConfig) => {
    const active = selected?.href === item.href;
    const ItemIcon = iconMap[item.icon];
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
        <span className={`grid size-8 shrink-0 place-items-center rounded-lg ${active ? "bg-cyan-300/10 text-cyan-300" : "text-white/42 group-hover:text-white/75"}`}>
          <ItemIcon className="size-4" />
        </span>
        {collapsed ? null : <span className="truncate">{item.label}</span>}
      </Link>
    );
  };

  const navGroup = (group: ResolvedGroup) => {
    const active = selectedGroup?.key === group.key;
    const open = openGroup === group.key;
    const GroupIcon = iconMap[group.icon];
    const personal = group.key === "meu-setor";
    return (
      <div key={group.key} className={personal && !collapsed ? "rounded-2xl border border-cyan-300/10 bg-cyan-300/[0.045] p-1" : undefined}>
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
          className={`flex w-full items-center rounded-xl text-sm font-semibold transition ${collapsed ? "justify-center px-2 py-2.5" : "gap-3 px-3 py-2.5"} ${active || personal ? "bg-white/[0.08] text-white" : "text-white/68 hover:bg-white/[0.07] hover:text-white"}`}
        >
          <span className={`grid size-8 shrink-0 place-items-center rounded-lg ${active || personal ? "text-cyan-300" : "text-white/45"}`}><GroupIcon className="size-4" /></span>
          {collapsed ? null : <><span className="min-w-0 flex-1 truncate text-left">{group.label}</span>{open ? <ChevronDown className="size-4 text-white/35" /> : <ChevronRight className="size-4 text-white/35" />}</>}
        </button>
        {!collapsed && open ? <div className="ml-7 mt-1 space-y-1 border-l border-white/[0.08] pl-2.5">{group.items.map(navLink)}</div> : null}
      </div>
    );
  };

  const canUseReceptionTerminals = canAccessNavigation(grantedPermissions, "/senhas");
  const HomeIcon = activeProfile?.paginaInicial
    ? iconMap[allNavigationItems.find((item) => item.href === activeProfile.paginaInicial)?.icon ?? "layout"]
    : LayoutDashboard;

  return (
    <div className="flex h-full flex-col bg-[radial-gradient(circle_at_top_left,_rgba(37,99,235,.20),_transparent_30%),linear-gradient(180deg,#0b1f44_0%,#07162f_100%)]">
      <div className={`flex items-center border-b border-white/[0.08] ${collapsed ? "justify-center px-2 py-4" : "gap-2 px-5 py-4.5"}`}>
        <Link href="/painel" onClick={onNavigate} className={`flex min-w-0 items-center ${collapsed ? "justify-center" : "flex-1 gap-3.5"}`} title={collapsed ? brand.shortName : undefined}>
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-cyan-400 to-blue-500 text-white shadow-lg shadow-blue-950/30"><HeartPulse className="size-5" /></span>
          {collapsed ? null : <span className="min-w-0"><strong className="block truncate text-[17px] font-bold tracking-tight text-white">{brand.shortName}</strong><span className="mt-0.5 block truncate text-[9px] font-semibold uppercase tracking-[0.17em] text-cyan-100/45">Hospital Information System</span></span>}
        </Link>
        {onToggleCollapsed ? <button type="button" onClick={onToggleCollapsed} aria-label={collapsed ? "Expandir menu lateral" : "Recolher menu lateral"} className="hidden rounded-lg p-2 text-white/50 hover:bg-white/10 hover:text-white lg:grid"><ChevronRight className={`size-4 transition ${collapsed ? "" : "rotate-180"}`} /></button> : null}
      </div>

      <div className={`flex-1 overflow-y-auto py-4 ${collapsed ? "px-2" : "px-3"}`}>
        {collapsed ? null : <p className="px-3 text-[10px] font-bold uppercase tracking-[0.2em] text-white/30">Início</p>}
        <nav className={`${collapsed ? "" : "mt-2"} space-y-1`} aria-label="Navegação principal">{navLink(inicioItem)}</nav>

        {activeProfile?.paginaInicial && activeProfile.paginaInicial !== "/painel" && canAccessNavigation(grantedPermissions, activeProfile.paginaInicial) ? (
          <Link
            href={activeProfile.paginaInicial as Route}
            onClick={onNavigate}
            title={collapsed ? "Ir para meu setor" : undefined}
            className={`mt-2 flex items-center rounded-xl border border-cyan-300/10 bg-cyan-300/[0.065] text-sm font-semibold text-cyan-50/90 hover:bg-cyan-300/[0.11] ${collapsed ? "justify-center px-2 py-2.5" : "gap-3 px-3 py-2.5"}`}
          >
            <span className="grid size-8 place-items-center rounded-lg text-cyan-300"><HomeIcon className="size-4" /></span>
            {collapsed ? null : <span className="truncate">Ir para meu setor</span>}
          </Link>
        ) : null}

        <div className={`${collapsed ? "mt-2" : "mt-4 border-t border-white/[0.07] pt-4"} space-y-1.5`}>{groups.map(navGroup)}</div>

        {unidadeId && canUseReceptionTerminals ? (
          <div className={`${collapsed ? "mt-3 border-t border-white/[0.07] pt-3" : "mt-5 border-t border-white/[0.07] pt-4"}`}>
            {collapsed ? null : <p className="px-3 text-[10px] font-bold uppercase tracking-[0.2em] text-white/30">Terminais</p>}
            <div className={`${collapsed ? "" : "mt-2"} space-y-2`}>
              <Link href={`/totem/${unidadeId}` as Route} target="_blank" className={`flex items-center rounded-xl border border-cyan-300/10 bg-cyan-300/[0.055] text-sm font-semibold text-cyan-50/80 hover:bg-cyan-300/[0.10] ${collapsed ? "justify-center px-2 py-2.5" : "gap-3 px-3 py-2.5"}`}><ScanLine className="size-4 text-cyan-300" />{collapsed ? null : "Totem de senhas"}</Link>
              <Link href={`/painel-chamadas/${unidadeId}` as Route} target="_blank" className={`flex items-center rounded-xl border border-cyan-300/10 bg-cyan-300/[0.055] text-sm font-semibold text-cyan-50/80 hover:bg-cyan-300/[0.10] ${collapsed ? "justify-center px-2 py-2.5" : "gap-3 px-3 py-2.5"}`}><MonitorCog className="size-4 text-cyan-300" />{collapsed ? null : "Painel de chamadas"}</Link>
            </div>
          </div>
        ) : null}
      </div>

      <div className={`border-t border-white/[0.08] ${collapsed ? "p-2" : "p-3.5"}`}>
        <div className="rounded-xl border border-white/[0.09] bg-white/[0.055] px-3 py-2.5">
          <div className="flex items-center gap-2.5"><MapPin className="size-4 shrink-0 text-cyan-300" />{collapsed ? null : <div className="min-w-0"><p className="text-[10px] font-bold uppercase tracking-wider text-white/35">Contexto operacional</p><p className="truncate text-xs font-semibold text-white/85">{unidadeNome ?? "Unidade hospitalar"}</p><p className="mt-0.5 truncate text-[10px] font-semibold text-cyan-200/70">{activeProfile ? `${activeProfile.nome} · ${levelLabel(activeProfile)}` : "Todos os perfis"}</p></div>}</div>
        </div>
      </div>
    </div>
  );
}

function WorkspaceBar({
  pathname,
  grantedPermissions,
  activeProfile,
}: {
  pathname: string;
  grantedPermissions: readonly string[] | null;
  activeProfile: ProfileNavigationMeta | null;
}) {
  const groups = resolvedGroups(activeProfile, grantedPermissions);
  const group = groupForPath(pathname, groups);
  const selected = activeItem(pathname);
  if (!group || !group.items.length) return null;
  const GroupIcon = iconMap[group.icon];
  return (
    <div className="border-t border-slate-100 bg-slate-50/70">
      <div className="flex min-h-10 items-center gap-1.5 overflow-x-auto px-4 sm:px-6 xl:px-8">
        <span className="sticky left-0 z-10 mr-1 inline-flex shrink-0 items-center gap-1.5 bg-slate-50/95 pr-2 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400"><GroupIcon className="size-3.5" />{group.shortLabel}</span>
        {group.items.map((item) => {
          const active = selected?.href === item.href;
          const ItemIcon = iconMap[item.icon];
          return <Link key={item.href} href={item.href as Route} className={`inline-flex h-10 shrink-0 items-center gap-1.5 border-b-2 px-2.5 text-xs font-semibold ${active ? "border-brand-600 text-brand-800" : "border-transparent text-slate-500 hover:text-slate-800"}`}><ItemIcon className="size-3.5" />{item.label}</Link>;
        })}
      </div>
    </div>
  );
}

function UserMenu({
  email,
  userName,
  userPhotoUrl,
  unidadeNome,
  empresaNome,
  profileNames,
  activeProfile,
  grantedPermissions,
  logoutAction,
}: {
  email?: string | null;
  userName: string;
  userPhotoUrl?: string | null;
  unidadeNome?: string | null;
  empresaNome?: string | null;
  profileNames: readonly string[];
  activeProfile: ProfileNavigationMeta | null;
  grantedPermissions: readonly string[] | null;
  logoutAction: (formData: FormData) => void | Promise<void>;
}) {
  const initial = (userName || email || "U").slice(0, 1).toUpperCase();
  const canManageAccess = canAccessNavigation(grantedPermissions, "/configuracoes/acessos");
  return (
    <details className="relative">
      <summary className="flex cursor-pointer list-none items-center gap-2 rounded-xl border border-slate-200 bg-white p-1.5 pr-2 shadow-sm">
        <span className="grid size-8 place-items-center rounded-lg bg-brand-100 bg-cover bg-center text-xs font-black text-brand-800" style={userPhotoUrl ? { backgroundImage: `url(${userPhotoUrl})` } : undefined}>{userPhotoUrl ? null : initial}</span>
        <span className="hidden max-w-32 truncate text-xs font-bold text-slate-800 md:block">{userName}</span><ChevronDown className="size-4 text-slate-400" />
      </summary>
      <div className="absolute right-0 mt-2 w-[19rem] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="border-b border-slate-100 bg-slate-50/70 p-4"><p className="font-black text-slate-900">{userName}</p><p className="mt-1 truncate text-xs text-slate-500">{email}</p><div className="mt-3 rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-600"><p className="font-semibold">{empresaNome ?? "Empresa"}</p><p className="mt-1">{unidadeNome ?? "Unidade"}</p><p className="mt-1 font-semibold text-brand-700">{profileNames.length ? profileNames.join(", ") : "Todos os perfis"}</p>{activeProfile ? <p className="mt-1 text-[11px] text-slate-500">Nível: {levelLabel(activeProfile)}</p> : null}</div></div>
        <div className="p-2"><Link href="/meu-perfil" className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm text-slate-700 hover:bg-slate-50"><UserRound className="size-4" />Meu perfil</Link>{activeProfile?.paginaInicial && activeProfile.paginaInicial !== "/painel" ? <Link href={activeProfile.paginaInicial as Route} className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold text-brand-700 hover:bg-brand-50"><MapPin className="size-4" />Meu setor</Link> : null}{canManageAccess ? <Link href="/configuracoes/acessos" className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm text-slate-700 hover:bg-slate-50"><UserCog className="size-4" />Usuários e acessos</Link> : null}<Link href="/manual" className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm text-slate-700 hover:bg-slate-50"><HelpCircle className="size-4" />Manual</Link><div className="my-1 h-px bg-slate-100" /><form action={logoutAction}><button className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold text-rose-600 hover:bg-rose-50"><LogOut className="size-4" />Sair</button></form></div>
      </div>
    </details>
  );
}

export function AppShellContextual({
  children,
  email,
  userName = "Usuário",
  userPhotoUrl,
  unidadeId,
  unidadeNome,
  empresaNome,
  profileNames = [],
  activeProfile = null,
  grantedPermissions = null,
  profileOptions = [],
  unitOptions = [],
  selectedProfileId = "all",
  selectedUnitId = "all",
  logoutAction,
}: {
  children: React.ReactNode;
  email?: string | null;
  userName?: string;
  userPhotoUrl?: string | null;
  unidadeId?: string | null;
  unidadeNome?: string | null;
  empresaNome?: string | null;
  profileNames?: readonly string[];
  activeProfile?: ProfileNavigationMeta | null;
  grantedPermissions?: readonly string[] | null;
  profileOptions?: readonly ContextOption[];
  unitOptions?: readonly ContextOption[];
  selectedProfileId?: string;
  selectedUnitId?: string;
  logoutAction: (formData: FormData) => void | Promise<void>;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [desktopCollapsed, setDesktopCollapsed] = useState(false);
  const pathname = usePathname();
  const groups = useMemo(() => resolvedGroups(activeProfile, grantedPermissions), [activeProfile, grantedPermissions]);
  const title = currentTitle(pathname);
  const group = groupForPath(pathname, groups);
  const canCreateAttendance = hasGrant(grantedPermissions, "atendimentos.abrir");
  const canOpenEmergency = canAccessNavigation(grantedPermissions, "/assistencial/urgencia");

  return (
    <div className={`min-h-screen bg-[#f4f7fb] lg:grid ${desktopCollapsed ? "lg:grid-cols-[5rem_1fr]" : "lg:grid-cols-[18.5rem_1fr]"}`}>
      <aside className="hidden text-white lg:sticky lg:top-0 lg:block lg:h-screen"><SidebarContent unidadeId={unidadeId} unidadeNome={unidadeNome} grantedPermissions={grantedPermissions} activeProfile={activeProfile} collapsed={desktopCollapsed} onToggleCollapsed={() => setDesktopCollapsed((value) => !value)} onExpand={() => setDesktopCollapsed(false)} /></aside>

      {mobileOpen ? <div className="fixed inset-0 z-50 lg:hidden"><button aria-label="Fechar menu" className="absolute inset-0 bg-slate-950/55" onClick={() => setMobileOpen(false)} /><aside className="relative h-full w-[19rem] max-w-[90vw] text-white"><button aria-label="Fechar menu" onClick={() => setMobileOpen(false)} className="absolute right-3 top-3 z-10 rounded-lg p-2 text-white"><X className="size-5" /></button><SidebarContent unidadeId={unidadeId} unidadeNome={unidadeNome} grantedPermissions={grantedPermissions} activeProfile={activeProfile} onNavigate={() => setMobileOpen(false)} /></aside></div> : null}

      <div className="min-w-0">
        <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur-xl">
          <div className="flex min-h-[68px] items-center gap-3 px-4 py-2 sm:px-6 xl:px-8">
            <button onClick={() => setMobileOpen(true)} aria-label="Abrir menu" className="rounded-xl border border-slate-200 p-2.5 text-slate-600 lg:hidden"><Menu className="size-5" /></button>
            <div className="min-w-0 shrink-0"><div className="hidden items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400 sm:flex"><span>{group?.shortLabel ?? (activeProfile ? "Meu setor" : "MedSync HIS")}</span>{group ? <><ChevronRight className="size-3" /><span className="text-brand-600">Área atual</span></> : null}</div><h2 className="truncate text-[15px] font-black text-slate-850 sm:text-base">{title}</h2></div>
            <div className="hidden min-w-0 flex-1 justify-center 2xl:flex"><form action="/atendimentos" method="get" className="relative w-full max-w-md"><Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" /><input name="q" aria-label="Busca global" placeholder="Paciente, CPF, CNS, RA ou atendimento..." className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm outline-none focus:bg-white" /></form></div>
            <div className="ml-auto flex items-center gap-2">
              <ContextSwitcher profiles={profileOptions} units={unitOptions} selectedProfileId={selectedProfileId} selectedUnitId={selectedUnitId} />
              <button onClick={() => setMobileSearchOpen((value) => !value)} aria-label="Abrir busca" className="rounded-xl border border-slate-200 p-2.5 text-slate-600 2xl:hidden"><Search className="size-4" /></button>
              {canOpenEmergency ? <Link href="/assistencial/urgencia" className="hidden items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 2xl:inline-flex"><Siren className="size-4" />Urgência</Link> : null}
              {canCreateAttendance ? <Link href="/atendimentos" className="hidden items-center gap-1.5 rounded-xl bg-brand-700 px-3.5 py-2 text-xs font-bold text-white xl:inline-flex"><Plus className="size-4" />Novo atendimento</Link> : null}
              <UserMenu email={email} userName={userName} userPhotoUrl={userPhotoUrl} unidadeNome={unidadeNome} empresaNome={empresaNome} profileNames={profileNames} activeProfile={activeProfile} grantedPermissions={grantedPermissions} logoutAction={logoutAction} />
            </div>
          </div>
          {mobileSearchOpen ? <div className="border-t border-slate-100 px-4 py-3 2xl:hidden"><form action="/atendimentos" method="get" className="relative"><Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" /><input autoFocus name="q" className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm" placeholder="Paciente, CPF, CNS, RA ou atendimento..." /></form></div> : null}
          <WorkspaceBar pathname={pathname} grantedPermissions={grantedPermissions} activeProfile={activeProfile} />
          <ContextualShortcuts pathname={pathname} grantedPermissions={grantedPermissions} />
        </header>
        <main className="mx-auto w-full max-w-[1700px] px-4 py-4 sm:px-6 sm:py-5 xl:px-8 xl:py-6">{children}</main>
      </div>
    </div>
  );
}
