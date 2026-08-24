import { Activity, Clock3 } from "lucide-react";
import { DashboardTabs } from "@/components/painel/dashboard-tabs";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function Dashboard() {
  const supabase = await createClient();
  const hoje = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());

  const [pacientesRes, profissionaisRes, conveniosRes, catalogosRes, atendimentosRes, senhasRes, recentesRes] = await Promise.all([
    supabase.from("pacientes").select("id", { count: "exact", head: true }).eq("ativo", true),
    supabase.from("profissionais").select("id", { count: "exact", head: true }).eq("ativo", true),
    supabase.from("convenios").select("id", { count: "exact", head: true }).eq("ativo", true),
    supabase.from("catalogos").select("id", { count: "exact", head: true }).eq("ativo", true),
    supabase.from("atendimentos").select("id", { count: "exact", head: true }).in("status", ["aberto", "em_espera", "em_atendimento"]),
    supabase.from("senhas_atendimento").select("id", { count: "exact", head: true }).eq("data_referencia", hoje).eq("status", "aguardando"),
    supabase.from("atendimentos").select("id,numero_atendimento,paciente_id,tipo_atendimento,status,data_abertura").order("data_abertura", { ascending: false }).limit(7),
  ]);

  const pacienteIds = [...new Set((recentesRes.data ?? []).map((item) => item.paciente_id).filter(Boolean))];
  const { data: pacientesRecentes } = pacienteIds.length
    ? await supabase.from("pacientes").select("id,nome_completo,nome_social").in("id", pacienteIds)
    : { data: [] };

  const pacientesMap = new Map((pacientesRecentes ?? []).map((paciente) => [paciente.id, paciente.nome_social || paciente.nome_completo]));

  const metrics = [
    { label: "Atendimentos ativos", value: atendimentosRes.error ? null : atendimentosRes.count ?? 0, helper: "Em aberto, espera ou atendimento.", icon: "atendimentos" as const },
    { label: "Senhas aguardando", value: senhasRes.error ? null : senhasRes.count ?? 0, helper: "Fila atual da recepção.", icon: "senhas" as const },
    { label: "Pacientes ativos", value: pacientesRes.error ? null : pacientesRes.count ?? 0, helper: "Cadastros disponíveis no escopo.", icon: "pacientes" as const },
    { label: "Profissionais", value: profissionaisRes.error ? null : profissionaisRes.count ?? 0, helper: "Profissionais ativos vinculados.", icon: "profissionais" as const },
  ];

  const recentAtendimentos = (recentesRes.data ?? []).map((item) => ({
    id: item.id,
    numero: item.numero_atendimento,
    paciente: pacientesMap.get(item.paciente_id) ?? "Paciente",
    tipo: item.tipo_atendimento,
    status: String(item.status),
    data: item.data_abertura,
  }));

  return (
    <div className="ui-page-enter space-y-5">
      <section className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-his-card sm:flex-row sm:items-center sm:justify-between">
        <div><div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-brand-600"><Activity className="size-3.5" />Central operacional</div><h1 className="mt-1 text-2xl font-black tracking-tight text-slate-950">Visão geral do hospital</h1><p className="mt-1 text-sm text-slate-500">Escolha uma área de trabalho ou continue um atendimento recente.</p></div>
        <div className="flex w-fit items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600"><Clock3 className="size-4 text-brand-600" />Dados do escopo atual</div>
      </section>

      <DashboardTabs
        metrics={metrics}
        recentAtendimentos={recentAtendimentos}
        convenios={conveniosRes.error ? null : conveniosRes.count ?? 0}
        catalogos={catalogosRes.error ? null : catalogosRes.count ?? 0}
      />
    </div>
  );
}
