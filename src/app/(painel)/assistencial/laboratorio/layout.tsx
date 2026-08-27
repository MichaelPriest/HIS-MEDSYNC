import type { ReactNode } from "react";
import Link from "next/link";
import { FileText, FlaskConical } from "lucide-react";
import { getAssistencialContext } from "@/modules/assistencial/context";

export default async function LaboratorioLayout({ children }: { children: ReactNode }) {
  const { supabase, empresaId, unidadeId } = await getAssistencialContext();
  const checks = await Promise.all(
    ["laboratorio.visualizar", "laboratorio.coletar", "laboratorio.resultar", "laboratorio.laudar", "laboratorio.liberar"].map((codigo) =>
      supabase.rpc("tem_permissao", { p_empresa: empresaId, p_unidade: unidadeId, p_codigo: codigo }),
    ),
  );
  const acessoOperacional = checks.some(({ data, error }) => !error && data === true);

  return (
    <div>
      {acessoOperacional ? (
        <nav className="mb-4 flex flex-wrap gap-2 print:hidden" aria-label="Navegação do Laboratório">
          <Link href="/assistencial/laboratorio" className="ui-button-secondary"><FlaskConical className="size-4" /> Operação do laboratório</Link>
          <Link href="/assistencial/laboratorio/laudos" className="ui-button-secondary"><FileText className="size-4" /> Bancada de laudos</Link>
        </nav>
      ) : null}
      {children}
    </div>
  );
}
