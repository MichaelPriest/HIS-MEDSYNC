import Image from "next/image";
import Link from "next/link";
import type { Route } from "next";
import { ArrowLeft, BadgeCheck, QrCode } from "lucide-react";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { PrintIdentificacaoButton } from "@/components/prontuario/print-identificacao-button";
import { createClient } from "@/lib/supabase/server";

type Rel<T> = T | T[] | null;
function one<T>(value: Rel<T>): T | null { return Array.isArray(value) ? value[0] ?? null : value; }
function dateBr(value: string | null | undefined) {
  if (!value) return "—";
  const [year, month, day] = value.slice(0, 10).split("-");
  return year && month && day ? `${day}/${month}/${year}` : value;
}
function sexLabel(value: string | null | undefined) {
  const normalized = String(value ?? "").toUpperCase();
  if (normalized === "M" || normalized === "MASCULINO") return "M";
  if (normalized === "F" || normalized === "FEMININO") return "F";
  return value || "—";
}

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function IdentificacaoPacientePage({
  params,
  searchParams,
}: {
  params: Promise<{ atendimentoId: string }>;
  searchParams: Promise<{ tipo?: string; copias?: string }>;
}) {
  const { atendimentoId } = await params;
  const sp = await searchParams;
  const tipo = sp.tipo === "pulseira" ? "pulseira" : "etiqueta";
  const copias = Math.max(1, Math.min(10, Number.parseInt(sp.copias ?? "1", 10) || 1));
  const supabase = await createClient();

  const { data: atendimento } = await supabase
    .from("atendimentos")
    .select("id,numero_atendimento,status,tipo_atendimento,data_abertura,setor_atual,paciente:pacientes(id,nome_completo,ra,numero_registro,data_nascimento,sexo,cpf,cns)")
    .eq("id", atendimentoId)
    .maybeSingle();

  if (!atendimento) notFound();
  const paciente = one(atendimento.paciente);
  if (!paciente) notFound();

  const identificador = paciente.ra?.trim()
    || (paciente.numero_registro ? String(paciente.numero_registro) : "")
    || paciente.cns?.trim()
    || paciente.cpf?.trim()
    || paciente.id;

  const qrDataUrl = await QRCode.toDataURL(identificador, {
    errorCorrectionLevel: "M",
    margin: 1,
    width: tipo === "pulseira" ? 168 : 220,
  });

  const copies = Array.from({ length: copias }, (_, index) => index);
  const labelHref = `/prontuario/${atendimentoId}/identificacao?tipo=etiqueta&copias=${copias}` as Route;
  const wristHref = `/prontuario/${atendimentoId}/identificacao?tipo=pulseira&copias=${copias}` as Route;
  const returnHref = `/prontuario/${atendimentoId}` as Route;

  const printCss = tipo === "pulseira" ? `
    @media print {
      @page { size: 250mm 25mm; margin: 0; }
      body * { visibility: hidden !important; }
      .patient-print-area, .patient-print-area * { visibility: visible !important; }
      .patient-print-area { position: absolute !important; inset: 0 auto auto 0 !important; margin: 0 !important; padding: 0 !important; width: 250mm !important; background: white !important; }
      .patient-print-item { page-break-after: always; break-after: page; box-shadow: none !important; border: 0 !important; margin: 0 !important; width: 250mm !important; height: 25mm !important; }
      .patient-print-item:last-child { page-break-after: auto; break-after: auto; }
    }
  ` : `
    @media print {
      @page { size: 80mm 50mm; margin: 0; }
      body * { visibility: hidden !important; }
      .patient-print-area, .patient-print-area * { visibility: visible !important; }
      .patient-print-area { position: absolute !important; inset: 0 auto auto 0 !important; margin: 0 !important; padding: 0 !important; width: 80mm !important; background: white !important; }
      .patient-print-item { page-break-after: always; break-after: page; box-shadow: none !important; border: 0 !important; margin: 0 !important; width: 80mm !important; height: 50mm !important; }
      .patient-print-item:last-child { page-break-after: auto; break-after: auto; }
    }
  `;

  return (
    <main className="mx-auto w-full max-w-[1500px] px-4 pb-10 sm:px-6 lg:px-8">
      <style dangerouslySetInnerHTML={{ __html: printCss }} />

      <div className="print:hidden">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <Link href={returnHref} className="ui-button-secondary"><ArrowLeft className="size-4" />Voltar ao prontuário</Link>
          <PrintIdentificacaoButton />
        </div>

        <section className="ui-card mb-5 p-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-wider text-brand-600">Identificação segura do paciente</p>
              <h1 className="mt-1 text-2xl font-black text-slate-950">Etiqueta e pulseira</h1>
              <p className="mt-1 text-sm text-slate-500">{paciente.nome_completo} · Atendimento #{atendimento.numero_atendimento} · {paciente.ra || `Registro #${paciente.numero_registro ?? "—"}`}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href={labelHref} className={tipo === "etiqueta" ? "ui-button-primary" : "ui-button-secondary"}>Etiqueta 80 × 50 mm</Link>
              <Link href={wristHref} className={tipo === "pulseira" ? "ui-button-primary" : "ui-button-secondary"}>Pulseira 250 × 25 mm</Link>
            </div>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800"><BadgeCheck className="mb-1 size-4" /><b>Identificador da leitura:</b><br />{identificador}</div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700"><QrCode className="mb-1 size-4" /><b>QR compatível com a checagem:</b><br />a leitura retorna somente o identificador aceito pela Enfermagem.</div>
            <form className="rounded-xl border border-slate-200 bg-slate-50 p-3" method="get">
              <input type="hidden" name="tipo" value={tipo} />
              <label className="text-xs font-bold uppercase tracking-wide text-slate-500">Cópias</label>
              <div className="mt-1 flex gap-2"><input type="number" min="1" max="10" name="copias" defaultValue={copias} className="ui-input" /><button className="ui-button-secondary">Aplicar</button></div>
            </form>
          </div>
        </section>
      </div>

      <section className="patient-print-area space-y-4 print:space-y-0">
        {copies.map((copy) => tipo === "pulseira" ? (
          <article key={copy} className="patient-print-item mx-auto flex h-[25mm] w-full max-w-[250mm] items-stretch overflow-hidden border-2 border-slate-900 bg-white text-black shadow-sm">
            <div className="flex min-w-0 flex-1 items-center gap-3 px-[4mm] py-[2mm]">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-black uppercase leading-tight">{paciente.nome_completo}</p>
                <div className="mt-1 grid grid-cols-3 gap-x-3 text-[10px] font-semibold leading-tight">
                  <span>Nasc. <b>{dateBr(paciente.data_nascimento)}</b></span>
                  <span>Sexo <b>{sexLabel(paciente.sexo)}</b></span>
                  <span>Atend. <b>#{atendimento.numero_atendimento}</b></span>
                  <span className="col-span-2">RA/Registro <b>{paciente.ra || paciente.numero_registro || "—"}</b></span>
                  <span>Setor <b>{atendimento.setor_atual || "—"}</b></span>
                </div>
                <p className="mt-1 truncate font-mono text-[8px]">ID leitura: {identificador}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2 border-l border-slate-400 pl-3">
                <Image src={qrDataUrl} alt="QR de identificação do paciente" width={76} height={76} unoptimized className="size-[19mm]" />
                <div className="w-[38mm] text-center text-[8px] font-bold uppercase leading-tight">MedSync<br />Identificação do paciente<br /><span className="font-normal">Conferir nome + nascimento antes do cuidado</span></div>
              </div>
            </div>
            <div className="w-[45mm] border-l border-dashed border-slate-500 bg-[repeating-linear-gradient(90deg,#fff,#fff_5mm,#f1f5f9_5mm,#f1f5f9_10mm)]" aria-hidden="true" />
          </article>
        ) : (
          <article key={copy} className="patient-print-item mx-auto grid h-[50mm] w-full max-w-[80mm] grid-cols-[1fr_24mm] overflow-hidden border-2 border-slate-900 bg-white text-black shadow-sm">
            <div className="min-w-0 p-[3mm]">
              <p className="text-[8px] font-black uppercase tracking-wide">MedSync · Identificação do paciente</p>
              <p className="mt-[1.5mm] line-clamp-2 text-[14px] font-black uppercase leading-[1.05]">{paciente.nome_completo}</p>
              <div className="mt-[2mm] grid grid-cols-2 gap-x-2 gap-y-1 text-[9px] leading-tight">
                <span>Nascimento<br /><b>{dateBr(paciente.data_nascimento)}</b></span>
                <span>Sexo<br /><b>{sexLabel(paciente.sexo)}</b></span>
                <span>Atendimento<br /><b>#{atendimento.numero_atendimento}</b></span>
                <span>RA / Registro<br /><b>{paciente.ra || paciente.numero_registro || "—"}</b></span>
                <span className="col-span-2">Setor <b>{atendimento.setor_atual || "—"}</b></span>
              </div>
              <p className="mt-[2mm] truncate font-mono text-[7px]">ID: {identificador}</p>
            </div>
            <div className="flex flex-col items-center justify-center border-l border-slate-400 p-[2mm] text-center">
              <Image src={qrDataUrl} alt="QR de identificação do paciente" width={108} height={108} unoptimized className="size-[21mm]" />
              <p className="mt-1 text-[7px] font-bold uppercase leading-tight">Ler na checagem</p>
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}
