import Link from "next/link";
import type { Route } from "next";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  ClipboardList,
  FileCheck2,
  ListPlus,
  ReceiptText,
  Search,
  ShieldAlert,
  Stethoscope,
  UserRound,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";

type Rel<T> = T | T[] | null;
type Paciente = { nome_completo: string | null; ra: string | null; numero_registro: string | number | null };
type Atendimento = { numero_atendimento: string | number | null; tipo_atendimento: string | null; status: string | null };
type Convenio = { nome_fantasia: string | null };
type Plano = { nome: string | null };

function one<T>(value: Rel<T>): T | null {
  return Array.isArray(value) ? value[0] ?? null : value;
}

function brl(value: number | string | null | undefined) {
  return Number(value ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function statusTone(status: string) {
  if (status === "com_criticas") return "border-rose-200 bg-rose-50 text-rose-800";
  if (status === "pronta") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (status === "faturada") return "border-brand-200 bg-brand-50 text-brand-800";
  if (status === "cancelada") return "border-slate-200 bg-slate-100 text-slate-600";
  return "border-amber-200 bg-amber-50 text-amber-800";
}

export default async function ContaLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ contaId: string }>;
}) {
  const { contaId } = await params;
  const supabase = await createClient();
  const { data: conta } = await supabase
    .from("contas_faturamento")
    .select("id,atendimento_id,status,competencia,valor_liquido,paciente:pacientes(nome_completo,ra,numero_registro),atendimento:atendimentos(numero_atendimento,tipo_atendimento,status),convenio:convenios(nome_fantasia),plano:convenio_planos(nome)")
    .eq("id", contaId)
    .maybeSingle();

  const paciente = conta ? one(conta.paciente as Rel<Paciente>) : null;
  const atendimento = conta ? one(conta.atendimento as Rel<Atendimento>) : null;
  const convenio = conta ? one(conta.convenio as Rel<Convenio>) : null;
  const plano = conta ? one(conta.plano as Rel<Plano>) : null;
  const locked = conta ? ["faturada", "cancelada"].includes(conta.status) : false;

  const links = [
    { href: `/faturamento/${contaId}` as Route, label: "Resumo", detail: "Conta e valores", icon: ReceiptText },
    { href: `/faturamento/${contaId}/lancamentos` as Route, label: "Lançamentos", detail: "Itens faturáveis", icon: ListPlus },
    { href: `/faturamento/${contaId}/catalogo` as Route, label: "Catálogo", detail: "Tabelas do contrato", icon: Search },
    { href: `/faturamento/${contaId}/procedimentos-cirurgicos` as Route, label: "Cirurgia / SADT", detail: "Atos e equipe", icon: Stethoscope },
    { href: `/faturamento/${contaId}#autorizacoes` as Route, label: "Guias / Autorizações", detail: "Cobertura e senhas", icon: FileCheck2 },
    { href: `/faturamento/${contaId}#producao` as Route, label: "Produção", detail: "Origem assistencial", icon: Activity },
    { href: `/faturamento/${contaId}#criticas` as Route, label: "Críticas", detail: "Pendências da conta", icon: ShieldAlert },
    ...(conta?.atendimento_id ? [{ href: `/prontuario/${conta.atendimento_id}/clinico` as Route, label: "Prontuário", detail: "Contexto clínico", icon: UserRound }] : []),
  ];

  return <>
    <div className="mx-auto w-full max-w-[1680px] px-4 pt-4 sm:px-6 lg:px-8">
      <section className="sticky top-3 z-20 overflow-hidden rounded-3xl border border-slate-200 bg-white/95 shadow-lg shadow-slate-950/5 backdrop-blur">
        <div className="border-b border-slate-100 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-800 px-4 py-4 text-white sm:px-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <ClipboardList className="size-4 text-brand-300" />
                <span className="text-[10px] font-black uppercase tracking-[.16em] text-slate-300">Cockpit da conta hospitalar</span>
                {conta ? <span className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase ${statusTone(conta.status)}`}>{conta.status.replaceAll("_", " ")}</span> : null}
                {locked ? <span className="inline-flex items-center gap-1 rounded-full border border-rose-300/40 bg-rose-400/10 px-2.5 py-1 text-[10px] font-black uppercase text-rose-200"><AlertTriangle className="size-3" />Conta protegida</span> : null}
              </div>
              <h2 className="mt-2 truncate text-lg font-black sm:text-xl">{paciente?.nome_completo ?? "Conta hospitalar"}</h2>
              <p className="mt-1 text-xs font-semibold text-slate-300">RA {paciente?.ra ?? "—"} · Registro {paciente?.numero_registro ?? "—"} · Atendimento #{atendimento?.numero_atendimento ?? "—"}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {conta ? <div className="rounded-2xl border border-white/10 bg-white/10 px-3 py-2 text-right"><p className="text-[9px] font-black uppercase tracking-wider text-slate-300">Valor líquido</p><p className="text-sm font-black text-white">{brl(conta.valor_liquido)}</p></div> : null}
              <Link href="/faturamento/contas" className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-xs font-black text-white transition hover:bg-white/15"><ArrowLeft className="size-4" />Relação de contas</Link>
            </div>
          </div>
        </div>

        {conta ? <div className="grid gap-px border-b border-slate-100 bg-slate-100 sm:grid-cols-2 lg:grid-cols-4">
          <Info label="Convênio / plano" value={`${convenio?.nome_fantasia ?? "Particular"}${plano?.nome ? ` · ${plano.nome}` : ""}`} />
          <Info label="Tipo de atendimento" value={atendimento?.tipo_atendimento ?? "Não informado"} />
          <Info label="Competência" value={conta.competencia ?? "—"} />
          <Info label="Situação do episódio" value={atendimento?.status?.replaceAll("_", " ") ?? "—"} />
        </div> : null}

        <nav className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-4 xl:grid-cols-8" aria-label="Tarefas da conta hospitalar">
          {links.map(({ href, label, detail, icon: Icon }) => <Link key={`${href}-${label}`} href={href} className="group flex min-w-0 items-center gap-2.5 rounded-2xl border border-slate-200 bg-white p-2.5 transition hover:border-brand-200 hover:bg-brand-50/50">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-600 transition group-hover:bg-brand-100 group-hover:text-brand-700"><Icon className="size-4" /></span>
            <span className="min-w-0"><strong className="block truncate text-xs text-slate-900">{label}</strong><span className="mt-0.5 hidden truncate text-[10px] font-semibold text-slate-400 sm:block">{detail}</span></span>
          </Link>)}
        </nav>
      </section>
    </div>
    {children}
  </>;
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="bg-white px-4 py-2.5"><p className="text-[9px] font-black uppercase tracking-wider text-slate-400">{label}</p><p className="mt-0.5 truncate text-xs font-bold text-slate-800">{value}</p></div>;
}
