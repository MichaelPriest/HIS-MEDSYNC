"use client";

import { Delete, Eraser, ScanFace } from "lucide-react";
import { useState } from "react";
import { useFormStatus } from "react-dom";
import { emitirSenhaTotem } from "@/modules/senhas/actions";

function formatarCpf(valor: string) {
  const d = valor.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

function BotaoIdentificar({ pronto }: { pronto: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      name="acao"
      value="identificar"
      disabled={!pronto || pending}
      className="mt-4 flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-brand-950 px-6 text-base font-bold text-white shadow-sm transition hover:bg-brand-900 disabled:cursor-not-allowed disabled:opacity-45"
    >
      <ScanFace className="size-5" />
      {pending ? "Identificando..." : "Identificar e emitir senha"}
    </button>
  );
}

export function CpfVirtualKeyboard({ unidadeId }: { unidadeId: string }) {
  const [cpf, setCpf] = useState("");
  const digitar = (numero: string) => setCpf((atual) => (atual.length < 11 ? `${atual}${numero}` : atual));
  const apagar = () => setCpf((atual) => atual.slice(0, -1));
  const limpar = () => setCpf("");

  return (
    <form action={emitirSenhaTotem} className="grid gap-5 lg:grid-cols-[1fr_320px]">
      <input type="hidden" name="unidade_id" value={unidadeId} />
      <input type="hidden" name="setor_codigo" value="recepcao" />
      <input type="hidden" name="prioridade" value="normal" />
      <input type="hidden" name="cpf" value={cpf} />

      <div>
        <label className="text-sm font-semibold text-slate-700">CPF do paciente</label>
        <div className="mt-2 flex min-h-16 items-center rounded-2xl border-2 border-brand-100 bg-slate-50 px-5 text-3xl font-black tracking-[0.08em] text-brand-950 shadow-inner">
          {cpf ? formatarCpf(cpf) : <span className="text-slate-300">000.000.000-00</span>}
        </div>
        <p className="mt-3 text-sm leading-6 text-slate-500">
          Use o teclado ao lado. O sistema confirma somente informações mínimas do cadastro antes de emitir a senha.
        </p>
        <div className="mt-5 rounded-2xl border border-brand-100 bg-brand-50/70 p-4 text-sm text-brand-950">
          <strong>Privacidade:</strong> após localizar o CPF, o Totem mostra apenas o nome abreviado e os últimos dígitos do documento.
        </div>
        <BotaoIdentificar pronto={cpf.length === 11} />
      </div>

      <div className="grid grid-cols-3 gap-3 rounded-3xl border border-slate-200 bg-slate-50 p-4 shadow-inner">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((numero) => (
          <button
            key={numero}
            type="button"
            onClick={() => digitar(numero)}
            className="grid h-16 place-items-center rounded-2xl border border-slate-200 bg-white text-2xl font-black text-slate-900 shadow-sm transition hover:border-brand-200 hover:bg-brand-50 active:scale-95"
          >
            {numero}
          </button>
        ))}
        <button
          type="button"
          onClick={limpar}
          className="grid h-16 place-items-center rounded-2xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-100 active:scale-95"
          aria-label="Limpar CPF"
        >
          <Eraser className="size-6" />
        </button>
        <button
          type="button"
          onClick={() => digitar("0")}
          className="grid h-16 place-items-center rounded-2xl border border-slate-200 bg-white text-2xl font-black text-slate-900 shadow-sm transition hover:border-brand-200 hover:bg-brand-50 active:scale-95"
        >
          0
        </button>
        <button
          type="button"
          onClick={apagar}
          className="grid h-16 place-items-center rounded-2xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-100 active:scale-95"
          aria-label="Apagar último número"
        >
          <Delete className="size-6" />
        </button>
      </div>
    </form>
  );
}
