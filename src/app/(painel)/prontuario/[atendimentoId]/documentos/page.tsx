import Link from "next/link";
import type { Route } from "next";
import { FileCheck2, FilePenLine, History, Printer, ScrollText, ShieldAlert, Stethoscope } from "lucide-react";
import { notFound } from "next/navigation";
import { SectionPage } from "@/components/painel/section-page";
import { requireAnyPermission } from "@/lib/permissions/server";
import { emitirDocumentoClinicoAction } from "@/modules/prontuario-medico/documentos-actions";

function one<T>(rel: T | T[] | null): T | null { return Array.isArray(rel) ? rel[0] ?? null : rel; }
function fmtData(value?: string | null) { return value ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(value)) : "—"; }

const erros: Record<string, string> = {
  campos: "Informe o tipo e o conteúdo do documento.",
  atendimento: "Atendimento não encontrado nesta unidade.",
  "atendimento-encerrado": "O episódio está encerrado. Consulte os documentos existentes pelo histórico.",
  profissional: "O usuário precisa estar vinculado a um profissional clínico ativo.",
  permissao: "Seu perfil não possui permissão para criar este documento.",
  assinatura: "Seu perfil não possui permissão para assinar este documento.",
  paciente: "Não foi possível identificar o paciente do episódio.",
  conteudo: "Preencha pelo menos um item da receita ou as orientações não medicamentosas.",
  notificacao: "Para registrar e assinar uma notificação B1, informe o número da notificação.",
  salvar: "Não foi possível salvar o documento clínico.",
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function DocumentosMedicosPage({ params, searchParams }: { params: Promise<{ atendimentoId: string }>; searchParams: Promise<{ erro?: string }> }) {
  const { atendimentoId } = await params;
  const sp = await searchParams;
  const { supabase, empresaId, unidadeId } = await requireAnyPermission(["prontuario.visualizar", "prescricao.visualizar"]);
  if (!unidadeId) return null;

  const { data: atendimento } = await supabase.from("atendimentos")
    .select("id,numero_atendimento,status,paciente_id,paciente:pacientes(nome_completo,ra,numero_registro,data_nascimento)")
    .eq("id", atendimentoId).eq("empresa_id", empresaId).eq("unidade_id", unidadeId).maybeSingle();
  if (!atendimento) notFound();
  const paciente = one(atendimento.paciente);

  const [{ data: documentos }, criarReceitaRes, assinarReceitaRes, evoluirRes, assinarProntuarioRes] = await Promise.all([
    supabase.from("documentos_clinicos_medicos")
      .select("id,tipo_documento,titulo,status,emitido_em,assinado_em,numero_notificacao,profissional:profissionais(nome_completo)")
      .eq("atendimento_id", atendimentoId).eq("empresa_id", empresaId).eq("unidade_id", unidadeId)
      .order("emitido_em", { ascending: false }).limit(100),
    supabase.rpc("tem_permissao", { p_empresa: empresaId, p_unidade: unidadeId, p_codigo: "prescricao.criar" }),
    supabase.rpc("tem_permissao", { p_empresa: empresaId, p_unidade: unidadeId, p_codigo: "prescricao.assinar" }),
    supabase.rpc("tem_permissao", { p_empresa: empresaId, p_unidade: unidadeId, p_codigo: "prontuario.evoluir" }),
    supabase.rpc("tem_permissao", { p_empresa: empresaId, p_unidade: unidadeId, p_codigo: "prontuario.assinar" }),
  ]);

  const podeCriarReceita = criarReceitaRes.data === true && !criarReceitaRes.error;
  const podeAssinarReceita = assinarReceitaRes.data === true && !assinarReceitaRes.error;
  const podeOrientar = evoluirRes.data === true && !evoluirRes.error;
  const podeAssinarOrientacao = assinarProntuarioRes.data === true && !assinarProntuarioRes.error;
  const encerrado = ["alta", "cancelado"].includes(String(atendimento.status));

  return <SectionPage eyebrow="Assistencial / Atendimento médico" title="Receituários e orientações" description={`${paciente?.nome_completo ?? "Paciente"} · Atendimento #${atendimento.numero_atendimento ?? "—"} · ${paciente?.ra ?? "—"}`}>
    {sp.erro ? <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{erros[sp.erro] ?? "Não foi possível concluir a operação."}</div> : null}

    <div className="mb-5 grid gap-3 md:grid-cols-3">
      <div className="his-kpi"><div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-400"><ScrollText className="size-4 text-brand-600"/>Documentos</div><p className="mt-2 text-3xl font-black text-slate-950">{documentos?.length ?? 0}</p><p className="mt-1 text-xs text-slate-500">Emitidos neste episódio.</p></div>
      <div className="his-kpi"><div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-400"><FileCheck2 className="size-4 text-emerald-600"/>Assinados</div><p className="mt-2 text-3xl font-black text-emerald-700">{(documentos ?? []).filter((item) => item.status === "assinado").length}</p><p className="mt-1 text-xs text-slate-500">Imutáveis após assinatura.</p></div>
      <div className="his-kpi"><div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-400"><History className="size-4 text-violet-600"/>Histórico</div><p className="mt-2 text-sm font-black text-violet-700"><Link href={`/prontuario/${atendimentoId}/historico` as Route}>Abrir prontuário longitudinal</Link></p><p className="mt-1 text-xs text-slate-500">Inclui documentos de outros episódios.</p></div>
    </div>

    {encerrado ? <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800">O episódio está encerrado. Novos documentos não podem ser emitidos aqui; os documentos existentes continuam disponíveis para consulta e impressão.</div> : null}

    {!encerrado ? <div className="grid gap-6 xl:grid-cols-2">
      <section className="his-card p-5 sm:p-6">
        <div className="flex items-start gap-3"><span className="grid size-11 place-items-center rounded-2xl bg-brand-50 text-brand-700"><FilePenLine className="size-5"/></span><div><h2 className="font-black text-slate-950">Receituário médico</h2><p className="text-sm text-slate-500">Receita comum, controle especial e registro de notificação B1.</p></div></div>
        {!podeCriarReceita ? <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-800">Seu perfil pode consultar, mas não emitir receituários.</div> : <form action={emitirDocumentoClinicoAction} className="mt-5 space-y-4">
          <input type="hidden" name="atendimento_id" value={atendimentoId}/>
          <label className="block"><span className="mb-1.5 block text-sm font-bold text-slate-700">Tipo de receituário</span><select name="tipo_documento" className="ui-input" defaultValue="receituario_comum"><option value="receituario_comum">Receituário comum</option><option value="controle_especial">Receita de Controle Especial</option><option value="b1_azul">Notificação B1 — registro</option></select></label>
          <label className="block"><span className="mb-1.5 block text-sm font-bold text-slate-700">Número da notificação B1 <span className="font-normal text-slate-400">(quando aplicável)</span></span><input name="numero_notificacao" className="ui-input" maxLength={80} placeholder="Informe o identificador da notificação"/></label>
          <label className="block"><span className="mb-1.5 block text-sm font-bold text-slate-700">Itens prescritos</span><textarea name="itens_texto" rows={9} className="ui-input" placeholder={"Um item por linha. Exemplo:\nDipirona 500 mg — tomar 1 comprimido VO a cada 6 horas se dor, por 3 dias\nSoro fisiológico 0,9% — uso conforme orientação"} required/></label>
          <label className="block"><span className="mb-1.5 block text-sm font-bold text-slate-700">Observações</span><textarea name="observacoes" rows={2} className="ui-input" placeholder="Observações adicionais do documento"/></label>
          <div className="rounded-xl border border-sky-200 bg-sky-50 p-3 text-xs text-sky-800"><b>Controle especial:</b> o HIS registra o documento e seu identificador informado. Isso não substitui numeração, talonário, validação ou exigências regulatórias externas aplicáveis.</div>
          <div className="flex flex-wrap justify-end gap-2"><button name="acao" value="salvar" className="ui-button-secondary">Salvar rascunho</button>{podeAssinarReceita ? <button name="acao" value="assinar" className="ui-button-primary">Salvar e assinar</button> : null}</div>
        </form>}
      </section>

      <section className="his-card p-5 sm:p-6">
        <div className="flex items-start gap-3"><span className="grid size-11 place-items-center rounded-2xl bg-emerald-50 text-emerald-700"><Stethoscope className="size-5"/></span><div><h2 className="font-black text-slate-950">Orientações não medicamentosas</h2><p className="text-sm text-slate-500">Cuidados, sinais de alarme, dieta, repouso, retorno e outras recomendações clínicas.</p></div></div>
        {!podeOrientar ? <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-800">Seu perfil pode consultar, mas não registrar orientações clínicas.</div> : <form action={emitirDocumentoClinicoAction} className="mt-5 space-y-4">
          <input type="hidden" name="atendimento_id" value={atendimentoId}/><input type="hidden" name="tipo_documento" value="orientacao_nao_medicamentosa"/>
          <label className="block"><span className="mb-1.5 block text-sm font-bold text-slate-700">Orientações ao paciente / responsável</span><textarea name="orientacoes" rows={12} className="ui-input" required placeholder={"Ex.: hidratação, repouso, cuidados com curativo, sinais de alerta, retorno em caso de piora, acompanhamento ambulatorial..."}/></label>
          <label className="block"><span className="mb-1.5 block text-sm font-bold text-slate-700">Observações internas</span><textarea name="observacoes" rows={2} className="ui-input" placeholder="Observações adicionais"/></label>
          <div className="flex flex-wrap justify-end gap-2"><button name="acao" value="salvar" className="ui-button-secondary">Salvar rascunho</button>{podeAssinarOrientacao ? <button name="acao" value="assinar" className="ui-button-primary">Salvar e assinar</button> : null}</div>
        </form>}
      </section>
    </div> : null}

    <section className="his-card mt-6 p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3"><div><h2 className="font-black text-slate-950">Documentos deste atendimento</h2><p className="text-sm text-slate-500">Cada documento permanece vinculado ao episódio que o originou.</p></div><ShieldAlert className="size-5 text-slate-400"/></div>
      <div className="mt-4 space-y-2">{documentos?.length ? documentos.map((item) => { const profissional = one(item.profissional); return <article key={item.id} className="rounded-xl border border-slate-200 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2"><h3 className="font-bold text-slate-900">{item.titulo}</h3><span className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase ${item.status === "assinado" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>{item.status}</span></div><p className="mt-1 text-xs text-slate-500">{fmtData(item.emitido_em)} · {profissional?.nome_completo ?? "Profissional"}{item.numero_notificacao ? ` · Notificação ${item.numero_notificacao}` : ""}</p></div><Link href={`/prontuario/${atendimentoId}/documentos/${item.id}` as Route} className="ui-button-secondary"><Printer className="size-4"/>Visualizar / imprimir</Link></div></article>; }) : <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">Nenhum documento médico emitido neste atendimento.</div>}</div>
    </section>
  </SectionPage>;
}