import { Activity } from "lucide-react";
import { SurgeryStatusCard } from "@/components/centro-cirurgico/surgery-status-card";
import { RoomBoardAutoRefresh } from "@/components/centro-cirurgico/room-board-auto-refresh";
import { SectionPage } from "@/components/painel/section-page";
import { listSurgeryDashboard } from "@/modules/centro-cirurgico/dashboard";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function CirurgiasEmAndamentoPage() {
  const surgeries = await listSurgeryDashboard(["em_andamento"]);
  return <SectionPage eyebrow="Assistencial / Centro Cirúrgico" title="Cirurgias em andamento" description="Tela ao vivo dos atos cirúrgicos em execução, com sala, equipe, horário e acesso imediato ao registro operacional.">
    <div className="mb-4 flex justify-end"><RoomBoardAutoRefresh /></div>
    <div className="grid gap-4 xl:grid-cols-2">{surgeries.map((surgery) => <SurgeryStatusCard key={surgery.id} surgery={surgery} live />)}</div>
    {!surgeries.length ? <div className="his-card p-10 text-center"><Activity className="mx-auto size-8 text-slate-300" /><p className="mt-3 font-black text-slate-700">Nenhuma cirurgia em andamento.</p></div> : null}
  </SectionPage>;
}
