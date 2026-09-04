import Link from "next/link";
import type { Route } from "next";
import { ArrowLeftRight, BadgeCheck, BookOpenCheck, Building2, Calculator, ClipboardCheck, Grid3X3, Handshake, ReceiptText, Scale, ShieldCheck, Stethoscope, Unlink, UsersRound } from "lucide-react";

const items=[
  {href:"/cadastros/tiss",label:"Prontidão TISS",icon:ShieldCheck},
  {href:"/pacientes",label:"Pacientes",icon:UsersRound},
  {href:"/profissionais",label:"Profissionais",icon:Stethoscope},
  {href:"/convenios",label:"Convênios",icon:Building2},
  {href:"/catalogos",label:"Catálogos",icon:BookOpenCheck},
  {href:"/comercial",label:"Credenciamento e contratos",icon:Handshake},
  {href:"/comercial/vinculos",label:"Vínculos e histórico",icon:Unlink},
  {href:"/comercial/prontidao",label:"Prontidão comercial",icon:ClipboardCheck},
  {href:"/comercial/simulador",label:"Simulador de preço",icon:Calculator},
  {href:"/comercial/matriz",label:"Matriz de cenários",icon:Grid3X3},
  {href:"/comercial/homologacao",label:"Homologação comercial",icon:BadgeCheck},
  {href:"/comercial/tabelas",label:"Fontes e edições",icon:ReceiptText},
  {href:"/comercial/regras",label:"Regras, CBHPM e pacotes",icon:Scale},
  {href:"/comercial/depara",label:"DePara TUSS",icon:ArrowLeftRight},
] as const;

export function CadastrosWorkspaceNav({active}:{active:string}){
  return <nav aria-label="Cadastros e contratos" className="mb-5 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-sm shadow-slate-900/[0.03]"><div className="flex min-w-max gap-1">{items.map(item=>{const Icon=item.icon;const selected=active===item.href||(item.href!=="/comercial"&&active.startsWith(`${item.href}/`));return <Link key={item.href} href={item.href as Route} className={`flex items-center gap-2 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition ${selected?"bg-slate-950 text-white shadow-sm":"text-slate-600 hover:bg-slate-100 hover:text-slate-950"}`}><Icon className="size-4"/>{item.label}</Link>})}</div></nav>;
}

export function CadastroKpi({label,value,detail}:{label:string;value:string|number;detail?:string}){
  return <div className="his-kpi"><p className="text-xs font-black uppercase tracking-wide text-slate-400">{label}</p><p className="mt-2 text-2xl font-black text-slate-950">{value}</p>{detail?<p className="mt-1 text-xs text-slate-500">{detail}</p>:null}</div>;
}
