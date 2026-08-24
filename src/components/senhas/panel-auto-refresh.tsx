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

const DIGITOS: Record<string, string> = {
  "0": "zero",
  "1": "um",
  "2": "dois",
  "3": "três",
  "4": "quatro",
  "5": "cinco",
  "6": "seis",
  "7": "sete",
  "8": "oito",
  "9": "nove",
};

const LETRAS: Record<string, string> = {
  R: "érre",
  T: "tê",
  C: "cê",
  E: "ê",
  L: "éle",
  I: "i",
  F: "éfe",
  N: "êne",
};

function senhaPorExtenso(senha: string) {
  return senha
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .split("")
    .map((char) => DIGITOS[char] ?? LETRAS[char] ?? char)
    .join(", ");
}

function numeroDestinoPorExtenso(texto: string) {
  return texto.replace(/\b(\d{1,2})\b/g, (numero) => {
    const n = Number(numero);
    if (n >= 1 && n <= 30) {
      const unidades = ["", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove"];
      const especiais = ["dez", "onze", "doze", "treze", "quatorze", "quinze", "dezesseis", "dezessete", "dezoito", "dezenove"];
      const dezenas = ["", "", "vinte", "trinta"];
      if (n < 10) return unidades[n];
      if (n < 20) return especiais[n - 10];
      const dezena = Math.floor(n / 10);
      const unidade = n % 10;
      return unidade ? `${dezenas[dezena]} e ${unidades[unidade]}` : dezenas[dezena];
    }
    return numero;
  });
}

function pontuarVoz(voice: SpeechSynthesisVoice) {
  const lang = voice.lang.toLowerCase();
  const nome = voice.name.toLowerCase();
  let score = 0;

  if (lang === "pt-br") score += 120;
  else if (lang.startsWith("pt")) score += 70;
  else return -1000;

  if (nome.includes("natural")) score += 90;
  if (nome.includes("online")) score += 60;
  if (nome.includes("francisca")) score += 80;
  if (nome.includes("antonio") || nome.includes("antônio")) score += 70;
  if (nome.includes("google")) score += 55;
  if (nome.includes("luciana")) score += 45;
  if (nome.includes("maria")) score += 35;
  if (nome.includes("neural")) score += 90;
  if (nome.includes("desktop")) score -= 20;
  if (nome.includes("compact")) score -= 60;

  return score;
}

function escolherVozPtBr() {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return null;
  return [...window.speechSynthesis.getVoices()]
    .sort((a, b) => pontuarVoz(b) - pontuarVoz(a))[0] ?? null;
}

function textoDaChamada(chamada?: ChamadaVoz | null) {
  if (!chamada?.senha) return "";

  const senhaFal falha_placeholder = "";
  return senhaFal;
}

function montarTextoDaChamada(chamada?: ChamadaVoz | null) {
  if (!chamada?.senha) return "";
  const senha = senhaPorExtenso(chamada.senha);
  const identificacao = chamada.identificado && chamada.nome
    ? `Atenção. ${chamada.nome}. Sua senha é ${senha}.`
    : `Atenção. Senha ${senha}.`;
  const destino = chamada.ponto
    ? `Por favor, dirija-se ao ${numeroDestinoPorExtenso(chamada.ponto)}.`
    : chamada.setor
      ? `Por favor, dirija-se ao setor ${chamada.setor}.`
      : "Aguarde a orientação da equipe.";
  return `${identificacao} ${destino}`;
}

function tocarSinal() {
  try {
    const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const ganho = ctx.createGain();
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(784, ctx.currentTime);
    ganho.gain.setValueAtTime(0.0001, ctx.currentTime);
    ganho.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + 0.02);
    ganho.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.32);
    osc.connect(ganho);
    ganho.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.34);
    osc.addEventListener("ended", () => void ctx.close());
  } catch {
    // O sinal é apenas um complemento; a voz continua funcionando sem WebAudio.
  }
}

export function PanelAutoRefresh({
  intervalMs = 5000,
  chamada,
  habilitado = true,
}: {
  intervalMs?: number;
  chamada?: ChamadaVoz | null;
  habilitado?: boolean;
}) {
  const router = useRouter();
  const [vozAtiva, setVozAtiva] = useState(false);
  const [suportado, setSuportado] = useState(true);
  const [nomeVoz, setNomeVoz] = useState<string | null>(null);
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

    const atualizarVoz = () => {
      const voz = escolherVozPtBr();
      setNomeVoz(voz?.name ?? null);
    };

    atualizarVoz();
    window.speechSynthesis.addEventListener("voiceschanged", atualizarVoz);
    setVozAtiva(habilitado && window.localStorage.getItem("medsync:painel-voz") === "1");
    mounted.current = true;

    return () => window.speechSynthesis.removeEventListener("voiceschanged", atualizarVoz);
  }, [habilitado]);

  useEffect(() => {
    if (!mounted.current || !habilitado || !vozAtiva || !suportado || !chaveChamada || !chamada) return;

    const storageKey = `medsync:painel-ultima-voz:${window.location.pathname}${window.location.search}`;
    if (window.sessionStorage.getItem(storageKey) === chaveChamada) return;

    const texto = montarTextoDaChamada(chamada);
    if (!texto) return;

    window.speechSynthesis.cancel();
    tocarSinal();

    const utterance = new SpeechSynthesisUtterance(texto);
    utterance.lang = "pt-BR";
    utterance.rate = 0.94;
    utterance.pitch = 1.04;
    utterance.volume = 1;
    const voz = escolherVozPtBr();
    if (voz) utterance.voice = voz;

    window.sessionStorage.setItem(storageKey, chaveChamada);
    const timer = window.setTimeout(() => window.speechSynthesis.speak(utterance), 520);
    return () => window.clearTimeout(timer);
  }, [chamada, chaveChamada, habilitado, suportado, vozAtiva]);

  function alternarVoz() {
    if (!suportado || !habilitado) return;
    const proximo = !vozAtiva;
    setVozAtiva(proximo);
    window.localStorage.setItem("medsync:painel-voz", proximo ? "1" : "0");
    window.speechSynthesis.cancel();

    if (proximo) {
      const aviso = new SpeechSynthesisUtterance("Áudio do painel ativado. A voz está pronta para as próximas chamadas.");
      aviso.lang = "pt-BR";
      aviso.rate = 0.96;
      aviso.pitch = 1.03;
      const voz = escolherVozPtBr();
      if (voz) aviso.voice = voz;
      window.speechSynthesis.speak(aviso);

      if (chaveChamada) {
        const storageKey = `medsync:painel-ultima-voz:${window.location.pathname}${window.location.search}`;
        window.sessionStorage.removeItem(storageKey);
      }
    }
  }

  const indisponivel = !suportado || !habilitado;
  const titulo = !habilitado
    ? "O áudio foi desativado nas configurações da unidade"
    : nomeVoz
      ? `Voz selecionada: ${nomeVoz}`
      : "O navegador escolherá a melhor voz disponível em português";

  return (
    <button
      type="button"
      onClick={alternarVoz}
      disabled={indisponivel}
      className={`inline-flex items-center gap-2 rounded-2xl border px-4 py-3 text-xs font-bold backdrop-blur transition ${vozAtiva ? "border-emerald-300/20 bg-emerald-400/10 text-emerald-200" : "border-white/10 bg-white/[0.06] text-white/65 hover:bg-white/[0.10]"}`}
      title={titulo}
    >
      {vozAtiva ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
      {!habilitado ? "Áudio desativado" : suportado ? (vozAtiva ? "Voz natural ativada" : "Ativar voz") : "Voz indisponível"}
    </button>
  );
}
