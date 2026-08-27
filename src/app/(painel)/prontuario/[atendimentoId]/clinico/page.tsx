import Link from "next/link";
import { AlertTriangle, ArrowLeft, ClipboardCheck, FileHeart, HeartPulse, Scale, ShieldCheck, Stethoscope } from "lucide-react";
import { notFound } from "next/navigation";
import { ClinicalAutosaveForm } from "@/components/prontuario/clinical-autosave-form";
import { HistoricoClinicoModal, type HistoricoClinicoModalItem } from "@/components/prontuario/historico-clinico-modal";
import { SectionPage } from "@/components/painel/section-page";
import { createClient } from "@/lib/supabase/server";
import { adicionarAlergia, adicionarDiagnostico, adicionarProblema, registrarEscala } from "@/modules/prontuario-clinico/actions";

function one<T>(rel: T | T[] | null): T | null { return Array.isArray(rel) ? rel[0] ?? null : rel; }
function objeto(value: unknown): Record<string, unknown> { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
function valorJson(value: unknown) { return typeof value === "string" && value.trim() ? value : null; }
function textoRevisao(value: unknown) {
  const revisao = objeto(value);
  const linhas = [
    ["Cardiovascular", valorJson(revisao.cardiovascular)],
    ["Respiratório", valorJson(revisao.respiratorio)],
    ["Gastrointestinal", valorJson(revisao.gastrointestinal)],
    ["Geniturinário", valorJson(revisao.geniturinario)],
    ["Neurológico", valorJson(revisao.neurologico)],
    ["Musculoesquelético", valorJson(revisao.musculoesqueletico)],
    ["Pele e anexos", valorJson(revisao.pele)],
  ].filter((item): item is [string, string] => Boolean(item[1]));
  return linhas.length ? linhas.map(([label, value]) => `${label}: ${value}`).join("\n") : null;
}

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ProntuarioClinicoPage({ params, searchParams }: { params: Promise<{ atendimentoId: string }>; searchParams: Promise<{ erro?: string; sucesso?: string }> }) {
  const { atendimentoId } = await params;
  const sp = await searchParams;
  const supabase = await createClient();

  const [{ data: atendimento }, { data: authData }] = await Promise.all([
    supabase.from("atendimentos")
      .select("id,numero_atendimento,paciente_id,status,paciente:pacientes(nome_completo,ra,numero_registro,cpf,cns,data_nascimento,sexo)")
      .eq("id", atendimentoId).maybeSingle(),
    supabase.auth.getUser(),
  ]);
  if (!atendimento) notFound();
  const paciente = one(atendimento.paciente);
  const user = authData.user;

  const profissionalAtualPromise = user
    ? supabase.from("profissionais").select("id").eq("usuario_id", user.id).eq("ativo", true).limit(1).maybeSingle()
    : Promise.resolve({ data: null, error: null });

  const [anamnesesRes, alergiasRes, problemasRes, diagnosticosRes, escalasRes, evolucoesRes, profissionalAtualRes] = await Promise.all([
    supabase.from("prontuario_anamneses").select("id,profissional_id,queixa_principal,historia_doenca_atual,antecedentes_pessoais,antecedentes_familiares,habitos_vida,medicacoes_uso,revisao_sistemas,exame_fisico_geral,hipotese_diagnostica,conduta_inicial,assinado_em,bloqueado,created_at,updated_at,profissional:profissionais(nome_completo)").eq("atendimento_id", atendimentoId).order("created_at", { ascending: false }).limit(20),
    supabase.from("paciente_alergias").select("id,substancia,tipo,reacao,gravidade,status,observacoes,created_at").eq("paciente_id", atendimento.paciente_id).eq("status", "ativa").order("created_at", { ascending: false }),
    supabase.from("paciente_problemas").select("id,descricao,cid10,status,principal,observacoes,created_at").eq("paciente_id", atendimento.paciente_id).eq("status", "ativo").order("principal", { ascending: false }).order("created_at", { ascending: false }),
    supabase.from("prontuario_diagnosticos").select("id,cid10,descricao,tipo,principal,confirmado,created_at,profissional:profissionais(nome_completo)").eq("atendimento_id", atendimentoId).order("principal", { ascending: false }).order("created_at", { ascending: false }),
    supabase.from("prontuario_escalas").select("id,escala,pontuacao,classificacao,observacoes,aplicada_em,profissional:profissionais(nome_completo)").eq("atendimento_id", atendimentoId).order("aplicada_em", { ascending: false }).limit(20),
    supabase.from("prontuario_evolucoes").select("id,profissional_id,subjetivo,objetivo,avaliacao,plano,exame_fisico,conduta,conteudo_estruturado,assinado_em,bloqueado,created_at,updated_at,profissional:profissionais(nome_completo)").eq("atendimento_id", atendimentoId).order("created_at", { ascending: false }).limit(30),
    profissionalAtualPromise,
  ]);

  const alergias = alergiasRes.data ?? [];
  const problemas = problemasRes.data ?? [];
  const diagnosticos = diagnosticosRes.data ?? [];
  const escalas = escalasRes.data ?? [];
  const evolucoes = evolucoesRes.data ?? [];
  const anamneses = anamnesesRes.data ?? [];
  const profissionalAtualId = profissionalAtualRes.data?.id ?? null;

  const anamneseRascunho = profissionalAtualId
    ? [...anamneses].filter((item) => item.profissional_id === profissionalAtualId && !item.assinado_em && !item.bloqueado).sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)))[0] ?? null
    : null;
  const soapRascunho = profissionalAtualId
    ? [...evolucoes].filter((item) => item.profissional_id === profissionalAtualId && !item.assinado_em && !item.bloqueado).sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)))[0] ?? null
    : null;

  const revisaoRascunho = objeto(anamneseRascunho?.revisao_sistemas);
  const soapEstruturado = objeto(soapRascunho?.conteudo_estruturado);

  const historicoItens: HistoricoClinicoModalItem[] = [
    ...anamneses.map((item) => ({
      id: item.id,
      tipo: "Anamnese",
      data: item.created_at,
      assinado: Boolean(item.assinado_em),
      profissional: one(item.profissional)?.nome_completo ?? null,
      resumo: item.queixa_principal || item.historia_doenca_atual,
      detalhes: [
        { label: "Queixa principal", value: item.queixa_principal },
        { label: "História da doença atual", value: item.historia_doenca_atual },
        { label: "Antecedentes pessoais", value: item.antecedentes_pessoais },
        { label: "Antecedentes familiares", value: item.antecedentes_familiares },
        { label: "Hábitos de vida", value: item.habitos_vida },
        { label: "Medicações em uso", value: item.medicacoes_uso },
        { label: "Revisão de sistemas", value: textoRevisao(item.revisao_sistemas) },
        { label: "Exame físico geral", value: item.exame_fisico_geral },
        { label: "Hipótese diagnóstica", value: item.hipotese_diagnostica },
        { label: "Conduta inicial", value: item.conduta_inicial },
      ],
    })),
    ...evolucoes.map((item) => {
      const estruturado = objeto(item.conteudo_estruturado);
      return {
        id: item.id,
        tipo: "Evolução SOAP",
        data: item.created_at,
        assinado: Boolean(item.assinado_em),
        profissional: one(item.profissional)?.nome_completo ?? null,
        resumo: item.avaliacao || item.subjetivo,
        detalhes: [
          { label: "S · Subjetivo", value: item.subjetivo },
          { label: "O · Objetivo", value: item.objetivo },
          { label: "A · Avaliação", value: item.avaliacao },
          { label: "P · Plano", value: item.plano },
          { label: "Exame físico", value: item.exame_fisico },
          { label: "Conduta", value: item.conduta },
          { label: "CID-10 relacionado", value: valorJson(estruturado.cid10) },
          { label: "Retorno / reavaliação", value: valorJson(estruturado.retorno) },
        ],
      };
    }),
  ].sort((a, b) => String(b.data).localeCompare(String(a.data)));

  return <SectionPage eyebrow="Assistencial / Prontuário clínico" title={paciente?.nome_completo ?? "Paciente"} description={`Atendimento #${atendimento.numero_atendimento ?? "—"} · Registro #${paciente?.numero_registro ?? "—"} · ${paciente?.ra ?? "—"}`}>
    <div className="mb-4 flex flex-wrap gap-2"><Link href={`/prontuario/${atendimentoId}`} className="btn-secondary"><ArrowLeft className="size-4"/>Resumo do atendimento</Link><Link href="/prescricao" className="btn-secondary">Prescrição</Link><Link href="/setores/enfermagem" className="btn-secondary">Enfermagem</Link></div>

    {sp.erro ? <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-medium text-rose-700">Não foi possível salvar esta informação clínica. Verifique os campos e tente novamente.</div> : null}
    {sp.sucesso ? <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-700">Registro clínico salvo com sucesso.</div> : null}

    <section className="grid gap-3 md:grid-cols-4">
      <div className={`his-kpi ${alergias.length ? "border-rose-200" : ""}`}><div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400"><AlertTriangle className="size-4 text-rose-500"/>Alergias</div><p className={`mt-2 text-3xl font-black ${alergias.length ? "text-rose-700" : "text-slate-900"}`}>{alergias.length}</p><p className="mt-1 text-xs text-slate-500">Ativas no prontuário longitudinal.</p></div>
      <div className="his-kpi"><div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400"><FileHeart className="size-4 text-brand-600"/>Problemas</div><p className="mt-2 text-3xl font-black text-brand-950">{problemas.length}</p><p className="mt-1 text-xs text-slate-500">Problemas clínicos ativos.</p></div>
      <div className="his-kpi"><div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400"><Stethoscope className="size-4 text-violet-600"/>Diagnósticos</div><p className="mt-2 text-3xl font-black text-violet-700">{diagnosticos.length}</p><p className="mt-1 text-xs text-slate-500">Hipóteses e diagnósticos do episódio.</p></div>
      <div className="his-kpi"><div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400"><ShieldCheck className="size-4 text-emerald-600"/>Assinados</div><p className="mt-2 text-3xl font-black text-emerald-700">{anamneses.filter(i => i.assinado_em).length + evolucoes.filter(i => i.assinado_em).length}</p><p className="mt-1 text-xs text-slate-500">Registros bloqueados após assinatura.</p></div>
    </section>

    {alergias.length ? <section className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 p-4"><div className="flex items-start gap-3"><AlertTriangle className="mt-0.5 size-5 text-rose-600"/><div><h2 className="font-black text-rose-900">ALERGIA REGISTRADA</h2><div className="mt-2 flex flex-wrap gap-2">{alergias.map(a => <span key={a.id} className="rounded-full bg-white px-3 py-1.5 text-xs font-bold text-rose-700 shadow-sm">{a.substancia}{a.reacao ? ` · ${a.reacao}` : ""}{a.gravidade ? ` · ${a.gravidade}` : ""}</span>)}</div></div></div></section> : null}

    <div className="mt-6 grid gap-6 xl:grid-cols-[1.35fr_.65fr]">
      <section className="his-card p-5 sm:p-6">
        <div className="flex items-center gap-3"><span className="grid size-11 place-items-center rounded-2xl bg-brand-50 text-brand-700"><ClipboardCheck className="size-5"/></span><div><h2 className="font-black text-slate-900">Anamnese estruturada</h2><p className="text-sm text-slate-500">História clínica, revisão de sistemas, exame físico e conduta inicial. As alterações são salvas automaticamente enquanto você digita.</p></div></div>
        <ClinicalAutosaveForm tipo="anamnese" atendimentoId={atendimentoId} registroId={anamneseRascunho?.id ?? null} className="mt-5 space-y-4">
          <Field label="Queixa principal"><textarea name="queixa_principal" rows={2} className="ui-input" required defaultValue={anamneseRascunho?.queixa_principal ?? ""}/></Field>
          <Field label="História da doença atual"><textarea name="historia_doenca_atual" rows={4} className="ui-input" defaultValue={anamneseRascunho?.historia_doenca_atual ?? ""}/></Field>
          <div className="grid gap-4 md:grid-cols-2"><Field label="Antecedentes pessoais"><textarea name="antecedentes_pessoais" rows={3} className="ui-input" defaultValue={anamneseRascunho?.antecedentes_pessoais ?? ""}/></Field><Field label="Antecedentes familiares"><textarea name="antecedentes_familiares" rows={3} className="ui-input" defaultValue={anamneseRascunho?.antecedentes_familiares ?? ""}/></Field></div>
          <div className="grid gap-4 md:grid-cols-2"><Field label="Hábitos de vida"><textarea name="habitos_vida" rows={3} className="ui-input" defaultValue={anamneseRascunho?.habitos_vida ?? ""}/></Field><Field label="Medicações em uso"><textarea name="medicacoes_uso" rows={3} className="ui-input" defaultValue={anamneseRascunho?.medicacoes_uso ?? ""}/></Field></div>
          <div><p className="mb-2 text-sm font-bold text-slate-700">Revisão de sistemas</p><div className="grid gap-3 md:grid-cols-2"><input name="rs_cardio" className="ui-input" placeholder="Cardiovascular" defaultValue={valorJson(revisaoRascunho.cardiovascular) ?? ""}/><input name="rs_resp" className="ui-input" placeholder="Respiratório" defaultValue={valorJson(revisaoRascunho.respiratorio) ?? ""}/><input name="rs_gastro" className="ui-input" placeholder="Gastrointestinal" defaultValue={valorJson(revisaoRascunho.gastrointestinal) ?? ""}/><input name="rs_genito" className="ui-input" placeholder="Geniturinário" defaultValue={valorJson(revisaoRascunho.geniturinario) ?? ""}/><input name="rs_neuro" className="ui-input" placeholder="Neurológico" defaultValue={valorJson(revisaoRascunho.neurologico) ?? ""}/><input name="rs_musculo" className="ui-input" placeholder="Musculoesquelético" defaultValue={valorJson(revisaoRascunho.musculoesqueletico) ?? ""}/><input name="rs_pele" className="ui-input md:col-span-2" placeholder="Pele e anexos" defaultValue={valorJson(revisaoRascunho.pele) ?? ""}/></div></div>
          <Field label="Exame físico geral"><textarea name="exame_fisico_geral" rows={4} className="ui-input" defaultValue={anamneseRascunho?.exame_fisico_geral ?? ""}/></Field>
          <div className="grid gap-4 md:grid-cols-2"><Field label="Hipótese diagnóstica"><textarea name="hipotese_diagnostica" rows={3} className="ui-input" defaultValue={anamneseRascunho?.hipotese_diagnostica ?? ""}/></Field><Field label="Conduta inicial"><textarea name="conduta_inicial" rows={3} className="ui-input" defaultValue={anamneseRascunho?.conduta_inicial ?? ""}/></Field></div>
          <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4"><button name="acao" value="salvar" className="btn-secondary">Salvar rascunho</button><button name="acao" value="assinar" className="ui-button-primary"><ShieldCheck className="size-4"/>Salvar e assinar</button></div>
        </ClinicalAutosaveForm>
      </section>

      <aside className="space-y-5">
        <section className="his-card p-5"><h2 className="font-black text-slate-900">Alergias</h2><form action={adicionarAlergia} className="mt-4 space-y-3"><input type="hidden" name="atendimento_id" value={atendimentoId}/><input name="substancia" required className="ui-input" placeholder="Substância / medicamento"/><div className="grid grid-cols-2 gap-2"><select name="tipo" className="ui-input" defaultValue="medicamento"><option value="medicamento">Medicamento</option><option value="alimento">Alimento</option><option value="material">Material</option><option value="outro">Outro</option></select><select name="gravidade" className="ui-input" defaultValue=""><option value="">Gravidade</option><option value="leve">Leve</option><option value="moderada">Moderada</option><option value="grave">Grave</option><option value="anafilaxia">Anafilaxia</option></select></div><input name="reacao" className="ui-input" placeholder="Reação observada"/><textarea name="observacoes" rows={2} className="ui-input" placeholder="Observações"/><button className="ui-button-primary w-full">Adicionar alergia</button></form></section>

        <section className="his-card p-5"><h2 className="font-black text-slate-900">Lista de problemas</h2><form action={adicionarProblema} className="mt-4 space-y-3"><input type="hidden" name="atendimento_id" value={atendimentoId}/><input name="descricao" required className="ui-input" placeholder="Problema clínico"/><input name="cid10" className="ui-input" placeholder="CID-10"/><label className="flex items-center gap-2 text-sm font-medium text-slate-600"><input type="checkbox" name="principal"/>Problema principal</label><textarea name="observacoes" rows={2} className="ui-input" placeholder="Observações"/><button className="btn-secondary w-full">Adicionar problema</button></form>{problemas.length ? <div className="mt-4 space-y-2">{problemas.map(p => <div key={p.id} className="rounded-xl bg-slate-50 p-3 text-sm"><div className="flex items-center justify-between gap-2"><strong className="text-slate-800">{p.descricao}</strong>{p.principal ? <span className="rounded-full bg-brand-100 px-2 py-0.5 text-[10px] font-bold text-brand-700">Principal</span> : null}</div><p className="mt-1 text-xs text-slate-500">{p.cid10 || "Sem CID"}</p></div>)}</div> : null}</section>
      </aside>
    </div>

    <section className="his-card mt-6 p-5 sm:p-6">
      <div className="flex items-center gap-3"><span className="grid size-11 place-items-center rounded-2xl bg-violet-50 text-violet-700"><Stethoscope className="size-5"/></span><div><h2 className="font-black text-slate-900">Diagnósticos / CID</h2><p className="text-sm text-slate-500">Registre hipóteses, diagnósticos confirmados e diagnóstico principal.</p></div></div>
      <form action={adicionarDiagnostico} className="mt-4 grid gap-3 lg:grid-cols-[140px_1fr_180px_auto_auto_auto]"><input type="hidden" name="atendimento_id" value={atendimentoId}/><input name="cid10" className="ui-input" placeholder="CID-10"/><input name="descricao" required className="ui-input" placeholder="Descrição do diagnóstico"/><select name="tipo" className="ui-input"><option value="hipotese">Hipótese</option><option value="diagnostico">Diagnóstico</option><option value="comorbidade">Comorbidade</option></select><label className="flex items-center gap-2 text-sm"><input type="checkbox" name="principal"/>Principal</label><label className="flex items-center gap-2 text-sm"><input type="checkbox" name="confirmado"/>Confirmado</label><button className="ui-button-primary">Adicionar</button></form>
      {diagnosticos.length ? <div className="mt-4 grid gap-2 md:grid-cols-2">{diagnosticos.map(d => { const prof=one(d.profissional); return <div key={d.id} className="rounded-xl border border-slate-200 p-3"><div className="flex flex-wrap items-center gap-2"><strong className="text-sm text-slate-900">{d.cid10 || "CID —"} · {d.descricao}</strong>{d.principal ? <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-bold text-brand-700">Principal</span> : null}{d.confirmado ? <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">Confirmado</span> : null}</div><p className="mt-1 text-xs text-slate-400">{d.tipo} · {prof?.nome_completo ?? "Profissional"}</p></div>})}</div> : null}
    </section>

    <section className="his-card mt-6 p-5 sm:p-6">
      <div className="flex items-center gap-3"><span className="grid size-11 place-items-center rounded-2xl bg-amber-50 text-amber-700"><Scale className="size-5"/></span><div><h2 className="font-black text-slate-900">Escalas clínicas</h2><p className="text-sm text-slate-500">Glasgow, Braden, Morse, MEWS, NEWS2, dor e outras escalas institucionais.</p></div></div>
      <form action={registrarEscala} className="mt-4 grid gap-3 lg:grid-cols-[200px_120px_220px_1fr_auto]"><input type="hidden" name="atendimento_id" value={atendimentoId}/><input name="escala" required className="ui-input" placeholder="Ex.: Glasgow"/><input name="pontuacao" type="number" step="0.01" className="ui-input" placeholder="Pontos"/><input name="classificacao" className="ui-input" placeholder="Classificação"/><input name="observacoes" className="ui-input" placeholder="Observações"/><button className="btn-secondary">Registrar</button></form>
      {escalas.length ? <div className="mt-4 flex flex-wrap gap-2">{escalas.map(e => <span key={e.id} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700">{e.escala}: {e.pontuacao ?? "—"} · {e.classificacao || "sem classificação"}</span>)}</div> : null}
    </section>

    <section className="his-card mt-6 p-5 sm:p-6">
      <div className="flex items-center gap-3"><span className="grid size-11 place-items-center rounded-2xl bg-emerald-50 text-emerald-700"><HeartPulse className="size-5"/></span><div><h2 className="font-black text-slate-900">Evolução SOAP + exame físico + conduta</h2><p className="text-sm text-slate-500">Registro evolutivo com autosave, assinatura e bloqueio do conteúdo assinado.</p></div></div>
      <ClinicalAutosaveForm tipo="soap" atendimentoId={atendimentoId} registroId={soapRascunho?.id ?? null} className="mt-5 space-y-4">
        <div className="grid gap-4 md:grid-cols-2"><Field label="S · Subjetivo"><textarea name="subjetivo" rows={4} className="ui-input" defaultValue={soapRascunho?.subjetivo ?? ""}/></Field><Field label="O · Objetivo"><textarea name="objetivo" rows={4} className="ui-input" defaultValue={soapRascunho?.objetivo ?? ""}/></Field><Field label="A · Avaliação"><textarea name="avaliacao" rows={4} className="ui-input" defaultValue={soapRascunho?.avaliacao ?? ""}/></Field><Field label="P · Plano"><textarea name="plano" rows={4} className="ui-input" defaultValue={soapRascunho?.plano ?? ""}/></Field></div>
        <div className="grid gap-4 md:grid-cols-2"><Field label="Exame físico"><textarea name="exame_fisico" rows={4} className="ui-input" defaultValue={soapRascunho?.exame_fisico ?? ""}/></Field><Field label="Conduta"><textarea name="conduta" rows={4} className="ui-input" defaultValue={soapRascunho?.conduta ?? ""}/></Field></div>
        <div className="grid gap-4 md:grid-cols-2"><input name="cid10" className="ui-input" placeholder="CID-10 relacionado" defaultValue={valorJson(soapEstruturado.cid10) ?? ""}/><input name="retorno" className="ui-input" placeholder="Retorno / reavaliação" defaultValue={valorJson(soapEstruturado.retorno) ?? ""}/></div>
        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4"><button name="acao" value="salvar" className="btn-secondary">Salvar rascunho</button><button name="acao" value="assinar" className="ui-button-primary"><ShieldCheck className="size-4"/>Salvar e assinar</button></div>
      </ClinicalAutosaveForm>
    </section>

    <section className="his-card mt-6 p-5 sm:p-6">
      <div><h2 className="font-black text-slate-900">Histórico clínico deste atendimento</h2><p className="mt-1 text-sm text-slate-500">Clique em qualquer registro para visualizar integralmente o que foi lançado, sem sair do atendimento aberto.</p></div>
      {historicoItens.length ? <HistoricoClinicoModal itens={historicoItens}/> : <Empty text="Nenhuma anamnese ou evolução registrada neste atendimento."/>}
    </section>
  </SectionPage>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block"><span className="mb-1.5 block text-sm font-bold text-slate-700">{label}</span>{children}</label>; }
function Empty({ text }: { text: string }) { return <p className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-500">{text}</p>; }
