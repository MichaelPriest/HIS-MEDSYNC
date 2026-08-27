"use client";

import type { FormEvent, ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { AlertCircle, CheckCircle2, Cloud, Loader2 } from "lucide-react";
import {
  autosalvarAnamnese,
  autosalvarEvolucaoSoap,
  registrarEvolucaoSoap,
  salvarAnamnese,
} from "@/modules/prontuario-clinico/actions";

type TipoRegistro = "anamnese" | "soap";
type Estado = "idle" | "dirty" | "saving" | "saved" | "error";

type ClinicalAutosaveFormProps = {
  tipo: TipoRegistro;
  atendimentoId: string;
  registroId?: string | null;
  children: ReactNode;
  className?: string;
};

export function ClinicalAutosaveForm({ tipo, atendimentoId, registroId: registroIdInicial, children, className }: ClinicalAutosaveFormProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentPromiseRef = useRef<Promise<void> | null>(null);
  const dirtyRef = useRef(false);
  const registroIdRef = useRef<string | null>(registroIdInicial ?? null);
  const [registroId, setRegistroId] = useState<string | null>(registroIdInicial ?? null);
  const [estado, setEstado] = useState<Estado>("idle");
  const [salvoEm, setSalvoEm] = useState<string | null>(null);

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  function atualizarRegistroId(id: string | null | undefined) {
    if (!id) return;
    registroIdRef.current = id;
    setRegistroId(id);
  }

  async function executarAutosave() {
    if (currentPromiseRef.current) {
      await currentPromiseRef.current;
      if (dirtyRef.current) await executarAutosave();
      return;
    }
    if (!dirtyRef.current || !formRef.current) return;

    dirtyRef.current = false;
    setEstado("saving");
    const dados = new FormData(formRef.current);
    dados.set("atendimento_id", atendimentoId);
    dados.set("acao", "salvar");
    if (registroIdRef.current) dados.set("registro_id", registroIdRef.current);

    const promessa = (async () => {
      const resultado = tipo === "anamnese" ? await autosalvarAnamnese(dados) : await autosalvarEvolucaoSoap(dados);
      if (resultado.ok) {
        atualizarRegistroId(resultado.id);
        setSalvoEm(resultado.savedAt);
        setEstado("saved");
      } else {
        dirtyRef.current = true;
        setEstado("error");
      }
    })();

    currentPromiseRef.current = promessa;
    try {
      await promessa;
    } finally {
      currentPromiseRef.current = null;
    }

    if (dirtyRef.current && estado !== "error") {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => void executarAutosave(), 400);
    }
  }

  function agendarAutosave() {
    dirtyRef.current = true;
    setEstado("dirty");
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => void executarAutosave(), 900);
  }

  async function flushAutosave() {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (currentPromiseRef.current) await currentPromiseRef.current;
    if (dirtyRef.current) await executarAutosave();
    if (currentPromiseRef.current) await currentPromiseRef.current;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const acao = submitter?.value === "assinar" ? "assinar" : "salvar";

    await flushAutosave();
    const dados = new FormData(event.currentTarget);
    dados.set("atendimento_id", atendimentoId);
    dados.set("acao", acao);
    if (registroIdRef.current) dados.set("registro_id", registroIdRef.current);
    setEstado("saving");

    if (tipo === "anamnese") await salvarAnamnese(dados);
    else await registrarEvolucaoSoap(dados);
  }

  return (
    <form ref={formRef} onInput={agendarAutosave} onSubmit={handleSubmit} className={className}>
      <input type="hidden" name="atendimento_id" value={atendimentoId} />
      <input type="hidden" name="registro_id" value={registroId ?? ""} />
      <div className="mb-3 flex min-h-7 items-center justify-end" aria-live="polite">
        <SaveIndicator estado={estado} salvoEm={salvoEm} />
      </div>
      {children}
    </form>
  );
}

function SaveIndicator({ estado, salvoEm }: { estado: Estado; salvoEm: string | null }) {
  if (estado === "saving") return <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-700"><Loader2 className="size-3.5 animate-spin" />Salvando em segundo plano…</span>;
  if (estado === "saved") return <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700"><CheckCircle2 className="size-3.5" />Salvo automaticamente{salvoEm ? ` às ${new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "America/Sao_Paulo" }).format(new Date(salvoEm))}` : ""}</span>;
  if (estado === "error") return <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-700"><AlertCircle className="size-3.5" />Falha no autosave. Continue preenchendo ou use “Salvar rascunho”.</span>;
  if (estado === "dirty") return <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700"><Cloud className="size-3.5" />Alterações aguardando salvamento…</span>;
  return <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-400"><Cloud className="size-3.5" />Salvamento automático ativo</span>;
}
