import { LaudoAttachmentsPanel } from "@/components/ged/laudo-attachments-panel";

export default async function ImagemLaudoLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ laudoId: string }>;
}) {
  const { laudoId } = await params;
  return <>{children}<LaudoAttachmentsPanel tipo="imagem" laudoId={laudoId} /></>;
}
