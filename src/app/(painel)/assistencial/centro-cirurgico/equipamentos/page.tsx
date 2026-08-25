import Link from "next/link";
import { AlertTriangle, CheckCircle2, CircleDot, Wrench } from "lucide-react";
import { SectionPage } from "@/components/painel/section-page";
import { getAssistencialContext } from "@/modules/assistencial/context";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Sala = { sala_id:string;codigo:string;nome:string;status:string|null;equipamentos_obrigatorios:number;equipamentos_obrigatorios_ok:number;equipamentos_obrigatorios_indisponiveis:number;equipamentos_prontos:boolean };
type Vinculo = { sala_cirurgica_id:string;obrigatorio:boolean;principal:boolean;equipamento:{id:string;patrimonio:string;nome:string;status:string;criticidade:string}|{id:string;patrimonio:string;nome:string;status:string;criticidade:string}[]|null };
const one=<T,>(value:T|T[]|null)=>Array.isArray(value)?value[0]??null:value;

export default async function CentroCirurgicoEquipamentosPage(){
  const {supabase,empresaId,unidadeId}=await getAssistencialContext();
  const [salasRes,vinculosRes]=await Promise.all([
    supabase.from("vw_salas_cirurgicas_prontidao").select("sala_id,codigo,nome,status,equipamentos_obrigatorios,equipamentos_obrigatorios_ok,equipamentos_obrigatorios_indisponiveis,equipamentos_prontos").eq("empresa_id",empresaId).eq("unidade_id",unidadeId).order("nome"),
    supabase.from("engenharia_sala_equipamentos").select("sala_cirurgica_id,obrigatorio,principal,equipamento:engenharia_equipamentos(id,patrimonio,nome,status,criticidade)").eq("empresa_id",empresaId).eq("unidade_id",unidadeId).eq("ativo",true),
  ]);
  const salas=(salasRes.data??[]) as Sala[];
  const vinculos=(vinculosRes.data??[]) as unknown as Vinculo[];
  const prontas=salas.filter(s=>s.equipamentos_prontos).length;
  const bloqueadas=salas.filter(s=>!s.equipamentos_prontos).length;
  return <SectionPage eyebrow="Assistencial / Centro Cirúrgico" title="Prontidão de equipamentos das salas" description="Checagem automática dos equipamentos obrigatórios vinculados pela Engenharia Clínica antes do uso da sala cirúrgica.">
    <div className="mb-4 flex flex-wrap gap-2"><Link href="/assistencial/centro-cirurgico" className="ui-button-secondary">← Centro Cirúrgico</Link><Link href="/engenharia-clinica/integracoes" className="ui-button-secondary"><Wrench className="size-4"/>Gerenciar vínculos</Link></div>
    <section className="grid gap-3 sm:grid-cols-3"><Kpi label="Salas" value={salas.length}/><Kpi label="Prontas" value={prontas}/><Kpi label="Com pendência" value={bloqueadas} danger={bloqueadas>0}/></section>
    <section className="mt-5 grid gap-4 xl:grid-cols-2">{salas.map(s=>{const itens=vinculos.filter(v=>v.sala_cirurgica_id===s.sala_id);return <article key={s.sala_id} className={`his-card p-5 ${s.equipamentos_prontos?"":"border-rose-200"}`}><div className="flex items-start justify-between gap-3"><div><h2 className="font-black text-slate-950">{s.codigo} · {s.nome}</h2><p className="mt-1 text-sm text-slate-500">Obrigatórios {s.equipamentos_obrigatorios} · disponíveis {s.equipamentos_obrigatorios_ok}</p></div>{s.equipamentos_prontos?<span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700"><CheckCircle2 className="size-3.5"/>Pronta</span>:<span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-3 py-1 text-xs font-black text-rose-700"><AlertTriangle className="size-3.5"/>Pendência</span>}</div><div className="mt-4 space-y-2">{itens.map((v,index)=>{const e=one(v.equipamento);const ok=e&&["operacional","reserva"].includes(e.status);return <div key={`${s.sala_id}-${e?.id??index}`} className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 px-3 py-2 text-sm"><div><b>{e?.patrimonio??"—"} · {e?.nome??"Equipamento"}</b><p className="text-xs text-slate-500">{v.principal?"Principal · ":""}{v.obrigatorio?"Obrigatório · ":"Opcional · "}criticidade {e?.criticidade??"—"}</p></div><span className={`rounded-full px-2 py-1 text-xs font-black ${ok?"bg-emerald-50 text-emerald-700":"bg-rose-50 text-rose-700"}`}>{e?.status??"sem vínculo"}</span></div>})}{!itens.length?<div className="rounded-xl border border-dashed p-4 text-sm text-slate-500"><CircleDot className="mr-1 inline size-4"/>Nenhum equipamento vinculado à sala.</div>:null}</div></article>})}{!salas.length?<div className="his-card p-8 text-center text-sm text-slate-500 xl:col-span-2">Nenhuma sala cirúrgica cadastrada nesta unidade.</div>:null}</section>
  </SectionPage>;
}

function Kpi({label,value,danger=false}:{label:string;value:number;danger?:boolean}){return <div className="his-kpi"><p className="text-xs font-black uppercase text-slate-400">{label}</p><p className={`mt-2 text-3xl font-black ${danger?"text-rose-700":"text-slate-950"}`}>{value}</p></div>}
