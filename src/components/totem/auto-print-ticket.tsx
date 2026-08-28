"use client";

import { Printer, QrCode } from "lucide-react";
import QRCode from "qrcode";
import { useEffect, useRef, useState } from "react";

type AutoPrintTicketProps = {
  senha: string;
  unidadeId: string;
  ticketId?: string | null;
  identificado?: boolean;
  nomeExibicao?: string | null;
  cpfFinal?: string | null;
};

const totemPrintCss = `
  @media print {
    @page { size: 80mm auto; margin: 2mm; }
    html, body {
      width: 80mm !important;
      min-width: 80mm !important;
      min-height: 0 !important;
      margin: 0 !important;
      padding: 0 !important;
      background: #fff !important;
    }
    body * { visibility: hidden !important; }
    .totem-print-ticket,
    .totem-print-ticket * { visibility: visible !important; }
    .totem-print-ticket {
      display: block !important;
      position: absolute !important;
      inset: 0 auto auto 0 !important;
      width: 76mm !important;
      margin: 0 !important;
      padding: 3mm 2mm 5mm !important;
      background: #fff !important;
      transform: none !important;
    }
    * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
  }
`;

export function AutoPrintTicket({
  senha,
  unidadeId,
  ticketId,
  identificado = false,
  nomeExibicao,
  cpfFinal,
}: AutoPrintTicketProps) {
  const impresso = useRef(false);
  const [emitidoEm, setEmitidoEm] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [qrPronto, setQrPronto] = useState(false);

  useEffect(() => {
    setEmitidoEm(new Date().toLocaleString("pt-BR"));
  }, [senha]);

  useEffect(() => {
    let ativo = true;
    const payload = JSON.stringify({
      sistema: "MEDSYNC",
      tipo: "SENHA_ATENDIMENTO",
      ticket: ticketId ?? null,
      senha,
      unidade: unidadeId,
    });

    QRCode.toDataURL(payload, {
      errorCorrectionLevel: "M",
      margin: 1,
      width: 180,
    })
      .then((url) => {
        if (ativo) setQrDataUrl(url);
      })
      .catch((error) => {
        console.error("[totem] falha ao gerar QR Code", error);
      })
      .finally(() => {
        if (ativo) setQrPronto(true);
      });

    return () => {
      ativo = false;
    };
  }, [senha, ticketId, unidadeId]);

  useEffect(() => {
    if (!senha || !qrPronto || impresso.current) return;
    impresso.current = true;

    const chave = `medsync-totem-print:${window.location.pathname}:${senha}`;
    if (sessionStorage.getItem(chave) === "1") return;
    sessionStorage.setItem(chave, "1");

    const timer = window.setTimeout(() => window.print(), 650);
    return () => window.clearTimeout(timer);
  }, [qrPronto, senha]);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: totemPrintCss }} />

      {qrDataUrl ? (
        <div className="totem-no-print mx-auto mt-5 flex w-fit items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-left">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qrDataUrl} alt={`QR Code da senha ${senha}`} className="size-24 rounded-lg bg-white p-1" />
          <div>
            <div className="flex items-center gap-2 text-sm font-bold text-slate-800"><QrCode className="size-4" /> QR da senha</div>
            <p className="mt-1 max-w-48 text-xs leading-5 text-slate-500">Identificador técnico do ticket para leitura e conferência.</p>
          </div>
        </div>
      ) : null}

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
        {qrDataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={qrDataUrl} alt="" className="totem-print-qr" />
        ) : null}
        <div className="totem-print-divider" />
        <div className="totem-print-message">Aguarde a chamada no painel.</div>
        {identificado ? <div className="totem-print-small">Cadastro identificado</div> : null}
        {identificado && nomeExibicao ? <div className="totem-print-small">{nomeExibicao}</div> : null}
        {identificado && cpfFinal ? <div className="totem-print-small">CPF final **{cpfFinal}</div> : null}
        {emitidoEm ? <div className="totem-print-small">{emitidoEm}</div> : null}
      </section>
    </>
  );
}
