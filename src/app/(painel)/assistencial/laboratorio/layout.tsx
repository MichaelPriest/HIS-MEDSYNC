import type { ReactNode } from "react";
import Link from "next/link";
import { FileText, FlaskConical } from "lucide-react";

export default function LaboratorioLayout({ children }: { children: ReactNode }) {
  return (
    <div>
      <nav className="mb-4 flex flex-wrap gap-2 print:hidden" aria-label="Navegação do Laboratório">
        <Link href="/assistencial/laboratorio" className="ui-button-secondary"><FlaskConical className="size-4" /> Operação do laboratório</Link>
        <Link href="/assistencial/laboratorio/laudos" className="ui-button-secondary"><FileText className="size-4" /> Bancada de laudos</Link>
      </nav>
      {children}
    </div>
  );
}
