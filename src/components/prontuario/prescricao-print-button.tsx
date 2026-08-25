"use client";

export function PrescricaoPrintButton() {
  return <button type="button" onClick={() => window.print()} className="ui-button-primary print:hidden">Imprimir prescrição</button>;
}
