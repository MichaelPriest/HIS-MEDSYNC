import Link from "next/link";
import { AlertTriangle, Clock3, Database, History, Printer, ShieldCheck, UserRoundCheck } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { PrescricaoDinamicaForm } from "@/components/prontuario/prescricao-dinamica-form";
import { SectionPage } from "@/components/painel/section-page";
import { requireAnyPermission } from "@/lib/permissions/server";
import { finalizarPrescricaoDiaAction } from "@/modules/prontuario-medico/prescricao-dia-actions";
import { suspenderPrescricaoMedica } from "@/modules/prontuario-medico/prescricao-actions";

type Rel<T> = T | T[] | null;
function one<T>(value: Rel<T>): T | null { return Array.isArray(value) ? value[0] ?? null : value; }
function fmtData(value: string | null | undefined) { return value ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(value)) : "—"; }
function idade(data: string | null | undefined) { if (!data) return null; const hoje=new Date(); const nasc=new Date(`${data}T12:00:00`); let anos=hoje.getFullYear()-nasc.getFullYear(); if (hoje.getMonth()<nasc.getMonth() || (hoje.getMonth()===nasc.getMonth() && hoje.getDate()<nasc.getDate())) anos--; return anos; }
function diaKey(value: string | null | undefined) { if (!value) return ""; return new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo" }).format(new Date(value)); }

type Aba = "dieta" | "medicamentos" | "cuidados" | "exames" | "procedimentos" | "materiais" | "revisao";
const ABAS = new Set<Aba>(["dieta","medicamentos","cuidados","exames","procedimentos","materiais","revisao"]);
const errorMessages: Record<string,string> = { campos:"Preencha os campos obrigatórios da prescrição.",catalogo:"Selecione um item ativo do catálogo assistencial.",categoria:"Este item não pertence à aba selecionada.",atendimento:"O atendimento não está ativo nesta unidade.",profissional:"Seu usuário não está vinculado a um profissional clínico ativo.",salvar:"Não foi possível adicionar o item ao rascunho.",prescricao:"A prescrição não pertence a este atendimento.",assinatura:"Não foi possível finalizar a prescrição.",suspensao:"Não foi possível suspender a prescrição." };

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function PrescricaoMedicaPage({ params, searchParams }: { params: Promise<{ atendimentoId:string }>; searchParams: Promise<{ sucesso?:string; erro?:string; aviso?:string; aba?:string; resumo?:string }> }) {
  const { atendimentoId } = await params;
  const sp = await searchParams;
  const abaInicial: Aba = ABAS.has(sp.aba as Aba) ? sp.aba as Aba : "medicamentos";
  const { supabase,user,empresaId,unidadeId } = await requireAnyPermission(["prescricao.visualizar","prontuario.visualizar"]);
  if (!unidadeId) redirect("/painel?erro=unidade");

  const { data: atendimento } = await supabase.from("atendimentos").select("id,numero_atendimento,status,paciente_id,paciente:pacientes(nome_completo,ra,numero_registro,cpf,cns,rg,data_nascimento,sexo)").eq("id",atendimentoId).eq("empresa_id",empresaId).eq("unidade_id",unidadeId).maybeSingle();
  if (!atendimento) notFound();
  const paciente = one(atendimento.paciente);

  const permissionCodes=["prescricao.criar","prescricao.assinar","prescricao.suspender"] as const;
  const [prescricoesRes,componentesRes,profissionalUsuarioRes,permissoes,examesRascunhoRes,procedimentosRascunhoRes,materiaisRascunhoRes,alergiasRes,internacaoRes] = await Promise.all([
    supabase.from("prescricoes").select("id,tipo,item,item_assistencial_id,quantidade,unidade_dose,dose,via,frequencia,duracao,horarios,instrucoes,orientacoes,se_necessario,status,assinado_em,suspenso_em,created_at,created_by,profissional_id,profissional:profissionais(nome_completo)").eq("atendimento_id",atendimentoId).eq("empresa_id",empresaId).eq("unidade_id",unidadeId).order("created_at",{ascending:false}).limit(200),
    supabase.from("prescricao_componentes").select("id,prescricao_id,dose,quantidade,unidade_dose,ordem,observacoes,item:itens_assistenciais(descricao,concentracao,apresentacao)").eq("atendimento_id",atendimentoId).eq("empresa_id",empresaId).eq("unidade_id",unidadeId).order("ordem"),
    supabase.from("profissionais").select("id,nome_completo,especialidade").eq("empresa_id",empresaId).eq("usuario_id",user.id).eq("ativo",true).limit(1).maybeSingle(),
    Promise.all(permissionCodes.map((codigo)=>supabase.rpc("tem_permissao",{p_empresa:empresaId,p_unidade:unidadeId,p_codigo:codigo}))),
    supabase.from("solicitacoes_exames").select("id,modalidade,exame,codigo_tuss,indicacao_clinica,prioridade,created_at,profissional_id,created_by").eq("atendimento_id",atendimentoId).eq("empresa_id",empresaId).eq("unidade_id",unidadeId).eq("status","rascunho").eq("created_by",user.id).order("created_at"),
    supabase.from("procedimentos_assistenciais").select("id,procedimento,codigo_tuss,quantidade,unidade_medida,lateralidade,resultado,created_at,profissional_id,created_by").eq("atendimento_id",atendimentoId).eq("empresa_id",empresaId).eq("unidade_id",unidadeId).eq("status","rascunho").eq("created_by",user.id).order("created_at"),
    supabase.from("solicitacoes_materiais_assistenciais").select("id,descricao,categoria,quantidade,unidade_medida,observacoes,created_at,profissional_id,created_by").eq("atendimento_id",atendimentoId).eq("empresa_id",empresaId).eq("unidade_id",unidadeId).eq("status","rascunho").eq("created_by",user.id).order("created_at"),
    supabase.from("paciente_alergias").select("id,substancia,reacao,gravidade,status").eq("empresa_id",empresaId).eq("paciente_id",atendimento.paciente_id).order("created_at",{ascending:false}),
    supabase.from("internacoes").select("id,setor,quarto,leito,acomodacao,data_internacao,status").eq("atendimento_id",atendimentoId).eq("empresa_id",empresaId).eq("unidade_id",unidadeId).is("data_alta",null).order("data_internacao",{ascending:false}).limit(1).maybeSingle(),
  ]);

  let profissional=profissionalUsuarioRes.data;
  if (!profissional && user.email) profissional=(await supabase.from("profissionais").select("id,nome_completo,especialidade").eq("empresa_id",empresaId).ilike("email",user.email).eq("ativo",true).limit(1).maybeSingle()).data;
  const canCreate=permissoes[0]?.data===true&&!permissoes[0]?.error, canSign=permissoes[1]?.data===true&&!permissoes[1]?.error, canSuspend=permissoes[2]?.data===true&&!permissoes[2]?.error;
  const prescricoes=prescricoesRes.data??[];
  const rascunhos=prescricoes.filter((i)=>i.status==="rascunho"&&i.created_by===user.id&&(!profissional||i.profissional_id===profissional.id));
  const dietasRascunho=rascunhos.filter((i)=>i.tipo==="dieta"), medicamentosRascunho=rascunhos.filter((i)=>i.tipo==="medicamento"), cuidadosRascunho=rascunhos.filter((i)=>i.tipo==="cuidado");
  const examesRascunho=(examesRascunhoRes.data??[]).filter((i)=>!profissional||i.profissional_id===profissional.id);
  const procedimentosRascunho=(procedimentosRascunhoRes.data??[]).filter((i)=>!profissional||i.profissional_id===profissional.id);
  const materiaisRascunho=(materiaisRascunhoRes.data??[]).filter((i)=>!profissional||i.profissional_id===profissional.id);
  const totalRascunho=rascunhos.length+examesRascunho.length+procedimentosRascunho.length+materiaisRascunho.length;
  const componentes=(componentesRes.data??[]) as unknown as Array<{id:string;prescricao_id:string;dose:string|null;quantidade:number|null;unidade_dose:string|null;ordem:number;observacoes:string|null;item:{descricao:string;concentracao:string|null;apresentacao:string|null}|Array<{descricao:string;concentracao:string|null;apresentacao:string|null}>|null}>;
  const alergias=(alergiasRes.data??[]).filter((a)=>!a.status||!["inativa","cancelada","resolvida"].includes(String(a.status).toLowerCase()));
  const internacao=internacaoRes.data;
  const idadePaciente=idade(paciente?.data_nascimento);
  const contadores={dieta:dietasRascunho.length,medicamentos:medicamentosRascunho.length,cuidados:cuidadosRascunho.length,exames:examesRascunho.length,procedimentos:procedimentosRascunho.length,materiais:materiaisRascunho.length,revisao:totalRascunho};

  const finalizadas=prescricoes.filter((i)=>i.status!=="rascunho");
  const historico=[...new Map(finalizadas.map((i)=>[diaKey(i.assinado_em??i.created_at),i])).entries()].slice(0,10);

  const revisao=<section className="space-y-4"><div className="rounded-2xl border border-brand-100 bg-brand-50 p-4"><h3 className="font-black text-brand-950">Revisão da prescrição do dia</h3><p className="mt-1 text-sm text-brand-800">Nada abaixo foi enviado aos setores ainda. Revise todos os itens antes da assinatura.</p></div>
    {totalRascunho===0?<div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">Nenhum item no rascunho atual.</div>:<div className="space-y-3">
      {dietasRascunho.map((i)=><article key={i.id} className="rounded-xl border border-cyan-100 bg-cyan-50/40 p-4"><p className="text-xs font-black uppercase text-cyan-700">Dieta / hidratação</p><p className="mt-1 font-black">{i.item}</p>{i.instrucoes?<p className="mt-1 text-sm text-slate-600">{i.instrucoes}</p>:null}</article>)}
      {medicamentosRascunho.map((i)=>{const comps=componentes.filter((c)=>c.prescricao_id===i.id);return <article key={i.id} className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-4"><p className="text-xs font-black uppercase text-emerald-700">Medicamento / solução</p><p className="mt-1 font-black">{i.item}</p><p className="mt-1 text-sm text-slate-600">{[i.dose,i.unidade_dose,i.via,i.frequencia].filter(Boolean).join(" · ")}</p>{Array.isArray(i.horarios)&&i.horarios.length?<p className="mt-1 text-xs font-bold text-emerald-700">Horários: {i.horarios.join(", ")}</p>:null}{comps.map((c)=>{const ci=one(c.item);return <p key={c.id} className="mt-1 text-sm text-emerald-950">+ {ci?.descricao??"Componente"}{c.dose?` · ${c.dose}`:""}</p>})}</article>})}
      {cuidadosRascunho.map((i)=><article key={i.id} className="rounded-xl border border-rose-100 bg-rose-50/30 p-4"><p className="text-xs font-black uppercase text-rose-700">Cuidado de Enfermagem</p><p className="mt-1 font-black">{i.item}</p><p className="mt-1 text-sm text-slate-600">{[i.frequencia,i.instrucoes].filter(Boolean).join(" · ")}</p></article>)}
      {examesRascunho.map((i)=><article key={i.id} className="rounded-xl border border-violet-100 bg-violet-50/40 p-4"><p className="text-xs font-black uppercase text-violet-700">Exame · {i.modalidade}</p><p className="mt-1 font-black">{i.exame}</p><p className="mt-1 text-sm text-slate-600">Prioridade: {i.prioridade}{i.indicacao_clinica?` · ${i.indicacao_clinica}`:""}</p></article>)}
      {procedimentosRascunho.map((i)=><article key={i.id} className="rounded-xl border border-amber-100 bg-amber-50/40 p-4"><p className="text-xs font-black uppercase text-amber-700">Procedimento</p><p className="mt-1 font-black">{i.procedimento}</p><p className="mt-1 text-sm text-slate-600">{i.quantidade} {i.unidade_medida}{i.lateralidade?` · ${i.lateralidade}`:""}</p></article>)}
      {materiaisRascunho.map((i)=><article key={i.id} className="rounded-xl border border-sky-100 bg-sky-50/40 p-4"><p className="text-xs font-black uppercase text-sky-700">{i.categoria}</p><p className="mt-1 font-black">{i.descricao}</p><p className="mt-1 text-sm text-slate-600">{i.quantidade} {i.unidade_medida??"UN"}{i.observacoes?` · ${i.observacoes}`:""}</p></article>)}
    </div>}
    {!canSign&&totalRascunho>0?<div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">Seu perfil pode revisar o rascunho, mas não possui permissão para assinar a prescrição. Solicite a permissão de assinatura ou utilize um perfil prescritor autorizado.</div>:null}
    {canSign&&totalRascunho>0?<form action={finalizarPrescricaoDiaAction} className="flex justify-end"><input type="hidden" name="atendimento_id" value={atendimentoId}/><button className="ui-button-primary px-6 py-3"><ShieldCheck className="size-4"/>Finalizar e assinar prescrição do dia ({totalRascunho})</button></form>:null}
  </section>;

  return <SectionPage eyebrow="Assistencial / Atendimento médico" title="Prescrição Médica Eletrônica Diária" description={`Atendimento #${atendimento.numero_atendimento??"—"} · ciclo assistencial de 24 horas`}>
    {sp.sucesso?<div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">{sp.sucesso==="finalizada"?"Prescrição do dia finalizada, assinada e liberada para os setores.":sp.sucesso==="item_adicionado"?"Item adicionado ao rascunho da prescrição do dia.":sp.sucesso==="suspensa"?"Prescrição suspensa.":"Operação concluída."}</div>:null}
    {sp.erro?<div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{errorMessages[sp.erro]??decodeURIComponent(sp.erro)}</div>:null}

    <section className="sticky top-0 z-20 rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-sm backdrop-blur">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between"><div><p className="text-xs font-black uppercase tracking-wide text-slate-400">Paciente</p><h2 className="text-xl font-black text-slate-950">{paciente?.nome_completo??"Paciente"}</h2><p className="mt-1 text-sm text-slate-600">{idadePaciente!==null?`${idadePaciente} anos · `:""}{paciente?.sexo??"Sexo não informado"} · Registro #{paciente?.numero_registro??"—"} · RA {paciente?.ra??"—"}{internacao?` · ${internacao.setor??"Internação"} / Leito ${internacao.leito??internacao.quarto??"—"}`:""}</p></div>
        <div className="flex flex-wrap items-center gap-2">{alergias.length?<div className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-3 py-2 text-sm font-black text-white"><AlertTriangle className="size-4"/>ALERGIAS: {alergias.map((a)=>a.substancia).join(", ")}</div>:<div className="rounded-xl bg-slate-100 px-3 py-2 text-sm font-bold text-slate-600">Sem alergias conhecidas</div>}<div className="rounded-xl bg-brand-50 px-3 py-2 text-sm font-black text-brand-800">Validade: 24h</div></div></div>
    </section>

    <div className="mt-5 grid gap-5 lg:grid-cols-[260px_minmax(0,1fr)]">
      <aside className="space-y-4"><section className="his-card p-4"><div className="flex items-center gap-2"><History className="size-4 text-brand-700"/><h3 className="font-black">Histórico</h3></div><div className="mt-3 space-y-2">{historico.length?historico.map(([dia,item])=><Link key={dia} href={`/prontuario/${atendimentoId}/prescricao/${item.id}/imprimir`} className="block rounded-xl border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50"><span className="block font-black text-slate-800">{dia}</span><span className="text-xs text-slate-500">Abrir item assinado</span></Link>):<p className="text-sm text-slate-500">Sem prescrições anteriores.</p>}</div></section>
        <section className="his-card p-4"><p className="text-xs font-black uppercase text-slate-400">Rascunho atual</p><p className="mt-2 text-4xl font-black text-amber-700">{totalRascunho}</p><p className="mt-1 text-xs text-slate-500">itens ainda não liberados aos setores</p><Link href={`?aba=revisao`} className="mt-3 inline-flex text-sm font-black text-brand-700">Ir para revisão →</Link></section>
      </aside>

      <main className="min-w-0 space-y-5">
        {!profissional?<section className="rounded-2xl border border-amber-200 bg-amber-50 p-5"><div className="flex items-start gap-3"><UserRoundCheck className="mt-0.5 size-5 text-amber-700"/><div><h2 className="font-black text-amber-950">Usuário sem vínculo profissional</h2><p className="mt-1 text-sm text-amber-800">Prescrição bloqueada até este login estar vinculado a um profissional clínico ativo.</p></div></div></section>:<section className="rounded-2xl border border-brand-100 bg-brand-50/60 p-4"><div className="flex items-center gap-3"><ShieldCheck className="size-5 text-brand-700"/><div><p className="font-black text-brand-950">Prescritor: {profissional.nome_completo}</p><p className="text-sm text-brand-700">{profissional.especialidade||"Especialidade não informada"} · obtido automaticamente do login.</p></div></div></section>}
        {profissional&&canCreate?<section className="his-card p-5 sm:p-6"><div className="flex items-center gap-2"><Database className="size-5 text-brand-700"/><div><h2 className="font-black text-slate-900">Construção da prescrição atual</h2><p className="text-sm text-slate-500">Inclua dieta, medicamentos, cuidados, exames, procedimentos e materiais. Finalize tudo uma única vez.</p></div></div><PrescricaoDinamicaForm key={abaInicial} empresaId={empresaId} atendimentoId={atendimentoId} abaInicial={abaInicial} contadores={contadores} revisao={revisao}/></section>:null}

        <section className="space-y-3"><div className="flex items-end justify-between gap-3"><div><h2 className="text-lg font-black text-slate-950">Itens finalizados do episódio</h2><p className="text-sm text-slate-500">Prescrições assinadas ficam disponíveis para execução e impressão.</p></div></div>
          {finalizadas.length?finalizadas.map((i)=>{const prof=one(i.profissional), comps=componentes.filter((c)=>c.prescricao_id===i.id), horarios=Array.isArray(i.horarios)?i.horarios.join(", "):"";return <article key={i.id} className="ui-card p-4 sm:p-5"><div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-black uppercase text-slate-600">{i.tipo}</span><span className={`rounded-full px-2.5 py-1 text-xs font-black ${i.status==="ativa"?"bg-emerald-100 text-emerald-800":i.status==="suspensa"?"bg-rose-100 text-rose-800":"bg-slate-100 text-slate-700"}`}>{i.status}</span></div><h3 className="mt-2 font-black text-slate-950">{i.item}</h3><p className="mt-1 text-sm text-slate-600">{[i.dose,i.unidade_dose,i.via,i.frequencia,i.duracao].filter(Boolean).join(" · ")||i.instrucoes||"Sem complemento"}</p>{horarios?<p className="mt-1 text-xs font-semibold text-brand-700">Horários: {horarios}</p>:null}{comps.length?<div className="mt-3 rounded-xl bg-emerald-50 p-3">{comps.map((c)=>{const ci=one(c.item);return <p key={c.id} className="mt-1 text-sm text-emerald-950">+ {ci?.descricao??"Componente"}{c.dose?` · ${c.dose}`:""}</p>})}</div>:null}<p className="mt-2 flex items-center gap-1.5 text-xs text-slate-400"><Clock3 className="size-3.5"/>{fmtData(i.created_at)} · {prof?.nome_completo??"Profissional"}</p></div><div className="flex flex-wrap gap-2">{i.assinado_em?<Link className="btn-secondary" href={`/prontuario/${atendimentoId}/prescricao/${i.id}/imprimir`}><Printer className="size-4"/>Visualizar / imprimir</Link>:null}{i.status==="ativa"&&canSuspend?<form action={suspenderPrescricaoMedica}><input type="hidden" name="atendimento_id" value={atendimentoId}/><input type="hidden" name="prescricao_id" value={i.id}/><input type="hidden" name="motivo" value="Suspensa pelo prescritor"/><button className="btn-secondary">Suspender</button></form>:null}</div></div></article>}) : <div className="his-card p-8 text-center text-sm text-slate-500">Nenhuma prescrição finalizada neste atendimento.</div>}
        </section>
      </main>
    </div>

    <div className="sticky bottom-3 z-10 mt-6 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-lg backdrop-blur sm:flex-row sm:items-center sm:justify-between"><div><p className="font-black text-slate-900">Prescrição diária em edição</p><p className="text-xs text-slate-500">{totalRascunho} item(ns) aguardando revisão e assinatura.</p></div><Link href={`?aba=revisao`} className="ui-button-primary"><ShieldCheck className="size-4"/>Revisar e finalizar</Link></div>
  </SectionPage>;
}