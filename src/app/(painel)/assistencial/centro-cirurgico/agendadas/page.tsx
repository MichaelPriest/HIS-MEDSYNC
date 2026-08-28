import { CalendarClock } from "lucide-react";
import { SurgeryStatusCard } from "@/components/centro-cirurgico/surgery-status-card";
import { SectionPage } from "@/components/painel/section-page";
import { listSurgeryDashboard } from "@/modules/centro-cirurgico/dashboard";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function CirurgiasAgendadasPage() {
  const surgeries = await listSurgeryDashboard(["agendada", "em_preparo"]);
  return <SectionPage eyebrow="Assistencial / Centro Cirúrgico" title="Cirurgias agendadas" description="Agenda operacional separada por paciente, horário, sala e equipe, com acesso direto ao preparo e aos checklists.">
    <div className="grid gap-4 xl:grid-cols-2">{surgeries.map((surgery) => <SurgeryStatusCard key={surgery.id} surgery={surgery} />)}</div>
    {!surgeries.length ? <div className="his-card p-10 text-center"><CalendarClock className="mx-auto size-8 text-slate-300" /><p className="mt-3 font-black text-slate-700">Nenhuma cirurgia agendada.</p></div> : null}
  </SectionPage>;
}
