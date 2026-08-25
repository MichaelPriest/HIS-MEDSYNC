import Link from "next/link";
import { Boxes, CheckCircle2, ClipboardList, PackageCheck, Truck } from "lucide-react";
import { SectionPage } from "@/components/painel/section-page";
import { getAssistencialContext } from "@/modules/assistencial/context";
import { atenderItemRequisicaoSetorialAction, criarRequisicaoSetorialAction, receberRequisicaoSetorialAction } from "@/modules/almoxarifado/requisicoes-actions";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Setor={id:string;nome:string};
type Local={id:string;nome:string;tipo:string|null;setor_id:string|null;eh_farmacia:boolean|null};
type Produto={id:string;codigo:string;descricao:string;unidade_medida:string;tipo:string};
type Lote={id:string;produto_id:string;local_id:string;numero_lote:string|null;validade:string|null;quantidade:number;local:Local|Local[]|null};
type Item={id:string;produto_id:string;quantidade_solicitada:number;quantidade_aprovada:number|null;quantidade_atendida:number;unidade_medida:string|null;observacoes:string|null;status:string;produto:Produto|Produto[]|null};
type Requisicao={id:string;numero:string;setor_id:string|null;local_destino_id:string;local_origem_id:string|null;prioridade:string;justificativa:string|null;status:string;solicitado_em:string;atendido_em:string|null;recebido_em:string|null;setor:Setor|Setor[]|null;destino:Local|Local[]|null;origem:Local|Local[]|null;itens:Item[]|null};

function one<T>(value:T|T[]|null){return Array.isArray(value)?value[0]??null:value;}
function fmt(value:string|null|undefined){return value?new Intl.DateTimeFormat("pt-BR",{dateStyle:"short",timeStyle:"short",timeZone:"America/Sao_Paulo"}).format(new Date(value)):"—";}
function statusLabel(value:string){return value.replaceAll("_"," ");}
function statusClass(value:string){if(value==="recebida"||value==="atendida")return "bg-emerald-50 text-emerald-700";if(value==="parcial"||value==="em_separacao")return "bg-amber-50 text-amber-700";if(value==="cancelada")return "bg-rose-50 text-rose-700";return "bg-brand-50 text-brand-700";}

export default async function RequisicoesAlmoxarifadoPage({searchParams}:{searchParams:Promise<{sucesso?:string;erro?:string;status?:string}>}){
 const sp=await searchParams;
 const {supabase,empresaId,unidadeId}=await getAssistencialContext();
 let reqQuery=supabase.from("estoque_requisicoes_setoriais").select("id,numero,setor_id,local_destino_id,local_origem_id,prioridade,justificativa,status,solicitado_em,atendido_em,recebido_em,setor:setores(nome),destino:estoque_locais!estoque_requisicoes_setoriais_local_destino_id_fkey(id,nome,tipo,setor_id,eh_farmacia),origem:estoque_locais!estoque_requisicoes_setoriais_local_origem_id_fkey(id,nome,tipo,setor_id,eh_farmacia),itens:estoque_requisicao_setorial_itens(id,produto_id,quantidade_solicitada,quantidade_aprovada,quantidade_atendida,unidade_medida,observacoes,status,produto:estoque_produtos(id,codigo,descricao,unidade_medida,tipo))").eq("empresa_id",empresaId).eq("unidade_id",unidadeId).order("solicitado_em",{ascending:false}).limit(150);
 if(sp.status) reqQuery=reqQuery.eq("status",sp.status);
 const [reqRes,setRes,locRes,prodRes,loteRes]=await Promise.all([
  reqQuery,
  supabase.from("setores").select("id,nome").eq("empresa_id",empresaId).eq("unidade_id",unidadeId).eq("ativo",true).order("nome"),
  supabase.from("estoque_locais").select("id,nome,tipo,setor_id,eh_farmacia").eq("empresa_id",empresaId).eq("unidade_id",unidadeId).eq("ativo",true).order("nome"),
  supabase.from("estoque_produtos").select("id,codigo,descricao,unidade_medida,tipo").eq("empresa_id",empresaId).eq("ativo",true).order("descricao").limit(2500),
  supabase.from("estoque_lotes").select("id,produto_id,local_id,numero_lote,validade,quantidade,local:estoque_locais(id,nome,tipo,setor_id,eh_farmacia)").eq("empresa_id",empresaId).eq("unidade_id",unidadeId).gt("quantidade",0).order("validade",{ascending:true}).limit(4000),
 ]);
 const requisicoes=(reqRes.data??[]) as unknown as Requisicao[];
 const setores=(setRes.data??[]) as Setor[];
 const locais=(locRes.data??[]) as unknown as Local[];
 const produtos=(prodRes.data??[]) as Produto[];
 const lotes=(loteRes.data??[]) as unknown as Lote[];
 const abertas=requisicoes.filter(r=>!["recebida","cancelada"].includes(r.status));
 const urgentes=abertas.filter(r=>r.prioridade!=="normal");
 const parciais=abertas.filter(r=>r.status==="parcial");

 return <SectionPage eyebrow="Gestão / Suprimentos" title="Requisições Setoriais" description="Setores solicitam medicamentos, materiais e insumos; o Almoxarifado separa por lote/FEFO e transfere o saldo ao estoque local de destino." actions={<Link href="/almoxarifado" className="btn-secondary"><Boxes className="size-4"/>Voltar ao estoque</Link>}>
  {sp.sucesso?<div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">Operação concluída: {sp.sucesso.replaceAll("_"," ")}.</div>:null}
  {sp.erro?<div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">Operação bloqueada: {decodeURIComponent(sp.erro)}.</div>:null}
  <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Kpi label="Abertas" value={abertas.length}/><Kpi label="Urgentes / emergência" value={urgentes.length}/><Kpi label="Parciais" value={parciais.length}/><Kpi label="Recebidas" value={requisicoes.filter(r=>r.status==="recebida").length}/></section>

  <section className="his-card mt-5 p-5"><div className="flex items-center gap-3"><ClipboardList className="size-5 text-brand-700"/><div><h2 className="font-black text-slate-900">Nova requisição do setor</h2><p className="text-sm text-slate-500">Inclua até 8 itens por pedido. O destino deve ser o estoque local/farmácia do setor solicitante.</p></div></div>
   <form action={criarRequisicaoSetorialAction} className="mt-4 space-y-4"><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4"><select name="setor_id" defaultValue="" className="ui-input"><option value="">Setor solicitante</option>{setores.map(s=><option key={s.id} value={s.id}>{s.nome}</option>)}</select><select name="local_destino_id" required defaultValue="" className="ui-input"><option value="">Estoque local de destino *</option>{locais.map(l=><option key={l.id} value={l.id}>{l.nome}{l.eh_farmacia?" · Farmácia":""}</option>)}</select><select name="prioridade" defaultValue="normal" className="ui-input"><option value="normal">Normal</option><option value="urgente">Urgente</option><option value="emergencia">Emergência</option></select><input name="justificativa" className="ui-input" placeholder="Justificativa / finalidade"/></div>
    <div className="overflow-x-auto rounded-xl border border-slate-200"><table className="min-w-[900px] w-full text-sm"><thead className="bg-slate-50 text-left text-xs uppercase text-slate-500"><tr><th className="px-3 py-2">#</th><th className="px-3 py-2">Produto</th><th className="px-3 py-2">Quantidade</th><th className="px-3 py-2">Unidade</th><th className="px-3 py-2">Observação</th></tr></thead><tbody>{Array.from({length:8},(_,i)=>i+1).map(n=><tr key={n} className="border-t"><td className="px-3 py-2 font-bold text-slate-400">{n}</td><td className="px-3 py-2"><select name={`produto_${n}_id`} defaultValue="" className="ui-input"><option value="">Selecione</option>{produtos.map(p=><option key={p.id} value={p.id}>{p.codigo} · {p.descricao}</option>)}</select></td><td className="px-3 py-2"><input name={`produto_${n}_quantidade`} type="number" step="0.0001" min="0" className="ui-input w-32"/></td><td className="px-3 py-2"><input name={`produto_${n}_unidade`} className="ui-input w-28" placeholder="UN"/></td><td className="px-3 py-2"><input name={`produto_${n}_observacoes`} className="ui-input min-w-56"/></td></tr>)}</tbody></table></div>
    <div className="flex justify-end"><button className="ui-button-primary"><Truck className="size-4"/>Enviar ao Almoxarifado</button></div></form>
  </section>

  <div className="mt-5 flex flex-wrap gap-2">{["","solicitada","em_separacao","parcial","atendida","recebida"].map(status=><Link key={status||"todos"} href={status?`/almoxarifado/requisicoes?status=${status}`:"/almoxarifado/requisicoes"} className="btn-secondary">{status?statusLabel(status):"Todos"}</Link>)}</div>

  <div className="mt-4 space-y-4">{requisicoes.length?requisicoes.map(req=>{const setor=one(req.setor),destino=one(req.destino),origem=one(req.origem);const itens=req.itens??[];const todosFinalizados=itens.length>0&&itens.every(i=>["atendido","cancelado"].includes(i.status));return <article key={req.id} className="his-card overflow-hidden"><div className="flex flex-col gap-3 border-b border-slate-100 p-5 lg:flex-row lg:items-start lg:justify-between"><div><div className="flex flex-wrap items-center gap-2"><h2 className="font-black text-slate-950">{req.numero}</h2><span className={`rounded-full px-2.5 py-1 text-xs font-black uppercase ${statusClass(req.status)}`}>{statusLabel(req.status)}</span><span className={`rounded-full px-2.5 py-1 text-xs font-black uppercase ${req.prioridade==="emergencia"?"bg-rose-600 text-white":req.prioridade==="urgente"?"bg-amber-100 text-amber-800":"bg-slate-100 text-slate-600"}`}>{req.prioridade}</span></div><p className="mt-1 text-sm text-slate-600">{setor?.nome??"Setor não informado"} → {destino?.nome??"Destino"}</p><p className="mt-1 text-xs text-slate-400">Solicitada em {fmt(req.solicitado_em)}{origem?` · origem inicial ${origem.nome}`:""}</p>{req.justificativa?<p className="mt-2 text-sm text-slate-700">{req.justificativa}</p>:null}</div>{req.status==="atendida"&&todosFinalizados?<form action={receberRequisicaoSetorialAction}><input type="hidden" name="requisicao_id" value={req.id}/><button className="ui-button-primary"><CheckCircle2 className="size-4"/>Confirmar recebimento</button></form>:null}</div>
     <div className="overflow-x-auto"><table className="min-w-[980px] w-full text-sm"><thead className="bg-slate-50 text-left text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">Produto</th><th className="px-4 py-3">Solicitado</th><th className="px-4 py-3">Atendido</th><th className="px-4 py-3">Situação</th><th className="px-4 py-3">Separação / transferência</th></tr></thead><tbody className="divide-y divide-slate-100">{itens.map(item=>{const produto=one(item.produto);const restante=Math.max(Number(item.quantidade_aprovada??item.quantidade_solicitada)-Number(item.quantidade_atendida??0),0);const lotesProduto=lotes.filter(l=>l.produto_id===item.produto_id&&l.local_id!==req.local_destino_id);return <tr key={item.id}><td className="px-4 py-3"><b>{produto?.descricao??"Produto"}</b><div className="text-xs text-slate-400">{produto?.codigo??"—"}{item.observacoes?` · ${item.observacoes}`:""}</div></td><td className="px-4 py-3">{Number(item.quantidade_solicitada)} {item.unidade_medida??produto?.unidade_medida??"UN"}</td><td className="px-4 py-3 font-bold">{Number(item.quantidade_atendida)}</td><td className="px-4 py-3 capitalize">{statusLabel(item.status)}</td><td className="px-4 py-3">{restante>0&&!['cancelada','recebida'].includes(req.status)?<form action={atenderItemRequisicaoSetorialAction} className="flex min-w-[480px] gap-2"><input type="hidden" name="item_id" value={item.id}/><select name="estoque_lote_id" required defaultValue="" className="ui-input flex-1"><option value="">Selecionar lote FEFO</option>{lotesProduto.map(l=>{const local=one(l.local);return <option key={l.id} value={l.id}>{local?.nome??"Origem"} · lote {l.numero_lote??"s/lote"} · val. {l.validade??"—"} · saldo {Number(l.quantidade)}</option>})}</select><input name="quantidade" type="number" step="0.0001" min="0.0001" max={restante} defaultValue={restante} className="ui-input w-28"/><button className="ui-button-primary whitespace-nowrap"><PackageCheck className="size-4"/>Atender</button></form>:<span className="text-xs font-bold text-emerald-700">Item concluído</span>}</td></tr>})}</tbody></table></div>
    </article>}):<div className="his-card p-8 text-center text-sm text-slate-500">Nenhuma requisição encontrada.</div>}</div>
 </SectionPage>;
}

function Kpi({label,value}:{label:string;value:number}){return <div className="his-kpi"><p className="text-xs font-black uppercase text-slate-400">{label}</p><p className="mt-2 text-3xl font-black text-slate-950">{value}</p></div>}
