import Link from "next/link";
import { Clock3, Database, Printer, ShieldCheck, UserRoundCheck } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { PrescricaoDinamicaForm } from "@/components/prontuario/prescricao-dinamica-form";
import { SectionPage } from "@/components/painel/section-page";
import { requireAnyPermission } from "@/lib/permissions/server";
import { finalizarPrescricaoDiaAction } from "@/modules/prontuario-medico/prescricao-dia-actions";
import { suspenderPrescricaoMedica } from "@/modules/prontuario-medico/prescricao-actions";

type Rel<T> = T | T[] | null;
function one<T>(value: Rel<T>): T | null { return Array.isArray(value) ? value[0] ?? null : value; }
function fmtData(value: string | null | undefined) {
  return value ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(value)) : "—";
}

type Aba = "medicamentos" | "exames" | "procedimentos" | "materiais" | "revisao";
const ABAS = new Set<Aba>(["medicamentos", "exames", "procedimentos", "materiais", "revisao"]);

const errorMessages: Record<string, string> = {
  campos: "Preencha os campos obrigatórios da prescrição.",
  catalogo: "Selecione um item ativo do catálogo assistencial.",
  categoria: "Este item não pertence à aba selecionada.",
  atendimento: "O atendimento não está ativo nesta unidade.",
  profissional: "Seu usuário não está vinculado a um profissional clínico ativo.",
  salvar: "Não foi possível adicionar o item ao rascunho.",
  prescricao: "A prescrição não pertence a este atendimento.",
  assinatura: "Não foi possível finalizar a prescrição.",
  suspensao: "Não foi possível suspender a prescrição.",
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function PrescricaoMedicaPage({ params, searchParams }: {
  params: Promise<{ atendimentoId: string }>;
  searchParams: Promise<{ sucesso?: string; erro?: string; aviso?: string; aba?: string; resumo?: string }>;
}) {
  const { atendimentoId } = await params;
  const sp = await searchParams;
  const abaInicial: Aba = ABAS.has(sp.aba as Aba) ? sp.aba as Aba : "medicamentos";
  const { supabase, user, empresaId, unidadeId } = await requireAnyPermission(["prescricao.visualizar", "prontuario.visualizar"]);
  if (!unidadeId) redirect("/painel?erro=unidade");

  const { data: atendimento } = await supabase.from("atendimentos")
    .select("id,numero_atendimento,status,paciente_id,paciente:pacientes(nome_completo,ra,numero_registro,cpf,cns)")
    .eq("id", atendimentoId).eq("empresa_id", empresaId).eq("unidade_id", unidadeId).maybeSingle();
  if (!atendimento) notFound();
  const paciente = one(atendimento.paciente);

  const permissionCodes = ["prescricao.criar", "prescricao.assinar", "prescricao.suspender"] as const;
  const [prescricoesRes, componentesRes, profissionalUsuarioRes, permissoes, examesRascunhoRes, procedimentosRascunhoRes, materiaisRascunhoRes] = await Promise.all([
    supabase.from("prescricoes")
      .select("id,tipo,item,item_assistencial_id,quantidade,unidade_dose,dose,via,frequencia,duracao,horarios,instrucoes,orientacoes,se_necessario,status,assinado_em,suspenso_em,created_at,created_by,profissional_id,profissional:profissionais(nome_completo)")
      .eq("atendimento_id", atendimentoId).eq("empresa_id", empresaId).eq("unidade_id", unidadeId).order("created_at", { ascending: false }).limit(150),
    supabase.from("prescricao_componentes")
      .select("id,prescricao_id,dose,quantidade,unidade_dose,ordem,observacoes,item:itens_assistenciais(descricao,concentracao,apresentacao)")
      .eq("atendimento_id", atendimentoId).eq("empresa_id", empresaId).eq("unidade_id", unidadeId).order("ordem"),
    supabase.from("profissionais").select("id,nome_completo,especialidade").eq("empresa_id", empresaId).eq("usuario_id", user.id).eq("ativo", true).limit(1).maybeSingle(),
    Promise.all(permissionCodes.map((codigo) => supabase.rpc("tem_permissao", { p_empresa: empresaId, p_unidade: unidadeId, p_codigo: codigo }))),
    supabase.from("solicitacoes_exames").select("id,modalidade,exame,codigo_tuss,indicacao_clinica,prioridade,created_at,profissional_id,created_by").eq("atendimento_id", atendimentoId).eq("empresa_id", empresaId).eq("unidade_id", unidadeId).eq("status", "rascunho").eq("created_by", user.id).order("created_at"),
    supabase.from("procedimentos_assistenciais").select("id,procedimento,codigo_tuss,quantidade,unidade_medida,lateralidade,resultado,created_at,profissional_id,created_by").eq("atendimento_id", atendimentoId).eq("empresa_id", empresaId).eq("unidade_id", unidadeId).eq("status", "rascunho").eq("created_by", user.id).order("created_at"),
    supabase.from("solicitacoes_materiais_assistenciais").select("id,descricao,categoria,quantidade,unidade_medida,observacoes,created_at,profissional_id,created_by").eq("atendimento_id", atendimentoId).eq("empresa_id", empresaId).eq("unidade_id", unidadeId).eq("status", "rascunho").eq("created_by", user.id).order("created_at"),
  ]);

  let profissional = profissionalUsuarioRes.data;
  if (!profissional && user.email) {
    profissional = (await supabase.from("profissionais").select("id,nome_completo,especialidade").eq("empresa_id", empresaId).ilike("email", user.email).eq("ativo", true).limit(1).maybeSingle()).data;
  }

  const canCreate = permissoes[0]?.data === true && !permissoes[0]?.error;
  const canSign = permissoes[1]?.data === true && !permissoes[1]?.error;
  const canSuspend = permissoes[2]?.data === true && !permissoes[2]?.error;
  const prescricoes = prescricoesRes.data ?? [];
  const medicamentosRascunho = prescricoes.filter((item) => item.status === "rascunho" && item.created_by === user.id && (!profissional || item.profissional_id === profissional.id));
  const examesRascunho = (examesRascunhoRes.data ?? []).filter((item) => !profissional || item.profissional_id === profissional.id);
  const procedimentosRascunho = (procedimentosRascunhoRes.data ?? []).filter((item) => !profissional || item.profissional_id === profissional.id);
  const materiaisRascunho = (materiaisRascunhoRes.data ?? []).filter((item) => !profissional || item.profissional_id === profissional.id);
  const totalRascunho = medicamentosRascunho.length + examesRascunho.length + procedimentosRascunho.length + materiaisRascunho.length;
  const componentes = (componentesRes.data ?? []) as unknown as Array<{ id:string; prescricao_id:string; dose:string|null; quantidade:number|null; unidade_dose:string|null; ordem:number; observacoes:string|null; item:{descricao:string;concentracao:string|null;apresentacao:string|null}|Array<{descricao:string;concentracao:string|null;apresentacao:string|null}>|null }>;

  const contadores = {
    medicamentos: medicamentosRascunho.length,
    exames: examesRascunho.length,
    procedimentos: procedimentosRascunho.length,
    materiais: materiaisRascunho.length,
    revisao: totalRascunho,
  };

  const revisao = <section className="space-y-4">
    <div className="rounded-2xl border border-brand-100 bg-brand-50 p-4">
      <h3 className="font-black text-brand-950">Revisão da prescrição do dia</h3>
      <p className="mt-1 text-sm text-brand-800">Nada abaixo foi enviado aos setores ainda. Revise todos os itens e finalize somente quando a prescrição estiver completa.</p>
    </div>
    {totalRascunho === 0 ? <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">Nenhum item no rascunho atual.</div> : <div className="space-y-3">
      {medicamentosRascunho.map((item) => {
        const comps = componentes.filter((c) => c.prescricao_id === item.id);
        return <article key={`m-${item.id}`} className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-4"><p className="text-xs font-black uppercase text-emerald-700">Medicamento / solução</p><p className="mt-1 font-black text-slate-950">{item.item}</p><p className="mt-1 text-sm text-slate-600">{[item.dose,item.via,item.frequencia].filter(Boolean).join(" · ")}</p>{Array.isArray(item.horarios) && item.horarios.length ? <p className="mt-1 text-xs font-bold text-emerald-700">Horários: {item.horarios.join(", ")}</p> : null}{comps.map((comp) => { const ci = one(comp.item); return <p key={comp.id} className="mt-1 text-sm text-emerald-950">+ {ci?.descricao ?? "Componente"}{comp.dose ? ` · ${comp.dose}` : ""}</p>; })}</article>;
      })}
      {examesRascunho.map((item) => <article key={`e-${item.id}`} className="rounded-xl border border-violet-100 bg-violet-50/40 p-4"><p className="text-xs font-black uppercase text-violet-700">Exame · {item.modalidade}</p><p className="mt-1 font-black">{item.exame}</p><p className="mt-1 text-sm text-slate-600">Prioridade: {item.prioridade}{item.indicacao_clinica ? ` · ${item.indicacao_clinica}` : ""}</p></article>)}
      {procedimentosRascunho.map((item) => <article key={`p-${item.id}`} className="rounded-xl border border-amber-100 bg-amber-50/40 p-4"><p className="text-xs font-black uppercase text-amber-700">Procedimento</p><p className="mt-1 font-black">{item.procedimento}</p><p className="mt-1 text-sm text-slate-600">{item.quantidade} {item.unidade_medida}{item.lateralidade ? ` · ${item.lateralidade}` : ""}</p></article>)}
      {materiaisRascunho.map((item) => <article key={`mat-${item.id}`} className="rounded-xl border border-sky-100 bg-sky-50/40 p-4"><p className="text-xs font-black uppercase text-sky-700">{item.categoria}</p><p className="mt-1 font-black">{item.descricao}</p><p className="mt-1 text-sm text-slate-600">{item.quantidade} {item.unidade_medida ?? "UN"}{item.observacoes ? ` · ${item.observacoes}` : ""}</p></article>)}
    </div>}
    {canSign && totalRascunho > 0 ? <form action={finalizarPrescricaoDiaAction} className="flex justify-end"><input type="hidden" name="atendimento_id" value={atendimentoId}/><button className="ui-button-primary px-6 py-3"><ShieldCheck className="size-4"/>Finalizar e assinar prescrição do dia ({totalRascunho})</button></form> : null}
  </section>;

  return <SectionPage eyebrow="Assistencial / Atendimento médico / Prescrição" title={paciente?.nome_completo ?? "Paciente"} description={`Atendimento #${atendimento.numero_atendimento ?? "—"} · Registro #${paciente?.numero_registro ?? "—"} · ${paciente?.ra ?? "—"}`}>
    {sp.sucesso ? <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">{sp.sucesso === "finalizada" ? "Prescrição do dia finalizada, assinada e liberada para os setores." : sp.sucesso === "item_adicionado" ? "Item adicionado ao rascunho da prescrição do dia." : sp.sucesso === "suspensa" ? "Prescrição suspensa." : "Operação concluída."}</div> : null}
    {sp.erro ? <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{errorMessages[sp.erro] ?? decodeURIComponent(sp.erro)}</div> : null}

    <section className="grid gap-3 md:grid-cols-4">
      <div className="his-kpi"><p className="text-xs font-bold uppercase text-slate-400">Paciente</p><p className="mt-2 font-black text-slate-950">{paciente?.nome_completo ?? "Paciente"}</p><p className="mt-1 text-xs text-slate-500">RA {paciente?.ra ?? "—"}</p></div>
      <div className="his-kpi"><p className="text-xs font-bold uppercase text-slate-400">Rascunho do dia</p><p className="mt-2 text-3xl font-black text-amber-700">{totalRascunho}</p></div>
      <div className="his-kpi"><p className="text-xs font-bold uppercase text-slate-400">Prescrições ativas</p><p className="mt-2 text-3xl font-black text-emerald-700">{prescricoes.filter((i) => i.status === "ativa").length}</p></div>
      <div className="his-kpi"><p className="text-xs font-bold uppercase text-slate-400">Suspensas</p><p className="mt-2 text-3xl font-black text-slate-700">{prescricoes.filter((i) => i.status === "suspensa").length}</p></div>
    </section>

    {!profissional ? <section className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-5"><div className="flex items-start gap-3"><UserRoundCheck className="mt-0.5 size-5 text-amber-700"/><div><h2 className="font-black text-amber-950">Usuário sem vínculo profissional</h2><p className="mt-1 text-sm text-amber-800">Prescrição bloqueada até este login estar vinculado a um profissional clínico ativo.</p></div></div></section> : <section className="mt-5 rounded-2xl border border-brand-100 bg-brand-50/60 p-4"><div className="flex items-center gap-3"><ShieldCheck className="size-5 text-brand-700"/><div><p className="font-black text-brand-950">Prescritor: {profissional.nome_completo}</p><p className="text-sm text-brand-700">{profissional.especialidade || "Especialidade não informada"} · obtido automaticamente do login.</p></div></div></section>}

    {profissional && canCreate ? <section className="his-card mt-5 p-5 sm:p-6"><div className="flex items-center gap-2"><Database className="size-5 text-brand-700"/><div><h2 className="font-black text-slate-900">Prescrição do dia</h2><p className="text-sm text-slate-500">Inclua vários itens nas abas e finalize tudo de uma única vez na aba Revisão.</p></div></div><PrescricaoDinamicaForm empresaId={empresaId} atendimentoId={atendimentoId} abaInicial={abaInicial} contadores={contadores} revisao={revisao}/></section> : null}

    <section className="mt-6 space-y-3">
      <div><h2 className="text-lg font-black text-slate-950">Prescrições finalizadas do episódio</h2><p className="text-sm text-slate-500">Itens assinados ficam disponíveis para visualização, impressão e execução pelos setores.</p></div>
      {prescricoes.filter((item) => item.status !== "rascunho").length ? prescricoes.filter((item) => item.status !== "rascunho").map((item) => {
        const prof = one(item.profissional); const comps = componentes.filter((c) => c.prescricao_id === item.id); const horarios = Array.isArray(item.horarios) ? item.horarios.join(", ") : "";
        return <article key={item.id} className="ui-card p-4 sm:p-5"><div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-black uppercase text-slate-600">{item.tipo}</span><span className={`rounded-full px-2.5 py-1 text-xs font-black ${item.status === "ativa" ? "bg-emerald-100 text-emerald-800" : item.status === "suspensa" ? "bg-rose-100 text-rose-800" : "bg-slate-100 text-slate-700"}`}>{item.status}</span></div><h3 className="mt-2 font-black text-slate-950">{item.item}</h3><p className="mt-1 text-sm text-slate-600">{[item.dose,item.via,item.frequencia,item.duracao].filter(Boolean).join(" · ") || "Sem posologia complementar"}</p>{horarios ? <p className="mt-1 text-xs font-semibold text-brand-700">Horários: {horarios}</p> : null}{comps.length ? <div className="mt-3 rounded-xl bg-emerald-50 p-3">{comps.map((comp) => { const ci=one(comp.item); return <p key={comp.id} className="mt-1 text-sm text-emerald-950">+ {ci?.descricao ?? "Componente"}{comp.dose ? ` · ${comp.dose}` : ""}</p>; })}</div> : null}<p className="mt-2 flex items-center gap-1.5 text-xs text-slate-400"><Clock3 className="size-3.5"/>{fmtData(item.created_at)} · {prof?.nome_completo ?? "Profissional"}</p></div><div className="flex flex-wrap gap-2">{item.assinado_em ? <Link className="btn-secondary" href={`/prontuario/${atendimentoId}/prescricao/${item.id}/imprimir`}><Printer className="size-4"/>Visualizar / imprimir</Link> : null}{item.status === "ativa" && canSuspend ? <form action={suspenderPrescricaoMedica}><input type="hidden" name="atendimento_id" value={atendimentoId}/><input type="hidden" name="prescricao_id" value={item.id}/><input type="hidden" name="motivo" value="Suspensa pelo prescritor"/><button className="btn-secondary">Suspender</button></form> : null}</div></div></article>;
      }) : <div className="his-card p-8 text-center text-sm text-slate-500">Nenhuma prescrição finalizada neste atendimento.</div>}
    </section>
  </SectionPage>;
}
