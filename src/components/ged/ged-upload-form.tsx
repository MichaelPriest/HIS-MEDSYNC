"use client";

import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { FileUp, LoaderCircle, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  cancelarUploadGed,
  finalizarUploadGed,
  prepararUploadGed,
} from "@/modules/ged/actions";

type Props = {
  atendimentoId?: string | null;
  pacienteId?: string | null;
  profissionalId?: string | null;
  convenioId?: string | null;
  loteTissId?: string | null;
  contaFaturamentoId?: string | null;
  solicitacaoExameId?: string | null;
  laboratorioLaudoId?: string | null;
  imagemLaudoId?: string | null;
  documentoBaseId?: string | null;
  defaultTitulo?: string;
  defaultCategoria?: string;
  defaultSubcategoria?: string;
  defaultConfidencial?: boolean;
  compact?: boolean;
};

const MAX_BYTES = 10 * 1024 * 1024;
const ACCEPT = ".pdf,.jpg,.jpeg,.png,.xml,application/pdf,image/jpeg,image/png,text/xml,application/xml";

function bytesLabel(value: number) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

async function sha256(file: File) {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function GedUploadForm({
  atendimentoId,
  pacienteId,
  profissionalId,
  convenioId,
  loteTissId,
  contaFaturamentoId,
  solicitacaoExameId,
  laboratorioLaudoId,
  imagemLaudoId,
  documentoBaseId,
  defaultTitulo = "",
  defaultCategoria = "clinico",
  defaultSubcategoria = "",
  defaultConfidencial = false,
  compact = false,
}: Props) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const fixedClinicalScope = Boolean(
    atendimentoId || solicitacaoExameId || laboratorioLaudoId || imagemLaudoId || documentoBaseId,
  );

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;

    const form = event.currentTarget;
    const formData = new FormData(form);
    const file = formData.get("arquivo");
    if (!(file instanceof File) || file.size <= 0) {
      setSuccess(false);
      setMessage("Selecione um arquivo para enviar.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setSuccess(false);
      setMessage("O arquivo excede o limite de 10 MB.");
      return;
    }

    const associations = {
      atendimentoId: atendimentoId ?? null,
      pacienteId: pacienteId ?? null,
      profissionalId: profissionalId ?? null,
      convenioId: convenioId ?? null,
      loteTissId: loteTissId ?? null,
      contaFaturamentoId: contaFaturamentoId ?? null,
      solicitacaoExameId: solicitacaoExameId ?? null,
      laboratorioLaudoId: laboratorioLaudoId ?? null,
      imagemLaudoId: imagemLaudoId ?? null,
      substituiDocumentoId: documentoBaseId ?? null,
      corporativo: fixedClinicalScope ? false : formData.get("escopo") === "corporativo",
    };

    setBusy(true);
    setSuccess(false);
    setMessage("Validando escopo e preparando envio seguro…");

    let preparedPath: string | null = null;
    try {
      const prepared = await prepararUploadGed({
        ...associations,
        nomeArquivo: file.name,
        mimeType: file.type || "application/octet-stream",
        tamanhoBytes: file.size,
      });
      if (!prepared.ok) throw new Error(prepared.erro);
      preparedPath = prepared.path;

      setMessage(`Enviando ${bytesLabel(file.size)} diretamente ao Storage privado…`);
      const { error: uploadError } = await supabase.storage
        .from(prepared.bucket)
        .uploadToSignedUrl(prepared.path, prepared.token, file, {
          contentType: file.type,
          cacheControl: "3600",
        });
      if (uploadError) throw new Error(uploadError.message);

      setMessage("Calculando e registrando integridade SHA-256…");
      const hashSha256 = await sha256(file);
      const finalized = await finalizarUploadGed({
        ...associations,
        titulo: String(formData.get("titulo") ?? ""),
        categoria: String(formData.get("categoria") ?? defaultCategoria),
        subcategoria: String(formData.get("subcategoria") ?? ""),
        observacoes: String(formData.get("observacoes") ?? ""),
        confidencial: formData.get("confidencial") === "on",
        nomeArquivo: file.name,
        mimeType: file.type,
        tamanhoBytes: file.size,
        hashSha256,
        storagePath: prepared.path,
      });
      if (!finalized.ok) throw new Error(finalized.erro);

      preparedPath = null;
      setSuccess(true);
      setMessage(documentoBaseId ? "Nova versão registrada com sucesso." : "Documento registrado com sucesso no GED.");
      form.reset();
      router.push(`/ged/${finalized.documentoId}` as Route);
      router.refresh();
    } catch (error) {
      if (preparedPath) await cancelarUploadGed(preparedPath);
      setSuccess(false);
      setMessage(error instanceof Error ? error.message : "Não foi possível concluir o envio.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className={compact ? "space-y-4" : "ui-card space-y-5 p-5"}>
      {!compact ? (
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-slate-100 p-2"><FileUp className="size-5 text-slate-700" /></div>
          <div>
            <h2 className="font-semibold text-slate-900">Enviar documento</h2>
            <p className="text-sm text-slate-500">Upload direto para bucket privado, sem trafegar o arquivo pela função da aplicação.</p>
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-1 md:col-span-2">
          <span className="text-sm font-medium text-slate-700">Título *</span>
          <input name="titulo" defaultValue={defaultTitulo} required maxLength={180} className="ui-input w-full" placeholder="Ex.: Termo de consentimento" />
        </label>

        {documentoBaseId ? (
          <input type="hidden" name="categoria" value={defaultCategoria} />
        ) : (
          <label className="space-y-1">
            <span className="text-sm font-medium text-slate-700">Categoria *</span>
            <select name="categoria" defaultValue={defaultCategoria} className="ui-input w-full">
              <option value="clinico">Clínico</option>
              <option value="assistencial">Assistencial</option>
              <option value="admissao">Admissão</option>
              <option value="administrativo">Administrativo</option>
              <option value="financeiro">Financeiro</option>
              <option value="fiscal">Fiscal</option>
              <option value="contratual">Contratual</option>
              <option value="outro">Outro</option>
            </select>
          </label>
        )}

        <label className="space-y-1">
          <span className="text-sm font-medium text-slate-700">Subcategoria</span>
          <input name="subcategoria" defaultValue={defaultSubcategoria} maxLength={120} className="ui-input w-full" placeholder="Ex.: consentimento" />
        </label>

        {!fixedClinicalScope && !documentoBaseId ? (
          <label className="space-y-1">
            <span className="text-sm font-medium text-slate-700">Escopo</span>
            <select name="escopo" defaultValue="unidade" className="ui-input w-full">
              <option value="unidade">Unidade atual</option>
              <option value="corporativo">Corporativo / empresa</option>
            </select>
          </label>
        ) : null}

        <label className="space-y-1 md:col-span-2">
          <span className="text-sm font-medium text-slate-700">Arquivo *</span>
          <input name="arquivo" type="file" accept={ACCEPT} required className="block w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm file:mr-4 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:font-medium file:text-slate-700" />
          <span className="block text-xs text-slate-500">PDF, JPG, PNG ou XML · máximo 10 MB.</span>
        </label>

        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input name="confidencial" type="checkbox" defaultChecked={defaultConfidencial} className="size-4 rounded border-slate-300" />
          Documento confidencial
        </label>

        <label className="space-y-1 md:col-span-2">
          <span className="text-sm font-medium text-slate-700">Observações</span>
          <textarea name="observacoes" rows={2} maxLength={500} className="ui-input w-full resize-y" placeholder="Contexto, origem ou observação de guarda documental" />
        </label>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <ShieldCheck className="size-4" />
          Bucket privado · RLS · hash SHA-256 · sem sobrescrita
        </div>
        <button type="submit" disabled={busy} className="ui-button-primary min-w-36">
          {busy ? <><LoaderCircle className="size-4 animate-spin" /> Enviando…</> : <><FileUp className="size-4" /> {documentoBaseId ? "Criar nova versão" : "Enviar ao GED"}</>}
        </button>
      </div>

      {message ? (
        <div className={`rounded-xl border px-3 py-2 text-sm ${success ? "border-emerald-200 bg-emerald-50 text-emerald-800" : busy ? "border-sky-200 bg-sky-50 text-sky-800" : "border-rose-200 bg-rose-50 text-rose-800"}`}>
          {message}
        </div>
      ) : null}
    </form>
  );
}
