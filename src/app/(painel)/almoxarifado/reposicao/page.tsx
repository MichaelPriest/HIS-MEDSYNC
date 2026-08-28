import Link from "next/link";
import { Boxes, ClipboardList, PackagePlus, SlidersHorizontal } from "lucide-react";
import { SectionPage } from "@/components/painel/section-page";
import { getAssistencialContext } from "@/modules/assistencial/context";
import { configurarParametroReposicaoAction, gerarRequisicaoReposicaoAction } from "@/modules/almoxarifado/estoque-actions";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Local={id:string;nome:string;tipo:string|null};
type Produto={id:string;codigo:string;descricao:string;unidade_medida:string};
type Parametro={id:string;local_id:string;produto_id:string;estoque_minimo:number;ponto_reposicao:number;estoque_maximo:number;local:Local|Local[]|null;produto:Produto|Produto[]|null};
type Necessidade={empresa_id:string;unidade_id:string;local_id:string;local_nome:string;produto_id:string;produto_codigo:string;produto_descricao:string;unidade_medida:string;saldo_fisico:number;saldo_disponivel:number;quantidade_em_requisicoes:number;saldo_projetado:number;estoque_minimo:number;ponto_reposicao:number;estoque_maximo:number;quantidade_sugerida:number};

function one<T>(value:T|T[]|null){return Array.isArray(value)?value[0]??null:value;}
function num(value:number|null|undefined){return Number(value??0).toLocaleString("pt-BR",{maximumFractionDigits:4});}

export default async function ReposicaoEstoquePage({searchParams}:{searchParams:Promise<{sucesso?:string;erro?:string}>}){
  const sp=await searchParams;
  const {supabase,empresaId,unidadeId}=await getAssistencialContext();
  const [needRes,locRes,prodRes,paramRes]=await Promise.all([
    supabase.rpc("listar_necessidades_reposicao_estoque",{p_local_id:null}),
    supabase.from("estoque_locais").select("id,nome,tipo").eq("empresa_id",empresaId).eq("unidade_id",unidadeId).eq("ativo",true).order("nome"),
    supabase.from("estoque_produtos").select("id,codigo,descricao,unidade_medida").eq("empresa_id",empresaId).eq("ativo",true).order("descricao").limit(2500),
    supabase.from("estoque_parametros_local").select("id,local_id,produto_id,estoque_minimo,ponto_reposicao,estoque_maximo,local:estoque_locais(id,nome,tipo),produto:estoque_produtos(id,codigo,descricao,unidade_medida)").eq("empresa_id",empresaId).eq("unidade_id",unidadeId).eq("ativo",true).order("updated_at",{ascending:false}).limit(500),
  ]);
  const necessidades=(needRes.data??[]) as unknown as Necessidade[];
  const locais=(locRes.data??[]) as Local[];
  const produtos=(prodRes.data??[]) as Produto[];
  const parametros=(paramRes.data??[]) as unknown as Parametro[];
  const porLocal=new Map<string,Necessidade[]>();
  for(const item of necessidades){const atual=porLocal.get(item.local_id)??[];atual.push(item);porLocal.set(item.local_id,atual);}
  const qtdSugerida=necessidades.reduce((total,n)=>total+Number(n.quantidade_sugerida??0),0);
  const emTransito=necessidades.reduce((total,n)=>total+Number(n.quantidade_em_requisicoes??0),0);

  return <SectionPage eyebrow="Gestão / Suprimentos" title="Reposição de Estoque" description="Necessidades por produto e local considerando saldo utilizável, ponto de reposição, máximo configurado e requisições já em trânsito." actions={<div className="flex flex-wrap gap-2"><Link href="/almoxarifado/requisicoes" className="btn-secondary"><ClipboardList className="size-4"/>Requisições</Link><Link href="/almoxarifado/inventarios" className="btn-secondary">Inventários</Link><Link href="/almoxarifado" className="btn-secondary"><Boxes className="size-4"/>Estoque</Link></div>}>
    {sp.sucesso?<div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">Operação concluída: {sp.sucesso.replaceAll("_"," ")}.</div>:null}
    {sp.erro?<div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">Operação bloqueada: {decodeURIComponent(sp.erro)}.</div>:null}

    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Kpi label="Itens abaixo do ponto" value={necessidades.length}/><Kpi label="Quantidade sugerida" value={qtdSugerida}/><Kpi label="Já em requisições" value={emTransito}/><Kpi label="Parâmetros ativos" value={parametros.length}/></section>

    <section className="his-card mt-5 p-5"><div className="flex items-center gap-3"><SlidersHorizontal className="size-5 text-brand-700"/><div><h2 className="font-black text-slate-900">Parâmetro de reposição por local</h2><p className="text-sm text-slate-500">Mínimo ≤ ponto de reposição ≤ máximo. O cálculo usa somente lotes disponíveis e não vencidos como saldo utilizável.</p></div></div><form action={configurarParametroReposicaoAction} className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-6"><select name="local_id" required defaultValue="" className="ui-input xl:col-span-2"><option value="">Local *</option>{locais.map(l=><option key={l.id} value={l.id}>{l.nome}</option>)}</select><select name="produto_id" required defaultValue="" className="ui-input xl:col-span-2"><option value="">Produto *</option>{produtos.map(p=><option key={p.id} value={p.id}>{p.codigo} · {p.descricao}</option>)}</select><input name="estoque_minimo" required type="number" step="0.0001" min="0" className="ui-input" placeholder="Mínimo"/><input name="ponto_reposicao" required type="number" step="0.0001" min="0" className="ui-input" placeholder="Ponto reposição"/><input name="estoque_maximo" required type="number" step="0.0001" min="0" className="ui-input" placeholder="Máximo"/><div className="xl:col-span-5 flex items-center text-xs text-slate-500">Salvar novamente o mesmo produto/local atualiza o parâmetro existente.</div><button className="ui-button-primary"><PackagePlus className="size-4"/>Salvar parâmetro</button></form></section>

    <section className="mt-5 space-y-4">{porLocal.size?[...porLocal.entries()].map(([localId,itens])=><article key={localId} className="his-card overflow-hidden"><div className="border-b border-slate-100 px-5 py-4"><h2 className="font-black text-slate-900">{itens[0]?.local_nome??"Local"}</h2><p className="mt-1 text-xs text-slate-500">A requisição gerada entra no mesmo fluxo setorial, com separação por lote/FEFO e confirmação de recebimento.</p></div><form action={gerarRequisicaoReposicaoAction}><input type="hidden" name="local_destino_id" value={localId}/><div className="overflow-x-auto"><table className="w-full min-w-[1120px] text-sm"><thead className="bg-slate-50 text-left text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">Produto</th><th className="px-4 py-3">Físico</th><th className="px-4 py-3">Disponível</th><th className="px-4 py-3">Em requisição</th><th className="px-4 py-3">Projetado</th><th className="px-4 py-3">Ponto / máximo</th><th className="px-4 py-3">Solicitar</th></tr></thead><tbody className="divide-y divide-slate-100">{itens.map(n=><tr key={n.produto_id}><td className="px-4 py-3"><input type="hidden" name="produto_id" value={n.produto_id}/><b>{n.produto_descricao}</b><div className="text-xs text-slate-400">{n.produto_codigo} · {n.unidade_medida}</div></td><td className="px-4 py-3">{num(n.saldo_fisico)}</td><td className="px-4 py-3 font-semibold">{num(n.saldo_disponivel)}</td><td className="px-4 py-3 text-brand-700">{num(n.quantidade_em_requisicoes)}</td><td className="px-4 py-3">{num(n.saldo_projetado)}</td><td className="px-4 py-3"><b>{num(n.ponto_reposicao)}</b> / {num(n.estoque_maximo)}</td><td className="px-4 py-3"><input name="quantidade" type="number" min="0.0001" max={Number(n.quantidade_sugerida)} step="0.0001" defaultValue={Number(n.quantidade_sugerida)} className="ui-input w-36"/></td></tr>)}</tbody></table></div><div className="grid gap-3 border-t border-slate-100 p-4 md:grid-cols-[1fr_auto]"><input name="justificativa" className="ui-input" placeholder="Justificativa opcional"/><button className="ui-button-primary"><ClipboardList className="size-4"/>Gerar requisição</button></div></form></article>):<div className="his-card p-8 text-center text-sm text-slate-500">Nenhuma necessidade de reposição calculada. Configure parâmetros ou aguarde o saldo projetado atingir o ponto de reposição.</div>}</section>

    <section className="his-card mt-5 overflow-hidden"><div className="border-b border-slate-100 px-5 py-4"><h2 className="font-black text-slate-900">Parâmetros configurados</h2></div><div className="max-h-[520px] overflow-auto"><table className="w-full min-w-[820px] text-sm"><thead className="sticky top-0 bg-slate-50 text-left text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">Local</th><th className="px-4 py-3">Produto</th><th className="px-4 py-3">Mínimo</th><th className="px-4 py-3">Reposição</th><th className="px-4 py-3">Máximo</th></tr></thead><tbody className="divide-y divide-slate-100">{parametros.length?parametros.map(p=>{const local=one(p.local),prod=one(p.produto);return <tr key={p.id}><td className="px-4 py-3">{local?.nome??"—"}</td><td className="px-4 py-3"><b>{prod?.descricao??"Produto"}</b><div className="text-xs text-slate-400">{prod?.codigo??"—"}</div></td><td className="px-4 py-3">{num(p.estoque_minimo)}</td><td className="px-4 py-3 font-bold">{num(p.ponto_reposicao)}</td><td className="px-4 py-3">{num(p.estoque_maximo)}</td></tr>}):<tr><td colSpan={5} className="p-8 text-center text-slate-500">Nenhum parâmetro configurado.</td></tr>}</tbody></table></div></section>
  </SectionPage>;
}

function Kpi({label,value}:{label:string;value:number}){return <div className="his-kpi"><p className="text-xs font-black uppercase text-slate-400">{label}</p><p className="mt-2 text-3xl font-black text-slate-950">{Number(value).toLocaleString("pt-BR",{maximumFractionDigits:2})}</p></div>}
