import { AlertTriangle, CheckCircle2, FileCode2, ShieldCheck } from "lucide-react";
import { notFound } from "next/navigation";
import { GuideValidationBackgroundForm } from "@/components/faturamento/guide-validation-background-form";
import { TissGuideCommunicationForm } from "@/components/faturamento/tiss-guide-communication-form";
import { TissItemComplementForm } from "@/components/faturamento/tiss-item-complement-form";
import { SectionPage } from "@/components/painel/section-page";
import { createClient } from "@/lib/supabase/server";
import { acaoCriticaTiss, origemCriticaTiss, resumirCriticas, type TissGuiaCritica } from "@/modules/tiss/guia-criticas";

function one<T>(rel: T | T[] | null): T | null {
  return Array.isArray(rel) ? rel[0] ?? null : rel;
}

type CriticaLinha = TissGuiaCritica & { id: string; created_at: string };
type CommunicationGuideType = "consulta" | "sp_sadt" | "resumo_internacao";

const expenseOrigins = new Set(["gas_medicinal", "medicamento", "material", "diaria", "taxa", "opme"]);

function formatarValidacao(value: string | null) {
  if (!value) return "Ainda não validada";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(value));
}

function isCommunicationGuideType(value: string): value is CommunicationGuideType {
  return value === "consulta" || value === "sp_sadt" || value === "resumo_internacao";
}

function originLabel(value: string | null) {
  const labels: Record<string, string> = {
    procedimento: "Procedimento",
    honorario: "Honorário",
    laboratorio: "Laboratório",
    imagem: "Imagem",
    pacote: "Pacote",
    gas_medicinal: "Gás medicinal",
    medicamento: "Medicamento",
    material: "Material",
    diaria: "Diária",
    taxa: "Taxa",
    opme: "OPME",
  };
  return value ? labels[value] ?? value.replaceAll("_", " ") : "Origem não classificada";
}

export default async function GuiaTissPage({
  params,
  searchParams,
}: {
  params: Promise<{ guiaId: string }>;
  searchParams: Promise<{ erro?: string }>;
}) {
  const { guiaId } = await params;
  const { erro } = await searchParams;
  const supabase = await createClient();

  const [{ data: guia }, { data: itens }, { data: criticas }] = await Promise.all([
    supabase
      .from("tiss_guias")
      .select("id,numero_guia_prestador,numero_guia_operadora,tipo_guia,status,registro_ans,codigo_prestador_operadora,numero_carteirinha,validade_carteirinha,senha_autorizacao,validade_senha,data_atendimento,atendimento_rn,valor_total,validado_em,beneficiario_nome_snapshot,beneficiario_cns_snapshot,profissional_nome_snapshot,profissional_conselho_snapshot,profissional_numero_conselho_snapshot,profissional_uf_conselho_snapshot,profissional_cbo_snapshot,profissional_especialidade_snapshot,cnes_snapshot,tipo_atendimento_tuss50_codigo,tipo_atendimento_tuss50_descricao,tipo_consulta_tuss52_codigo,tipo_consulta_tuss52_descricao,acomodacao_tuss49_codigo,acomodacao_tuss49_descricao,codigo_conselho_ans_snapshot,indicador_acidente,regime_atendimento_tiss,carater_atendimento,numero_solicitacao_internacao,data_autorizacao,tipo_faturamento_tiss,data_inicio_faturamento,hora_inicio_faturamento,data_fim_faturamento,hora_fim_faturamento,tipo_internacao_tiss,regime_internacao_tiss,motivo_encerramento_tiss,solicitante_codigo_prestador_snapshot,solicitante_cnpj_snapshot,solicitante_nome_contratado_snapshot,solicitante_nome_profissional_snapshot,solicitante_codigo_conselho_ans_snapshot,solicitante_numero_conselho_snapshot,solicitante_uf_conselho_snapshot,solicitante_cbo_snapshot,versao:tiss_versoes(codigo,conteudo_estrutura,tuss,comunicacao_principal),paciente:pacientes(nome_completo,ra,numero_registro),convenio:convenios(nome_fantasia),conta:contas_faturamento(id)")
      .eq("id", guiaId)
      .maybeSingle(),
    supabase
      .from("tiss_guia_itens")
      .select("id,sequencial,data_execucao,tabela,codigo_procedimento,descricao,quantidade,valor_unitario,valor_total,origem_tipo,unidade_medida_tiss")
      .eq("guia_id", guiaId)
      .order("sequencial"),
    supabase
      .from("tiss_guia_criticas")
      .select("id,item_id,codigo,severidade,campo,mensagem,created_at")
      .eq("guia_id", guiaId)
      .eq("resolvida", false)
      .order("created_at", { ascending: false }),
  ]);

  if (!guia) notFound();

  const paciente = one(guia.paciente);
  const convenio = one(guia.convenio);
  const versao = one(guia.versao);
  const criticasAbertas: CriticaLinha[] = (criticas ?? []).map((critica) => ({
    id: critica.id,
    item_id: critica.item_id,
    codigo: critica.codigo,
    severidade: critica.severidade === "alerta" ? "alerta" : "erro",
    campo: critica.campo,
    mensagem: critica.mensagem,
    created_at: critica.created_at,
  }));
  const resumo = resumirCriticas(criticasAbertas);
  const podeRevalidar = guia.status === "rascunho" || guia.status === "pronta";
  const validada = Boolean(guia.validado_em);
  const communicationType = isCommunicationGuideType(guia.tipo_guia) ? guia.tipo_guia : null;

  return <SectionPage
    eyebrow="Financeiro / TISS / Guia"
    title={`Guia ${guia.numero_guia_prestador}`}
    description={`${paciente?.nome_completo ?? "Paciente"} · Registro #${paciente?.numero_registro ?? "—"} · ${paciente?.ra ?? "—"}`}
  >
    {erro ? <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">A guia foi criada, mas ocorreu uma inconsistência ao copiar itens. Revise antes de prosseguir.</div> : null}

    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
      <Info label="Tipo de guia" value={guia.tipo_guia.replaceAll("_", " ")} />
      <Info label="Status" value={guia.status} />
      <Info label="Operadora" value={`${convenio?.nome_fantasia ?? "—"} · ANS ${guia.registro_ans ?? "—"}`} />
      <Info label="Carteirinha" value={guia.numero_carteirinha ?? "—"} />
      <Info label="Validação" value={validada ? (resumo.erros ? `${resumo.erros} bloqueio(s)` : "Sem bloqueios") : "Pendente"} />
      <Info label="Valor" value={`R$ ${Number(guia.valor_total ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`} />
    </div>

    <section className="ui-card mt-6 overflow-hidden">
      <div className="flex flex-col gap-4 border-b border-slate-100 px-5 py-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-3">
          <span className={`grid size-11 shrink-0 place-items-center rounded-xl ${resumo.erros ? "bg-rose-50 text-rose-700" : resumo.alertas ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"}`}><ShieldCheck className="size-5" /></span>
          <div>
            <h2 className="font-semibold text-slate-900">Validação de consistência TISS</h2>
            <p className="mt-1 max-w-3xl text-sm text-slate-600">Central de críticas para cadastro, autorização, domínios ANS/TUSS e requisitos estruturais 04.03.00. O XML final ainda passa pelo XSD oficial no lote.</p>
            <p className="mt-2 text-xs text-slate-500">Última validação: {formatarValidacao(guia.validado_em)}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-start gap-2">
          <span className="rounded-full bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700">{resumo.erros} bloqueio(s)</span>
          <span className="rounded-full bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700">{resumo.alertas} alerta(s)</span>
          <GuideValidationBackgroundForm guiaId={guia.id} disabled={!podeRevalidar} />
        </div>
      </div>
      {!validada ? <div className="flex items-start gap-3 px-5 py-5 text-sm text-slate-600"><AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-600" /><span>Esta guia ainda não possui registro de validação. Execute a validação antes de incluí-la em lote.</span></div> : criticasAbertas.length === 0 ? <div className="flex items-start gap-3 px-5 py-5 text-sm text-emerald-800"><CheckCircle2 className="mt-0.5 size-5 shrink-0" /><div><p className="font-semibold">Nenhuma crítica aberta.</p><p className="mt-1 text-emerald-700">A guia passou pela consistência e pode seguir para o lote se permanecer com status pronta.</p></div></div> : <div className="divide-y divide-slate-100">{criticasAbertas.map((critica) => <div key={critica.id} className="grid gap-3 px-5 py-4 lg:grid-cols-[140px_170px_1fr]"><div><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${critica.severidade === "erro" ? "bg-rose-50 text-rose-700" : "bg-amber-50 text-amber-700"}`}>{critica.severidade === "erro" ? "Bloqueio" : "Alerta"}</span><p className="mt-2 font-mono text-[11px] text-slate-500">{critica.codigo}</p></div><div><p className="text-xs uppercase tracking-wide text-slate-400">Origem</p><p className="mt-1 text-sm font-medium text-slate-800">{origemCriticaTiss(critica.codigo)}</p>{critica.campo ? <p className="mt-1 break-all text-xs text-slate-500">Campo: {critica.campo}</p> : null}</div><div><p className="text-sm font-medium text-slate-900">{critica.mensagem}</p><p className="mt-1 text-sm text-slate-600"><span className="font-medium">Ação:</span> {acaoCriticaTiss(critica)}</p></div></div>)}</div>}
    </section>

    {communicationType ? <TissGuideCommunicationForm
      guiaId={guia.id}
      type={communicationType}
      disabled={!podeRevalidar}
      values={{
        codigo_conselho_ans_snapshot: guia.codigo_conselho_ans_snapshot,
        indicador_acidente: guia.indicador_acidente,
        regime_atendimento_tiss: guia.regime_atendimento_tiss,
        carater_atendimento: guia.carater_atendimento,
        numero_solicitacao_internacao: guia.numero_solicitacao_internacao,
        data_autorizacao: guia.data_autorizacao,
        tipo_faturamento_tiss: guia.tipo_faturamento_tiss,
        data_inicio_faturamento: guia.data_inicio_faturamento,
        hora_inicio_faturamento: guia.hora_inicio_faturamento,
        data_fim_faturamento: guia.data_fim_faturamento,
        hora_fim_faturamento: guia.hora_fim_faturamento,
        tipo_internacao_tiss: guia.tipo_internacao_tiss,
        regime_internacao_tiss: guia.regime_internacao_tiss,
        motivo_encerramento_tiss: guia.motivo_encerramento_tiss,
        solicitante_codigo_prestador_snapshot: guia.solicitante_codigo_prestador_snapshot,
        solicitante_cnpj_snapshot: guia.solicitante_cnpj_snapshot,
        solicitante_nome_contratado_snapshot: guia.solicitante_nome_contratado_snapshot,
        solicitante_nome_profissional_snapshot: guia.solicitante_nome_profissional_snapshot,
        solicitante_codigo_conselho_ans_snapshot: guia.solicitante_codigo_conselho_ans_snapshot,
        solicitante_numero_conselho_snapshot: guia.solicitante_numero_conselho_snapshot,
        solicitante_uf_conselho_snapshot: guia.solicitante_uf_conselho_snapshot,
        solicitante_cbo_snapshot: guia.solicitante_cbo_snapshot,
      }}
    /> : null}

    <div className="mt-6 grid gap-6 xl:grid-cols-[0.75fr_1.25fr]">
      <section className="ui-card p-5">
        <h2 className="flex items-center gap-2 font-semibold text-slate-900"><ShieldCheck className="size-5 text-brand-700" />Snapshot TISS</h2>
        <p className="mt-1 text-xs text-slate-500">Dados fotografados na guia para preservar o conteúdo faturado mesmo que o cadastro de origem seja alterado depois.</p>
        <dl className="mt-4 space-y-3 text-sm">
          <Row label="Beneficiário" value={guia.beneficiario_nome_snapshot} />
          <Row label="CNS" value={guia.beneficiario_cns_snapshot} />
          <Row label="Atendimento a RN" value={guia.atendimento_rn ? "S" : "N"} />
          <Row label="Profissional" value={guia.profissional_nome_snapshot} />
          <Row label="Conselho" value={[guia.profissional_conselho_snapshot, guia.profissional_numero_conselho_snapshot, guia.profissional_uf_conselho_snapshot].filter(Boolean).join(" ")} />
          <Row label="Código conselho ANS" value={guia.codigo_conselho_ans_snapshot} />
          <Row label="CBO" value={guia.profissional_cbo_snapshot} />
          <Row label="Especialidade" value={guia.profissional_especialidade_snapshot} />
          <Row label="CNES" value={guia.cnes_snapshot} />
          <Row label="Código prestador" value={guia.codigo_prestador_operadora} />
          <Row label="Senha autorização" value={guia.senha_autorizacao} />
          <Row label="Validade da senha" value={guia.validade_senha} />
          <Row label="Data atendimento" value={guia.data_atendimento} />
          <Row label="Tipo atendimento (TUSS 50)" value={[guia.tipo_atendimento_tuss50_codigo, guia.tipo_atendimento_tuss50_descricao].filter(Boolean).join(" · ")} />
          <Row label="Tipo consulta (TUSS 52)" value={[guia.tipo_consulta_tuss52_codigo, guia.tipo_consulta_tuss52_descricao].filter(Boolean).join(" · ")} />
          <Row label="Acomodação (TUSS 49)" value={[guia.acomodacao_tuss49_codigo, guia.acomodacao_tuss49_descricao].filter(Boolean).join(" · ")} />
        </dl>
        <div className="mt-5 rounded-xl border border-brand-100 bg-brand-50 p-4 text-sm text-brand-900"><p className="font-semibold">Versão aplicada</p><p className="mt-1">Conteúdo/Estrutura {versao?.conteudo_estrutura ?? "—"} · TUSS {versao?.tuss ?? "—"} · Comunicação {versao?.comunicacao_principal ?? "—"}</p></div>
      </section>

      <section className="ui-card overflow-hidden">
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 className="font-semibold text-slate-900">Itens da guia</h2>
          <p className="mt-1 text-xs text-slate-500">Despesas exigem unidade de medida TISS. O valor não é presumido pelo sistema.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">Seq.</th><th className="px-4 py-3">Origem</th><th className="px-4 py-3">Tabela/Código</th><th className="px-4 py-3">Descrição</th><th className="px-4 py-3 text-right">Qtd.</th><th className="px-4 py-3 text-right">Total</th><th className="px-4 py-3 text-right">Complemento XSD</th></tr></thead>
            <tbody className="divide-y divide-slate-100">{itens?.map((item) => {
              const isExpense = expenseOrigins.has(String(item.origem_tipo ?? ""));
              return <tr key={item.id}>
                <td className="px-4 py-3">{item.sequencial}</td>
                <td className="px-4 py-3"><span className={`rounded-full px-2 py-1 text-xs font-semibold ${isExpense ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-600"}`}>{originLabel(item.origem_tipo)}</span></td>
                <td className="px-4 py-3 font-mono text-xs">{item.tabela ?? "—"} / {item.codigo_procedimento}</td>
                <td className="px-4 py-3"><p>{item.descricao ?? "—"}</p><p className="mt-1 text-xs text-slate-400">Execução {item.data_execucao ?? "—"}</p></td>
                <td className="px-4 py-3 text-right">{Number(item.quantidade)}</td>
                <td className="px-4 py-3 text-right font-semibold">R$ {Number(item.valor_total).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
                <td className="px-4 py-3 text-right">{isExpense ? <TissItemComplementForm guiaId={guia.id} itemId={item.id} unidade={item.unidade_medida_tiss} disabled={!podeRevalidar} /> : <span className="text-xs text-slate-400">Não aplicável</span>}</td>
              </tr>;
            })}</tbody>
          </table>
        </div>
      </section>
    </div>

    <section className="ui-card mt-6 p-5">
      <div className="flex items-start gap-3">
        <span className="grid size-10 place-items-center rounded-xl bg-emerald-50 text-emerald-700"><FileCode2 className="size-5" /></span>
        <div><h2 className="font-semibold text-slate-900">Barreira final no lote</h2><p className="mt-1 text-sm text-slate-600">Depois que as críticas desta guia forem resolvidas, o lote gera <code>ENVIO_LOTE_GUIAS</code>, calcula o MD5 TISS e só libera download/envio após aprovação do XSD oficial 4.03.00.</p></div>
      </div>
    </section>
  </SectionPage>;
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="ui-card p-4"><p className="text-xs uppercase tracking-wide text-slate-400">{label}</p><p className="mt-2 font-semibold text-slate-900">{value}</p></div>;
}

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  return <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-2"><dt className="text-slate-500">{label}</dt><dd className="max-w-[60%] text-right font-medium text-slate-800">{value || "—"}</dd></div>;
}
