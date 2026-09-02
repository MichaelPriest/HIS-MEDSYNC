import Link from "next/link";
import type { Route } from "next";
import { CheckCircle2, CircleAlert, Clock3, Hospital, ShieldCheck, Stethoscope, Waypoints } from "lucide-react";
import { notFound } from "next/navigation";
import { AssumePatientBackgroundForm } from "@/components/fila-medica/assume-patient-background-form";
import { SectionPage } from "@/components/painel/section-page";
import { EpisodioTimelinePendencias } from "@/components/prontuario/episodio-timeline-pendencias";
import { AltaMedicaBackgroundForm } from "@/components/prontuario/alta-medica-background-form";
import { getAssistencialContext } from "@/modules/assistencial/context";

const errorMessages: Record<string, string> = {
  "alta-campos": "Selecione o desfecho e preencha as orientações de alta.",
  "alta-internacao": "Este atendimento possui internação ativa. A conclusão deve ser feita pelo fluxo de alta hospitalar.",
  "alta-pendencias": "Ainda existem pendências assistenciais que impedem a alta.",
  "alta-sem-registro": "É necessário existir ao menos uma anamnese ou evolução clínica assinada antes da alta.",
  "alta-orientacoes": "As orientações de alta são obrigatórias.",
  "alta-desfecho": "O desfecho informado não é válido.",
  "alta-permissao": "Seu login precisa estar vinculado a um profissional autorizado a assinar e conceder alta.",
  "alta-atendimento": "Este atendimento não está em um estado que permita alta médica.",
  alta: "Não foi possível concluir o atendimento. Revise as pendências e tente novamente.",
};

function fmtData(value: string | null | undefined) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(value));
}

function textoStatus(value: string | null | undefined) {
  return (value ?? "não informado").replaceAll("_", " ");
}

function pontoPadrao(setorAtual: string | null | undefined) {
  const setor = (setorAtual ?? "").toLowerCase();
  if (setor.includes("pronto") || setor.includes("urgencia")) return "Pronto-socorro";
  if (setor.includes("consultorio")) return "Consultório";
  return "Atendimento médico";
}

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AltaMedicaPage({
  params,
  searchParams,
}: {
  params: Promise<{ atendimentoId: string }>;
  searchParams: Promise<{ sucesso?: string; erro?: string; detalhe?: string }>;
}) {
  const { atendimentoId } = await params;
  const sp = await searchParams;
  const { supabase, empresaId, unidadeId } = await getAssistencialContext();

  const [atendimentoRes, internacaoRes, altaRes, permissaoAltaRes, permissaoAssinarRes, profissionalLogadoRes, encaminhamentosRes] = await Promise.all([
    supabase.from("atendimentos").select("id,numero_atendimento,status,data_abertura,data_fechamento,setor_atual,paciente:pacientes(nome_completo,ra,numero_registro)").eq("id", atendimentoId).eq("empresa_id", empresaId).eq("unidade_id", unidadeId).maybeSingle(),
    supabase.from("internacoes").select("id,setor,leito,data_internacao,status").eq("atendimento_id", atendimentoId).eq("empresa_id", empresaId).eq("unidade_id", unidadeId).eq("status", "internado").is("data_alta", null).order("data_internacao", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("prontuario_evolucoes").select("id,texto_livre,plano,assinado_em,assinatura_hash,profissional:profissionais(nome_completo)").eq("atendimento_id", atendimentoId).eq("empresa_id", empresaId).eq("unidade_id", unidadeId).eq("tipo_evolucao", "alta_medica").order("created_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.rpc("tem_permissao", { p_empresa: empresaId, p_unidade: unidadeId, p_codigo: "atendimentos.alta" }),
    supabase.rpc("tem_permissao", { p_empresa: empresaId, p_unidade: unidadeId, p_codigo: "prontuario.assinar" }),
    supabase.rpc("profissional_logado", { p_empresa: empresaId }),
    supabase.from("encaminhamentos_assistenciais").select("id,origem,especialidade,profissional_id,status,prioridade,tipo_solicitacao,motivo,created_at,iniciado_em").eq("atendimento_id", atendimentoId).eq("empresa_id", empresaId).eq("unidade_id", unidadeId).order("created_at", { ascending: false }).limit(50),
  ]);

  const atendimento = atendimentoRes.data;
  if (!atendimento) notFound();

  const paciente = Array.isArray(atendimento.paciente) ? atendimento.paciente[0] : atendimento.paciente;
  const alta = altaRes.data;
  const profissionalAlta = alta ? (Array.isArray(alta.profissional) ? alta.profissional[0] : alta.profissional) : null;
  const internacao = internacaoRes.data;
  const encerrado = atendimento.status === "alta" || atendimento.status === "cancelado";
  const podeAlta = permissaoAltaRes.data === true && !permissaoAltaRes.error && permissaoAssinarRes.data === true && !permissaoAssinarRes.error;
  const profissionalLogadoId = typeof profissionalLogadoRes.data === "string" ? profissionalLogadoRes.data : null;
  const encaminhamentosAtivos = (encaminhamentosRes.data ?? []).filter((item) => !["concluido", "cancelado"].includes(String(item.status)));
  const encaminhamentosBloqueantes = encaminhamentosAtivos.filter((item) => !profissionalLogadoId || item.profissional_id !== profissionalLogadoId);
  const resumoHref = `/prontuario/${atendimentoId}` as Route;
  const clinicoHref = `/prontuario/${atendimentoId}/clinico` as Route;
  const internacaoHref = "/internacao" as Route;
  const filaMedicaHref = "/fila-medica" as Route;

  return <SectionPage eyebrow="Assistencial / Atendimento médico" title="Conclusão e alta médica" description={`${paciente?.nome_completo ?? "Paciente"} · Atendimento #${atendimento.numero_atendimento ?? "—"} · RA ${paciente?.ra ?? "—"}`}>
    {sp.sucesso === "alta" ? <div className="mb-5 flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800"><CheckCircle2 className="mt-0.5 size-5 shrink-0"/><div><p className="font-black">Atendimento concluído e alta assinada.</p><p className="mt-1">A fila clínica foi encerrada e o prontuário deste episódio passou para modo histórico.</p></div></div> : null}
    {sp.erro ? <div className="mb-5 flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800"><CircleAlert className="mt-0.5 size-5 shrink-0"/><div><p className="font-black">Alta não concluída</p><p className="mt-1">{errorMessages[sp.erro] ?? errorMessages.alta}</p>{sp.detalhe ? <p className="mt-2 rounded-xl bg-white/70 px-3 py-2 font-semibold">Pendências: {sp.detalhe}</p> : null}</div></div> : null}

    <div className="grid gap-4 md:grid-cols-3">
      <div className="ui-card p-4"><p className="text-xs font-black uppercase tracking-wide text-slate-400">Status do episódio</p><p className="mt-2 text-lg font-black capitalize text-slate-950">{atendimento.status.replaceAll("_", " ")}</p><p className="mt-1 text-sm text-slate-500">Setor atual: {atendimento.setor_atual ?? "—"}</p></div>
      <div className="ui-card p-4"><p className="text-xs font-black uppercase tracking-wide text-slate-400">Abertura</p><p className="mt-2 font-black text-slate-950">{fmtData(atendimento.data_abertura)}</p><p className="mt-1 text-sm text-slate-500">Fechamento: {fmtData(atendimento.data_fechamento)}</p></div>
      <div className="ui-card p-4"><p className="text-xs font-black uppercase tracking-wide text-slate-400">Permissão de alta</p><p className={`mt-2 font-black ${podeAlta ? "text-emerald-700" : "text-amber-700"}`}>{podeAlta ? "Profissional autorizado" : "Assinatura indisponível"}</p><p className="mt-1 text-sm text-slate-500">Exige alta do atendimento + assinatura de prontuário.</p></div>
    </div>

    {internacao ? <section className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-5"><div className="flex items-start gap-3"><Hospital className="mt-0.5 size-5 text-amber-700"/><div className="flex-1"><h2 className="font-black text-amber-950">Internação ativa</h2><p className="mt-1 text-sm text-amber-800">O paciente está internado em {internacao.setor}{internacao.leito ? ` · leito ${internacao.leito}` : ""}. A alta deste episódio deve seguir o fluxo hospitalar para também liberar o leito e registrar as pendências de internação.</p><Link href={internacaoHref} className="mt-3 inline-flex font-black text-amber-900 underline">Abrir módulo de internação</Link></div></div></section> : null}

    {!encerrado && encaminhamentosBloqueantes.length ? <section className="mt-5 overflow-hidden rounded-2xl border border-amber-200 bg-amber-50/60">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-amber-200 px-5 py-4">
        <div className="flex items-start gap-3"><Waypoints className="mt-0.5 size-5 shrink-0 text-amber-700"/><div><h2 className="font-black text-amber-950">Encaminhamentos que impedem a alta</h2><p className="mt-1 text-sm text-amber-800">A alta só é liberada quando encaminhamentos de outros profissionais/setores são concluídos ou cancelados. Se o encaminhamento ainda estiver aguardando profissional e pertencer à sua especialidade, assuma-o aqui para continuar o atendimento.</p></div></div>
        <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-black text-amber-800">{encaminhamentosBloqueantes.length} bloqueante(s)</span>
      </div>
      <div className="divide-y divide-amber-200/80">
        {encaminhamentosBloqueantes.map((item) => {
          const aguardandoSemProfissional = item.status === "aguardando_profissional" && !item.profissional_id;
          return <article key={item.id} className="grid gap-4 bg-white/60 p-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">{textoStatus(item.status)}</span>
                <span className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-bold text-brand-700">{item.especialidade ?? "Especialidade não informada"}</span>
                {item.prioridade ? <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-800">{textoStatus(item.prioridade)}</span> : null}
              </div>
              <p className="mt-3 font-black text-slate-950">{item.origem ?? "Origem não informada"} → {item.especialidade ?? "atendimento assistencial"}</p>
              <p className="mt-1 text-sm text-slate-600">{item.motivo || item.tipo_solicitacao || "Encaminhamento assistencial sem motivo informado."}</p>
              <p className="mt-2 flex items-center gap-1 text-xs text-slate-500"><Clock3 className="size-3.5"/>Criado em {fmtData(item.created_at)}{item.profissional_id ? " · já atribuído a outro profissional" : " · ainda sem profissional atribuído"}</p>
            </div>
            {aguardandoSemProfissional ? <AssumePatientBackgroundForm encaminhamentoId={item.id} filaSetor={item.especialidade ?? "consultorio"} pontoPadrao={pontoPadrao(atendimento.setor_atual)} /> : <Link href={filaMedicaHref} className="ui-button-secondary whitespace-nowrap">Abrir fila médica</Link>}
          </article>;
        })}
      </div>
    </section> : null}

    {encerrado ? <section className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-5"><div className="flex items-start gap-3"><ShieldCheck className="mt-0.5 size-5 text-emerald-700"/><div><h2 className="font-black text-slate-950">Episódio encerrado</h2><p className="mt-1 text-sm text-slate-600">Novos registros clínicos não devem ser adicionados a este atendimento. Consulte o histórico abaixo ou retorne ao resumo.</p>{alta ? <div className="mt-4 rounded-xl border border-emerald-100 bg-white p-4"><p className="text-xs font-black uppercase tracking-wide text-emerald-700">Alta médica assinada</p><p className="mt-2 text-sm text-slate-700">{alta.texto_livre ?? alta.plano ?? "Alta registrada."}</p><p className="mt-2 text-xs text-slate-500">Assinada em {fmtData(alta.assinado_em)} · {profissionalAlta?.nome_completo ?? "Profissional"}</p>{alta.assinatura_hash ? <p className="mt-1 font-mono text-[11px] text-slate-400">Hash {alta.assinatura_hash.slice(0, 20)}…</p> : null}</div> : null}</div></div></section> : null}

    {!encerrado && !internacao ? <section className="ui-card mt-5 p-5 sm:p-6"><div className="flex items-start gap-3"><Stethoscope className="mt-0.5 size-5 text-brand-700"/><div><h2 className="font-black text-slate-950">Concluir atendimento médico</h2><p className="mt-1 text-sm text-slate-500">A conclusão só é efetivada se houver registro clínico assinado e nenhuma pendência bloqueante em outros setores. A operação cria e assina uma evolução de alta e encerra a fila clínica na mesma transação.</p></div></div>
      {!podeAlta ? <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800">Este perfil não possui as duas permissões necessárias para concluir e assinar a alta.</div> : <AltaMedicaBackgroundForm atendimentoId={atendimentoId} encaminhamentosBloqueantes={encaminhamentosBloqueantes.length} />}
    </section> : null}

    <div className="mt-5 flex flex-wrap gap-2"><Link href={resumoHref} className="ui-button-secondary">Voltar ao resumo</Link>{!encerrado ? <Link href={clinicoHref} className="ui-button-secondary">Revisar evolução clínica</Link> : null}</div>

    {!encerrado ? <div className="mt-6"><EpisodioTimelinePendencias atendimentoId={atendimentoId}/></div> : null}
  </SectionPage>;
}