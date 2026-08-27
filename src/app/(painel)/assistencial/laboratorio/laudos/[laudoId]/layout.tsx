import { LaudoAttachmentsPanel } from "@/components/ged/laudo-attachments-panel";

export default async function LaboratorioLaudoLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ laudoId: string }>;
}) {
  const { laudoId } = await params;
  return <>{children}<LaudoAttachmentsPanel tipo="laboratorio" laudoId={laudoId} /></>;
}
