import Link from "next/link";
import { Calculator, CheckCircle2, FileCheck2, RefreshCw, ShieldAlert } from "lucide-react";
import { notFound } from "next/navigation";
import { SectionPage } from "@/components/painel/section-page";
import { createClient } from "@/lib/supabase/server";
import {
  auditarPrecosContaMedica,
  atualizarChecklistContaMedica,
  gerarChecklistContaMedica,
  liberarContaMedica,
} from "@/modules/corporativo/actions";
import {
  reabrirPendenciaContaMedica,
  resolverPendenciaContaMedica,
} from "@/modules/contas-medicas/actions";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function one<T>(value: T | T[] | null) {
  return Array.isArray(value) ? value[0] ?? null : value;
}

export default async function ContaMedicaDetalhe({
  params,
  searchParams,
}: {
  params: Promise<{ processoId: string }>;
  searchParams: Promise<{ erro?: string; sucesso?: string }>;
}) {
  const { processoId } = await params;
  const qs = await searchParams;
  const supabase = await createClient();
  const { data: procBase } = await supabase
    .from("contas_medicas_processos")
    .select("conta_id")
    .eq("id", processoId)
    .maybeSingle();

  const [{ data: processo }, { data: checklist }, { data: pendencias }, { data: docs }, { data: itensConta }] = await Promise.all([
    supabase
      .from("contas_medicas_processos")
      .select(
        "id,status,conta_id,total_conta,total_autorizado,total_nao_autorizado,observacoes,atendimento:atendimentos(numero_atendimento),paciente:pacientes(nome_completo,ra,numero_registro),convenio:convenios(nome_fantasia),conta:contas_faturamento(id,competencia,auditoria_liberada,contas_medicas_liberada)",
      )
      .eq("id", processoId)
      .maybeSingle(),
    supabase
      .from("contas_medicas_checklist_itens")
      .select("id,codigo,descricao,obrigatorio,categoria_documento,status,ged_documento_id,observacoes")
      .eq("processo_id", processoId)
      .order("codigo"),
    supabase
      .from("contas_medicas_pendencias")
      .select("id,tipo,severidade,descricao,resolvida,resolvida_em")
      .eq("processo_id", processoId)
      .order("created_at", { ascending: false }),
    supabase
      .from("ged_documentos")
      .select("id,titulo,categoria,nome_arquivo")
      .eq("conta_faturamento_id", procBase?.conta_id ?? "")
      .eq("status", "ativo")
      .order("created_at", { ascending: false }),
    supabase
      .from("conta_faturamento_itens")
      .select("id,codigo,descricao,valor_unitario,valor_referencia,metodologia_preco,memoria_calculo")
      .eq("conta_id", procBase?.conta_id ?? "")
      .eq("cobravel", true)
      .order("data_execucao"),
  ]);

  if (!processo) notFound();
  const paciente = one(processo.paciente);
  const atendimento = one(processo.atendimento);
  const convenio = one(processo.convenio);
  const conta = one(processo.conta);
  const pendenciasAbertas = (pendencias ?? []).filter((item) => !item.resolvida);
  const impeditivas = pendenciasAbertas.filter((item) => item.severidade === "erro" || item.severidade === "bloqueio");
  const checklistPendente = (checklist ?? []).filter(
    (item) => item.obrigatorio && !["ok", "nao_aplicavel"].includes(item.status),
  );

  return (
    <SectionPage
      eyebrow="Receita / Contas Médicas"
      title={paciente?.nome_completo ?? "Conta médica"}
      description={`Atendimento #${atendimento?.numero_atendimento ?? "—"} · Registro #${paciente?.numero_registro ?? "—"} · ${paciente?.ra ?? "—"} · ${convenio?.nome_fantasia ?? "Particular"}`}
    >
      {qs.sucesso ? (
        <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
          Operação concluída com sucesso.
        </div>
      ) : null}
      {qs.erro ? (
        <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
          Não foi possível liberar/processar: {decodeURIComponent(qs.erro)}.
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-4">
        <Info label="Competência" value={conta?.competencia ?? "—"} />
        <Info
          label="Total conta"
          value={`R$ ${Number(processo.total_conta || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
        />
        <Info
          label="Não autorizado"
          value={`R$ ${Number(processo.total_nao_autorizado || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
        />
        <Info label="Status" value={String(processo.status).replaceAll("_", " ")} />
      </div>

      <section className="ui-card mt-6 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Calculator className="size-5 text-brand-700" />
            <div>
              <h2 className="font-semibold">Auditoria contratual de valores</h2>
              <p className="text-sm text-slate-500">Compara cada item com a metodologia e edição contratada pelo convênio na data de execução.</p>
            </div>
          </div>
          <form action={auditarPrecosContaMedica}>
            <input type="hidden" name="processo_id" value={processoId} />
            <button className="ui-button-primary">Recalcular valores contratuais</button>
          </form>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-3 py-2">Código</th>
                <th className="px-3 py-2">Item</th>
                <th className="px-3 py-2">Lançado</th>
                <th className="px-3 py-2">Contratual</th>
                <th className="px-3 py-2">Método</th>
                <th className="px-3 py-2">Diferença</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {itensConta?.map((item) => {
                const lancado = Number(item.valor_unitario || 0);
                const referencia = item.valor_referencia == null ? null : Number(item.valor_referencia);
                const diferenca = referencia == null ? null : lancado - referencia;
                return (
                  <tr key={item.id}>
                    <td className="px-3 py-2">{item.codigo || "—"}</td>
                    <td className="px-3 py-2">{item.descricao}</td>
                    <td className="px-3 py-2">R$ {lancado.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
                    <td className="px-3 py-2">
                      {referencia == null ? "Não localizado" : `R$ ${referencia.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
                    </td>
                    <td className="px-3 py-2 uppercase">{item.metodologia_preco || "—"}</td>
                    <td
                      className={`px-3 py-2 font-semibold ${
                        diferenca && Math.abs(diferenca) > 0.01 ? "text-rose-600" : "text-emerald-600"
                      }`}
                    >
                      {diferenca == null ? "—" : `R$ ${diferenca.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="ui-card mt-6 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <FileCheck2 className="size-5 text-brand-700" />
            <div>
              <h2 className="font-semibold">Checklist documental</h2>
              <p className="text-sm text-slate-500">Itens obrigatórios devem estar OK ou Não aplicável antes da liberação TISS.</p>
            </div>
          </div>
          {!checklist?.length ? (
            <form action={gerarChecklistContaMedica}>
              <input type="hidden" name="processo_id" value={processoId} />
              <button className="ui-button-primary">Gerar checklist</button>
            </form>
          ) : null}
        </div>

        <div className="mt-4 space-y-3">
          {checklist?.length ? (
            checklist.map((item) => (
              <form
                key={item.id}
                action={atualizarChecklistContaMedica}
                className="grid gap-3 rounded-xl border border-slate-200 p-4 lg:grid-cols-[1.4fr_180px_1fr_auto]"
              >
                <input type="hidden" name="item_id" value={item.id} />
                <input type="hidden" name="processo_id" value={processoId} />
                <div>
                  <b className="text-sm">{item.codigo} · {item.descricao}</b>
                  <p className="mt-1 text-xs text-slate-500">
                    {item.obrigatorio ? "Obrigatório" : "Opcional"}
                    {item.categoria_documento ? ` · GED: ${item.categoria_documento}` : ""}
                  </p>
                </div>
                <select name="status" defaultValue={item.status} className="ui-input">
                  <option value="pendente">Pendente</option>
                  <option value="ok">OK</option>
                  <option value="nao_aplicavel">Não aplicável</option>
                  <option value="divergente">Divergente</option>
                </select>
                <select name="ged_documento_id" defaultValue={item.ged_documento_id ?? ""} className="ui-input">
                  <option value="">Sem documento vinculado</option>
                  {docs?.map((doc) => (
                    <option key={doc.id} value={doc.id}>{doc.titulo}</option>
                  ))}
                </select>
                <button className="ui-button-secondary">Salvar</button>
              </form>
            ))
          ) : (
            <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">Checklist ainda não gerado.</p>
          )}
        </div>
      </section>

      <section className="ui-card mt-6 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <ShieldAlert className="size-5 text-amber-600" />
            <div>
              <h2 className="font-semibold">Pendências de Contas Médicas</h2>
              <p className="text-sm text-slate-500">Críticas impeditivas precisam ser tratadas antes da geração/liberação TISS.</p>
            </div>
          </div>
          <div className="flex gap-2 text-xs font-black uppercase">
            <span className="rounded-full bg-amber-50 px-2.5 py-1 text-amber-700">Abertas {pendenciasAbertas.length}</span>
            <span className="rounded-full bg-rose-50 px-2.5 py-1 text-rose-700">Impeditivas {impeditivas.length}</span>
          </div>
        </div>

        <div className="mt-4 space-y-3">
          {pendencias?.length ? (
            pendencias.map((item) => (
              <article
                key={item.id}
                className={`rounded-xl border p-4 text-sm ${
                  item.resolvida
                    ? "border-emerald-200 bg-emerald-50"
                    : item.severidade === "erro" || item.severidade === "bloqueio"
                      ? "border-rose-200 bg-rose-50"
                      : "border-amber-200 bg-amber-50"
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <b className="capitalize">{item.severidade} · {item.tipo}</b>
                    <p className="mt-1">{item.descricao}</p>
                  </div>
                  {item.resolvida ? <CheckCircle2 className="size-5 text-emerald-600" /> : null}
                </div>
                {item.resolvida ? (
                  <form action={reabrirPendenciaContaMedica} className="mt-3">
                    <input type="hidden" name="processo_id" value={processoId} />
                    <input type="hidden" name="pendencia_id" value={item.id} />
                    <button className="ui-button-secondary">
                      <RefreshCw className="size-4" />
                      Reabrir pendência
                    </button>
                  </form>
                ) : (
                  <form action={resolverPendenciaContaMedica} className="mt-3">
                    <input type="hidden" name="processo_id" value={processoId} />
                    <input type="hidden" name="pendencia_id" value={item.id} />
                    <button className="ui-button-secondary">Marcar como resolvida</button>
                  </form>
                )}
              </article>
            ))
          ) : (
            <p className="rounded-xl bg-emerald-50 p-4 text-sm font-semibold text-emerald-700">Nenhuma pendência registrada.</p>
          )}
        </div>
      </section>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Link href={`/faturamento/${processo.conta_id}`} className="ui-button-secondary">Abrir conta</Link>
        <Link href={`/ged?conta=${processo.conta_id}`} className="ui-button-secondary">Abrir GED</Link>
        <form action={liberarContaMedica}>
          <input type="hidden" name="processo_id" value={processoId} />
          <button className="ui-button-primary" disabled={impeditivas.length > 0 || checklistPendente.length > 0}>
            Liberar para TISS
          </button>
        </form>
        {impeditivas.length || checklistPendente.length ? (
          <p className="text-xs font-semibold text-rose-700">
            Liberação pendente: {impeditivas.length} crítica(s) impeditiva(s) e {checklistPendente.length} item(ns) obrigatório(s) do checklist.
          </p>
        ) : null}
      </div>
    </SectionPage>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="ui-card p-4">
      <p className="text-xs uppercase text-slate-400">{label}</p>
      <p className="mt-2 font-semibold capitalize">{value}</p>
    </div>
  );
}
