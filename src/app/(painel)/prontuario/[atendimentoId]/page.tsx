import Link from "next/link";
import type { Route } from "next";
import { Activity, BedDouble, ClipboardList, FileHeart, FlaskConical, HeartPulse, Pill, ScanLine, ShieldAlert, ShieldCheck, Stethoscope, UserRound } from "lucide-react";
import { notFound } from "next/navigation";
import { SectionPage } from "@/components/painel/section-page";
import { AvaliacaoMedicaPanel } from "@/components/prontuario/avaliacao-medica-panel";
import { EpisodioTimelinePendencias } from "@/components/prontuario/episodio-timeline-pendencias";
import { createClient } from "@/lib/supabase/server";
import { encaminharSetor } from "@/modules/fluxo-setorial/actions";

type Rel<T> = T | T[] | null;
function one<T>(rel: Rel<T>): T | null { return Array.isArray(rel) ? rel[0] ?? null : rel; }
function fmt(value: string | null | undefined) { return value || "—"; }

const successMessages: Record<string, string> = {
  internacao: "Internação vinculada ao episódio com sucesso.",
  encaminhamento: "Encaminhamento registrado no fluxo assistencial.",
  "avaliacao-medica": "Avaliação médica solicitada e encaminhada para a fila da especialidade.",
};

export default async function AtendimentoMedicoPage({ params, searchParams }: { params: Promise<{ atendimentoId: string }>; searchParams: Promise<{ sucesso?: string; erro?: string }> }) {
  const { atendimentoId } = await params;
  const sp = await searchParams;
  const supabase = await createClient();
  const [
    { data: atendimento },
    { data: triagem },
    { data: evolucoes },
    { data: prescricoes },
    { data: internacoes },
    { data: movimentos },
    { data: emergencias },
    { data: reavaliacoesEmergencia },
  ] = await Promise.all([
    supabase.from("atendimentos").select("id,numero_atendimento,status,data_abertura,tipo_atendimento,origem,cobertura,numero_carteirinha,validade_carteirinha,numero_autorizacao,senha_autorizacao,setor_atual,paciente:pacientes(nome_completo,cpf,cns,ra,numero_registro,data_nascimento,sexo),profissional:profissionais(nome_completo,especialidade),convenio:convenios(nome_fantasia,razao_social),plano:convenio_planos(nome,codigo)").eq("id", atendimentoId).maybeSingle(),
    supabase.from("triagens").select("peso_kg,altura_cm,pressao_arterial,frequencia_cardiaca,frequencia_respiratoria,saturacao_o2,temperatura_c,glicemia_mg_dl,dor_escala,classificacao_risco,queixa_principal,observacoes,updated_at").eq("atendimento_id", atendimentoId).order("updated_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("prontuario_evolucoes").select("id,created_at,tipo_evolucao,avaliacao,plano,profissional:profissionais(nome_completo)").eq("atendimento_id", atendimentoId).order("created_at", { ascending: false }).limit(20),
    supabase.from("prescricoes").select("id,tipo,item,dose,via,frequencia,duracao,instrucoes,status,created_at,profissional:profissionais(nome_completo)").eq("atendimento_id", atendimentoId).order("created_at", { ascending: false }).limit(30),
    supabase.from("internacoes").select("id,setor,leito,acomodacao,motivo,data_internacao,previsao_alta,data_alta,status,profissional:profissionais!internacoes_profissional_responsavel_id_fkey(nome_completo)").eq("atendimento_id", atendimentoId).order("data_internacao", { ascending: false }).limit(10),
    supabase.from("filas_setoriais").select("id,setor_codigo,status,prioridade,motivo,created_at,iniciado_em,concluido_em").eq("atendimento_id", atendimentoId).order("created_at", { ascending: false }).limit(30),
    supabase.from("emergencia_registros").select("id,created_at,status,origem,mecanismo,classificacao_risco,protocolo,sala,estado_geral,via_aerea,respiracao,circulacao,neurologico,exposicao,reavaliacao_em,destino,observacoes,profissional:profissionais(nome_completo)").eq("atendimento_id", atendimentoId).order("created_at", { ascending: false }).limit(20),
    supabase.from("emergencia_reavaliacoes").select("id,emergencia_id,reavaliado_em,queixa,classificacao_risco,dor,conduta,destino,observacoes,profissional:profissionais(nome_completo)").eq("atendimento_id", atendimentoId).order("reavaliado_em", { ascending: false }).limit(50),
  ]);
  if (!atendimento) notFound();
  const paciente = one(atendimento.paciente);
  const profissional = one(atendimento.profissional);
  const convenio = one(atendimento.convenio);
  const plano = one(atendimento.plano);

  const triagemHref = `/triagem?atendimento=${atendimentoId}` as Route;
  const urgenciaHref = `/assistencial/urgencia?atendimento=${atendimentoId}` as Route;
  const evolucaoHref = `/prontuario/${atendimentoId}/clinico` as Route;
  const prescricaoHref = `/prescricao?atendimento=${atendimentoId}` as Route;
  const internacaoHref = `/internacao/nova/${atendimentoId}` as Route;

  return <SectionPage eyebrow="Assistencial / Atendimento médico" title={paciente?.nome_completo ?? "Paciente"} description={`Atendimento #${atendimento.numero_atendimento ?? "—"} · Registro #${paciente?.numero_registro ?? "—"} · ${paciente?.ra ?? "—"}`}>
    {sp.sucesso ? <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{successMessages[sp.sucesso] ?? "Operação assistencial registrada com sucesso."}</div> : null}
    {sp.erro ? <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{sp.erro === "avaliacao-duplicada" ? "Já existe uma avaliação ativa dessa especialidade para este atendimento." : "Não foi possível registrar a operação assistencial."}</div> : null}

    <div className="mb-4 flex items-center justify-between gap-3">
      <Link href="/atendimentos" className="text-sm font-semibold text-brand-700 hover:text-brand-900">← Voltar aos atendimentos</Link>
      <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700">Episódio em contexto</span>
    </div>

    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <div className="ui-card p-4"><div className="flex items-center gap-2 text-sm font-semibold text-slate-900"><UserRound className="size-4 text-brand-700"/>Paciente</div><p className="mt-3 text-sm text-slate-600">CPF {fmt(paciente?.cpf)} · CNS {fmt(paciente?.cns)}</p><p className="mt-1 text-sm text-slate-600">Nascimento {fmt(paciente?.data_nascimento)} · Sexo {fmt(paciente?.sexo)}</p></div>
      <div className="ui-card p-4"><div className="flex items-center gap-2 text-sm font-semibold text-slate-900"><ClipboardList className="size-4 text-brand-700"/>Episódio</div><p className="mt-3 text-sm text-slate-600">{fmt(atendimento.tipo_atendimento)} · {fmt(atendimento.origem)}</p><p className="mt-1 text-sm text-slate-600">Status: {atendimento.status} · Setor: {fmt(atendimento.setor_atual)}</p></div>
      <div className="ui-card p-4"><div className="flex items-center gap-2 text-sm font-semibold text-slate-900"><ShieldCheck className="size-4 text-brand-700"/>Cobertura</div><p className="mt-3 text-sm text-slate-600">{atendimento.cobertura === "convenio" ? (convenio?.nome_fantasia || convenio?.razao_social || "Convênio") : "Particular"}</p><p className="mt-1 text-sm text-slate-600">{plano?.nome ?? "—"} · Carteirinha {fmt(atendimento.numero_carteirinha)}</p></div>
      <div className="ui-card p-4"><div className="flex items-center gap-2 text-sm font-semibold text-slate-900"><FileHeart className="size-4 text-brand-700"/>Responsável clínico</div><p className="mt-3 text-sm text-slate-600">{profissional?.nome_completo ?? "Não definido"}</p><p className="mt-1 text-sm text-slate-600">{fmt(profissional?.especialidade)}</p></div>
    </div>

    <section className="ui-card mt-5 p-4 sm:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div><p className="text-xs font-black uppercase tracking-wider text-brand-600">Jornada do atendimento</p><h2 className="mt-1 font-semibold text-slate-900">Continue sem pesquisar o paciente novamente</h2><p className="mt-1 text-sm text-slate-500">Todas as ações abaixo preservam este atendimento, RA e paciente como contexto.</p></div>
        <div className="flex flex-wrap gap-2"><Link className="ui-button-secondary" href={triagemHref}>Triagem</Link><Link className="ui-button-secondary" href={urgenciaHref}><HeartPulse className="size-4"/>Urgência</Link><Link className="ui-button-primary" href={evolucaoHref}>Nova evolução</Link><Link className="ui-button-secondary" href={prescricaoHref}>Prescrição</Link><Link className="ui-button-secondary" href={internacaoHref}><BedDouble className="size-4"/>Internar paciente</Link></div>
      </div>
    </section>

    <EpisodioTimelinePendencias atendimentoId={atendimentoId}/>
    <AvaliacaoMedicaPanel atendimentoId={atendimentoId}/>

    <section className="ui-card mt-6 p-5"><div className="flex items-center gap-3"><Stethoscope className="size-5 text-brand-700"/><div><h2 className="font-semibold text-slate-900">Encaminhar para outro setor</h2><p className="text-sm text-slate-500">O paciente entra na fila do setor escolhido sem perder o vínculo com este atendimento.</p></div></div><form action={encaminharSetor} className="mt-4 grid gap-3 lg:grid-cols-[220px_160px_1fr_auto]"><input type="hidden" name="atendimento_id" value={atendimentoId}/><select name="setor_codigo" required defaultValue="" className="ui-input"><option value="">Selecione o setor</option><option value="enfermagem">Enfermagem</option><option value="farmacia">Farmácia</option><option value="laboratorio">Laboratório</option><option value="imagem">Diagnóstico por Imagem</option><option value="internacao">Internação</option></select><select name="prioridade" defaultValue="normal" className="ui-input"><option value="normal">Normal</option><option value="preferencial">Preferencial</option><option value="emergencia">Emergência</option></select><input name="motivo" className="ui-input" placeholder="Motivo / orientação para o setor"/><button className="ui-button-primary">Encaminhar</button></form></section>

    <div className="mt-6 grid gap-6 xl:grid-cols-2">
      <section className="ui-card p-5"><h2 className="flex items-center gap-2 font-semibold text-slate-900"><Activity className="size-5 text-emerald-600"/>Triagem e sinais vitais</h2>{triagem ? <div className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3"><Metric label="PA" value={triagem.pressao_arterial}/><Metric label="FC" value={triagem.frequencia_cardiaca}/><Metric label="FR" value={triagem.frequencia_respiratoria}/><Metric label="SpO₂" value={triagem.saturacao_o2 ? `${triagem.saturacao_o2}%` : null}/><Metric label="Temperatura" value={triagem.temperatura_c ? `${triagem.temperatura_c} °C` : null}/><Metric label="Dor" value={triagem.dor_escala}/><Metric label="Peso" value={triagem.peso_kg ? `${triagem.peso_kg} kg` : null}/><Metric label="Altura" value={triagem.altura_cm ? `${triagem.altura_cm} cm` : null}/><Metric label="Risco" value={triagem.classificacao_risco}/></div> : <Empty text="Triagem ainda não registrada."/>}</section>
      <section className="ui-card p-5"><h2 className="flex items-center gap-2 font-semibold text-slate-900"><ShieldCheck className="size-5 text-brand-700"/>Evoluções clínicas</h2><div className="mt-4 space-y-3">{evolucoes?.length ? evolucoes.map((item) => { const prof=one(item.profissional); return <article key={item.id} className="rounded-xl border border-slate-200 p-4"><div className="flex justify-between gap-3"><strong className="text-sm text-slate-900">{item.tipo_evolucao}</strong><span className="text-xs text-slate-400">{new Date(item.created_at).toLocaleString("pt-BR")}</span></div><p className="mt-1 text-xs text-slate-500">{prof?.nome_completo ?? "Profissional"}</p>{item.avaliacao ? <p className="mt-3 text-sm text-slate-700"><b>Avaliação:</b> {item.avaliacao}</p> : null}{item.plano ? <p className="mt-1 text-sm text-slate-700"><b>Plano:</b> {item.plano}</p> : null}</article>; }) : <Empty text="Nenhuma evolução registrada."/>}</div></section>

      <section className="ui-card p-5 xl:col-span-2">
        <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="flex items-center gap-2 font-semibold text-slate-900"><ShieldAlert className="size-5 text-rose-500"/>Urgência / Emergência</h2><Link href={urgenciaHref} className="ui-button-secondary"><HeartPulse className="size-4"/>Abrir Central de Urgência</Link></div>
        <div className="mt-4 space-y-3">
          {emergencias?.length ? emergencias.map((item) => {
            const prof = one(item.profissional);
            const reavaliacoes = (reavaliacoesEmergencia ?? []).filter((reav) => reav.emergencia_id === item.id);
            return <article key={item.id} className="rounded-xl border border-slate-200 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex flex-wrap gap-2"><span className="rounded-full bg-rose-50 px-2.5 py-1 text-xs font-bold capitalize text-rose-700">Risco {item.classificacao_risco ?? "—"}</span><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">{item.status}</span></div><p className="mt-2 text-xs text-slate-500">{new Date(item.created_at).toLocaleString("pt-BR")} · {prof?.nome_completo ?? "Profissional"} · Sala {item.sala ?? "—"}</p></div><div className="text-right text-xs text-slate-500"><p>Destino: <b>{item.destino ?? "em definição"}</b></p><p>Próx. reavaliação: {item.reavaliacao_em ? new Date(item.reavaliacao_em).toLocaleString("pt-BR") : "—"}</p></div></div>
              <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-5"><Metric label="A · Via aérea" value={item.via_aerea}/><Metric label="B · Respiração" value={item.respiracao}/><Metric label="C · Circulação" value={item.circulacao}/><Metric label="D · Neurológico" value={item.neurologico}/><Metric label="E · Exposição" value={item.exposicao}/></div>
              {item.estado_geral ? <p className="mt-3 text-sm text-slate-700"><b>Estado geral:</b> {item.estado_geral}</p> : null}
              {item.protocolo ? <p className="mt-1 text-sm text-slate-700"><b>Protocolo:</b> {item.protocolo}</p> : null}
              {reavaliacoes.length ? <details className="mt-3 rounded-xl bg-slate-50 p-3"><summary className="cursor-pointer text-sm font-semibold text-slate-700">Reavaliações ({reavaliacoes.length})</summary><div className="mt-3 space-y-2">{reavaliacoes.map((reav) => { const reavProf = one(reav.profissional); return <div key={reav.id} className="rounded-lg bg-white p-3 text-sm"><div className="flex flex-wrap justify-between gap-2"><b>{new Date(reav.reavaliado_em).toLocaleString("pt-BR")}</b><span className="text-xs text-slate-500">{reavProf?.nome_completo ?? "Profissional"} · risco {reav.classificacao_risco ?? "—"} · dor {reav.dor ?? "—"}/10</span></div>{reav.queixa ? <p className="mt-2"><b>Queixa:</b> {reav.queixa}</p> : null}{reav.conduta ? <p className="mt-1"><b>Conduta:</b> {reav.conduta}</p> : null}</div>; })}</div></details> : null}
            </article>;
          }) : <Empty text="Nenhum registro de urgência/emergência neste atendimento."/>}
        </div>
      </section>

      <section className="ui-card p-5"><h2 className="flex items-center gap-2 font-semibold text-slate-900"><Pill className="size-5 text-rose-500"/>Prescrições</h2><div className="mt-4 space-y-3">{prescricoes?.length ? prescricoes.map((item) => <article key={item.id} className="rounded-xl border border-slate-200 p-4"><div className="flex justify-between"><strong className="text-sm">{item.item}</strong><span className="text-xs font-semibold text-emerald-600">{item.status}</span></div><p className="mt-2 text-sm text-slate-600">{[item.dose,item.via,item.frequencia,item.duracao].filter(Boolean).join(" · ") || item.tipo}</p>{item.instrucoes ? <p className="mt-2 text-xs text-slate-500">{item.instrucoes}</p> : null}</article>) : <Empty text="Nenhuma prescrição neste atendimento."/>}</div></section>
      <section className="ui-card p-5"><div className="flex items-center justify-between gap-2"><h2 className="flex items-center gap-2 font-semibold text-slate-900"><BedDouble className="size-5 text-violet-600"/>Internação</h2><Link href={internacaoHref} className="text-xs font-bold text-brand-700">Admitir / gerenciar</Link></div><div className="mt-4 space-y-3">{internacoes?.length ? internacoes.map((item) => <article key={item.id} className="rounded-xl border border-slate-200 p-4"><strong className="text-sm">{item.setor} · Leito {fmt(item.leito)}</strong><p className="mt-1 text-sm text-slate-600">{item.status} · {fmt(item.acomodacao)}</p>{item.motivo ? <p className="mt-2 text-xs text-slate-500">{item.motivo}</p> : null}</article>) : <Empty text="Sem internação vinculada."/>}</div></section>
      <section className="ui-card p-5 xl:col-span-2"><h2 className="flex items-center gap-2 font-semibold text-slate-900"><FlaskConical className="size-5 text-amber-500"/><ScanLine className="size-5 text-violet-500"/>Movimentações setoriais</h2><div className="mt-4 grid gap-3 md:grid-cols-2">{movimentos?.length ? movimentos.map((item)=><article key={item.id} className="rounded-xl border border-slate-200 p-4"><div className="flex items-start justify-between gap-3"><div><strong className="text-sm capitalize text-slate-900">{item.setor_codigo}</strong><p className="mt-1 text-xs text-slate-500">{new Date(item.created_at).toLocaleString("pt-BR")}</p>{item.motivo?<p className="mt-2 text-sm text-slate-700">{item.motivo}</p>:null}</div><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">{item.status}</span></div></article>) : <Empty text="Nenhuma movimentação setorial registrada."/>}</div></section>
    </div>
  </SectionPage>;
}

function Metric({ label, value }: { label: string; value: string | number | null | undefined }) { return <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs font-medium text-slate-400">{label}</p><p className="mt-1 font-semibold text-slate-900">{value ?? "—"}</p></div>; }
function Empty({ text }: { text: string }) { return <p className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-500">{text}</p>; }