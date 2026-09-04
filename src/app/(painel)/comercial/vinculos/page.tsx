import type { Route } from "next";
import Link from "next/link";
import { ArrowLeftRight, History, Link2, Settings2, Unlink } from "lucide-react";
import { CadastrosWorkspaceNav, CadastroKpi } from "@/components/cadastros/cadastros-workspace-nav";
import {
  CommercialNegotiationBackgroundForm,
  CommercialTableLinkBackgroundForm,
} from "@/components/comercial/commercial-workspace-background-forms";
import { CommercialLinkMaintenanceActions } from "@/components/comercial/commercial-link-maintenance-actions";
import { SectionPage } from "@/components/painel/section-page";
import { requireAnyPermission } from "@/lib/permissions/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const CATEGORIAS = [
  ["geral", "Geral"],
  ["procedimentos", "Procedimentos"],
  ["cirurgias", "Cirurgias"],
  ["sadt", "SADT / exames"],
  ["honorarios", "Honorários"],
  ["anestesia", "Anestesia"],
  ["auxiliares", "Auxiliares"],
  ["diarias", "Diárias"],
  ["taxas", "Taxas"],
  ["gases", "Gases medicinais"],
  ["materiais", "Materiais"],
  ["medicamentos", "Medicamentos"],
  ["opme", "OPME"],
  ["pacotes", "Pacotes"],
  ["outra", "Outra"],
] as const;

type Rel<T> = T | T[] | null;
type Convenio = { nome_fantasia: string | null; registro_ans: string | null };
type Contrato = {
  id: string;
  convenio_id: string;
  numero_contrato: string | null;
  status: string;
  data_inicio: string | null;
  data_fim: string | null;
  convenio: Rel<Convenio>;
};
type Fonte = { id: string; codigo: string; nome: string; tipo: string };
type Edicao = { id: string; fonte_id: string; nome_edicao: string; referencia: string | null; status: string; vigencia_inicio: string; vigencia_fim: string | null };
type Vinculo = {
  id: string;
  contrato_id: string;
  fonte_id: string;
  edicao_fixa_id: string | null;
  categoria: string;
  modo_edicao: string;
  percentual_ajuste: number;
  prioridade: number;
  valor_ch: number | null;
  valor_hm: number | null;
  valor_sadt: number | null;
  valor_uco_contratual: number | null;
  valor_filme_m2: number | null;
  base_preco: string | null;
  regras_adicionais: Record<string, unknown> | null;
  arredondamento_casas: number;
  ativo: boolean;
  observacoes: string | null;
  desvinculado_em: string | null;
  motivo_desvinculo: string | null;
  fonte: Rel<Fonte>;
};
type Depara = { id: string; vinculo_id: string | null; origem_mapeamento: string; ativo: boolean };
type Evento = { id: string; entidade_tipo: string; entidade_id: string; acao: string; antes: Record<string, unknown> | null; depois: Record<string, unknown> | null; created_at: string };
type SearchParams = { contrato?: string; status?: string };

const one = <T,>(value: Rel<T>): T | null => Array.isArray(value) ? value[0] ?? null : value;
const numberFromRule = (rules: Record<string, unknown> | null, key: string) => {
  const value = rules?.[key];
  return typeof value === "number" || typeof value === "string" ? String(value) : "0";
};
const localDateTime = (value: string | null) => value ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(value)) : "—";
const categoryLabel = (value: string) => CATEGORIAS.find(([code]) => code === value)?.[1] ?? value;

function pageHref(contrato: string, status?: string): Route {
  const qs = new URLSearchParams({ contrato });
  if (status) qs.set("status", status);
  return `/comercial/vinculos?${qs.toString()}` as Route;
}

export default async function ComercialVinculosPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const { supabase, empresaId, unidadeId } = await requireAnyPermission([
    "comercial.visualizar",
    "comercial.editar",
    "credenciamento.visualizar",
    "credenciamento.gerenciar",
    "tabelas_comerciais.visualizar",
    "tabelas_comerciais.gerenciar",
  ]);

  const [contractsReq, fontesReq, edicoesReq, canEditReq] = await Promise.all([
    supabase.from("credenciamento_contratos")
      .select("id,convenio_id,numero_contrato,status,data_inicio,data_fim,convenio:convenios(nome_fantasia,registro_ans)")
      .eq("empresa_id", empresaId)
      .order("created_at", { ascending: false })
      .limit(250),
    supabase.from("tabelas_comerciais_fontes")
      .select("id,codigo,nome,tipo")
      .eq("empresa_id", empresaId)
      .eq("ativo", true)
      .order("nome"),
    supabase.from("tabelas_comerciais_edicoes")
      .select("id,fonte_id,nome_edicao,referencia,status,vigencia_inicio,vigencia_fim")
      .order("vigencia_inicio", { ascending: false })
      .limit(1000),
    supabase.rpc("comercial_pode_editar", { p_empresa: empresaId, p_unidade: unidadeId }),
  ]);

  const contratos = (contractsReq.data ?? []) as unknown as Contrato[];
  const fontes = (fontesReq.data ?? []) as Fonte[];
  const edicoes = (edicoesReq.data ?? []) as Edicao[];
  const canEdit = canEditReq.data === true && !canEditReq.error;
  const selected = contratos.find((item) => item.id === sp.contrato)
    ?? contratos.find((item) => item.status === "ativo")
    ?? contratos[0]
    ?? null;

  let vinculos: Vinculo[] = [];
  let deparas: Depara[] = [];
  let eventos: Evento[] = [];
  if (selected) {
    const [vincReq, depReq, eventReq] = await Promise.all([
      supabase.from("contrato_tabelas_comerciais")
        .select("id,contrato_id,fonte_id,edicao_fixa_id,categoria,modo_edicao,percentual_ajuste,prioridade,valor_ch,valor_hm,valor_sadt,valor_uco_contratual,valor_filme_m2,base_preco,regras_adicionais,arredondamento_casas,ativo,observacoes,desvinculado_em,motivo_desvinculo,fonte:tabelas_comerciais_fontes(id,codigo,nome,tipo)")
        .eq("contrato_id", selected.id)
        .order("ativo", { ascending: false })
        .order("prioridade"),
      supabase.from("contrato_depara_tuss")
        .select("id,vinculo_id,origem_mapeamento,ativo")
        .eq("contrato_id", selected.id),
      supabase.from("comercial_eventos")
        .select("id,entidade_tipo,entidade_id,acao,antes,depois,created_at")
        .eq("contexto_contrato_id", selected.id)
        .in("entidade_tipo", ["contrato_tabelas_comerciais", "contrato_depara_tuss", "contrato_regras_faturamento"])
        .order("created_at", { ascending: false })
        .limit(100),
    ]);
    vinculos = (vincReq.data ?? []) as unknown as Vinculo[];
    deparas = (depReq.data ?? []) as Depara[];
    eventos = (eventReq.data ?? []) as Evento[];
  }

  const activeLinks = vinculos.filter((item) => item.ativo);
  const inactiveLinks = vinculos.filter((item) => !item.ativo);
  const autoDepara = deparas.filter((item) => item.ativo && item.origem_mapeamento !== "manual").length;
  const manualDepara = deparas.filter((item) => item.ativo && item.origem_mapeamento === "manual").length;
  const selectedConvenio = selected ? one(selected.convenio) : null;
  const statusFilter = sp.status === "ativos" || sp.status === "historico" ? sp.status : "todos";
  const visibleLinks = vinculos.filter((item) => statusFilter === "ativos" ? item.ativo : statusFilter === "historico" ? !item.ativo : true);

  return <SectionPage
    eyebrow="Comercial / Vínculos"
    title="Vínculos de tabelas e histórico"
    description="Área editável para negociar, desvincular, reativar e sincronizar tabelas comerciais sem apagar o histórico. DePara TUSS automático usa somente códigos ou equivalências explícitas."
    actions={selected ? <Link href={`/comercial/depara?contrato=${selected.id}` as Route} className="ui-button-secondary"><ArrowLeftRight className="size-4" />Abrir DePara TUSS</Link> : null}
  >
    <CadastrosWorkspaceNav active="/comercial/vinculos" />

    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      <CadastroKpi label="Vínculos ativos" value={activeLinks.length} detail="Participam da resolução comercial" />
      <CadastroKpi label="Históricos" value={inactiveLinks.length} detail="Desvinculados sem exclusão" />
      <CadastroKpi label="DePara automático" value={autoDepara} detail="Tabela ou equivalência explícita" />
      <CadastroKpi label="DePara manual" value={manualDepara} detail="Sempre tem prioridade" />
      <CadastroKpi label="Eventos" value={eventos.length} detail="Últimos eventos carregados" />
    </section>

    <div className="mt-5 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm leading-6 text-blue-950">
      <b>100% editável sem reescrever o passado:</b> valores, edição, base, prioridade e adicionais podem ser alterados no vínculo ativo. Para mudar fonte ou categoria, desvincule o vínculo anterior e crie o novo; assim o histórico anterior continua íntegro.
    </div>

    <div className="mt-5 grid gap-5 xl:grid-cols-[320px_minmax(0,1fr)]">
      <aside className="his-card h-fit p-4">
        <div className="mb-3 flex items-center gap-2"><Link2 className="size-5 text-brand-700" /><div><h2 className="font-black text-slate-900">Contratos</h2><p className="text-xs text-slate-500">Selecione o contrato a editar.</p></div></div>
        <div className="max-h-[680px] space-y-2 overflow-y-auto pr-1">
          {contratos.map((contrato) => {
            const convenio = one(contrato.convenio);
            const active = contrato.id === selected?.id;
            return <Link key={contrato.id} href={pageHref(contrato.id, statusFilter)} className={`block rounded-xl border p-3 ${active ? "border-brand-300 bg-brand-50" : "border-slate-100 hover:border-slate-200"}`}>
              <div className="flex items-start justify-between gap-2"><b className="truncate text-sm text-slate-900">{convenio?.nome_fantasia ?? "Convênio"}</b><span className="text-[10px] font-black uppercase text-slate-400">{contrato.status}</span></div>
              <p className="mt-1 text-xs text-slate-500">{contrato.numero_contrato || "Sem nº"} · ANS {convenio?.registro_ans || "—"}</p>
              <p className="mt-1 text-[11px] text-slate-400">{contrato.data_inicio || "sem início"} → {contrato.data_fim || "aberto"}</p>
            </Link>;
          })}
        </div>
      </aside>

      <main className="min-w-0 space-y-5">
        {selected ? <>
          <section className="his-card p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div><p className="text-xs font-black uppercase tracking-wider text-brand-600">Contrato selecionado</p><h2 className="mt-1 text-xl font-black text-slate-950">{selectedConvenio?.nome_fantasia ?? "Convênio"} · {selected.numero_contrato || "Sem nº"}</h2></div>
              <div className="flex gap-2">
                {(["todos", "ativos", "historico"] as const).map((status) => <Link key={status} href={pageHref(selected.id, status)} className={statusFilter === status ? "ui-button-primary" : "ui-button-secondary"}>{status === "historico" ? "Histórico" : status[0].toUpperCase() + status.slice(1)}</Link>)}
              </div>
            </div>
          </section>

          {canEdit ? <section className="his-card p-5">
            <div className="mb-4 flex items-center gap-2"><Link2 className="size-5 text-brand-700" /><div><h2 className="font-black text-slate-950">Novo vínculo</h2><p className="text-xs text-slate-500">Ao salvar, o DePara TUSS é sincronizado automaticamente.</p></div></div>
            <CommercialTableLinkBackgroundForm className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <input type="hidden" name="contrato_id" value={selected.id} />
              <label className="grid gap-1 text-xs font-bold text-slate-600">Tabela comercial<select name="fonte_id" required className="ui-input"><option value="">Selecione</option>{fontes.map((fonte) => <option key={fonte.id} value={fonte.id}>{fonte.codigo} · {fonte.nome}</option>)}</select></label>
              <label className="grid gap-1 text-xs font-bold text-slate-600">Categoria<select name="categoria" className="ui-input">{CATEGORIAS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
              <label className="grid gap-1 text-xs font-bold text-slate-600">Modo da edição<select name="modo_edicao" className="ui-input"><option value="vigente_na_data">Vigente na data</option><option value="edicao_fixa">Edição fixa</option></select></label>
              <label className="grid gap-1 text-xs font-bold text-slate-600">Edição fixa<select name="edicao_fixa_id" className="ui-input"><option value="">—</option>{edicoes.map((edicao) => <option key={edicao.id} value={edicao.id}>{edicao.nome_edicao}</option>)}</select></label>
              <label className="grid gap-1 text-xs font-bold text-slate-600">Base de preço<select name="base_preco" className="ui-input"><option value="">Conforme metodologia</option><option value="valor_referencia">Valor de referência</option><option value="valor_fabrica">Preço fábrica</option><option value="valor_pmc">PMC</option><option value="valor_maximo">Valor máximo</option></select></label>
              <label className="grid gap-1 text-xs font-bold text-slate-600">Ajuste %<input name="percentual_ajuste" defaultValue="0" className="ui-input" inputMode="decimal" /></label>
              <label className="grid gap-1 text-xs font-bold text-slate-600">Prioridade<input name="prioridade" defaultValue="100" className="ui-input" inputMode="numeric" /></label>
              <label className="grid gap-1 text-xs font-bold text-slate-600">Casas de arredondamento<input name="arredondamento_casas" defaultValue="2" min="0" max="6" className="ui-input" type="number" /></label>
              <label className="grid gap-1 text-xs font-bold text-slate-600">Valor CH<input name="valor_ch" className="ui-input" inputMode="decimal" /></label>
              <label className="grid gap-1 text-xs font-bold text-slate-600">Valor HM<input name="valor_hm" className="ui-input" inputMode="decimal" /></label>
              <label className="grid gap-1 text-xs font-bold text-slate-600">Valor SADT<input name="valor_sadt" className="ui-input" inputMode="decimal" /></label>
              <label className="grid gap-1 text-xs font-bold text-slate-600">Valor UCO<input name="valor_uco_contratual" className="ui-input" inputMode="decimal" /></label>
              <label className="grid gap-1 text-xs font-bold text-slate-600">Filme / m²<input name="valor_filme_m2" className="ui-input" inputMode="decimal" /></label>
              <label className="grid gap-1 text-xs font-bold text-slate-600">Urgência %<input name="urgencia_percentual" defaultValue="0" className="ui-input" inputMode="decimal" /></label>
              <label className="grid gap-1 text-xs font-bold text-slate-600">Acomodação %<input name="apartamento_percentual" defaultValue="0" className="ui-input" inputMode="decimal" /></label>
              <label className="grid gap-1 text-xs font-bold text-slate-600">Horário especial %<input name="horario_especial_percentual" defaultValue="0" className="ui-input" inputMode="decimal" /></label>
              <label className="grid gap-1 text-xs font-bold text-slate-600 md:col-span-2 xl:col-span-4">Observações<textarea name="observacoes" className="ui-input min-h-20" /></label>
            </CommercialTableLinkBackgroundForm>
          </section> : null}

          <section className="space-y-4">
            {visibleLinks.map((vinculo) => {
              const fonte = one(vinculo.fonte);
              const sourceEditions = edicoes.filter((item) => item.fonte_id === vinculo.fonte_id);
              const linkDepara = deparas.filter((item) => item.vinculo_id === vinculo.id && item.ativo);
              const autoCount = linkDepara.filter((item) => item.origem_mapeamento !== "manual").length;
              return <article key={vinculo.id} className={`his-card p-5 ${vinculo.ativo ? "" : "opacity-90"}`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div><div className="flex flex-wrap items-center gap-2"><h3 className="font-black text-slate-950">{fonte?.codigo ?? "Tabela"} · {fonte?.nome ?? vinculo.fonte_id}</h3><span className={`rounded-full px-2 py-1 text-[10px] font-black uppercase ${vinculo.ativo ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"}`}>{vinculo.ativo ? "Ativo" : "Histórico"}</span></div><p className="mt-1 text-xs text-slate-500">{categoryLabel(vinculo.categoria)} · prioridade {vinculo.prioridade} · {autoCount} DePara(s) automático(s)</p>{!vinculo.ativo ? <p className="mt-2 text-xs font-semibold text-slate-600">Desvinculado em {localDateTime(vinculo.desvinculado_em)} · {vinculo.motivo_desvinculo || "Sem motivo registrado"}</p> : null}</div>
                  <Link href={`/comercial/depara?contrato=${selected.id}&fonte=${vinculo.fonte_id}` as Route} className="ui-button-secondary"><ArrowLeftRight className="size-4" />Ver DePara</Link>
                </div>

                {vinculo.ativo && canEdit ? <CommercialNegotiationBackgroundForm className="mt-4 grid gap-3 rounded-2xl border border-slate-200 p-4 md:grid-cols-2 xl:grid-cols-4">
                  <input type="hidden" name="vinculo_id" value={vinculo.id} />
                  <input type="hidden" name="ativo" value="true" />
                  <label className="grid gap-1 text-xs font-bold text-slate-600">Modo da edição<select name="modo_edicao" defaultValue={vinculo.modo_edicao} className="ui-input"><option value="vigente_na_data">Vigente na data</option><option value="edicao_fixa">Edição fixa</option></select></label>
                  <label className="grid gap-1 text-xs font-bold text-slate-600">Edição fixa<select name="edicao_fixa_id" defaultValue={vinculo.edicao_fixa_id ?? ""} className="ui-input"><option value="">—</option>{sourceEditions.map((edicao) => <option key={edicao.id} value={edicao.id}>{edicao.nome_edicao} · {edicao.referencia || edicao.vigencia_inicio}</option>)}</select></label>
                  <label className="grid gap-1 text-xs font-bold text-slate-600">Base de preço<select name="base_preco" defaultValue={vinculo.base_preco ?? ""} className="ui-input"><option value="">Conforme metodologia</option><option value="valor_referencia">Valor de referência</option><option value="valor_fabrica">Preço fábrica</option><option value="valor_pmc">PMC</option><option value="valor_maximo">Valor máximo</option></select></label>
                  <label className="grid gap-1 text-xs font-bold text-slate-600">Ajuste %<input name="percentual_ajuste" defaultValue={String(vinculo.percentual_ajuste ?? 0)} className="ui-input" inputMode="decimal" /></label>
                  <label className="grid gap-1 text-xs font-bold text-slate-600">Prioridade<input name="prioridade" defaultValue={String(vinculo.prioridade)} className="ui-input" inputMode="numeric" /></label>
                  <label className="grid gap-1 text-xs font-bold text-slate-600">Arredondamento<input name="arredondamento_casas" defaultValue={String(vinculo.arredondamento_casas)} min="0" max="6" type="number" className="ui-input" /></label>
                  <label className="grid gap-1 text-xs font-bold text-slate-600">Valor CH<input name="valor_ch" defaultValue={vinculo.valor_ch ?? ""} className="ui-input" inputMode="decimal" /></label>
                  <label className="grid gap-1 text-xs font-bold text-slate-600">Valor HM<input name="valor_hm" defaultValue={vinculo.valor_hm ?? ""} className="ui-input" inputMode="decimal" /></label>
                  <label className="grid gap-1 text-xs font-bold text-slate-600">Valor SADT<input name="valor_sadt" defaultValue={vinculo.valor_sadt ?? ""} className="ui-input" inputMode="decimal" /></label>
                  <label className="grid gap-1 text-xs font-bold text-slate-600">Valor UCO<input name="valor_uco_contratual" defaultValue={vinculo.valor_uco_contratual ?? ""} className="ui-input" inputMode="decimal" /></label>
                  <label className="grid gap-1 text-xs font-bold text-slate-600">Filme / m²<input name="valor_filme_m2" defaultValue={vinculo.valor_filme_m2 ?? ""} className="ui-input" inputMode="decimal" /></label>
                  <label className="grid gap-1 text-xs font-bold text-slate-600">Urgência %<input name="urgencia_percentual" defaultValue={numberFromRule(vinculo.regras_adicionais, "urgencia_percentual")} className="ui-input" inputMode="decimal" /></label>
                  <label className="grid gap-1 text-xs font-bold text-slate-600">Acomodação %<input name="apartamento_percentual" defaultValue={numberFromRule(vinculo.regras_adicionais, "apartamento_percentual")} className="ui-input" inputMode="decimal" /></label>
                  <label className="grid gap-1 text-xs font-bold text-slate-600">Horário especial %<input name="horario_especial_percentual" defaultValue={numberFromRule(vinculo.regras_adicionais, "horario_especial_percentual")} className="ui-input" inputMode="decimal" /></label>
                  <label className="grid gap-1 text-xs font-bold text-slate-600 md:col-span-2 xl:col-span-4">Observações<textarea name="observacoes" defaultValue={vinculo.observacoes ?? ""} className="ui-input min-h-20" /></label>
                </CommercialNegotiationBackgroundForm> : null}

                {canEdit ? <div className="mt-4"><CommercialLinkMaintenanceActions vinculoId={vinculo.id} ativo={vinculo.ativo} /></div> : null}
              </article>;
            })}
            {!visibleLinks.length ? <div className="his-card p-8 text-center"><Unlink className="mx-auto size-8 text-slate-400" /><h3 className="mt-3 font-black text-slate-900">Nenhum vínculo neste filtro</h3><p className="mt-1 text-sm text-slate-500">Crie um novo vínculo ou altere o filtro.</p></div> : null}
          </section>

          <section className="his-card p-5">
            <div className="mb-4 flex items-center gap-2"><History className="size-5 text-brand-700" /><div><h2 className="font-black text-slate-950">Histórico comercial</h2><p className="text-xs text-slate-500">Alterações de vínculo, regras e DePara ficam auditadas; os eventos não são apagados ao desvincular.</p></div></div>
            <div className="space-y-2">
              {eventos.slice(0, 40).map((evento) => <div key={evento.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-100 p-3 text-xs"><div><b className="text-slate-800">{evento.entidade_tipo}</b><span className="ml-2 rounded bg-slate-100 px-2 py-0.5 font-bold uppercase text-slate-500">{evento.acao}</span></div><span className="text-slate-400">{localDateTime(evento.created_at)}</span></div>)}
              {!eventos.length ? <p className="py-6 text-center text-sm text-slate-500">Nenhum evento comercial encontrado para este contrato.</p> : null}
            </div>
          </section>
        </> : <section className="his-card p-8 text-center"><Settings2 className="mx-auto size-8 text-slate-400" /><h2 className="mt-3 font-black text-slate-900">Nenhum contrato disponível</h2></section>}
      </main>
    </div>
  </SectionPage>;
}
