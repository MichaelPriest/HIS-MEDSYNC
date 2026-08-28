import Link from "next/link";
import { AlertTriangle, ArrowLeft, CheckCircle2, CircleDollarSign, PackageCheck, RotateCcw, ShieldCheck, XCircle } from "lucide-react";
import { notFound } from "next/navigation";
import { ActionPanel } from "@/components/painel/action-panel";
import { SectionPage } from "@/components/painel/section-page";
import { requireAnyPermission } from "@/lib/permissions/server";
import { adicionarFornecedorCotacao, aprovarFornecedorCotacao, gerarPedidoDaCotacao, reiniciarAprovacaoCotacao, rejeitarCotacaoCompra, salvarPropostaItemCotacao } from "@/modules/compras/actions";

function one<T>(value: T | T[] | null) { return Array.isArray(value) ? value[0] ?? null : value; }
const disponibilidadeLabel: Record<string, string> = { pronta_entrega: "Pronta entrega", parcial: "Parcial", sob_encomenda: "Sob encomenda", indisponivel: "Indisponível" };
const errorMessages: Record<string, string> = {
  "alcada-nao-configurada": "Não existe alçada ativa que cubra o valor desta proposta.",
  "fora-da-alcada": "Seu perfil não está autorizado a aprovar esta faixa de valor.",
  segregacao: "O solicitante da compra não pode aprovar nem emitir o próprio pedido.",
  "ja-decidiu": "Você já registrou sua decisão neste ciclo de aprovação.",
  "valor-alterado": "O valor da proposta mudou depois da aprovação. Reinicie o ciclo antes de emitir o pedido.",
  "aprovacao-insuficiente": "A quantidade de aprovações exigida pela alçada ainda não foi atingida.",
  "pedido-ja-emitido": "A cotação já possui pedido emitido.",
  aprovar: "Não foi possível registrar a aprovação.",
  rejeitar: "Não foi possível rejeitar a cotação.",
  reiniciar: "Não foi possível reiniciar a aprovação.",
  pedido: "Não foi possível gerar o pedido.",
};

function money(value: number | string | null | undefined) {
  return `R$ ${Number(value ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function dateTime(value: string | null | undefined) {
  return value ? new Date(value).toLocaleString("pt-BR") : "—";
}

export default async function CotacaoCompraPage({ params, searchParams }: {
  params: Promise<{ cotacaoId: string }>;
  searchParams: Promise<{ erro?: string; sucesso?: string }>;
}) {
  const { cotacaoId } = await params;
  const sp = await searchParams;
  const { supabase, user, empresaId, unidadeId } = await requireAnyPermission(["compras.visualizar", "compras.cotar", "compras.aprovar", "compras.gerenciar", "compras.receber"]);
  const [{ data: cotacao }, { data: fornecedores }, { data: fluxos }, { count: alcadasAtivas }, cotarGrant, aprovarGrant, gerenciarGrant] = await Promise.all([
    supabase.from("compras_cotacoes").select("id,numero,status,validade,observacoes,solicitacao_id,solicitacao:compras_solicitacoes(numero,setor,prioridade,solicitante_id),itens:compras_cotacao_itens(id,item_assistencial_id,categoria_item,codigo_interno,descricao,quantidade,unidade_medida,tabela_tiss_codigo,codigo_tuss,codigo_tabela_propria,codigo_brasindice,codigo_simpro,codigo_anvisa,fabricante,apresentacao,observacoes,propostas:compras_cotacao_item_propostas(id,fornecedor_id,quantidade_ofertada,valor_unitario,marca_ofertada,fabricante_ofertado,codigo_anvisa_ofertado,prazo_entrega_dias,disponibilidade,observacoes)),fornecedores:compras_cotacao_fornecedores(id,fornecedor_id,valor_total,prazo_entrega_dias,condicao_pagamento,frete,selecionado,observacoes,itens_cotados,itens_total,atualizado_em,fornecedor:fornecedores(nome_fantasia,razao_social))").eq("id", cotacaoId).eq("empresa_id", empresaId).eq("unidade_id", unidadeId).maybeSingle(),
    supabase.from("fornecedores").select("id,nome_fantasia,razao_social,cnpj").eq("empresa_id", empresaId).eq("ativo", true).order("nome_fantasia"),
    supabase.from("compras_cotacao_aprovacao_fluxos").select("id,versao,status,valor_total,aprovacoes_necessarias,iniciado_em,concluido_em,cancelado_motivo,fornecedor_id,alcada:compras_alcadas_aprovacao(nome,valor_min,valor_max),fornecedor:fornecedores(nome_fantasia,razao_social),aprovacoes:compras_cotacao_aprovacoes(id,aprovador_id,decisao,observacoes,created_at,aprovador:usuarios(nome),perfil:perfis(nome))").eq("cotacao_id", cotacaoId).eq("empresa_id", empresaId).eq("unidade_id", unidadeId).order("versao", { ascending: false }),
    supabase.from("compras_alcadas_aprovacao").select("id", { count: "exact", head: true }).eq("empresa_id", empresaId).eq("unidade_id", unidadeId).eq("ativo", true),
    supabase.rpc("tem_permissao", { p_empresa: empresaId, p_unidade: unidadeId, p_codigo: "compras.cotar" }),
    supabase.rpc("tem_permissao", { p_empresa: empresaId, p_unidade: unidadeId, p_codigo: "compras.aprovar" }),
    supabase.rpc("tem_permissao", { p_empresa: empresaId, p_unidade: unidadeId, p_codigo: "compras.gerenciar" }),
  ]);
  if (!cotacao) notFound();

  const canManage = gerenciarGrant.data === true;
  const canQuote = (cotarGrant.data === true || canManage) && ["aberta", "em_analise"].includes(cotacao.status);
  const canApprove = aprovarGrant.data === true;
  const solicitacao = one(cotacao.solicitacao);
  const itens = Array.isArray(cotacao.itens) ? cotacao.itens : [];
  const fornecedoresCotacao = Array.isArray(cotacao.fornecedores) ? cotacao.fornecedores : [];
  const selecionado = fornecedoresCotacao.find((item) => item.selecionado);
  const latestFlow = fluxos?.[0] ?? null;
  const decisoes = latestFlow && Array.isArray(latestFlow.aprovacoes) ? latestFlow.aprovacoes : [];
  const aprovadas = decisoes.filter((item) => item.decisao === "aprovada").length;
  const currentUserDecision = decisoes.find((item) => item.aprovador_id === user.id);
  const solicitanteEhUsuario = solicitacao?.solicitante_id === user.id;
  const fluxoPendente = latestFlow?.status === "pendente" && cotacao.status === "em_aprovacao";
  const melhorPreco = new Map<string, number>();
  for (const item of itens) {
    const propostas = Array.isArray(item.propostas) ? item.propostas : [];
    const precos = propostas.filter((p) => p.disponibilidade !== "indisponivel" && Number(p.quantidade_ofertada || 0) >= Number(item.quantidade)).map((p) => Number(p.valor_unitario)).filter((v) => Number.isFinite(v) && v >= 0);
    if (precos.length) melhorPreco.set(item.id, Math.min(...precos));
  }

  return <SectionPage eyebrow="Compras / Cotação" title={`${cotacao.numero} · Comparativo`} description={`Solicitação ${solicitacao?.numero || "—"} · ${solicitacao?.setor || "Sem setor"}. Compare preço, cobertura, marca, ANVISA e prazo por item; o compromisso financeiro depende da alçada formal.`} actions={<div className="flex gap-2"><Link href="/compras/alcadas" className="btn-secondary"><ShieldCheck className="size-4" />Alçadas</Link><Link href="/compras" className="btn-secondary"><ArrowLeft className="size-4" />Compras</Link></div>}>
    {sp.sucesso ? <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">Operação concluída: {sp.sucesso.replaceAll("-", " ")}.</div> : null}
    {sp.erro ? <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{errorMessages[sp.erro] || `Não foi possível concluir: ${sp.erro.replaceAll("-", " ")}.`}</div> : null}
    {solicitanteEhUsuario && canApprove ? <div className="mb-4 flex gap-3 rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-900"><ShieldCheck className="size-5 shrink-0" /><div><strong>Segregação de funções ativa.</strong><p className="mt-1">Você é o solicitante desta compra; pode acompanhar o fluxo, mas não pode aprová-la nem emitir o pedido.</p></div></div> : null}
    {!alcadasAtivas && ["aberta", "em_analise"].includes(cotacao.status) ? <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-amber-900"><div className="flex gap-3"><AlertTriangle className="mt-0.5 size-5 shrink-0" /><div><strong>Aprovação bloqueada.</strong><p className="mt-1 text-sm">Nenhuma alçada ativa está configurada nesta unidade. O sistema não presume limites financeiros.</p></div></div>{canManage ? <Link href="/compras/alcadas" className="btn-secondary">Configurar alçadas</Link> : null}</div> : null}

    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5"><Kpi label="Status" value={cotacao.status.replaceAll("_", " ")} /><Kpi label="Itens" value={String(itens.length)} /><Kpi label="Fornecedores" value={String(fornecedoresCotacao.length)} /><Kpi label="Completos" value={String(fornecedoresCotacao.filter((f) => f.itens_total > 0 && f.itens_cotados >= f.itens_total).length)} /><Kpi label="Aprovação" value={latestFlow ? `${aprovadas}/${latestFlow.aprovacoes_necessarias}` : "Não iniciada"} /></section>

    {latestFlow ? <section className="ui-card mt-5 overflow-hidden">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 bg-slate-50/70 px-5 py-4"><div><p className="text-xs font-black uppercase tracking-wider text-brand-700">Ciclo de aprovação · versão {latestFlow.versao}</p><h2 className="mt-1 font-black text-slate-950">{one(latestFlow.alcada)?.nome || "Alçada"} · {money(latestFlow.valor_total)}</h2><p className="mt-1 text-xs text-slate-500">Fornecedor congelado: {one(latestFlow.fornecedor)?.nome_fantasia || one(latestFlow.fornecedor)?.razao_social || "—"} · iniciado em {dateTime(latestFlow.iniciado_em)}</p></div><span className={`rounded-full px-3 py-1 text-xs font-black uppercase ${latestFlow.status === "aprovada" ? "bg-emerald-100 text-emerald-700" : latestFlow.status === "rejeitada" ? "bg-rose-100 text-rose-700" : latestFlow.status === "cancelada" ? "bg-slate-200 text-slate-600" : "bg-amber-100 text-amber-800"}`}>{latestFlow.status}</span></header>
      <div className="p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm font-black text-slate-900">{aprovadas} de {latestFlow.aprovacoes_necessarias} aprovações concluídas</p><p className="mt-1 text-xs text-slate-500">Cada usuário conta apenas uma vez. Perfis e valor são congelados quando o ciclo começa.</p></div>{currentUserDecision ? <span className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-bold text-slate-600">Sua decisão: {currentUserDecision.decisao}</span> : null}</div>
        <div className="mt-4 divide-y divide-slate-100 rounded-xl border border-slate-200">{decisoes.length ? decisoes.map((decisao) => <div key={decisao.id} className="flex flex-wrap items-center justify-between gap-3 p-3 text-sm"><div><strong>{one(decisao.aprovador)?.nome || "Usuário"}</strong><p className="text-xs text-slate-500">{one(decisao.perfil)?.nome || "Perfil"} · {dateTime(decisao.created_at)}</p>{decisao.observacoes ? <p className="mt-1 text-xs text-slate-600">{decisao.observacoes}</p> : null}</div><span className={`font-black ${decisao.decisao === "aprovada" ? "text-emerald-700" : "text-rose-700"}`}>{decisao.decisao === "aprovada" ? "Aprovou" : "Rejeitou"}</span></div>) : <p className="p-4 text-sm text-slate-500">Nenhuma decisão registrada.</p>}</div>
        {latestFlow.cancelado_motivo ? <p className="mt-3 rounded-xl bg-slate-100 p-3 text-sm text-slate-600"><strong>Motivo do reinício:</strong> {latestFlow.cancelado_motivo}</p> : null}
        {fluxoPendente && canApprove && !currentUserDecision && !solicitanteEhUsuario ? <form action={rejeitarCotacaoCompra} className="mt-4 flex flex-wrap gap-2"><input type="hidden" name="cotacao_id" value={cotacao.id} /><input name="observacoes" required minLength={5} className="ui-input min-w-64 flex-1" placeholder="Motivo obrigatório da rejeição" /><button className="btn-secondary border-rose-200 text-rose-700"><XCircle className="size-4" />Rejeitar cotação</button></form> : null}
        {canManage && ["em_aprovacao", "rejeitada", "aprovada"].includes(cotacao.status) ? <form action={reiniciarAprovacaoCotacao} className="mt-4 flex flex-wrap gap-2"><input type="hidden" name="cotacao_id" value={cotacao.id} /><input name="motivo" required minLength={5} className="ui-input min-w-64 flex-1" placeholder="Motivo para cancelar o ciclo e reabrir a análise" /><button className="btn-secondary"><RotateCcw className="size-4" />Reiniciar aprovação</button></form> : null}
      </div>
    </section> : null}

    {canQuote ? <div className="mt-5"><ActionPanel title="Adicionar fornecedor" description="Cadastre as condições gerais; os preços serão informados item a item."><form action={adicionarFornecedorCotacao} className="grid gap-3 lg:grid-cols-[1.4fr_120px_160px_180px_1fr_auto]"><input type="hidden" name="cotacao_id" value={cotacao.id} /><select name="fornecedor_id" required defaultValue="" className="ui-input"><option value="">Selecione o fornecedor</option>{fornecedores?.map((f) => <option key={f.id} value={f.id}>{f.nome_fantasia || f.razao_social}{f.cnpj ? ` · ${f.cnpj}` : ""}</option>)}</select><input name="frete" className="ui-input" placeholder="Frete" /><input name="prazo_entrega_dias" type="number" min="0" className="ui-input" placeholder="Prazo dias" /><input name="condicao_pagamento" className="ui-input" placeholder="Pagamento" /><input name="observacoes" className="ui-input" placeholder="Observações" /><button className="ui-button-primary">Adicionar</button></form></ActionPanel></div> : null}

    <section className="ui-card mt-5 overflow-hidden"><header className="border-b border-slate-100 px-5 py-4"><h2 className="font-black text-slate-900">Comparativo por fornecedor</h2><p className="mt-1 text-xs text-slate-500">A aprovação só pode iniciar com proposta completa. Depois de iniciada, fornecedor e valor ficam congelados para o ciclo.</p></header><div className="grid gap-4 p-5 lg:grid-cols-2 xl:grid-cols-3">{fornecedoresCotacao.length ? fornecedoresCotacao.map((f) => {
      const fornecedor = one(f.fornecedor);
      const completo = f.itens_total > 0 && f.itens_cotados >= f.itens_total;
      const total = Number(f.valor_total || 0) + Number(f.frete || 0);
      const isFlowSupplier = latestFlow?.fornecedor_id === f.fornecedor_id;
      const canStart = canApprove && !solicitanteEhUsuario && completo && ["aberta", "em_analise"].includes(cotacao.status) && !latestFlow;
      const canContinue = canApprove && !solicitanteEhUsuario && completo && fluxoPendente && isFlowSupplier && !currentUserDecision;
      return <article key={f.id} className={`rounded-2xl border p-4 ${f.selecionado || isFlowSupplier ? "border-emerald-300 bg-emerald-50" : "border-slate-200 bg-white"}`}><div className="flex items-start justify-between gap-3"><div><h3 className="font-black text-slate-900">{fornecedor?.nome_fantasia || fornecedor?.razao_social || "Fornecedor"}</h3><p className="mt-1 text-xs text-slate-500">Cobertura {f.itens_cotados}/{f.itens_total} · frete {money(f.frete)}</p></div>{f.selecionado || isFlowSupplier ? <CheckCircle2 className="size-5 text-emerald-600" /> : null}</div><p className="mt-4 text-2xl font-black text-slate-950">{money(total)}</p><p className={`mt-2 text-xs font-bold ${completo ? "text-emerald-700" : "text-amber-700"}`}>{completo ? "Proposta completa" : "Proposta incompleta"}</p>{canStart || canContinue ? <form action={aprovarFornecedorCotacao} className="mt-4"><input type="hidden" name="cotacao_id" value={cotacao.id} /><input type="hidden" name="fornecedor_id" value={f.fornecedor_id} /><button className="ui-button-primary w-full">{canContinue ? "Registrar minha aprovação" : "Iniciar aprovação e aprovar"}</button></form> : null}</article>;
    }) : <p className="text-sm text-slate-500">Nenhum fornecedor adicionado.</p>}</div></section>

    <section className="mt-5 space-y-4">{itens.map((item, index) => {
      const propostas = Array.isArray(item.propostas) ? item.propostas : [];
      const best = melhorPreco.get(item.id);
      return <article key={item.id} className="ui-card overflow-hidden"><header className="border-b border-slate-100 bg-slate-50/70 px-5 py-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wider text-brand-700">Item {index + 1} · {item.categoria_item.replaceAll("_", " ")}</p><h3 className="mt-1 font-black text-slate-900">{item.descricao}</h3><p className="mt-1 text-xs text-slate-500">{item.codigo_interno || "—"} · TISS {item.tabela_tiss_codigo || "—"} · {item.codigo_tuss ? `TUSS ${item.codigo_tuss}` : `próprio ${item.codigo_tabela_propria || "—"}`} · {Number(item.quantidade).toLocaleString("pt-BR")} {item.unidade_medida}</p><p className="mt-1 text-xs text-slate-400">{item.fabricante || "Fabricante não informado"}{item.apresentacao ? ` · ${item.apresentacao}` : ""} · ANVISA {item.codigo_anvisa || "—"} · Brasíndice {item.codigo_brasindice || "—"} · SIMPRO {item.codigo_simpro || "—"}</p></div>{best !== undefined ? <span className="rounded-xl bg-emerald-100 px-3 py-2 text-xs font-black text-emerald-800">Melhor {money(best)}</span> : null}</div></header><div className="grid gap-4 p-5 xl:grid-cols-2">{fornecedoresCotacao.map((fc) => {
        const fornecedor = one(fc.fornecedor);
        const prop = propostas.find((p) => p.fornecedor_id === fc.fornecedor_id);
        const valor = Number(prop?.valor_unitario || 0);
        const atendeQuantidade = Number(prop?.quantidade_ofertada || 0) >= Number(item.quantidade);
        const isBest = prop && atendeQuantidade && prop.disponibilidade !== "indisponivel" && best !== undefined && valor === best;
        return <div key={fc.id} className={`rounded-2xl border p-4 ${isBest ? "border-emerald-300 bg-emerald-50/60" : "border-slate-200"}`}><div className="flex items-center justify-between gap-3"><strong>{fornecedor?.nome_fantasia || fornecedor?.razao_social || "Fornecedor"}</strong>{isBest ? <span className="text-xs font-bold text-emerald-700">Melhor preço</span> : null}</div>{canQuote ? <form action={salvarPropostaItemCotacao} className="mt-3 grid gap-2 sm:grid-cols-2"><input type="hidden" name="cotacao_id" value={cotacao.id} /><input type="hidden" name="cotacao_item_id" value={item.id} /><input type="hidden" name="fornecedor_id" value={fc.fornecedor_id} /><input name="valor_unitario" defaultValue={prop ? String(prop.valor_unitario) : ""} className="ui-input" placeholder="Valor unitário" required /><input name="quantidade_ofertada" defaultValue={prop?.quantidade_ofertada ? String(prop.quantidade_ofertada) : String(item.quantidade)} className="ui-input" placeholder="Qtd. ofertada" /><input name="marca" defaultValue={prop?.marca_ofertada || ""} className="ui-input" placeholder="Marca ofertada" /><input name="fabricante" defaultValue={prop?.fabricante_ofertado || ""} className="ui-input" placeholder="Fabricante" /><input name="codigo_anvisa" defaultValue={prop?.codigo_anvisa_ofertado || ""} className="ui-input" placeholder="Registro ANVISA" /><input name="prazo_entrega_dias" type="number" min="0" defaultValue={prop?.prazo_entrega_dias ?? fc.prazo_entrega_dias ?? ""} className="ui-input" placeholder="Prazo dias" /><select name="disponibilidade" defaultValue={prop?.disponibilidade || "pronta_entrega"} className="ui-input">{Object.entries(disponibilidadeLabel).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select><input name="observacoes" defaultValue={prop?.observacoes || ""} className="ui-input" placeholder="Observação" /><button className="ui-button-primary sm:col-span-2">Salvar proposta do item</button></form> : <div className="mt-3 text-sm text-slate-600">{prop ? <><p className="font-bold">{money(valor)} / {item.unidade_medida}</p><p className="mt-1 text-xs">{disponibilidadeLabel[prop.disponibilidade] || prop.disponibilidade} · prazo {prop.prazo_entrega_dias ?? "—"} dias · quantidade {Number(prop.quantidade_ofertada || 0).toLocaleString("pt-BR")}</p><p className="mt-1 text-xs">{prop.marca_ofertada || "Marca não informada"} · ANVISA {prop.codigo_anvisa_ofertado || "—"}</p></> : "Sem proposta para este item."}</div>}</div>;
      })}</div></article>;
    })}</section>

    {selecionado && canApprove && !solicitanteEhUsuario && cotacao.status === "aprovada" && latestFlow?.status === "aprovada" ? <div className="mt-5"><ActionPanel title="Gerar pedido" description="Converte somente uma cotação formalmente aprovada em pedido. O banco revalida fornecedor, valor congelado e quantidade mínima de aprovadores antes de gravar."><form action={gerarPedidoDaCotacao} className="flex flex-wrap items-center justify-between gap-3"><input type="hidden" name="cotacao_id" value={cotacao.id} /><div className="flex items-center gap-3"><PackageCheck className="size-6 text-emerald-600" /><div><p className="font-bold text-slate-900">Aprovação formal concluída</p><p className="text-sm text-slate-500">{aprovadas}/{latestFlow.aprovacoes_necessarias} decisões favoráveis · valor aprovado {money(latestFlow.valor_total)}</p></div></div><button className="ui-button-primary"><CircleDollarSign className="size-4" />Gerar pedido de compra</button></form></ActionPanel></div> : null}
  </SectionPage>;
}

function Kpi({ label, value }: { label: string; value: string }) { return <div className="his-kpi"><p className="text-xs font-bold uppercase tracking-wider text-slate-400">{label}</p><p className="mt-2 text-2xl font-black capitalize text-slate-950">{value}</p></div>; }
