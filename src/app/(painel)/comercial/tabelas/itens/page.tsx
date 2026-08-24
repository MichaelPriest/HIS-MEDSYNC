import Link from "next/link";
import { Boxes, Database, FileUp, PackageOpen, Search, ShieldCheck } from "lucide-react";
import { ActionPanel } from "@/components/painel/action-panel";
import { SectionPage } from "@/components/painel/section-page";
import { requireAnyPermission } from "@/lib/permissions/server";
import {
  criarProdutoEstoqueDoItem,
  importarItensAssistenciais,
  inativarItemAssistencial,
  salvarItemAssistencial,
} from "@/modules/comercial/itens-assistenciais-actions";

type Item = {
  id: string;
  codigo_interno: string;
  categoria: string;
  tabela_tiss_codigo: string;
  familia_tuss: number | null;
  codigo_tuss: string | null;
  codigo_tabela_propria: string | null;
  descricao: string;
  unidade_medida: string | null;
  fabricante: string | null;
  apresentacao: string | null;
  codigo_anvisa: string | null;
  codigo_brasindice: string | null;
  codigo_simpro: string | null;
  ativo: boolean;
  estoque_produtos: Array<{ id: string }> | null;
};

const labels: Record<string, string> = {
  diaria: "Diárias",
  taxa: "Taxas",
  gas_medicinal: "Gases medicinais",
  material: "Materiais",
  opme: "OPME",
  medicamento: "Medicamentos",
  procedimento: "Procedimentos",
  pacote: "Pacotes",
  outro: "Outros",
};

const errorMessages: Record<string, string> = {
  campos: "Preencha código interno, categoria e descrição.",
  "codigo-proprio": "Itens da tabela 00 e pacotes da tabela 98 precisam de código próprio com até 10 caracteres.",
  salvar: "Não foi possível salvar o item.",
  arquivo: "Selecione um CSV válido com até 15 MB.",
  "arquivo-vazio": "O arquivo está vazio.",
  colunas: "O CSV precisa conter código e descrição.",
  "sem-itens": "Nenhum item válido foi encontrado no arquivo.",
  importacao: "Não foi possível importar os itens.",
  item: "Item não encontrado.",
  "nao-estocavel": "Este tipo de item não é controlado pelo estoque.",
  estoque: "Não foi possível criar o produto de estoque.",
  inativar: "Não foi possível inativar o item.",
};

function cleanSearch(value: string) {
  return value.replace(/[,%()]/g, " ").trim().slice(0, 80);
}

function hasStock(item: Item) {
  return Array.isArray(item.estoque_produtos) && item.estoque_produtos.length > 0;
}

function badge(category: string) {
  const variants: Record<string, string> = {
    medicamento: "bg-violet-50 text-violet-700",
    material: "bg-blue-50 text-blue-700",
    opme: "bg-amber-50 text-amber-700",
    diaria: "bg-emerald-50 text-emerald-700",
    taxa: "bg-cyan-50 text-cyan-700",
    gas_medicinal: "bg-sky-50 text-sky-700",
    procedimento: "bg-brand-50 text-brand-700",
    pacote: "bg-rose-50 text-rose-700",
  };
  return variants[category] ?? "bg-slate-100 text-slate-600";
}

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ItensAssistenciaisPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    categoria?: string;
    status?: string;
    sucesso?: string;
    erro?: string;
    importados?: string;
    rejeitados?: string;
  }>;
}) {
  const sp = await searchParams;
  const { supabase, empresaId, unidadeId } = await requireAnyPermission([
    "tabelas_comerciais.visualizar",
    "estoque.visualizar",
  ]);
  const q = cleanSearch(String(sp.q ?? ""));
  const categoria = String(sp.categoria ?? "").trim();
  const status = String(sp.status ?? "ativos");

  let query = supabase
    .from("itens_assistenciais")
    .select("id,codigo_interno,categoria,tabela_tiss_codigo,familia_tuss,codigo_tuss,codigo_tabela_propria,descricao,unidade_medida,fabricante,apresentacao,codigo_anvisa,codigo_brasindice,codigo_simpro,ativo,estoque_produtos(id)")
    .eq("empresa_id", empresaId)
    .order("descricao")
    .limit(250);
  if (categoria && labels[categoria]) query = query.eq("categoria", categoria);
  if (status === "ativos") query = query.eq("ativo", true);
  if (status === "inativos") query = query.eq("ativo", false);
  if (q.length >= 2) query = query.or(`descricao.ilike.%${q}%,codigo_interno.ilike.%${q}%,codigo_tuss.ilike.%${q}%,codigo_tabela_propria.ilike.%${q}%,codigo_brasindice.ilike.%${q}%,codigo_simpro.ilike.%${q}%`);

  const [{ data: itemData, error }, { data: fontes }, commercialGrant, stockGrant] = await Promise.all([
    query,
    supabase.from("tabelas_comerciais_fontes").select("id,codigo,nome,tipo,proprietaria,ativo").eq("empresa_id", empresaId).eq("ativo", true).order("nome"),
    supabase.rpc("tem_permissao", { p_empresa: empresaId, p_unidade: unidadeId, p_codigo: "tabelas_comerciais.gerenciar" }),
    supabase.rpc("tem_permissao", { p_empresa: empresaId, p_unidade: unidadeId, p_codigo: "estoque.gerenciar" }),
  ]);
  const items = (itemData ?? []) as Item[];
  const canManage = commercialGrant.data === true && !commercialGrant.error;
  const canStock = stockGrant.data === true && !stockGrant.error;
  const standardized = items.filter((item) => item.codigo_tuss && ["18", "19", "20", "22"].includes(item.tabela_tiss_codigo)).length;
  const ownTable = items.filter((item) => item.tabela_tiss_codigo === "00").length;
  const packages = items.filter((item) => item.tabela_tiss_codigo === "98").length;
  const stockLinked = items.filter(hasStock).length;

  return (
    <SectionPage
      eyebrow="Cadastros e contratos / Tabelas / MATMED"
      title="Itens assistenciais · TISS / TUSS"
      description="Cadastro mestre para diárias, taxas, gases medicinais, materiais, OPME, medicamentos e pacotes. A mesma base alimenta Estoque, Prescrição, Conta Hospitalar, Auditoria e Faturamento."
      actions={<Link href="/comercial/tabelas" className="btn-secondary"><Database className="size-4"/>Fontes e edições</Link>}
    >
      {sp.sucesso ? <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">Operação concluída: {sp.sucesso.replaceAll("-", " ")}.</div> : null}
      {sp.importados ? <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">{sp.importados} item(ns) importado(s){sp.rejeitados ? ` · ${sp.rejeitados} rejeitado(s)` : ""}.</div> : null}
      {sp.erro ? <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{errorMessages[sp.erro] ?? "Não foi possível concluir a operação."}</div> : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Kpi label="Exibidos" value={items.length}/><Kpi label="Com TUSS" value={standardized}/><Kpi label="Tabela 00" value={ownTable}/><Kpi label="Pacotes 98" value={packages}/><Kpi label="No estoque" value={stockLinked}/>
      </section>

      <section className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Rule code="00" title="Tabela própria" text="Material/medicamento ou outro item sem TUSS vigente usa código próprio da operadora. Código com até 10 caracteres."/>
        <Rule code="18" title="Diárias, taxas e gases" text="Quando houver código TUSS vigente para diária, taxa ou gás medicinal."/>
        <Rule code="19/20" title="MATMED / OPME" text="19 para material/OPME com TUSS; 20 para medicamento com TUSS."/>
        <Rule code="98" title="Pacotes" text="Tabela própria para pacotes. Os componentes do pacote permanecem rastreáveis individualmente."/>
      </section>

      <form method="get" className="his-card mt-5 grid gap-3 p-4 md:grid-cols-[1fr_190px_160px_auto]">
        <label className="relative"><Search className="absolute left-3 top-3 size-4 text-slate-400"/><input name="q" defaultValue={q} className="ui-input pl-9" placeholder="Descrição, código interno, TUSS, Brasíndice ou SIMPRO"/></label>
        <select name="categoria" defaultValue={categoria} className="ui-input"><option value="">Todas as categorias</option>{Object.entries(labels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>
        <select name="status" defaultValue={status} className="ui-input"><option value="ativos">Ativos</option><option value="todos">Todos</option><option value="inativos">Inativos</option></select>
        <button className="btn-secondary">Filtrar</button>
      </form>

      {canManage ? <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <ActionPanel title="Cadastrar item" description="Se informar TUSS, a tabela é definida pela categoria. Sem TUSS usa 00; pacote usa 98.">
          <form action={salvarItemAssistencial} className="grid gap-3 md:grid-cols-2">
            <input name="codigo_interno" required className="ui-input" placeholder="Código interno"/>
            <select name="categoria" required className="ui-input" defaultValue="material">{Object.entries(labels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>
            <input name="descricao" required className="ui-input md:col-span-2" placeholder="Descrição"/>
            <input name="codigo_tuss" className="ui-input" placeholder="Código TUSS, se existir"/>
            <input name="codigo_tabela_propria" maxLength={10} className="ui-input" placeholder="Código próprio TISS (00/98), até 10"/>
            <input name="unidade_medida" className="ui-input" placeholder="Unidade: UN, ML, M3, DIA..."/>
            <input name="fabricante" className="ui-input" placeholder="Fabricante / laboratório"/>
            <input name="apresentacao" className="ui-input" placeholder="Apresentação"/>
            <input name="principio_ativo" className="ui-input" placeholder="Princípio ativo"/>
            <input name="codigo_anvisa" className="ui-input" placeholder="Registro ANVISA"/>
            <input name="ean" className="ui-input" placeholder="EAN/GTIN"/>
            <input name="ggrem" className="ui-input" placeholder="GGREM"/>
            <input name="codigo_brasindice" className="ui-input" placeholder="Código Brasíndice"/>
            <input name="codigo_simpro" className="ui-input" placeholder="Código SIMPRO"/>
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-600"><input type="checkbox" name="cobranca_fracionada"/>Cobrança fracionada</label>
            <input name="fracao_minima" className="ui-input" placeholder="Fração mínima"/>
            <button className="ui-button-primary md:col-span-2">Salvar item mestre</button>
          </form>
        </ActionPanel>
        <ActionPanel title="Importar CSV" description="Aceita código, categoria, descrição, TUSS/código próprio, ANVISA, Brasíndice, SIMPRO, EAN e GGREM.">
          <form action={importarItensAssistenciais} className="space-y-3"><input type="file" name="arquivo" accept=".csv,text/csv" required className="ui-input"/><p className="text-xs leading-5 text-slate-500">Colunas mínimas: <b>codigo;categoria;descricao</b>. Para item sem TUSS informe <b>codigo_tabela_propria</b>. Para pacote a categoria deve ser <b>pacote</b> e será usada tabela 98.</p><button className="ui-button-primary inline-flex items-center gap-2"><FileUp className="size-4"/>Importar itens</button></form>
        </ActionPanel>
      </div> : null}

      <section className="his-card mt-5 overflow-hidden">
        <div className="flex flex-col gap-2 border-b border-slate-100 px-5 py-4 md:flex-row md:items-center md:justify-between"><div><h2 className="font-black text-slate-900">Base mestre</h2><p className="text-sm text-slate-500">{fontes?.length ?? 0} fonte(s) comercial(is) cadastrada(s) · preços ficam por edição e contrato, não no cadastro mestre.</p></div><ShieldCheck className="size-5 text-brand-700"/></div>
        {error ? <p className="p-6 text-sm text-rose-700">Não foi possível consultar a base de itens.</p> : items.length ? <div className="overflow-x-auto"><table className="w-full min-w-[1100px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Categoria</th><th className="px-4 py-3">Item</th><th className="px-4 py-3">TISS</th><th className="px-4 py-3">Referências</th><th className="px-4 py-3">Estoque</th><th className="px-4 py-3 text-right">Ações</th></tr></thead><tbody className="divide-y divide-slate-100">{items.map((item) => <tr key={item.id} className={!item.ativo ? "bg-slate-50 opacity-60" : ""}><td className="px-4 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${badge(item.categoria)}`}>{labels[item.categoria] ?? item.categoria}</span></td><td className="px-4 py-4"><b className="text-slate-900">{item.descricao}</b><div className="mt-1 text-xs text-slate-400">{item.codigo_interno} · {item.unidade_medida || "sem unidade"}{item.fabricante ? ` · ${item.fabricante}` : ""}</div></td><td className="px-4 py-4"><b>Tabela {item.tabela_tiss_codigo}</b><div className="mt-1 text-xs text-slate-500">{item.codigo_tuss ? `TUSS ${item.codigo_tuss}` : `Próprio ${item.codigo_tabela_propria || "não informado"}`}{item.familia_tuss ? ` · família ${item.familia_tuss}` : ""}</div></td><td className="px-4 py-4 text-xs text-slate-600"><div>{item.codigo_anvisa ? `ANVISA ${item.codigo_anvisa}` : "ANVISA —"}</div><div>{item.codigo_brasindice ? `Brasíndice ${item.codigo_brasindice}` : "Brasíndice —"}</div><div>{item.codigo_simpro ? `SIMPRO ${item.codigo_simpro}` : "SIMPRO —"}</div></td><td className="px-4 py-4">{hasStock(item) ? <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700"><Boxes className="size-3"/>Vinculado</span> : ["material","medicamento","opme","gas_medicinal"].includes(item.categoria) ? <span className="text-xs text-slate-400">Não vinculado</span> : <span className="text-xs text-slate-300">Não se aplica</span>}</td><td className="px-4 py-4"><div className="flex justify-end gap-2">{canStock && item.ativo && !hasStock(item) && ["material","medicamento","opme","gas_medicinal"].includes(item.categoria) ? <form action={criarProdutoEstoqueDoItem}><input type="hidden" name="item_id" value={item.id}/><button className="btn-secondary text-xs"><Boxes className="size-3"/>Criar no estoque</button></form> : null}{canManage && item.ativo ? <form action={inativarItemAssistencial}><input type="hidden" name="item_id" value={item.id}/><button className="btn-secondary text-xs">Inativar</button></form> : null}</div></td></tr>)}</tbody></table></div> : <div className="p-10 text-center"><PackageOpen className="mx-auto size-8 text-slate-300"/><p className="mt-3 text-sm text-slate-500">Nenhum item cadastrado.</p></div>}
      </section>
    </SectionPage>
  );
}

function Kpi({ label, value }: { label: string; value: number }) { return <div className="his-kpi"><p className="text-xs font-bold uppercase tracking-wider text-slate-400">{label}</p><p className="mt-2 text-3xl font-black text-slate-950">{value}</p></div>; }
function Rule({ code, title, text }: { code: string; title: string; text: string }) { return <div className="his-card p-4"><div className="flex items-center gap-2"><span className="rounded-lg bg-slate-950 px-2 py-1 font-mono text-xs font-black text-white">{code}</span><b className="text-sm text-slate-900">{title}</b></div><p className="mt-2 text-xs leading-5 text-slate-500">{text}</p></div>; }
