import Link from "next/link";
import { notFound } from "next/navigation";
import { Boxes, CheckCircle2, PackageCheck, RotateCcw, Scissors, TriangleAlert } from "lucide-react";
import { SectionPage } from "@/components/painel/section-page";
import { getAssistencialContext } from "@/modules/assistencial/context";
import {
  consumirSuprimentoCirurgicoAction,
  estornarConsumoCirurgicoAction,
  receberSuprimentosCirurgicosAction,
  requisitarSuprimentosCirurgicosAction,
} from "@/modules/centro-cirurgico/suprimentos-actions";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Rel<T> = T | T[] | null;
type Cirurgia = {
  id: string;
  atendimento_id: string;
  procedimento: string;
  status: string;
  inicio_previsto: string | null;
  inicio_em: string | null;
  fim_em: string | null;
  paciente: Rel<{ nome_completo: string | null; ra: string | null }>;
};
type Local = { id: string; nome: string; tipo: string | null; eh_farmacia: boolean | null };
type Produto = { id: string; codigo: string; descricao: string; tipo: string; unidade_medida: string };
type Lote = { id: string; produto_id: string; local_id: string; numero_lote: string | null; validade: string | null; quantidade: number; status: string };
type Requisicao = { id: string; numero: string; local_destino_id: string; prioridade: string; justificativa: string | null; status: string; solicitado_em: string; atendido_em: string | null; recebido_em: string | null };
type ReqItem = { id: string; requisicao_id: string; produto_id: string; quantidade_solicitada: number; quantidade_aprovada: number | null; quantidade_atendida: number; unidade_medida: string | null; observacoes: string | null; status: string };
type Movimento = { id: string; produto_id: string; lote_id: string | null; local_origem_id: string | null; local_destino_id: string | null; tipo: string; quantidade: number; custo_unitario: number | null; motivo: string | null; created_at: string; cirurgia_opme_id: string | null; movimento_origem_id: string | null; requisicao_setorial_id: string | null; requisicao_setorial_item_id: string | null };
type Opme = { id: string; item: string; codigo: string | null; lote: string | null; serie: string | null; quantidade: number; status: string; produto_id: string | null; estoque_lote_id: string | null; estoque_movimento_id: string | null };
type Producao = { id: string; tipo_evento: string; origem_tipo: string; origem_id: string; quantidade: number; categoria_contratual: string; codigo_tuss_fallback: string | null; status: string; ocorrido_em: string; metadados: Record<string, unknown> | null };
type Search = { sucesso?: string; erro?: string };

function one<T>(value: Rel<T>) { return Array.isArray(value) ? value[0] ?? null : value; }
function fmt(value: string | null | undefined) { return value ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(value)) : "—"; }
function fmtDate(value: string | null | undefined) { return value ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(`${value}T12:00:00`)) : "—"; }
function label(value: string) { return value.replaceAll("_", " "); }
function statusClass(value: string) {
  if (["recebida", "atendida", "registrado", "consolidado"].includes(value)) return "bg-emerald-50 text-emerald-700";
  if (["parcial", "em_separacao", "em_preparo"].includes(value)) return "bg-amber-50 text-amber-700";
  if (["cancelada", "estornado"].includes(value)) return "bg-rose-50 text-rose-700";
  return "bg-brand-50 text-brand-700";
}

export default async function SuprimentosCirurgiaPage({ params, searchParams }: { params: Promise<{ cirurgiaId: string }>; searchParams: Promise<Search> }) {
  const [{ cirurgiaId }, sp] = await Promise.all([params, searchParams]);
  const { supabase, empresaId, unidadeId } = await getAssistencialContext();

  const [cirurgiaReq, locaisReq, produtosReq, lotesReq, requisicoesReq, movimentosReq, opmeReq] = await Promise.all([
    supabase.from("cirurgias").select("id,atendimento_id,procedimento,status,inicio_previsto,inicio_em,fim_em,paciente:pacientes(nome_completo,ra)").eq("id", cirurgiaId).eq("empresa_id", empresaId).eq("unidade_id", unidadeId).maybeSingle(),
    supabase.from("estoque_locais").select("id,nome,tipo,eh_farmacia").eq("empresa_id", empresaId).eq("unidade_id", unidadeId).eq("ativo", true).order("nome"),
    supabase.from("estoque_produtos").select("id,codigo,descricao,tipo,unidade_medida").eq("empresa_id", empresaId).eq("ativo", true).in("tipo", ["material", "opme", "medicamento", "gas_medicinal"]).order("descricao").limit(3000),
    supabase.from("estoque_lotes").select("id,produto_id,local_id,numero_lote,validade,quantidade,status").eq("empresa_id", empresaId).eq("unidade_id", unidadeId).eq("status", "disponivel").gt("quantidade", 0).order("validade", { ascending: true }).limit(5000),
    supabase.from("estoque_requisicoes_setoriais").select("id,numero,local_destino_id,prioridade,justificativa,status,solicitado_em,atendido_em,recebido_em").eq("empresa_id", empresaId).eq("unidade_id", unidadeId).eq("cirurgia_id", cirurgiaId).order("solicitado_em", { ascending: false }).limit(300),
    supabase.from("estoque_movimentos").select("id,produto_id,lote_id,local_origem_id,local_destino_id,tipo,quantidade,custo_unitario,motivo,created_at,cirurgia_opme_id,movimento_origem_id,requisicao_setorial_id,requisicao_setorial_item_id").eq("empresa_id", empresaId).eq("unidade_id", unidadeId).eq("cirurgia_id", cirurgiaId).order("created_at", { ascending: false }).limit(1000),
    supabase.from("cirurgia_opme").select("id,item,codigo,lote,serie,quantidade,status,produto_id,estoque_lote_id,estoque_movimento_id").eq("empresa_id", empresaId).eq("unidade_id", unidadeId).eq("cirurgia_id", cirurgiaId).order("created_at", { ascending: false }).limit(500),
  ]);

  if (!cirurgiaReq.data) notFound();
  const cirurgia = cirurgiaReq.data as unknown as Cirurgia;
  const paciente = one(cirurgia.paciente);
  const locais = (locaisReq.data ?? []) as Local[];
  const produtos = (produtosReq.data ?? []) as Produto[];
  const lotes = (lotesReq.data ?? []) as Lote[];
  const requisicoes = (requisicoesReq.data ?? []) as Requisicao[];
  const movimentos = (movimentosReq.data ?? []) as Movimento[];
  const opmes = (opmeReq.data ?? []) as Opme[];

  const requisicaoIds = requisicoes.map((item) => item.id);
  const itensReq = requisicaoIds.length
    ? await supabase.from("estoque_requisicao_setorial_itens").select("id,requisicao_id,produto_id,quantidade_solicitada,quantidade_aprovada,quantidade_atendida,unidade_medida,observacoes,status").in("requisicao_id", requisicaoIds).order("created_at")
    : { data: [] as ReqItem[] };
  const itens = (itensReq.data ?? []) as ReqItem[];
  const producaoReq = await supabase.from("producao_assistencial_eventos")
    .select("id,tipo_evento,origem_tipo,origem_id,quantidade,categoria_contratual,codigo_tuss_fallback,status,ocorrido_em,metadados")
    .eq("empresa_id", empresaId).eq("unidade_id", unidadeId).eq("atendimento_id", cirurgia.atendimento_id).eq("setor", "centro_cirurgico")
    .in("origem_tipo", ["estoque_movimento_cirurgia", "cirurgia_opme"]).order("ocorrido_em", { ascending: false }).limit(500);
  const producao = (producaoReq.data ?? []) as Producao[];

  const produtoById = new Map(produtos.map((item) => [item.id, item]));
  const localById = new Map(locais.map((item) => [item.id, item]));
  const reqById = new Map(requisicoes.map((item) => [item.id, item]));
  const itensByReq = new Map<string, ReqItem[]>();
  for (const item of itens) itensByReq.set(item.requisicao_id, [...(itensByReq.get(item.requisicao_id) ?? []), item]);
  const devolvidoByOrigem = new Map<string, number>();
  for (const mov of movimentos) if (mov.tipo === "devolucao" && mov.movimento_origem_id) devolvidoByOrigem.set(mov.movimento_origem_id, (devolvidoByOrigem.get(mov.movimento_origem_id) ?? 0) + Number(mov.quantidade));
  const consumos = movimentos.filter((mov) => mov.tipo === "consumo_paciente");
  const transferencias = movimentos.filter((mov) => mov.tipo === "transferencia");
  const opmesPlanejadas = opmes.filter((item) => item.status === "previsto");
  const itensElegiveis = itens.filter((item) => ["atendido", "parcial"].includes(item.status) && ["atendida", "recebida"].includes(reqById.get(item.requisicao_id)?.status ?? ""));
  const lotesConsumiveis = lotes.filter((lote) => {
    const produto = produtoById.get(lote.produto_id);
    return produto && ["material", "opme", "gas_medicinal"].includes(produto.tipo);
  });
  const temLocalBloco = locais.some((item) => /cirurg|bloco|satel/i.test(`${item.nome} ${item.tipo ?? ""}`));
  const podeConsumir = cirurgia.status === "em_andamento";

  return <SectionPage
    eyebrow="Assistencial / Bloco Cirúrgico / Suprimentos"
    title={paciente?.nome_completo ?? "Suprimentos da cirurgia"}
    description={`${cirurgia.procedimento} · RA ${paciente?.ra ?? "—"} · ${label(cirurgia.status)}`}
    actions={<div className="flex flex-wrap gap-2"><Link href="/assistencial/centro-cirurgico/suprimentos" className="ui-button-secondary"><Boxes className="size-4"/>Todas as cirurgias</Link><Link href={`/assistencial/centro-cirurgico?cirurgia=${cirurgia.id}#cirurgia-${cirurgia.id}`} className="ui-button-secondary"><Scissors className="size-4"/>Fluxo cirúrgico</Link><Link href="/almoxarifado/requisicoes" className="ui-button-primary"><PackageCheck className="size-4"/>Fila do Almoxarifado</Link></div>}
  >
    {sp.sucesso ? <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700"><CheckCircle2 className="mr-2 inline size-4"/>Operação concluída: {label(sp.sucesso)}.</div> : null}
    {sp.erro ? <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700"><TriangleAlert className="mr-2 inline size-4"/>{decodeURIComponent(sp.erro)}</div> : null}
    {!temLocalBloco ? <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"><b>Nenhum estoque satélite/bloco cirúrgico foi identificado nesta unidade.</b> O sistema não cria um local fictício: selecione um local real já cadastrado ou cadastre a estrutura física adequada antes da operação.</div> : null}
    <div className="mb-5 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800"><b>Medicamentos não são baixados nesta tela.</b> A cadeia obrigatória permanece Prescrição → Farmácia → Dispensação → Enfermagem/Administração → Estoque. Aqui o consumo direto é restrito a material, OPME e gás medicinal.</div>

    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      <Kpi label="Requisições" value={requisicoes.length}/><Kpi label="Pendentes" value={requisicoes.filter((r) => !["recebida", "cancelada"].includes(r.status)).length}/><Kpi label="Transferências" value={transferencias.length}/><Kpi label="Consumos" value={consumos.length}/><Kpi label="Produção" value={producao.length}/>
    </section>

    <section className="his-card mt-5 p-5">
      <div><h2 className="font-black text-slate-950">1. Requisitar para a cirurgia</h2><p className="mt-1 text-sm text-slate-500">O pedido nasce ligado ao RA/cirurgia. O Almoxarifado separa por lote e transfere para o local de destino selecionado.</p></div>
      <form action={requisitarSuprimentosCirurgicosAction} className="mt-4 space-y-4">
        <input type="hidden" name="cirurgia_id" value={cirurgia.id}/>
        <div className="grid gap-3 md:grid-cols-3"><select name="local_destino_id" required defaultValue="" className="ui-input"><option value="">Local de destino *</option>{locais.map((item) => <option key={item.id} value={item.id}>{item.nome}{item.eh_farmacia ? " · Farmácia" : ""}</option>)}</select><select name="prioridade" defaultValue="normal" className="ui-input"><option value="normal">Normal</option><option value="alta">Alta</option><option value="urgente">Urgente</option></select><input name="justificativa" className="ui-input" placeholder="Justificativa / finalidade"/></div>
        <div className="overflow-x-auto rounded-xl border border-slate-200"><table className="min-w-[900px] w-full text-sm"><thead className="bg-slate-50 text-left text-xs uppercase text-slate-500"><tr><th className="px-3 py-2">#</th><th className="px-3 py-2">Produto</th><th className="px-3 py-2">Quantidade</th><th className="px-3 py-2">Observação</th></tr></thead><tbody>{Array.from({ length: 8 }, (_, i) => i + 1).map((n) => <tr key={n} className="border-t"><td className="px-3 py-2 font-bold text-slate-400">{n}</td><td className="px-3 py-2"><select name={`produto_${n}_id`} defaultValue="" className="ui-input"><option value="">Selecione</option>{produtos.map((p) => <option key={p.id} value={p.id}>{p.codigo} · {p.descricao} · {label(p.tipo)}{p.tipo === "medicamento" ? " · via Farmácia" : ""}</option>)}</select></td><td className="px-3 py-2"><input name={`produto_${n}_quantidade`} type="number" step="0.0001" min="0" className="ui-input w-32"/></td><td className="px-3 py-2"><input name={`produto_${n}_observacoes`} className="ui-input min-w-64"/></td></tr>)}</tbody></table></div>
        <div className="flex justify-end"><button className="ui-button-primary"><Boxes className="size-4"/>Enviar requisição</button></div>
      </form>
    </section>

    <section className="mt-5 space-y-4">
      <div><h2 className="text-lg font-black text-slate-950">2. Separação e recebimento</h2><p className="mt-1 text-sm text-slate-500">A separação ocorre na fila do Almoxarifado. Somente o Centro Cirúrgico confirma o recebimento das requisições cirúrgicas.</p></div>
      {requisicoes.length ? requisicoes.map((req) => {
        const reqItens = itensByReq.get(req.id) ?? [];
        const destino = localById.get(req.local_destino_id);
        return <article key={req.id} className="his-card overflow-hidden"><div className="flex flex-col gap-3 border-b border-slate-100 p-5 lg:flex-row lg:items-start lg:justify-between"><div><div className="flex flex-wrap items-center gap-2"><b className="text-slate-950">{req.numero}</b><span className={`rounded-full px-2.5 py-1 text-xs font-black uppercase ${statusClass(req.status)}`}>{label(req.status)}</span><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-black uppercase text-slate-600">{req.prioridade}</span></div><p className="mt-1 text-sm text-slate-600">Destino: {destino?.nome ?? "—"} · solicitada {fmt(req.solicitado_em)}</p>{req.justificativa ? <p className="mt-1 text-xs text-slate-500">{req.justificativa}</p> : null}</div>{req.status === "atendida" ? <form action={receberSuprimentosCirurgicosAction}><input type="hidden" name="cirurgia_id" value={cirurgia.id}/><input type="hidden" name="requisicao_id" value={req.id}/><button className="ui-button-primary"><CheckCircle2 className="size-4"/>Confirmar recebimento no bloco</button></form> : null}</div><div className="overflow-x-auto"><table className="min-w-[760px] w-full text-sm"><thead className="bg-slate-50 text-left text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">Produto</th><th className="px-4 py-3">Solicitado</th><th className="px-4 py-3">Atendido</th><th className="px-4 py-3">Status</th></tr></thead><tbody className="divide-y divide-slate-100">{reqItens.map((item) => { const produto = produtoById.get(item.produto_id); return <tr key={item.id}><td className="px-4 py-3"><b>{produto?.descricao ?? "Produto"}</b><div className="text-xs text-slate-400">{produto?.codigo ?? "—"}{item.observacoes ? ` · ${item.observacoes}` : ""}</div></td><td className="px-4 py-3">{Number(item.quantidade_solicitada)} {item.unidade_medida ?? produto?.unidade_medida ?? "UN"}</td><td className="px-4 py-3 font-bold">{Number(item.quantidade_atendida)}</td><td className="px-4 py-3 capitalize">{label(item.status)}</td></tr>; })}</tbody></table></div></article>;
      }) : <div className="his-card p-6 text-sm text-slate-500">Ainda não há requisições para esta cirurgia.</div>}
    </section>

    <section className="his-card mt-5 p-5">
      <div><h2 className="font-black text-slate-950">3. Consumir por lote no ato cirúrgico</h2><p className="mt-1 text-sm text-slate-500">O consumo exige cirurgia em andamento, lote disponível e produto físico real. Vincule o item da requisição sempre que o material veio de um pedido desta cirurgia.</p></div>
      {!podeConsumir ? <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">A baixa física fica habilitada somente quando a cirurgia está <b>em andamento</b>. Status atual: {label(cirurgia.status)}.</div> : <form action={consumirSuprimentoCirurgicoAction} className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <input type="hidden" name="cirurgia_id" value={cirurgia.id}/>
        <select name="estoque_lote_id" required defaultValue="" className="ui-input xl:col-span-2"><option value="">Lote / produto / local *</option>{lotesConsumiveis.map((lote) => { const p = produtoById.get(lote.produto_id); const local = localById.get(lote.local_id); return <option key={lote.id} value={lote.id}>{p?.codigo ?? "—"} · {p?.descricao ?? "Produto"} · {local?.nome ?? "Local"} · lote {lote.numero_lote ?? "s/lote"} · val. {fmtDate(lote.validade)} · saldo {Number(lote.quantidade)}</option>; })}</select>
        <input name="quantidade" type="number" min="0.0001" step="0.0001" required className="ui-input" placeholder="Quantidade *"/>
        <select name="requisicao_item_id" defaultValue="" className="ui-input"><option value="">Sem vínculo de requisição</option>{itensElegiveis.map((item) => { const p = produtoById.get(item.produto_id); const req = reqById.get(item.requisicao_id); return <option key={item.id} value={item.id}>{req?.numero ?? "Req."} · {p?.descricao ?? "Produto"} · atendido {Number(item.quantidade_atendida)}</option>; })}</select>
        <select name="opme_id" defaultValue="" className="ui-input"><option value="">OPME não planejada / não aplicável</option>{opmesPlanejadas.map((item) => <option key={item.id} value={item.id}>{item.item} · previsto {Number(item.quantidade)} · série {item.serie ?? "—"}</option>)}</select>
        <input name="serie" className="ui-input" placeholder="Série OPME, quando houver"/>
        <input name="observacoes" className="ui-input xl:col-span-2" placeholder="Observação do consumo"/>
        <div className="xl:col-span-4 flex justify-end"><button className="ui-button-primary"><PackageCheck className="size-4"/>Registrar consumo físico</button></div>
      </form>}
    </section>

    <section className="his-card mt-5 overflow-hidden">
      <div className="border-b border-slate-100 px-5 py-4"><h2 className="font-black text-slate-950">4. Movimentos e estornos</h2><p className="mt-1 text-sm text-slate-500">O saldo líquido considera as devoluções ligadas ao movimento original. OPME só pode ser estornada integralmente antes da conclusão.</p></div>
      <div className="overflow-x-auto"><table className="min-w-[1120px] w-full text-sm"><thead className="bg-slate-50 text-left text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">Movimento</th><th className="px-4 py-3">Produto / lote</th><th className="px-4 py-3">Quantidade</th><th className="px-4 py-3">Rastreio</th><th className="px-4 py-3">Ação</th></tr></thead><tbody className="divide-y divide-slate-100">{consumos.length ? consumos.map((mov) => { const p = produtoById.get(mov.produto_id); const devolvido = devolvidoByOrigem.get(mov.id) ?? 0; const restante = Math.max(Number(mov.quantidade) - devolvido, 0); const lote = lotes.find((item) => item.id === mov.lote_id); return <tr key={mov.id}><td className="px-4 py-3"><b>Consumo paciente</b><div className="text-xs text-slate-400">{fmt(mov.created_at)}</div></td><td className="px-4 py-3"><b>{p?.descricao ?? "Produto"}</b><div className="text-xs text-slate-400">{p?.codigo ?? "—"} · lote {lote?.numero_lote ?? mov.lote_id ?? "—"}</div></td><td className="px-4 py-3"><b>{Number(mov.quantidade)}</b><div className="text-xs text-slate-500">devolvido {devolvido} · líquido {restante}</div></td><td className="px-4 py-3 text-xs text-slate-500">Req. {mov.requisicao_setorial_id ? reqById.get(mov.requisicao_setorial_id)?.numero ?? mov.requisicao_setorial_id : "—"}<br/>OPME {mov.cirurgia_opme_id ?? "—"}</td><td className="px-4 py-3">{restante > 0 && !["concluida", "cancelada"].includes(cirurgia.status) ? <form action={estornarConsumoCirurgicoAction} className="flex min-w-[430px] gap-2"><input type="hidden" name="cirurgia_id" value={cirurgia.id}/><input type="hidden" name="movimento_id" value={mov.id}/><input name="quantidade" type="number" step="0.0001" min="0.0001" max={restante} defaultValue={restante} readOnly={Boolean(mov.cirurgia_opme_id)} className="ui-input w-28"/><input name="motivo" required className="ui-input flex-1" placeholder="Motivo do estorno *"/><button className="ui-button-secondary whitespace-nowrap"><RotateCcw className="size-4"/>Estornar</button></form> : <span className="text-xs font-bold text-slate-400">Sem ação disponível</span>}</td></tr>; }) : <tr><td colSpan={5} className="p-8 text-center text-sm text-slate-500">Nenhum consumo registrado nesta cirurgia.</td></tr>}</tbody></table></div>
    </section>

    <div className="mt-5 grid gap-5 xl:grid-cols-2">
      <section className="his-card overflow-hidden"><div className="border-b border-slate-100 px-5 py-4"><h2 className="font-black text-slate-950">OPME rastreada</h2><p className="mt-1 text-xs text-slate-500">“Utilizado” só é atingido pelo consumo físico de produto/lote; o cadastro textual isolado permanece apenas como planejamento.</p></div><div className="divide-y divide-slate-100">{opmes.length ? opmes.map((item) => <div key={item.id} className="p-4"><div className="flex items-center justify-between gap-3"><b>{item.item}</b><span className={`rounded-full px-2.5 py-1 text-xs font-black uppercase ${statusClass(item.status)}`}>{label(item.status)}</span></div><p className="mt-1 text-xs text-slate-500">Qtd. {Number(item.quantidade)} · código {item.codigo ?? "—"} · lote {item.lote ?? "—"} · série {item.serie ?? "—"}</p><p className="mt-1 text-xs text-slate-400">produto {item.produto_id ?? "—"} · lote FK {item.estoque_lote_id ?? "—"} · movimento {item.estoque_movimento_id ?? "—"}</p></div>) : <p className="p-6 text-sm text-slate-500">Nenhuma OPME planejada/utilizada.</p>}</div></section>
      <section className="his-card overflow-hidden"><div className="border-b border-slate-100 px-5 py-4"><h2 className="font-black text-slate-950">Livro de Produção</h2><p className="mt-1 text-xs text-slate-500">Material e gás entram com quantidade líquida quando a cirurgia é concluída. OPME mantém sua origem própria e rastreável.</p></div><div className="divide-y divide-slate-100">{producao.length ? producao.map((item) => <div key={item.id} className="p-4"><div className="flex items-center justify-between gap-3"><b className="capitalize">{label(item.tipo_evento)}</b><span className={`rounded-full px-2.5 py-1 text-xs font-black uppercase ${statusClass(item.status)}`}>{label(item.status)}</span></div><p className="mt-1 text-sm text-slate-600">{item.categoria_contratual} · qtd. {Number(item.quantidade)} · código {item.codigo_tuss_fallback ?? "—"}</p><p className="mt-1 text-xs text-slate-400">{item.origem_tipo} · {item.origem_id} · {fmt(item.ocorrido_em)}</p></div>) : <p className="p-6 text-sm text-slate-500">A produção de material/gás será registrada na conclusão da cirurgia quando houver consumo líquido válido.</p>}</div></section>
    </div>
  </SectionPage>;
}

function Kpi({ label: text, value }: { label: string; value: number }) { return <div className="his-kpi"><p className="text-xs font-black uppercase tracking-wider text-slate-400">{text}</p><p className="mt-2 text-3xl font-black text-slate-950">{value}</p></div>; }
