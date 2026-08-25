import { AlertTriangle, Ban, Clock3, Database, Pill, Search, ShieldCheck, UserRoundCheck } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { SectionPage } from "@/components/painel/section-page";
import { requireAnyPermission } from "@/lib/permissions/server";
import { assinarPrescricaoMedica, criarPrescricaoMedica, suspenderPrescricaoMedica } from "@/modules/prontuario-medico/prescricao-actions";

type Rel<T> = T | T[] | null;
type ItemCatalogo = {
  id: string;
  codigo_interno: string;
  categoria: string;
  descricao: string;
  unidade_medida: string | null;
  apresentacao: string | null;
  concentracao: string | null;
  tabela_tiss_codigo: string;
  codigo_tuss: string | null;
  codigo_tabela_propria: string | null;
};

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

const categoriaLabel: Record<string, string> = {
  medicamento: "Medicamento", material: "Material", opme: "OPME", gas_medicinal: "Gás medicinal", procedimento: "Procedimento", outro: "Outro",
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function PrescricaoMedicaPage({ params, searchParams }: {
  params: Promise<{ atendimentoId: string }>;
  searchParams: Promise<{ sucesso?: string; erro?: string; aviso?: string; produto?: string }>;
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

  const produtoBusca = String(sp.produto ?? "").trim().slice(0, 80);
  let itens: ItemCatalogo[] = [];
  if (canCreate && produtoBusca.length >= 2) {
    const base = () => supabase.from("itens_assistenciais")
      .select("id,codigo_interno,categoria,descricao,unidade_medida,apresentacao,concentracao,tabela_tiss_codigo,codigo_tuss,codigo_tabela_propria")
      .eq("empresa_id", empresaId).eq("ativo", true)
      .in("categoria", ["medicamento", "material", "opme", "gas_medicinal", "procedimento", "outro"]);
    const [descricaoRes, internoRes, tussRes] = await Promise.all([
      base().ilike("descricao", `%${produtoBusca}%`).order("descricao").limit(25),
      base().ilike("codigo_interno", `%${produtoBusca}%`).order("descricao").limit(15),
      base().ilike("codigo_tuss", `%${produtoBusca}%`).order("descricao").limit(15),
    ]);
    const unique = new Map<string, ItemCatalogo>();
    for (const item of [...(descricaoRes.data ?? []), ...(internoRes.data ?? []), ...(tussRes.data ?? [])] as ItemCatalogo[]) unique.set(item.id, item);
    itens = [...unique.values()].slice(0, 40);
  }

  return <SectionPage eyebrow="Assistencial / Atendimento médico / Prescrição" title={paciente?.nome_completo ?? "Paciente"}
    description={`Atendimento #${atendimento.numero_atendimento ?? "—"} · Registro #${paciente?.numero_registro ?? "—"} · ${paciente?.ra ?? "—"}`}>
    {sp.sucesso ? <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">{sp.sucesso === "assinada" ? "Prescrição assinada e ativada." : sp.sucesso === "suspensa" ? "Prescrição suspensa com rastreabilidade." : "Rascunho de prescrição salvo."}</div> : null}
    {sp.erro ? <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{errorMessages[sp.erro] ?? "Não foi possível concluir a operação."}</div> : null}
    {sp.aviso ? <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">A prescrição foi assinada, mas uma integração posterior precisa ser revisada: {sp.aviso === "farmacia" ? "fila da Farmácia" : "aprazamento"}.</div> : null}

    <section className="grid gap-3 md:grid-cols-4">
      <div className="his-kpi"><p className="text-xs font-bold uppercase tracking-wider text-slate-400">Paciente em contexto</p><p className="mt-2 text-base font-black text-slate-950">{paciente?.nome_completo ?? "Paciente"}</p><p className="mt-1 text-xs text-slate-500">RA {paciente?.ra ?? "—"} · CNS {paciente?.cns ?? "—"}</p></div>
      <div className="his-kpi"><p className="text-xs font-bold uppercase tracking-wider text-slate-400">Rascunhos</p><p className="mt-2 text-3xl font-black text-amber-700">{rascunhos}</p></div>
      <div className="his-kpi"><p className="text-xs font-bold uppercase tracking-wider text-slate-400">Ativas</p><p className="mt-2 text-3xl font-black text-emerald-700">{ativas}</p></div>
      <div className="his-kpi"><p className="text-xs font-bold uppercase tracking-wider text-slate-400">Suspensas</p><p className="mt-2 text-3xl font-black text-slate-700">{suspensas}</p></div>
    </section>

    {!profissional ? <section className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-5"><div className="flex items-start gap-3"><UserRoundCheck className="mt-0.5 size-5 text-amber-700"/><div><h2 className="font-black text-amber-950">Usuário sem vínculo profissional</h2><p className="mt-1 text-sm text-amber-800">Consulta liberada; prescrição bloqueada até existir vínculo com profissional clínico ativo.</p></div></div></section>
    : <section className="mt-5 rounded-2xl border border-brand-100 bg-brand-50/60 p-4"><div className="flex items-center gap-3"><ShieldCheck className="size-5 text-brand-700"/><div><p className="font-black text-brand-950">Prescritor: {profissional.nome_completo}</p><p className="text-sm text-brand-700">{profissional.especialidade || "Especialidade não informada"} · definido pelo usuário autenticado.</p></div></div></section>}

    {profissional && canCreate ? <section className="his-card mt-5 p-5 sm:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div><div className="flex items-center gap-2"><Database className="size-5 text-brand-700"/><h2 className="font-black text-slate-900">Prescrever pelo catálogo institucional</h2></div><p className="mt-1 text-sm text-slate-500">A prescrição aceita somente itens ativos de <strong>itens_assistenciais</strong>. Não existe mais item livre.</p></div>
        <form method="get" className="flex w-full max-w-xl gap-2"><input name="produto" defaultValue={produtoBusca} className="ui-input" placeholder="Descrição, código interno ou TUSS"/><button className="btn-secondary" type="submit"><Search className="size-4"/>Buscar</button></form>
      </div>
      {produtoBusca.length === 1 ? <p className="mt-3 text-xs font-semibold text-amber-700">Digite pelo menos 2 caracteres.</p> : null}
      {produtoBusca.length >= 2 && !itens.length ? <div className="mt-3 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800"><AlertTriangle className="size-4"/>Nenhum item ativo encontrado. Cadastre/mapeie o item no catálogo antes de prescrever.</div> : null}

      <form action={criarPrescricaoMedica} className="mt-5">
        <input type="hidden" name="atendimento_id" value={atendimentoId}/>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <label className="space-y-2 text-sm font-semibold text-slate-700 md:col-span-2 xl:col-span-4"><span>Item do catálogo *</span><select name="item_assistencial_id" required defaultValue="" className="ui-input"><option value="" disabled>Selecione um item encontrado</option>{itens.map((item) => <option key={item.id} value={item.id}>{categoriaLabel[item.categoria] ?? item.categoria} · {item.codigo_tuss ? `TUSS ${item.codigo_tuss}` : `INT ${item.codigo_interno}`} · {item.descricao}{item.concentracao ? ` · ${item.concentracao}` : ""}{item.apresentacao ? ` · ${item.apresentacao}` : ""}</option>)}</select></label>
          <label className="space-y-2 text-sm font-semibold text-slate-700"><span>Dose</span><input name="dose" className="ui-input" placeholder="Ex.: 1 g"/></label>
          <label className="space-y-2 text-sm font-semibold text-slate-700"><span>Via</span><input name="via" className="ui-input" placeholder="VO, EV, IM, SC..."/></label>
          <label className="space-y-2 text-sm font-semibold text-slate-700"><span>Quantidade</span><input name="quantidade" type="number" step="0.0001" className="ui-input"/></label>
          <label className="space-y-2 text-sm font-semibold text-slate-700"><span>Unidade da dose</span><input name="unidade_dose" className="ui-input" placeholder="Se vazio, usa a unidade do catálogo"/></label>
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
        <div className="mt-5 flex justify-end"><button disabled={!itens.length} className="ui-button-primary disabled:cursor-not-allowed disabled:opacity-50"><Pill className="size-4"/>Salvar rascunho</button></div>
      </form>
    </section> : null}

    <section className="mt-6 space-y-3">
      <div><h2 className="text-lg font-black text-slate-950">Prescrições do episódio</h2><p className="text-sm text-slate-500">Itens novos só podem ser assinados quando possuem vínculo com o catálogo institucional ativo.</p></div>
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
