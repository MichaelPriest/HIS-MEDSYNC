import Link from "next/link";
import { Banknote, CheckCircle2, CircleDollarSign, ReceiptText, RotateCcw, ShieldCheck } from "lucide-react";
import { notFound } from "next/navigation";
import { SectionPage } from "@/components/painel/section-page";
import { requireAnyPermission } from "@/lib/permissions/server";
import { conciliarRecebimentoFinanceiro, estornarRecebimentoFinanceiro, registrarRecebimentoFinanceiro } from "@/modules/financeiro/actions";

function one<T>(rel:T|T[]|null|undefined):T|null{return Array.isArray(rel)?rel[0]??null:rel??null;}
function brl(value:number|null|undefined){return `R$ ${Number(value??0).toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2})}`;}
function date(value:string|null|undefined){return value?new Date(`${value.slice(0,10)}T12:00:00`).toLocaleDateString("pt-BR"):"—";}
function dateTime(value:string|null|undefined){return value?new Date(value).toLocaleString("pt-BR",{timeZone:"America/Sao_Paulo"}):"—";}
function today(){return new Intl.DateTimeFormat("en-CA",{timeZone:"America/Sao_Paulo",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());}
function statusLabel(value:string){return value.replaceAll("_"," ");}

const errorLabels:Record<string,string>={
  permissao:"Seu perfil não possui permissão para esta operação financeira.",
  "excede-saldo":"O valor da baixa excede o saldo restante do recebível.",
  composicao:"A baixa deve corresponder à soma do valor creditado, retenções e tarifas.",
  forma:"Forma de recebimento inválida.",
  cancelado:"O recebível está cancelado e não aceita novas baixas.",
  estornado:"O recebimento já foi estornado.",
  motivo:"Informe o motivo do estorno.",
  dados:"Revise data e valores do recebimento.",
  "nao-localizado":"Registro financeiro não localizado no seu escopo.",
  operacao:"A operação financeira não pôde ser concluída.",
};
const successLabels:Record<string,string>={
  recebimento:"Recebimento registrado no ledger e saldo do título recalculado.",
  conciliado:"Recebimento conciliado com rastreabilidade.",
  estornado:"Recebimento estornado; o título foi recalculado sem apagar o histórico.",
};

export default async function RecebivelPage({params,searchParams}:{params:Promise<{recebivelId:string}>;searchParams:Promise<{erro?:string;sucesso?:string}>}){
  const {recebivelId}=await params;
  const qs=await searchParams;
  const {supabase}=await requireAnyPermission(["financeiro.visualizar","financeiro.receber","financeiro.conciliar","financeiro.gerenciar"]);

  const {data:recebivel}=await supabase.from("financeiro_recebiveis")
    .select("id,lote_id,competencia,previsao_pagamento,data_pagamento,valor_bruto,valor_glosa,valor_liquido_previsto,valor_recebido,status,created_at,updated_at,lote:tiss_lotes(id,numero_lote,status,protocolo_operadora,protocolo_envio_operadora),convenio:convenios(nome_fantasia,registro_ans)")
    .eq("id",recebivelId).maybeSingle();
  if(!recebivel)notFound();

  const [pagamentosRes,notaRes,receberGrant,conciliarGrant,gerenciarGrant]=await Promise.all([
    supabase.from("financeiro_recebimentos").select("id,data_recebimento,valor_baixado,valor_retencoes,valor_tarifas,valor_creditado,forma_recebimento,referencia_bancaria,documento_operadora,observacoes,status,conciliado_em,estornado_em,motivo_estorno,created_at").eq("recebivel_id",recebivelId).order("created_at",{ascending:false}),
    recebivel.lote_id?supabase.from("notas_fiscais_servico").select("id,numero_nfse,numero_rps,status,valor_servicos,valor_liquido,data_emissao").eq("lote_id",recebivel.lote_id).neq("status","cancelada").order("created_at",{ascending:false}).limit(1).maybeSingle():Promise.resolve({data:null}),
    supabase.rpc("tem_permissao",{p_empresa:null,p_unidade:null,p_codigo:"financeiro.receber"}),
    supabase.rpc("tem_permissao",{p_empresa:null,p_unidade:null,p_codigo:"financeiro.conciliar"}),
    supabase.rpc("tem_permissao",{p_empresa:null,p_unidade:null,p_codigo:"financeiro.gerenciar"}),
  ]);

  // tem_permissao com contexto nulo pode não resolver o escopo em todas as instalações; confirme no escopo do título quando necessário.
  const {data:scope}=await supabase.from("financeiro_recebiveis").select("empresa_id,unidade_id").eq("id",recebivelId).maybeSingle();
  const [receiveScoped,conciliateScoped,manageScoped]=scope?await Promise.all([
    supabase.rpc("tem_permissao",{p_empresa:scope.empresa_id,p_unidade:scope.unidade_id,p_codigo:"financeiro.receber"}),
    supabase.rpc("tem_permissao",{p_empresa:scope.empresa_id,p_unidade:scope.unidade_id,p_codigo:"financeiro.conciliar"}),
    supabase.rpc("tem_permissao",{p_empresa:scope.empresa_id,p_unidade:scope.unidade_id,p_codigo:"financeiro.gerenciar"}),
  ]):[{data:false},{data:false},{data:false}];
  void receberGrant;void conciliarGrant;void gerenciarGrant;

  const canManage=manageScoped.data===true;
  const canReceive=receiveScoped.data===true||canManage;
  const canConciliate=conciliateScoped.data===true||canManage;
  const pagamentos=pagamentosRes.data??[];
  const lote=one(recebivel.lote);
  const convenio=one(recebivel.convenio);
  const nota=notaRes.data;
  const saldo=Math.max(0,Number(recebivel.valor_liquido_previsto||0)-Number(recebivel.valor_recebido||0));
  const vencido=Boolean(recebivel.previsao_pagamento&&recebivel.previsao_pagamento<today()&&saldo>0&&recebivel.status!=="cancelado");
  const actionReceber=registrarRecebimentoFinanceiro.bind(null,recebivelId);

  return <SectionPage eyebrow="Financeiro / Contas a receber" title={lote?`Recebível do lote ${lote.numero_lote}`:"Recebível financeiro"} description={`${convenio?.nome_fantasia??"Convênio não informado"} · Competência ${recebivel.competencia}`}>
    {qs.erro?<div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{errorLabels[qs.erro]??errorLabels.operacao}</div>:null}
    {qs.sucesso?<div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">{successLabels[qs.sucesso]??"Operação concluída."}</div>:null}

    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      <Kpi label="Bruto" value={brl(recebivel.valor_bruto)} />
      <Kpi label="Glosa" value={brl(recebivel.valor_glosa)} />
      <Kpi label="Líquido previsto" value={brl(recebivel.valor_liquido_previsto)} />
      <Kpi label="Baixado" value={brl(recebivel.valor_recebido)} />
      <Kpi label="Saldo" value={brl(saldo)} alert={vencido} />
    </section>

    <div className="mt-5 grid gap-5 xl:grid-cols-[1fr_1fr]">
      <section className="ui-card p-5">
        <div className="flex items-center gap-3"><ReceiptText className="size-5 text-brand-700"/><div><h2 className="font-black text-slate-900">Origem do título</h2><p className="text-sm text-slate-500">TISS, protocolo e documento fiscal vinculados.</p></div></div>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <Info label="Status" value={statusLabel(recebivel.status)} />
          <Info label="Previsão de pagamento" value={date(recebivel.previsao_pagamento)} alert={vencido} />
          <Info label="Data da última baixa" value={date(recebivel.data_pagamento)} />
          <Info label="Registro ANS" value={convenio?.registro_ans??"—"} />
          <Info label="Protocolo operadora" value={lote?.protocolo_operadora??lote?.protocolo_envio_operadora??"—"} />
          <Info label="NFS-e" value={nota?.numero_nfse?`NFS-e ${nota.numero_nfse}`:nota?.numero_rps?`RPS ${nota.numero_rps}`:"Não emitida"} />
        </dl>
        <div className="mt-4 flex flex-wrap gap-2">{lote?<Link href={`/faturamento/lotes/${lote.id}`} className="ui-button-secondary">Abrir lote TISS</Link>:null}{nota?<Link href={`/financeiro/notas-fiscais/${nota.id}`} className="ui-button-secondary">Abrir NFS-e</Link>:null}</div>
      </section>

      <section className="ui-card p-5">
        <div className="flex items-center gap-3"><CircleDollarSign className="size-5 text-emerald-700"/><div><h2 className="font-black text-slate-900">Registrar recebimento</h2><p className="text-sm text-slate-500">A baixa soma crédito efetivo, retenções e tarifas; o título é recalculado pelo ledger.</p></div></div>
        {canReceive&&saldo>0&&recebivel.status!=="cancelado"?<form action={actionReceber} className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="space-y-1 text-xs font-semibold text-slate-500"><span>Data *</span><input type="date" name="data_recebimento" required defaultValue={today()} className="ui-input"/></label>
          <label className="space-y-1 text-xs font-semibold text-slate-500"><span>Valor da baixa *</span><input name="valor_baixado" inputMode="decimal" required defaultValue={saldo.toFixed(2).replace(".",",")} className="ui-input"/></label>
          <label className="space-y-1 text-xs font-semibold text-slate-500"><span>Retenções</span><input name="valor_retencoes" inputMode="decimal" defaultValue="0,00" className="ui-input"/></label>
          <label className="space-y-1 text-xs font-semibold text-slate-500"><span>Tarifas</span><input name="valor_tarifas" inputMode="decimal" defaultValue="0,00" className="ui-input"/></label>
          <label className="space-y-1 text-xs font-semibold text-slate-500"><span>Valor creditado</span><input name="valor_creditado" inputMode="decimal" placeholder="Calculado se vazio" className="ui-input"/></label>
          <label className="space-y-1 text-xs font-semibold text-slate-500"><span>Forma</span><select name="forma_recebimento" defaultValue="credito_bancario" className="ui-input"><option value="credito_bancario">Crédito bancário</option><option value="pix">PIX</option><option value="ted">TED</option><option value="boleto">Boleto</option><option value="cheque">Cheque</option><option value="dinheiro">Dinheiro</option><option value="outro">Outro</option></select></label>
          <input name="referencia_bancaria" placeholder="Referência / ID bancário" className="ui-input"/>
          <input name="documento_operadora" placeholder="Documento da operadora" className="ui-input"/>
          <textarea name="observacoes" placeholder="Observações" className="ui-input min-h-20 sm:col-span-2"/>
          <button className="ui-button-primary sm:col-span-2"><Banknote className="size-4"/>Registrar baixa</button>
        </form>:<div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">{saldo<=0?"Título sem saldo pendente.":recebivel.status==="cancelado"?"Título cancelado.":"Seu perfil não possui permissão para registrar recebimentos."}</div>}
      </section>
    </div>

    <section className="ui-card mt-5 overflow-hidden">
      <div className="border-b border-slate-100 px-5 py-4"><h2 className="font-black text-slate-900">Ledger de recebimentos</h2><p className="mt-1 text-xs text-slate-500">Baixas não são apagadas. Conciliação e estorno permanecem auditáveis.</p></div>
      <div className="divide-y divide-slate-100">{pagamentos.length?pagamentos.map(p=>{
        const conciliar=conciliarRecebimentoFinanceiro.bind(null,p.id,recebivelId);
        const estornar=estornarRecebimentoFinanceiro.bind(null,p.id,recebivelId);
        return <article key={p.id} className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex items-center gap-2"><strong className="text-slate-900">{brl(p.valor_baixado)}</strong><span className={`rounded-full px-2 py-1 text-[11px] font-black uppercase ${p.status==="conciliado"?"bg-emerald-50 text-emerald-700":p.status==="estornado"?"bg-rose-50 text-rose-700":"bg-amber-50 text-amber-700"}`}>{p.status}</span></div><p className="mt-1 text-xs text-slate-500">{date(p.data_recebimento)} · {statusLabel(p.forma_recebimento)} · crédito {brl(p.valor_creditado)} · retenções {brl(p.valor_retencoes)} · tarifas {brl(p.valor_tarifas)}</p><p className="mt-1 text-xs text-slate-500">Ref. {p.referencia_bancaria??"—"} · Documento {p.documento_operadora??"—"}</p>{p.conciliado_em?<p className="mt-1 text-xs text-emerald-600">Conciliado em {dateTime(p.conciliado_em)}</p>:null}{p.estornado_em?<p className="mt-1 text-xs text-rose-600">Estornado em {dateTime(p.estornado_em)} · {p.motivo_estorno??"motivo não informado"}</p>:null}</div></div>
          {p.status==="registrado"&&canConciliate?<form action={conciliar} className="mt-4 grid gap-2 sm:grid-cols-[1fr_1fr_auto]"><input name="referencia_bancaria" defaultValue={p.referencia_bancaria??""} placeholder="Referência bancária" className="ui-input"/><input name="observacoes" placeholder="Observação da conciliação" className="ui-input"/><button className="ui-button-secondary"><CheckCircle2 className="size-4"/>Conciliar</button></form>:null}
          {p.status!=="estornado"&&canManage?<form action={estornar} className="mt-3 flex flex-col gap-2 sm:flex-row"><input name="motivo" required placeholder="Motivo obrigatório do estorno" className="ui-input flex-1"/><button className="ui-button-secondary"><RotateCcw className="size-4"/>Estornar</button></form>:null}
        </article>;
      }):<div className="px-5 py-10 text-center text-sm text-slate-500">Nenhum recebimento registrado.</div>}</div>
    </section>
  </SectionPage>;
}

function Kpi({label,value,alert=false}:{label:string;value:string;alert?:boolean}){return <div className={`ui-card p-4 ${alert?"border-amber-200 bg-amber-50":""}`}><ShieldCheck className={`size-4 ${alert?"text-amber-700":"text-brand-700"}`}/><p className="mt-2 text-xs font-semibold text-slate-500">{label}</p><p className="mt-1 text-xl font-black text-slate-950">{value}</p></div>}
function Info({label,value,alert=false}:{label:string;value:string;alert?:boolean}){return <div><dt className="text-xs font-semibold text-slate-400">{label}</dt><dd className={`mt-1 font-semibold ${alert?"text-amber-700":"text-slate-800"}`}>{value}</dd></div>}
