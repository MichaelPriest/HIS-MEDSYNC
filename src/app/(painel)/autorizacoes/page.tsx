import { ShieldCheck } from "lucide-react";
import { SectionPage } from "@/components/painel/section-page";
import { createClient } from "@/lib/supabase/server";
import { atualizarAutorizacao } from "@/modules/autorizacoes/actions";

function one<T>(rel: T | T[] | null): T | null { return Array.isArray(rel) ? rel[0] ?? null : rel; }

export default async function AutorizacoesPage({ searchParams }: { searchParams: Promise<{ atendimento?: string; erro?: string }> }) {
  const { atendimento, erro } = await searchParams;
  const supabase = await createClient();
  let query = supabase.from("autorizacoes_atendimento").select("id,atendimento_id,status,numero_guia_prestador,numero_guia_operadora,senha_autorizacao,validade,observacao,created_at,paciente:pacientes(nome_completo,ra,numero_registro),convenio:convenios(nome_fantasia),plano:convenio_planos(nome)").order("created_at", { ascending: false }).limit(100);
  if (atendimento) query = query.eq("atendimento_id", atendimento);
  const { data: autorizacoes } = await query;
  const pendentes=(autorizacoes??[]).filter(item=>["pendente","solicitada"].includes(item.status)).length;
  const autorizadas=(autorizacoes??[]).filter(item=>item.status==="autorizada").length;
  const negadas=(autorizacoes??[]).filter(item=>item.status==="negada").length;

  return <SectionPage eyebrow="Jornada / Convênios" title="Autorizações" description="Fila operacional de guia, senha e retorno da operadora antes da continuidade assistencial.">
    {erro ? <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">Não foi possível atualizar a autorização.</div> : null}
    <section className="grid gap-3 sm:grid-cols-3"><Kpi label="Pendentes" value={pendentes}/><Kpi label="Autorizadas" value={autorizadas}/><Kpi label="Negadas" value={negadas}/></section>
    <div className="mt-5 space-y-3">{autorizacoes?.length ? autorizacoes.map((item) => { const paciente=one(item.paciente); const convenio=one(item.convenio); const plano=one(item.plano); return <details key={item.id} open={Boolean(atendimento)} className="group ui-card overflow-hidden"><summary className="flex cursor-pointer list-none flex-wrap items-start justify-between gap-4 p-5 hover:bg-slate-50/60"><div><div className="flex items-center gap-2"><ShieldCheck className="size-5 text-brand-700"/><h2 className="font-bold text-slate-900">{paciente?.nome_completo ?? "Paciente"}</h2></div><p className="mt-1 text-sm text-slate-500">Registro #{paciente?.numero_registro ?? "—"} · {paciente?.ra ?? "—"} · {convenio?.nome_fantasia ?? "Convênio"} · {plano?.nome ?? "Plano"}</p></div><span className={`rounded-full px-3 py-1 text-xs font-semibold ${item.status==="autorizada"?"bg-emerald-50 text-emerald-700":item.status==="negada"?"bg-rose-50 text-rose-700":"bg-brand-50 text-brand-700"}`}>{item.status}</span></summary><form action={atualizarAutorizacao} className="border-t border-slate-100 bg-slate-50/35 p-5"><input type="hidden" name="autorizacao_id" value={item.id}/><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"><label className="space-y-2 text-sm font-medium text-slate-700"><span>Guia prestador</span><input name="numero_guia_prestador" defaultValue={item.numero_guia_prestador ?? ""} className="ui-input"/></label><label className="space-y-2 text-sm font-medium text-slate-700"><span>Guia operadora</span><input name="numero_guia_operadora" defaultValue={item.numero_guia_operadora ?? ""} className="ui-input"/></label><label className="space-y-2 text-sm font-medium text-slate-700"><span>Senha</span><input name="senha_autorizacao" defaultValue={item.senha_autorizacao ?? ""} className="ui-input"/></label><label className="space-y-2 text-sm font-medium text-slate-700"><span>Validade</span><input name="validade" type="date" defaultValue={item.validade ?? ""} className="ui-input"/></label><label className="space-y-2 text-sm font-medium text-slate-700"><span>Status</span><select name="status" defaultValue={item.status} className="ui-input"><option value="pendente">Pendente</option><option value="solicitada">Solicitada</option><option value="autorizada">Autorizada</option><option value="negada">Negada</option><option value="dispensada">Dispensada</option></select></label><label className="space-y-2 text-sm font-medium text-slate-700 md:col-span-2 xl:col-span-3"><span>Observação</span><input name="observacao" defaultValue={item.observacao ?? ""} className="ui-input"/></label></div><div className="mt-5 flex justify-end border-t border-slate-200 pt-4"><button className="ui-button-primary">Salvar e encaminhar</button></div></form></details>; }) : <div className="ui-card p-8 text-center text-sm text-slate-500">Nenhuma autorização pendente.</div>}</div>
  </SectionPage>;
}

function Kpi({label,value}:{label:string;value:number}){return <div className="his-kpi"><p className="text-xs font-bold uppercase tracking-wider text-slate-400">{label}</p><p className="mt-2 text-3xl font-black text-slate-950">{value}</p></div>}
