import Link from "next/link";
import { Fingerprint, KeyRound, ShieldCheck } from "lucide-react";
import { SectionPage } from "@/components/painel/section-page";
import { createClient } from "@/lib/supabase/server";
import { atualizarAutorizacao, registrarIdentificacaoAutorizacao } from "@/modules/autorizacoes/actions";

function one<T>(rel: T | T[] | null): T | null { return Array.isArray(rel) ? rel[0] ?? null : rel; }
type IdentificacaoConfig = { metodo:string; provedor:string|null; exige_na_autorizacao:boolean; ativo:boolean };
type IdentificacaoEvento = { metodo:string; validado:boolean; validado_em:string|null };

const mensagens: Record<string,string> = {
  "identificacao-obrigatoria": "Este convênio exige identificação do beneficiário antes de autorizar. Valide a biometria ou o token.",
  "metodo-identificacao": "O método informado não é aceito pela configuração deste convênio.",
  "identificacao-dados": "Informe o método e a referência retornada pelo leitor ou o token apresentado pelo beneficiário.",
  "identificacao-contexto": "Não foi possível relacionar paciente, atendimento e convênio para a validação.",
  "identificacao-salvar": "A validação de identificação não pôde ser registrada.",
};

export default async function AutorizacoesPage({ searchParams }: { searchParams: Promise<{ atendimento?: string; erro?: string; sucesso?: string }> }) {
  const { atendimento, erro, sucesso } = await searchParams;
  const supabase = await createClient();
  let query = supabase.from("autorizacoes_atendimento").select("id,atendimento_id,paciente_id,convenio_id,status,numero_guia_prestador,numero_guia_operadora,senha_autorizacao,validade,observacao,created_at,paciente:pacientes(nome_completo,ra,numero_registro),convenio:convenios(nome_fantasia),plano:convenio_planos(nome),identificacao:convenio_identificacao_config(metodo,provedor,exige_na_autorizacao,ativo),identificacoes:autorizacao_identificacao_eventos(metodo,validado,validado_em)").order("created_at", { ascending: false }).limit(100);
  if (atendimento) query = query.eq("atendimento_id", atendimento);
  const { data: autorizacoes } = await query;
  const pendentes=(autorizacoes??[]).filter(item=>["pendente","solicitada"].includes(item.status)).length;
  const autorizadas=(autorizacoes??[]).filter(item=>item.status==="autorizada").length;
  const negadas=(autorizacoes??[]).filter(item=>item.status==="negada").length;

  return <SectionPage eyebrow="Jornada / Convênios" title="Autorizações" description="Fila operacional de guia, senha, identificação do beneficiário e retorno da operadora antes da continuidade assistencial.">
    {erro ? <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{mensagens[erro] ?? "Não foi possível atualizar a autorização."}</div> : null}
    {sucesso === "identificacao" ? <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">Identificação do beneficiário validada e vinculada ao atendimento.</div> : null}
    <section className="grid gap-3 sm:grid-cols-3"><Kpi label="Pendentes" value={pendentes}/><Kpi label="Autorizadas" value={autorizadas}/><Kpi label="Negadas" value={negadas}/></section>
    <div className="mt-5 space-y-3">{autorizacoes?.length ? autorizacoes.map((item) => {
      const paciente=one(item.paciente); const convenio=one(item.convenio); const plano=one(item.plano);
      const config=one(item.identificacao) as IdentificacaoConfig|null;
      const eventos=(Array.isArray(item.identificacoes)?item.identificacoes:item.identificacoes?[item.identificacoes]:[]) as IdentificacaoEvento[];
      const exigeIdentificacao=Boolean(config?.ativo && config.exige_na_autorizacao && config.metodo!=="nenhum");
      const identificacaoOk=eventos.some(e=>e.validado && (config?.metodo==="biometria_ou_token" || e.metodo===config?.metodo));
      return <details key={item.id} open={Boolean(atendimento)} className="group ui-card overflow-hidden"><summary className="flex cursor-pointer list-none flex-wrap items-start justify-between gap-4 p-5 hover:bg-slate-50/60"><div><div className="flex items-center gap-2"><ShieldCheck className="size-5 text-brand-700"/><h2 className="font-bold text-slate-900">{paciente?.nome_completo ?? "Paciente"}</h2></div><p className="mt-1 text-sm text-slate-500">Registro #{paciente?.numero_registro ?? "—"} · {paciente?.ra ?? "—"} · {convenio?.nome_fantasia ?? "Convênio"} · {plano?.nome ?? "Plano"}</p></div><div className="flex flex-wrap gap-2"><span className={`rounded-full px-3 py-1 text-xs font-semibold ${item.status==="autorizada"?"bg-emerald-50 text-emerald-700":item.status==="negada"?"bg-rose-50 text-rose-700":"bg-brand-50 text-brand-700"}`}>{item.status}</span>{exigeIdentificacao?<span className={`rounded-full px-3 py-1 text-xs font-semibold ${identificacaoOk?"bg-emerald-50 text-emerald-700":"bg-amber-50 text-amber-800"}`}>{identificacaoOk?"Identificação OK":"Identificação obrigatória"}</span>:null}</div></summary>
      {exigeIdentificacao?<section className="border-t border-slate-100 bg-amber-50/40 p-5"><div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between"><div><h3 className="flex items-center gap-2 font-black text-slate-900"><Fingerprint className="size-5"/>Identificação exigida pela operadora</h3><p className="mt-1 text-sm text-slate-600">Método configurado: <b>{config?.metodo.replaceAll("_"," ")}</b>{config?.provedor?` · ${config.provedor}`:""}. A validação fica vinculada a esta autorização.</p>{item.paciente_id?<Link href={`/pacientes/${item.paciente_id}/identificacao`} className="mt-2 inline-flex text-sm font-bold text-brand-700">Abrir identificação do paciente →</Link>:null}</div>{!identificacaoOk?<form action={registrarIdentificacaoAutorizacao} className="grid w-full gap-2 md:grid-cols-[180px_1fr_auto] xl:max-w-3xl"><input type="hidden" name="autorizacao_id" value={item.id}/><select name="metodo" className="ui-input" defaultValue={config?.metodo==="token"?"token":"biometria_digital"}>{config?.metodo!=="token"?<option value="biometria_digital">Biometria digital</option>:null}{config?.metodo!=="biometria_digital"?<option value="token">Token</option>:null}</select><div className="relative"><KeyRound className="pointer-events-none absolute left-3 top-3 size-4 text-slate-400"/><input name="referencia" type="password" required autoComplete="off" className="ui-input pl-9" placeholder={config?.metodo==="token"?"Token apresentado pelo beneficiário":"Referência retornada pelo leitor/SDK"}/></div><button className="ui-button-primary">Validar identificação</button></form>:<div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">Identificação validada para esta autorização.</div>}</div></section>:null}
      <form action={atualizarAutorizacao} className="border-t border-slate-100 bg-slate-50/35 p-5"><input type="hidden" name="autorizacao_id" value={item.id}/><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"><label className="space-y-2 text-sm font-medium text-slate-700"><span>Guia prestador</span><input name="numero_guia_prestador" defaultValue={item.numero_guia_prestador ?? ""} className="ui-input"/></label><label className="space-y-2 text-sm font-medium text-slate-700"><span>Guia operadora</span><input name="numero_guia_operadora" defaultValue={item.numero_guia_operadora ?? ""} className="ui-input"/></label><label className="space-y-2 text-sm font-medium text-slate-700"><span>Senha</span><input name="senha_autorizacao" defaultValue={item.senha_autorizacao ?? ""} className="ui-input"/></label><label className="space-y-2 text-sm font-medium text-slate-700"><span>Validade</span><input name="validade" type="date" defaultValue={item.validade ?? ""} className="ui-input"/></label><label className="space-y-2 text-sm font-medium text-slate-700"><span>Status</span><select name="status" defaultValue={item.status} className="ui-input"><option value="pendente">Pendente</option><option value="solicitada">Solicitada</option><option value="autorizada">Autorizada</option><option value="negada">Negada</option><option value="dispensada">Dispensada</option></select></label><label className="space-y-2 text-sm font-medium text-slate-700 md:col-span-2 xl:col-span-3"><span>Observação</span><input name="observacao" defaultValue={item.observacao ?? ""} className="ui-input"/></label></div><div className="mt-5 flex justify-end border-t border-slate-200 pt-4"><button className="ui-button-primary">Salvar e encaminhar</button></div></form></details>;
    }) : <div className="ui-card p-8 text-center text-sm text-slate-500">Nenhuma autorização pendente.</div>}</div>
  </SectionPage>;
}

function Kpi({label,value}:{label:string;value:number}){return <div className="his-kpi"><p className="text-xs font-bold uppercase tracking-wider text-slate-400">{label}</p><p className="mt-2 text-3xl font-black text-slate-950">{value}</p></div>}
