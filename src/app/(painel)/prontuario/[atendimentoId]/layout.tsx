import type { ReactNode } from "react";
import { EpisodioContextoAssistencial } from "@/components/prontuario/episodio-contexto-assistencial";
import { EpisodioEncerradoBanner } from "@/components/prontuario/episodio-encerrado-banner";
import { MedicalWorkspaceNav } from "@/components/prontuario/medical-workspace-nav";

export default async function ProntuarioAtendimentoLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ atendimentoId: string }>;
}) {
  const { atendimentoId } = await params;

  return (
    <>
      <MedicalWorkspaceNav atendimentoId={atendimentoId} />
      <EpisodioEncerradoBanner atendimentoId={atendimentoId} />
      <EpisodioContextoAssistencial atendimentoId={atendimentoId} />
      {children}
    </>
  );
}
