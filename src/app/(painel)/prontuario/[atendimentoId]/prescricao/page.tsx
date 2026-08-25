import { Ban, Clock3, Database, Pill, ShieldCheck, UserRoundCheck } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { ItemAssistencialAutocomplete } from "@/components/prontuario/item-assistencial-autocomplete";
import { SectionPage } from "@/components/painel/section-page";
import { requireAnyPermission } from "@/lib/permissions/server";
import { assinarPrescricaoMedica, criarPrescricaoMedica, suspenderPrescricaoMedica } from "@/modules/prontuario-medico/prescricao-actions";

type Rel<T> = T | T[] | null;
function one<T>(value: Rel<T>): T | null { return Array.isArray(value) ? value[0] ?? null : value; }
function fmtData(value: string | null | undefined) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(value));
}

const errorMessages: Record<string, string> = {
  campos: "Preencha os campos obrigatórios da prescrição.",
  catalogo: "Selecione um item ativo do catálogo assistencial. Itens livres não são permitidos.",
  atendimento: "O atendimento não está ativo nesta unidade.",
  profissional: "Seu usuário não está vinculado a um profissional clínico ativo.",
  salvar: "Não foi possível salvar a prescrição.",
  prescricao: "A prescrição não pertence a este atendimento ou não pode ser alterada por este profissional.",
  assinatura: "Não foi possível assinar a prescrição.",
  suspensao: "Não foi possível suspender a prescrição.",
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function PrescricaoMedicaPage({ params, searchParams }: {
  params: Promise<{ atendimentoId: string }>;
  searchParams: Promise<{ sucesso?: string; erro?: string; aviso?: string }>;
}) {
  const { atendimentoId } = await params;
  const sp = await searchParams;
  const { supabase, user, empresaId, unidadeId } = await requireAnyPermission(["prescricao.visualizar", "prontuario.visualizar"]);
  if (!unidadeId) redirect("/painel?erro=unidade");

  const { data: atendimento } = await supabase
    .from("atendimentos")
    .select("id,numero_atendimento,status,data_abertura,paciente_id,paciente:pacientes(nome_completo,ra,numero_registro,cpf,cns,data_nascimento,sexo)")
    .eq("id", atendimentoId).eq("empresa_id", empresaId).eq("unidade_id", unidadeId).maybeSingle();
  if (!atendimento) notFound();
  const paciente = one(atendimento.paciente);

  const permissionCodes = ["prescricao.criar", "prescricao.assinar", "prescricao.suspender"] as const;
  const [prescricoesRes, profissionalUsuarioRes, permissoes] = await Promise.all([
    supabase.from("prescricoes")
      .select("id,tipo,item,item_assistencial_id,quantidade,unidade_dose,dose,via,frequencia,duracao,instrucoes,orientacoes,se_necessario,requer_validacao_farmaceutica,status,assinado_em,suspenso_em,motivo_suspensao,created_at,profissional_id,profissional:profissionais(nome_completo)")
      .eq("atendimento_id", atendimentoId).eq("empresa_id", empresaId).eq("unidade_id", unidadeId).order("created_at", { ascending: false }).limit(100),
    supabase.from("profissionais").select("id,nome_completo,especialidade").eq("empresa_id", empresaId).eq("usuario_id", user.id).eq("ativo", true).limit(1).maybeSingle(),
    Promise.all(permissionCodes.map((codigo) => supabase.rpc("tem_permissao", { p_empresa: empresaId, p_unidade: unidadeId, p_codigo: codigo }))),
  ]);

  let profissional = profissionalUsuarioRes.data;
  if (!profissional && user.email) {
    profissional = (await supabase.from("profissionais").select("id,nome_completo,especialidade").eq("empresa_id", empresaId).ilike("email", user.email).eq("ativo", true).limit(1).maybeSingle()).data;
  }

  const canCreate = permissoes[0]?.data === true && !permissoes[0]?.error;
  const canSign = permissoes[1]?.data === true && !permissoes[1]?.error;
  const canSuspend = permissoes[2]?.data === true && !permissoes[2]?.error;
  const prescricoes = prescricoesRes.data ?? [];
  const ativas = prescricoes.filter((item) => item.status === "ativa").length;
  const rascunhos = prescricoes.filter((item) => item.status === "rascunho").length;
  const suspensas = prescricoes.filter((item) => item.status === "suspensa").length;

  return <SectionPage eyebrow="Assistencial / Atendimento médico / Prescrição" title={paciente?.nome_completo ?? "Paciente"}
    description={`Atendimento #${atendimento.numero_atendimento ?? "—"} · Registro #${paciente?.numero_registro ?? "—"} · ${paciente?.ra ?? "—"}`}>
    {sp.sucesso ? <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">{sp.sucesso === "assinada" ? "Prescrição assinada e ativada." : sp.sucesso === "suspensa" ? "Prescrição suspensa com rastreabilidade." : "Solicitação salva com sucesso."}</div> : null}
    {sp.erro ? <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{errorMessages[sp.erro] ?? "Não foi possível concluir a operação."}</div> : null}
    {sp.aviso ? <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">A prescrição foi assinada, mas uma integração posterior precisa ser revisada: {sp.aviso === "farmacia" ? "fila da Farmácia" : "aprazamento"}.</div> : null}

    <section className="grid gap-3 md:grid-cols-4">
      <div className="his-kpi"><p className="text-xs font-bold uppercase tracking-wider text-slate-400">Paciente em contexto</p><p className="mt-2 text-base font-black text-slate-950">{paciente?.nome_completo ?? "Paciente"}</p><p className="mt-1 text-xs text-slate-500">RA {paciente?.ra ?? "—"} · CNS {paciente?.cns ?? "—"}</p></div>
      <div className="his-kpi"><p className="text-xs font-bold uppercase tracking-wider text-slate-400">Rascunhos</p><p className="mt-2 text-3xl font-black text-amber-700">{rascunhos}</p></div>
      <div className="his-kpi"><p className="text-xs font-bold uppercase tracking-wider text-slate-400">Ativas</p><p className="mt-2 text-3xl font-black text-emerald-700">{ativas}</p></div>
      <div className="his-kpi"><p className="text-xs font-bold uppercase tracking-wider text-slate-400">Suspensas</p><p className="mt-2 text-3xl font-black text-slate-700">{suspensas}</p></div>
    </section>

    {!profissional ? <section className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-5"><div className="flex items-start gap-3"><UserRoundCheck className="mt-0.5 size-5 text-amber-700"/><div><h2 className="font-black text-amber-950">Usuário sem vínculo profissional</h2><p className="mt-1 text-sm text-amber-800">Consulta liberada; prescrição bloqueada até existir vínculo entre este login e um profissional clínico ativo.</p></div></div></section>
    : <section className="mt-5 rounded-2xl border border-brand-100 bg-brand-50/60 p-4"><div className="flex items-center gap-3"><ShieldCheck className="size-5 text-brand-700"/><div><p className="font-black text-brand-950">Prescritor: {profissional.nome_completo}</p><p className="text-sm text-brand-700">{profissional.especialidade || "Especialidade não informada"} · identificado automaticamente pelo usuário logado. Não há seletor de médico.</p></div></div></section>}

    {profissional && canCreate ? <section className="his-card mt-5 p-5 sm:p-6">
      <div><div className="flex items-center gap-2"><Database className="size-5 text-brand-700"/><h2 className="font-black text-slate-900">Nova prescrição / solicitação</h2></div><p className="mt-1 text-sm text-slate-500">Digite o nome e selecione diretamente do catálogo institucional. O médico é o usuário autenticado e qualquer vínculo com estoque é tratado apenas internamente.</p></div>

      <form action={criarPrescricaoMedica} className="mt-5">
        <input type="hidden" name="atendimento_id" value={atendimentoId}/>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <ItemAssistencialAutocomplete empresaId={empresaId}/>
          <label className="space-y-2 text-sm font-semibold text-slate-700"><span>Dose</span><input name="dose" className="ui-input" placeholder="Ex.: 1 g"/></label>
          <label className="space-y-2 text-sm font-semibold text-slate-700"><span>Via</span><input name="via" className="ui-input" placeholder="VO, EV, IM, SC..."/></label>
          <label className="space-y-2 text-sm font-semibold text-slate-700"><span>Quantidade</span><input name="quantidade" type="number" step="0.0001" className="ui-input"/></label>
          <label className="space-y-2 text-sm font-semibold text-slate-700"><span>Unidade da dose</span><input name="unidade_dose" className="ui-input" placeholder="Usa o catálogo se vazio"/></label>
          <label className="space-y-2 text-sm font-semibold text-slate-700"><span>Frequência</span><input name="frequencia" className="ui-input" placeholder="6/6h, 8/8h..."/></label>
          <label className="space-y-2 text-sm font-semibold text-slate-700"><span>Duração</span><input name="duracao" className="ui-input" placeholder="Ex.: 5 dias"/></label>
          <label className="space-y-2 text-sm font-semibold text-slate-700"><span>Início</span><input name="inicio_em" type="datetime-local" className="ui-input"/></label>
          <label className="space-y-2 text-sm font-semibold text-slate-700"><span>Fim</span><input name="fim_em" type="datetime-local" className="ui-input"/></label>
          <label className="space-y-2 text-sm font-semibold text-slate-700 md:col-span-2"><span>Horários</span><input name="horarios" className="ui-input" placeholder="06:00, 12:00, 18:00, 00:00"/></label>
          <label className="space-y-2 text-sm font-semibold text-slate-700 md:col-span-2"><span>Aprazamento</span><input name="aprazamento" className="ui-input" placeholder="Programação institucional"/></label>
          <label className="space-y-2 text-sm font-semibold text-slate-700 md:col-span-2"><span>Diluente</span><input name="diluente" className="ui-input"/></label>
          <label className="space-y-2 text-sm font-semibold text-slate-700 md:col-span-2"><span>Velocidade de infusão</span><input name="velocidade_infusao" className="ui-input"/></label>
          <label className="space-y-2 text-sm font-semibold text-slate-700 md:col-span-2"><span>Instruções</span><textarea name="instrucoes" rows={3} className="ui-input min-h-24"/></label>
          <label className="space-y-2 text-sm font-semibold text-slate-700 md:col-span-2"><span>Orientações</span><textarea name="orientacoes" rows={3} className="ui-input min-h-24"/></label>
          <label className="flex items-center gap-2 text-sm font-semibold text-slate-700"><input type="checkbox" name="se_necessario"/>Se necessário</label>
          <label className="flex items-center gap-2 text-sm font-semibold text-slate-700"><input type="checkbox" name="requer_validacao_farmaceutica"/>Validação farmacêutica</label>
        </div>
        <div className="mt-5 flex justify-end"><button className="ui-button-primary"><Pill className="size-4"/>Salvar</button></div>
      </form>
    </section> : null}

    <section className="mt-6 space-y-3">
      <div><h2 className="text-lg font-black text-slate-950">Prescrições do episódio</h2><p className="text-sm text-slate-500">O profissional responsável é sempre derivado do login que criou e assinou a prescrição.</p></div>
      {prescricoes.length ? prescricoes.map((item) => {
        const prof = one(item.profissional);
        return <article key={item.id} className="ui-card p-4 sm:p-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between"><div><div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-black uppercase text-slate-600">{item.tipo}</span><span className={`rounded-full px-2.5 py-1 text-xs font-black ${item.status === "ativa" ? "bg-emerald-100 text-emerald-800" : item.status === "suspensa" ? "bg-rose-100 text-rose-800" : "bg-amber-100 text-amber-800"}`}>{item.status}</span>{item.item_assistencial_id ? <span className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-bold text-brand-700">Catálogo vinculado</span> : <span className="rounded-full bg-rose-50 px-2.5 py-1 text-xs font-bold text-rose-700">Legado sem catálogo</span>}</div><h3 className="mt-2 font-black text-slate-950">{item.item}</h3><p className="mt-1 text-sm text-slate-600">{[item.dose, item.via, item.frequencia, item.duracao].filter(Boolean).join(" · ") || "Sem posologia complementar"}</p><p className="mt-2 flex items-center gap-1.5 text-xs text-slate-400"><Clock3 className="size-3.5"/>{fmtData(item.created_at)} · {prof?.nome_completo ?? "Profissional"}</p></div>
          <div className="flex flex-wrap gap-2">{item.status === "rascunho" && canSign && item.item_assistencial_id ? <form action={assinarPrescricaoMedica}><input type="hidden" name="atendimento_id" value={atendimentoId}/><input type="hidden" name="prescricao_id" value={item.id}/><button className="ui-button-primary"><ShieldCheck className="size-4"/>Assinar</button></form> : null}{item.status === "ativa" && canSuspend ? <form action={suspenderPrescricaoMedica} className="flex gap-2"><input type="hidden" name="atendimento_id" value={atendimentoId}/><input type="hidden" name="prescricao_id" value={item.id}/><input name="motivo" required className="ui-input h-10 min-w-52" placeholder="Motivo da suspensão"/><button className="btn-secondary"><Ban className="size-4"/>Suspender</button></form> : null}</div></div>
        </article>;
      }) : <div className="ui-card p-8 text-center text-sm text-slate-500">Nenhuma prescrição neste episódio.</div>}
    </section>
  </SectionPage>;
}
