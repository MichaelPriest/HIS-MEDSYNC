import Link from "next/link";
import { Activity, BedDouble, ClipboardList, FileHeart, FlaskConical, Pill, ShieldCheck, UserRound } from "lucide-react";
import { notFound } from "next/navigation";
import { SectionPage } from "@/components/painel/section-page";
import { createClient } from "@/lib/supabase/server";

type Rel<T> = T | T[] | null;
function one<T>(rel: Rel<T>): T | null { return Array.isArray(rel) ? rel[0] ?? null : rel; }
function fmt(value: string | null | undefined) { return value || "—"; }

export default async function AtendimentoMedicoPage({ params }: { params: Promise<{ atendimentoId: string }> }) {
  const { atendimentoId } = await params;
  const supabase = await createClient();
  const [{ data: atendimento }, { data: triagem }, { data: evolucoes }, { data: prescricoes }, { data: internacoes }, { data: exames }] = await Promise.all([
    supabase.from("atendimentos").select("id,numero_atendimento,status,data_abertura,tipo_atendimento,origem,modalidade_cobranca,numero_carteirinha,validade_carteirinha,numero_autorizacao,senha_autorizacao,paciente:pacientes(nome_completo,cpf,cns,ra,numero_registro,data_nascimento,sexo),profissional:profissionais(nome_completo,especialidade),convenio:convenios(nome_fantasia,razao_social),plano:convenio_planos(nome,codigo)").eq("id", atendimentoId).maybeSingle(),
    supabase.from("triagens").select("peso_kg,altura_cm,pressao_arterial,frequencia_cardiaca,frequencia_respiratoria,saturacao_o2,temperatura_c,glicemia_mg_dl,dor_escala,classificacao_risco,queixa_principal,observacoes,updated_at").eq("atendimento_id", atendimentoId).order("updated_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("prontuario_evolucoes").select("id,created_at,tipo_evolucao,subjetivo,objetivo,avaliacao,plano,texto_livre,profissional:profissionais(nome_completo)").eq("atendimento_id", atendimentoId).order("created_at", { ascending: false }).limit(20),
    supabase.from("prescricoes").select("id,numero_prescricao,status,created_at,observacoes,profissional:profissionais(nome_completo),itens:prescricao_itens(id,item_tipo,descricao,dose,via,frequencia,duracao,quantidade,orientacoes)").eq("atendimento_id", atendimentoId).order("created_at", { ascending: false }).limit(20),
    supabase.from("internacoes").select("id,numero_internacao,status,tipo_internacao,leito,data_entrada,data_saida,motivo,profissional:profissionais(nome_completo)").eq("atendimento_id", atendimentoId).order("data_entrada", { ascending: false }).limit(10),
    supabase.from("solicitacoes_exames").select("id,numero_solicitacao,tipo,status,prioridade,descricao_exame,material,resultado,laudo,solicitado_em,coletado_em,liberado_em,profissional:profissionais(nome_completo)").eq("atendimento_id", atendimentoId).order("solicitado_em", { ascending: false }).limit(30),
  ]);
  if (!atendimento) notFound();
  const paciente = one(atendimento.paciente);
  const profissional = one(atendimento.profissional);
  const convenio = one(atendimento.convenio);
  const plano = one(atendimento.plano);

  return <SectionPage eyebrow="Assistencial / Atendimento médico" title={paciente?.nome_completo ?? "Paciente"} description={`Atendimento #${atendimento.numero_atendimento ?? "—"} · Registro #${paciente?.numero_registro ?? "—"} · ${paciente?.ra ?? "—"}`}>
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <div className="ui-card p-4"><div className="flex items-center gap-2 text-sm font-semibold text-slate-900"><UserRound className="size-4 text-brand-700"/>Paciente</div><p className="mt-3 text-sm text-slate-600">CPF {fmt(paciente?.cpf)} · CNS {fmt(paciente?.cns)}</p><p className="mt-1 text-sm text-slate-600">Nascimento {fmt(paciente?.data_nascimento)} · Sexo {fmt(paciente?.sexo)}</p></div>
      <div className="ui-card p-4"><div className="flex items-center gap-2 text-sm font-semibold text-slate-900"><ClipboardList className="size-4 text-brand-700"/>Episódio</div><p className="mt-3 text-sm text-slate-600">{fmt(atendimento.tipo_atendimento)} · {fmt(atendimento.origem)}</p><p className="mt-1 text-sm text-slate-600">Status: {atendimento.status}</p></div>
      <div className="ui-card p-4"><div className="flex items-center gap-2 text-sm font-semibold text-slate-900"><ShieldCheck className="size-4 text-brand-700"/>Cobertura</div><p className="mt-3 text-sm text-slate-600">{atendimento.modalidade_cobranca === "convenio" ? (convenio?.nome_fantasia || convenio?.razao_social || "Convênio") : "Particular"}</p><p className="mt-1 text-sm text-slate-600">{plano?.nome ?? "—"} · Carteirinha {fmt(atendimento.numero_carteirinha)}</p></div>
      <div className="ui-card p-4"><div className="flex items-center gap-2 text-sm font-semibold text-slate-900"><FileHeart className="size-4 text-brand-700"/>Responsável clínico</div><p className="mt-3 text-sm text-slate-600">{profissional?.nome_completo ?? "Não definido"}</p><p className="mt-1 text-sm text-slate-600">{fmt(profissional?.especialidade)}</p></div>
    </div>

    <div className="mt-5 flex flex-wrap gap-2">
      <Link className="ui-button-secondary" href="/triagem">Triagem</Link><Link className="ui-button-secondary" href="/prontuario">Nova evolução</Link><Link className="ui-button-secondary" href="/prescricoes">Prescrição</Link><Link className="ui-button-secondary" href="/internacoes">Internação</Link><Link className="ui-button-secondary" href="/exames">Exames</Link>
    </div>

    <div className="mt-6 grid gap-6 xl:grid-cols-2">
      <section className="ui-card p-5"><h2 className="flex items-center gap-2 font-semibold text-slate-900"><Activity className="size-5 text-emerald-600"/>Triagem e sinais vitais</h2>{triagem ? <div className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3"><Metric label="PA" value={triagem.pressao_arterial}/><Metric label="FC" value={triagem.frequencia_cardiaca}/><Metric label="FR" value={triagem.frequencia_respiratoria}/><Metric label="SpO₂" value={triagem.saturacao_o2 ? `${triagem.saturacao_o2}%` : null}/><Metric label="Temperatura" value={triagem.temperatura_c ? `${triagem.temperatura_c} °C` : null}/><Metric label="Dor" value={triagem.dor_escala}/><Metric label="Peso" value={triagem.peso_kg ? `${triagem.peso_kg} kg` : null}/><Metric label="Altura" value={triagem.altura_cm ? `${triagem.altura_cm} cm` : null}/><Metric label="Risco" value={triagem.classificacao_risco}/></div> : <Empty text="Triagem ainda não registrada."/>}</section>
      <section className="ui-card p-5"><h2 className="flex items-center gap-2 font-semibold text-slate-900"><ShieldCheck className="size-5 text-brand-700"/>Evoluções clínicas</h2><div className="mt-4 space-y-3">{evolucoes?.length ? evolucoes.map((item) => { const prof=one(item.profissional); return <article key={item.id} className="rounded-xl border border-slate-200 p-4"><div className="flex justify-between gap-3"><strong className="text-sm text-slate-900">{item.tipo_evolucao}</strong><span className="text-xs text-slate-400">{new Date(item.created_at).toLocaleString("pt-BR")}</span></div><p className="mt-1 text-xs text-slate-500">{prof?.nome_completo ?? "Profissional"}</p>{item.avaliacao ? <p className="mt-3 text-sm text-slate-700"><b>Avaliação:</b> {item.avaliacao}</p> : null}{item.plano ? <p className="mt-1 text-sm text-slate-700"><b>Plano:</b> {item.plano}</p> : null}</article>; }) : <Empty text="Nenhuma evolução registrada."/>}</div></section>
      <section className="ui-card p-5"><h2 className="flex items-center gap-2 font-semibold text-slate-900"><Pill className="size-5 text-rose-500"/>Prescrições</h2><div className="mt-4 space-y-3">{prescricoes?.length ? prescricoes.map((item) => <article key={item.id} className="rounded-xl border border-slate-200 p-4"><div className="flex justify-between"><strong className="text-sm">Prescrição #{item.numero_prescricao ?? "—"}</strong><span className="text-xs font-semibold text-emerald-600">{item.status}</span></div><p className="mt-2 text-sm text-slate-600">{Array.isArray(item.itens) ? item.itens.map((i) => i.descricao).join(" · ") : ""}</p></article>) : <Empty text="Nenhuma prescrição neste atendimento."/>}</div></section>
      <section className="ui-card p-5"><h2 className="flex items-center gap-2 font-semibold text-slate-900"><BedDouble className="size-5 text-violet-600"/>Internação</h2><div className="mt-4 space-y-3">{internacoes?.length ? internacoes.map((item) => <article key={item.id} className="rounded-xl border border-slate-200 p-4"><strong className="text-sm">Internação #{item.numero_internacao ?? "—"}</strong><p className="mt-1 text-sm text-slate-600">Leito {fmt(item.leito)} · {item.status} · {fmt(item.tipo_internacao)}</p></article>) : <Empty text="Sem internação vinculada."/>}</div></section>
      <section className="ui-card p-5 xl:col-span-2"><h2 className="flex items-center gap-2 font-semibold text-slate-900"><FlaskConical className="size-5 text-amber-500"/>Exames e resultados</h2><div className="mt-4 grid gap-3 md:grid-cols-2">{exames?.length ? exames.map((item) => <article key={item.id} className="rounded-xl border border-slate-200 p-4"><div className="flex justify-between gap-3"><strong className="text-sm text-slate-900">{item.descricao_exame}</strong><span className="text-xs font-semibold text-brand-700">{item.status}</span></div><p className="mt-1 text-xs text-slate-500">{item.tipo} · Solicitação #{item.numero_solicitacao ?? "—"}</p>{item.resultado ? <p className="mt-3 text-sm text-slate-700"><b>Resultado:</b> {item.resultado}</p> : null}{item.laudo ? <p className="mt-1 text-sm text-slate-700"><b>Laudo:</b> {item.laudo}</p> : null}</article>) : <Empty text="Nenhum exame vinculado."/>}</div></section>
    </div>
  </SectionPage>;
}

function Metric({ label, value }: { label: string; value: string | number | null | undefined }) { return <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs font-medium text-slate-400">{label}</p><p className="mt-1 font-semibold text-slate-900">{value ?? "—"}</p></div>; }
function Empty({ text }: { text: string }) { return <p className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-500">{text}</p>; }
