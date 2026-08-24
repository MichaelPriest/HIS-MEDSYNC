import type { Route } from "next";
import Link from "next/link";
import { CheckCircle2, ClipboardCheck, FileSignature, ListChecks, Pill, RotateCcw, ShieldAlert } from "lucide-react";
import { notFound } from "next/navigation";
import { SectionPage } from "@/components/painel/section-page";
import { requireAnyPermission } from "@/lib/permissions/server";
import {
  assinarSumarioAltaSeguro,
  concluirAltaSegura,
  criarSumarioAltaSeguro,
  registrarConciliacaoAltaSegura,
  revalidarAltaSegura,
  salvarPlanoAltaSegura,
} from "@/modules/internacao/alta-actions";

type Rel<T> = T | T[] | null;
type Paciente = { nome_completo: string | null; ra: string | null };
type Atendimento = { id: string; numero_atendimento: string | number | null; paciente: Rel<Paciente> };
type Internacao = {
  id: string;
  atendimento_id: string;
  setor: string;
  quarto: string | null;
  leito: string | null;
  motivo: string | null;
  previsao_alta: string | null;
  data_internacao: string | null;
  status: string;
  atendimento: Rel<Atendimento>;
};
type Pendencia = { id: string; codigo: string; descricao: string; categoria: string; bloqueia_alta: boolean; status: string; justificativa: string | null };
type Plano = {
  id: string;
  status: string;
  previsao_alta: string | null;
  destino: string | null;
  cuidador_responsavel: string | null;
  necessidades_domiciliares: string | null;
  equipamentos: string | null;
  medicamentos_orientados: string | null;
  retorno_agendado: string | null;
  transporte: string | null;
  orientacoes: string | null;
  created_at: string;
};
type Conciliacao = { id: string; medicamento: string; dose_domiciliar: string | null; decisao: string; conciliado_em: string | null };
type Sumario = { id: string; condicao_alta: string | null; assinado_em: string | null; bloqueado: boolean; created_at: string };
type Params = { sucesso?: string; erro?: string };

const one = <T,>(value: Rel<T>): T | null => Array.isArray(value) ? value[0] ?? null : value;
const fmt = (value?: string | null) => value ? new Date(value).toLocaleString("pt-BR") : "—";

export default async function AltaPacientePage({
  params,
  searchParams,
}: {
  params: Promise<{ internacaoId: string }>;
  searchParams: Promise<Params>;
}) {
  const [{ internacaoId }, query] = await Promise.all([params, searchParams]);
  const { supabase, empresaId, unidadeId } = await requireAnyPermission([
    "internacao.visualizar",
    "internacao.gerenciar",
  ]);
  if (!unidadeId) return null;

  const { data: internacaoData } = await supabase
    .from("internacoes")
    .select("id,atendimento_id,setor,quarto,leito,motivo,previsao_alta,data_internacao,status,atendimento:atendimentos(id,numero_atendimento,paciente:pacientes(nome_completo,ra))")
    .eq("id", internacaoId)
    .eq("empresa_id", empresaId)
    .eq("unidade_id", unidadeId)
    .maybeSingle();

  const internacao = internacaoData as Internacao | null;
  if (!internacao) notFound();

  const [pendenciasReq, planosReq, conciliacoesReq, sumariosReq] = await Promise.all([
    supabase
      .from("alta_pendencias")
      .select("id,codigo,descricao,categoria,bloqueia_alta,status,justificativa")
      .eq("internacao_id", internacaoId)
      .eq("empresa_id", empresaId)
      .eq("unidade_id", unidadeId)
      .order("created_at"),
    supabase
      .from("planejamentos_alta")
      .select("id,status,previsao_alta,destino,cuidador_responsavel,necessidades_domiciliares,equipamentos,medicamentos_orientados,retorno_agendado,transporte,orientacoes,created_at")
      .eq("internacao_id", internacaoId)
      .eq("empresa_id", empresaId)
      .eq("unidade_id", unidadeId)
      .order("created_at", { ascending: false })
      .limit(1),
    supabase
      .from("conciliacoes_medicamentosas")
      .select("id,medicamento,dose_domiciliar,decisao,conciliado_em")
      .eq("atendimento_id", internacao.atendimento_id)
      .eq("empresa_id", empresaId)
      .eq("unidade_id", unidadeId)
      .eq("momento", "alta")
      .order("conciliado_em", { ascending: false }),
    supabase
      .from("sumarios_alta")
      .select("id,condicao_alta,assinado_em,bloqueado,created_at")
      .eq("internacao_id", internacaoId)
      .eq("empresa_id", empresaId)
      .eq("unidade_id", unidadeId)
      .order("created_at", { ascending: false }),
  ]);

  const atendimento = one(internacao.atendimento);
  const paciente = one(atendimento?.paciente ?? null);
  const pendencias = (pendenciasReq.data ?? []) as Pendencia[];
  const plano = ((planosReq.data ?? []) as Plano[])[0] ?? null;
  const conciliacoes = (conciliacoesReq.data ?? []) as Conciliacao[];
  const sumarios = (sumariosReq.data ?? []) as Sumario[];
  const sumario = sumarios[0] ?? null;

  const blockers = pendencias.filter((item) => item.bloqueia_alta && item.status !== "resolvida");
  const planoOk = plano?.status === "concluido";
  const conciliacaoOk = conciliacoes.length > 0;
  const sumarioOk = Boolean(sumario?.assinado_em);
  const pronta = blockers.length === 0 && planoOk && conciliacaoOk && sumarioOk;

  const successMessage: Record<string, string> = {
    revalidada: "Pendências de alta revalidadas.",
    plano: "Planejamento de alta salvo.",
    conciliacao: "Conciliação medicamentosa registrada.",
    sumario: "Sumário de alta criado.",
    assinado: "Sumário de alta assinado.",
  };
  const errorMessage: Record<string, string> = {
    revalidar: "Não foi possível revalidar as pendências.",
    internacao: "Internação não está disponível para este fluxo.",
    atendimento: "Atendimento vinculado não foi localizado.",
    profissional: "É necessário um profissional ativo vinculado ao usuário para registrar esta etapa.",
    medicamento: "Informe o medicamento para registrar a conciliação.",
    plano: "Não foi possível salvar o planejamento de alta.",
    conciliacao: "Não foi possível registrar a conciliação medicamentosa.",
    sumario: "Não foi possível criar o sumário de alta.",
    assinatura: "Não foi possível assinar o sumário de alta.",
    "alta-bloqueada": "A alta continua bloqueada. Revalide as barreiras antes de concluir.",
  };

  return (
    <SectionPage
      eyebrow="Internação / Central de Altas"
      title={paciente?.nome_completo ?? "Alta segura"}
      description={`Atendimento #${atendimento?.numero_atendimento ?? "—"} · RA ${paciente?.ra ?? "—"} · ${internacao.setor}${internacao.leito ? ` · ${internacao.leito}` : ""}`}
      actions={<div className="flex gap-2"><Link href="/internacao/altas" className="ui-button-secondary">Voltar à fila</Link>{atendimento?.id ? <Link href={`/prontuario/${atendimento.id}` as Route} className="ui-button-secondary">Prontuário</Link> : null}</div>}
    >
      {query.sucesso ? <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">{successMessage[query.sucesso] ?? "Etapa atualizada."}</div> : null}
      {query.erro ? <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{errorMessage[query.erro] ?? "Não foi possível concluir a ação."}</div> : null}

      <section className="grid gap-3 md:grid-cols-4">
        <StepCard title="1. Planejamento" ok={planoOk} text={planoOk ? "Concluído" : "Pendente"} icon={<ListChecks className="size-5" />} />
        <StepCard title="2. Conciliação" ok={conciliacaoOk} text={conciliacaoOk ? `${conciliacoes.length} registro(s)` : "Pendente"} icon={<Pill className="size-5" />} />
        <StepCard title="3. Sumário" ok={sumarioOk} text={sumarioOk ? "Assinado" : sumario ? "Criado, falta assinar" : "Pendente"} icon={<FileSignature className="size-5" />} />
        <StepCard title="Liberação" ok={pronta} text={pronta ? "Alta liberável" : `${blockers.length} bloqueio(s)`} icon={pronta ? <CheckCircle2 className="size-5" /> : <ShieldAlert className="size-5" />} />
      </section>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4">
        <div><p className="text-xs font-black uppercase tracking-wider text-slate-400">Internação</p><p className="mt-1 text-sm font-semibold text-slate-800">Desde {fmt(internacao.data_internacao)} · previsão {internacao.previsao_alta ?? "não definida"}</p></div>
        <form action={revalidarAltaSegura}><input type="hidden" name="internacao_id" value={internacao.id} /><button className="ui-button-secondary"><RotateCcw className="size-4" />Revalidar alta</button></form>
      </div>

      {blockers.length ? (
        <section className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-center gap-2 text-amber-900"><ShieldAlert className="size-5" /><h2 className="font-black">Pendências que bloqueiam a alta</h2></div>
          <div className="mt-3 grid gap-2 md:grid-cols-2">{blockers.map((item) => <div key={item.id} className="rounded-xl bg-white/75 p-3 text-sm text-amber-950"><strong>{item.descricao}</strong><p className="mt-1 text-xs text-amber-700">{item.categoria} · {item.codigo}</p></div>)}</div>
        </section>
      ) : null}

      <section className="mt-5 space-y-4">
        <details className="his-card overflow-hidden" open={!planoOk}>
          <summary className="cursor-pointer list-none border-b border-slate-100 px-5 py-4"><div className="flex items-center justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-wider text-slate-400">Etapa 1</p><h2 className="mt-1 font-black text-slate-950">Planejamento multiprofissional de alta</h2></div><Step ok={planoOk} label={planoOk ? "Concluído" : "Pendente"} /></div></summary>
          <form action={salvarPlanoAltaSegura} className="grid gap-3 p-5 md:grid-cols-2">
            <input type="hidden" name="internacao_id" value={internacao.id} />
            <label className="space-y-1 text-xs font-bold text-slate-600"><span>Previsão de alta</span><input name="previsao_alta" type="date" defaultValue={plano?.previsao_alta ?? internacao.previsao_alta ?? ""} className="ui-input" /></label>
            <label className="space-y-1 text-xs font-bold text-slate-600"><span>Destino pós-alta</span><input name="destino" defaultValue={plano?.destino ?? ""} placeholder="Domicílio, instituição, transferência..." className="ui-input" /></label>
            <label className="space-y-1 text-xs font-bold text-slate-600"><span>Cuidador responsável</span><input name="cuidador_responsavel" defaultValue={plano?.cuidador_responsavel ?? ""} className="ui-input" /></label>
            <label className="space-y-1 text-xs font-bold text-slate-600"><span>Transporte</span><input name="transporte" defaultValue={plano?.transporte ?? ""} className="ui-input" /></label>
            <label className="space-y-1 text-xs font-bold text-slate-600 md:col-span-2"><span>Necessidades domiciliares</span><textarea name="necessidades_domiciliares" rows={2} defaultValue={plano?.necessidades_domiciliares ?? ""} className="ui-input" /></label>
            <label className="space-y-1 text-xs font-bold text-slate-600"><span>Equipamentos</span><textarea name="equipamentos" rows={2} defaultValue={plano?.equipamentos ?? ""} className="ui-input" /></label>
            <label className="space-y-1 text-xs font-bold text-slate-600"><span>Medicamentos orientados</span><textarea name="medicamentos_orientados" rows={2} defaultValue={plano?.medicamentos_orientados ?? ""} className="ui-input" /></label>
            <label className="space-y-1 text-xs font-bold text-slate-600"><span>Retorno agendado</span><input name="retorno_agendado" defaultValue={plano?.retorno_agendado ?? ""} className="ui-input" /></label>
            <label className="space-y-1 text-xs font-bold text-slate-600"><span>Orientações</span><input name="orientacoes" defaultValue={plano?.orientacoes ?? ""} className="ui-input" /></label>
            <label className="flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-3 text-xs font-bold text-emerald-800 md:col-span-2"><input type="checkbox" name="concluir" defaultChecked={planoOk} className="size-4 accent-emerald-600" />Marcar planejamento como concluído</label>
            <div className="md:col-span-2 flex justify-end"><button className="ui-button-primary">Salvar planejamento</button></div>
          </form>
        </details>

        <details className="his-card overflow-hidden" open={!conciliacaoOk}>
          <summary className="cursor-pointer list-none border-b border-slate-100 px-5 py-4"><div className="flex items-center justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-wider text-slate-400">Etapa 2</p><h2 className="mt-1 font-black text-slate-950">Conciliação medicamentosa</h2></div><Step ok={conciliacaoOk} label={conciliacaoOk ? `${conciliacoes.length} registro(s)` : "Pendente"} /></div></summary>
          <div className="p-5">
            <form action={registrarConciliacaoAltaSegura} className="grid gap-3 md:grid-cols-4">
              <input type="hidden" name="internacao_id" value={internacao.id} />
              <input name="medicamento" required placeholder="Medicamento" className="ui-input md:col-span-2" />
              <input name="dose_domiciliar" placeholder="Dose" className="ui-input" />
              <select name="decisao" defaultValue="manter" className="ui-input"><option value="manter">Manter</option><option value="suspender">Suspender</option><option value="ajustar">Ajustar</option><option value="iniciar">Iniciar</option></select>
              <input name="via_domiciliar" placeholder="Via" className="ui-input" />
              <input name="frequencia_domiciliar" placeholder="Frequência" className="ui-input" />
              <input name="divergencia" placeholder="Divergência, se houver" className="ui-input md:col-span-2" />
              <textarea name="observacoes" rows={2} placeholder="Observações" className="ui-input md:col-span-3" />
              <button className="ui-button-primary self-end">Registrar</button>
            </form>
            {conciliacoes.length ? <div className="mt-4 divide-y divide-slate-100 rounded-xl border border-slate-100">{conciliacoes.map((item) => <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm"><div><strong>{item.medicamento}</strong><span className="ml-2 text-xs text-slate-500">{item.dose_domiciliar ?? ""}</span></div><span className="rounded-lg bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600">{item.decisao}</span></div>)}</div> : null}
          </div>
        </details>

        <details className="his-card overflow-hidden" open={!sumarioOk}>
          <summary className="cursor-pointer list-none border-b border-slate-100 px-5 py-4"><div className="flex items-center justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-wider text-slate-400">Etapa 3</p><h2 className="mt-1 font-black text-slate-950">Sumário e assinatura</h2></div><Step ok={sumarioOk} label={sumarioOk ? "Assinado" : sumario ? "Aguardando assinatura" : "Pendente"} /></div></summary>
          <div className="p-5">
            {!sumario ? (
              <form action={criarSumarioAltaSeguro} className="grid gap-3 md:grid-cols-2">
                <input type="hidden" name="internacao_id" value={internacao.id} />
                <input name="motivo_internacao" defaultValue={internacao.motivo ?? ""} placeholder="Motivo da internação" className="ui-input md:col-span-2" />
                <textarea name="diagnosticos" rows={3} placeholder="Diagnósticos — um por linha" className="ui-input" />
                <textarea name="procedimentos" rows={3} placeholder="Procedimentos — um por linha" className="ui-input" />
                <textarea name="evolucao_resumida" rows={4} placeholder="Evolução resumida" className="ui-input md:col-span-2" />
                <input name="condicao_alta" placeholder="Condição clínica na alta" className="ui-input" />
                <input name="data_alta_prevista" type="datetime-local" className="ui-input" />
                <textarea name="medicamentos_alta" rows={3} placeholder="Medicamentos na alta — um por linha" className="ui-input" />
                <textarea name="orientacoes" rows={3} placeholder="Orientações" className="ui-input" />
                <textarea name="sinais_alarme" rows={2} placeholder="Sinais de alarme" className="ui-input" />
                <textarea name="cuidados_domiciliares" rows={2} placeholder="Cuidados domiciliares" className="ui-input" />
                <input name="retorno" placeholder="Retorno" className="ui-input" />
                <textarea name="encaminhamentos" rows={2} placeholder="Encaminhamentos — um por linha" className="ui-input" />
                <div className="md:col-span-2 flex justify-end"><button className="ui-button-primary">Criar sumário</button></div>
              </form>
            ) : (
              <div className="rounded-xl border border-slate-200 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="font-black text-slate-950">Sumário criado em {fmt(sumario.created_at)}</p><p className="mt-1 text-xs text-slate-500">Condição na alta: {sumario.condicao_alta ?? "não informada"}</p></div>{sumario.assinado_em ? <span className="rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-black text-emerald-700">Assinado em {fmt(sumario.assinado_em)}</span> : <form action={assinarSumarioAltaSeguro}><input type="hidden" name="internacao_id" value={internacao.id} /><input type="hidden" name="sumario_id" value={sumario.id} /><button className="ui-button-primary"><FileSignature className="size-4" />Assinar sumário</button></form>}</div>
              </div>
            )}
          </div>
        </details>
      </section>

      <section className={`mt-5 rounded-2xl border p-5 ${pronta ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}`}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div><p className={`text-xs font-black uppercase tracking-wider ${pronta ? "text-emerald-600" : "text-amber-600"}`}>Liberação final</p><h2 className={`mt-1 text-lg font-black ${pronta ? "text-emerald-950" : "text-amber-950"}`}>{pronta ? "Todas as barreiras obrigatórias estão concluídas" : `${blockers.length} pendência(s) ainda bloqueiam a alta`}</h2><p className="mt-1 text-sm text-slate-600">A função transacional revalida as barreiras novamente antes de encerrar a internação e o atendimento.</p></div>
          <form action={concluirAltaSegura} className="flex gap-2"><input type="hidden" name="internacao_id" value={internacao.id} /><input type="hidden" name="motivo" value="Alta hospitalar" /><button disabled={!pronta} className="ui-button-primary disabled:cursor-not-allowed disabled:opacity-40"><ClipboardCheck className="size-4" />Concluir alta</button></form>
        </div>
      </section>
    </SectionPage>
  );
}

function Step({ ok, label }: { ok: boolean; label: string }) {
  return <span className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-black ${ok ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}><span className={`size-2 rounded-full ${ok ? "bg-emerald-500" : "bg-slate-300"}`} />{label}</span>;
}

function StepCard({ title, ok, text, icon }: { title: string; ok: boolean; text: string; icon: React.ReactNode }) {
  return <div className={`rounded-2xl border p-4 ${ok ? "border-emerald-200 bg-emerald-50" : "border-slate-200 bg-white"}`}><div className={`flex items-center justify-between ${ok ? "text-emerald-700" : "text-slate-400"}`}><p className="text-xs font-black uppercase tracking-wider">{title}</p>{icon}</div><p className={`mt-2 font-black ${ok ? "text-emerald-950" : "text-slate-700"}`}>{text}</p></div>;
}
