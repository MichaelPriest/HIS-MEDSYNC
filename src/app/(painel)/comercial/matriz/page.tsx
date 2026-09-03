import type { Route } from "next";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, Grid3X3, ShieldAlert } from "lucide-react";
import { CadastrosWorkspaceNav, CadastroKpi } from "@/components/cadastros/cadastros-workspace-nav";
import { SectionPage } from "@/components/painel/section-page";
import { requireAnyPermission } from "@/lib/permissions/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Rel<T> = T | T[] | null;
type Convenio = { nome_fantasia: string | null };
type Contrato = { id: string; plano_id: string | null; numero_contrato: string | null; status: string; convenio: Rel<Convenio> };
type Plano = { id: string; nome: string };
type Simulacao = { status?: string; valor_base?: number; valor_final?: number; valor_resolvido?: number; metodologia?: string; contrato_resolvido_id?: string | null };
type Cenario = { contrato_id: string; selecionado: boolean; numero_contrato: string | null; plano_nome: string; unidade_nome: string; data_inicio: string | null; data_fim: string | null; especificidade: number; sobreposicoes_contexto: number; prontidao_bloqueios: number; prontidao_avisos: number; simulacao: Simulacao };
type Matriz = { cenarios?: Cenario[] };
type SearchParams = { contrato?: string; codigo?: string; data?: string; categoria?: string };

const CATEGORIAS = ["procedimentos","cirurgias","sadt","honorarios","anestesia","auxiliares","diarias","taxas","gases","materiais","medicamentos","opme","pacotes"] as const;
const one = <T,>(value: Rel<T>): T | null => Array.isArray(value) ? value[0] ?? null : value;
const today = () => new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Sao_Paulo" }).format(new Date());
const clean = (value: string | undefined) => (value ?? "").replace(/[<>]/g, "").trim().slice(0, 100);
const brl = (value: unknown) => typeof value === "number" && Number.isFinite(value) ? value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—";

function meta(status?: string) {
  if (status === "precificado") return { label: "Precificado", cls: "border-emerald-200 bg-emerald-50", Icon: CheckCircle2 };
  if (status === "contrato_contextual_diferente") return { label: "Resolve outro contrato", cls: "border-rose-200 bg-rose-50", Icon: ShieldAlert };
  if (status === "sem_preco_contratual") return { label: "Sem preço", cls: "border-rose-200 bg-rose-50", Icon: ShieldAlert };
  return { label: status || "Sem resultado", cls: "border-amber-200 bg-amber-50", Icon: AlertTriangle };
}

export default async function ComercialMatrizPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const { supabase, empresaId } = await requireAnyPermission(["comercial.visualizar","comercial.editar","credenciamento.visualizar","credenciamento.gerenciar","tabelas_comerciais.visualizar","tabelas_comerciais.gerenciar"]);
  const [contractsReq, planosReq] = await Promise.all([
    supabase.from("credenciamento_contratos").select("id,plano_id,numero_contrato,status,convenio:convenios(nome_fantasia)").eq("empresa_id", empresaId).order("created_at", { ascending: false }).limit(250),
    supabase.from("convenio_planos").select("id,nome").eq("empresa_id", empresaId).eq("ativo", true).order("nome"),
  ]);
  const contratos = (contractsReq.data ?? []) as unknown as Contrato[];
  const planos = (planosReq.data ?? []) as Plano[];
  const planoMap = new Map(planos.map((item) => [item.id, item.nome]));
  const selected = contratos.find((item) => item.id === sp.contrato) ?? contratos.find((item) => item.status === "ativo") ?? contratos[0] ?? null;
  const codigo = clean(sp.codigo);
  const data = sp.data && /^\d{4}-\d{2}-\d{2}$/.test(sp.data) ? sp.data : today();
  const categoria = CATEGORIAS.includes(sp.categoria as typeof CATEGORIAS[number]) ? String(sp.categoria) : "procedimentos";
  let matriz: Matriz | null = null;
  let erro: string | null = null;
  if (selected && codigo) {
    const result = await supabase.rpc("comercial_simular_matriz_cenarios", { p_contrato_id: selected.id, p_codigo: codigo, p_data: data, p_categoria: categoria, p_urgencia: false, p_horario_especial: false, p_acomodacao_individual: false, p_anestesia: false, p_quantidade_auxiliares: 0, p_sequencia: 1, p_via_acesso: null, p_mesma_via: false, p_origem_tipo: null });
    matriz = result.data as Matriz | null;
    erro = result.error?.message ?? null;
  }
  const cenarios = Array.isArray(matriz?.cenarios) ? matriz.cenarios : [];
  const precificados = cenarios.filter((item) => item.simulacao.status === "precificado").length;
  const conflitos = cenarios.filter((item) => item.simulacao.status === "contrato_contextual_diferente").length;
  const sobrepostos = cenarios.filter((item) => item.sobreposicoes_contexto > 1).length;
  const bloqueados = cenarios.filter((item) => item.prontidao_bloqueios > 0).length;
  return <SectionPage eyebrow="Comercial / Matriz" title="Matriz de cenários contratuais" description="Compare o mesmo código em todos os contextos ativos de plano e unidade do convênio, usando o resolvedor real sem gravar preços ou snapshots." actions={selected ? <Link href={`/comercial/simulador?contrato=${selected.id}` as Route} className="ui-button-secondary">Simulador unitário</Link> : null}>
    <CadastrosWorkspaceNav active="/comercial/matriz" />
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5"><CadastroKpi label="Contextos" value={cenarios.length} detail={codigo ? `Código ${codigo}` : "Informe um código"} /><CadastroKpi label="Precificados" value={precificados} /><CadastroKpi label="Conflitos" value={conflitos} /><CadastroKpi label="Sobrepostos" value={sobrepostos} /><CadastroKpi label="Bloqueados" value={bloqueados} /></section>
    <section className="his-card mt-5 p-5"><form className="grid gap-3 md:grid-cols-4"><label className="text-xs font-bold text-slate-600">Contrato<select name="contrato" defaultValue={selected?.id ?? ""} className="ui-input mt-1">{contratos.map((c) => <option key={c.id} value={c.id}>{one(c.convenio)?.nome_fantasia ?? "Convênio"} · {c.plano_id ? planoMap.get(c.plano_id) ?? "Plano" : "Todos os planos"} · {c.numero_contrato || "Sem nº"}</option>)}</select></label><label className="text-xs font-bold text-slate-600">Código<input name="codigo" defaultValue={codigo} className="ui-input mt-1" required /></label><label className="text-xs font-bold text-slate-600">Categoria<select name="categoria" defaultValue={categoria} className="ui-input mt-1">{CATEGORIAS.map((item) => <option key={item}>{item}</option>)}</select></label><label className="text-xs font-bold text-slate-600">Data<input type="date" name="data" defaultValue={data} className="ui-input mt-1" /></label><div className="md:col-span-4 flex justify-end"><button className="ui-button-primary"><Grid3X3 className="size-4" />Executar matriz</button></div></form></section>
    {erro ? <section className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800">{erro}</section> : null}
    {codigo && !erro && !cenarios.length ? <section className="his-card mt-5 p-8 text-center"><AlertTriangle className="mx-auto size-8 text-amber-500" /><p className="mt-2 font-bold">Nenhum contexto ativo encontrado para a data selecionada.</p></section> : null}
    <section className="mt-5 space-y-3">{cenarios.map((cenario) => { const m = meta(cenario.simulacao.status); const Icon = m.Icon; return <article key={cenario.contrato_id} className={`rounded-2xl border p-5 ${m.cls}`}><div className="flex flex-wrap items-start justify-between gap-4"><div><div className="flex flex-wrap items-center gap-2"><Icon className="size-5" /><b>{m.label}</b>{cenario.selecionado ? <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-black uppercase">Selecionado</span> : null}{cenario.sobreposicoes_contexto > 1 ? <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-black uppercase text-rose-800">{cenario.sobreposicoes_contexto} sobrepostos</span> : null}</div><h2 className="mt-2 text-lg font-black text-slate-950">{cenario.plano_nome} · {cenario.unidade_nome}</h2><p className="text-xs text-slate-600">Contrato {cenario.numero_contrato || "sem nº"} · especificidade {cenario.especificidade}/2 · {cenario.data_inicio || "sem início"} → {cenario.data_fim || "aberto"}</p><p className="mt-2 text-sm font-bold">Base {brl(cenario.simulacao.valor_base ?? cenario.simulacao.valor_resolvido)} · Final {brl(cenario.simulacao.valor_final ?? cenario.simulacao.valor_resolvido)} · {cenario.prontidao_bloqueios} bloqueio(s) · {cenario.prontidao_avisos} aviso(s)</p>{cenario.simulacao.status === "contrato_contextual_diferente" ? <p className="mt-2 text-sm text-rose-800">Resolvedor escolheu outro contrato: {cenario.simulacao.contrato_resolvido_id || "não identificado"}.</p> : null}</div><div className="flex gap-2"><Link href={`/comercial/simulador?contrato=${cenario.contrato_id}&codigo=${encodeURIComponent(codigo)}&data=${data}&categoria=${categoria}` as Route} className="ui-button-secondary">Detalhar</Link><Link href={`/comercial/vinculos?contrato=${cenario.contrato_id}` as Route} className="ui-button-secondary">Vínculos</Link></div></div></article>; })}</section>
  </SectionPage>;
}
