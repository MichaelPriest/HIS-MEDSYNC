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
    <div className="ui-page-enter space-y-6">
      <section className="relative overflow-hidden rounded-[24px] bg-[linear-gradient(120deg,#0b1f44_0%,#173273_58%,#1d4ed8_100%)] px-6 py-7 text-white shadow-his-float sm:px-8 sm:py-8">
        <div className="pointer-events-none absolute -right-16 -top-24 size-72 rounded-full bg-cyan-300/15 blur-3xl" />
        <div className="pointer-events-none absolute bottom-[-80px] left-[36%] size-52 rounded-full bg-blue-300/10 blur-3xl" />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-cyan-200/80"><Activity className="size-4" />Central operacional</div>
            <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-[34px]">Visão geral do hospital</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-blue-100/70">Acompanhe recepção, atendimentos, cadastros e operação assistencial em uma única visão.</p>
          </div>
          <div className="flex w-fit items-center gap-2 rounded-xl border border-white/10 bg-white/[0.08] px-4 py-3 text-xs font-semibold text-white/85 backdrop-blur"><Clock3 className="size-4 text-cyan-300" />Atualização em tempo real pelo Supabase</div>
        </div>
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
