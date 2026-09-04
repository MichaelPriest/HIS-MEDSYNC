import Link from "next/link";
import { Activity, Clock3, Plus, Stethoscope, UsersRound } from "lucide-react";
import { notFound } from "next/navigation";
import { BillingActBackgroundForm } from "@/components/faturamento/billing-act-background-form";
import {
  SurgicalTeamBillingPanel,
  type SurgicalBillingMember,
  type SurgicalClinicalMember,
  type SurgicalProcedureBilling,
} from "@/components/faturamento/surgical-team-billing";
import { SectionPage } from "@/components/painel/section-page";
import { requirePermission } from "@/lib/permissions/server";

type Rel<T> = T | T[] | null;
type Paciente = { nome_completo: string | null; ra: string | null; numero_registro: string | null };
type Atendimento = { numero_atendimento: number | string | null };
type Convenio = { nome_fantasia: string | null };
type Professional = { nome_completo: string | null; conselho: string | null; numero_conselho: string | null; uf_conselho: string | null };
type ClinicalMemberRaw = Omit<SurgicalClinicalMember, "profissional"> & { profissional: Rel<Professional> };

function one<T>(value: Rel<T>): T | null { return Array.isArray(value) ? value[0] ?? null : value; }
function brl(value: number | string | null | undefined) { return Number(value ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }); }
function localDateTime(value: string | null | undefined) {
  if (!value) return "";
  const d = new Date(value);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ProcedimentosCirurgicosPage({params}:{params:Promise<{contaId:string}>}) {
  const { contaId } = await params;
  const { supabase, empresaId, unidadeId } = await requirePermission("faturamento.criar");

  const { data: conta } = await supabase.from("contas_faturamento")
    .select("id,atendimento_id,status,tipo_cobranca,valor_bruto,convenio_id,atendimento:atendimentos(numero_atendimento),paciente:pacientes(nome_completo,ra,numero_registro),convenio:convenios(nome_fantasia)")
    .eq("id",contaId).eq("empresa_id",empresaId).eq("unidade_id",unidadeId).maybeSingle();
  if (!conta) notFound();

  const [
    {data:grupos},
    {data:itens},
    {count:guiasAtivas},
    {data:procedimentosCirurgicos},
    {data:equipeClinicaRaw},
    {data:equipeFaturamento},
  ] = await Promise.all([
    supabase.from("conta_faturamento_grupos_ato")
      .select("id,codigo_grupo,data_ato,procedimento_principal_codigo,procedimento_principal_descricao,sala,inicio_ato,fim_ato,porte_sala,porte_anestesico,potencial_contaminacao,sala_contaminada,via_acesso,acomodacao,urgencia,horario_especial,observacoes")
      .eq("conta_id",contaId).order("data_ato").order("created_at"),
    supabase.from("conta_faturamento_itens")
      .select("id,origem_tipo,tabela,codigo,descricao,quantidade,valor_unitario,valor_total,grupo_ato_id,sequencia_ato,via_acesso,anestesia,numero_auxiliares,filme_m2")
      .eq("conta_id",contaId).in("origem_tipo",["procedimento","honorario","laboratorio","imagem"]).order("data_execucao").limit(1500),
    supabase.from("tiss_guias").select("id",{count:"exact",head:true}).eq("conta_id",contaId).neq("status","cancelada"),
    supabase.from("cirurgia_procedimentos")
      .select("id,codigo,descricao,tabela_referencia,porte,porte_anestesico,requisitos_equipe")
      .eq("atendimento_id",conta.atendimento_id).order("sequencia").order("created_at"),
    supabase.from("cirurgia_equipe")
      .select("id,cirurgia_procedimento_id,papel,ordem_participacao,faturavel,profissional:profissionais(nome_completo,conselho,numero_conselho,uf_conselho)")
      .eq("atendimento_id",conta.atendimento_id).not("cirurgia_procedimento_id","is",null).order("created_at"),
    supabase.from("faturamento_equipe_cirurgica")
      .select("id,cirurgia_procedimento_id,cirurgia_equipe_id,papel,ordem_participacao,fonte_codigo,fonte_tipo,porte_anestesico,quantidade_auxiliares_regra,percentual_honorario,ch_anestesista,valor_ch,valor_base_procedimento,valor_calculado,cobrar_regra,cobrar,repasse,ajuste_manual,justificativa_ajuste,status_calculo,origem_regra,ativo")
      .eq("conta_id",contaId).order("created_at"),
  ]);

  const paciente = one(conta.paciente as Rel<Paciente>);
  const atendimento = one(conta.atendimento as Rel<Atendimento>);
  const convenio = one(conta.convenio as Rel<Convenio>);
  const atos = grupos ?? [];
  const lancamentos = itens ?? [];
  const procedures = (procedimentosCirurgicos ?? []) as SurgicalProcedureBilling[];
  const clinicalMembers = ((equipeClinicaRaw ?? []) as unknown as ClinicalMemberRaw[]).map((item) => ({...item, profissional: one(item.profissional)}));
  const billingMembers = (equipeFaturamento ?? []) as SurgicalBillingMember[];
  const editavel = !["faturada","cancelada"].includes(conta.status) && (guiasAtivas ?? 0) === 0;

  return <SectionPage
    eyebrow="Faturamento / Conta / Procedimentos cirúrgicos"
    title="Procedimentos cirúrgicos, SADT e equipe"
    description={`${paciente?.nome_completo??"Paciente"} · RA ${paciente?.ra??"—"} · Atendimento #${atendimento?.numero_atendimento??"—"} · ${convenio?.nome_fantasia??(conta.tipo_cobranca==="particular"?"Particular":"Convênio")}`}
    actions={<div className="flex flex-wrap gap-2"><Link href={`/faturamento/${contaId}/lancamentos`} className="ui-button-secondary">Lançamentos</Link><a href="#equipe-medica" className="ui-button-secondary"><UsersRound className="size-4"/>Equipe médica</a><Link href={`/faturamento/${contaId}/catalogo`} className="ui-button-primary"><Plus className="size-4"/>Adicionar procedimento</Link></div>}
  >
    {!editavel?<div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">Alterações bloqueadas: {(guiasAtivas??0)>0?"a conta já possui Guia TISS ativa":"o status atual da conta não permite edição"}.</div>:null}

    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      <Kpi label="Atos cadastrados" value={String(atos.length)}/>
      <Kpi label="Procedimentos CC" value={String(procedures.length)}/>
      <Kpi label="Equipe clínica" value={String(clinicalMembers.length)}/>
      <Kpi label="Honorários gerados" value={String(billingMembers.filter((item)=>item.ativo).length)}/>
      <Kpi label="Valor bruto da conta" value={brl(conta.valor_bruto)}/>
    </section>

    <SurgicalTeamBillingPanel contaId={contaId} procedures={procedures} clinicalMembers={clinicalMembers} billingMembers={billingMembers} disabled={!editavel}/>

    <section className="ui-card mt-5 p-5">
      <div className="flex items-center gap-3"><Stethoscope className="size-5 text-brand-700"/><div><h2 className="font-black text-slate-950">Novo ato cirúrgico / SADT</h2><p className="text-sm text-slate-500">Agrupe o procedimento, sala, período e características que influenciam a cobrança.</p></div></div>
      <BillingActBackgroundForm contaId={contaId} kind="create" disabled={!editavel} buttonClassName="ui-button-primary" className="mt-4">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          <input name="codigo_grupo" required className="ui-input" placeholder="Identificador do ato (ex.: CIR-001)" disabled={!editavel}/>
          <input type="date" name="data_ato" className="ui-input" disabled={!editavel}/>
          <input name="procedimento_principal_codigo" className="ui-input" placeholder="Código procedimento principal" disabled={!editavel}/>
          <input name="procedimento_principal_descricao" className="ui-input xl:col-span-2" placeholder="Procedimento principal" disabled={!editavel}/>
          <input name="sala" className="ui-input" placeholder="Sala" disabled={!editavel}/>
          <label className="text-xs font-semibold text-slate-500">Início<input type="datetime-local" name="inicio_ato" className="ui-input mt-1" disabled={!editavel}/></label>
          <label className="text-xs font-semibold text-slate-500">Término<input type="datetime-local" name="fim_ato" className="ui-input mt-1" disabled={!editavel}/></label>
          <input name="porte_sala" className="ui-input" placeholder="Porte de sala" disabled={!editavel}/>
          <input name="porte_anestesico" className="ui-input" placeholder="Porte anestésico" disabled={!editavel}/>
          <select name="potencial_contaminacao" className="ui-input" defaultValue="" disabled={!editavel}><option value="">Potencial de contaminação</option><option value="limpa">Limpa</option><option value="potencialmente_contaminada">Potencialmente contaminada</option><option value="contaminada">Contaminada</option><option value="infectada">Infectada</option></select>
          <input name="via_acesso" className="ui-input" placeholder="Via de acesso" disabled={!editavel}/>
          <input name="acomodacao" className="ui-input" placeholder="Acomodação" disabled={!editavel}/>
          <input name="observacoes" className="ui-input md:col-span-2 xl:col-span-3" placeholder="Observações do faturamento" disabled={!editavel}/>
          <div className="flex flex-wrap items-center gap-4 rounded-xl border border-slate-200 px-3 text-sm xl:col-span-3"><label><input type="checkbox" name="urgencia" disabled={!editavel}/> Urgência</label><label><input type="checkbox" name="horario_especial" disabled={!editavel}/> Horário especial</label><label><input type="checkbox" name="sala_contaminada" disabled={!editavel}/> Sala contaminada</label></div>
        </div>
      </BillingActBackgroundForm>
    </section>

    <section className="mt-5 space-y-4">
      <div><h2 className="font-black text-slate-950">Atos da conta</h2><p className="text-sm text-slate-500">Cada ato mantém seus lançamentos relacionados e pode ser recalculado pelas regras comerciais do contrato.</p></div>
      {atos.length?atos.map(ato=>{
        const relacionados=lancamentos.filter(i=>i.grupo_ato_id===ato.id);
        const subtotal=relacionados.reduce((s,i)=>s+Number(i.valor_total??0),0);
        return <article key={ato.id} className="ui-card overflow-hidden">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 bg-slate-50 px-5 py-4"><div><div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-brand-100 px-2.5 py-1 text-xs font-black text-brand-800">{ato.codigo_grupo}</span>{ato.urgencia?<span className="rounded-full bg-rose-100 px-2.5 py-1 text-xs font-bold text-rose-700">Urgência</span>:null}{ato.horario_especial?<span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-800">Horário especial</span>:null}</div><h3 className="mt-2 font-black text-slate-950">{ato.procedimento_principal_descricao??"Procedimento principal não informado"}</h3><p className="mt-1 text-xs text-slate-500">{ato.procedimento_principal_codigo??"Sem código"} · sala {ato.sala??"—"} · {ato.inicio_ato?localDateTime(ato.inicio_ato).replace("T"," "):ato.data_ato??"—"}</p></div><div className="text-right"><p className="text-xs font-bold uppercase text-slate-400">Subtotal relacionado</p><p className="mt-1 text-xl font-black text-slate-950">{brl(subtotal)}</p><p className="text-xs text-slate-500">{relacionados.length} item(ns)</p></div></div>

          <BillingActBackgroundForm contaId={contaId} kind="update" groupId={ato.id} disabled={!editavel} className="p-5">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
              <input type="date" name="data_ato" defaultValue={ato.data_ato??""} className="ui-input" disabled={!editavel}/>
              <input name="procedimento_principal_codigo" defaultValue={ato.procedimento_principal_codigo??""} className="ui-input" placeholder="Código principal" disabled={!editavel}/>
              <input name="procedimento_principal_descricao" defaultValue={ato.procedimento_principal_descricao??""} className="ui-input xl:col-span-2" placeholder="Procedimento principal" disabled={!editavel}/>
              <input name="sala" defaultValue={ato.sala??""} className="ui-input" placeholder="Sala" disabled={!editavel}/>
              <input name="porte_sala" defaultValue={ato.porte_sala??""} className="ui-input" placeholder="Porte sala" disabled={!editavel}/>
              <label className="text-xs font-semibold text-slate-500">Início<input type="datetime-local" name="inicio_ato" defaultValue={localDateTime(ato.inicio_ato)} className="ui-input mt-1" disabled={!editavel}/></label>
              <label className="text-xs font-semibold text-slate-500">Término<input type="datetime-local" name="fim_ato" defaultValue={localDateTime(ato.fim_ato)} className="ui-input mt-1" disabled={!editavel}/></label>
              <input name="porte_anestesico" defaultValue={ato.porte_anestesico??""} className="ui-input" placeholder="Porte anestésico" disabled={!editavel}/>
              <select name="potencial_contaminacao" defaultValue={ato.potencial_contaminacao??""} className="ui-input" disabled={!editavel}><option value="">Potencial de contaminação</option><option value="limpa">Limpa</option><option value="potencialmente_contaminada">Potencialmente contaminada</option><option value="contaminada">Contaminada</option><option value="infectada">Infectada</option></select>
              <input name="via_acesso" defaultValue={ato.via_acesso??""} className="ui-input" placeholder="Via de acesso" disabled={!editavel}/>
              <input name="acomodacao" defaultValue={ato.acomodacao??""} className="ui-input" placeholder="Acomodação" disabled={!editavel}/>
              <input name="observacoes" defaultValue={ato.observacoes??""} className="ui-input md:col-span-2 xl:col-span-3" placeholder="Observações" disabled={!editavel}/>
              <div className="flex flex-wrap items-center gap-4 rounded-xl border border-slate-200 px-3 text-sm xl:col-span-3"><label><input type="checkbox" name="urgencia" defaultChecked={ato.urgencia} disabled={!editavel}/> Urgência</label><label><input type="checkbox" name="horario_especial" defaultChecked={ato.horario_especial} disabled={!editavel}/> Horário especial</label><label><input type="checkbox" name="sala_contaminada" defaultChecked={ato.sala_contaminada} disabled={!editavel}/> Sala contaminada</label></div>
            </div>
          </BillingActBackgroundForm>
          <div className="px-5 pb-5"><BillingActBackgroundForm contaId={contaId} kind="reprice" groupId={ato.id} disabled={!editavel} buttonClassName="ui-button-primary" /></div>

          <div className="border-t border-slate-200"><div className="flex items-center gap-2 bg-slate-50 px-5 py-3"><Activity className="size-4 text-brand-700"/><h4 className="text-sm font-black text-slate-900">Lançamentos vinculados</h4></div>{relacionados.length?<div className="overflow-x-auto"><table className="min-w-[900px] w-full text-left text-xs"><thead className="bg-white text-slate-500"><tr><th className="px-4 py-2">Seq.</th><th className="px-4 py-2">Tabela / Código</th><th className="px-4 py-2">Descrição</th><th className="px-4 py-2">Via</th><th className="px-4 py-2">Aux.</th><th className="px-4 py-2">Anest.</th><th className="px-4 py-2 text-right">Total</th></tr></thead><tbody>{relacionados.map(item=><tr key={item.id} className="border-t border-slate-100"><td className="px-4 py-2">{item.sequencia_ato??"—"}</td><td className="px-4 py-2 font-mono">{item.tabela??"—"} / {item.codigo??"—"}</td><td className="px-4 py-2 font-semibold">{item.descricao}</td><td className="px-4 py-2">{item.via_acesso??"—"}</td><td className="px-4 py-2">{item.numero_auxiliares??0}</td><td className="px-4 py-2">{item.anestesia?"Sim":"Não"}</td><td className="px-4 py-2 text-right font-bold">{brl(item.valor_total)}</td></tr>)}</tbody></table></div>:<p className="p-5 text-sm text-slate-500">Nenhum lançamento associado a este ato.</p>}</div>
        </article>;
      }):<div className="ui-card p-8 text-center text-sm text-slate-500"><Clock3 className="mx-auto mb-2 size-5"/>Nenhum ato cirúrgico/SADT cadastrado nesta conta.</div>}
    </section>

    <section className="ui-card mt-5 overflow-hidden">
      <div className="border-b border-slate-200 px-5 py-4"><h2 className="font-black text-slate-950">Vincular lançamentos ao ato</h2><p className="text-sm text-slate-500">Associe procedimentos, honorários e exames já lançados na conta. O recálculo considera sequência, via, anestesia, auxiliares e filme.</p></div>
      {lancamentos.length?<div className="divide-y divide-slate-100">{lancamentos.map(item=><BillingActBackgroundForm key={item.id} contaId={contaId} kind="update-item" itemId={item.id} disabled={!editavel} className="p-4" submitLabel="Aplicar"><div className="grid gap-2 md:grid-cols-2 xl:grid-cols-[minmax(280px,1fr)_220px_90px_160px_100px_100px]"><div><p className="font-mono text-xs text-brand-700">{item.tabela??"—"} · {item.codigo??"—"}</p><p className="font-semibold text-slate-900">{item.descricao}</p><p className="text-xs text-slate-500">{brl(item.valor_total)}</p></div><select name="grupo_ato_id" defaultValue={item.grupo_ato_id??""} className="ui-input" disabled={!editavel}><option value="">Sem ato</option>{atos.map(a=><option key={a.id} value={a.id}>{a.codigo_grupo} · {a.procedimento_principal_descricao??"ato"}</option>)}</select><input name="sequencia_ato" defaultValue={item.sequencia_ato??1} className="ui-input" inputMode="numeric" placeholder="Seq." disabled={!editavel}/><input name="via_acesso" defaultValue={item.via_acesso??""} className="ui-input" placeholder="Via de acesso" disabled={!editavel}/><input name="numero_auxiliares" defaultValue={item.numero_auxiliares??0} className="ui-input" inputMode="numeric" placeholder="Aux." disabled={!editavel}/><input name="filme_m2" defaultValue={item.filme_m2??0} className="ui-input" inputMode="decimal" placeholder="Filme m²" disabled={!editavel}/><label className="whitespace-nowrap text-xs"><input type="checkbox" name="anestesia" defaultChecked={item.anestesia} disabled={!editavel}/> Anestesia</label></div></BillingActBackgroundForm>)}</div>:<p className="p-8 text-center text-sm text-slate-500">Não há procedimentos/honorários/exames lançados para vincular.</p>}
    </section>
  </SectionPage>;
}

function Kpi({label,value}:{label:string;value:string}){return <div className="ui-card p-4"><p className="text-xs font-bold uppercase tracking-wide text-slate-400">{label}</p><p className="mt-2 text-lg font-black text-slate-950">{value}</p></div>}
