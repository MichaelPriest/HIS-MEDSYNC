import Link from "next/link";
import { ArrowLeft, Database, PackageSearch, Search } from "lucide-react";
import { notFound } from "next/navigation";
import { SectionPage } from "@/components/painel/section-page";
import { requirePermission } from "@/lib/permissions/server";
import { salvarLancamentoConta } from "@/modules/faturamento/conta-operacional-actions";

type Rel<T> = T | T[] | null;
type ItemContrato = {
  tabela_item_id: string;
  item_assistencial_id: string | null;
  codigo_fonte: string;
  descricao: string;
  categoria_item: string;
  tabela_tiss_codigo: string;
  familia_tuss: number | null;
  codigo_tuss: string | null;
  codigo_tabela_propria: string | null;
  fonte_codigo: string;
  fonte_nome: string;
  edicao_id: string;
  edicao_nome: string;
  prioridade: number;
  depara_tuss: string | null;
};

function one<T>(value: Rel<T>): T | null { return Array.isArray(value) ? value[0] ?? null : value; }
function clean(value: string) { return value.replace(/[,%()]/g, " ").trim().slice(0, 80); }

const labels: Record<string,string> = {
  diaria:"Diária",taxa:"Taxa",gas_medicinal:"Gás medicinal",material:"Material",opme:"OPME",medicamento:"Medicamento",procedimento:"Procedimento",pacote:"Pacote",outro:"Outro"
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function CatalogoContaPage({params,searchParams}:{params:Promise<{contaId:string}>;searchParams:Promise<{q?:string;categoria?:string}>}){
  const {contaId}=await params; const sp=await searchParams;
  const {supabase,empresaId}=await requirePermission("faturamento.criar");
  const q=clean(String(sp.q??"")); const categoria=String(sp.categoria??"").trim();
  const {data:conta}=await supabase.from("contas_faturamento")
    .select("id,tipo_cobranca,convenio_id,atendimento:atendimentos(numero_atendimento),paciente:pacientes(nome_completo,ra,numero_registro),convenio:convenios(nome_fantasia)")
    .eq("id",contaId).eq("empresa_id",empresaId).maybeSingle();
  if(!conta)notFound();
  const paciente=one(conta.paciente),atendimento=one(conta.atendimento),convenio=one(conta.convenio);

  let itensContrato: ItemContrato[]=[];
  let erroContrato=false;
  if(conta.convenio_id){
    const {data,error}=await supabase.rpc("buscar_itens_contrato_comercial",{
      p_convenio_id:conta.convenio_id,
      p_termo:q||null,
      p_categoria:categoria||null,
      p_data:new Date().toISOString().slice(0,10),
      p_limite:60,
    });
    itensContrato=(data??[]) as unknown as ItemContrato[];
    erroContrato=Boolean(error);
  }

  let query=supabase.from("itens_assistenciais")
    .select("id,codigo_interno,categoria,tabela_tiss_codigo,familia_tuss,codigo_tuss,codigo_tabela_propria,descricao,unidade_medida,fabricante,apresentacao,codigo_brasindice,codigo_simpro")
    .eq("empresa_id",empresaId).eq("ativo",true).order("descricao").limit(40);
  if(categoria&&labels[categoria])query=query.eq("categoria",categoria);
  if(q.length>=2)query=query.or(`descricao.ilike.%${q}%,codigo_interno.ilike.%${q}%,codigo_tuss.ilike.%${q}%,codigo_tabela_propria.ilike.%${q}%,codigo_brasindice.ilike.%${q}%,codigo_simpro.ilike.%${q}%`);
  else query=query.limit(20);
  const {data:itens,error}=await query;
  const add=salvarLancamentoConta.bind(null,contaId);

  return <SectionPage eyebrow="Faturamento / Conta / Catálogo" title="Adicionar item faturável" description={`${paciente?.nome_completo??"Paciente"} · Atendimento #${atendimento?.numero_atendimento??"—"} · RA ${paciente?.ra??"—"}`} actions={<Link href={`/faturamento/${contaId}`} className="btn-secondary"><ArrowLeft className="size-4"/>Voltar para a conta</Link>}>
    <section className="grid gap-3 md:grid-cols-3"><Info label="Cobertura" value={conta.tipo_cobranca==="convenio"?(convenio?.nome_fantasia??"Convênio"):"Particular"}/><Info label="Regra de preço" value={conta.tipo_cobranca==="convenio"?"Cadeia de tabelas do contrato":"Valor informado"}/><Info label="Busca" value="Código próprio, TUSS ou descrição"/></section>
    <div className="mt-5 rounded-2xl border border-brand-100 bg-brand-50/60 p-4 text-sm text-brand-900"><b>Resolução automática:</b> a busca percorre as tabelas do contrato pela prioridade. Você pode localizar pelo código da própria AMB/CBHPM/tabela do convênio, pelo TUSS ou pela descrição. Havendo DeParaTUSS, o lançamento grava automaticamente o código e a tabela TISS correspondentes, preservando o código original na memória comercial.</div>
    <form method="get" className="his-card mt-5 grid gap-3 p-4 md:grid-cols-[1fr_220px_auto]"><label className="relative"><Search className="absolute left-3 top-3 size-4 text-slate-400"/><input name="q" defaultValue={q} className="ui-input pl-9" placeholder="Código AMB/TUSS/próprio ou descrição"/></label><select name="categoria" defaultValue={categoria} className="ui-input"><option value="">Todas as categorias</option>{Object.entries(labels).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select><button className="btn-secondary">Pesquisar</button></form>

    {conta.convenio_id?<section className="his-card mt-5 overflow-hidden"><div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4"><Database className="size-5 text-brand-700"/><div><h2 className="font-black text-slate-900">Tabelas do contrato</h2><p className="text-sm text-slate-500">{itensContrato.length} resultado(s), em ordem de prioridade/fallback configurada no contrato.</p></div></div>{erroContrato?<p className="p-6 text-sm text-rose-700">Não foi possível consultar as tabelas comerciais do contrato.</p>:itensContrato.length?<div className="divide-y divide-slate-100">{itensContrato.map(item=><article key={`${item.edicao_id}-${item.tabela_item_id}`} className="grid gap-4 p-5 xl:grid-cols-[1fr_360px]"><div><div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-bold text-brand-700">{item.fonte_codigo} · prioridade {item.prioridade}</span><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">{labels[item.categoria_item]??item.categoria_item}</span><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">TISS {item.tabela_tiss_codigo}</span>{item.depara_tuss?<span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">DePara → TUSS {item.depara_tuss}</span>:null}</div><h3 className="mt-2 font-black text-slate-900">{item.descricao}</h3><p className="mt-1 text-xs text-slate-500">Código da tabela: <b>{item.codigo_fonte}</b> · TUSS {item.codigo_tuss??"não mapeado"} · edição {item.edicao_nome}</p><p className="mt-1 text-xs text-slate-400">O valor será resolvido novamente no servidor pela cadeia comercial do contrato no momento do lançamento.</p></div><LaunchForm action={add} tabelaComercialItemId={item.tabela_item_id} itemAssistencialId={item.item_assistencial_id} subgrupo={labels[item.categoria_item]??item.categoria_item}/></article>)}</div>:<p className="p-8 text-center text-sm text-slate-500">Nenhum item encontrado nas tabelas do contrato. Se a edição ainda estiver vazia, importe a tabela comercial primeiro.</p>}</section>:null}

    <section className="his-card mt-5 overflow-hidden"><div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4"><PackageSearch className="size-5 text-brand-700"/><div><h2 className="font-black text-slate-900">Catálogo mestre assistencial</h2><p className="text-sm text-slate-500">{itens?.length??0} resultado(s). Use como complemento ao catálogo comercial do contrato.</p></div></div>{error?<p className="p-6 text-sm text-rose-700">Não foi possível consultar o catálogo mestre.</p>:itens?.length?<div className="divide-y divide-slate-100">{itens.map(item=>{const codigo=["00","98"].includes(item.tabela_tiss_codigo)?item.codigo_tabela_propria:item.codigo_tuss;return <article key={item.id} className="grid gap-4 p-5 xl:grid-cols-[1fr_360px]"><div><div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">{labels[item.categoria]??item.categoria}</span><span className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-bold text-brand-700">Tabela TISS {item.tabela_tiss_codigo}</span>{item.familia_tuss?<span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">Família TUSS {item.familia_tuss}</span>:null}</div><h3 className="mt-2 font-black text-slate-900">{item.descricao}</h3><p className="mt-1 text-xs text-slate-500">{item.codigo_interno} · código TISS {codigo??"não informado"}{item.unidade_medida?` · ${item.unidade_medida}`:""}{item.fabricante?` · ${item.fabricante}`:""}</p><p className="mt-1 text-xs text-slate-400">{item.codigo_brasindice?`Brasíndice ${item.codigo_brasindice} · `:""}{item.codigo_simpro?`SIMPRO ${item.codigo_simpro}`:""}</p></div><LaunchForm action={add} itemAssistencialId={item.id} disabled={!codigo} subgrupo={labels[item.categoria]??item.categoria}/></article>})}</div>:<p className="p-8 text-center text-sm text-slate-500">Nenhum item encontrado.</p>}</section>
  </SectionPage>;
}

function LaunchForm({action,tabelaComercialItemId,itemAssistencialId,disabled=false,subgrupo}:{action:(formData:FormData)=>void|Promise<void>;tabelaComercialItemId?:string;itemAssistencialId?:string|null;disabled?:boolean;subgrupo:string}){
  return <form action={action} className="grid grid-cols-2 gap-2">{tabelaComercialItemId?<input type="hidden" name="tabela_comercial_item_id" value={tabelaComercialItemId}/>:null}{itemAssistencialId?<input type="hidden" name="item_assistencial_id" value={itemAssistencialId}/>:null}<input type="hidden" name="subgrupo_item" value={subgrupo}/><input name="quantidade" defaultValue="1" required inputMode="decimal" className="ui-input" placeholder="Quantidade"/><input name="valor_unitario" inputMode="decimal" className="ui-input" placeholder="Valor manual (opcional)"/><input type="datetime-local" name="data_execucao" className="ui-input col-span-2"/><input name="setor" className="ui-input" placeholder="Setor"/><input name="setor_subgrupo" className="ui-input" placeholder="Subgrupo do setor"/><input name="parcial_numero" inputMode="numeric" className="ui-input" placeholder="Parcial nº"/><div className="grid grid-cols-2 gap-2"><input type="date" name="parcial_inicio" className="ui-input" title="Início da parcial"/><input type="date" name="parcial_fim" className="ui-input" title="Fim da parcial"/></div><button disabled={disabled} className="ui-button-primary col-span-2 disabled:cursor-not-allowed disabled:opacity-50">{disabled?"Corrigir código TISS no cadastro":"Adicionar à conta"}</button></form>;
}

function Info({label,value}:{label:string;value:string}){return <div className="his-kpi"><p className="text-xs font-bold uppercase tracking-wider text-slate-400">{label}</p><p className="mt-2 text-base font-black text-slate-950">{value}</p></div>}
