import type { ReactNode } from "react";
import { BedManagementAutoRefresh } from "@/components/internacao/bed-management-auto-refresh";
import { getAssistencialContext } from "@/modules/assistencial/context";

export default async function InternacaoLayout({ children }: { children: ReactNode }) {
  const { unidadeId } = await getAssistencialContext();

  return (
    <>
      <BedManagementAutoRefresh unidadeId={unidadeId} />
      {children}
    </>
  );
}
