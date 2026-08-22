"use client";

import { Camera, ImagePlus, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export function PhotoField({ label = "Foto", name = "foto" }: { label?: string; name?: string }) {
  const [preview, setPreview] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  function clearPhoto() {
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div
          className="relative grid size-28 shrink-0 place-items-center overflow-hidden rounded-2xl border border-dashed border-slate-300 bg-white text-slate-400"
          style={preview ? { backgroundImage: `url(${preview})`, backgroundPosition: "center", backgroundSize: "cover" } : undefined}
          aria-label={preview ? "Pré-visualização da foto" : "Sem foto selecionada"}
        >
          {preview ? null : <Camera className="size-8" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-800">{label}</p>
          <p className="mt-1 text-xs leading-5 text-slate-500">JPG, PNG ou WEBP, com até 5 MB. A imagem será armazenada em bucket privado.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-brand-950 px-3.5 py-2 text-sm font-semibold text-white hover:bg-brand-900">
              <ImagePlus className="size-4" />
              Selecionar foto
              <input
                ref={inputRef}
                className="sr-only"
                type="file"
                name={name}
                accept="image/jpeg,image/png,image/webp"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (preview) URL.revokeObjectURL(preview);
                  setPreview(file ? URL.createObjectURL(file) : null);
                }}
              />
            </label>
            {preview ? (
              <button type="button" onClick={clearPhoto} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
                <X className="size-4" /> Remover foto
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
