import type { ReactNode } from "react";
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
      {children}
    </>
  );
}
