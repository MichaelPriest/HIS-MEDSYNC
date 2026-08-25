import Link from "next/link";
import { AlertTriangle, CheckCircle2, Droplets, Wrench } from "lucide-react";
import { SectionPage } from "@/components/painel/section-page";
import { getAssistencialContext } from "@/modules/assistencial/context";
import { vincularMaquinaDialiseAction } from "@/modules/engenharia-clinica/integracoes-actions";

export const dynamic="force-dynamic";
export const revalidate=0;

type Eng={id:string;patrimonio:string;nome:string;status:string;proxima_preventiva:string|null;proxima_calibracao:string|null};
type Maquina={id:string;codigo:string;fabricante:string|null;modelo:string|null;numero_serie:string|null;localizacao:string|null;status:string;ativo:boolean;engenharia_equipamento_id:string|null;engenharia:Eng|Eng[]|null};
const one=<T,>(v:T|T[]|null)=>Array.isArray(v)?v[0]??null:v;
const date=(v:string|null)=>v?new Intl.DateTimeFormat("pt-BR",{timeZone:"UTC"}).format(new Date(`${v}T00:00:00Z`)):"—";

export default async function DialiseEquipamentosPage(){
 const {supabase,empresaId,unidadeId}=await getAssistencialContext();
 const [maqRes,equipRes,permRes]=await Promise.all([
  supabase.from("dialise_maquinas").select("id,codigo,fabricante,modelo,numero_serie,localizacao,status,ativo,engenharia_equipamento_id,engenharia:engenharia_equipamentos(id,patrimonio,nome,status,proxima_preventiva,proxima_calibracao)").eq("empresa_id",empresaId).eq("unidade_id",unidadeId).order("codigo"),
  supabase.from("engenharia_equipamentos").select("id,patrimonio,nome,status,proxima_preventiva,proxima_calibracao").eq("empresa_id",empresaId).eq("unidade_id",unidadeId).order("nome"),
  supabase.rpc("tem_permissao",{p_empresa:empresaId,p_unidade:unidadeId,p_codigo:"engenharia_clinica.gerenciar"}),
 ]);
 const maquinas=(maqRes.data??[]) as unknown as Maquina[];
 const equipamentos=(equipRes.data??[]) as Eng[];
 const canManage=permRes.data===true;
 const disponiveis=maquinas.filter(m=>{const e=one(m.engenharia);return m.ativo&&(!e||["operacional","reserva"].includes(e.status));}).length;
 const bloqueadas=maquinas.filter(m=>{const e=one(m.engenharia);return !!e&&!["operacional","reserva"].includes(e.status);}).length;
 return <SectionPage eyebrow="Engenharia Clínica / Diálise" title="Máquinas de Hemodiálise" description="Vínculo entre cadastro assistencial da diálise e patrimônio da Engenharia Clínica, com bloqueio automático de sessão quando o equipamento está indisponível.">
  <div className="mb-4"><Link href="/engenharia-clinica/integracoes" className="ui-button-secondary">← Integrações</Link></div>
  <section className="grid gap-3 sm:grid-cols-3"><Kpi label="Máquinas" value={maquinas.length}/><Kpi label="Disponíveis" value={disponiveis}/><Kpi label="Bloqueadas" value={bloqueadas} danger={bloqueadas>0}/></section>
  {canManage?<form action={vincularMaquinaDialiseAction} className="his-card mt-5 grid gap-3 p-5 md:grid-cols-[1fr_1fr_auto]"><select name="dialise_maquina_id" required defaultValue="" className="ui-input"><option value="">Máquina da Diálise *</option>{maquinas.map(m=><option key={m.id} value={m.id}>{m.codigo} · {m.fabricante??""} {m.modelo??""}</option>)}</select><select name="equipamento_id" required defaultValue="" className="ui-input"><option value="">Patrimônio da Engenharia *</option>{equipamentos.map(e=><option key={e.id} value={e.id}>{e.patrimonio} · {e.nome} · {e.status}</option>)}</select><button className="ui-button-primary"><Wrench className="size-4"/>Vincular</button></form>:null}
  <section className="mt-5 grid gap-4 xl:grid-cols-2">{maquinas.map(m=>{const e=one(m.engenharia);const ok=m.ativo&&(!e||["operacional","reserva"].includes(e.status));return <article key={m.id} className={`his-card p-5 ${ok?"":"border-rose-200"}`}><div className="flex items-start justify-between gap-3"><div><h2 className="font-black">{m.codigo} · {m.fabricante??""} {m.modelo??""}</h2><p className="text-sm text-slate-500">Série {m.numero_serie??"—"} · {m.localizacao??"sem localização"}</p></div>{ok?<CheckCircle2 className="size-5 text-emerald-600"/>:<AlertTriangle className="size-5 text-rose-600"/>}</div>{e?<div className="mt-4 rounded-xl bg-slate-50 p-3 text-sm"><p className="font-bold">{e.patrimonio} · {e.nome}</p><p className="mt-1 text-xs text-slate-500">Status {e.status} · preventiva {date(e.proxima_preventiva)} · calibração {date(e.proxima_calibracao)}</p></div>:<div className="mt-4 rounded-xl border border-dashed p-3 text-sm text-amber-700"><Droplets className="mr-1 inline size-4"/>Máquina ainda sem patrimônio vinculado.</div>}</article>})}</section>
 </SectionPage>;
}
function Kpi({label,value,danger=false}:{label:string;value:number;danger?:boolean}){return <div className="his-kpi"><p className="text-xs font-black uppercase text-slate-400">{label}</p><p className={`mt-2 text-3xl font-black ${danger?"text-rose-700":"text-slate-950"}`}>{value}</p></div>}
