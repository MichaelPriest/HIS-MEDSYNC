"use client";

import { Printer } from "lucide-react";

export function PrintButton({ label = "Imprimir" }: { label?: string }) {
  return (
    <button type="button" className="ui-button-secondary print:hidden" onClick={() => window.print()}>
      <Printer className="size-4" />
      {label}
    </button>
  );
}
