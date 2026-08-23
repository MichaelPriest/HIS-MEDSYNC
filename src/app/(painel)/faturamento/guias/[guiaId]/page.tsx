import { FileCode2, ShieldCheck } from "lucide-react";
import { notFound } from "next/navigation";
import { SectionPage } from "@/components/painel/section-page";
import { createClient } from "@/lib/supabase/server";

function one<T>(rel: T | T[] | null): T | null { return Array.isArray(rel) ? rel[0] ?? null : rel; }

export default async function GuiaTissPage({ params, searchParams }: { params: Promise<{ guiaId: string }>; searchParams: Promise<{ erro?: string }> }) {
  const { guiaId } = await params;
  const { erro } = await searchParams;
  const supabase = await createClient();
  const [{ data: guia }, { data: itens }] = await Promise.all([
    supabase.from("tiss_guias").select("id,numero_guia_prestador,numero_guia_operadora,tipo_guia,status,registro_ans,numero_carteirinha,senha_autorizacao,data_atendimento,valor_total,versao:tiss_versoes(codigo,conteudo_estrutura,tuss,comunicacao_principal),paciente:pacientes(nome_completo,ra,numero_registro,cns),convenio:convenios(nome_fantasia),profissional:profissionais(nome_completo,conselho,numero_conselho,uf_conselho,cbo,especialidade),conta:contas_faturamento(id)").eq("id", guiaId).maybeSingle(),
    supabase.from("tiss_guia_itens").select("id,sequencial,data_execucao,tabela,codigo_procedimento,descricao,quantidade,valor_unitario,valor_total").eq("guia_id", guiaId).order("sequencial"),
  ]);
  if (!guia) notFound();
  const paciente=one(guia.paciente); const convenio=one(guia.convenio); const profissional=one(guia.profissional); const versao=one(guia.versao);
  return <SectionPage eyebrow="Financeiro / TISS / Guia" title={`Guia ${guia.numero_guia_prestador}`} description={`${paciente?.nome_completo ?? "Paciente"} · Registro #${paciente?.numero_registro ?? "—"} · ${paciente?.ra ?? "—"}`}>
    {erro ? <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">A guia foi criada, mas ocorreu uma inconsistência ao copiar itens. Revise antes de prosseguir.</div> : null}
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5"><Info label="Tipo de guia" value={guia.tipo_guia.replaceAll("_"," ")}/><Info label="Status" value={guia.status}/><Info label="Operadora" value={`${convenio?.nome_fantasia ?? "—"} · ANS ${guia.registro_ans ?? "—"}`}/><Info label="Carteirinha" value={guia.numero_carteirinha ?? "—"}/><Info label="Valor" value={`R$ ${Number(guia.valor_total ?? 0).toLocaleString("pt-BR",{minimumFractionDigits:2})}`}/></div>
    <div className="mt-6 grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
      <section className="ui-card p-5"><h2 className="flex items-center gap-2 font-semibold text-slate-900"><ShieldCheck className="size-5 text-brand-700"/>Snapshot TISS</h2><dl className="mt-4 space-y-3 text-sm"><Row label="CNS" value={paciente?.cns}/><Row label="Profissional" value={profissional?.nome_completo}/><Row label="Conselho" value={[profissional?.conselho,profissional?.numero_conselho,profissional?.uf_conselho].filter(Boolean).join(" ")}/><Row label="CBO" value={profissional?.cbo}/><Row label="Especialidade" value={profissional?.especialidade}/><Row label="Senha autorização" value={guia.senha_autorizacao}/><Row label="Data atendimento" value={guia.data_atendimento}/></dl><div className="mt-5 rounded-xl border border-brand-100 bg-brand-50 p-4 text-sm text-brand-900"><p className="font-semibold">Versão aplicada</p><p className="mt-1">Conteúdo/Estrutura {versao?.conteudo_estrutura ?? "—"} · TUSS {versao?.tuss ?? "—"} · Comunicação {versao?.comunicacao_principal ?? "—"}</p></div></section>
      <section className="ui-card overflow-hidden"><div className="border-b border-slate-100 px-5 py-4"><h2 className="font-semibold text-slate-900">Itens da guia</h2></div><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">Seq.</th><th className="px-4 py-3">Data</th><th className="px-4 py-3">Tabela/Código</th><th className="px-4 py-3">Descrição</th><th className="px-4 py-3 text-right">Qtd.</th><th className="px-4 py-3 text-right">Total</th></tr></thead><tbody className="divide-y divide-slate-100">{itens?.map((item)=><tr key={item.id}><td className="px-4 py-3">{item.sequencial}</td><td className="px-4 py-3 text-slate-500">{item.data_execucao ?? "—"}</td><td className="px-4 py-3 font-mono text-xs">{item.tabela ?? "—"} / {item.codigo_procedimento}</td><td className="px-4 py-3">{item.descricao ?? "—"}</td><td className="px-4 py-3 text-right">{Number(item.quantidade)}</td><td className="px-4 py-3 text-right font-semibold">R$ {Number(item.valor_total).toLocaleString("pt-BR",{minimumFractionDigits:2})}</td></tr>)}</tbody></table></div></section>
    </div>
    <section className="ui-card mt-6 p-5"><div className="flex items-start gap-3"><span className="grid size-10 place-items-center rounded-xl bg-amber-50 text-amber-700"><FileCode2 className="size-5"/></span><div><h2 className="font-semibold text-slate-900">XML ainda bloqueado</h2><p className="mt-1 text-sm text-slate-600">A próxima etapa instalará os schemas XSD oficiais da ANS e o gerador por tipo de mensagem. O sistema só liberará XML quando a estrutura gerada passar na validação XSD correspondente.</p></div></div></section>
  </SectionPage>;
}
function Info({label,value}:{label:string;value:string}){return <div className="ui-card p-4"><p className="text-xs uppercase tracking-wide text-slate-400">{label}</p><p className="mt-2 font-semibold text-slate-900">{value}</p></div>}
function Row({label,value}:{label:string;value:string|null|undefined}){return <div className="flex justify-between gap-4 border-b border-slate-100 pb-2"><dt className="text-slate-500">{label}</dt><dd className="text-right font-medium text-slate-800">{value || "—"}</dd></div>}
