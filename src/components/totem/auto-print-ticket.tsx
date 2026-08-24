"use client";

import { Printer } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type AutoPrintTicketProps = {
  senha: string;
  identificado?: boolean;
};

export function AutoPrintTicket({ senha, identificado = false }: AutoPrintTicketProps) {
  const impresso = useRef(false);
  const [emitidoEm, setEmitidoEm] = useState("");

  useEffect(() => {
    setEmitidoEm(new Date().toLocaleString("pt-BR"));
  }, [senha]);

  useEffect(() => {
    if (!senha || impresso.current) return;
    impresso.current = true;

    const chave = `medsync-totem-print:${window.location.pathname}:${senha}`;
    if (sessionStorage.getItem(chave) === "1") return;
    sessionStorage.setItem(chave, "1");

    const timer = window.setTimeout(() => window.print(), 550);
    return () => window.clearTimeout(timer);
  }, [senha]);

  return (
    <>
      <button
        type="button"
        onClick={() => window.print()}
        className="totem-no-print mt-4 inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 active:scale-[0.98]"
      >
        <Printer className="size-4" />
        Imprimir novamente
      </button>

      <section className="totem-print-ticket" aria-hidden="true">
        <div className="totem-print-brand">MEDSYNC</div>
        <div className="totem-print-subtitle">TOTEM DE SENHAS</div>
        <div className="totem-print-divider" />
        <div className="totem-print-label">SUA SENHA</div>
        <div className="totem-print-number">{senha}</div>
        <div className="totem-print-divider" />
        <div className="totem-print-message">Aguarde a chamada no painel.</div>
        {identificado ? <div className="totem-print-small">Cadastro identificado</div> : null}
        {emitidoEm ? <div className="totem-print-small">{emitidoEm}</div> : null}
      </section>
    </>
  );
}
