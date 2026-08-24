import Link from "next/link";
import { ArrowLeft, PackageSearch, Search } from "lucide-react";
import { notFound } from "next/navigation";
import { SectionPage } from "@/components/painel/section-page";
import { requireAnyPermission } from "@/lib/permissions/server";
import { adicionarItemConta } from "@/modules/faturamento/actions";

type Rel<T> = T | T[] | null;
function one<T>(value: Rel<T>): T | null { return Array.isArray(value) ? value[0] ?? null : value; }
function clean(value: string) { return value.replace(/[,%()]/g, " ").trim().slice(0, 80); }

const labels: Record<string,string> = {
  diaria:"Diária",taxa:"Taxa",gas_medicinal:"Gás medicinal",material:"Material",opme:"OPME",medicamento:"Medicamento",procedimento:"Procedimento",pacote:"Pacote",outro:"Outro"
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function CatalogoContaPage({params,searchParams}:{params:Promise<{contaId:string}>;searchParams:Promise<{q?:string;categoria?:string}>}){
  const {contaId}=await params;const sp=await searchParams;
  const {supabase,empresaId}=await requireAnyPermission(["faturamento.visualizar","faturamento.criar"]);
  const q=clean(String(sp.q??""));const categoria=String(sp.categoria??"").trim();
  const {data:conta}=await supabase.from("contas_faturamento").select("id,tipo_cobranca,convenio_id,atendimento:atendimentos(numero_atendimento),paciente:pacientes(nome_completo,ra,numero_registro),convenio:convenios(nome_fantasia)").eq("id",contaId).eq("empresa_id",empresaId).maybeSingle();
  if(!conta)notFound();
  const paciente=one(conta.paciente),atendimento=one(conta.atendimento),convenio=one(conta.convenio);

  let query=supabase.from("itens_assistenciais").select("id,codigo_interno,categoria,tabela_tiss_codigo,familia_tuss,codigo_tuss,codigo_tabela_propria,descricao,unidade_medida,fabricante,apresentacao,codigo_brasindice,codigo_simpro").eq("empresa_id",empresaId).eq("ativo",true).order("descricao").limit(60);
  if(categoria&&labels[categoria])query=query.eq("categoria",categoria);
  if(q.length>=2)query=query.or(`descricao.ilike.%${q}%,codigo_interno.ilike.%${q}%,codigo_tuss.ilike.%${q}%,codigo_tabela_propria.ilike.%${q}%,codigo_brasindice.ilike.%${q}%,codigo_simpro.ilike.%${q}%`);
  else query=query.limit(30);
  const {data:itens,error}=await query;
  const add=adicionarItemConta.bind(null,contaId);

  return <SectionPage eyebrow="Faturamento / Conta / Catálogo" title="Adicionar item faturável" description={`${paciente?.nome_completo??"Paciente"} · Atendimento #${atendimento?.numero_atendimento??"—"} · RA ${paciente?.ra??"—"}`} actions={<Link href={`/faturamento/${contaId}`} className="btn-secondary"><ArrowLeft className="size-4"/>Voltar para a conta</Link>}>
    <section className="grid gap-3 md:grid-cols-3"><Info label="Cobertura" value={conta.tipo_cobranca==="convenio"?(convenio?.nome_fantasia??"Convênio"):"Particular"}/><Info label="Regra de preço" value={conta.tipo_cobranca==="convenio"?"Tabela vigente do contrato":"Valor informado"}/><Info label="TISS" value="00 / 18 / 19 / 20 / 22 / 98"/></section>
    <div className="mt-5 rounded-2xl border border-brand-100 bg-brand-50/60 p-4 text-sm text-brand-900"><b>Como funciona:</b> se o item estiver mapeado a uma edição comercial vigente do convênio, o valor é resolvido automaticamente. Se informar valor manual, ele prevalece no lançamento. O código TISS vem do cadastro mestre: sem TUSS usa 00; pacote usa 98.</div>
    <form method="get" className="his-card mt-5 grid gap-3 p-4 md:grid-cols-[1fr_220px_auto]"><label className="relative"><Search className="absolute left-3 top-3 size-4 text-slate-400"/><input name="q" defaultValue={q} className="ui-input pl-9" placeholder="Nome, código TUSS, próprio, Brasíndice ou SIMPRO"/></label><select name="categoria" defaultValue={categoria} className="ui-input"><option value="">Todas as categorias</option>{Object.entries(labels).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select><button className="btn-secondary">Pesquisar</button></form>
    <section className="his-card mt-5 overflow-hidden"><div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4"><PackageSearch className="size-5 text-brand-700"/><div><h2 className="font-black text-slate-900">Itens do catálogo mestre</h2><p className="text-sm text-slate-500">{itens?.length??0} resultado(s). A fonte de preço comercial é preservada na memória da conta.</p></div></div>{error?<p className="p-6 text-sm text-rose-700">Não foi possível consultar o catálogo.</p>:itens?.length?<div className="divide-y divide-slate-100">{itens.map(item=>{const codigo=["00","98"].includes(item.tabela_tiss_codigo)?item.codigo_tabela_propria:item.codigo_tuss;return <article key={item.id} className="grid gap-4 p-5 xl:grid-cols-[1fr_260px]"><div><div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">{labels[item.categoria]??item.categoria}</span><span className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-bold text-brand-700">Tabela {item.tabela_tiss_codigo}</span></div><h3 className="mt-2 font-black text-slate-900">{item.descricao}</h3><p className="mt-1 text-xs text-slate-500">{item.codigo_interno} · código TISS {codigo??"não informado"}{item.unidade_medida?` · ${item.unidade_medida}`:""}{item.fabricante?` · ${item.fabricante}`:""}</p><p className="mt-1 text-xs text-slate-400">{item.codigo_brasindice?`Brasíndice ${item.codigo_brasindice} · `:""}{item.codigo_simpro?`SIMPRO ${item.codigo_simpro}`:""}</p></div><form action={add} className="grid grid-cols-2 gap-2"><input type="hidden" name="item_assistencial_id" value={item.id}/><input name="quantidade" defaultValue="1" required inputMode="decimal" className="ui-input" placeholder="Quantidade"/><input name="valor_unitario" inputMode="decimal" className="ui-input" placeholder="Valor manual (opcional)"/><input type="datetime-local" name="data_execucao" className="ui-input col-span-2"/><input name="setor" className="ui-input col-span-2" placeholder="Setor/origem do consumo"/><button disabled={!codigo} className="ui-button-primary col-span-2 disabled:cursor-not-allowed disabled:opacity-50">{codigo?"Adicionar à conta":"Corrigir código TISS no cadastro"}</button></form></article>})}</div>:<p className="p-8 text-center text-sm text-slate-500">Nenhum item encontrado.</p>}</section>
  </SectionPage>;
}

function Info({label,value}:{label:string;value:string}){return <div className="his-kpi"><p className="text-xs font-bold uppercase tracking-wider text-slate-400">{label}</p><p className="mt-2 text-base font-black text-slate-950">{value}</p></div>}
