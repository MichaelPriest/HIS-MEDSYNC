import type { Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, ExternalLink, FileClock, FileText, RotateCcw, ScanLine } from "lucide-react";
import { SectionPage } from "@/components/painel/section-page";
import { abrirRetificacaoLaudoImagem, liberarLaudoImagem, salvarLaudoImagem } from "@/modules/assistencial/imagem-actions";
import { getAssistencialContext } from "@/modules/assistencial/context";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const fmt = (value?: string | null) => value ? new Date(value).toLocaleString("pt-BR") : "—";
const one = <T,>(value: T | T[] | null | undefined): T | null => Array.isArray(value) ? value[0] ?? null : value ?? null;

export default async function ImagemLaudoPage({
  params,
  searchParams,
}: {
  params: Promise<{ laudoId: string }>;
  searchParams: Promise<{ sucesso?: string; erro?: string }>;
}) {
  const [{ laudoId }, sp] = await Promise.all([params, searchParams]);
  const { supabase, empresaId, unidadeId } = await getAssistencialContext();

  const { data: laudo } = await supabase
    .from("imagem_laudos")
    .select("id,solicitacao_id,execucao_id,atendimento_id,tecnica,achados,conclusao,recomendacoes,status,laudo_por,liberado_em,assinatura_hash,revisao,retificado,motivo_retificacao,publicado_portal,publicado_em,created_at,updated_at")
    .eq("id", laudoId)
    .eq("empresa_id", empresaId)
    .eq("unidade_id", unidadeId)
    .maybeSingle();

  if (!laudo) notFound();

  const [solReq, execReq, atReq, histReq, profReq] = await Promise.all([
    supabase.from("solicitacoes_exames").select("id,exame,codigo_tuss,indicacao_clinica,prioridade,status,created_at").eq("id", laudo.solicitacao_id).maybeSingle(),
    laudo.execucao_id
      ? supabase.from("imagem_execucoes").select("id,accession_number,sala,equipamento,status,iniciado_em,finalizado_em,study_instance_uid,series_instance_uid,pacs_url,intercorrencias").eq("id", laudo.execucao_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    supabase.from("atendimentos").select("numero_atendimento,paciente:pacientes(nome_completo,ra,numero_registro,data_nascimento,sexo)").eq("id", laudo.atendimento_id).maybeSingle(),
    supabase.from("imagem_laudos_historico").select("id,revisao,motivo,criado_em").eq("laudo_id", laudo.id).order("revisao", { ascending: false }).limit(30),
    laudo.laudo_por
      ? supabase.from("profissionais").select("nome_completo,conselho,numero_conselho,uf_conselho,especialidade").eq("id", laudo.laudo_por).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);

  const solicitacao = solReq.data;
  const execucao = execReq.data;
  const atendimento = atReq.data;
  const paciente = one(atendimento?.paciente as any) as any;
  const historico = histReq.data ?? [];
  const profissional = profReq.data;
  const liberado = laudo.status === "liberado";
  const pacsUrl = execucao?.pacs_url && /^https?:\/\//i.test(execucao.pacs_url) ? execucao.pacs_url : null;

  return (
    <SectionPage
      eyebrow="Assistencial / Imagem / RIS"
      title={solicitacao?.exame ?? "Laudo de imagem"}
      description={`Atendimento #${atendimento?.numero_atendimento ?? "—"} · ${paciente?.nome_completo ?? "Paciente"} · revisão ${laudo.revisao}`}
    >
      {sp.sucesso ? <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">Operação concluída: {sp.sucesso}.</div> : null}
      {sp.erro ? <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">Falha: {decodeURIComponent(sp.erro)}.</div> : null}

      <div className="mb-5 flex flex-wrap gap-2">
        <Link href="/assistencial/imagem" className="ui-button-secondary">Voltar ao RIS</Link>
        <Link href={`/assistencial/imagem/laudos/${laudo.id}/imprimir` as Route} className="ui-button-secondary">
          <FileText className="size-4" /> Imprimir / PDF
        </Link>
        {pacsUrl ? <a href={pacsUrl} target="_blank" rel="noreferrer" className="ui-button-secondary"><ExternalLink className="size-4" /> Abrir PACS</a> : null}
      </div>

      <section className="grid gap-4 xl:grid-cols-[1.6fr_0.8fr]">
        <div className="space-y-4">
          <div className="his-card p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-wider text-slate-400">Paciente / episódio</p>
                <h2 className="mt-1 text-lg font-black text-slate-950">{paciente?.nome_completo ?? "Paciente"}</h2>
                <p className="text-sm text-slate-500">RA {paciente?.ra ?? "—"} · registro {paciente?.numero_registro ?? "—"} · nascimento {paciente?.data_nascimento ? new Date(`${paciente.data_nascimento}T12:00:00`).toLocaleDateString("pt-BR") : "—"}</p>
              </div>
              <span className={liberado ? "rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700" : "rounded-full bg-amber-50 px-3 py-1 text-xs font-black text-amber-700"}>
                {liberado ? "LAUDO LIBERADO" : "RASCUNHO"}
              </span>
            </div>
            <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-4">
              <Info label="TUSS" value={solicitacao?.codigo_tuss ?? "—"} />
              <Info label="Prioridade" value={solicitacao?.prioridade ?? "—"} />
              <Info label="Accession" value={execucao?.accession_number ?? "—"} />
              <Info label="Sala" value={execucao?.sala ?? "—"} />
              <Info label="Equipamento" value={execucao?.equipamento ?? "—"} />
              <Info label="Execução" value={`${fmt(execucao?.iniciado_em)} → ${fmt(execucao?.finalizado_em)}`} />
              <Info label="Study UID" value={execucao?.study_instance_uid ?? "—"} />
              <Info label="Series UID" value={execucao?.series_instance_uid ?? "—"} />
            </div>
            {solicitacao?.indicacao_clinica ? <div className="mt-4 rounded-xl bg-slate-50 p-3"><p className="text-xs font-black uppercase text-slate-400">Indicação clínica</p><p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{solicitacao.indicacao_clinica}</p></div> : null}
            {execucao?.intercorrencias ? <div className="mt-3 rounded-xl bg-amber-50 p-3"><p className="text-xs font-black uppercase text-amber-700">Intercorrências da execução</p><p className="mt-1 whitespace-pre-wrap text-sm text-amber-900">{execucao.intercorrencias}</p></div> : null}
          </div>

          {!liberado ? (
            <form action={salvarLaudoImagem} className="his-card p-6">
              <input type="hidden" name="execucao_id" value={String(laudo.execucao_id ?? "")} />
              <div className="mb-4 flex items-center gap-2"><ScanLine className="size-5 text-brand-700" /><h2 className="font-black">Editor do laudo</h2></div>
              {laudo.retificado && laudo.motivo_retificacao ? <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800"><strong>Retificação:</strong> {laudo.motivo_retificacao}</div> : null}
              <div className="grid gap-4">
                <label className="grid gap-1 text-sm font-semibold text-slate-700">Técnica<textarea name="tecnica" rows={3} defaultValue={laudo.tecnica ?? ""} className="ui-input" /></label>
                <label className="grid gap-1 text-sm font-semibold text-slate-700">Achados<textarea name="achados" rows={10} defaultValue={laudo.achados ?? ""} className="ui-input" /></label>
                <label className="grid gap-1 text-sm font-semibold text-slate-700">Conclusão<textarea name="conclusao" rows={5} defaultValue={laudo.conclusao ?? ""} className="ui-input" /></label>
                <label className="grid gap-1 text-sm font-semibold text-slate-700">Recomendações<textarea name="recomendacoes" rows={3} defaultValue={laudo.recomendacoes ?? ""} className="ui-input" /></label>
                <div className="flex flex-wrap justify-end gap-2">
                  <button className="ui-button-secondary">Salvar rascunho</button>
                </div>
              </div>
            </form>
          ) : (
            <div className="his-card p-6">
              <div className="mb-5 flex items-center gap-2"><CheckCircle2 className="size-5 text-emerald-700" /><h2 className="font-black">Laudo assinado</h2></div>
              <ReportSection title="Técnica" value={laudo.tecnica} />
              <ReportSection title="Achados" value={laudo.achados} />
              <ReportSection title="Conclusão" value={laudo.conclusao} />
              <ReportSection title="Recomendações" value={laudo.recomendacoes} />
              <div className="mt-5 border-t border-slate-200 pt-4 text-sm text-slate-600">
                <p className="font-bold text-slate-900">{profissional?.nome_completo ?? "Profissional responsável"}</p>
                <p>{[profissional?.conselho, profissional?.numero_conselho, profissional?.uf_conselho].filter(Boolean).join(" ") || profissional?.especialidade || "—"}</p>
                <p>Liberado em {fmt(laudo.liberado_em)} · revisão {laudo.revisao}</p>
                <p className="mt-1 break-all font-mono text-[11px] text-slate-400">Hash: {laudo.assinatura_hash ?? "—"}</p>
              </div>
            </div>
          )}

          {!liberado ? (
            <form action={liberarLaudoImagem} className="his-card p-5">
              <input type="hidden" name="laudo_id" value={laudo.id} />
              <input type="hidden" name="retorno" value="editor" />
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div><h2 className="font-black">Assinar e liberar</h2><p className="text-sm text-slate-500">A liberação assina o laudo, fecha a solicitação e impede edição direta.</p></div>
                <button className="ui-button-primary"><CheckCircle2 className="size-4" /> Assinar e liberar</button>
              </div>
            </form>
          ) : (
            <form action={abrirRetificacaoLaudoImagem} className="his-card p-5">
              <input type="hidden" name="laudo_id" value={laudo.id} />
              <div className="flex items-center gap-2"><RotateCcw className="size-5 text-amber-700" /><h2 className="font-black">Abrir retificação</h2></div>
              <p className="mt-1 text-sm text-slate-500">O conteúdo liberado fica preservado no histórico e uma nova revisão editável é aberta.</p>
              <div className="mt-4 flex flex-col gap-3 sm:flex-row"><input name="motivo" required className="ui-input flex-1" placeholder="Motivo obrigatório da retificação" /><button className="ui-button-secondary">Retificar laudo</button></div>
            </form>
          )}
        </div>

        <aside className="space-y-4">
          <div className="his-card p-5">
            <div className="flex items-center gap-2"><FileClock className="size-5 text-brand-700" /><h2 className="font-black">Histórico</h2></div>
            <div className="mt-4 space-y-3">
              {historico.length ? historico.map((h) => <div key={h.id} className="rounded-xl border border-slate-100 p-3"><div className="flex items-center justify-between gap-2"><span className="text-sm font-black">Revisão {h.revisao}</span><span className="text-xs text-slate-400">{fmt(h.criado_em)}</span></div><p className="mt-1 text-xs text-slate-500">{h.motivo ?? "Registro de versão"}</p></div>) : <p className="text-sm text-slate-500">O histórico será criado na primeira liberação.</p>}
            </div>
          </div>
          <div className="his-card p-5 text-sm text-slate-600">
            <h2 className="font-black text-slate-900">Integração PACS/DICOM</h2>
            <p className="mt-2">O RIS preserva accession, Study Instance UID, Series Instance UID e a referência do PACS. O armazenamento/visualizador DICOM pode ser integrado sem alterar o laudo clínico.</p>
            {execucao?.pacs_url && !pacsUrl ? <p className="mt-2 rounded-lg bg-amber-50 p-2 text-xs text-amber-800">Há uma referência PACS cadastrada, mas ela não é uma URL HTTP/HTTPS navegável.</p> : null}
          </div>
        </aside>
      </section>
    </SectionPage>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <div><p className="text-[11px] font-black uppercase tracking-wider text-slate-400">{label}</p><p className="mt-1 break-words font-semibold text-slate-700">{value}</p></div>;
}

function ReportSection({ title, value }: { title: string; value?: string | null }) {
  if (!value) return null;
  return <section className="mb-5"><h3 className="mb-2 text-xs font-black uppercase tracking-wider text-slate-400">{title}</h3><p className="whitespace-pre-wrap text-sm leading-7 text-slate-800">{value}</p></section>;
}
