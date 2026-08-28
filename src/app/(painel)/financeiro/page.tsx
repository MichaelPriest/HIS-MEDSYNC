import Link from "next/link";
import { AlertTriangle, Banknote, CalendarClock, FileText } from "lucide-react";
import { SectionPage } from "@/components/painel/section-page";
import { requireAnyPermission } from "@/lib/permissions/server";

function one<T>(rel:T|T[]|null){return Array.isArray(rel)?rel[0]??null:rel;}
function today(){return new Intl.DateTimeFormat("en-CA",{timeZone:"America/Sao_Paulo",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());}
function brl(value:number){return `R$ ${value.toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2})}`;}

export default async function FinanceiroPage(){
  const {supabase}=await requireAnyPermission(["financeiro.visualizar","financeiro.receber","financeiro.conciliar","financeiro.gerenciar"]);
  const {data:recebiveis}=await supabase.from("financeiro_recebiveis").select("id,competencia,previsao_pagamento,data_pagamento,valor_bruto,valor_glosa,valor_liquido_previsto,valor_recebido,status,lote:tiss_lotes(id,numero_lote,protocolo_envio_operadora,protocolo_operadora),convenio:convenios(nome_fantasia)").order("previsao_pagamento",{ascending:true}).limit(300);
  const rows=recebiveis??[];
  const totalPrev=rows.reduce((s,r)=>s+Number(r.valor_liquido_previsto||0),0);
  const recebido=rows.reduce((s,r)=>s+Number(r.valor_recebido||0),0);
  const glosa=rows.reduce((s,r)=>s+Number(r.valor_glosa||0),0);
  const saldo=rows.reduce((s,r)=>s+Math.max(0,Number(r.valor_liquido_previsto||0)-Number(r.valor_recebido||0)),0);
  const hoje=today();
  const vencidos=rows.filter(r=>r.previsao_pagamento&&r.previsao_pagamento<hoje&&!['recebido','cancelado'].includes(String(r.status))&&Number(r.valor_recebido||0)<Number(r.valor_liquido_previsto||0)-0.01);
  const valorVencido=vencidos.reduce((s,r)=>s+Math.max(0,Number(r.valor_liquido_previsto||0)-Number(r.valor_recebido||0)),0);

  return <SectionPage eyebrow="Financeiro" title="Contas a receber" description="Previsões TISS, glosas, baixas, conciliação e vínculo com NFS-e. O histórico de recebimentos é append-only: estornos não apagam a baixa original.">
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5"><Card icon={CalendarClock} label="Líquido previsto" value={totalPrev}/><Card icon={Banknote} label="Baixado" value={recebido}/><Card icon={FileText} label="Glosas" value={glosa}/><Card icon={Banknote} label="Saldo em aberto" value={saldo}/><Card icon={AlertTriangle} label={`Vencido · ${vencidos.length} título(s)`} value={valorVencido} alert={vencidos.length>0}/></div>

    {vencidos.length?<div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"><strong>Pagamentos após a previsão:</strong> há {vencidos.length} recebível(is) com saldo em aberto e previsão anterior a hoje. A sinalização é derivada da data; nenhum lançamento é alterado automaticamente.</div>:null}

    <section className="ui-card mt-6 overflow-hidden"><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">Lote</th><th className="px-4 py-3">Convênio</th><th className="px-4 py-3">Competência</th><th className="px-4 py-3">Previsão</th><th className="px-4 py-3 text-right">Previsto</th><th className="px-4 py-3 text-right">Baixado</th><th className="px-4 py-3 text-right">Saldo</th><th className="px-4 py-3">Status</th></tr></thead><tbody className="divide-y divide-slate-100">{rows.length?rows.map(r=>{const lote=one(r.lote);const conv=one(r.convenio);const restante=Math.max(0,Number(r.valor_liquido_previsto||0)-Number(r.valor_recebido||0));const overdue=Boolean(r.previsao_pagamento&&r.previsao_pagamento<hoje&&restante>0&&!['recebido','cancelado'].includes(String(r.status)));return <tr key={r.id} className={overdue?"bg-amber-50/40":""}><td className="px-4 py-3"><Link className="font-semibold text-brand-700 hover:underline" href={`/financeiro/recebiveis/${r.id}`}>{lote?`Lote ${lote.numero_lote}`:"Recebível"}</Link><div className="text-xs text-slate-400">Prot. {lote?.protocolo_operadora??lote?.protocolo_envio_operadora??"—"}</div></td><td className="px-4 py-3">{conv?.nome_fantasia??"—"}</td><td className="px-4 py-3">{r.competencia}</td><td className={`px-4 py-3 ${overdue?"font-bold text-amber-700":""}`}>{r.previsao_pagamento?new Date(`${r.previsao_pagamento}T12:00:00`).toLocaleDateString("pt-BR"):"—"}{overdue?<div className="mt-1 text-[11px] font-bold uppercase">Vencido</div>:null}</td><td className="px-4 py-3 text-right">{brl(Number(r.valor_liquido_previsto||0))}</td><td className="px-4 py-3 text-right">{brl(Number(r.valor_recebido||0))}</td><td className={`px-4 py-3 text-right font-semibold ${overdue?"text-amber-700":""}`}>{brl(restante)}</td><td className="px-4 py-3 capitalize">{String(r.status).replaceAll("_"," ")}</td></tr>}):<tr><td colSpan={8} className="px-4 py-8 text-center text-slate-500">Nenhum recebível.</td></tr>}</tbody></table></div></section>
    <div className="mt-5"><Link href="/financeiro/notas-fiscais" className="ui-button-primary">Notas fiscais de serviço</Link></div>
  </SectionPage>;
}

function Card({icon:Icon,label,value,alert=false}:{icon:typeof Banknote;label:string;value:number;alert?:boolean}){return <div className={`ui-card p-5 ${alert?"border-amber-200 bg-amber-50":""}`}><Icon className={`size-5 ${alert?"text-amber-700":"text-brand-700"}`}/><p className="mt-3 text-sm text-slate-500">{label}</p><p className={`mt-1 text-2xl font-bold ${alert?"text-amber-800":"text-slate-950"}`}>{brl(value)}</p></div>}
