"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Volume2, VolumeX } from "lucide-react";

type ChamadaVoz = {
  senha?: string | null;
  nome?: string | null;
  identificado?: boolean;
  ponto?: string | null;
  setor?: string | null;
  ultimaChamadaEm?: string | null;
};

function escolherVozPtBr() {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return null;
  const voices = window.speechSynthesis.getVoices();
  return voices.find((voice) => voice.lang.toLowerCase() === "pt-br")
    ?? voices.find((voice) => voice.lang.toLowerCase().startsWith("pt"))
    ?? null;
}

function textoDaChamada(chamada?: ChamadaVoz | null) {
  if (!chamada?.senha) return "";
  const identificacao = chamada.identificado && chamada.nome
    ? `${chamada.nome}. Senha ${chamada.senha}.`
    : `Senha ${chamada.senha}.`;
  const destino = chamada.ponto
    ? `Dirija-se a ${chamada.ponto}.`
    : chamada.setor
      ? `Dirija-se ao setor ${chamada.setor}.`
      : "Aguarde a orientação da equipe.";
  return `${identificacao} ${destino}`;
}

export function PanelAutoRefresh({
  intervalMs = 5000,
  chamada,
}: {
  intervalMs?: number;
  chamada?: ChamadaVoz | null;
}) {
  const router = useRouter();
  const [vozAtiva, setVozAtiva] = useState(false);
  const [suportado, setSuportado] = useState(true);
  const mounted = useRef(false);

  const chaveChamada = useMemo(() => {
    if (!chamada?.senha) return "";
    return [chamada.senha, chamada.ultimaChamadaEm ?? "", chamada.ponto ?? "", chamada.setor ?? ""].join("|");
  }, [chamada]);

  useEffect(() => {
    const timer = window.setInterval(() => router.refresh(), intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs, router]);

  useEffect(() => {
    const temTts = "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;
    setSuportado(temTts);
    if (!temTts) return;

    const preferencia = window.localStorage.getItem("medsync:painel-voz") === "1";
    setVozAtiva(preferencia);
    mounted.current = true;

    // Alguns navegadores carregam as vozes de forma assíncrona.
    window.speechSynthesis.getVoices();
  }, []);

  useEffect(() => {
    if (!mounted.current || !vozAtiva || !suportado || !chaveChamada || !chamada) return;

    const storageKey = `medsync:painel-ultima-voz:${window.location.pathname}`;
    const ultimaFalado = window.sessionStorage.getItem(storageKey);
    if (ultimaFalado === chaveChamada) return;

    const texto = textoDaChamada(chamada);
    if (!texto) return;

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(texto);
    utterance.lang = "pt-BR";
    utterance.rate = 0.88;
    utterance.pitch = 1;
    utterance.volume = 1;
    const voz = escolherVozPtBr();
    if (voz) utterance.voice = voz;

    window.sessionStorage.setItem(storageKey, chaveChamada);
    const timer = window.setTimeout(() => window.speechSynthesis.speak(utterance), 180);
    return () => window.clearTimeout(timer);
  }, [chamada, chaveChamada, suportado, vozAtiva]);

  function alternarVoz() {
    if (!suportado) return;
    const proximo = !vozAtiva;
    setVozAtiva(proximo);
    window.localStorage.setItem("medsync:painel-voz", proximo ? "1" : "0");

    window.speechSynthesis.cancel();
    if (proximo) {
      const aviso = new SpeechSynthesisUtterance("Áudio do painel ativado.");
      aviso.lang = "pt-BR";
      aviso.rate = 0.92;
      const voz = escolherVozPtBr();
      if (voz) aviso.voice = voz;
      window.speechSynthesis.speak(aviso);

      // Permite anunciar imediatamente a chamada atual após a ativação.
      if (chaveChamada) {
        const storageKey = `medsync:painel-ultima-voz:${window.location.pathname}`;
        window.sessionStorage.removeItem(storageKey);
      }
    }
  }

  return (
    <button
      type="button"
      onClick={alternarVoz}
      disabled={!suportado}
      className={`inline-flex items-center gap-2 rounded-2xl border px-4 py-3 text-xs font-bold backdrop-blur transition ${vozAtiva ? "border-emerald-300/20 bg-emerald-400/10 text-emerald-200" : "border-white/10 bg-white/[0.06] text-white/65 hover:bg-white/[0.10]"}`}
      title={suportado ? (vozAtiva ? "Desativar chamadas por voz" : "Ativar chamadas por voz") : "Este navegador não oferece síntese de voz"}
    >
      {vozAtiva ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
      {suportado ? (vozAtiva ? "Voz ativada" : "Ativar voz") : "Voz indisponível"}
    </button>
  );
}
