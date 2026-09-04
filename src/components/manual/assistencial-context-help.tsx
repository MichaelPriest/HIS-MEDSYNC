"use client";

import Link from "next/link";
import { BookOpenCheck } from "lucide-react";
import { usePathname } from "next/navigation";

const contextualHelp: Array<{ prefix: string; href: string; label: string }> = [
  { prefix: "/assistencial/enfermagem", href: "/manual#enfermagem-administracao", label: "Enfermagem e administração" },
  { prefix: "/assistencial/medicamentos", href: "/manual#farmacia-fefo", label: "Farmácia e medicamentos" },
  { prefix: "/assistencial/laboratorio", href: "/manual#laboratorio-lis", label: "Laboratório / LIS" },
  { prefix: "/assistencial/imagem", href: "/manual#imagem-ris-pacs", label: "Imagem / RIS e PACS" },
  { prefix: "/assistencial/centro-cirurgico", href: "/manual#faturamento-equipe-cirurgica-amb-cbhpm", label: "Centro Cirúrgico e faturamento" },
  { prefix: "/assistencial/urgencia", href: "/manual#urgencia-emergencia-reavaliacao", label: "Urgência e Emergência" },
  { prefix: "/assistencial/uti", href: "/manual#uti-acompanhamento-episodio", label: "UTI e episódio internado" },
  { prefix: "/assistencial/sae", href: "/manual#sae-processo-enfermagem", label: "SAE e processo de enfermagem" },
  { prefix: "/assistencial/cme", href: "/manual#cme-rastreabilidade-processamento", label: "CME e rastreabilidade" },
  { prefix: "/assistencial/dialise", href: "/manual#dialise-sessao-integrada", label: "Diálise integrada" },
];

export function AssistencialContextHelp() {
  const pathname = usePathname();
  const current = contextualHelp.find((item) => pathname === item.prefix || pathname.startsWith(`${item.prefix}/`));
  const href = current?.href ?? "/manual";
  const label = current?.label ?? "Base de Conhecimento assistencial";

  return (
    <div className="border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex w-full max-w-[1680px] items-center justify-between gap-3 px-4 py-2.5 sm:px-6 lg:px-8">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[.16em] text-brand-600">Ajuda contextual</p>
          <p className="truncate text-xs font-semibold text-slate-500">{label}</p>
        </div>
        <Link
          href={href}
          className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-brand-700 shadow-sm transition hover:border-brand-200 hover:bg-brand-50"
        >
          <BookOpenCheck className="size-4" />
          Ajuda desta etapa
        </Link>
      </div>
    </div>
  );
}
