import { Activity, Sparkles } from "lucide-react";
import { DashboardTabs } from "@/components/painel/dashboard-tabs";
import { createClient } from "@/lib/supabase/server";

async function countRows(table: "pacientes" | "profissionais" | "convenios" | "catalogos") {
  const supabase = await createClient();
  const { count, error } = await supabase.from(table).select("id", { count: "exact", head: true }).eq("ativo", true);
  return error ? null : count ?? 0;
}

export default async function Dashboard() {
  const [pacientes, profissionais, convenios, catalogos] = await Promise.all([
    countRows("pacientes"),
    countRows("profissionais"),
    countRows("convenios"),
    countRows("catalogos"),
  ]);

  const metrics = [
    { label: "Pacientes ativos", value: pacientes, helper: "Cadastros disponíveis no escopo autorizado.", icon: "pacientes" as const },
    { label: "Profissionais", value: profissionais, helper: "Profissionais ativos vinculados à empresa.", icon: "profissionais" as const },
    { label: "Convênios", value: convenios, helper: "Operadoras ativas cadastradas no sistema.", icon: "convenios" as const },
    { label: "Catálogos", value: catalogos, helper: "Itens de domínio ativos e centralizados.", icon: "catalogos" as const },
  ];

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-3xl border border-brand-100 bg-white p-6 shadow-sm shadow-slate-900/[0.03] sm:p-7">
        <div className="absolute -right-20 -top-24 size-64 rounded-full bg-brand-100/60 blur-3xl" />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-brand-700">
              <Activity className="size-4" />
              Central operacional
            </div>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">Visão geral do HIS</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Acompanhe a implantação e os cadastros mestres já disponíveis no ambiente autorizado.</p>
          </div>
          <div className="flex w-fit items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700">
            <Sparkles className="size-3.5" />
            Interface atualizada
          </div>
        </div>
      </section>

      <DashboardTabs metrics={metrics} />
    </div>
  );
}
