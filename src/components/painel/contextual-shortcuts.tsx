"use client";

import Link from "next/link";
import type { Route } from "next";
import {
  Activity,
  BedDouble,
  ClipboardCheck,
  ClipboardList,
  FileText,
  HeartPulse,
  Hospital,
  Pill,
  Plus,
  ReceiptText,
  ShieldCheck,
  ShoppingCart,
  Siren,
  Stethoscope,
  TicketCheck,
  UsersRound,
  WalletCards,
} from "lucide-react";
import { canAccessNavigation } from "@/lib/permissions/navigation";

type Icon = typeof UsersRound;
type Shortcut = {
  href: string;
  label: string;
  icon: Icon;
  permission?: string;
};

type ShortcutRule = {
  path: string;
  shortcuts: Shortcut[];
};

const rules: ShortcutRule[] = [
  {
    path: "/senhas",
    shortcuts: [
      { href: "/pacientes/novo", label: "Cadastrar paciente", icon: Plus, permission: "pacientes.criar" },
      { href: "/pacientes", label: "Consultar pacientes", icon: UsersRound },
      { href: "/atendimentos", label: "Atendimentos", icon: ClipboardList },
      { href: "/triagem", label: "Triagem", icon: HeartPulse },
    ],
  },
  {
    path: "/atendimentos",
    shortcuts: [
      { href: "/pacientes/novo", label: "Cadastrar paciente", icon: Plus, permission: "pacientes.criar" },
      { href: "/senhas", label: "Recepção / Senhas", icon: TicketCheck },
      { href: "/triagem", label: "Triagem", icon: HeartPulse },
      { href: "/autorizacoes", label: "Autorizações", icon: ShieldCheck },
    ],
  },
  {
    path: "/triagem",
    shortcuts: [
      { href: "/senhas", label: "Recepção / Senhas", icon: TicketCheck },
      { href: "/atendimentos", label: "Atendimentos", icon: ClipboardList },
      { href: "/fila-medica", label: "Fila médica", icon: Stethoscope },
      { href: "/assistencial/urgencia", label: "Urgência", icon: Siren },
    ],
  },
  {
    path: "/fila-medica",
    shortcuts: [
      { href: "/triagem", label: "Triagem", icon: HeartPulse },
      { href: "/prontuario", label: "Prontuário", icon: ClipboardCheck },
      { href: "/assistencial/urgencia", label: "Urgência", icon: Siren },
    ],
  },
  {
    path: "/prontuario",
    shortcuts: [
      { href: "/prescricao", label: "Prescrição", icon: Pill },
      { href: "/assistencial/urgencia", label: "Urgência", icon: Siren },
      { href: "/assistencial", label: "Central assistencial", icon: Activity },
      { href: "/internacao", label: "Internação", icon: BedDouble },
    ],
  },
  {
    path: "/assistencial/urgencia",
    shortcuts: [
      { href: "/fila-medica", label: "Fila médica", icon: Stethoscope },
      { href: "/prontuario", label: "Prontuário", icon: ClipboardCheck },
      { href: "/prescricao", label: "Prescrição", icon: Pill },
      { href: "/internacao", label: "Internação", icon: BedDouble },
    ],
  },
  {
    path: "/internacao/altas",
    shortcuts: [
      { href: "/internacao", label: "Painel da internação", icon: Hospital },
      { href: "/internacao/leitos", label: "Mapa de leitos", icon: BedDouble },
      { href: "/internacao/nir", label: "NIR / Gestão de leitos", icon: Hospital },
      { href: "/prontuario", label: "Prontuário", icon: ClipboardCheck },
    ],
  },
  {
    path: "/internacao/leitos",
    shortcuts: [
      { href: "/internacao", label: "Painel da internação", icon: Hospital },
      { href: "/internacao/nir", label: "NIR / Gestão de leitos", icon: Hospital },
      { href: "/internacao/altas", label: "Central de altas", icon: ClipboardCheck },
    ],
  },
  {
    path: "/internacao/nir",
    shortcuts: [
      { href: "/internacao", label: "Painel da internação", icon: Hospital },
      { href: "/internacao/leitos", label: "Mapa de leitos", icon: BedDouble },
      { href: "/internacao/altas", label: "Central de altas", icon: ClipboardCheck },
    ],
  },
  {
    path: "/internacao",
    shortcuts: [
      { href: "/internacao/leitos", label: "Mapa de leitos", icon: BedDouble },
      { href: "/internacao/nir", label: "NIR / Gestão de leitos", icon: Hospital },
      { href: "/internacao/altas", label: "Central de altas", icon: ClipboardCheck },
      { href: "/prontuario", label: "Prontuário", icon: ClipboardCheck },
    ],
  },
  {
    path: "/central-guias",
    shortcuts: [
      { href: "/autorizacoes", label: "Autorizações", icon: ShieldCheck },
      { href: "/contas-medicas", label: "Contas médicas", icon: ClipboardCheck },
      { href: "/faturamento", label: "Pré-faturamento", icon: ReceiptText },
    ],
  },
  {
    path: "/autorizacoes",
    shortcuts: [
      { href: "/central-guias", label: "Guias", icon: ClipboardCheck },
      { href: "/atendimentos", label: "Atendimentos", icon: ClipboardList },
      { href: "/faturamento", label: "Pré-faturamento", icon: ReceiptText },
    ],
  },
  {
    path: "/faturamento/glosas",
    shortcuts: [
      { href: "/faturamento", label: "Pré-faturamento", icon: ReceiptText },
      { href: "/faturamento/lotes", label: "Lotes TISS", icon: FileText },
      { href: "/financeiro", label: "Recebimentos", icon: WalletCards },
    ],
  },
  {
    path: "/faturamento/lotes",
    shortcuts: [
      { href: "/central-guias", label: "Guias", icon: ClipboardCheck },
      { href: "/faturamento", label: "Pré-faturamento", icon: ReceiptText },
      { href: "/faturamento/glosas", label: "Glosas", icon: ReceiptText },
    ],
  },
  {
    path: "/faturamento",
    shortcuts: [
      { href: "/contas-medicas", label: "Contas médicas", icon: ClipboardCheck },
      { href: "/faturamento/lotes", label: "Lotes TISS", icon: FileText },
      { href: "/faturamento/glosas", label: "Glosas", icon: ReceiptText },
      { href: "/financeiro", label: "Financeiro", icon: WalletCards },
    ],
  },
  {
    path: "/financeiro",
    shortcuts: [
      { href: "/financeiro/notas-fiscais", label: "Notas fiscais", icon: FileText },
      { href: "/faturamento/glosas", label: "Glosas", icon: ReceiptText },
      { href: "/faturamento/lotes", label: "Lotes TISS", icon: ReceiptText },
    ],
  },
  {
    path: "/compras",
    shortcuts: [
      { href: "/almoxarifado", label: "Estoque / Almoxarifado", icon: ShoppingCart },
    ],
  },
  {
    path: "/almoxarifado",
    shortcuts: [
      { href: "/compras", label: "Compras", icon: ShoppingCart },
    ],
  },
  {
    path: "/pacientes",
    shortcuts: [
      { href: "/pacientes/novo", label: "Novo paciente", icon: Plus, permission: "pacientes.criar" },
      { href: "/senhas", label: "Recepção / Senhas", icon: TicketCheck },
      { href: "/atendimentos", label: "Atendimentos", icon: ClipboardList },
    ],
  },
];

function hasGrant(grantedPermissions: readonly string[] | null, permission?: string) {
  if (!permission) return true;
  return grantedPermissions === null || grantedPermissions.includes(permission);
}

export function ContextualShortcuts({
  pathname,
  grantedPermissions,
}: {
  pathname: string;
  grantedPermissions: readonly string[] | null;
}) {
  const rule = [...rules]
    .sort((a, b) => b.path.length - a.path.length)
    .find((item) => pathname === item.path || pathname.startsWith(`${item.path}/`));

  if (!rule) return null;

  const shortcuts = rule.shortcuts.filter((item) =>
    hasGrant(grantedPermissions, item.permission)
    && canAccessNavigation(grantedPermissions, item.href),
  );

  if (!shortcuts.length) return null;

  return (
    <div className="border-t border-slate-100 bg-white">
      <div className="flex min-h-11 items-center gap-2 overflow-x-auto px-4 sm:px-6 xl:px-8">
        <span className="shrink-0 text-[10px] font-bold uppercase tracking-[0.13em] text-slate-400">Atalhos</span>
        {shortcuts.map((item) => {
          const ShortcutIcon = item.icon;
          return (
            <Link
              key={`${rule.path}-${item.href}-${item.label}`}
              href={item.href as Route}
              className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-xs font-semibold text-slate-600 transition hover:border-brand-200 hover:bg-brand-50 hover:text-brand-800"
            >
              <ShortcutIcon className="size-3.5" />
              {item.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
