"use client";

import { Printer } from "lucide-react";

export function PrintIdentificacaoButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="ui-button-primary print:hidden"
      aria-label="Imprimir identificação do paciente"
      title="Imprimir identificação do paciente"
    >
      <Printer className="size-4" aria-hidden="true" />
      Imprimir
    </button>
  );
}
