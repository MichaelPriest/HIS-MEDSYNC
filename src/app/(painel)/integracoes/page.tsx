import type { Route as NextRoute } from "next";
import Link from "next/link";
import { Activity, AlertTriangle, CheckCircle2, RefreshCcw, Route, ShieldAlert } from "lucide-react";
import { SectionPage } from "@/components/painel/section-page";
import { requirePermission } from "@/lib/permissions/server";
import { reconciliarIntegracoesAction } from "@/modules/integracao/actions";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Paciente = { nome_completo: string | null; ra: string | null; numero_registro: string | null };
type Atendimento = { numero_atendimento: number | string | null };
type Pendencia = {
  id: string;
  atendimento_id: string | null;
  regra_chave: string;
  setor_origem: string;
  setor_destino: string;
  severidade: "baixa" | "media" | "alta" | "critica";
  titulo: string;
  detalhes: string | null;
  detectada_em: string;
  paciente: Paciente | Paciente[] | null;
  atendimento: Atendimento | Atendimento[] | null;
};
type Evento = {
  id: string;
  tipo_evento: string;
  origem_tabela: string;
  ocorrido_em: string;
  atendimento_id: string | null;
  paciente: Paciente | Paciente[] | null;
};

function one<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

function dateTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(value));
}

function label(value: string) {
  return value.replaceAll("_", " ").replaceAll(".", " · ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function destinationHref(setor: string) {
  if (setor === "faturamento") return "/faturamento/producao";
  if (setor === "financeiro") return "/financeiro";
  if (setor === "imagem") return "/assistencial/imagem/laudos";
  if (setor === "comercial") return "/comercial";
  if (setor === "farmacia") return "/setores/farmacia";
  if (setor === "enfermagem") return "/assistencial/medicamentos";
  if (setor === "almoxarifado") return "/almoxarifado";
  if (setor === "nir") return "/internacao/nir";
  if (setor === "internacao") return "/internacao";
  return "/painel";
}

function severityClass(severidade: Pendencia["severidade"]) {
  if (severidade === "critica") return "border-rose-200 bg-rose-50 text-rose-700";
  if (severidade === "alta") return "border-amber-200 bg-amber-50 text-amber-700";
  if (severidade === "media") return "border-sky-200 bg-sky-50 text-sky-700";
  return "border-slate-200 bg-slate-50 text-slate-600";
}

export default async function IntegracoesPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string; sucesso?: string }>;
}) {
  const qs = await searchParams;
  const { supabase, unidadeId } = await requirePermission("integracao.visualizar");

  let pendenciasQuery = supabase
    .from("integracao_pendencias")
    .select("id,atendimento_id,regra_chave,setor_origem,setor_destino,severidade,titulo,detalhes,detectada_em,paciente:pacientes(nome_completo,ra,numero_registro),atendimento:atendimentos(numero_atendimento)")
    .eq("status", "aberta")
    .order("detectada_em", { ascending: false })
    .limit(250);
  let eventosQuery = supabase
    .from("integracao_eventos")
    .select("id,tipo_evento,origem_tabela,ocorrido_em,atendimento_id,paciente:pacientes(nome_completo,ra,numero_registro)")
    .order("ocorrido_em", { ascending: false })
    .limit(120);

  if (unidadeId) {
    pendenciasQuery = pendenciasQuery.eq("unidade_id", unidadeId);
    eventosQuery = eventosQuery.eq("unidade_id", unidadeId);
  }

  const [pendenciasResult, eventosResult] = await Promise.all([pendenciasQuery, eventosQuery]);
  if (pendenciasResult.error) console.error("[integracao] falha ao carregar pendencias", { code: pendenciasResult.error.code });
  if (eventosResult.error) console.error("[integracao] falha ao carregar eventos", { code: eventosResult.error.code });

  const pendencias = (pendenciasResult.data ?? []) as unknown as Pendencia[];
  const eventos = (eventosResult.data ?? []) as unknown as Evento[];
  const criticas = pendencias.filter((item) => item.severidade === "critica").length;
  const altas = pendencias.filter((item) => item.severidade === "alta").length;
  const destinos = new Set(pendencias.map((item) => item.setor_destino)).size;

  const erro = qs.erro === "selecione-unidade"
    ? "Selecione uma unidade antes de executar a reconciliação."
    : qs.erro
      ? "Não foi possível reconciliar as integrações."
      : null;

  return (
    <SectionPage
      eyebrow="Operação transversal / Integração"
      title="Central de Pendências Intersetoriais"
      description="Reconciliação derivada dos fatos já registrados no HIS. A central aponta quebras entre setores sem alterar prontuário, laudos, cirurgia, estoque, conta, TISS ou Livro de Produção. A correção deve acontecer sempre no módulo de origem responsável."
    >
      {qs.sucesso === "reconciliado" ? (
        <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
          Reconciliação concluída. Pendências que deixaram de existir foram resolvidas automaticamente.
        </div>
      ) : null}
      {erro ? <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{erro}</div> : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Kpi icon={AlertTriangle} label="Pendências abertas" value={pendencias.length} />
        <Kpi icon={ShieldAlert} label="Críticas" value={criticas} tone="rose" />
        <Kpi icon={AlertTriangle} label="Altas" value={altas} tone="amber" />
        <Kpi icon={Route} label="Setores destino" value={destinos} tone="sky" />
        <Kpi icon={Activity} label="Eventos recentes" value={eventos.length} tone="emerald" />
      </section>

      <section className="ui-card mt-5 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 px-5 py-4">
          <div>
            <h2 className="font-black text-slate-900">Reconciliação operacional</h2>
            <p className="mt-1 max-w-3xl text-xs leading-5 text-slate-500">Reprocessa apenas as regras de consistência. Não cria exame, laudo, cirurgia, OPME, internação, ocupação de leito, dispensação, administração, movimento de estoque, produção, conta, guia TISS, lote, glosa, recurso ou recebível.</p>
          </div>
          <form action={reconciliarIntegracoesAction}>
            <button className="ui-button-secondary" disabled={!unidadeId} title={!unidadeId ? "Selecione uma unidade" : undefined}>
              <RefreshCcw className="size-4" />Reconciliar agora
            </button>
          </form>
        </div>
      </section>

      <section className="ui-card mt-5 overflow-hidden">
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 className="font-black text-slate-900">Pendências que exigem ação</h2>
          <p className="mt-1 text-xs text-slate-500">Cobertura atual: diagnóstico, Centro Cirúrgico/OPME, Prescrição → Farmácia → Enfermagem → Estoque, Internação → NIR/Leitos → Alta e Conta → Auditoria → TISS → Glosa/Recurso → Financeiro.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-[11px] font-black uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Paciente / atendimento</th>
                <th className="px-4 py-3">Pendência</th>
                <th className="px-4 py-3">Fluxo</th>
                <th className="px-4 py-3">Severidade</th>
                <th className="px-4 py-3">Detectada</th>
                <th className="px-4 py-3">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pendencias.length ? pendencias.map((item) => {
                const paciente = one(item.paciente);
                const atendimento = one(item.atendimento);
                return (
                  <tr key={item.id} className="align-top">
                    <td className="px-4 py-3">
                      <div className="font-bold text-slate-900">{paciente?.nome_completo ?? "Paciente"}</div>
                      <div className="mt-1 text-xs text-slate-500">RA {paciente?.ra ?? paciente?.numero_registro ?? "—"} · Atendimento #{atendimento?.numero_atendimento ?? "—"}</div>
                    </td>
                    <td className="max-w-xl px-4 py-3">
                      <div className="font-bold text-slate-900">{item.titulo}</div>
                      <div className="mt-1 text-xs leading-5 text-slate-500">{item.detalhes}</div>
                      <div className="mt-1 font-mono text-[10px] text-slate-400">{item.regra_chave}</div>
                    </td>
                    <td className="px-4 py-3 text-xs font-semibold text-slate-600">{label(item.setor_origem)} → {label(item.setor_destino)}</td>
                    <td className="px-4 py-3"><span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-black uppercase ${severityClass(item.severidade)}`}>{item.severidade}</span></td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500">{dateTime(item.detectada_em)}</td>
                    <td className="px-4 py-3"><Link href={destinationHref(item.setor_destino) as NextRoute} className="ui-button-secondary whitespace-nowrap">Abrir setor</Link></td>
                  </tr>
                );
              }) : (
                <tr><td colSpan={6} className="px-4 py-12 text-center"><CheckCircle2 className="mx-auto size-8 text-emerald-500" /><p className="mt-3 font-bold text-slate-800">Nenhuma quebra detectada nas regras ativas.</p><p className="mt-1 text-xs text-slate-500">Novos fatos continuam sendo registrados no ledger de integração.</p></td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="ui-card mt-5 overflow-hidden">
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 className="font-black text-slate-900">Eventos de integração</h2>
          <p className="mt-1 text-xs text-slate-500">Ledger append-only e idempotente para rastrear fatos finalizados entre os setores.</p>
        </div>
        <div className="divide-y divide-slate-100">
          {eventos.length ? eventos.map((evento) => {
            const paciente = one(evento.paciente);
            return (
              <div key={evento.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm">
                <div><span className="font-black text-slate-900">{label(evento.tipo_evento)}</span><span className="ml-2 text-xs text-slate-500">{paciente?.nome_completo ?? "Episódio"} · {evento.origem_tabela}</span></div>
                <div className="text-xs font-semibold text-slate-500">{dateTime(evento.ocorrido_em)}</div>
              </div>
            );
          }) : <div className="px-5 py-8 text-center text-sm text-slate-500">Nenhum evento de integração disponível no escopo atual.</div>}
        </div>
      </section>
    </SectionPage>
  );
}

function Kpi({ icon: Icon, label: text, value, tone = "slate" }: { icon: typeof Activity; label: string; value: number; tone?: "slate" | "rose" | "amber" | "sky" | "emerald" }) {
  const tones = {
    slate: "bg-slate-50 text-slate-600",
    rose: "bg-rose-50 text-rose-600",
    amber: "bg-amber-50 text-amber-700",
    sky: "bg-sky-50 text-sky-700",
    emerald: "bg-emerald-50 text-emerald-700",
  };
  return <div className="ui-card flex items-center gap-3 p-4"><div className={`rounded-xl p-2.5 ${tones[tone]}`}><Icon className="size-5" /></div><div><div className="text-2xl font-black text-slate-950">{value}</div><div className="text-xs font-semibold text-slate-500">{text}</div></div></div>;
}
