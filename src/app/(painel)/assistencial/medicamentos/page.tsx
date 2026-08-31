import { ClipboardCheck, PackageCheck, Pill, ShieldCheck, Undo2 } from "lucide-react";
import { PharmacyBackgroundForm } from "@/components/farmacia/pharmacy-background-form";
import { SectionPage } from "@/components/painel/section-page";
import { getAssistencialContext } from "@/modules/assistencial/context";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Paciente = { nome_completo: string | null; ra: string | null; numero_registro: string | number | null };
type Atendimento = { id?: string; numero_atendimento: string | number | null; paciente: Paciente | Paciente[] | null };
type Validacao = { status: string | null; intervencao: string | null };
type Prescricao = {
  id: string;
  item: string;
  dose: string | null;
  via: string | null;
  frequencia: string | null;
  quantidade: number | null;
  unidade_dose: string | null;
  requer_validacao_farmaceutica: boolean;
  assinado_em: string | null;
  status: string;
  produto_id: string | null;
  atendimento_id: string;
  atendimento: Atendimento | Atendimento[] | null;
  validacao: Validacao | Validacao[] | null;
};
type ItemComponente = { descricao: string; concentracao: string | null; apresentacao: string | null };
type Componente = {
  id: string;
  prescricao_id: string;
  item_assistencial_id: string;
  dose: string | null;
  quantidade: number | null;
  unidade_dose: string | null;
  ordem: number;
  observacoes: string | null;
  item: ItemComponente | ItemComponente[] | null;
};
type Produto = { id: string; item_assistencial_id: string | null; descricao: string; codigo: string; codigo_barras: string | null; unidade_medida: string };
type LoteProduto = { codigo: string; descricao: string; codigo_barras: string | null; unidade_medida: string };
type LocalEstoque = { id?: string; nome: string; ativo: boolean; eh_farmacia: boolean; farmacia_tipo: string | null; prioridade_atendimento: number | null };
type Lote = {
  id: string;
  produto_id: string;
  local_id: string;
  numero_lote: string | null;
  validade: string | null;
  quantidade: number;
  status: string;
  bloqueio_motivo: string | null;
  produto: LoteProduto | LoteProduto[] | null;
  local: LocalEstoque | LocalEstoque[] | null;
};
type CatalogoLocal = {
  local_id: string;
  produto_id: string;
  padrao: boolean;
  permite_dispensacao: boolean;
  ativo: boolean;
  local: LocalEstoque | LocalEstoque[] | null;
};
type Dispensacao = {
  id: string;
  prescricao_id: string | null;
  prescricao_componente_id: string | null;
  item: string;
  lote: string | null;
  validade: string | null;
  quantidade_atendida: number | null;
  quantidade: number;
  quantidade_devolvida: number;
  dispensado_em: string | null;
  status: string;
  selecao_lote: string;
  fefo_sequencia: number | null;
};
type AtendimentoAtivo = { id: string; numero_atendimento: string | number | null; status: string; paciente: Paciente | Paciente[] | null };
type Conciliacao = {
  id: string;
  atendimento_id: string;
  momento: string;
  medicamento: string;
  decisao: string;
  divergencia: string | null;
  justificativa: string | null;
  conciliado_em: string;
};

type FefoPreview = {
  localId: string | null;
  localNome: string | null;
  lotes: Array<{ id: string; numero: string; validade: string; quantidade: number }>;
  saldoTotal: number;
};

function one<T>(value: T | T[] | null) {
  return Array.isArray(value) ? value[0] ?? null : value;
}

function when(value: string | null | undefined) {
  return value
    ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(value))
    : "—";
}

function friendlyError(raw: string) {
  const code = raw.trim();
  const messages: Record<string, string> = {
    FARMACIA_ESTOQUE_FEFO_INSUFICIENTE: "Estoque FEFO válido insuficiente. Confira lotes disponíveis, validade e farmácia configurada.",
    FARMACIA_PRODUTO_SEM_LOCAL_DISPENSACAO: "O produto não está habilitado para dispensação em uma farmácia desta unidade.",
    FARMACIA_VALIDACAO_FARMACEUTICA_PENDENTE: "A prescrição ainda precisa de validação farmacêutica antes da dispensação.",
    FARMACIA_PRESCRICAO_SEM_PRODUTO_ESTOQUE: "A prescrição ainda não está vinculada a um produto de estoque.",
    FARMACIA_COMPONENTE_SEM_PRODUTO_ESTOQUE: "O componente ainda não está vinculado a um produto de estoque.",
    FARMACIA_DEVOLUCAO_SUPERIOR_SALDO: "A quantidade informada é maior que o saldo disponível para devolução.",
    CONCILIACAO_SEM_PERMISSAO: "Seu perfil não possui permissão para registrar conciliação medicamentosa.",
  };
  return messages[code] ?? code.replaceAll("_", " ").toLowerCase();
}

function fefoPreview(produtoId: string | null, lotes: Lote[], catalogos: CatalogoLocal[]): FefoPreview {
  if (!produtoId) return { localId: null, localNome: null, lotes: [], saldoTotal: 0 };
  const hoje = new Date().toISOString().slice(0, 10);
  const locais = catalogos
    .filter((c) => c.produto_id === produtoId && c.ativo && c.permite_dispensacao && one(c.local)?.ativo && one(c.local)?.eh_farmacia)
    .sort((a, b) => {
      if (a.padrao !== b.padrao) return a.padrao ? -1 : 1;
      return (one(a.local)?.prioridade_atendimento ?? 100) - (one(b.local)?.prioridade_atendimento ?? 100);
    });
  const escolhido = locais[0];
  if (!escolhido) return { localId: null, localNome: null, lotes: [], saldoTotal: 0 };
  const elegiveis = lotes
    .filter((l) => l.produto_id === produtoId && l.local_id === escolhido.local_id && l.status === "disponivel" && Number(l.quantidade) > 0 && !!l.validade && l.validade >= hoje)
    .sort((a, b) => `${a.validade}-${a.id}`.localeCompare(`${b.validade}-${b.id}`));
  return {
    localId: escolhido.local_id,
    localNome: one(escolhido.local)?.nome ?? null,
    lotes: elegiveis.map((l) => ({ id: l.id, numero: l.numero_lote ?? "s/lote", validade: l.validade!, quantidade: Number(l.quantidade) })),
    saldoTotal: elegiveis.reduce((sum, l) => sum + Number(l.quantidade), 0),
  };
}

function alocacaoTexto(preview: FefoPreview, quantidade: number) {
  if (!preview.lotes.length) return "Nenhum lote válido disponível por FEFO.";
  let restante = quantidade;
  const usados: string[] = [];
  for (const lote of preview.lotes) {
    if (restante <= 0) break;
    const usar = Math.min(restante, lote.quantidade);
    if (usar > 0) usados.push(`${lote.numero} (${lote.validade}) · ${usar}`);
    restante -= usar;
  }
  if (restante > 0) return `Saldo FEFO insuficiente: faltam ${restante}.`;
  return usados.join(" → ");
}

export default async function MedicamentosPage({ searchParams }: { searchParams: Promise<{ sucesso?: string; erro?: string; lotes?: string }> }) {
  const sp = await searchParams;
  const { supabase, empresaId, unidadeId } = await getAssistencialContext();

  const [pRes, cRes, produtosRes, lotesRes, catalogosRes, dRes, aRes, conciliacoesRes] = await Promise.all([
    supabase
      .from("prescricoes")
      .select("id,atendimento_id,item,dose,via,frequencia,quantidade,unidade_dose,requer_validacao_farmaceutica,assinado_em,status,produto_id,atendimento:atendimentos(id,numero_atendimento,paciente:pacientes(nome_completo,ra,numero_registro)),validacao:validacoes_farmaceuticas(status,intervencao)")
      .eq("empresa_id", empresaId)
      .eq("unidade_id", unidadeId)
      .eq("tipo", "medicamento")
      .eq("status", "ativa")
      .not("assinado_em", "is", null)
      .order("created_at", { ascending: false })
      .limit(150),
    supabase
      .from("prescricao_componentes")
      .select("id,prescricao_id,item_assistencial_id,dose,quantidade,unidade_dose,ordem,observacoes,item:itens_assistenciais(descricao,concentracao,apresentacao)")
      .eq("empresa_id", empresaId)
      .eq("unidade_id", unidadeId)
      .order("ordem"),
    supabase.from("estoque_produtos").select("id,item_assistencial_id,descricao,codigo,codigo_barras,unidade_medida").eq("empresa_id", empresaId).eq("ativo", true).not("item_assistencial_id", "is", null).limit(3000),
    supabase
      .from("estoque_lotes")
      .select("id,produto_id,local_id,numero_lote,validade,quantidade,status,bloqueio_motivo,produto:estoque_produtos(codigo,descricao,codigo_barras,unidade_medida),local:estoque_locais(nome,ativo,eh_farmacia,farmacia_tipo,prioridade_atendimento)")
      .eq("empresa_id", empresaId)
      .eq("unidade_id", unidadeId)
      .gt("quantidade", 0)
      .order("validade", { ascending: true })
      .limit(3000),
    supabase
      .from("farmacia_catalogo_local")
      .select("local_id,produto_id,padrao,permite_dispensacao,ativo,local:estoque_locais(nome,ativo,eh_farmacia,farmacia_tipo,prioridade_atendimento)")
      .eq("empresa_id", empresaId)
      .eq("unidade_id", unidadeId)
      .eq("ativo", true)
      .limit(5000),
    supabase
      .from("dispensacoes_medicamentos")
      .select("id,prescricao_id,prescricao_componente_id,item,lote,validade,quantidade,quantidade_atendida,quantidade_devolvida,dispensado_em,status,selecao_lote,fefo_sequencia")
      .eq("empresa_id", empresaId)
      .eq("unidade_id", unidadeId)
      .order("dispensado_em", { ascending: false })
      .limit(150),
    supabase
      .from("atendimentos")
      .select("id,numero_atendimento,status,paciente:pacientes(nome_completo,ra,numero_registro)")
      .eq("empresa_id", empresaId)
      .eq("unidade_id", unidadeId)
      .in("status", ["aberto", "em_espera", "em_atendimento"])
      .order("data_abertura", { ascending: false })
      .limit(100),
    supabase
      .from("conciliacoes_medicamentosas")
      .select("id,atendimento_id,momento,medicamento,decisao,divergencia,justificativa,conciliado_em")
      .eq("empresa_id", empresaId)
      .eq("unidade_id", unidadeId)
      .order("conciliado_em", { ascending: false })
      .limit(40),
  ]);

  const prescricoes = (pRes.data ?? []) as unknown as Prescricao[];
  const componentes = (cRes.data ?? []) as unknown as Componente[];
  const produtos = (produtosRes.data ?? []) as unknown as Produto[];
  const lotes = (lotesRes.data ?? []) as unknown as Lote[];
  const catalogos = (catalogosRes.data ?? []) as unknown as CatalogoLocal[];
  const dispensacoes = (dRes.data ?? []) as unknown as Dispensacao[];
  const atendimentos = (aRes.data ?? []) as unknown as AtendimentoAtivo[];
  const conciliacoes = (conciliacoesRes.data ?? []) as unknown as Conciliacao[];

  const validacaoPendente = prescricoes.filter((p) => p.requer_validacao_farmaceutica && !["validada", "validada_com_ressalva"].includes(one(p.validacao)?.status ?? "")).length;
  const componentesPendentes = componentes.filter((c) => prescricoes.some((p) => p.id === c.prescricao_id) && !dispensacoes.some((d) => d.prescricao_componente_id === c.id && ["dispensado", "parcial"].includes(d.status))).length;
  const lotesBloqueados = lotes.filter((l) => l.status !== "disponivel").length;

  return (
    <SectionPage
      eyebrow="Assistencial / Farmácia"
      title="Farmácia Clínica e Dispensação"
      description="Validação farmacêutica, conciliação, FEFO automático, rastreabilidade por lote e devolução. A administração permanece exclusiva da Enfermagem."
    >
      {sp.sucesso ? (
        <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
          Operação concluída: {sp.sucesso.replaceAll("-", " ")}{sp.lotes ? ` · ${sp.lotes} lote(s) utilizado(s)` : ""}.
        </div>
      ) : null}
      {sp.erro ? (
        <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
          Operação bloqueada: {friendlyError(sp.erro)}.
        </div>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Kpi label="Prescrições ativas" value={prescricoes.length} tone="brand" />
        <Kpi label="Validação pendente" value={validacaoPendente} tone="violet" />
        <Kpi label="Componentes a dispensar" value={componentesPendentes} tone="amber" />
        <Kpi label="Dispensações recentes" value={dispensacoes.length} tone="emerald" />
        <Kpi label="Lotes bloqueados/quarentena" value={lotesBloqueados} tone="rose" />
      </section>

      <section className="his-card mt-5 overflow-hidden">
        <div className="border-b border-slate-100 p-5">
          <div className="flex items-center gap-3">
            <ClipboardCheck className="size-5 text-cyan-700" />
            <div>
              <h2 className="font-black">Conciliação medicamentosa</h2>
              <p className="text-sm text-slate-500">Registre medicamentos de uso domiciliar na admissão, transferência ou alta e documente a decisão clínica.</p>
            </div>
          </div>
        </div>
        <div className="grid gap-5 p-5 xl:grid-cols-[1.35fr_.85fr]">
          <PharmacyBackgroundForm kind="reconciliation" resetOnSuccess className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <label className="text-xs font-bold text-slate-600 sm:col-span-2 xl:col-span-2">
              Atendimento
              <select name="atendimento_id" required defaultValue="" className="ui-input mt-1">
                <option value="">Selecione o paciente / atendimento</option>
                {atendimentos.map((a) => {
                  const paciente = one(a.paciente);
                  return <option key={a.id} value={a.id}>{paciente?.nome_completo ?? "Paciente"} · RA {paciente?.ra ?? "—"} · #{a.numero_atendimento ?? "—"}</option>;
                })}
              </select>
            </label>
            <label className="text-xs font-bold text-slate-600">
              Momento
              <select name="momento" defaultValue="admissao" className="ui-input mt-1"><option value="admissao">Admissão</option><option value="transferencia">Transferência</option><option value="alta">Alta</option></select>
            </label>
            <label className="text-xs font-bold text-slate-600 sm:col-span-2">
              Medicamento de uso domiciliar
              <input name="medicamento" required className="ui-input mt-1" placeholder="Nome, concentração e apresentação" />
            </label>
            <label className="text-xs font-bold text-slate-600">Decisão<select name="decisao" defaultValue="manter" className="ui-input mt-1"><option value="manter">Manter</option><option value="ajustar">Ajustar</option><option value="substituir">Substituir</option><option value="suspender">Suspender</option><option value="incluir">Incluir</option></select></label>
            <label className="text-xs font-bold text-slate-600">Dose<input name="dose_domiciliar" className="ui-input mt-1" placeholder="Ex.: 500 mg" /></label>
            <label className="text-xs font-bold text-slate-600">Via<input name="via_domiciliar" className="ui-input mt-1" placeholder="VO, EV..." /></label>
            <label className="text-xs font-bold text-slate-600">Frequência<input name="frequencia_domiciliar" className="ui-input mt-1" placeholder="8/8h, à noite..." /></label>
            <label className="text-xs font-bold text-slate-600">Fonte<input name="fonte_informacao" className="ui-input mt-1" placeholder="Paciente, receita, familiar..." /></label>
            <label className="text-xs font-bold text-slate-600 sm:col-span-2">Divergência<input name="divergencia" className="ui-input mt-1" placeholder="Diferença encontrada entre uso domiciliar e prescrição atual" /></label>
            <label className="flex items-center gap-2 self-end rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-bold text-slate-700"><input name="intencional" type="checkbox" /> Divergência intencional</label>
            <label className="text-xs font-bold text-slate-600 sm:col-span-2">Justificativa<textarea name="justificativa" rows={2} className="ui-input mt-1" placeholder="Justificativa clínica / farmacêutica" /></label>
            <label className="text-xs font-bold text-slate-600">Observações<textarea name="observacoes" rows={2} className="ui-input mt-1" /></label>
            <div className="sm:col-span-2 xl:col-span-3"><button className="ui-button-primary">Registrar conciliação</button></div>
          </PharmacyBackgroundForm>

          <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
            <h3 className="text-sm font-black text-slate-900">Últimas conciliações</h3>
            <div className="mt-3 max-h-80 space-y-2 overflow-auto">
              {conciliacoes.length ? conciliacoes.map((c) => {
                const atendimento = atendimentos.find((a) => a.id === c.atendimento_id);
                const paciente = one(atendimento?.paciente ?? null);
                return <article key={c.id} className="rounded-xl border border-slate-200 bg-white p-3"><div className="flex flex-wrap items-center justify-between gap-2"><strong className="text-sm text-slate-900">{c.medicamento}</strong><span className="rounded-full bg-cyan-50 px-2 py-1 text-[10px] font-black uppercase text-cyan-700">{c.momento}</span></div><p className="mt-1 text-xs text-slate-500">{paciente?.nome_completo ?? `Atendimento ${c.atendimento_id.slice(0, 8)}`} · decisão: {c.decisao} · {when(c.conciliado_em)}</p>{c.divergencia ? <p className="mt-2 text-xs text-amber-700">Divergência: {c.divergencia}</p> : null}</article>;
              }) : <p className="text-sm text-slate-500">Nenhuma conciliação registrada nesta unidade.</p>}
            </div>
          </div>
        </div>
      </section>

      <section className="his-card mt-5 overflow-hidden">
        <div className="border-b border-slate-100 p-5">
          <div className="flex items-center gap-3">
            <ShieldCheck className="size-5 text-violet-700" />
            <div><h2 className="font-black">Prescrições liberadas para a Farmácia</h2><p className="text-sm text-slate-500">Após validação, a dispensação escolhe automaticamente o lote com vencimento mais próximo e válido.</p></div>
          </div>
        </div>
        <div className="divide-y divide-slate-100">
          {prescricoes.length ? prescricoes.map((p) => {
            const atendimento = one(p.atendimento);
            const paciente = one(atendimento?.paciente ?? null);
            const validacao = one(p.validacao);
            const comps = componentes.filter((c) => c.prescricao_id === p.id);
            const validada = !p.requer_validacao_farmaceutica || ["validada", "validada_com_ressalva"].includes(validacao?.status ?? "");
            const previewPrincipal = fefoPreview(p.produto_id, lotes, catalogos);
            const quantidadePrincipal = Number(p.quantidade ?? 1);
            return (
              <article key={p.id} className="p-5">
                <div className="flex flex-col gap-4 xl:flex-row xl:justify-between">
                  <div className="min-w-0 xl:max-w-md">
                    <div className="flex flex-wrap items-center gap-2"><p className="font-black text-slate-900">{p.item}</p><span className="rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-black text-emerald-700">assinada</span></div>
                    <p className="mt-1 text-sm text-slate-600">{p.dose ?? "—"} · {p.via ?? "—"} · {p.frequencia ?? "—"}</p>
                    <p className="mt-1 text-xs text-slate-500">{paciente?.nome_completo ?? "Paciente"} · RA {paciente?.ra ?? "—"} · Atend. #{atendimento?.numero_atendimento ?? "—"}</p>
                    {p.requer_validacao_farmaceutica ? <p className="mt-2 text-xs font-bold text-violet-700">Farmácia: {validacao?.status ?? "pendente"}</p> : null}
                  </div>

                  <div className="w-full xl:max-w-4xl">
                    {!validada ? (
                      <PharmacyBackgroundForm kind="validation" className="rounded-xl border border-violet-100 bg-violet-50 p-3">
                        <input type="hidden" name="prescricao_id" value={p.id} />
                        <div className="grid gap-2 sm:grid-cols-3">{[["alergias", "Alergias"], ["interacoes", "Interações"], ["dose", "Dose"], ["via", "Via"], ["funcao_renal", "Função renal"], ["duplicidade", "Duplicidade"]].map(([name, label]) => <label key={name} className="text-xs font-bold text-violet-900"><input name={name} type="checkbox" className="mr-1.5" />{label}</label>)}</div>
                        <textarea name="incompatibilidades" rows={2} className="ui-input mt-2" placeholder="Incompatibilidades identificadas" />
                        <textarea name="intervencao" rows={2} className="ui-input mt-2" placeholder="Intervenção farmacêutica / observações" />
                        <div className="mt-2 flex flex-col gap-2 sm:flex-row"><select name="status" className="ui-input" defaultValue="validada"><option value="validada">Validar</option><option value="validada_com_ressalva">Validar com ressalva</option><option value="intervencao">Solicitar intervenção</option><option value="rejeitada">Rejeitar</option></select><button className="ui-button-primary">Registrar validação</button></div>
                      </PharmacyBackgroundForm>
                    ) : (
                      <div className="space-y-3">
                        {p.produto_id ? (
                          <PharmacyBackgroundForm kind="dispense" className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-3">
                            <input type="hidden" name="prescricao_id" value={p.id} />
                            <input type="hidden" name="farmacia_local_id" value={previewPrincipal.localId ?? ""} />
                            <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
                              <div className="min-w-0 flex-1"><p className="text-xs font-black uppercase text-emerald-700">Item principal · FEFO automático</p><p className="mt-1 text-sm font-bold text-slate-900">{previewPrincipal.localNome ?? "Farmácia não configurada"}</p><p className="mt-1 text-xs text-slate-600">{alocacaoTexto(previewPrincipal, quantidadePrincipal)}</p><p className="mt-1 text-[11px] text-slate-500">Saldo válido no local: {previewPrincipal.saldoTotal}</p></div>
                              <label className="text-xs font-bold text-slate-600">Quantidade<input name="quantidade" required type="number" step="0.0001" min="0.0001" defaultValue={quantidadePrincipal} className="ui-input mt-1 w-28" /></label>
                              <button disabled={!previewPrincipal.localId || previewPrincipal.saldoTotal <= 0} className="ui-button-primary whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-50"><PackageCheck className="size-4" />Dispensar FEFO</button>
                            </div>
                          </PharmacyBackgroundForm>
                        ) : <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-bold text-amber-800">Item principal sem produto de estoque vinculado.</p>}

                        {comps.map((c) => {
                          const item = one(c.item);
                          const produto = produtos.find((prod) => prod.item_assistencial_id === c.item_assistencial_id);
                          const preview = fefoPreview(produto?.id ?? null, lotes, catalogos);
                          const quantidade = Number(c.quantidade ?? 1);
                          const jaDispensado = dispensacoes.some((d) => d.prescricao_componente_id === c.id && ["dispensado", "parcial"].includes(d.status));
                          return (
                            <div key={c.id} className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-3">
                              <p className="text-xs font-black uppercase text-emerald-700">Componente {c.ordem}</p>
                              <p className="mt-1 font-bold text-slate-900">+ {item?.descricao ?? "Componente"}{c.dose ? ` · ${c.dose}` : ""}</p>
                              {jaDispensado ? <p className="mt-2 text-xs font-black text-emerald-700">Já possui dispensação ativa</p> : produto ? (
                                <PharmacyBackgroundForm kind="component-dispense" className="mt-2 flex flex-col gap-3 lg:flex-row lg:items-end">
                                  <input type="hidden" name="prescricao_componente_id" value={c.id} />
                                  <input type="hidden" name="farmacia_local_id" value={preview.localId ?? ""} />
                                  <div className="min-w-0 flex-1"><p className="text-xs font-bold text-slate-700">{preview.localNome ?? "Farmácia não configurada"}</p><p className="mt-1 text-xs text-slate-600">{alocacaoTexto(preview, quantidade)}</p></div>
                                  <label className="text-xs font-bold text-slate-600">Quantidade<input name="quantidade" required type="number" step="0.0001" min="0.0001" defaultValue={quantidade} className="ui-input mt-1 w-28" /></label>
                                  <button disabled={!preview.localId || preview.saldoTotal <= 0} className="ui-button-primary whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-50"><PackageCheck className="size-4" />Dispensar componente</button>
                                </PharmacyBackgroundForm>
                              ) : <p className="mt-2 text-xs font-bold text-amber-700">Componente sem vínculo item assistencial → produto de estoque.</p>}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </article>
            );
          }) : <p className="p-8 text-center text-sm text-slate-500">Nenhuma prescrição assinada aguardando Farmácia.</p>}
        </div>
      </section>

      <section className="his-card mt-5 overflow-hidden">
        <div className="border-b border-slate-100 p-5"><div className="flex items-center gap-3"><Pill className="size-5 text-brand-700" /><div><h2 className="font-black">Dispensações recentes / devolução</h2><p className="text-sm text-slate-500">Cada saída e devolução permanece rastreada por prescrição, lote, quantidade e origem FEFO/manual.</p></div></div></div>
        <div className="divide-y divide-slate-100">
          {dispensacoes.slice(0, 80).map((d) => {
            const quantidade = Number(d.quantidade_atendida ?? d.quantidade);
            const devolvida = Number(d.quantidade_devolvida ?? 0);
            const saldo = Math.max(0, quantidade - devolvida);
            return (
              <article key={d.id} className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2"><p className="font-bold">{d.item}</p><span className={`rounded-full px-2 py-1 text-[10px] font-black uppercase ${d.selecao_lote === "fefo" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>{d.selecao_lote === "fefo" ? `FEFO${d.fefo_sequencia ? ` #${d.fefo_sequencia}` : ""}` : "manual"}</span><span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-600">{d.status}</span></div>
                  <p className="mt-1 text-xs text-slate-500">Lote {d.lote ?? "—"} · validade {d.validade ?? "—"} · {when(d.dispensado_em)} · dispensado {quantidade} · devolvido {devolvida} · saldo {saldo}{d.prescricao_componente_id ? " · componente" : ""}</p>
                </div>
                {saldo > 0 && ["dispensado", "parcial"].includes(d.status) ? (
                  <PharmacyBackgroundForm kind="return" className="flex flex-col gap-2 sm:flex-row sm:items-end">
                    <input type="hidden" name="dispensacao_id" value={d.id} />
                    <label className="text-xs font-bold text-slate-600">Qtd.<input name="quantidade" required type="number" step="0.0001" min="0.0001" max={saldo} defaultValue={saldo} className="ui-input mt-1 w-24" /></label>
                    <label className="text-xs font-bold text-slate-600">Motivo<input name="motivo" required className="ui-input mt-1 min-w-56" placeholder="Sobra, suspensão, alta..." /></label>
                    <button className="ui-button-secondary whitespace-nowrap"><Undo2 className="size-4" />Devolver</button>
                  </PharmacyBackgroundForm>
                ) : <span className="text-xs font-bold text-slate-400">Sem saldo para devolução</span>}
              </article>
            );
          })}
          {!dispensacoes.length ? <p className="p-8 text-center text-sm text-slate-500">Nenhuma dispensação registrada.</p> : null}
        </div>
      </section>
    </SectionPage>
  );
}

function Kpi({ label, value, tone }: { label: string; value: number; tone: "brand" | "violet" | "amber" | "emerald" | "rose" }) {
  const tones = { brand: "text-brand-950", violet: "text-violet-700", amber: "text-amber-700", emerald: "text-emerald-700", rose: "text-rose-700" } as const;
  return <div className="his-kpi"><p className="text-xs font-black uppercase text-slate-400">{label}</p><p className={`mt-2 text-3xl font-black ${tones[tone]}`}>{value}</p></div>;
}
