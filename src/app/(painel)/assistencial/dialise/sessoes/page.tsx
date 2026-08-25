import Link from "next/link";
import { AlertTriangle, CheckCircle2, Droplets, PlayCircle } from "lucide-react";
import { SectionPage } from "@/components/painel/section-page";
import { getAssistencialContext } from "@/modules/assistencial/context";
import { concluirSessaoDialiseAction, iniciarSessaoDialiseAction } from "@/modules/assistencial/dialise-actions";

export const dynamic="force-dynamic";
export const revalidate=0;

type Eng={status:string}|{status:string}[]|null;
type Maquina={id:string;codigo:string;fabricante:string|null;modelo:string|null;status:string;ativo:boolean;engenharia_equipamento_id:string|null;engenharia:Eng};
type Atendimento={id:string;numero_atendimento:string|number|null;status:string|null;paciente:{nome_completo:string|null;ra:string|null}|{nome_completo:string|null;ra:string|null}[]|null};
type Sessao={id:string;atendimento_id:string;maquina_id:string|null;inicio_em:string|null;fim_em:string|null;peso_pre_kg:number|null;peso_pos_kg:number|null;ultrafiltracao_real_ml:number|null;ktv:number|null;urr:number|null;intercorrencias:string|null;status:string;maquina:{codigo:string;fabricante:string|null;modelo:string|null}|{codigo:string;fabricante:string|null;modelo:string|null}[]|null;atendimento:{numero_atendimento:string|number|null;paciente:{nome_completo:string|null}|{nome_completo:string|null}[]|null}|{numero_atendimento:string|number|null;paciente:{nome_completo:string|null}|{nome_completo:string|null}[]|null}[]|null};
function one<T>(v:T|T[]|null){return Array.isArray(v)?v[0]??null:v;}
function fmt(v:string|null|undefined){return v?new Intl.DateTimeFormat("pt-BR",{dateStyle:"short",timeStyle:"short",timeZone:"America/Sao_Paulo"}).format(new Date(v)):"—";}
function maquinaOk(m:Maquina){const e=one(m.engenharia);return m.ativo&&(!e||["operacional","reserva"].includes(e.status));}

export default async function DialiseSessoesPage({searchParams}:{searchParams:Promise<{sucesso?:string;erro?:string}>}){
 const sp=await searchParams;
 const {supabase,empresaId,unidadeId}=await getAssistencialContext();
 const [maqRes,atRes,sessRes]=await Promise.all([
  supabase.from("dialise_maquinas").select("id,codigo,fabricante,modelo,status,ativo,engenharia_equipamento_id,engenharia:engenharia_equipamentos(status)").eq("empresa_id",empresaId).eq("unidade_id",unidadeId).order("codigo"),
  supabase.from("atendimentos").select("id,numero_atendimento,status,paciente:pacientes(nome_completo,ra)").eq("empresa_id",empresaId).eq("unidade_id",unidadeId).order("created_at",{ascending:false}).limit(100),
  supabase.from("dialise_sessoes").select("id,atendimento_id,maquina_id,inicio_em,fim_em,peso_pre_kg,peso_pos_kg,ultrafiltracao_real_ml,ktv,urr,intercorrencias,status,maquina:dialise_maquinas(codigo,fabricante,modelo),atendimento:atendimentos(numero_atendimento,paciente:pacientes(nome_completo))").eq("empresa_id",empresaId).eq("unidade_id",unidadeId).order("created_at",{ascending:false}).limit(100),
 ]);
 const maquinas=(maqRes.data??[]) as unknown as Maquina[];
 const atendimentos=(atRes.data??[]) as unknown as Atendimento[];
 const sessoes=(sessRes.data??[]) as unknown as Sessao[];
 const disponiveis=maquinas.filter(maquinaOk);
 const ativas=sessoes.filter(s=>s.status==="em_andamento");
 return <SectionPage eyebrow="Assistencial / Diálise" title="Sessões de Hemodiálise" description="Sessão vinculada ao atendimento, máquina assistencial e patrimônio da Engenharia Clínica, com bloqueio automático de equipamento indisponível.">
  <div className="mb-4 flex flex-wrap gap-2"><Link href="/assistencial/dialise" className="ui-button-secondary">← Diálise</Link><Link href="/engenharia-clinica/integracoes/dialise" className="ui-button-secondary">Máquinas / Engenharia</Link></div>
  {sp.sucesso?<div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">Operação concluída: {sp.sucesso}.</div>:null}
  {sp.erro?<div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">Falha: {decodeURIComponent(sp.erro)}</div>:null}
  <section className="grid gap-3 sm:grid-cols-3"><Kpi label="Máquinas disponíveis" value={disponiveis.length}/><Kpi label="Sessões em andamento" value={ativas.length}/><Kpi label="Máquinas bloqueadas" value={maquinas.length-disponiveis.length} danger={maquinas.length>disponiveis.length}/></section>

  <section className="mt-5 grid gap-5 xl:grid-cols-[0.85fr_1.15fr]"><form action={iniciarSessaoDialiseAction} className="his-card p-5"><h2 className="flex items-center gap-2 font-black"><PlayCircle className="size-5"/>Iniciar sessão</h2><div className="mt-4 grid gap-3"><select name="atendimento_id" required defaultValue="" className="ui-input"><option value="">Atendimento *</option>{atendimentos.map(a=>{const p=one(a.paciente);return <option key={a.id} value={a.id}>{p?.nome_completo??"Paciente"} · Atend. #{a.numero_atendimento??"—"} · {p?.ra??"—"}</option>})}</select><select name="maquina_id" required defaultValue="" className="ui-input"><option value="">Máquina disponível *</option>{maquinas.map(m=><option key={m.id} value={m.id} disabled={!maquinaOk(m)}>{m.codigo} · {m.fabricante??""} {m.modelo??""}{maquinaOk(m)?"":" · BLOQUEADA"}</option>)}</select><div className="grid gap-3 sm:grid-cols-2"><input name="peso_pre_kg" inputMode="decimal" className="ui-input" placeholder="Peso pré-diálise (kg)"/><input name="inicio_em" type="datetime-local" className="ui-input"/></div><textarea name="observacoes" rows={3} className="ui-input" placeholder="Observações iniciais"/><button disabled={!disponiveis.length} className="ui-button-primary justify-self-end"><Droplets className="size-4"/>Iniciar sessão</button></div></form>

  <div className="space-y-3">{ativas.map(s=>{const m=one(s.maquina),at=one(s.atendimento),p=one(at?.paciente??null);return <article key={s.id} className="his-card p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-black">{p?.nome_completo??"Paciente"}</h2><p className="text-sm text-slate-500">Atend. #{at?.numero_atendimento??"—"} · {m?.codigo??"Máquina"} · início {fmt(s.inicio_em)}</p></div><span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-bold text-brand-700">Em andamento</span></div><form action={concluirSessaoDialiseAction} className="mt-4 grid gap-3 sm:grid-cols-2"><input type="hidden" name="sessao_id" value={s.id}/><input name="peso_pos_kg" inputMode="decimal" className="ui-input" placeholder="Peso pós-diálise (kg)"/><input name="ultrafiltracao_real_ml" inputMode="decimal" className="ui-input" placeholder="UF real (mL)"/><input name="ktv" inputMode="decimal" className="ui-input" placeholder="Kt/V"/><input name="urr" inputMode="decimal" className="ui-input" placeholder="URR"/><textarea name="intercorrencias" rows={2} className="ui-input sm:col-span-2" placeholder="Intercorrências e evolução da sessão"/><button className="ui-button-primary sm:col-span-2 sm:justify-self-end"><CheckCircle2 className="size-4"/>Concluir sessão</button></form></article>})}{!ativas.length?<div className="his-card p-8 text-center text-sm text-slate-500"><AlertTriangle className="mx-auto mb-2 size-5"/>Nenhuma sessão em andamento.</div>:null}</div></section>
 </SectionPage>;
}
function Kpi({label,value,danger=false}:{label:string;value:number;danger?:boolean}){return <div className="his-kpi"><p className="text-xs font-black uppercase text-slate-400">{label}</p><p className={`mt-2 text-3xl font-black ${danger?"text-rose-700":"text-slate-950"}`}>{value}</p></div>}
