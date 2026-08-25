import Link from "next/link";
import { Activity, AlertTriangle, CheckCircle2, RadioTower, Wind } from "lucide-react";
import { SectionPage } from "@/components/painel/section-page";
import { getAssistencialContext } from "@/modules/assistencial/context";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Equipamento = { id:string; patrimonio:string; nome:string; categoria:string; status:string; localizacao:string|null };
type Integracao = { id:string; equipamento_id:string; protocolo:string|null; status:string; ultimo_contato_em:string|null; ultima_falha_em:string|null; ultima_mensagem:string|null; equipamento:Equipamento|Equipamento[]|null };
type Leitura = { id:string; equipamento_id:string; atendimento_id:string|null; tipo:string; observado_em:string; dados:Record<string,unknown>; qualidade:string|null; status:string; equipamento:Equipamento|Equipamento[]|null; atendimento:{numero_atendimento:string|number|null;paciente:{nome_completo:string|null}|{nome_completo:string|null}[]|null}|{numero_atendimento:string|number|null;paciente:{nome_completo:string|null}|{nome_completo:string|null}[]|null}[]|null };

function one<T>(v:T|T[]|null){return Array.isArray(v)?v[0]??null:v;}
function fmt(v:string|null|undefined){return v?new Intl.DateTimeFormat("pt-BR",{dateStyle:"short",timeStyle:"short",timeZone:"America/Sao_Paulo"}).format(new Date(v)):"—";}
function operational(status:string){return ["operacional","reserva"].includes(status);}

export default async function UtiEquipamentosPage(){
  const {supabase,empresaId,unidadeId}=await getAssistencialContext();
  const [intRes,leitRes]=await Promise.all([
    supabase.from("engenharia_integracoes_equipamentos").select("id,equipamento_id,protocolo,status,ultimo_contato_em,ultima_falha_em,ultima_mensagem,equipamento:engenharia_equipamentos(id,patrimonio,nome,categoria,status,localizacao)").eq("empresa_id",empresaId).eq("unidade_id",unidadeId).eq("sistema_origem","uti").eq("ativo",true).order("updated_at",{ascending:false}),
    supabase.from("monitorizacao_equipamento_dados").select("id,equipamento_id,atendimento_id,tipo,observado_em,dados,qualidade,status,equipamento:engenharia_equipamentos(id,patrimonio,nome,categoria,status,localizacao),atendimento:atendimentos(numero_atendimento,paciente:pacientes(nome_completo))").eq("empresa_id",empresaId).eq("unidade_id",unidadeId).order("observado_em",{ascending:false}).limit(100),
  ]);
  const integracoes=(intRes.data??[]) as unknown as Integracao[];
  const leituras=(leitRes.data??[]) as unknown as Leitura[];
  const indisponiveis=integracoes.filter(i=>{const e=one(i.equipamento);return !e||!operational(e.status)||["falha","offline"].includes(i.status);});
  return <SectionPage eyebrow="Assistencial / UTI" title="Equipamentos e monitorização" description="Status patrimonial, saúde das interfaces e telemetria recebida de monitores, ventiladores e equipamentos da terapia intensiva.">
    <div className="mb-4 flex flex-wrap gap-2"><Link href="/assistencial/uti" className="ui-button-secondary">← UTI</Link><Link href="/engenharia-clinica/integracoes" className="ui-button-secondary"><RadioTower className="size-4"/>Integrações</Link></div>
    <section className="grid gap-3 sm:grid-cols-3"><Kpi label="Integrações UTI" value={integracoes.length}/><Kpi label="Com pendência" value={indisponiveis.length} danger={indisponiveis.length>0}/><Kpi label="Leituras recentes" value={leituras.length}/></section>

    <section className="mt-5 grid gap-4 xl:grid-cols-2">{integracoes.map(i=>{const e=one(i.equipamento);const ok=Boolean(e&&operational(e.status)&&!["falha","offline"].includes(i.status));return <article key={i.id} className={`his-card p-5 ${ok?"":"border-rose-200"}`}><div className="flex items-start justify-between gap-3"><div><h2 className="font-black text-slate-950">{e?.patrimonio??"—"} · {e?.nome??"Equipamento"}</h2><p className="mt-1 text-sm text-slate-500">{e?.categoria??"—"} · {e?.localizacao??"sem localização"} · {i.protocolo??"sem protocolo"}</p></div>{ok?<CheckCircle2 className="size-5 text-emerald-600"/>:<AlertTriangle className="size-5 text-rose-600"/>}</div><div className="mt-4 grid gap-2 text-xs text-slate-500 sm:grid-cols-2"><p>Status patrimônio: <b>{e?.status??"—"}</b></p><p>Status interface: <b>{i.status}</b></p><p>Último contato: {fmt(i.ultimo_contato_em)}</p><p>Última falha: {fmt(i.ultima_falha_em)}</p></div>{i.ultima_mensagem?<p className="mt-3 rounded-xl bg-slate-50 p-3 text-xs text-slate-600">{i.ultima_mensagem}</p>:null}</article>})}{!integracoes.length?<div className="his-card p-8 text-center text-sm text-slate-500 xl:col-span-2"><Wind className="mx-auto mb-2 size-5"/>Nenhum equipamento da UTI possui integração ativa.</div>:null}</section>

    <section className="mt-5 his-card overflow-hidden"><div className="border-b border-slate-100 p-5"><h2 className="flex items-center gap-2 font-black"><Activity className="size-5"/>Telemetria recebida</h2><p className="text-sm text-slate-500">Dados estruturados vinculados ao equipamento e, quando informado pela interface, ao atendimento do paciente.</p></div><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">Horário</th><th className="px-4 py-3">Equipamento</th><th className="px-4 py-3">Paciente</th><th className="px-4 py-3">Tipo</th><th className="px-4 py-3">Dados</th></tr></thead><tbody className="divide-y divide-slate-100">{leituras.map(l=>{const e=one(l.equipamento),at=one(l.atendimento),p=one(at?.paciente??null);return <tr key={l.id}><td className="px-4 py-4 whitespace-nowrap">{fmt(l.observado_em)}</td><td className="px-4 py-4"><b>{e?.patrimonio??"—"}</b><span className="block text-xs text-slate-500">{e?.nome??"Equipamento"}</span></td><td className="px-4 py-4">{p?.nome_completo??"Não vinculado"}<span className="block text-xs text-slate-500">{at?.numero_atendimento?`Atend. #${at.numero_atendimento}`:""}</span></td><td className="px-4 py-4 font-semibold">{l.tipo}</td><td className="px-4 py-4"><code className="text-xs">{JSON.stringify(l.dados)}</code></td></tr>})}{!leituras.length?<tr><td colSpan={5} className="px-4 py-8 text-center text-slate-500">Nenhuma leitura recebida.</td></tr>:null}</tbody></table></div></section>
  </SectionPage>;
}

function Kpi({label,value,danger=false}:{label:string;value:number;danger?:boolean}){return <div className="his-kpi"><p className="text-xs font-black uppercase text-slate-400">{label}</p><p className={`mt-2 text-3xl font-black ${danger?"text-rose-700":"text-slate-950"}`}>{value}</p></div>}
