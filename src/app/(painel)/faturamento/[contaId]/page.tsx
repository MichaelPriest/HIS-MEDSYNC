import Link from "next/link";
import {
  AlertTriangle,
  BadgeCheck,
  Building2,
  Calculator,
  ClipboardList,
  FileCheck2,
  Layers3,
  Plus,
  ReceiptText,
  RefreshCcw,
  Save,
  ShieldCheck,
  Trash2,
  UserRound,
} from "lucide-react";
import { notFound } from "next/navigation";
import { SectionPage } from "@/components/painel/section-page";
import { createClient } from "@/lib/supabase/server";
import { gerarGuiaTiss } from "@/modules/faturamento/actions";
import { atualizarGrupoAto, criarGrupoAto, recalcularGrupoAto } from "@/modules/faturamento/atos-actions";
import {
  atualizarResumoConta,
  excluirLancamentoConta,
  recalcularPrecosConta,
  salvarLancamentoConta,
  sincronizarProducaoConta,
  validarContaTissOperacional,
} from "@/modules/faturamento/conta-operacional-actions";

function one<T>(rel: T | T[] | null): T | null { return Array.isArray(rel) ? rel[0] ?? null : rel; }
function brl(v: number | null | undefined) { return `R$ ${Number(v ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`; }
function dt(value: string | null | undefined) { return value ? new Date(value).toLocaleString("pt-BR") : "—"; }
function d(value: string | null | undefined) { return value ? new Date(`${value.slice(0, 10)}T12:00:00`).toLocaleDateString("pt-BR") : "—"; }
function localInput(value: string | null | undefined) {
  if (!value) return "";
  const date = new Date(value);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

const tipoLabels: Record<string, string> = {
  procedimento: "Procedimento",
  medicamento: "Medicamento",
  material: "Material",
  opme: "OPME",
  taxa: "Taxa",
  diaria: "Diária",
  honorario: "Honorário",
  laboratorio: "Laboratório",
  imagem: "Imagem",
  pacote: "Pacote",
  gas_medicinal: "Gás medicinal",
  outro: "Outro",
};

const erroLabels: Record<string, string> = {
  "guia-tiss-ativa": "A conta já possui Guia TISS ativa. Cancele ou trate a guia antes de alterar os lançamentos da conta.",
  "conta-nao-editavel": "A conta já não permite alteração de lançamentos.",
  "acesso-negado": "Seu perfil não possui permissão para alterar esta conta.",
  "quantidade-invalida": "A quantidade do lançamento deve ser maior que zero.",
  "valor-invalido": "O valor unitário informado é inválido.",
  "percentual-invalido": "O percentual de redução/acréscimo informado é inválido.",
  "desconto-invalido": "O desconto não pode ser maior que o valor bruto da conta.",
  "sincronizacao-producao": "Não foi possível sincronizar a produção assistencial deste atendimento.",
  "recalculo-contratual": "Não foi possível recalcular os valores contratuais da conta.",
  "validacao-tiss": "Não foi possível executar a validação TISS da conta.",
  lancamento: "Não foi possível salvar o lançamento. Revise os campos e tente novamente.",
};

const sucessoLabels: Record<string, string> = {
  "item-adicionado": "Lançamento incluído e totais recalculados.",
  "item-atualizado": "Lançamento atualizado e conta marcada para nova validação.",
  "item-excluido": "Lançamento excluído e totais recalculados.",
  "resumo-atualizado": "Competência/desconto atualizados.",
  "producao-sincronizada": "Produção assistencial sincronizada com a conta.",
  "precos-recalculados": "Regras contratuais recalculadas.",
  "conta-validada": "Validação TISS executada no banco. Revise as críticas abaixo.",
};

export default async function ContaPage({ params, searchParams }: { params: Promise<{ contaId: string }>; searchParams: Promise<{ erro?: string; sucesso?: string }> }) {
  const { contaId } = await params;
  const qs = await searchParams;
  const supabase = await createClient();

  const { data: conta } = await supabase
    .from("contas_faturamento")
    .select("id,empresa_id,unidade_id,atendimento_id,paciente_id,convenio_id,plano_id,competencia,tipo_cobranca,status,valor_bruto,valor_desconto,valor_liquido,auditoria_liberada,contas_medicas_liberada,created_at,updated_at,atendimento:atendimentos(numero_atendimento,data_abertura,data_fechamento,status,numero_carteirinha,validade_carteirinha,cobertura,numero_autorizacao,senha_autorizacao,tipo_atendimento,atendimento_rn,profissional_id),paciente:pacientes(nome_completo,ra,numero_registro,cns,cpf),convenio:convenios(nome_fantasia,registro_ans),plano:convenio_planos(nome)")
    .eq("id", contaId)
    .maybeSingle();
  if (!conta) notFound();

  const paciente = one(conta.paciente);
  const atendimento = one(conta.atendimento);
  const convenio = one(conta.convenio);
  const plano = one(conta.plano);

  const [itensRes, criticasRes, gruposRes, authRes, centralGuiasRes, tissGuiasRes, producaoRes, internacaoRes, profissionalRes] = await Promise.all([
    supabase.from("conta_faturamento_itens").select("id,origem_tipo,item_assistencial_id,data_execucao,tabela,codigo,descricao,quantidade,valor_unitario,percentual_reducao_acrescimo,valor_total,setor,cobravel,observacao,grupo_ato_id,sequencia_ato,via_acesso,urgencia,horario_especial,acomodacao_individual,anestesia,numero_auxiliares,filme_m2,percentual_aplicado,valor_contratual_calculado,valor_referencia,origem_valor,metodologia_preco,divergencia_valor_contratual,created_at").eq("conta_id", contaId).order("created_at"),
    supabase.from("conta_faturamento_criticas").select("id,item_id,codigo,severidade,campo,mensagem,origem,resolvida,created_at").eq("conta_id", contaId).order("created_at", { ascending: false }),
    supabase.from("conta_faturamento_grupos_ato").select("id,codigo_grupo,data_ato,via_acesso,acomodacao,urgencia,horario_especial,observacoes").eq("conta_id", contaId).order("data_ato"),
    supabase.from("autorizacoes_atendimento").select("id,numero_guia_prestador,numero_guia_operadora,senha_autorizacao,validade,status,observacao,created_at").eq("atendimento_id", conta.atendimento_id).order("created_at", { ascending: false }),
    supabase.from("central_guias").select("id,tipo,numero_guia_prestador,numero_guia_operadora,senha,validade_senha,protocolo,data_solicitacao,data_retorno,status,quantidade_solicitada,quantidade_autorizada,codigo_procedimento,descricao_procedimento,valor_solicitado,valor_autorizado").eq("atendimento_id", conta.atendimento_id).order("created_at", { ascending: false }),
    supabase.from("tiss_guias").select("id,numero_guia_prestador,numero_guia_operadora,tipo_guia,status,valor_total,validado_em,created_at").eq("conta_id", contaId).order("created_at", { ascending: false }),
    supabase.from("procedimentos_assistenciais").select("id,area,codigo_tuss,codigo_interno,procedimento,quantidade,unidade_medida,executado_em,local_execucao,status,profissional:profissionais(nome_completo)").eq("atendimento_id", conta.atendimento_id).order("executado_em", { ascending: false }).limit(30),
    supabase.from("internacoes").select("id,acomodacao,motivo,data_internacao,data_alta,status,leito_id").eq("atendimento_id", conta.atendimento_id).order("data_internacao", { ascending: false }).limit(1).maybeSingle(),
    atendimento?.profissional_id ? supabase.from("profissionais").select("id,nome_completo,conselho,numero_conselho,uf_conselho,cbo,especialidade").eq("id", atendimento.profissional_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);

  const itens = itensRes.data ?? [];
  const criticas = criticasRes.data ?? [];
  const grupos = gruposRes.data ?? [];
  const autorizacoes = authRes.data ?? [];
  const centralGuias = centralGuiasRes.data ?? [];
  const tissGuias = tissGuiasRes.data ?? [];
  const producao = producaoRes.data ?? [];
  const internacao = internacaoRes.data;
  const profissional = profissionalRes.data;
  const guiaTissAtiva = tissGuias.find((g) => g.status !== "cancelada") ?? null;
  const erros = criticas.filter((c) => !c.resolvida && c.severidade === "erro").length;
  const alertas = criticas.filter((c) => !c.resolvida && c.severidade === "alerta").length;
  const totalItens = itens.filter((i) => i.cobravel).reduce((sum, item) => sum + Number(item.valor_total ?? 0), 0);

  const salvarItem = salvarLancamentoConta.bind(null, contaId);
  const excluirItem = excluirLancamentoConta.bind(null, contaId);
  const salvarResumo = atualizarResumoConta.bind(null, contaId);
  const sincronizar = sincronizarProducaoConta.bind(null, contaId);
  const recalcular = recalcularPrecosConta.bind(null, contaId);
  const validar = validarContaTissOperacional.bind(null, contaId);
  const gerarGuia = gerarGuiaTiss.bind(null, contaId);
  const novoGrupo = criarGrupoAto.bind(null, contaId);
  const salvarGrupo = atualizarGrupoAto.bind(null, contaId);
  const recalcularGrupo = recalcularGrupoAto.bind(null, contaId);

  return <SectionPage
    eyebrow="Ciclo da receita / Faturamento / Conta hospitalar"
    title={paciente?.nome_completo ?? "Conta hospitalar"}
    description={`Atendimento #${atendimento?.numero_atendimento ?? "—"} · Registro #${paciente?.numero_registro ?? "—"} · ${paciente?.ra ?? "—"}`}
    actions={<div className="flex flex-wrap gap-2"><Link href="/faturamento" className="ui-button-secondary">Voltar à fila</Link><Link href={`/faturamento/${contaId}/catalogo`} className="ui-button-primary"><Plus className="size-4"/>Catálogo de itens</Link></div>}
  >
    {qs.erro ? <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{erroLabels[qs.erro] ?? `Não foi possível processar a operação: ${qs.erro}.`}</div> : null}
    {qs.sucesso ? <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{sucessoLabels[qs.sucesso] ?? "Operação concluída."}</div> : null}

    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
      <Kpi label="Status da conta" value={conta.status.replaceAll("_", " ")} />
      <Kpi label="Competência" value={conta.competencia} />
      <Kpi label="Valor bruto" value={brl(conta.valor_bruto)} />
      <Kpi label="Desconto" value={brl(conta.valor_desconto)} />
      <Kpi label="Valor líquido" value={brl(conta.valor_liquido)} />
    </div>

    <nav className="mt-5 flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white p-3 text-sm font-semibold shadow-sm">
      <a href="#conta" className="ui-button-secondary">Conta</a>
      <a href="#lancamentos" className="ui-button-secondary">Lançamentos ({itens.length})</a>
      <a href="#producao" className="ui-button-secondary">Produção ({producao.length})</a>
      <a href="#autorizacoes" className="ui-button-secondary">Guias/Autorizações</a>
      <a href="#atos" className="ui-button-secondary">Atos/SADT</a>
      <a href="#criticas" className="ui-button-secondary">Críticas ({erros + alertas})</a>
    </nav>

    <section id="conta" className="mt-5 grid gap-5 xl:grid-cols-[1fr_1fr]">
      <article className="ui-card p-5">
        <div className="flex items-center gap-3"><UserRound className="size-5 text-brand-700"/><div><h2 className="font-bold text-slate-900">Paciente e atendimento</h2><p className="text-xs text-slate-500">Contexto único do episódio, sempre visível no faturamento.</p></div></div>
        <dl className="mt-4 grid gap-3 sm:grid-cols-2">
          <Row label="Paciente" value={paciente?.nome_completo}/><Row label="CPF" value={paciente?.cpf}/>
          <Row label="RA" value={paciente?.ra}/><Row label="CNS" value={paciente?.cns}/>
          <Row label="Atendimento" value={String(atendimento?.numero_atendimento ?? "—")}/><Row label="Tipo" value={atendimento?.tipo_atendimento}/>
          <Row label="Abertura" value={dt(atendimento?.data_abertura)}/><Row label="Fechamento" value={dt(atendimento?.data_fechamento)}/>
          <Row label="Atendimento RN" value={atendimento?.atendimento_rn ? "Sim" : "Não"}/><Row label="Internação" value={internacao ? `${internacao.status} · ${internacao.acomodacao ?? "sem acomodação"}` : "Não"}/>
        </dl>
        {profissional ? <div className="mt-4 rounded-xl bg-slate-50 p-4 text-sm"><b>{profissional.nome_completo}</b><p className="mt-1 text-slate-500">{[profissional.conselho, profissional.numero_conselho, profissional.uf_conselho].filter(Boolean).join(" ")} · CBO {profissional.cbo ?? "—"} · {profissional.especialidade ?? "Especialidade não informada"}</p></div> : null}
      </article>

      <article className="ui-card p-5">
        <div className="flex items-center gap-3"><Building2 className="size-5 text-brand-700"/><div><h2 className="font-bold text-slate-900">Convênio e autorização</h2><p className="text-xs text-slate-500">Dados que alimentam autorização, conta e Guia TISS.</p></div></div>
        <dl className="mt-4 grid gap-3 sm:grid-cols-2">
          <Row label="Cobertura" value={conta.tipo_cobranca === "convenio" ? convenio?.nome_fantasia : "Particular"}/>
          <Row label="Plano" value={plano?.nome}/><Row label="Registro ANS" value={convenio?.registro_ans}/>
          <Row label="Carteirinha" value={atendimento?.numero_carteirinha}/><Row label="Validade" value={d(atendimento?.validade_carteirinha)}/>
          <Row label="Nº autorização" value={atendimento?.numero_autorizacao}/><Row label="Senha" value={atendimento?.senha_autorizacao}/>
          <Row label="Auditoria" value={conta.auditoria_liberada ? "Liberada" : "Pendente"}/><Row label="Contas Médicas" value={conta.contas_medicas_liberada ? "Liberada" : "Pendente"}/>
        </dl>
        <form action={salvarResumo} className="mt-4 grid gap-3 rounded-xl border border-slate-200 p-4 sm:grid-cols-[1fr_1fr_auto]">
          <label className="text-xs font-semibold text-slate-600">Competência<input type="month" name="competencia" defaultValue={conta.competencia} className="ui-input mt-1"/></label>
          <label className="text-xs font-semibold text-slate-600">Desconto em valor<input name="valor_desconto" defaultValue={Number(conta.valor_desconto ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })} className="ui-input mt-1" inputMode="decimal"/></label>
          <button className="ui-button-secondary self-end"><Save className="size-4"/>Salvar</button>
        </form>
      </article>
    </section>

    <section className="ui-card mt-5 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="font-bold text-slate-900">Ações da conta</h2><p className="text-xs text-slate-500">Fluxo equivalente ao trabalho operacional: sincronizar, conferir preço, validar e só então gerar guia.</p></div>
        <div className="flex flex-wrap gap-2">
          <form action={sincronizar}><button className="ui-button-secondary"><RefreshCcw className="size-4"/>Sincronizar produção</button></form>
          <form action={recalcular}><button className="ui-button-secondary"><Calculator className="size-4"/>Recalcular contrato</button></form>
          <form action={validar}><button className="ui-button-primary"><ShieldCheck className="size-4"/>Validar conta TISS</button></form>
          {guiaTissAtiva ? <Link href={`/faturamento/guias/${guiaTissAtiva.id}`} className="ui-button-secondary"><FileCheck2 className="size-4"/>Abrir Guia TISS</Link> : conta.status === "pronta" && conta.tipo_cobranca === "convenio" ? <form action={gerarGuia}><button className="ui-button-primary"><FileCheck2 className="size-4"/>Gerar Guia TISS</button></form> : null}
        </div>
      </div>
    </section>

    <section id="lancamentos" className="ui-card mt-6 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <div className="flex items-center gap-3"><ReceiptText className="size-5 text-brand-700"/><div><h2 className="font-bold text-slate-900">Lançamentos da conta</h2><p className="text-sm text-slate-500">Itens gravados no banco. Alterações recalculam os totais e invalidam a validação anterior.</p></div></div>
        <div className="text-right"><p className="text-xs text-slate-500">Total cobravel dos itens</p><strong className="text-lg text-slate-950">{brl(totalItens)}</strong></div>
      </div>

      <form action={salvarItem} className="border-b border-slate-100 bg-slate-50/60 p-5">
        <div className="mb-3 flex items-center justify-between gap-3"><div><h3 className="font-semibold text-slate-900">Novo lançamento</h3><p className="text-xs text-slate-500">Para códigos cadastrados, prefira o Catálogo de itens; lançamento manual permanece disponível para operação controlada.</p></div><Link href={`/faturamento/${contaId}/catalogo`} className="ui-button-secondary">Pesquisar catálogo</Link></div>
        <input type="hidden" name="cobravel_presente" value="1"/>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          <select name="origem_tipo" className="ui-input"><option value="procedimento">Procedimento</option><option value="medicamento">Medicamento</option><option value="material">Material</option><option value="opme">OPME</option><option value="taxa">Taxa</option><option value="diaria">Diária</option><option value="honorario">Honorário</option><option value="laboratorio">Laboratório</option><option value="imagem">Imagem</option><option value="pacote">Pacote</option><option value="outro">Outro</option></select>
          <input name="tabela" className="ui-input" placeholder="Tabela TISS"/>
          <input name="codigo" className="ui-input" placeholder="Código"/>
          <input type="datetime-local" name="data_execucao" className="ui-input"/>
          <input name="quantidade" defaultValue="1" className="ui-input" inputMode="decimal" placeholder="Quantidade"/>
          <input name="valor_unitario" defaultValue="0,00" className="ui-input" inputMode="decimal" placeholder="Valor unitário"/>
          <input name="descricao" required className="ui-input md:col-span-2 xl:col-span-3" placeholder="Descrição do item"/>
          <input name="setor" className="ui-input" placeholder="Setor/origem"/>
          <input name="percentual_reducao_acrescimo" defaultValue="0" className="ui-input" inputMode="decimal" placeholder="% redução/acréscimo"/>
          <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm"><input type="checkbox" name="cobravel" defaultChecked/>Cobravel</label>
          <input name="observacao" className="ui-input md:col-span-2 xl:col-span-5" placeholder="Observação do lançamento"/>
          <button className="ui-button-primary"><Plus className="size-4"/>Adicionar</button>
        </div>
      </form>

      <div className="divide-y divide-slate-100">
        {itens.length ? itens.map((item) => <form action={salvarItem} key={item.id} className="p-5">
          <input type="hidden" name="item_id" value={item.id}/><input type="hidden" name="origem_tipo" value={item.origem_tipo}/><input type="hidden" name="cobravel_presente" value="1"/>
          <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
            <div><div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">{tipoLabels[item.origem_tipo] ?? item.origem_tipo}</span>{item.cobravel ? <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">Cobravel</span> : <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">Não cobravel</span>}</div><p className="mt-2 text-xs text-slate-500">Origem do valor: {item.origem_valor ?? "—"} · {item.metodologia_preco ?? "sem regra contratual"}</p></div>
            <div className="text-right"><p className="text-xs text-slate-500">Total lançado</p><strong>{brl(item.valor_total)}</strong><p className="text-xs text-slate-400">Contratual {item.valor_contratual_calculado == null ? "pendente" : brl(item.valor_contratual_calculado)}</p></div>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-8">
            <input name="descricao" defaultValue={item.descricao} required className="ui-input md:col-span-2 xl:col-span-2" aria-label="Descrição"/>
            <input name="tabela" defaultValue={item.tabela ?? ""} className="ui-input" placeholder="Tabela"/>
            <input name="codigo" defaultValue={item.codigo ?? ""} className="ui-input" placeholder="Código"/>
            <input type="datetime-local" name="data_execucao" defaultValue={localInput(item.data_execucao)} className="ui-input"/>
            <input name="quantidade" defaultValue={String(item.quantidade)} className="ui-input" inputMode="decimal" placeholder="Qtd."/>
            <input name="valor_unitario" defaultValue={Number(item.valor_unitario ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })} className="ui-input" inputMode="decimal" placeholder="Valor unit."/>
            <input name="percentual_reducao_acrescimo" defaultValue={String(item.percentual_reducao_acrescimo ?? 0)} className="ui-input" inputMode="decimal" placeholder="%"/>
            <input name="setor" defaultValue={item.setor ?? ""} className="ui-input" placeholder="Setor"/>
            <select name="grupo_ato_id" defaultValue={item.grupo_ato_id ?? ""} className="ui-input"><option value="">Sem grupo/ato</option>{grupos.map((g) => <option key={g.id} value={g.id}>{g.codigo_grupo}</option>)}</select>
            <input name="sequencia_ato" defaultValue={item.sequencia_ato ?? ""} className="ui-input" placeholder="Seq. ato"/>
            <input name="via_acesso" defaultValue={item.via_acesso ?? ""} className="ui-input" placeholder="Via acesso"/>
            <input name="numero_auxiliares" defaultValue={item.numero_auxiliares ?? 0} className="ui-input" placeholder="Auxiliares"/>
            <input name="filme_m2" defaultValue={item.filme_m2 ?? 0} className="ui-input" placeholder="Filme m²"/>
            <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 px-3 py-2 text-xs xl:col-span-2"><label className="flex items-center gap-1"><input type="checkbox" name="cobravel" defaultChecked={item.cobravel}/>Cobravel</label><label className="flex items-center gap-1"><input type="checkbox" name="urgencia" defaultChecked={item.urgencia}/>Urgência</label><label className="flex items-center gap-1"><input type="checkbox" name="horario_especial" defaultChecked={item.horario_especial}/>Horário especial</label><label className="flex items-center gap-1"><input type="checkbox" name="acomodacao_individual" defaultChecked={item.acomodacao_individual}/>Acomod. individual</label><label className="flex items-center gap-1"><input type="checkbox" name="anestesia" defaultChecked={item.anestesia}/>Anestesia</label></div>
            <input name="observacao" defaultValue={item.observacao ?? ""} className="ui-input md:col-span-2 xl:col-span-5" placeholder="Observação"/>
            <label className="flex items-center gap-2 text-xs text-slate-600"><input type="checkbox" name="recalcular_contrato" defaultChecked/>Recalcular contrato</label>
            <div className="flex justify-end gap-2 xl:col-span-2"><button className="ui-button-secondary"><Save className="size-4"/>Salvar</button><button formAction={excluirItem} className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-100"><Trash2 className="size-4"/>Excluir</button></div>
          </div>
        </form>) : <p className="p-8 text-center text-sm text-slate-500">Nenhum lançamento na conta.</p>}
      </div>
    </section>

    <section id="producao" className="ui-card mt-6 overflow-hidden">
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4"><div className="flex items-center gap-3"><ClipboardList className="size-5 text-brand-700"/><div><h2 className="font-bold text-slate-900">Produção assistencial do atendimento</h2><p className="text-sm text-slate-500">Registros clínico-operacionais que podem originar cobrança; não são duplicados manualmente.</p></div></div><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{producao.length} exibido(s)</span></div>
      {producao.length ? <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">Execução</th><th className="px-4 py-3">Área</th><th className="px-4 py-3">Código</th><th className="px-4 py-3">Procedimento</th><th className="px-4 py-3">Profissional</th><th className="px-4 py-3 text-right">Qtd.</th><th className="px-4 py-3">Status</th></tr></thead><tbody className="divide-y divide-slate-100">{producao.map((p) => { const prof = one(p.profissional); return <tr key={p.id}><td className="px-4 py-3 text-slate-500">{dt(p.executado_em)}</td><td className="px-4 py-3">{p.area}</td><td className="px-4 py-3 font-mono text-xs">{p.codigo_tuss ?? p.codigo_interno ?? "—"}</td><td className="px-4 py-3 font-medium">{p.procedimento}<div className="text-xs text-slate-400">{p.local_execucao ?? ""}</div></td><td className="px-4 py-3">{prof?.nome_completo ?? "—"}</td><td className="px-4 py-3 text-right">{Number(p.quantidade)}</td><td className="px-4 py-3">{p.status}</td></tr>; })}</tbody></table></div> : <p className="p-6 text-sm text-slate-500">Nenhum procedimento assistencial encontrado neste episódio.</p>}
    </section>

    <section id="autorizacoes" className="mt-6 grid gap-5 xl:grid-cols-2">
      <article className="ui-card overflow-hidden"><div className="border-b border-slate-100 px-5 py-4"><h2 className="font-bold text-slate-900">Autorizações do atendimento</h2><p className="text-sm text-slate-500">Senha, validade e números de guia usados pelo faturamento.</p></div>{autorizacoes.length ? <div className="divide-y divide-slate-100">{autorizacoes.map((a) => <div key={a.id} className="p-4"><div className="flex items-center justify-between gap-3"><b>{a.numero_guia_operadora ?? a.numero_guia_prestador ?? "Autorização"}</b><span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold">{a.status}</span></div><p className="mt-2 text-xs text-slate-500">Senha {a.senha_autorizacao ?? "—"} · validade {d(a.validade)} · prestador {a.numero_guia_prestador ?? "—"}</p>{a.observacao ? <p className="mt-2 text-sm text-slate-600">{a.observacao}</p> : null}</div>)}</div> : <p className="p-6 text-sm text-slate-500">Nenhuma autorização registrada.</p>}</article>
      <article className="ui-card overflow-hidden"><div className="border-b border-slate-100 px-5 py-4"><h2 className="font-bold text-slate-900">Central de Guias / TISS</h2><p className="text-sm text-slate-500">Solicitação/autorização operacional e guia faturável vinculadas ao mesmo episódio.</p></div><div className="divide-y divide-slate-100">{centralGuias.map((g) => <div key={g.id} className="p-4"><div className="flex items-center justify-between"><b>{g.tipo.replaceAll("_", " ")}</b><span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold">{g.status}</span></div><p className="mt-1 text-xs text-slate-500">Guia prestador {g.numero_guia_prestador ?? "—"} · operadora {g.numero_guia_operadora ?? "—"} · senha {g.senha ?? "—"}</p>{g.descricao_procedimento ? <p className="mt-2 text-sm">{g.codigo_procedimento ?? "—"} · {g.descricao_procedimento}</p> : null}</div>)}{tissGuias.map((g) => <Link href={`/faturamento/guias/${g.id}`} key={g.id} className="block p-4 hover:bg-slate-50"><div className="flex items-center justify-between"><b>Guia TISS {g.numero_guia_prestador}</b><span className="rounded-full bg-brand-50 px-2 py-1 text-xs font-semibold text-brand-700">{g.status}</span></div><p className="mt-1 text-xs text-slate-500">{g.tipo_guia.replaceAll("_", " ")} · {brl(g.valor_total)} · validada {dt(g.validado_em)}</p></Link>)}{!centralGuias.length && !tissGuias.length ? <p className="p-6 text-sm text-slate-500">Nenhuma guia vinculada ao atendimento.</p> : null}</div></article>
    </section>

    <section id="atos" className="ui-card mt-6 p-5">
      <div className="flex items-center gap-3"><Layers3 className="size-5 text-brand-700"/><div><h2 className="font-bold text-slate-900">Atos cirúrgicos / SADT</h2><p className="text-sm text-slate-500">Agrupe itens do mesmo ato para sequência, via, acomodação, urgência e cálculo contratual.</p></div></div>
      <form action={novoGrupo} className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-6"><input name="codigo_grupo" required className="ui-input" placeholder="Ex.: CIR-001"/><input type="date" name="data_ato" className="ui-input"/><input name="via_acesso" className="ui-input" placeholder="Via principal"/><select name="acomodacao" className="ui-input"><option value="">Acomodação</option><option value="enfermaria">Enfermaria</option><option value="apartamento">Apartamento</option><option value="uti">UTI</option></select><label className="flex items-center gap-2 text-sm"><input type="checkbox" name="urgencia"/>Urgência</label><label className="flex items-center gap-2 text-sm"><input type="checkbox" name="horario_especial"/>Horário especial</label><input name="observacoes" className="ui-input md:col-span-2 xl:col-span-5" placeholder="Observações do ato"/><button className="ui-button-primary">Criar grupo</button></form>
      <div className="mt-5 space-y-4">{grupos.length ? grupos.map((g) => { const membros = itens.filter((i) => i.grupo_ato_id === g.id).sort((a, b) => Number(a.sequencia_ato ?? 99) - Number(b.sequencia_ato ?? 99)); return <article key={g.id} className="rounded-2xl border border-slate-200 p-4"><form action={salvarGrupo} className="grid gap-3 lg:grid-cols-[1fr_140px_160px_160px_auto_auto_auto]"><input type="hidden" name="grupo_ato_id" value={g.id}/><div><b>{g.codigo_grupo}</b><p className="text-xs text-slate-400">{membros.length} item(ns)</p></div><input type="date" name="data_ato" defaultValue={g.data_ato ?? ""} className="ui-input"/><input name="via_acesso" defaultValue={g.via_acesso ?? ""} className="ui-input" placeholder="Via"/><select name="acomodacao" defaultValue={g.acomodacao ?? ""} className="ui-input"><option value="">Acomodação</option><option value="enfermaria">Enfermaria</option><option value="apartamento">Apartamento</option><option value="uti">UTI</option></select><label className="flex items-center gap-2 text-sm"><input type="checkbox" name="urgencia" defaultChecked={g.urgencia}/>Urgência</label><label className="flex items-center gap-2 text-sm"><input type="checkbox" name="horario_especial" defaultChecked={g.horario_especial}/>Especial</label><button className="ui-button-secondary">Salvar ato</button></form><div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 p-3 text-sm"><span>{membros.map((i) => `${i.sequencia_ato ?? "—"}. ${i.codigo ?? "—"} ${i.descricao}`).join(" · ") || "Sem itens vinculados"}</span><form action={recalcularGrupo}><input type="hidden" name="grupo_ato_id" value={g.id}/><button className="ui-button-secondary">Recalcular grupo</button></form></div></article>; }) : <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">Nenhum ato agrupado.</p>}</div>
    </section>

    <section id="criticas" className="ui-card mt-6 p-5">
      <div className="flex items-center justify-between gap-3"><div><h2 className="font-bold text-slate-900">Críticas e pendências</h2><p className="text-sm text-slate-500">{erros} erro(s) impeditivo(s) · {alertas} alerta(s). A validação é executada no Supabase e não somente na tela.</p></div>{erros ? <AlertTriangle className="size-6 text-rose-600"/> : <BadgeCheck className="size-6 text-emerald-600"/>}</div>
      <div className="mt-4 grid gap-3 md:grid-cols-2">{criticas.length ? criticas.map((c) => <div key={c.id} className={`rounded-xl border p-4 ${c.resolvida ? "border-slate-200 bg-slate-50 opacity-70" : c.severidade === "erro" ? "border-rose-200 bg-rose-50" : "border-amber-200 bg-amber-50"}`}><div className="flex items-center justify-between gap-3"><strong className="text-xs">{c.codigo}</strong><span className="text-[11px] uppercase">{c.resolvida ? "resolvida" : c.severidade}</span></div><p className="mt-2 text-sm text-slate-700">{c.mensagem}</p><p className="mt-2 text-xs text-slate-500">Campo: {c.campo ?? "—"} · origem: {c.origem ?? "validador"}</p></div>) : <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">Ainda não há críticas registradas. Execute a validação da conta.</p>}</div>
      <form action={validar} className="mt-5 flex justify-end"><button className="ui-button-primary"><ShieldCheck className="size-4"/>Revalidar conta</button></form>
    </section>
  </SectionPage>;
}

function Kpi({ label, value }: { label: string; value: string }) { return <div className="ui-card p-4"><p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p><p className="mt-2 text-lg font-bold text-slate-950">{value}</p></div>; }
function Row({ label, value }: { label: string; value: string | number | null | undefined }) { return <div className="rounded-xl border border-slate-100 p-3"><dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</dt><dd className="mt-1 font-medium text-slate-800">{value === null || value === undefined || value === "" ? "—" : String(value)}</dd></div>; }
