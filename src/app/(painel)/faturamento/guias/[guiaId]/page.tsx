import { AlertTriangle, BadgeCheck, FileCode2, RefreshCw, ShieldCheck } from "lucide-react";
import { notFound } from "next/navigation";
import { SectionPage } from "@/components/painel/section-page";
import { createClient } from "@/lib/supabase/server";
import { validarGuiaTiss } from "@/modules/tiss/guia-actions";

function one<T>(rel: T | T[] | null): T | null { return Array.isArray(rel) ? rel[0] ?? null : rel; }
function dataHora(value: string | null | undefined) { return value ? new Date(value).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "—"; }

type Search = { erro?: string; validado?: string; status?: string; erros?: string; alertas?: string };

export default async function GuiaTissPage({ params, searchParams }: { params: Promise<{ guiaId: string }>; searchParams: Promise<Search> }) {
  const { guiaId } = await params;
  const search = await searchParams;
  const supabase = await createClient();
  const [{ data: guia }, { data: itens }, { data: criticas }] = await Promise.all([
    supabase.from("tiss_guias").select("id,numero_guia_prestador,numero_guia_operadora,tipo_guia,status,registro_ans,numero_carteirinha,senha_autorizacao,data_atendimento,atendimento_rn,valor_total,beneficiario_nome_snapshot,beneficiario_cns_snapshot,profissional_nome_snapshot,profissional_conselho_snapshot,profissional_numero_conselho_snapshot,profissional_uf_conselho_snapshot,profissional_cbo_snapshot,profissional_especialidade_snapshot,cnes_snapshot,tipo_atendimento_tuss50_codigo,tipo_atendimento_tuss50_descricao,tipo_atendimento_tuss50_versao,tipo_consulta_tuss52_codigo,tipo_consulta_tuss52_descricao,tipo_consulta_tuss52_versao,acomodacao_tuss49_codigo,acomodacao_tuss49_descricao,acomodacao_tuss49_versao,validado_em,versao:tiss_versoes(codigo,conteudo_estrutura,tuss,comunicacao_principal),paciente:pacientes(nome_completo,ra,numero_registro),convenio:convenios(nome_fantasia),conta:contas_faturamento(id)").eq("id", guiaId).maybeSingle(),
    supabase.from("tiss_guia_itens").select("id,sequencial,data_execucao,tabela,codigo_procedimento,descricao,quantidade,valor_unitario,valor_total,via_acesso,via_acesso_tuss61_descricao,via_acesso_tuss61_versao,tecnica_utilizada,tecnica_utilizada_tuss48_descricao,tecnica_utilizada_tuss48_versao").eq("guia_id", guiaId).order("sequencial"),
    supabase.from("tiss_guia_criticas").select("id,codigo,severidade,campo,mensagem,created_at").eq("guia_id", guiaId).eq("resolvida", false).order("created_at"),
  ]);
  if (!guia) notFound();

  const paciente = one(guia.paciente);
  const convenio = one(guia.convenio);
  const versao = one(guia.versao);
  const nomeBeneficiario = guia.beneficiario_nome_snapshot ?? paciente?.nome_completo ?? "Paciente";
  const podeValidar = guia.status === "rascunho" || guia.status === "pronta";
  const errosAbertos = (criticas ?? []).filter((item) => item.severidade === "erro").length;
  const alertasAbertos = (criticas ?? []).filter((item) => item.severidade === "alerta").length;

  return <SectionPage eyebrow="Financeiro / TISS / Guia" title={`Guia ${guia.numero_guia_prestador}`} description={`${nomeBeneficiario} · Registro #${paciente?.numero_registro ?? "—"} · ${paciente?.ra ?? "—"}`}>
    {search.erro === "itens" ? <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">A guia foi criada, mas ocorreu uma inconsistência ao copiar os itens. Revise antes de prosseguir.</div> : null}
    {search.erro === "validacao" ? <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">Não foi possível executar a validação regulatória da guia. Nenhuma promoção de status foi presumida.</div> : null}
    {search.validado ? Number(search.erros ?? 0) > 0
      ? <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800"><AlertTriangle className="mr-1 inline size-4" />Validação concluída: {Number(search.erros ?? 0)} erro(s) bloqueante(s) e {Number(search.alertas ?? 0)} alerta(s). A guia permanece em rascunho.</div>
      : <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800"><BadgeCheck className="mr-1 inline size-4" />Validação concluída sem erro bloqueante. Status: {search.status ?? guia.status}.</div>
      : null}

    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap gap-2">
        <span className={`rounded-full px-3 py-1 text-xs font-bold ${guia.status === "pronta" ? "bg-emerald-50 text-emerald-700" : guia.status === "rascunho" ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-700"}`}>{guia.status.replaceAll("_", " ")}</span>
        {errosAbertos ? <span className="rounded-full bg-rose-50 px-3 py-1 text-xs font-bold text-rose-700">{errosAbertos} erro(s)</span> : null}
        {alertasAbertos ? <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700">{alertasAbertos} alerta(s)</span> : null}
      </div>
      {podeValidar ? <form action={validarGuiaTiss.bind(null, guiaId)}><button className="ui-button-primary"><RefreshCw className="size-4" />{guia.validado_em ? "Revalidar guia" : "Validar guia"}</button></form> : null}
    </div>

    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
      <Info label="Tipo de guia" value={guia.tipo_guia.replaceAll("_", " ")} />
      <Info label="Status" value={guia.status} />
      <Info label="Operadora" value={`${convenio?.nome_fantasia ?? "—"} · ANS ${guia.registro_ans ?? "—"}`} />
      <Info label="Carteirinha" value={guia.numero_carteirinha ?? "—"} />
      <Info label="Atendimento a RN" value={guia.atendimento_rn ? "Sim (S)" : "Não (N)"} />
      <Info label="Valor" value={`R$ ${Number(guia.valor_total ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`} />
    </div>

    {(criticas ?? []).length ? <section className="ui-card mt-6 overflow-hidden">
      <div className="border-b border-slate-100 px-5 py-4"><h2 className="font-semibold text-slate-900">Críticas abertas da guia</h2><p className="mt-1 text-sm text-slate-500">Erros bloqueiam a promoção para pronta; alertas exigem conferência, mas não bloqueiam por si só.</p></div>
      <div className="divide-y divide-slate-100">{criticas?.map((critica) => <div key={critica.id} className="flex items-start gap-3 px-5 py-4"><span className={`mt-0.5 rounded-full px-2 py-1 text-[11px] font-black uppercase ${critica.severidade === "erro" ? "bg-rose-50 text-rose-700" : "bg-amber-50 text-amber-700"}`}>{critica.severidade}</span><div className="min-w-0"><p className="font-semibold text-slate-900">{critica.codigo} · {critica.mensagem}</p><p className="mt-1 text-xs text-slate-500">Campo: {critica.campo ?? "—"}</p></div></div>)}</div>
    </section> : null}

    <div className="mt-6 grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
      <section className="ui-card p-5">
        <h2 className="flex items-center gap-2 font-semibold text-slate-900"><ShieldCheck className="size-5 text-brand-700" />Snapshot regulatório da guia</h2>
        <p className="mt-1 text-xs leading-5 text-slate-500">Os dados abaixo são fotografados na guia e não acompanham alterações posteriores no cadastro vivo do paciente, profissional ou unidade.</p>
        <dl className="mt-4 space-y-3 text-sm">
          <Row label="Beneficiário" value={guia.beneficiario_nome_snapshot} />
          <Row label="CNS" value={guia.beneficiario_cns_snapshot} />
          <Row label="Atendimento a RN" value={guia.atendimento_rn ? "S" : "N"} />
          <Row label="Profissional" value={guia.profissional_nome_snapshot} />
          <Row label="Conselho" value={[guia.profissional_conselho_snapshot, guia.profissional_numero_conselho_snapshot, guia.profissional_uf_conselho_snapshot].filter(Boolean).join(" ")} />
          <Row label="CBO" value={guia.profissional_cbo_snapshot} />
          <Row label="Especialidade" value={guia.profissional_especialidade_snapshot} />
          <Row label="CNES" value={guia.cnes_snapshot} />
          <Row label="TUSS 50 · Tipo atendimento" value={guia.tipo_atendimento_tuss50_codigo ? `${guia.tipo_atendimento_tuss50_codigo} · ${guia.tipo_atendimento_tuss50_descricao ?? ""} · v${guia.tipo_atendimento_tuss50_versao ?? "—"}` : null} />
          <Row label="TUSS 52 · Tipo consulta" value={guia.tipo_consulta_tuss52_codigo ? `${guia.tipo_consulta_tuss52_codigo} · ${guia.tipo_consulta_tuss52_descricao ?? ""} · v${guia.tipo_consulta_tuss52_versao ?? "—"}` : null} />
          <Row label="TUSS 49 · Acomodação" value={guia.acomodacao_tuss49_codigo ? `${guia.acomodacao_tuss49_codigo} · ${guia.acomodacao_tuss49_descricao ?? ""} · v${guia.acomodacao_tuss49_versao ?? "—"}` : null} />
          <Row label="Senha autorização" value={guia.senha_autorizacao} />
          <Row label="Data atendimento" value={guia.data_atendimento} />
          <Row label="Última validação" value={dataHora(guia.validado_em)} />
        </dl>
        <div className="mt-5 rounded-xl border border-brand-100 bg-brand-50 p-4 text-sm text-brand-900"><p className="font-semibold">Versão TISS aplicada</p><p className="mt-1">{versao?.codigo ?? "—"} · Conteúdo/Estrutura {versao?.conteudo_estrutura ?? "—"} · TUSS {versao?.tuss ?? "—"} · Comunicação {versao?.comunicacao_principal ?? "—"}</p></div>
      </section>

      <section className="ui-card overflow-hidden">
        <div className="border-b border-slate-100 px-5 py-4"><h2 className="font-semibold text-slate-900">Itens da guia</h2></div>
        <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">Seq.</th><th className="px-4 py-3">Data</th><th className="px-4 py-3">Tabela/Código</th><th className="px-4 py-3">Descrição</th><th className="px-4 py-3">Via / técnica</th><th className="px-4 py-3 text-right">Qtd.</th><th className="px-4 py-3 text-right">Total</th></tr></thead><tbody className="divide-y divide-slate-100">{itens?.map((item) => <tr key={item.id}><td className="px-4 py-3">{item.sequencial}</td><td className="px-4 py-3 text-slate-500">{item.data_execucao ?? "—"}</td><td className="px-4 py-3 font-mono text-xs">{item.tabela ?? "—"} / {item.codigo_procedimento}</td><td className="px-4 py-3">{item.descricao ?? "—"}</td><td className="px-4 py-3 text-xs text-slate-600"><p>{item.via_acesso ? `T61 ${item.via_acesso} · ${item.via_acesso_tuss61_descricao ?? "não validada"}` : "Via —"}</p><p className="mt-1">{item.tecnica_utilizada ? `T48 ${item.tecnica_utilizada} · ${item.tecnica_utilizada_tuss48_descricao ?? "não validada"}` : "Técnica —"}</p></td><td className="px-4 py-3 text-right">{Number(item.quantidade)}</td><td className="px-4 py-3 text-right font-semibold">R$ {Number(item.valor_total).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td></tr>)}</tbody></table></div>
      </section>
    </div>

    <section className="ui-card mt-6 p-5"><div className="flex items-start gap-3"><span className="grid size-10 place-items-center rounded-xl bg-amber-50 text-amber-700"><FileCode2 className="size-5" /></span><div><h2 className="font-semibold text-slate-900">XML final ainda bloqueado</h2><p className="mt-1 text-sm text-slate-600">A validação desta tela cobre consistência cadastral e regulatória da guia. O XML oficial continuará bloqueado até o gerador da mensagem e a validação contra o XSD correspondente da ANS estarem instalados.</p></div></div></section>
  </SectionPage>;
}

function Info({ label, value }: { label: string; value: string }) { return <div className="ui-card p-4"><p className="text-xs uppercase tracking-wide text-slate-400">{label}</p><p className="mt-2 font-semibold text-slate-900">{value}</p></div>; }
function Row({ label, value }: { label: string; value: string | null | undefined }) { return <div className="flex justify-between gap-4 border-b border-slate-100 pb-2"><dt className="text-slate-500">{label}</dt><dd className="max-w-[65%] text-right font-medium text-slate-800">{value || "—"}</dd></div>; }
