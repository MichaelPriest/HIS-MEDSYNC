import Link from "next/link";
import type { Route } from "next";
import { BedDouble, CalendarClock, ShieldCheck, UserRound } from "lucide-react";
import { notFound } from "next/navigation";
import { SectionPage } from "@/components/painel/section-page";
import { ProfessionalRemotePicker } from "@/components/profissionais/professional-remote-picker";
import { requireAnyPermission } from "@/lib/permissions/server";
import { admitirPacienteInternacao } from "@/modules/internacao/contextual-actions";

type Rel<T> = T | T[] | null;

type PacienteResumo = {
  nome_completo: string | null;
  cpf: string | null;
  cns: string | null;
  ra: string | null;
  numero_registro: number | null;
};

type ConvenioResumo = { nome_fantasia: string | null; razao_social: string | null };
type PlanoResumo = { nome: string | null };
type AnsDomain = { codigo: string; display: string; versao: string; canonical: string };

function one<T>(value: Rel<T>) {
  return Array.isArray(value) ? value[0] ?? null : value;
}

export default async function NovaInternacaoContextualPage({
  params,
  searchParams,
}: {
  params: Promise<{ atendimentoId: string }>;
  searchParams: Promise<{ erro?: string; internacao?: string }>;
}) {
  const { atendimentoId } = await params;
  const sp = await searchParams;
  const { supabase, empresaId, unidadeId } = await requireAnyPermission([
    "internacao.admitir",
    "internacao.criar",
  ]);

  if (!unidadeId) notFound();

  const [{ data: atendimento }, { data: leitos }, { data: internacaoAtiva }, { data: acomodacoesAns }] = await Promise.all([
    supabase
      .from("atendimentos")
      .select("id,numero_atendimento,status,tipo_atendimento,origem,cobertura,paciente:pacientes(nome_completo,cpf,cns,ra,numero_registro),convenio:convenios(nome_fantasia,razao_social),plano:convenio_planos(nome)")
      .eq("id", atendimentoId)
      .eq("empresa_id", empresaId)
      .eq("unidade_id", unidadeId)
      .maybeSingle(),
    supabase
      .from("leitos")
      .select("id,setor,quarto,codigo,acomodacao,isolamento_capaz")
      .eq("empresa_id", empresaId)
      .eq("unidade_id", unidadeId)
      .eq("ativo", true)
      .eq("status", "livre")
      .order("setor")
      .order("codigo")
      .limit(500),
    supabase
      .from("internacoes")
      .select("id,status,setor,leito,previsao_alta")
      .eq("empresa_id", empresaId)
      .eq("unidade_id", unidadeId)
      .eq("atendimento_id", atendimentoId)
      .in("status", ["aguardando_leito", "internado", "transferido"])
      .order("data_internacao", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("ans_fhir_dominios_ativos")
      .select("codigo,display,versao,canonical,ordem")
      .eq("tabela", 49)
      .order("ordem"),
  ]);

  if (!atendimento) notFound();

  const paciente = one(atendimento.paciente as Rel<PacienteResumo>);
  const convenio = one(atendimento.convenio as Rel<ConvenioResumo>);
  const plano = one(atendimento.plano as Rel<PlanoResumo>);
  const prontuarioHref = `/prontuario/${atendimentoId}` as Route;
  const acomodacoes = (acomodacoesAns ?? []) as AnsDomain[];
  const versaoAns = acomodacoes[0]?.versao ?? null;

  return (
    <SectionPage
      eyebrow="Assistencial / Internação"
      title="Admitir paciente"
      description={`Atendimento #${atendimento.numero_atendimento ?? "—"} · RA ${paciente?.ra ?? "—"} · contexto preservado do prontuário`}
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Link href={prontuarioHref} className="text-sm font-semibold text-brand-700 hover:text-brand-900">
          ← Voltar ao prontuário
        </Link>
        <Link href="/internacao" className="ui-button-secondary">
          <BedDouble className="size-4" /> Abrir mapa de leitos
        </Link>
      </div>

      {sp.erro ? (
        <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
          Não foi possível concluir a admissão: {sp.erro.replaceAll("-", " ")}.
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-3">
        <article className="ui-card p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900"><UserRound className="size-4 text-brand-700" />Paciente</div>
          <p className="mt-3 font-black text-slate-950">{paciente?.nome_completo ?? "Paciente"}</p>
          <p className="mt-1 text-sm text-slate-500">Registro #{paciente?.numero_registro ?? "—"} · RA {paciente?.ra ?? "—"}</p>
          <p className="mt-1 text-xs text-slate-400">CPF {paciente?.cpf ?? "—"} · CNS {paciente?.cns ?? "—"}</p>
        </article>
        <article className="ui-card p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900"><ShieldCheck className="size-4 text-brand-700" />Cobertura</div>
          <p className="mt-3 font-black text-slate-950">{atendimento.cobertura === "convenio" ? (convenio?.nome_fantasia || convenio?.razao_social || "Convênio") : "Particular"}</p>
          <p className="mt-1 text-sm text-slate-500">{plano?.nome ?? "Sem plano informado"}</p>
        </article>
        <article className="ui-card p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900"><CalendarClock className="size-4 text-brand-700" />Episódio</div>
          <p className="mt-3 font-black capitalize text-slate-950">{atendimento.tipo_atendimento ?? "Atendimento"}</p>
          <p className="mt-1 text-sm text-slate-500">Origem {atendimento.origem ?? "—"} · Status {atendimento.status}</p>
        </article>
      </div>

      {internacaoAtiva ? (
        <section className="ui-card mt-5 border-amber-200 bg-amber-50/50 p-5">
          <h2 className="font-black text-amber-950">Este episódio já possui internação ativa</h2>
          <p className="mt-2 text-sm text-amber-800">
            Status: {internacaoAtiva.status} · {internacaoAtiva.setor ?? "Setor não definido"}{internacaoAtiva.leito ? ` · Leito ${internacaoAtiva.leito}` : " · aguardando leito"}.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href="/internacao" className="ui-button-primary">Gerenciar internação</Link>
            <Link href={prontuarioHref} className="ui-button-secondary">Voltar ao episódio</Link>
          </div>
        </section>
      ) : (
        <section className="ui-card mt-5 p-5 sm:p-6">
          <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-black text-slate-950">Dados da admissão</h2>
              <p className="mt-1 text-sm text-slate-500">
                O atendimento já está definido. Se nenhum leito for escolhido, o paciente ficará em aguardando leito no NIR/mapa de internação.
              </p>
            </div>
            {versaoAns ? <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-800">ANS/FHIR {versaoAns}</span> : null}
          </div>

          <form action={admitirPacienteInternacao} className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <input type="hidden" name="atendimento_id" value={atendimentoId} />
            <label className="text-sm font-semibold text-slate-700">
              Setor de internação *
              <input name="setor" required className="ui-input mt-1.5" placeholder="Ex.: Clínica Médica" />
            </label>
            <ProfessionalRemotePicker
              empresaId={empresaId}
              name="profissional_responsavel_id"
              label="Responsável clínico"
              placeholder="Buscar responsável por nome, conselho, especialidade ou CBO"
            />
            <label className="text-sm font-semibold text-slate-700">
              Leito
              <select name="leito_id" defaultValue="" className="ui-input mt-1.5">
                <option value="">Aguardar alocação</option>
                {(leitos ?? []).map((leito) => (
                  <option key={leito.id} value={leito.id}>
                    {leito.setor} · {leito.quarto ? `${leito.quarto} · ` : ""}{leito.codigo}{leito.isolamento_capaz ? " · isolamento" : ""}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-semibold text-slate-700">
              Categoria contratual da acomodação
              <select name="acomodacao" defaultValue="" className="ui-input mt-1.5">
                <option value="">Não informada</option>
                <option value="enfermaria">Enfermaria</option>
                <option value="apartamento">Apartamento</option>
                <option value="uti">UTI</option>
                <option value="observacao">Observação</option>
              </select>
              <span className="mt-1 block text-xs font-normal text-slate-400">Usada nas regras contratuais e de precificação.</span>
            </label>
            <label className="text-sm font-semibold text-slate-700 md:col-span-2">
              Acomodação ANS · Tabela 49{atendimento.cobertura === "convenio" ? " *" : ""}
              <select name="acomodacao_tuss49_codigo" defaultValue="" required={atendimento.cobertura === "convenio"} className="ui-input mt-1.5">
                <option value="">Selecione a acomodação oficial</option>
                {acomodacoes.map((item) => <option key={item.codigo} value={item.codigo}>{item.codigo} — {item.display}</option>)}
              </select>
              <span className="mt-1 block text-xs font-normal text-slate-400">O código, descrição, canonical e versão são preservados na internação.</span>
            </label>
            <label className="text-sm font-semibold text-slate-700">
              Previsão de alta
              <input name="previsao_alta" type="date" className="ui-input mt-1.5" />
            </label>
            <label className="text-sm font-semibold text-slate-700 md:col-span-2">
              Motivo da internação
              <input name="motivo" className="ui-input mt-1.5" placeholder="Indicação clínica / hipótese principal" />
            </label>
            <label className="text-sm font-semibold text-slate-700 xl:col-span-4">
              Observações para admissão / NIR
              <textarea name="observacoes" rows={3} className="ui-input mt-1.5 min-h-24" placeholder="Precauções, necessidades especiais, suporte necessário..." />
            </label>
            <div className="xl:col-span-4 flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4">
              <Link href={prontuarioHref} className="ui-button-secondary">Cancelar</Link>
              <button className="ui-button-primary"><BedDouble className="size-4" />Confirmar admissão</button>
            </div>
          </form>
        </section>
      )}
    </SectionPage>
  );
}
