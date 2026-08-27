"use client";

import { Printer } from "lucide-react";

export function PrintDocumentButton() {
  return <button type="button" onClick={() => window.print()} className="ui-button-primary print:hidden"><Printer className="size-4"/>Imprimir documento</button>;
}