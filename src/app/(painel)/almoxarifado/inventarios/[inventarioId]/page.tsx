import Link from "next/link";
import { Boxes, CheckCircle2, ClipboardCheck, XCircle } from "lucide-react";
import { SectionPage } from "@/components/painel/section-page";
import { getAssistencialContext } from "@/modules/assistencial/context";
import { cancelarInventarioEstoqueAction, concluirInventarioEstoqueAction, registrarContagemInventarioAction } from "@/modules/almoxarifado/estoque-actions";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Local={id:string;nome:string;tipo:string|null};
type Produto={id:string;codigo:string;descricao:string;unidade_medida:string};
type Lote={id:string;numero_lote:string|null;validade:string|null;quantidade:number;status:string};
type Item={id:string;saldo_sistema_inicial:number;saldo_sistema_final:number|null;quantidade_contada:number|null;divergencia:number|null;observacoes:string|null;contado_em:string|null;produto:Produto|Produto[]|null;lote:Lote|Lote[]|null};
type Inventario={id:string;numero:string;status:string;motivo:string|null;observacoes:string|null;iniciado_em:string;finalizado_em:string|null;local:Local|Local[]|null};

function one<T>(value:T|T[]|null){return Array.isArray(value)?value[0]??null:value;}
function fmt(value:string|null|undefined){return value?new Intl.DateTimeFormat("pt-BR",{dateStyle:"short",timeStyle:"short",timeZone:"America/Sao_Paulo"}).format(new Date(value)):"—";}
function num(value:number|null|undefined){return Number(value??0).toLocaleString("pt-BR",{maximumFractionDigits:4});}

export default async function InventarioDetalhePage({params,searchParams}:{params:Promise<{inventarioId:string}>;searchParams:Promise<{sucesso?:string;erro?:string;ajustes?:string}>}){
  const {inventarioId}=await params;
  const sp=await searchParams;
  const {supabase}=await getAssistencialContext();
  const [{data:inv},{data:itens}]=await Promise.all([
    supabase.from("estoque_inventarios").select("id,numero,status,motivo,observacoes,iniciado_em,finalizado_em,local:estoque_locais(id,nome,tipo)").eq("id",inventarioId).maybeSingle(),
    supabase.from("estoque_inventario_itens").select("id,saldo_sistema_inicial,saldo_sistema_final,quantidade_contada,divergencia,observacoes,contado_em,produto:estoque_produtos(id,codigo,descricao,unidade_medida),lote:estoque_lotes(id,numero_lote,validade,quantidade,status)").eq("inventario_id",inventarioId).order("produto_id").limit(4000),
  ]);
  const inventario=inv as unknown as Inventario|null;
  const linhas=(itens??[]) as unknown as Item[];
  if(!inventario)return <SectionPage eyebrow="Gestão / Suprimentos" title="Inventário não encontrado" description="O inventário não existe ou está fora do seu escopo." actions={<Link href="/almoxarifado/inventarios" className="btn-secondary">Voltar</Link>}/>
  const local=one(inventario.local);
  const editavel=["aberto","em_contagem"].includes(inventario.status);
  const contados=linhas.filter(i=>i.quantidade_contada!==null).length;
  const divergentes=linhas.filter(i=>Number(i.divergencia??0)!==0).length;

  return <SectionPage eyebrow="Gestão / Suprimentos / Inventário" title={inventario.numero} description={`${local?.nome??"Local"} · ${inventario.status.replaceAll("_"," ")} · iniciado em ${fmt(inventario.iniciado_em)}`} actions={<div className="flex gap-2"><Link href="/almoxarifado/inventarios" className="btn-secondary"><ClipboardCheck className="size-4"/>Inventários</Link><Link href="/almoxarifado" className="btn-secondary"><Boxes className="size-4"/>Estoque</Link></div>}>
    {sp.sucesso?<div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">Operação concluída: {sp.sucesso.replaceAll("_"," ")}{sp.ajustes?` · ${sp.ajustes} ajuste(s) gerado(s)`:""}.</div>:null}
    {sp.erro?<div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">Operação bloqueada: {decodeURIComponent(sp.erro)}.</div>:null}
    <section className="grid gap-3 sm:grid-cols-4"><Kpi label="Itens" value={linhas.length}/><Kpi label="Contados" value={contados}/><Kpi label="Pendentes" value={Math.max(linhas.length-contados,0)}/><Kpi label="Divergências finais" value={divergentes}/></section>

    {inventario.motivo||inventario.observacoes?<section className="his-card mt-5 p-5 text-sm text-slate-600">{inventario.motivo?<p><b>Motivo:</b> {inventario.motivo}</p>:null}{inventario.observacoes?<p className="mt-1"><b>Observações:</b> {inventario.observacoes}</p>:null}{inventario.finalizado_em?<p className="mt-1 text-xs text-slate-400">Finalizado em {fmt(inventario.finalizado_em)}</p>:null}</section>:null}

    <section className="his-card mt-5 overflow-hidden"><div className="border-b border-slate-100 px-5 py-4"><h2 className="font-black text-slate-900">Contagem por lote</h2><p className="mt-1 text-xs text-slate-500">O saldo inicial é o snapshot da abertura. Na conciliação o sistema trava o lote, compara com o saldo atual e registra ajuste somente pela diferença física confirmada.</p></div>
      {editavel?<form action={registrarContagemInventarioAction}><input type="hidden" name="inventario_id" value={inventario.id}/><div className="overflow-x-auto"><table className="w-full min-w-[1100px] text-sm"><thead className="bg-slate-50 text-left text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">Produto / lote</th><th className="px-4 py-3">Validade</th><th className="px-4 py-3">Snapshot</th><th className="px-4 py-3">Saldo agora</th><th className="px-4 py-3">Contagem física</th><th className="px-4 py-3">Observação</th></tr></thead><tbody className="divide-y divide-slate-100">{linhas.map(item=>{const p=one(item.produto),l=one(item.lote);return <tr key={item.id}><td className="px-4 py-3"><input type="hidden" name="item_id" value={item.id}/><b>{p?.descricao??"Produto"}</b><div className="text-xs text-slate-400">{p?.codigo??"—"} · lote {l?.numero_lote??"s/lote"}</div></td><td className="px-4 py-3">{l?.validade??"—"}</td><td className="px-4 py-3 font-semibold">{num(item.saldo_sistema_inicial)}</td><td className="px-4 py-3">{num(l?.quantidade)}</td><td className="px-4 py-3"><input name="quantidade_contada" type="number" min="0" step="0.0001" defaultValue={item.quantidade_contada??""} className="ui-input w-36" placeholder="Contado"/></td><td className="px-4 py-3"><input name="observacoes" defaultValue={item.observacoes??""} className="ui-input min-w-64" placeholder="Avaria, perda, sobra..."/></td></tr>})}</tbody></table></div><div className="flex justify-end border-t border-slate-100 p-4"><button className="ui-button-primary">Salvar contagem</button></div></form>:<div className="overflow-x-auto"><table className="w-full min-w-[980px] text-sm"><thead className="bg-slate-50 text-left text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">Produto / lote</th><th className="px-4 py-3">Snapshot</th><th className="px-4 py-3">Contado</th><th className="px-4 py-3">Saldo final</th><th className="px-4 py-3">Divergência</th><th className="px-4 py-3">Observação</th></tr></thead><tbody className="divide-y divide-slate-100">{linhas.map(item=>{const p=one(item.produto),l=one(item.lote);const delta=Number(item.divergencia??0);return <tr key={item.id}><td className="px-4 py-3"><b>{p?.descricao??"Produto"}</b><div className="text-xs text-slate-400">{p?.codigo??"—"} · lote {l?.numero_lote??"s/lote"}</div></td><td className="px-4 py-3">{num(item.saldo_sistema_inicial)}</td><td className="px-4 py-3 font-semibold">{num(item.quantidade_contada)}</td><td className="px-4 py-3">{num(item.saldo_sistema_final)}</td><td className={`px-4 py-3 font-black ${delta===0?"text-emerald-700":delta>0?"text-brand-700":"text-rose-700"}`}>{delta>0?"+":""}{num(delta)}</td><td className="px-4 py-3 text-slate-500">{item.observacoes??"—"}</td></tr>})}</tbody></table></div>}
    </section>

    {editavel?<section className="mt-5 grid gap-4 lg:grid-cols-2"><form action={concluirInventarioEstoqueAction} className="his-card p-5"><input type="hidden" name="inventario_id" value={inventario.id}/><h2 className="font-black text-slate-900">Concluir e conciliar</h2><p className="mt-1 text-sm text-slate-500">Só conclui quando todos os lotes tiverem contagem. Diferenças geram movimentos de ajuste vinculados ao inventário.</p><textarea name="observacoes_finais" className="ui-input mt-4 min-h-24" placeholder="Observações finais"/><button className="ui-button-primary mt-4"><CheckCircle2 className="size-4"/>Conciliar inventário</button></form><form action={cancelarInventarioEstoqueAction} className="his-card p-5"><input type="hidden" name="inventario_id" value={inventario.id}/><h2 className="font-black text-slate-900">Cancelar inventário</h2><p className="mt-1 text-sm text-slate-500">Cancela sem alterar saldos. O motivo é obrigatório e permanece registrado.</p><input name="motivo_cancelamento" required className="ui-input mt-4" placeholder="Motivo do cancelamento"/><button className="btn-secondary mt-4 text-rose-700"><XCircle className="size-4"/>Cancelar inventário</button></form></section>:null}
  </SectionPage>;
}

function Kpi({label,value}:{label:string;value:number}){return <div className="his-kpi"><p className="text-xs font-black uppercase text-slate-400">{label}</p><p className="mt-2 text-3xl font-black text-slate-950">{value}</p></div>}
