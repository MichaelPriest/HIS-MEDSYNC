import Link from "next/link";
import type { Route } from "next";
import { Clock3, Pill, ShieldCheck } from "lucide-react";
import { redirect } from "next/navigation";
import { SectionPage } from "@/components/painel/section-page";
import { EncounterPicker } from "@/components/atendimentos/encounter-picker";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function PrescricaoPage({ searchParams }: { searchParams: Promise<{ atendimento?: string }> }) {
  const params = await searchParams;
  const supabase = await createClient();
  const [{ data: atendimentos }, { data: recentes }] = await Promise.all([
    supabase.from("atendimentos")
      .select("id,numero_atendimento,data_abertura,paciente:pacientes(nome_completo,cpf,ra,numero_registro)")
      .in("status", ["aberto", "em_espera", "em_atendimento"])
      .order("data_abertura", { ascending: false })
      .limit(300),
    supabase.from("prescricoes")
      .select("id,item,dose,via,frequencia,status,assinado_em,requer_validacao_farmaceutica,created_at,atendimento_id,atendimento:atendimentos(numero_atendimento,paciente:pacientes(nome_completo,ra,numero_registro)),profissional:profissionais(nome_completo)")
      .order("created_at", { ascending: false })
      .limit(60),
  ]);

  const validIds = new Set((atendimentos ?? []).map((item) => item.id));
  if (params.atendimento && validIds.has(params.atendimento)) {
    redirect(`/prontuario/${params.atendimento}/prescricao` as Route);
  }

  const encounters = (atendimentos ?? []).map((item) => {
    const paciente = Array.isArray(item.paciente) ? item.paciente[0] : item.paciente;
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

  const rascunhos = (recentes ?? []).filter((item) => item.status === "rascunho").length;
  const ativas = (recentes ?? []).filter((item) => item.status === "ativa").length;
  const validacao = (recentes ?? []).filter((item) => item.status === "ativa" && item.requer_validacao_farmaceutica).length;

  return <SectionPage eyebrow="Assistência / Prescrição" title="Prescrição" description="Selecione o atendimento. A prescrição é aberta diretamente no prontuário do paciente, usando catálogo institucional e o profissional do usuário logado.">
    <section className="grid gap-3 sm:grid-cols-3"><Kpi label="Rascunhos" value={rascunhos}/><Kpi label="Ativas" value={ativas}/><Kpi label="Aguardando validação" value={validacao}/></section>

    <section className="his-card mt-5 p-5 sm:p-6">
      <div className="flex items-start gap-3"><span className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700"><Pill className="size-5"/></span><div><h2 className="font-black text-slate-900">Abrir prescrição do paciente</h2><p className="mt-1 text-sm text-slate-500">Não há mais seletor de médico, tipo livre ou produto do estoque nesta tela. Após selecionar o atendimento, o sistema abre a prescrição contextual.</p></div></div>
      <form method="get" className="mt-5 flex flex-col gap-3 lg:flex-row lg:items-end">
        <div className="min-w-0 flex-1"><EncounterPicker encounters={encounters} name="atendimento" /></div>
        <button className="ui-button-primary h-11">Abrir prescrição</button>
      </form>
      <div className="mt-4 rounded-xl border border-brand-100 bg-brand-50 px-4 py-3 text-sm text-brand-800"><strong>Fluxo atual:</strong> paciente/atendimento → profissional do login → digitar medicamento/material/exame/procedimento → autocomplete em <code>itens_assistenciais</code> → seleção obrigatória do catálogo.</div>
    </section>

    <section className="his-card mt-5 overflow-hidden">
      <div className="border-b border-slate-100 p-5"><h2 className="font-black text-slate-900">Prescrições recentes</h2><p className="text-sm text-slate-500">Consulta rápida. Para criar, assinar ou suspender, abra o atendimento correspondente.</p></div>
      <div className="max-h-[900px] divide-y divide-slate-100 overflow-y-auto">
        {recentes?.length ? recentes.map((item) => {
          const atendimento = Array.isArray(item.atendimento) ? item.atendimento[0] : item.atendimento;
          const paciente = Array.isArray(atendimento?.paciente) ? atendimento?.paciente[0] : atendimento?.paciente;
          const profissional = Array.isArray(item.profissional) ? item.profissional[0] : item.profissional;
          const href = item.atendimento_id ? `/prontuario/${item.atendimento_id}/prescricao` as Route : null;
          return <article key={item.id} className="p-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between"><div><p className="font-black text-slate-900">{item.item}</p><p className="mt-1 text-sm text-slate-600">{item.dose || "—"} · {item.via || "—"} · {item.frequencia || "—"}</p><p className="mt-1 text-xs text-slate-500">{paciente?.nome_completo ?? "Paciente"} · Atend. #{atendimento?.numero_atendimento ?? "—"} · {profissional?.nome_completo ?? "Profissional"}</p><div className="mt-3 flex flex-wrap gap-2 text-xs">{item.assinado_em ? <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-1 font-bold text-brand-700"><ShieldCheck className="size-3.5"/>Assinada</span> : <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 font-bold text-amber-700"><Clock3 className="size-3.5"/>Aguardando assinatura</span>}{item.requer_validacao_farmaceutica ? <span className="rounded-full bg-violet-50 px-2.5 py-1 font-bold text-violet-700">Validação farmacêutica</span> : null}</div></div><div className="flex items-center gap-2"><span className={`rounded-full px-2.5 py-1 text-[11px] font-black ${item.status === "ativa" ? "bg-emerald-50 text-emerald-700" : item.status === "rascunho" ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-600"}`}>{item.status}</span>{href ? <Link href={href} className="ui-button-secondary">Abrir atendimento</Link> : null}</div></div>
          </article>;
        }) : <p className="p-8 text-center text-sm text-slate-500">Nenhuma prescrição visível.</p>}
      </div>
    </section>
  </SectionPage>;
}

function Kpi({ label, value }: { label: string; value: number }) {
  return <div className="his-kpi"><p className="text-xs font-bold uppercase tracking-wider text-slate-400">{label}</p><p className="mt-2 text-3xl font-black text-slate-950">{value}</p></div>;
}
