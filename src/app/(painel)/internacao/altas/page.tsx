import type { Route } from "next";
import Link from "next/link";
import { CheckCircle2, ClipboardCheck, Clock3, Search, ShieldAlert, Stethoscope } from "lucide-react";
import { SectionPage } from "@/components/painel/section-page";
import { requireAnyPermission } from "@/lib/permissions/server";

type Rel<T> = T | T[] | null;
type Paciente = { nome_completo: string | null; ra: string | null };
type Atendimento = { id: string; numero_atendimento: string | number | null; paciente: Rel<Paciente> };
type Internacao = {
  id: string;
  atendimento_id: string;
  setor: string;
  quarto: string | null;
  leito: string | null;
  previsao_alta: string | null;
  data_internacao: string | null;
  status: string;
  atendimento: Rel<Atendimento>;
};
type Pendencia = { internacao_id: string; codigo: string; descricao: string; bloqueia_alta: boolean; status: string };
type Plano = { internacao_id: string; status: string; created_at: string };
type Sumario = { internacao_id: string; assinado_em: string | null; created_at: string };
type Conciliacao = { atendimento_id: string; conciliado_em: string | null };
type Params = { q?: string; situacao?: string; sucesso?: string; erro?: string };

const one = <T,>(value: Rel<T>): T | null => Array.isArray(value) ? value[0] ?? null : value;
const fmtDate = (value?: string | null) => value ? new Date(`${value}T12:00:00`).toLocaleDateString("pt-BR") : "—";
const fmtDateTime = (value?: string | null) => value ? new Date(value).toLocaleString("pt-BR") : "—";

export default async function CentralAltasPage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const { supabase, empresaId, unidadeId } = await requireAnyPermission([
    "internacao.visualizar",
    "internacao.gerenciar",
  ]);
  if (!unidadeId) return null;

  const [internacoesReq, pendenciasReq, planosReq, sumariosReq, conciliacoesReq] = await Promise.all([
    supabase
      .from("internacoes")
      .select("id,atendimento_id,setor,quarto,leito,previsao_alta,data_internacao,status,atendimento:atendimentos(id,numero_atendimento,paciente:pacientes(nome_completo,ra))")
      .eq("empresa_id", empresaId)
      .eq("unidade_id", unidadeId)
      .in("status", ["aguardando_leito", "internado", "transferido"])
      .order("previsao_alta", { ascending: true, nullsFirst: false })
      .limit(250),
    supabase
      .from("alta_pendencias")
      .select("internacao_id,codigo,descricao,bloqueia_alta,status")
      .eq("empresa_id", empresaId)
      .eq("unidade_id", unidadeId)
      .limit(1000),
    supabase
      .from("planejamentos_alta")
      .select("internacao_id,status,created_at")
      .eq("empresa_id", empresaId)
      .eq("unidade_id", unidadeId)
      .order("created_at", { ascending: false })
      .limit(500),
    supabase
      .from("sumarios_alta")
      .select("internacao_id,assinado_em,created_at")
      .eq("empresa_id", empresaId)
      .eq("unidade_id", unidadeId)
      .order("created_at", { ascending: false })
      .limit(500),
    supabase
      .from("conciliacoes_medicamentosas")
      .select("atendimento_id,conciliado_em")
      .eq("empresa_id", empresaId)
      .eq("unidade_id", unidadeId)
      .eq("momento", "alta")
      .order("conciliado_em", { ascending: false })
      .limit(1000),
  ]);

  const internacoes = (internacoesReq.data ?? []) as Internacao[];
  const pendencias = (pendenciasReq.data ?? []) as Pendencia[];
  const planos = (planosReq.data ?? []) as Plano[];
  const sumarios = (sumariosReq.data ?? []) as Sumario[];
  const conciliacoes = (conciliacoesReq.data ?? []) as Conciliacao[];
  const query = params.q?.trim().toLowerCase() ?? "";
  const situacao = params.situacao ?? "";

  const rows = internacoes.map((internacao) => {
    const atendimento = one(internacao.atendimento);
    const paciente = one(atendimento?.paciente ?? null);
    const blockers = pendencias.filter((item) => item.internacao_id === internacao.id && item.bloqueia_alta && item.status !== "resolvida");
    const plano = planos.find((item) => item.internacao_id === internacao.id);
    const sumario = sumarios.find((item) => item.internacao_id === internacao.id);
    const conciliacaoOk = conciliacoes.some((item) => item.atendimento_id === internacao.atendimento_id);
    const planoOk = plano?.status === "concluido";
    const sumarioOk = Boolean(sumario?.assinado_em);
    const pronta = blockers.length === 0 && planoOk && conciliacaoOk && sumarioOk;
    return { internacao, atendimento, paciente, blockers, planoOk, conciliacaoOk, sumarioOk, pronta };
  });

  const filtered = rows.filter((row) => {
    if (situacao === "pronta" && !row.pronta) return false;
    if (situacao === "pendente" && row.pronta) return false;
    if (!query) return true;
    const haystack = `${row.paciente?.nome_completo ?? ""} ${row.paciente?.ra ?? ""} ${row.atendimento?.numero_atendimento ?? ""} ${row.internacao.setor} ${row.internacao.leito ?? ""}`.toLowerCase();
    return haystack.includes(query);
  });

  const prontas = rows.filter((row) => row.pronta).length;
  const pendentes = rows.length - prontas;
  const previstasHoje = rows.filter((row) => row.internacao.previsao_alta === new Date().toISOString().slice(0, 10)).length;

  return (
    <SectionPage
      eyebrow="Assistencial / Internação"
      title="Central de Altas"
      description="Fila de alta segura com as barreiras clínicas resumidas. Abra um paciente somente quando precisar trabalhar o plano, a conciliação ou o sumário."
      actions={<div className="flex gap-2"><Link href="/internacao" className="ui-button-secondary">Internação</Link><Link href="/internacao/leitos" className="ui-button-secondary">Mapa de leitos</Link></div>}
    >
      {params.sucesso === "alta" ? <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">Alta concluída com sucesso.</div> : null}
      {params.erro ? <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">Não foi possível concluir a ação da Central de Altas.</div> : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Internados" value={rows.length} icon={<Stethoscope className="size-5 text-brand-600" />} />
        <Kpi label="Prontos para alta" value={prontas} icon={<CheckCircle2 className="size-5 text-emerald-600" />} />
        <Kpi label="Com pendências" value={pendentes} icon={<ShieldAlert className="size-5 text-amber-600" />} />
        <Kpi label="Previstas hoje" value={previstasHoje} icon={<Clock3 className="size-5 text-blue-600" />} />
      </section>

      <form className="his-card mt-5 grid gap-3 p-4 md:grid-cols-[1fr_220px_auto]">
        <label className="relative"><Search className="absolute left-3 top-3 size-4 text-slate-400" /><input name="q" defaultValue={params.q ?? ""} placeholder="Paciente, RA, atendimento, ala ou leito..." className="ui-input pl-9" /></label>
        <select name="situacao" defaultValue={situacao} className="ui-input"><option value="">Todas as situações</option><option value="pronta">Prontas para alta</option><option value="pendente">Com pendências</option></select>
        <button className="ui-button-secondary">Filtrar</button>
      </form>

      <section className="mt-5 his-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1040px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-3">Paciente</th><th className="px-4 py-3">Local</th><th className="px-4 py-3">Previsão</th><th className="px-4 py-3">Planejamento</th><th className="px-4 py-3">Conciliação</th><th className="px-4 py-3">Sumário</th><th className="px-4 py-3">Pendências</th><th className="px-5 py-3 text-right">Ação</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((row) => (
                <tr key={row.internacao.id} className="bg-white align-middle">
                  <td className="px-5 py-4"><p className="font-black text-slate-950">{row.paciente?.nome_completo ?? "Paciente"}</p><p className="mt-1 text-xs text-slate-500">Atend. #{row.atendimento?.numero_atendimento ?? "—"} · RA {row.paciente?.ra ?? "—"}</p></td>
                  <td className="px-4 py-4"><p className="font-semibold text-slate-800">{row.internacao.setor}</p><p className="text-xs text-slate-500">{row.internacao.quarto ? `Quarto ${row.internacao.quarto} · ` : ""}{row.internacao.leito ?? "Sem leito"}</p></td>
                  <td className="px-4 py-4"><p className="font-semibold text-slate-800">{fmtDate(row.internacao.previsao_alta)}</p><p className="text-xs text-slate-400">Desde {fmtDateTime(row.internacao.data_internacao)}</p></td>
                  <td className="px-4 py-4"><Step ok={row.planoOk} label={row.planoOk ? "Concluído" : "Pendente"} /></td>
                  <td className="px-4 py-4"><Step ok={row.conciliacaoOk} label={row.conciliacaoOk ? "Registrada" : "Pendente"} /></td>
                  <td className="px-4 py-4"><Step ok={row.sumarioOk} label={row.sumarioOk ? "Assinado" : "Pendente"} /></td>
                  <td className="px-4 py-4">{row.pronta ? <span className="rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-black text-emerald-700">Liberável</span> : <span className="rounded-lg bg-amber-50 px-2.5 py-1 text-xs font-black text-amber-700">{row.blockers.length} bloqueio(s)</span>}</td>
                  <td className="px-5 py-4 text-right"><Link href={`/internacao/altas/${row.internacao.id}` as Route} className={row.pronta ? "ui-button-primary" : "ui-button-secondary"}>{row.pronta ? "Revisar e concluir" : "Trabalhar alta"}</Link></td>
                </tr>
              ))}
              {!filtered.length ? <tr><td colSpan={8} className="px-6 py-14 text-center"><ClipboardCheck className="mx-auto size-9 text-slate-300" /><p className="mt-3 font-semibold text-slate-700">Nenhum paciente encontrado nesta fila.</p></td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>
    </SectionPage>
  );
}

function Step({ ok, label }: { ok: boolean; label: string }) {
  return <span className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-black ${ok ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}><span className={`size-2 rounded-full ${ok ? "bg-emerald-500" : "bg-slate-300"}`} />{label}</span>;
}

function Kpi({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return <div className="his-kpi"><div className="flex items-center justify-between"><p className="text-xs font-black uppercase tracking-wider text-slate-400">{label}</p>{icon}</div><p className="mt-2 text-3xl font-black text-brand-950">{value}</p></div>;
}
