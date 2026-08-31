import Link from "next/link";
import { Fingerprint, ShieldCheck } from "lucide-react";
import { AuthorizationIdentificationBackgroundForm, AuthorizationUpdateBackgroundForm } from "@/components/autorizacoes/authorization-background-actions";
import { SectionPage } from "@/components/painel/section-page";
import { createClient } from "@/lib/supabase/server";

function one<T>(rel: T | T[] | null): T | null { return Array.isArray(rel) ? rel[0] ?? null : rel; }
type IdentificacaoConfig = { convenio_id:string; metodo:string; provedor:string|null; exige_na_autorizacao:boolean; ativo:boolean };
type IdentificacaoEvento = { autorizacao_id:string; metodo:string; validado:boolean; validado_em:string|null };
type CentralGuia = { atendimento_id:string; status:string; numero_guia_operadora:string|null; senha:string|null };

export default async function AutorizacoesPage({ searchParams }: { searchParams: Promise<{ atendimento?: string; sucesso?: string }> }) {
  const { atendimento, sucesso } = await searchParams;
  const supabase = await createClient();
  let query = supabase.from("autorizacoes_atendimento").select("id,atendimento_id,paciente_id,convenio_id,status,numero_guia_prestador,numero_guia_operadora,senha_autorizacao,validade,observacao,created_at,paciente:pacientes(nome_completo,ra,numero_registro),convenio:convenios(nome_fantasia),plano:convenio_planos(nome)").order("created_at", { ascending: false }).limit(100);
  if (atendimento) query = query.eq("atendimento_id", atendimento);
  const { data: autorizacoes, error: queryError } = await query;

  const convenioIds=[...new Set((autorizacoes??[]).map(item=>item.convenio_id).filter((id):id is string=>Boolean(id)))];
  const atendimentoIds=[...new Set((autorizacoes??[]).map(item=>item.atendimento_id).filter(Boolean))];
  const autorizacaoIds=(autorizacoes??[]).map(item=>item.id);

  const [{data:configs},{data:guias},{data:identificacoes,error:identificacoesError}] = await Promise.all([
    convenioIds.length?supabase.from("convenio_identificacao_config").select("convenio_id,metodo,provedor,exige_na_autorizacao,ativo").in("convenio_id",convenioIds).eq("ativo",true):Promise.resolve({data:[] as IdentificacaoConfig[]}),
    atendimentoIds.length?supabase.from("central_guias").select("atendimento_id,status,numero_guia_operadora,senha,created_at").in("atendimento_id",atendimentoIds).order("created_at",{ascending:false}):Promise.resolve({data:[] as Array<CentralGuia & {created_at:string}>}),
    autorizacaoIds.length?supabase.from("autorizacao_identificacao_eventos").select("autorizacao_id,metodo,validado,validado_em").in("autorizacao_id",autorizacaoIds).eq("validado",true):Promise.resolve({data:[] as IdentificacaoEvento[],error:null}),
  ]);

  const configPorConvenio=new Map((configs??[]).map(item=>[item.convenio_id,item as IdentificacaoConfig]));
  const guiaPorAtendimento=new Map<string,CentralGuia>();
  for(const guia of (guias??[]) as CentralGuia[]){if(!guiaPorAtendimento.has(guia.atendimento_id))guiaPorAtendimento.set(guia.atendimento_id,guia);}
  const identificacoesPorAutorizacao=new Map<string,IdentificacaoEvento[]>();
  if(!identificacoesError){for(const evento of (identificacoes??[]) as IdentificacaoEvento[]){const lista=identificacoesPorAutorizacao.get(evento.autorizacao_id)??[];lista.push(evento);identificacoesPorAutorizacao.set(evento.autorizacao_id,lista);}}

  const statusEfetivo=(item:{status:string;atendimento_id:string})=>{const central=guiaPorAtendimento.get(item.atendimento_id);return central?.status==="autorizada"||central?.status==="dispensada"?central.status:item.status;};
  const pendentes=(autorizacoes??[]).filter(item=>["pendente","solicitada"].includes(statusEfetivo(item))).length;
  const autorizadas=(autorizacoes??[]).filter(item=>statusEfetivo(item)==="autorizada").length;
  const negadas=(autorizacoes??[]).filter(item=>statusEfetivo(item)==="negada").length;

  return <SectionPage eyebrow="Jornada / Convênios" title="Autorizações" description="Fila operacional de guia, senha, identificação do beneficiário e retorno da operadora antes da continuidade assistencial.">
    {sucesso === "triagem-salva" ? <div className="mb-4 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm font-semibold text-sky-800"><strong>Triagem salva.</strong> O paciente saiu da fila de triagem e ficará aguardando aqui até a liberação da guia.</div> : null}
    {queryError ? <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">Não foi possível carregar a fila de autorizações. Tente novamente.</div> : null}
    <section className="grid gap-3 sm:grid-cols-3"><Kpi label="Pendentes" value={pendentes}/><Kpi label="Autorizadas" value={autorizadas}/><Kpi label="Negadas" value={negadas}/></section>
    <div className="mt-5 space-y-3">{autorizacoes?.length ? autorizacoes.map((item) => {
      const paciente=one(item.paciente); const convenio=one(item.convenio); const plano=one(item.plano);
      const config=item.convenio_id?configPorConvenio.get(item.convenio_id)??null:null;
      const eventos=identificacoesPorAutorizacao.get(item.id)??[];
      const central=guiaPorAtendimento.get(item.atendimento_id)??null;
      const status=statusEfetivo(item);
      const exigeIdentificacao=Boolean(config?.ativo && config.exige_na_autorizacao && config.metodo!=="nenhum");
      const identificacaoOk=eventos.some(e=>e.validado && (config?.metodo==="biometria_ou_token" || e.metodo===config?.metodo));
      const identificacaoDisponivel=!identificacoesError;
      return <details key={item.id} open={Boolean(atendimento)} className="group ui-card overflow-hidden"><summary className="flex cursor-pointer list-none flex-wrap items-start justify-between gap-4 p-5 hover:bg-slate-50/60"><div><div className="flex items-center gap-2"><ShieldCheck className="size-5 text-brand-700"/><h2 className="font-bold text-slate-900">{paciente?.nome_completo ?? "Paciente"}</h2></div><p className="mt-1 text-sm text-slate-500">Registro #{paciente?.numero_registro ?? "—"} · {paciente?.ra ?? "—"} · {convenio?.nome_fantasia ?? "Convênio"} · {plano?.nome ?? "Plano"}</p>{central && central.status!==item.status?<p className="mt-1 text-xs font-semibold text-emerald-700">Central de Guias: {central.status} · status local será sincronizado ao salvar.</p>:null}</div><div className="flex flex-wrap gap-2"><span className={`rounded-full px-3 py-1 text-xs font-semibold ${status==="autorizada"?"bg-emerald-50 text-emerald-700":status==="negada"?"bg-rose-50 text-rose-700":"bg-brand-50 text-brand-700"}`}>{status}</span>{exigeIdentificacao?<span className={`rounded-full px-3 py-1 text-xs font-semibold ${identificacaoOk?"bg-emerald-50 text-emerald-700":"bg-amber-50 text-amber-800"}`}>{identificacaoOk?"Identificação OK":identificacaoDisponivel?"Identificação obrigatória":"Identificação indisponível"}</span>:null}</div></summary>
      {exigeIdentificacao && identificacaoDisponivel?<section className="border-t border-slate-100 bg-amber-50/40 p-5"><div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between"><div><h3 className="flex items-center gap-2 font-black text-slate-900"><Fingerprint className="size-5"/>Identificação exigida pela operadora</h3><p className="mt-1 text-sm text-slate-600">Método configurado: <b>{config?.metodo.replaceAll("_"," ")}</b>{config?.provedor?` · ${config.provedor}`:""}. A validação fica vinculada a esta autorização.</p>{item.paciente_id?<Link href={`/pacientes/${item.paciente_id}/identificacao`} className="mt-2 inline-flex text-sm font-bold text-brand-700">Abrir identificação do paciente →</Link>:null}</div>{!identificacaoOk?<AuthorizationIdentificationBackgroundForm autorizacaoId={item.id} metodoConfigurado={config?.metodo ?? "biometria_digital"} placeholder={config?.metodo==="token"?"Token apresentado pelo beneficiário":"Referência retornada pelo leitor/SDK"}/>:<div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">Identificação validada para esta autorização.</div>}</div></section>:null}
      <AuthorizationUpdateBackgroundForm autorizacaoId={item.id} numeroGuiaPrestador={item.numero_guia_prestador ?? ""} numeroGuiaOperadora={item.numero_guia_operadora ?? central?.numero_guia_operadora ?? ""} senhaAutorizacao={item.senha_autorizacao ?? central?.senha ?? ""} validade={item.validade ?? ""} status={status} observacao={item.observacao ?? ""}/></details>;
    }) : <div className="ui-card p-8 text-center text-sm text-slate-500">Nenhuma autorização pendente.</div>}</div>
  </SectionPage>;
}

function Kpi({label,value}:{label:string;value:number}){return <div className="his-kpi"><p className="text-xs font-bold uppercase tracking-wider text-slate-400">{label}</p><p className="mt-2 text-3xl font-black text-slate-950">{value}</p></div>}
