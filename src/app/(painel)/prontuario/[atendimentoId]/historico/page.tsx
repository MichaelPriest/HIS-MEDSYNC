import Link from "next/link";
import type { Route } from "next";
import { Activity, AlertTriangle, BedDouble, ClipboardCheck, FileHeart, FileText, FlaskConical, History, Pill, Stethoscope } from "lucide-react";
import { notFound } from "next/navigation";
import { SectionPage } from "@/components/painel/section-page";
import { requireAnyPermission } from "@/lib/permissions/server";

type Rel<T> = T | T[] | null;
type Profissional = { nome_completo: string | null; especialidade?: string | null };
type AtendimentoHistorico = {
  id: string;
  numero_atendimento: string | number | null;
  tipo_atendimento: string | null;
  origem: string | null;
  status: string;
  setor_atual: string | null;
  data_abertura: string;
  data_fechamento: string | null;
  profissional: Rel<Profissional>;
};
type RegistroComAtendimento = { atendimento_id: string };
type RegistroComSolicitacao = { solicitacao_id: string };

function one<T>(rel: Rel<T>): T | null { return Array.isArray(rel) ? rel[0] ?? null : rel; }
function fmtData(value?: string | null) { return value ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(value)) : "—"; }
function texto(value: unknown) { return typeof value === "string" && value.trim() ? value : null; }
function porAtendimento<T extends RegistroComAtendimento>(registros: T[]) {
  const mapa = new Map<string, T[]>();
  for (const registro of registros) mapa.set(registro.atendimento_id, [...(mapa.get(registro.atendimento_id) ?? []), registro]);
  return mapa;
}
function primeiroPorSolicitacao<T extends RegistroComSolicitacao>(registros: T[]) {
  const mapa = new Map<string, T>();
  for (const registro of registros) if (!mapa.has(registro.solicitacao_id)) mapa.set(registro.solicitacao_id, registro);
  return mapa;
}

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function HistoricoClinicoPage({ params, searchParams }: { params: Promise<{ atendimentoId: string }>; searchParams: Promise<{ periodo?: string }> }) {
  const { atendimentoId } = await params;
  const sp = await searchParams;
  const { supabase, empresaId, unidadeId } = await requireAnyPermission(["prontuario.visualizar"]);
  if (!unidadeId) return null;

  const { data: atual } = await supabase.from("atendimentos")
    .select("id,paciente_id,numero_atendimento,paciente:pacientes(nome_completo,nome_social,ra,numero_registro,data_nascimento)")
    .eq("id", atendimentoId).eq("empresa_id", empresaId).eq("unidade_id", unidadeId).maybeSingle();
  if (!atual) notFound();
  const paciente = one(atual.paciente);

  let atendimentosQuery = supabase.from("atendimentos")
    .select("id,numero_atendimento,tipo_atendimento,origem,status,setor_atual,data_abertura,data_fechamento,profissional:profissionais(nome_completo,especialidade)")
    .eq("empresa_id", empresaId).eq("paciente_id", atual.paciente_id)
    .order("data_abertura", { ascending: false }).limit(100);

  const dias = Number(sp.periodo ?? "0");
  if ([30, 90, 180, 365].includes(dias)) atendimentosQuery = atendimentosQuery.gte("data_abertura", new Date(Date.now() - dias * 86400000).toISOString());
  const { data: atendimentosData } = await atendimentosQuery;
  const atendimentos = (atendimentosData ?? []) as unknown as AtendimentoHistorico[];
  const ids = atendimentos.map((item) => item.id);

  const vazio = { data: [] as unknown[] };
  const [triagensRes, anamnesesRes, evolucoesRes, diagnosticosRes, avaliacoesRes, internacoesRes, prescricoesRes, examesRes, procedimentosRes, sumariosRes, documentosRes, laboratorioLaudosRes, imagemLaudosRes, laboratorioCriticosRes] = ids.length ? await Promise.all([
    supabase.from("triagens").select("atendimento_id,classificacao_risco,queixa_principal,pressao_arterial,frequencia_cardiaca,saturacao_o2,temperatura_c,updated_at").in("atendimento_id", ids).order("updated_at", { ascending: false }),
    supabase.from("prontuario_anamneses").select("atendimento_id,queixa_principal,historia_doenca_atual,hipotese_diagnostica,conduta_inicial,assinado_em,created_at,profissional:profissionais(nome_completo)").in("atendimento_id", ids).order("created_at", { ascending: false }),
    supabase.from("prontuario_evolucoes").select("atendimento_id,tipo_evolucao,subjetivo,objetivo,avaliacao,plano,conduta,assinado_em,created_at,profissional:profissionais(nome_completo)").in("atendimento_id", ids).order("created_at", { ascending: false }),
    supabase.from("prontuario_diagnosticos").select("atendimento_id,cid10,descricao,tipo,principal,confirmado,created_at").in("atendimento_id", ids).order("created_at", { ascending: false }),
    supabase.from("solicitacoes_avaliacao_medica").select("atendimento_id,especialidade,prioridade,motivo,status,parecer,solicitada_em,concluida_em,profissional:profissionais!solicitacoes_avaliacao_medica_profissional_responsavel_id_fkey(nome_completo)").in("atendimento_id", ids).order("solicitada_em", { ascending: false }),
    supabase.from("internacoes").select("atendimento_id,setor,quarto,leito,acomodacao,tipo_internacao,motivo,data_internacao,data_alta,status,motivo_alta").in("atendimento_id", ids).order("data_internacao", { ascending: false }),
    supabase.from("prescricoes").select("atendimento_id,tipo,item,dose,via,frequencia,duracao,status,assinado_em,created_at,profissional:profissionais(nome_completo)").in("atendimento_id", ids).neq("status", "rascunho").order("created_at", { ascending: false }),
    supabase.from("solicitacoes_exames").select("id,atendimento_id,modalidade,exame,codigo_tuss,status,resultado_resumo,resultado_em,created_at").in("atendimento_id", ids).neq("status", "rascunho").order("created_at", { ascending: false }),
    supabase.from("procedimentos_assistenciais").select("atendimento_id,area,codigo_tuss,procedimento,quantidade,unidade_medida,status,executado_em,resultado").in("atendimento_id", ids).neq("status", "rascunho").order("executado_em", { ascending: false }),
    supabase.from("sumarios_alta").select("atendimento_id,motivo_internacao,evolucao_resumida,condicao_alta,orientacoes,sinais_alarme,cuidados_domiciliares,retorno,assinado_em,created_at").in("atendimento_id", ids).order("created_at", { ascending: false }),
    supabase.from("documentos_clinicos_medicos").select("id,atendimento_id,tipo_documento,titulo,status,emitido_em,assinado_em").in("atendimento_id", ids).order("emitido_em", { ascending: false }),
    supabase.from("laboratorio_laudos").select("id,solicitacao_id,atendimento_id,status,liberado_em,conclusao").in("atendimento_id", ids).eq("status", "liberado").order("liberado_em", { ascending: false }),
    supabase.from("imagem_laudos").select("id,solicitacao_id,atendimento_id,status,liberado_em,conclusao,achado_critico,comunicacao_critica_em,comunicada_a").in("atendimento_id", ids).eq("status", "liberado").order("liberado_em", { ascending: false }),
    supabase.from("laboratorio_resultados").select("id,solicitacao_id,atendimento_id,analito,resultado,flag,valor_critico,notificado_em,liberado_em").in("atendimento_id", ids).eq("liberado", true).eq("valor_critico", true).order("liberado_em", { ascending: false }),
  ]) : [vazio, vazio, vazio, vazio, vazio, vazio, vazio, vazio, vazio, vazio, vazio, vazio, vazio, vazio];

  const triagens = porAtendimento((triagensRes.data ?? []) as unknown as Array<RegistroComAtendimento & { classificacao_risco: string | null; queixa_principal: string | null; pressao_arterial: string | null; frequencia_cardiaca: number | null; saturacao_o2: number | null; temperatura_c: number | null; updated_at: string }>);
  const anamneses = porAtendimento((anamnesesRes.data ?? []) as unknown as Array<RegistroComAtendimento & { queixa_principal: string | null; historia_doenca_atual: string | null; hipotese_diagnostica: string | null; conduta_inicial: string | null; assinado_em: string | null; created_at: string; profissional: Rel<Profissional> }>);
  const evolucoes = porAtendimento((evolucoesRes.data ?? []) as unknown as Array<RegistroComAtendimento & { tipo_evolucao: string; subjetivo: string | null; objetivo: string | null; avaliacao: string | null; plano: string | null; conduta: string | null; assinado_em: string | null; created_at: string; profissional: Rel<Profissional> }>);
  const diagnosticos = porAtendimento((diagnosticosRes.data ?? []) as unknown as Array<RegistroComAtendimento & { cid10: string | null; descricao: string; tipo: string; principal: boolean; confirmado: boolean; created_at: string }>);
  const avaliacoes = porAtendimento((avaliacoesRes.data ?? []) as unknown as Array<RegistroComAtendimento & { especialidade: string; prioridade: string; motivo: string; status: string; parecer: string | null; solicitada_em: string; concluida_em: string | null; profissional: Rel<Profissional> }>);
  const internacoes = porAtendimento((internacoesRes.data ?? []) as unknown as Array<RegistroComAtendimento & { setor: string; quarto: string | null; leito: string | null; acomodacao: string | null; tipo_internacao: string | null; motivo: string | null; data_internacao: string; data_alta: string | null; status: string; motivo_alta: string | null }>);
  const prescricoes = porAtendimento((prescricoesRes.data ?? []) as unknown as Array<RegistroComAtendimento & { tipo: string; item: string; dose: string | null; via: string | null; frequencia: string | null; duracao: string | null; status: string; assinado_em: string | null; created_at: string; profissional: Rel<Profissional> }>);
  const exames = porAtendimento((examesRes.data ?? []) as unknown as Array<RegistroComAtendimento & { id: string; modalidade: string; exame: string; codigo_tuss: string | null; status: string; resultado_resumo: string | null; resultado_em: string | null; created_at: string }>);
  const procedimentos = porAtendimento((procedimentosRes.data ?? []) as unknown as Array<RegistroComAtendimento & { area: string; codigo_tuss: string | null; procedimento: string; quantidade: number; unidade_medida: string; status: string; executado_em: string; resultado: string | null }>);
  const sumarios = porAtendimento((sumariosRes.data ?? []) as unknown as Array<RegistroComAtendimento & { motivo_internacao: string | null; evolucao_resumida: string | null; condicao_alta: string | null; orientacoes: string | null; sinais_alarme: string | null; cuidados_domiciliares: string | null; retorno: string | null; assinado_em: string | null; created_at: string }>);
  const documentos = porAtendimento((documentosRes.data ?? []) as unknown as Array<RegistroComAtendimento & { id: string; tipo_documento: string; titulo: string; status: string; emitido_em: string; assinado_em: string | null }>);
  const laboratorioLaudos = primeiroPorSolicitacao((laboratorioLaudosRes.data ?? []) as unknown as Array<RegistroComAtendimento & RegistroComSolicitacao & { id: string; status: string; liberado_em: string | null; conclusao: string | null }>);
  const imagemLaudos = primeiroPorSolicitacao((imagemLaudosRes.data ?? []) as unknown as Array<RegistroComAtendimento & RegistroComSolicitacao & { id: string; status: string; liberado_em: string | null; conclusao: string | null; achado_critico: boolean; comunicacao_critica_em: string | null; comunicada_a: string | null }>);
  const laboratorioCriticos = primeiroPorSolicitacao((laboratorioCriticosRes.data ?? []) as unknown as Array<RegistroComAtendimento & RegistroComSolicitacao & { id: string; analito: string; resultado: string | null; flag: string | null; valor_critico: boolean; notificado_em: string | null; liberado_em: string | null }>);
  const totalLaudos = laboratorioLaudos.size + imagemLaudos.size;
  const totalCriticos = laboratorioCriticos.size + [...imagemLaudos.values()].filter((item) => item.achado_critico).length;

  return <SectionPage eyebrow="Assistencial / Prontuário longitudinal" title="Histórico clínico do paciente" description={`${paciente?.nome_social || paciente?.nome_completo || "Paciente"} · Registro #${paciente?.numero_registro ?? "—"} · ${paciente?.ra ?? "—"}`}>
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap gap-2"><Filtro href={`/prontuario/${atendimentoId}/historico`} ativo={!dias}>Todo o histórico</Filtro><Filtro href={`/prontuario/${atendimentoId}/historico?periodo=30`} ativo={dias === 30}>30 dias</Filtro><Filtro href={`/prontuario/${atendimentoId}/historico?periodo=90`} ativo={dias === 90}>90 dias</Filtro><Filtro href={`/prontuario/${atendimentoId}/historico?periodo=180`} ativo={dias === 180}>6 meses</Filtro><Filtro href={`/prontuario/${atendimentoId}/historico?periodo=365`} ativo={dias === 365}>1 ano</Filtro></div>
      <div className="rounded-full bg-brand-50 px-3 py-1.5 text-xs font-black text-brand-700">{atendimentos.length} episódio(s) acessível(is)</div>
    </div>

    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
      <Kpi label="Atendimentos" value={atendimentos.length} icon={<History className="size-5 text-brand-600"/>}/>
      <Kpi label="Avaliações" value={[...avaliacoes.values()].reduce((s, i) => s + i.length, 0)} icon={<Stethoscope className="size-5 text-violet-600"/>}/>
      <Kpi label="Internações" value={[...internacoes.values()].reduce((s, i) => s + i.length, 0)} icon={<BedDouble className="size-5 text-amber-600"/>}/>
      <Kpi label="Documentos" value={[...documentos.values()].reduce((s, i) => s + i.length, 0)} icon={<FileText className="size-5 text-emerald-600"/>}/>
      <Kpi label="Laudos liberados" value={totalLaudos} icon={<FlaskConical className="size-5 text-sky-600"/>}/>
      <Kpi label="Críticos diagnósticos" value={totalCriticos} icon={<AlertTriangle className="size-5 text-rose-600"/>}/>
    </section>

    <div className="mt-6 space-y-5">
      {atendimentos.length ? atendimentos.map((episodio) => {
        const prof = one(episodio.profissional);
        const triagem = triagens.get(episodio.id)?.[0];
        const episodioAnamneses = anamneses.get(episodio.id) ?? [];
        const episodioEvolucoes = evolucoes.get(episodio.id) ?? [];
        const episodioDiagnosticos = diagnosticos.get(episodio.id) ?? [];
        const episodioAvaliacoes = avaliacoes.get(episodio.id) ?? [];
        const episodioInternacoes = internacoes.get(episodio.id) ?? [];
        const episodioPrescricoes = prescricoes.get(episodio.id) ?? [];
        const episodioExames = exames.get(episodio.id) ?? [];
        const episodioProcedimentos = procedimentos.get(episodio.id) ?? [];
        const episodioSumarios = sumarios.get(episodio.id) ?? [];
        const episodioDocumentos = documentos.get(episodio.id) ?? [];
        const atualEpisodio = episodio.id === atendimentoId;

        return <article key={episodio.id} className={`his-card overflow-hidden ${atualEpisodio ? "ring-2 ring-brand-200" : ""}`}>
          <header className="border-b border-slate-100 bg-slate-50/70 p-5">
            <div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2"><h2 className="font-black text-slate-950">Atendimento #{episodio.numero_atendimento ?? "—"}</h2>{atualEpisodio ? <span className="rounded-full bg-brand-100 px-2.5 py-1 text-[10px] font-black uppercase text-brand-700">Episódio atual</span> : null}<span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-bold uppercase text-slate-600">{episodio.status}</span></div><p className="mt-1 text-sm text-slate-600">{fmtData(episodio.data_abertura)} · {episodio.tipo_atendimento || "Atendimento"} · {episodio.origem?.replaceAll("_", " ") || "origem não informada"}</p><p className="mt-1 text-xs text-slate-500">Setor: {episodio.setor_atual?.replaceAll("_", " ") || "—"} · Profissional: {prof?.nome_completo ?? "—"}{prof?.especialidade ? ` · ${prof.especialidade}` : ""}</p></div><Link href={`/prontuario/${episodio.id}` as Route} className="ui-button-secondary">Abrir episódio</Link></div>
          </header>

          <div className="grid gap-4 p-5 xl:grid-cols-2">
            <Bloco titulo="Triagem / avaliação inicial" icon={<Activity className="size-4 text-rose-500"/>}>{triagem ? <><p><b>Queixa:</b> {triagem.queixa_principal || "—"}</p><p className="mt-1">Risco {triagem.classificacao_risco || "—"} · PA {triagem.pressao_arterial || "—"} · FC {triagem.frequencia_cardiaca ?? "—"} · SpO₂ {triagem.saturacao_o2 ?? "—"}% · Temp. {triagem.temperatura_c ?? "—"} °C</p></> : <Vazio/>}</Bloco>

            <Bloco titulo="Diagnósticos" icon={<FileHeart className="size-4 text-violet-600"/>}>{episodioDiagnosticos.length ? <div className="space-y-1">{episodioDiagnosticos.slice(0, 8).map((item, index) => <p key={`${item.cid10}-${index}`}><b>{item.cid10 || "CID —"}</b> · {item.descricao}{item.principal ? " · principal" : ""}</p>)}</div> : <Vazio/>}</Bloco>

            <Bloco titulo="Anamnese e evoluções" icon={<ClipboardCheck className="size-4 text-brand-600"/>}>{episodioAnamneses.length || episodioEvolucoes.length ? <div className="space-y-3">{episodioAnamneses.slice(0, 2).map((item, index) => <div key={`a-${index}`}><p className="text-xs font-black uppercase text-slate-400">Anamnese · {fmtData(item.created_at)}</p>{item.queixa_principal ? <p><b>Queixa:</b> {item.queixa_principal}</p> : null}{item.hipotese_diagnostica ? <p><b>Hipótese:</b> {item.hipotese_diagnostica}</p> : null}{item.conduta_inicial ? <p><b>Conduta:</b> {item.conduta_inicial}</p> : null}</div>)}{episodioEvolucoes.slice(0, 4).map((item, index) => { const profissional = one(item.profissional); return <div key={`e-${index}`}><p className="text-xs font-black uppercase text-slate-400">Evolução · {fmtData(item.created_at)} · {profissional?.nome_completo ?? "Profissional"}</p>{texto(item.avaliacao) ? <p><b>Avaliação:</b> {item.avaliacao}</p> : null}{texto(item.plano) ? <p><b>Plano:</b> {item.plano}</p> : null}{texto(item.conduta) ? <p><b>Conduta:</b> {item.conduta}</p> : null}</div>; })}</div> : <Vazio/>}</Bloco>

            <Bloco titulo="Avaliações médicas" icon={<Stethoscope className="size-4 text-cyan-600"/>}>{episodioAvaliacoes.length ? <div className="space-y-2">{episodioAvaliacoes.slice(0, 6).map((item, index) => { const profissional = one(item.profissional); return <div key={`${item.especialidade}-${index}`}><p><b>{item.especialidade}</b> · {item.status} · {item.prioridade}</p><p className="text-xs text-slate-500">Solicitada {fmtData(item.solicitada_em)}{profissional?.nome_completo ? ` · ${profissional.nome_completo}` : ""}</p>{item.parecer ? <p className="mt-1"><b>Parecer:</b> {item.parecer}</p> : <p className="mt-1"><b>Motivo:</b> {item.motivo}</p>}</div>; })}</div> : <Vazio/>}</Bloco>

            <Bloco titulo="Internações" icon={<BedDouble className="size-4 text-amber-600"/>}>{episodioInternacoes.length ? <div className="space-y-2">{episodioInternacoes.map((item, index) => <div key={`${item.data_internacao}-${index}`}><p><b>{item.setor}</b>{item.leito ? ` · leito ${item.leito}` : ""} · {item.status}</p><p className="text-xs text-slate-500">Entrada {fmtData(item.data_internacao)}{item.data_alta ? ` · alta ${fmtData(item.data_alta)}` : ""}</p>{item.motivo ? <p className="mt-1">{item.motivo}</p> : null}{item.motivo_alta ? <p className="mt-1"><b>Motivo da alta:</b> {item.motivo_alta}</p> : null}</div>)}</div> : <Vazio/>}</Bloco>

            <Bloco titulo="Prescrições" icon={<Pill className="size-4 text-emerald-600"/>}>{episodioPrescricoes.length ? <div className="space-y-1">{episodioPrescricoes.slice(0, 10).map((item, index) => <p key={`${item.item}-${index}`}><b>{item.item}</b>{[item.dose, item.via, item.frequencia].filter(Boolean).length ? ` · ${[item.dose, item.via, item.frequencia].filter(Boolean).join(" · ")}` : ""}</p>)}</div> : <Vazio/>}</Bloco>

            <Bloco titulo="Exames e procedimentos" icon={<FlaskConical className="size-4 text-sky-600"/>}>{episodioExames.length || episodioProcedimentos.length ? <div className="space-y-2">{episodioExames.slice(0, 8).map((item) => { const labLaudo = laboratorioLaudos.get(item.id); const imgLaudo = imagemLaudos.get(item.id); const labCritico = laboratorioCriticos.get(item.id); const critico = Boolean(labCritico || imgLaudo?.achado_critico); return <div key={item.id} className={`rounded-lg p-2 ${critico ? "bg-rose-50" : "bg-slate-50/70"}`}><div className="flex flex-wrap items-center justify-between gap-2"><p><b>{item.exame}</b> · {item.modalidade} · {item.status}</p>{critico ? <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-black uppercase text-rose-700">Crítico</span> : null}</div>{item.resultado_resumo ? <p className="text-xs text-slate-600">Resultado: {item.resultado_resumo}</p> : null}{labCritico ? <p className="mt-1 text-xs font-semibold text-rose-700">{labCritico.analito}: {labCritico.resultado ?? "resultado crítico"} {labCritico.flag ? `(${labCritico.flag})` : ""}{labCritico.notificado_em ? " · comunicação registrada" : ""}</p> : null}{imgLaudo?.achado_critico ? <p className="mt-1 text-xs font-semibold text-rose-700">Achado crítico de imagem{imgLaudo.comunicacao_critica_em ? ` · comunicado a ${imgLaudo.comunicada_a ?? "responsável"}` : ""}</p> : null}<div className="mt-1 flex flex-wrap gap-3">{labLaudo ? <Link href={`/assistencial/laboratorio/laudos/${labLaudo.id}` as Route} className="text-xs font-black text-brand-700 hover:underline">Abrir laudo laboratorial</Link> : null}{imgLaudo ? <Link href={`/assistencial/imagem/laudos/${imgLaudo.id}` as Route} className="text-xs font-black text-brand-700 hover:underline">Abrir laudo de imagem</Link> : null}</div></div>; })}{episodioProcedimentos.slice(0, 6).map((item, index) => <div key={`p-${index}`}><p><b>{item.procedimento}</b> · {item.quantidade} {item.unidade_medida} · {item.status}</p>{item.resultado ? <p className="text-xs text-slate-600">Resultado: {item.resultado}</p> : null}</div>)}</div> : <Vazio/>}</Bloco>

            <Bloco titulo="Conclusão / alta" icon={<FileText className="size-4 text-slate-600"/>}>{episodioSumarios.length ? <div className="space-y-3">{episodioSumarios.slice(0, 2).map((item, index) => <div key={`s-${index}`}>{item.evolucao_resumida ? <p><b>Resumo:</b> {item.evolucao_resumida}</p> : null}{item.condicao_alta ? <p><b>Condição:</b> {item.condicao_alta}</p> : null}{item.orientacoes ? <p><b>Orientações:</b> {item.orientacoes}</p> : null}{item.sinais_alarme ? <p><b>Sinais de alarme:</b> {item.sinais_alarme}</p> : null}{item.retorno ? <p><b>Retorno:</b> {item.retorno}</p> : null}</div>)}</div> : <Vazio/>}</Bloco>

            <Bloco titulo="Receituários e orientações" icon={<FileText className="size-4 text-emerald-700"/>}>{episodioDocumentos.length ? <div className="space-y-2">{episodioDocumentos.map((item) => <div key={item.id} className="flex flex-wrap items-center justify-between gap-2"><span><b>{item.titulo}</b> · {item.status} · {fmtData(item.emitido_em)}</span><Link href={`/prontuario/${episodio.id}/documentos/${item.id}` as Route} className="text-xs font-black text-brand-700 hover:underline">Visualizar</Link></div>)}</div> : <Vazio/>}</Bloco>
          </div>
        </article>;
      }) : <div className="his-card p-10 text-center text-sm text-slate-500">Nenhum episódio acessível encontrado para este paciente no período selecionado.</div>}
    </div>
  </SectionPage>;
}

function Kpi({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) { return <div className="his-kpi"><div className="flex items-center justify-between"><p className="text-xs font-black uppercase tracking-wider text-slate-400">{label}</p>{icon}</div><p className="mt-2 text-3xl font-black text-slate-950">{value}</p></div>; }
function Bloco({ titulo, icon, children }: { titulo: string; icon: React.ReactNode; children: React.ReactNode }) { return <section className="rounded-xl border border-slate-200 p-4"><h3 className="mb-3 flex items-center gap-2 text-sm font-black text-slate-900">{icon}{titulo}</h3><div className="text-sm leading-6 text-slate-700">{children}</div></section>; }
function Vazio() { return <p className="text-sm text-slate-400">Sem registros neste episódio.</p>; }
function Filtro({ href, ativo, children }: { href: string; ativo: boolean; children: React.ReactNode }) { return <Link href={href as Route} className={`rounded-full px-3 py-1.5 text-xs font-bold ${ativo ? "bg-brand-700 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>{children}</Link>; }
