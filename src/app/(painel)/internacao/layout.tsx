import type { ReactNode } from "react";
import Link from "next/link";
import { BedManagementAutoRefresh } from "@/components/internacao/bed-management-auto-refresh";
import { getAssistencialContext } from "@/modules/assistencial/context";

export default async function InternacaoLayout({ children }: { children: ReactNode }) {
  const { unidadeId } = await getAssistencialContext();

  return (
    <>
      <BedManagementAutoRefresh unidadeId={unidadeId} />
      <nav className="mb-4 flex flex-wrap gap-2 px-1" aria-label="Navegação da internação">
        <Link href="/internacao" className="ui-button-secondary">Painel</Link>
        <Link href="/internacao/leitos" className="ui-button-secondary">Leitos</Link>
        <Link href="/internacao/nir" className="ui-button-secondary">NIR</Link>
        <Link href="/internacao/censo" className="ui-button-secondary">Censo</Link>
        <Link href="/internacao/altas" className="ui-button-secondary">Altas</Link>
      </nav>
      {children}
    </>
  );
}
