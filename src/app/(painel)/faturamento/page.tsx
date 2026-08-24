import Link from "next/link";
import type { Route } from "next";
import { FileCheck2, ReceiptText, ShieldAlert } from "lucide-react";
import { SectionPage } from "@/components/painel/section-page";
import { EncounterPicker } from "@/components/atendimentos/encounter-picker";
import { createClient } from "@/lib/supabase/server";
import { criarContaAtendimento } from "@/modules/faturamento/actions";

function one<T>(rel: T | T[] | null): T | null {
  return Array.isArray(rel) ? rel[0] ?? null : rel;
}

const atalhos = [
  { href: "/contas-medicas", label: "Contas médicas", description: "Conferência e fechamento das contas." },
  { href: "/auditoria", label: "Auditoria", description: "Críticas e validação antes do envio." },
  { href: "/faturamento/lotes", label: "Lotes TISS", description: "Agrupamento, XML e protocolo de envio." },
  { href: "/faturamento/glosas", label: "Glosas e recursos", description: "Análise, recurso e acompanhamento." },
] as const;

export default async function FaturamentoPage({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const { erro } = await searchParams;
  const supabase = await createClient();
  const [{ data: atendimentos }, { data: contas }] = await Promise.all([
    supabase
      .from("atendimentos")
      .select("id,numero_atendimento,data_abertura,paciente:pacientes(nome_completo,cpf,ra,numero_registro)")
      .in("status", ["aberto", "em_espera", "em_atendimento", "alta"])
      .order("data_abertura", { ascending: false })
      .limit(300),
    supabase
      .from("contas_faturamento")
      .select("id,competencia,tipo_cobranca,status,valor_bruto,valor_liquido,atendimento:atendimentos(numero_atendimento),paciente:pacientes(nome_completo,ra,numero_registro),convenio:convenios(nome_fantasia)")
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  const encounters = (atendimentos ?? []).map((item) => {
    const paciente = one(item.paciente);
    return {
      id: item.id,
      numero_atendimento: item.numero_atendimento,
      data_abertura: item.data_abertura,
      paciente: {
        nome_completo: paciente?.nome_completo ?? "Paciente",
        cpf: paciente?.cpf ?? null,
        ra: paciente?.ra ?? "—",
        numero_registro: paciente?.numero_registro ?? 0,
      },
    };
  });

  const criticas = (contas ?? []).filter((conta) => conta.status === "com_criticas").length;
  const prontas = (contas ?? []).filter((conta) => conta.status === "pronta").length;

  return (
    <SectionPage eyebrow="Financeiro / Faturamento / TISS" title="Central de faturamento" description="Da conta assistencial ao lote TISS, concentre conferência, auditoria, envio e tratamento de glosas em um único fluxo.">
      {erro ? <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">Não foi possível processar a solicitação de faturamento.</div> : null}

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {atalhos.map((atalho) => (
          <Link key={atalho.href} href={atalho.href as Route} className="group rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-his-card">
            <p className="text-sm font-black text-slate-900">{atalho.label}</p>
            <p className="mt-1 text-xs leading-5 text-slate-500">{atalho.description}</p>
            <span className="mt-3 inline-flex text-xs font-black text-brand-600 transition group-hover:translate-x-1">Abrir →</span>
          </Link>
        ))}
      </section>

      <div className="mt-5 grid gap-4 md:grid-cols-3">
        <Card icon={ReceiptText} label="Contas" value={String(contas?.length ?? 0)} />
        <Card icon={ShieldAlert} label="Com críticas" value={String(criticas)} />
        <Card icon={FileCheck2} label="Prontas para guia" value={String(prontas)} />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <form action={criarContaAtendimento} className="ui-card p-6">
          <h2 className="font-semibold text-slate-900">Criar pré-faturamento</h2>
          <p className="mt-1 text-sm text-slate-500">Localize o atendimento por nome, CPF, RA, registro ou nº do atendimento.</p>
          <div className="mt-5"><EncounterPicker encounters={encounters} name="atendimento_id" /></div>
          <div className="mt-5 flex justify-end"><button className="ui-button-primary">Abrir conta</button></div>
        </form>

        <section className="ui-card overflow-hidden">
          <div className="border-b border-slate-100 px-5 py-4"><h2 className="font-semibold text-slate-900">Contas recentes</h2></div>
          <div className="divide-y divide-slate-100">
            {contas?.length ? contas.map((item) => {
              const paciente = one(item.paciente);
              const atendimento = one(item.atendimento);
              const convenio = one(item.convenio);
              return (
                <Link key={item.id} href={`/faturamento/${item.id}`} className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-slate-50">
                  <div>
                    <p className="font-medium text-slate-900">{paciente?.nome_completo ?? "Paciente"}</p>
                    <p className="text-xs text-slate-500">Atend. #{atendimento?.numero_atendimento ?? "—"} · Registro #{paciente?.numero_registro ?? "—"} · {paciente?.ra ?? "—"}</p>
                    <p className="mt-1 text-xs text-slate-500">{item.tipo_cobranca === "convenio" ? convenio?.nome_fantasia ?? "Convênio" : "Particular"} · Comp. {item.competencia}</p>
                  </div>
                  <div className="text-right">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${item.status === "com_criticas" ? "bg-rose-50 text-rose-700" : item.status === "pronta" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>{item.status.replaceAll("_", " ")}</span>
                    <p className="mt-2 text-sm font-semibold text-slate-800">R$ {Number(item.valor_liquido ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
                  </div>
                </Link>
              );
            }) : <p className="p-6 text-sm text-slate-500">Nenhuma conta criada.</p>}
          </div>
        </section>
      </div>
    </SectionPage>
  );
}

function Card({ icon: Icon, label, value }: { icon: typeof ReceiptText; label: string; value: string }) {
  return (
    <div className="ui-card p-5">
      <div className="flex items-center justify-between">
        <span className="grid size-10 place-items-center rounded-xl bg-brand-50 text-brand-700"><Icon className="size-5" /></span>
        <strong className="text-2xl text-slate-950">{value}</strong>
      </div>
      <p className="mt-3 text-sm font-medium text-slate-600">{label}</p>
    </div>
  );
}
