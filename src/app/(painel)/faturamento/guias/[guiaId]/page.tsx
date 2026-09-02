import { AlertTriangle,CheckCircle2,FileCode2,ShieldCheck } from "lucide-react";
import { notFound } from "next/navigation";
import { GuideValidationBackgroundForm } from "@/components/faturamento/guide-validation-background-form";
import { SectionPage } from "@/components/painel/section-page";
import { createClient } from "@/lib/supabase/server";
import { acaoCriticaTiss,origemCriticaTiss,resumirCriticas,type TissGuiaCritica } from "@/modules/tiss/guia-criticas";

function one<T>(rel: T | T[] | null): T | null { return Array.isArray(rel) ? rel[0] ?? null : rel; }

type CriticaLinha=TissGuiaCritica&{id:string;created_at:string};

function formatarValidacao(value:string|null){
  if(!value) return "Ainda não validada";
  return new Intl.DateTimeFormat("pt-BR",{dateStyle:"short",timeStyle:"short",timeZone:"America/Sao_Paulo"}).format(new Date(value));
}

export default async function GuiaTissPage({ params,searchParams }: { params:Promise<{guiaId:string}>;searchParams:Promise<{erro?:string}> }){
  const { guiaId }=await params;
  const { erro }=await searchParams;
  const supabase=await createClient();
  const [{data:guia},{data:itens},{data:criticas}]=await Promise.all([
    supabase.from("tiss_guias").select("id,numero_guia_prestador,numero_guia_operadora,tipo_guia,status,registro_ans,numero_carteirinha,validade_carteirinha,senha_autorizacao,validade_senha,data_atendimento,atendimento_rn,valor_total,validado_em,beneficiario_nome_snapshot,beneficiario_cns_snapshot,profissional_nome_snapshot,profissional_conselho_snapshot,profissional_numero_conselho_snapshot,profissional_uf_conselho_snapshot,profissional_cbo_snapshot,profissional_especialidade_snapshot,cnes_snapshot,tipo_atendimento_tuss50_codigo,tipo_atendimento_tuss50_descricao,tipo_consulta_tuss52_codigo,tipo_consulta_tuss52_descricao,acomodacao_tuss49_codigo,acomodacao_tuss49_descricao,versao:tiss_versoes(codigo,conteudo_estrutura,tuss,comunicacao_principal),paciente:pacientes(nome_completo,ra,numero_registro),convenio:convenios(nome_fantasia),conta:contas_faturamento(id)").eq("id",guiaId).maybeSingle(),
    supabase.from("tiss_guia_itens").select("id,sequencial,data_execucao,tabela,codigo_procedimento,descricao,quantidade,valor_unitario,valor_total").eq("guia_id",guiaId).order("sequencial"),
    supabase.from("tiss_guia_criticas").select("id,item_id,codigo,severidade,campo,mensagem,created_at").eq("guia_id",guiaId).eq("resolvida",false).order("created_at",{ascending:false}),
  ]);
  if(!guia) notFound();

  const paciente=one(guia.paciente);
  const convenio=one(guia.convenio);
  const versao=one(guia.versao);
  const criticasAbertas:CriticaLinha[]=(criticas??[]).map((critica)=>({
    id:critica.id,
    item_id:critica.item_id,
    codigo:critica.codigo,
    severidade:critica.severidade==="alerta"?"alerta":"erro",
    campo:critica.campo,
    mensagem:critica.mensagem,
    created_at:critica.created_at,
  }));
  const resumo=resumirCriticas(criticasAbertas);
  const podeRevalidar=guia.status==="rascunho"||guia.status==="pronta";
  const validada=Boolean(guia.validado_em);

  return <SectionPage eyebrow="Financeiro / TISS / Guia" title={`Guia ${guia.numero_guia_prestador}`} description={`${paciente?.nome_completo??"Paciente"} · Registro #${paciente?.numero_registro??"—"} · ${paciente?.ra??"—"}`}>
    {erro?<div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">A guia foi criada, mas ocorreu uma inconsistência ao copiar itens. Revise antes de prosseguir.</div>:null}

    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
      <Info label="Tipo de guia" value={guia.tipo_guia.replaceAll("_"," ")}/>
      <Info label="Status" value={guia.status}/>
      <Info label="Operadora" value={`${convenio?.nome_fantasia??"—"} · ANS ${guia.registro_ans??"—"}`}/>
      <Info label="Carteirinha" value={guia.numero_carteirinha??"—"}/>
      <Info label="Validação" value={validada?(resumo.erros?`${resumo.erros} bloqueio(s)`:"Sem bloqueios"):"Pendente"}/>
      <Info label="Valor" value={`R$ ${Number(guia.valor_total??0).toLocaleString("pt-BR",{minimumFractionDigits:2})}`}/>
    </div>

    <section className="ui-card mt-6 overflow-hidden">
      <div className="flex flex-col gap-4 border-b border-slate-100 px-5 py-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-3">
          <span className={`grid size-11 shrink-0 place-items-center rounded-xl ${resumo.erros?"bg-rose-50 text-rose-700":resumo.alertas?"bg-amber-50 text-amber-700":"bg-emerald-50 text-emerald-700"}`}><ShieldCheck className="size-5"/></span>
          <div><h2 className="font-semibold text-slate-900">Validação de consistência TISS</h2><p className="mt-1 max-w-3xl text-sm text-slate-600">Central de críticas para cadastro, autorização, domínios ANS/TUSS e faturamento. Esta pré-validação não substitui a validação do XML pelo XSD oficial aplicável.</p><p className="mt-2 text-xs text-slate-500">Última validação: {formatarValidacao(guia.validado_em)}</p></div>
        </div>
        <div className="flex flex-wrap items-start gap-2">
          <span className="rounded-full bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700">{resumo.erros} bloqueio(s)</span>
          <span className="rounded-full bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700">{resumo.alertas} alerta(s)</span>
          <GuideValidationBackgroundForm guiaId={guia.id} disabled={!podeRevalidar}/>
        </div>
      </div>
      {!validada?<div className="flex items-start gap-3 px-5 py-5 text-sm text-slate-600"><AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-600"/><span>Esta guia ainda não possui registro de validação. Execute a validação antes de incluí-la em lote.</span></div>:criticasAbertas.length===0?<div className="flex items-start gap-3 px-5 py-5 text-sm text-emerald-800"><CheckCircle2 className="mt-0.5 size-5 shrink-0"/><div><p className="font-semibold">Nenhuma crítica aberta.</p><p className="mt-1 text-emerald-700">A guia passou pela validação de consistência e pode seguir no fluxo se permanecer com status pronta.</p></div></div>:<div className="divide-y divide-slate-100">{criticasAbertas.map((critica)=><div key={critica.id} className="grid gap-3 px-5 py-4 lg:grid-cols-[140px_170px_1fr]"><div><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${critica.severidade==="erro"?"bg-rose-50 text-rose-700":"bg-amber-50 text-amber-700"}`}>{critica.severidade==="erro"?"Bloqueio":"Alerta"}</span><p className="mt-2 font-mono text-[11px] text-slate-500">{critica.codigo}</p></div><div><p className="text-xs uppercase tracking-wide text-slate-400">Origem</p><p className="mt-1 text-sm font-medium text-slate-800">{origemCriticaTiss(critica.codigo)}</p>{critica.campo?<p className="mt-1 break-all text-xs text-slate-500">Campo: {critica.campo}</p>:null}</div><div><p className="text-sm font-medium text-slate-900">{critica.mensagem}</p><p className="mt-1 text-sm text-slate-600"><span className="font-medium">Ação:</span> {acaoCriticaTiss(critica)}</p></div></div>)}</div>}
    </section>

    <div className="mt-6 grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
      <section className="ui-card p-5"><h2 className="flex items-center gap-2 font-semibold text-slate-900"><ShieldCheck className="size-5 text-brand-700"/>Snapshot TISS</h2><p className="mt-1 text-xs text-slate-500">Dados fotografados na guia para preservar o conteúdo faturado mesmo que o cadastro de origem seja alterado depois.</p><dl className="mt-4 space-y-3 text-sm"><Row label="Beneficiário" value={guia.beneficiario_nome_snapshot}/><Row label="CNS" value={guia.beneficiario_cns_snapshot}/><Row label="Atendimento a RN" value={guia.atendimento_rn?"S":"N"}/><Row label="Profissional" value={guia.profissional_nome_snapshot}/><Row label="Conselho" value={[guia.profissional_conselho_snapshot,guia.profissional_numero_conselho_snapshot,guia.profissional_uf_conselho_snapshot].filter(Boolean).join(" ")}/><Row label="CBO" value={guia.profissional_cbo_snapshot}/><Row label="Especialidade" value={guia.profissional_especialidade_snapshot}/><Row label="CNES" value={guia.cnes_snapshot}/><Row label="Senha autorização" value={guia.senha_autorizacao}/><Row label="Validade da senha" value={guia.validade_senha}/><Row label="Data atendimento" value={guia.data_atendimento}/><Row label="Tipo atendimento (TUSS 50)" value={[guia.tipo_atendimento_tuss50_codigo,guia.tipo_atendimento_tuss50_descricao].filter(Boolean).join(" · ")}/><Row label="Tipo consulta (TUSS 52)" value={[guia.tipo_consulta_tuss52_codigo,guia.tipo_consulta_tuss52_descricao].filter(Boolean).join(" · ")}/><Row label="Acomodação (TUSS 49)" value={[guia.acomodacao_tuss49_codigo,guia.acomodacao_tuss49_descricao].filter(Boolean).join(" · ")}/></dl><div className="mt-5 rounded-xl border border-brand-100 bg-brand-50 p-4 text-sm text-brand-900"><p className="font-semibold">Versão aplicada</p><p className="mt-1">Conteúdo/Estrutura {versao?.conteudo_estrutura??"—"} · TUSS {versao?.tuss??"—"} · Comunicação {versao?.comunicacao_principal??"—"}</p></div></section>
      <section className="ui-card overflow-hidden"><div className="border-b border-slate-100 px-5 py-4"><h2 className="font-semibold text-slate-900">Itens da guia</h2></div><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">Seq.</th><th className="px-4 py-3">Data</th><th className="px-4 py-3">Tabela/Código</th><th className="px-4 py-3">Descrição</th><th className="px-4 py-3 text-right">Qtd.</th><th className="px-4 py-3 text-right">Total</th></tr></thead><tbody className="divide-y divide-slate-100">{itens?.map((item)=><tr key={item.id}><td className="px-4 py-3">{item.sequencial}</td><td className="px-4 py-3 text-slate-500">{item.data_execucao??"—"}</td><td className="px-4 py-3 font-mono text-xs">{item.tabela??"—"} / {item.codigo_procedimento}</td><td className="px-4 py-3">{item.descricao??"—"}</td><td className="px-4 py-3 text-right">{Number(item.quantidade)}</td><td className="px-4 py-3 text-right font-semibold">R$ {Number(item.valor_total).toLocaleString("pt-BR",{minimumFractionDigits:2})}</td></tr>)}</tbody></table></div></section>
    </div>

    <section className="ui-card mt-6 p-5"><div className="flex items-start gap-3"><span className="grid size-10 place-items-center rounded-xl bg-amber-50 text-amber-700"><FileCode2 className="size-5"/></span><div><h2 className="font-semibold text-slate-900">XML permanece bloqueado até validação XSD</h2><p className="mt-1 text-sm text-slate-600">Passar pela central de críticas não significa homologação do XML. A emissão eletrônica só deverá ser liberada quando a mensagem gerada passar pelo schema XSD oficial da versão TISS aplicável.</p></div></div></section>
  </SectionPage>;
}

function Info({label,value}:{label:string;value:string}){return <div className="ui-card p-4"><p className="text-xs uppercase tracking-wide text-slate-400">{label}</p><p className="mt-2 font-semibold text-slate-900">{value}</p></div>}
function Row({label,value}:{label:string;value:string|null|undefined}){return <div className="flex justify-between gap-4 border-b border-slate-100 pb-2"><dt className="text-slate-500">{label}</dt><dd className="text-right font-medium text-slate-800">{value||"—"}</dd></div>}
