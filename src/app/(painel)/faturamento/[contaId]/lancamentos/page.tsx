import Link from "next/link";
import { FileSpreadsheet, Plus, Save, Search, Trash2 } from "lucide-react";
import { notFound } from "next/navigation";
import { LancamentosGrid } from "@/components/faturamento/lancamentos-grid";
import { SectionPage } from "@/components/painel/section-page";
import { requirePermission } from "@/lib/permissions/server";
import { excluirLancamentoConta, salvarLancamentoConta } from "@/modules/faturamento/conta-operacional-actions";

type Rel<T>=T|T[]|null;
function one<T>(value:Rel<T>):T|null{return Array.isArray(value)?value[0]??null:value;}
function brl(value:number|string|null|undefined){return Number(value??0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});}
function localInput(value:string|null|undefined){if(!value)return "";const d=new Date(value);const p=(n:number)=>String(n).padStart(2,"0");return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;}

const subgrupos=["Honorários","Procedimentos","Exames","Materiais","OPME","Medicamentos","Soluções","Diárias","Taxas","Gases medicinais","Pacotes","Outros"];
const origens=["procedimento","honorario","laboratorio","imagem","material","opme","medicamento","taxa","diaria","gas_medicinal","pacote","outro"];

export const dynamic="force-dynamic";
export const revalidate=0;

export default async function LancamentosPage({params,searchParams}:{params:Promise<{contaId:string}>;searchParams:Promise<{erro?:string;sucesso?:string}>}){
  const {contaId}=await params;const qs=await searchParams;
  const {supabase,empresaId,unidadeId}=await requirePermission("faturamento.criar");
  const {data:conta}=await supabase.from("contas_faturamento")
    .select("id,status,valor_bruto,valor_desconto,valor_liquido,tipo_cobranca,convenio_id,atendimento:atendimentos(numero_atendimento),paciente:pacientes(nome_completo,ra,numero_registro),convenio:convenios(nome_fantasia)")
    .eq("id",contaId).eq("empresa_id",empresaId).eq("unidade_id",unidadeId).maybeSingle();
  if(!conta)notFound();
  const [{data:itens},{data:grupos},{count:guiasAtivas}]=await Promise.all([
    supabase.from("conta_faturamento_itens").select("id,origem_tipo,item_assistencial_id,categoria_item,data_execucao,tabela,codigo,descricao,quantidade,valor_unitario,percentual_reducao_acrescimo,valor_total,setor,setor_subgrupo,subgrupo_item,parcial_numero,parcial_inicio,parcial_fim,cobravel,observacao,grupo_ato_id,sequencia_ato,via_acesso,urgencia,horario_especial,acomodacao_individual,anestesia,numero_auxiliares,filme_m2,origem_valor,metodologia_preco,valor_contratual_calculado").eq("conta_id",contaId).order("data_execucao").limit(3000),
    supabase.from("conta_faturamento_grupos_ato").select("id,codigo_grupo").eq("conta_id",contaId).order("data_ato"),
    supabase.from("tiss_guias").select("id",{count:"exact",head:true}).eq("conta_id",contaId).neq("status","cancelada"),
  ]);
  const rows=itens??[];const paciente=one(conta.paciente);const atendimento=one(conta.atendimento);const convenio=one(conta.convenio);
  const salvar=salvarLancamentoConta.bind(null,contaId);const excluir=excluirLancamentoConta.bind(null,contaId);
  const editavel=!["faturada","cancelada"].includes(conta.status)&&(guiasAtivas??0)===0;
  const total=rows.filter(r=>r.cobravel).reduce((s,r)=>s+Number(r.valor_total??0),0);

  return <SectionPage eyebrow="Faturamento / Conta / Lançamentos" title="Lançamentos da conta" description={`${paciente?.nome_completo??"Paciente"} · Atendimento #${atendimento?.numero_atendimento??"—"} · ${convenio?.nome_fantasia??(conta.tipo_cobranca==="particular"?"Particular":"Convênio")}`} actions={<div className="flex flex-wrap gap-2"><Link href={`/faturamento/${contaId}/catalogo`} className="ui-button-primary"><Search className="size-4"/>Buscar nas tabelas do contrato</Link><Link href={`/faturamento/${contaId}/procedimentos-cirurgicos`} className="ui-button-secondary">Cirúrgicos / SADT</Link></div>}>
    {qs.erro?<div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">Não foi possível concluir a operação: {qs.erro}.</div>:null}
    {qs.sucesso?<div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">Operação concluída: {qs.sucesso.replaceAll("-"," ")}.</div>:null}
    {!editavel?<div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">Conta protegida para edição: {guiasAtivas?"existe Guia TISS ativa":"status da conta não permite alteração"}.</div>:null}

    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Kpi label="Lançamentos" value={String(rows.length)}/><Kpi label="Total dos itens" value={brl(total)}/><Kpi label="Valor bruto da conta" value={brl(conta.valor_bruto)}/><Kpi label="Valor líquido" value={brl(conta.valor_liquido)}/></section>

    <section className="ui-card mt-5 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4"><div className="flex items-center gap-3"><FileSpreadsheet className="size-5 text-brand-700"/><div><h2 className="font-black text-slate-900">Grade da conta</h2><p className="text-sm text-slate-500">Visão estilo planilha com filtros instantâneos por setor, subgrupo, grupo do item, data e parcial.</p></div></div><span className="text-sm font-bold text-slate-700">{rows.length} linha(s)</span></div>
      <LancamentosGrid rows={rows.map(r=>({id:r.id,data_execucao:r.data_execucao,tabela:r.tabela,codigo:r.codigo,descricao:r.descricao,quantidade:r.quantidade,valor_unitario:r.valor_unitario,valor_total:r.valor_total,setor:r.setor,setor_subgrupo:r.setor_subgrupo,categoria_item:r.categoria_item,subgrupo_item:r.subgrupo_item,parcial_numero:r.parcial_numero,parcial_inicio:r.parcial_inicio,parcial_fim:r.parcial_fim,origem_valor:r.origem_valor}))}/>
    </section>

    <section className="ui-card mt-5 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-black text-slate-900">Novo lançamento manual</h2><p className="text-sm text-slate-500">Use somente quando o item não estiver cadastrado. Para itens contratados, use a busca automática por código/descrição.</p></div><Link href={`/faturamento/${contaId}/catalogo`} className="ui-button-secondary"><Search className="size-4"/>Pesquisar item</Link></div>
      <form action={salvar} className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-6">
        <input type="hidden" name="cobravel_presente" value="1"/>
        <select name="origem_tipo" className="ui-input" disabled={!editavel}>{origens.map(v=><option key={v} value={v}>{v.replaceAll("_"," ")}</option>)}</select>
        <input name="tabela" className="ui-input" placeholder="Tabela TISS (manual)" disabled={!editavel}/><input name="codigo" className="ui-input" placeholder="Código" disabled={!editavel}/><input type="datetime-local" name="data_execucao" className="ui-input" disabled={!editavel}/><input name="quantidade" defaultValue="1" className="ui-input" inputMode="decimal" disabled={!editavel}/><input name="valor_unitario" defaultValue="0,00" className="ui-input" inputMode="decimal" disabled={!editavel}/>
        <input name="descricao" required className="ui-input md:col-span-2 xl:col-span-3" placeholder="Descrição" disabled={!editavel}/><input name="setor" className="ui-input" placeholder="Setor" disabled={!editavel}/><input name="setor_subgrupo" className="ui-input" placeholder="Subgrupo do setor" disabled={!editavel}/><select name="subgrupo_item" className="ui-input" defaultValue="Procedimentos" disabled={!editavel}>{subgrupos.map(v=><option key={v}>{v}</option>)}</select>
        <input name="parcial_numero" className="ui-input" inputMode="numeric" placeholder="Parcial nº" disabled={!editavel}/><label className="text-xs font-semibold text-slate-500">Início da parcial<input type="date" name="parcial_inicio" className="ui-input mt-1" disabled={!editavel}/></label><label className="text-xs font-semibold text-slate-500">Fim da parcial<input type="date" name="parcial_fim" className="ui-input mt-1" disabled={!editavel}/></label><input name="percentual_reducao_acrescimo" defaultValue="0" className="ui-input" inputMode="decimal" placeholder="% red./acrésc." disabled={!editavel}/><label className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 text-sm"><input type="checkbox" name="cobravel" defaultChecked disabled={!editavel}/>Cobravel</label><input name="observacao" className="ui-input md:col-span-2 xl:col-span-4" placeholder="Observação" disabled={!editavel}/><button disabled={!editavel} className="ui-button-primary disabled:opacity-50"><Plus className="size-4"/>Adicionar</button>
      </form>
    </section>

    <section className="mt-5 space-y-3">
      <div><h2 className="font-black text-slate-900">Editar lançamentos</h2><p className="text-sm text-slate-500">A grade acima é para conferência rápida; abra somente a linha que precisa alterar.</p></div>
      {rows.length?rows.map(item=><details id={`editar-${item.id}`} key={item.id} className="ui-card scroll-mt-24 p-4"><summary className="cursor-pointer list-none"><div className="flex flex-wrap items-center justify-between gap-3"><div><b className="font-mono text-xs text-brand-700">{item.tabela??"—"} · {item.codigo??"—"}</b><p className="mt-1 font-semibold text-slate-900">{item.descricao}</p><p className="text-xs text-slate-500">{item.setor??"Sem setor"} · {item.subgrupo_item??item.categoria_item??"Sem grupo"} · {item.parcial_numero?`Parcial ${item.parcial_numero}`:"Sem parcial"}</p></div><strong>{brl(item.valor_total)}</strong></div></summary>
        <form action={salvar} className="mt-4 grid gap-3 border-t border-slate-100 pt-4 md:grid-cols-2 xl:grid-cols-8">
          <input type="hidden" name="item_id" value={item.id}/><input type="hidden" name="origem_tipo" value={item.origem_tipo}/><input type="hidden" name="cobravel_presente" value="1"/>
          <input name="descricao" defaultValue={item.descricao} required className="ui-input md:col-span-2" disabled={!editavel}/><input name="tabela" defaultValue={item.tabela??""} className="ui-input" placeholder="Tabela" disabled={!editavel}/><input name="codigo" defaultValue={item.codigo??""} className="ui-input" placeholder="Código" disabled={!editavel}/><input type="datetime-local" name="data_execucao" defaultValue={localInput(item.data_execucao)} className="ui-input" disabled={!editavel}/><input name="quantidade" defaultValue={String(item.quantidade??1)} className="ui-input" inputMode="decimal" disabled={!editavel}/><input name="valor_unitario" defaultValue={Number(item.valor_unitario??0).toLocaleString("pt-BR",{minimumFractionDigits:2})} className="ui-input" inputMode="decimal" disabled={!editavel}/><input name="percentual_reducao_acrescimo" defaultValue={String(item.percentual_reducao_acrescimo??0)} className="ui-input" inputMode="decimal" disabled={!editavel}/>
          <input name="setor" defaultValue={item.setor??""} className="ui-input" placeholder="Setor" disabled={!editavel}/><input name="setor_subgrupo" defaultValue={item.setor_subgrupo??""} className="ui-input" placeholder="Subgrupo setor" disabled={!editavel}/><select name="subgrupo_item" defaultValue={item.subgrupo_item??"Outros"} className="ui-input" disabled={!editavel}>{subgrupos.map(v=><option key={v}>{v}</option>)}</select><input name="parcial_numero" defaultValue={item.parcial_numero??""} className="ui-input" inputMode="numeric" placeholder="Parcial nº" disabled={!editavel}/><input type="date" name="parcial_inicio" defaultValue={item.parcial_inicio??""} className="ui-input" disabled={!editavel}/><input type="date" name="parcial_fim" defaultValue={item.parcial_fim??""} className="ui-input" disabled={!editavel}/><select name="grupo_ato_id" defaultValue={item.grupo_ato_id??""} className="ui-input" disabled={!editavel}><option value="">Sem ato</option>{(grupos??[]).map(g=><option key={g.id} value={g.id}>{g.codigo_grupo}</option>)}</select><input name="sequencia_ato" defaultValue={item.sequencia_ato??""} className="ui-input" placeholder="Seq. ato" disabled={!editavel}/>
          <input name="via_acesso" defaultValue={item.via_acesso??""} className="ui-input" placeholder="Via" disabled={!editavel}/><input name="numero_auxiliares" defaultValue={item.numero_auxiliares??0} className="ui-input" inputMode="numeric" placeholder="Auxiliares" disabled={!editavel}/><input name="filme_m2" defaultValue={item.filme_m2??0} className="ui-input" inputMode="decimal" placeholder="Filme m²" disabled={!editavel}/><input name="observacao" defaultValue={item.observacao??""} className="ui-input md:col-span-2 xl:col-span-3" placeholder="Observação" disabled={!editavel}/>
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 px-3 text-xs xl:col-span-3"><label><input type="checkbox" name="cobravel" defaultChecked={item.cobravel} disabled={!editavel}/> Cobravel</label><label><input type="checkbox" name="urgencia" defaultChecked={item.urgencia} disabled={!editavel}/> Urgência</label><label><input type="checkbox" name="horario_especial" defaultChecked={item.horario_especial} disabled={!editavel}/> Horário especial</label><label><input type="checkbox" name="acomodacao_individual" defaultChecked={item.acomodacao_individual} disabled={!editavel}/> Acomod. individual</label><label><input type="checkbox" name="anestesia" defaultChecked={item.anestesia} disabled={!editavel}/> Anestesia</label></div>
          <label className="flex items-center gap-2 text-xs text-slate-600"><input type="checkbox" name="recalcular_contrato" defaultChecked disabled={!editavel}/>Recalcular contrato</label><div className="flex justify-end gap-2 xl:col-span-2"><button disabled={!editavel} className="ui-button-secondary disabled:opacity-50"><Save className="size-4"/>Salvar</button><button disabled={!editavel} formAction={excluir} className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 disabled:opacity-50"><Trash2 className="size-4"/>Excluir</button></div>
        </form>
      </details>):<div className="ui-card p-8 text-center text-slate-500">Nenhum lançamento na conta.</div>}
    </section>
  </SectionPage>;
}

function Kpi({label,value}:{label:string;value:string}){return <div className="ui-card p-4"><p className="text-xs font-bold uppercase tracking-wide text-slate-400">{label}</p><p className="mt-2 text-lg font-black text-slate-950">{value}</p></div>}
