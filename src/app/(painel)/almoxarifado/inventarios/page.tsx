import Link from "next/link";
import { Boxes, ClipboardCheck, PlusCircle } from "lucide-react";
import { SectionPage } from "@/components/painel/section-page";
import { getAssistencialContext } from "@/modules/assistencial/context";
import { abrirInventarioEstoqueAction } from "@/modules/almoxarifado/estoque-actions";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Local={id:string;nome:string;tipo:string|null};
type InventarioItem={id:string;quantidade_contada:number|null;divergencia:number|null};
type Inventario={id:string;numero:string;status:string;motivo:string|null;observacoes:string|null;iniciado_em:string;finalizado_em:string|null;local:Local|Local[]|null;itens:InventarioItem[]|null};

function one<T>(value:T|T[]|null){return Array.isArray(value)?value[0]??null:value;}
function fmt(value:string|null|undefined){return value?new Intl.DateTimeFormat("pt-BR",{dateStyle:"short",timeStyle:"short",timeZone:"America/Sao_Paulo"}).format(new Date(value)):"—";}
function badge(status:string){if(status==="conciliado")return "bg-emerald-50 text-emerald-700";if(status==="cancelado")return "bg-rose-50 text-rose-700";if(status==="em_contagem")return "bg-amber-50 text-amber-700";return "bg-brand-50 text-brand-700";}

export default async function InventariosPage({searchParams}:{searchParams:Promise<{sucesso?:string;erro?:string}>}){
  const sp=await searchParams;
  const {supabase,empresaId,unidadeId}=await getAssistencialContext();
  const [invRes,locRes]=await Promise.all([
    supabase.from("estoque_inventarios").select("id,numero,status,motivo,observacoes,iniciado_em,finalizado_em,local:estoque_locais(id,nome,tipo),itens:estoque_inventario_itens(id,quantidade_contada,divergencia)").eq("empresa_id",empresaId).eq("unidade_id",unidadeId).order("iniciado_em",{ascending:false}).limit(150),
    supabase.from("estoque_locais").select("id,nome,tipo").eq("empresa_id",empresaId).eq("unidade_id",unidadeId).eq("ativo",true).order("nome"),
  ]);
  const inventarios=(invRes.data??[]) as unknown as Inventario[];
  const locais=(locRes.data??[]) as Local[];
  const abertos=inventarios.filter(i=>i.status==="aberto").length;
  const contando=inventarios.filter(i=>i.status==="em_contagem").length;
  const conciliados=inventarios.filter(i=>i.status==="conciliado").length;
  const divergencias=inventarios.reduce((total,i)=>total+(i.itens??[]).filter(x=>Number(x.divergencia??0)!==0).length,0);

  return <SectionPage eyebrow="Gestão / Suprimentos" title="Inventário de Estoque" description="Contagem física por lote, com snapshot do saldo do sistema e conciliação auditável no mesmo estoque operacional." actions={<div className="flex flex-wrap gap-2"><Link href="/almoxarifado/reposicao" className="btn-secondary">Reposição</Link><Link href="/almoxarifado" className="btn-secondary"><Boxes className="size-4"/>Estoque</Link></div>}>
    {sp.sucesso?<div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">Operação concluída: {sp.sucesso.replaceAll("_"," ")}.</div>:null}
    {sp.erro?<div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">Operação bloqueada: {decodeURIComponent(sp.erro)}.</div>:null}

    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Kpi label="Abertos" value={abertos}/><Kpi label="Em contagem" value={contando}/><Kpi label="Conciliados" value={conciliados}/><Kpi label="Itens com divergência" value={divergencias}/></section>

    <section className="his-card mt-5 p-5"><div className="flex items-center gap-3"><PlusCircle className="size-5 text-brand-700"/><div><h2 className="font-black text-slate-900">Abrir inventário</h2><p className="text-sm text-slate-500">O sistema captura todos os lotes do local no momento da abertura. Só pode existir um inventário aberto por local.</p></div></div><form action={abrirInventarioEstoqueAction} className="mt-4 grid gap-3 md:grid-cols-[minmax(240px,1fr)_2fr_auto]"><select name="local_id" required defaultValue="" className="ui-input"><option value="">Local de estoque *</option>{locais.map(l=><option key={l.id} value={l.id}>{l.nome} · {l.tipo??"estoque"}</option>)}</select><input name="motivo" className="ui-input" placeholder="Motivo / referência da contagem"/><button className="ui-button-primary"><ClipboardCheck className="size-4"/>Abrir inventário</button></form></section>

    <section className="his-card mt-5 overflow-hidden"><div className="border-b border-slate-100 px-5 py-4"><h2 className="font-black text-slate-900">Inventários recentes</h2><p className="mt-1 text-xs text-slate-500">Histórico de abertura, contagem, conciliação e cancelamento.</p></div><div className="overflow-x-auto"><table className="w-full min-w-[920px] text-sm"><thead className="bg-slate-50 text-left text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">Inventário</th><th className="px-4 py-3">Local</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Contagem</th><th className="px-4 py-3">Início</th><th className="px-4 py-3"></th></tr></thead><tbody className="divide-y divide-slate-100">{inventarios.length?inventarios.map(inv=>{const local=one(inv.local);const itens=inv.itens??[];const contados=itens.filter(i=>i.quantidade_contada!==null).length;return <tr key={inv.id}><td className="px-4 py-3"><b>{inv.numero}</b>{inv.motivo?<div className="text-xs text-slate-400">{inv.motivo}</div>:null}</td><td className="px-4 py-3">{local?.nome??"—"}</td><td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-black uppercase ${badge(inv.status)}`}>{inv.status.replaceAll("_"," ")}</span></td><td className="px-4 py-3">{contados}/{itens.length}</td><td className="px-4 py-3 text-slate-500">{fmt(inv.iniciado_em)}</td><td className="px-4 py-3 text-right"><Link href={`/almoxarifado/inventarios/${inv.id}`} className="btn-secondary">Abrir</Link></td></tr>}):<tr><td colSpan={6} className="p-8 text-center text-slate-500">Nenhum inventário registrado.</td></tr>}</tbody></table></div></section>
  </SectionPage>;
}

function Kpi({label,value}:{label:string;value:number}){return <div className="his-kpi"><p className="text-xs font-black uppercase text-slate-400">{label}</p><p className="mt-2 text-3xl font-black text-slate-950">{value}</p></div>}
