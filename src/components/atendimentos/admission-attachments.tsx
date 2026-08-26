"use client";

import { FileUp, Paperclip, Trash2 } from "lucide-react";
import { useRef, useState } from "react";

const ACCEPTED = ["application/pdf", "image/jpeg", "image/png"];
const MAX_SIZE = 10 * 1024 * 1024;

export function AdmissionAttachments() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);

  function syncInput(next: File[]) {
    setFiles(next);
    const transfer = new DataTransfer();
    next.forEach((file) => transfer.items.add(file));
    if (inputRef.current) inputRef.current.files = transfer.files;
  }

  function addFiles(list: FileList | File[]) {
    const incoming = Array.from(list);
    const invalid = incoming.find((file) => !ACCEPTED.includes(file.type) || file.size > MAX_SIZE);
    if (invalid) {
      setError("Use PDF, JPG ou PNG, com até 10 MB por arquivo.");
      return;
    }
    setError(null);
    const merged = [...files, ...incoming].slice(0, 10);
    syncInput(merged);
  }

  return (
    <div className="space-y-3 md:col-span-2 xl:col-span-3">
      <div
        className="rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/70 p-5 text-center transition hover:border-brand-300 hover:bg-brand-50/40"
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          addFiles(event.dataTransfer.files);
        }}
      >
        <FileUp className="mx-auto size-7 text-brand-600" />
        <p className="mt-2 text-sm font-semibold text-slate-800">Documentos da admissão</p>
        <p className="mt-1 text-xs text-slate-500">Arraste guia assinada, pedido médico ou foto. PDF/JPG/PNG, até 10 MB cada.</p>
        <button type="button" onClick={() => inputRef.current?.click()} className="btn-secondary mt-3">Selecionar arquivos</button>
        <input
          ref={inputRef}
          type="file"
          name="documentos"
          accept="application/pdf,image/jpeg,image/png"
          multiple
          className="sr-only"
          onChange={(event) => event.target.files && addFiles(event.target.files)}
        />
      </div>
      {error ? <p className="text-xs font-semibold text-rose-600">{error}</p> : null}
      {files.length ? <div className="grid gap-2 sm:grid-cols-2">{files.map((file, index) => (
        <div key={`${file.name}-${file.lastModified}-${index}`} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5">
          <Paperclip className="size-4 shrink-0 text-slate-400" />
          <div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold text-slate-700">{file.name}</p><p className="text-[11px] text-slate-400">{(file.size / 1024 / 1024).toFixed(2)} MB</p></div>
          <button type="button" onClick={() => syncInput(files.filter((_, itemIndex) => itemIndex !== index))} className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600" aria-label={`Remover ${file.name}`}><Trash2 className="size-4" /></button>
        </div>
      ))}</div> : null}
    </div>
  );
}
