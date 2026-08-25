"use client";

import { Camera, ImagePlus, Video, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export function PhotoField({ label = "Foto", name = "foto" }: { label?: string; name?: string }) {
  const [preview, setPreview] = useState<string | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
    streamRef.current?.getTracks().forEach((track) => track.stop());
  }, [preview]);

  function clearPhoto() {
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function openCamera() {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
      streamRef.current = stream;
      setCameraOpen(true);
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play();
        }
      });
    } catch {
      setCameraError("Não foi possível acessar a câmera. Verifique a permissão do navegador ou use Selecionar foto.");
    }
  }

  function closeCamera() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraOpen(false);
  }

  function capturePhoto() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !video.videoWidth || !video.videoHeight) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (!blob || !inputRef.current) return;
      const file = new File([blob], `paciente-${Date.now()}.jpg`, { type: "image/jpeg" });
      const transfer = new DataTransfer();
      transfer.items.add(file);
      inputRef.current.files = transfer.files;
      if (preview) URL.revokeObjectURL(preview);
      setPreview(URL.createObjectURL(file));
      closeCamera();
    }, "image/jpeg", 0.9);
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="relative grid size-28 shrink-0 place-items-center overflow-hidden rounded-2xl border border-dashed border-slate-300 bg-white text-slate-400" style={preview ? { backgroundImage: `url(${preview})`, backgroundPosition: "center", backgroundSize: "cover" } : undefined} aria-label={preview ? "Pré-visualização da foto" : "Sem foto selecionada"}>
          {preview ? null : <Camera className="size-8" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-800">{label}</p>
          <p className="mt-1 text-xs leading-5 text-slate-500">Capture pela câmera ou envie JPG, PNG ou WEBP, com até 5 MB. A imagem é armazenada em bucket privado.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={openCamera} className="inline-flex items-center gap-2 rounded-xl bg-brand-950 px-3.5 py-2 text-sm font-semibold text-white hover:bg-brand-900"><Video className="size-4" />Usar câmera</button>
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"><ImagePlus className="size-4" />Selecionar foto<input ref={inputRef} className="sr-only" type="file" name={name} accept="image/jpeg,image/png,image/webp" capture="user" onChange={(event) => { const file = event.target.files?.[0]; if (preview) URL.revokeObjectURL(preview); setPreview(file ? URL.createObjectURL(file) : null); }} /></label>
            {preview ? <button type="button" onClick={clearPhoto} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"><X className="size-4" />Remover foto</button> : null}
          </div>
          {cameraError ? <p className="mt-2 text-xs font-semibold text-rose-600">{cameraError}</p> : null}
        </div>
      </div>

      {cameraOpen ? <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-950 p-3"><video ref={videoRef} playsInline muted className="mx-auto max-h-80 w-full rounded-xl object-cover"/><div className="mt-3 flex justify-end gap-2"><button type="button" onClick={closeCamera} className="ui-button-secondary">Cancelar</button><button type="button" onClick={capturePhoto} className="ui-button-primary"><Camera className="size-4"/>Capturar foto</button></div></div> : null}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
