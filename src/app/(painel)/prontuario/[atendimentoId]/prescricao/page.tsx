import { AlertTriangle, Ban, Clock3, Pill, Search, ShieldCheck, UserRoundCheck } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { SectionPage } from "@/components/painel/section-page";
import { requireAnyPermission } from "@/lib/permissions/server";
import {
  assinarPrescricaoMedica,
  criarPrescricaoMedica,
  suspenderPrescricaoMedica,
} from "@/modules/prontuario-medico/prescricao-actions";

type Rel<T> = T | T[] | null;
type Produto = {
  id: string;
  codigo: string | null;
  descricao: string;
  unidade_medida: string | null;
  tipo: string | null;
};

function one<T>(value: Rel<T>): T | null {
  return Array.isArray(value) ? value[0] ?? null : value;
}

function fmtData(value: string | null | undefined) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(value));
}

const errorMessages: Record<string, string> = {
  campos: "Preencha os campos obrigatórios da prescrição.",
  atendimento: "O atendimento não está ativo nesta unidade.",
  profissional: "Seu usuário não está vinculado a um profissional clínico ativo.",
  salvar: "Não foi possível salvar a prescrição.",
  prescricao: "A prescrição não pertence a este atendimento ou não pode ser alterada por este profissional.",
  assinatura: "Não foi possível assinar a prescrição.",
  suspensao: "Não foi possível suspender a prescrição.",
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function PrescricaoMedicaPage({
  params,
  searchParams,
}: {
  params: Promise<{ atendimentoId: string }>;
  searchParams: Promise<{ sucesso?: string; erro?: string; aviso?: string; produto?: string }>;
}) {
  const { atendimentoId } = await params;
  const sp = await searchParams;
  const { supabase, user, empresaId, unidadeId } = await requireAnyPermission([
    "prescricao.visualizar",
    "prontuario.visualizar",
  ]);

  if (!unidadeId) redirect("/painel?erro=unidade");

  const { data: atendimento } = await supabase
    .from("atendimentos")
    .select("id,numero_atendimento,status,data_abertura,paciente_id,paciente:pacientes(nome_completo,ra,numero_registro,cpf,cns,data_nascimento,sexo)")
    .eq("id", atendimentoId)
    .eq("empresa_id", empresaId)
    .eq("unidade_id", unidadeId)
    .maybeSingle();

  if (!atendimento) notFound();
  const paciente = one(atendimento.paciente);

  const permissionCodes = ["prescricao.criar", "prescricao.assinar", "prescricao.suspender"] as const;
  const [prescricoesRes, profissionalUsuarioRes, permissoes] = await Promise.all([
    supabase
      .from("prescricoes")
      .select("id,tipo,item,produto_id,quantidade,unidade_dose,dose,via,frequencia,duracao,instrucoes,orientacoes,se_necessario,requer_validacao_farmaceutica,status,assinado_em,suspenso_em,motivo_suspensao,created_at,profissional_id,profissional:profissionais(nome_completo)")
      .eq("atendimento_id", atendimentoId)
      .eq("empresa_id", empresaId)
      .eq("unidade_id", unidadeId)
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("profissionais")
      .select("id,nome_completo,especialidade")
      .eq("empresa_id", empresaId)
      .eq("usuario_id", user.id)
      .eq("ativo", true)
      .limit(1)
      .maybeSingle(),
    Promise.all(
      permissionCodes.map((codigo) =>
        supabase.rpc("tem_permissao", {
          p_empresa: empresaId,
          p_unidade: unidadeId,
          p_codigo: codigo,
        }),
      ),
    ),
  ]);

  let profissional = profissionalUsuarioRes.data;
  if (!profissional && user.email) {
    const fallback = await supabase
      .from("profissionais")
      .select("id,nome_completo,especialidade")
      .eq("empresa_id", empresaId)
      .ilike("email", user.email)
      .eq("ativo", true)
      .limit(1)
      .maybeSingle();
    profissional = fallback.data;
  }

  const canCreate = permissoes[0]?.data === true && !permissoes[0]?.error;
  const canSign = permissoes[1]?.data === true && !permissoes[1]?.error;
  const canSuspend = permissoes[2]?.data === true && !permissoes[2]?.error;
  const prescricoes = prescricoesRes.data ?? [];
  const ativas = prescricoes.filter((item) => item.status === "ativa").length;
  const rascunhos = prescricoes.filter((item) => item.status === "rascunho").length;
  const suspensas = prescricoes.filter((item) => item.status === "suspensa").length;

  const produtoBusca = String(sp.produto ?? "").trim().slice(0, 80);
  let produtos: Produto[] = [];
  if (canCreate && produtoBusca.length >= 2) {
    const [descricaoRes, codigoRes] = await Promise.all([
      supabase
        .from("estoque_produtos")
        .select("id,codigo,descricao,unidade_medida,tipo")
        .eq("ativo", true)
        .ilike("descricao", `%${produtoBusca}%`)
        .order("descricao")
        .limit(20),
      supabase
        .from("estoque_produtos")
        .select("id,codigo,descricao,unidade_medida,tipo")
        .eq("ativo", true)
        .ilike("codigo", `%${produtoBusca}%`)
        .order("descricao")
        .limit(10),
    ]);
    const unique = new Map<string, Produto>();
    for (const item of [...(descricaoRes.data ?? []), ...(codigoRes.data ?? [])] as Produto[]) unique.set(item.id, item);
    produtos = [...unique.values()].slice(0, 30);
  }

  return (
    <SectionPage
      eyebrow="Assistencial / Atendimento médico / Prescrição"
      title={paciente?.nome_completo ?? "Paciente"}
      description={`Atendimento #${atendimento.numero_atendimento ?? "—"} · Registro #${paciente?.numero_registro ?? "—"} · ${paciente?.ra ?? "—"}`}
    >
      {sp.sucesso ? (
        <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
          {sp.sucesso === "assinada" ? "Prescrição assinada e ativada." : sp.sucesso === "suspensa" ? "Prescrição suspensa com rastreabilidade." : "Rascunho de prescrição salvo."}
        </div>
      ) : null}
      {sp.erro ? (
        <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
          {errorMessages[sp.erro] ?? "Não foi possível concluir a operação."}
        </div>
      ) : null}
      {sp.aviso ? (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
          A prescrição foi assinada, mas uma integração assistencial posterior precisa ser revisada: {sp.aviso === "farmacia" ? "fila da Farmácia" : "aprazamento"}.
        </div>
      ) : null}

      <section className="grid gap-3 md:grid-cols-4">
        <div className="his-kpi">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Paciente em contexto</p>
          <p className="mt-2 text-base font-black text-slate-950">{paciente?.nome_completo ?? "Paciente"}</p>
          <p className="mt-1 text-xs text-slate-500">RA {paciente?.ra ?? "—"} · CNS {paciente?.cns ?? "—"}</p>
        </div>
        <div className="his-kpi"><p className="text-xs font-bold uppercase tracking-wider text-slate-400">Rascunhos</p><p className="mt-2 text-3xl font-black text-amber-700">{rascunhos}</p></div>
        <div className="his-kpi"><p className="text-xs font-bold uppercase tracking-wider text-slate-400">Ativas</p><p className="mt-2 text-3xl font-black text-emerald-700">{ativas}</p></div>
        <div className="his-kpi"><p className="text-xs font-bold uppercase tracking-wider text-slate-400">Suspensas</p><p className="mt-2 text-3xl font-black text-slate-700">{suspensas}</p></div>
      </section>

      {!profissional ? (
        <section className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <div className="flex items-start gap-3"><UserRoundCheck className="mt-0.5 size-5 text-amber-700"/><div><h2 className="font-black text-amber-950">Usuário sem vínculo profissional</h2><p className="mt-1 text-sm text-amber-800">Você pode consultar as prescrições deste episódio, mas não pode prescrever até que o usuário esteja vinculado a um profissional clínico ativo.</p></div></div>
        </section>
      ) : (
        <section className="mt-5 rounded-2xl border border-brand-100 bg-brand-50/60 p-4">
          <div className="flex items-center gap-3"><ShieldCheck className="size-5 text-brand-700"/><div><p className="font-black text-brand-950">Prescritor: {profissional.nome_completo}</p><p className="text-sm text-brand-700">{profissional.especialidade || "Especialidade não informada"} · o profissional é definido pelo usuário autenticado.</p></div></div>
        </section>
      )}

      {profissional && canCreate ? (
        <section className="his-card mt-5 p-5 sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div><div className="flex items-center gap-2"><Pill className="size-5 text-brand-700"/><h2 className="font-black text-slate-900">Novo item de prescrição</h2></div><p className="mt-1 text-sm text-slate-500">O atendimento e o prescritor ficam fixos. O catálogo só é consultado quando você pesquisar um produto.</p></div>
            <form method="get" className="flex w-full max-w-xl gap-2">
              <input name="produto" defaultValue={produtoBusca} className="ui-input" placeholder="Buscar produto por nome ou código" />
              <button className="btn-secondary" type="submit"><Search className="size-4"/>Buscar</button>
            </form>
          </div>

          {produtoBusca.length === 1 ? <p className="mt-3 text-xs font-semibold text-amber-700">Digite pelo menos 2 caracteres para consultar o catálogo.</p> : null}
          {produtoBusca.length >= 2 && !produtos.length ? <p className="mt-3 text-xs font-semibold text-slate-500">Nenhum produto ativo encontrado. O item ainda pode ser prescrito sem vínculo com estoque.</p> : null}

          <form action={criarPrescricaoMedica} className="mt-5">
            <input type="hidden" name="atendimento_id" value={atendimentoId}/>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <label className="space-y-2 text-sm font-semibold text-slate-700"><span>Tipo *</span><select name="tipo" defaultValue="medicamento" className="ui-input"><option value="medicamento">Medicamento</option><option value="dieta">Dieta</option><option value="cuidado">Cuidado</option><option value="procedimento">Procedimento</option><option value="outro">Outro</option></select></label>
              <label className="space-y-2 text-sm font-semibold text-slate-700 md:col-span-2 xl:col-span-3"><span>Produto do estoque</span><select name="produto_id" defaultValue="" className="ui-input"><option value="">Sem vínculo / item livre</option>{produtos.map((produto) => <option key={produto.id} value={produto.id}>{produto.codigo ? `${produto.codigo} · ` : ""}{produto.descricao}{produto.unidade_medida ? ` · ${produto.unidade_medida}` : ""}</option>)}</select></label>
              <label className="space-y-2 text-sm font-semibold text-slate-700 md:col-span-2"><span>Item / medicamento *</span><input name="item" required className="ui-input" placeholder="Ex.: Dipirona 1 g/2 mL"/></label>
              <label className="space-y-2 text-sm font-semibold text-slate-700"><span>Dose</span><input name="dose" className="ui-input" placeholder="Ex.: 1 g"/></label>
              <label className="space-y-2 text-sm font-semibold text-slate-700"><span>Via</span><input name="via" className="ui-input" placeholder="VO, EV, IM, SC..."/></label>
              <label className="space-y-2 text-sm font-semibold text-slate-700"><span>Quantidade</span><input name="quantidade" type="number" step="0.0001" className="ui-input"/></label>
              <label className="space-y-2 text-sm font-semibold text-slate-700"><span>Unidade da dose</span><input name="unidade_dose" className="ui-input" placeholder="mg, g, mL, UI..."/></label>
              <label className="space-y-2 text-sm font-semibold text-slate-700"><span>Frequência</span><input name="frequencia" className="ui-input" placeholder="6/6h, 8/8h..."/></label>
              <label className="space-y-2 text-sm font-semibold text-slate-700"><span>Duração</span><input name="duracao" className="ui-input" placeholder="Ex.: 5 dias"/></label>
              <label className="space-y-2 text-sm font-semibold text-slate-700"><span>Início</span><input name="inicio_em" type="datetime-local" className="ui-input"/></label>
              <label className="space-y-2 text-sm font-semibold text-slate-700"><span>Fim</span><input name="fim_em" type="datetime-local" className="ui-input"/></label>
              <label className="space-y-2 text-sm font-semibold text-slate-700 md:col-span-2"><span>Horários</span><input name="horarios" className="ui-input" placeholder="06:00, 12:00, 18:00, 00:00"/></label>
              <label className="space-y-2 text-sm font-semibold text-slate-700 md:col-span-2"><span>Aprazamento</span><input name="aprazamento" className="ui-input" placeholder="Horários ou programação institucional"/></label>
              <label className="space-y-2 text-sm font-semibold text-slate-700"><span>Diluente</span><input name="diluente" className="ui-input"/></label>
              <label className="space-y-2 text-sm font-semibold text-slate-700"><span>Velocidade de infusão</span><input name="velocidade_infusao" className="ui-input"/></label>
              <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 text-sm font-semibold text-slate-700"><input type="checkbox" name="se_necessario"/>Se necessário / PRN</label>
              <label className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-800"><input type="checkbox" name="requer_validacao_farmaceutica"/>Exigir validação farmacêutica</label>
              <label className="space-y-2 text-sm font-semibold text-slate-700 md:col-span-2"><span>Instruções</span><textarea name="instrucoes" rows={3} className="ui-input"/></label>
              <label className="space-y-2 text-sm font-semibold text-slate-700 md:col-span-2"><span>Orientações</span><textarea name="orientacoes" rows={3} className="ui-input"/></label>
            </div>
            <div className="mt-5 flex justify-end border-t border-slate-100 pt-4"><button className="ui-button-primary">Salvar rascunho</button></div>
          </form>
        </section>
      ) : profissional ? (
        <section className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-600">Seu perfil permite consultar prescrições, mas não criar novos itens.</section>
      ) : null}

      <section className="his-card mt-6 overflow-hidden">
        <div className="border-b border-slate-100 p-5"><h2 className="font-black text-slate-900">Prescrições deste atendimento</h2><p className="mt-1 text-sm text-slate-500">Somente prescrições do episódio atual. Itens de outros profissionais permanecem visíveis para continuidade do cuidado, mas não podem ser alterados por este usuário.</p></div>
        <div className="divide-y divide-slate-100">
          {prescricoes.length ? prescricoes.map((item) => {
            const autor = one(item.profissional);
            const propria = profissional?.id === item.profissional_id;
            return (
              <article key={item.id} className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2"><p className="font-black text-slate-900">{item.item}</p>{item.se_necessario ? <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-black text-amber-700">PRN</span> : null}</div>
                    <p className="mt-1 text-sm text-slate-600">{item.dose || "—"} · {item.via || "—"} · {item.frequencia || "—"}{item.duracao ? ` · ${item.duracao}` : ""}</p>
                    <p className="mt-1 text-xs text-slate-500">{autor?.nome_completo ?? "Profissional"} · {fmtData(item.created_at)}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2"><span className={`rounded-full px-2.5 py-1 text-[11px] font-black ${item.status === "ativa" ? "bg-emerald-50 text-emerald-700" : item.status === "rascunho" ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-600"}`}>{item.status}</span>{!propria ? <span className="rounded-full bg-violet-50 px-2.5 py-1 text-[10px] font-bold text-violet-700">Outro profissional</span> : null}</div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2 text-xs">{item.assinado_em ? <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-1 font-bold text-brand-700"><ShieldCheck className="size-3.5"/>Assinada em {fmtData(item.assinado_em)}</span> : <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 font-bold text-amber-700"><Clock3 className="size-3.5"/>Aguardando assinatura</span>}{item.requer_validacao_farmaceutica ? <span className="rounded-full bg-violet-50 px-2.5 py-1 font-bold text-violet-700">Validação farmacêutica</span> : null}</div>
                {item.instrucoes ? <p className="mt-3 text-sm text-slate-700"><b>Instruções:</b> {item.instrucoes}</p> : null}
                {item.orientacoes ? <p className="mt-1 text-sm text-slate-700"><b>Orientações:</b> {item.orientacoes}</p> : null}
                {item.motivo_suspensao ? <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600"><b>Suspensão:</b> {item.motivo_suspensao} · {fmtData(item.suspenso_em)}</div> : null}
                {propria && ((canSign && item.status === "rascunho" && !item.assinado_em) || (canSuspend && item.status === "ativa")) ? (
                  <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
                    {canSign && item.status === "rascunho" && !item.assinado_em ? <form action={assinarPrescricaoMedica}><input type="hidden" name="atendimento_id" value={atendimentoId}/><input type="hidden" name="prescricao_id" value={item.id}/><button className="ui-button-primary"><ShieldCheck className="size-4"/>Assinar e ativar</button></form> : null}
                    {canSuspend && item.status === "ativa" ? <form action={suspenderPrescricaoMedica} className="flex min-w-[280px] flex-1 gap-2"><input type="hidden" name="atendimento_id" value={atendimentoId}/><input type="hidden" name="prescricao_id" value={item.id}/><input name="motivo" required className="ui-input" placeholder="Motivo da suspensão"/><button className="btn-secondary text-rose-700"><Ban className="size-4"/>Suspender</button></form> : null}
                  </div>
                ) : null}
              </article>
            );
          }) : <div className="p-10 text-center"><AlertTriangle className="mx-auto size-6 text-slate-300"/><p className="mt-2 text-sm font-semibold text-slate-500">Nenhuma prescrição registrada neste atendimento.</p></div>}
        </div>
      </section>
    </SectionPage>
  );
}
