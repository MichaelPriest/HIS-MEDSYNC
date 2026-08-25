import Link from "next/link";
import { BarChart3, BedDouble, CircleDollarSign, ClipboardCheck, FileWarning, WalletCards } from "lucide-react";
import { SectionPage } from "@/components/painel/section-page";
import { createClient } from "@/lib/supabase/server";

export default async function DiretoriaPage(){
  const supabase=await createClient();
  const {data:indicadores}=await supabase.from("vw_diretoria_indicadores").select("*").limit(20);
  const totais=(indicadores??[]).reduce((a,i)=>({at:a.at+Number(i.atendimentos_hoje||0),int:a.int+Number(i.pacientes_internados||0),fat:a.fat+Number(i.faturamento_competencia||0),rec:a.rec+Number(i.contas_receber_aberto||0),pag:a.pag+Number(i.contas_pagar_aberto||0),glo:a.glo+Number(i.glosas_abertas||0),aud:a.aud+Number(i.contas_em_auditoria||0),cm:a.cm+Number(i.contas_medicas_pendentes||0)}),{at:0,int:0,fat:0,rec:0,pag:0,glo:0,aud:0,cm:0});
  const money=(v:number)=>`R$ ${v.toLocaleString("pt-BR",{minimumFractionDigits:2})}`;
  return <SectionPage eyebrow="Gestão / Diretoria" title="Painel da Diretoria" description="Visão executiva consolidada de assistência, receita, despesas, auditoria e ciclo financeiro." actions={<Link href="/relatorios" className="ui-button-primary"><BarChart3 className="size-4"/>Central de Relatórios</Link>}>
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"><Card icon={BarChart3} label="Atendimentos hoje" value={String(totais.at)}/><Card icon={BedDouble} label="Internados" value={String(totais.int)}/><Card icon={CircleDollarSign} label="Faturamento competência" value={money(totais.fat)}/><Card icon={WalletCards} label="A receber em aberto" value={money(totais.rec)}/><Card icon={WalletCards} label="A pagar em aberto" value={money(totais.pag)}/><Card icon={FileWarning} label="Glosas abertas" value={money(totais.glo)}/><Card icon={ClipboardCheck} label="Contas em auditoria" value={String(totais.aud)}/><Card icon={ClipboardCheck} label="Contas médicas pendentes" value={String(totais.cm)}/></div>
  </SectionPage>;
}
function Card({icon:Icon,label,value}:{icon:typeof BarChart3;label:string;value:string}){return <div className="ui-card p-5"><div className="flex items-center justify-between"><p className="text-sm font-medium text-slate-500">{label}</p><Icon className="size-5 text-brand-700"/></div><p className="mt-3 text-2xl font-bold text-slate-950">{value}</p></div>}
