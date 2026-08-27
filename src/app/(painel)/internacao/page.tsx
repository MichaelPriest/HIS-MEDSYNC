import type { Route } from "next";
import Link from "next/link";
import { BedDouble, ClipboardCheck, DoorOpen, Hospital, ShieldAlert, UserRoundCheck } from "lucide-react";
import { EncounterPicker } from "@/components/atendimentos/encounter-picker";
import { SectionPage } from "@/components/painel/section-page";
import { ProfessionalRemotePicker } from "@/components/profissionais/professional-remote-picker";
import { getAssistencialContext } from "@/modules/assistencial/context";
import { criarInternacao } from "@/modules/internacao/actions";

type Rel<T> = T | T[] | null;
type Paciente = { nome_completo: string | null; cpf: string | null; ra: string | null; numero_registro: string | null };
type Atendimento = { id: string; numero_atendimento: string | number | null; data_abertura: string; paciente: Rel<Paciente> };
type Internacao = {
  id: string;
  atendimento_id: string;
  setor: string;
  quarto: string | null;
  leito: string | null;
  leito_id: string | null;
  acomodacao: string | null;
  motivo: string | null;
  previsao_alta: string | null;
  status: string;
  data_internacao: string | null;
  isolamento: boolean | null;
  tipo_isolamento: string | null;
  atendimento: Rel<{ id: string; numero_atendimento: string | number | null; paciente: Rel<{ nome_completo: string | null; ra: string | null }> }>;
  profissional: Rel<{ nome_completo: string | null }>;
};
type Leito = { id: string; setor: string; quarto: string | null; codigo: string; acomodacao: string | null; status: string; ativo: boolean };
type PendenciaAlta = { internacao_id: string; bloqueia_alta: boolean; status: string };
type Params = { sucesso?: string; erro?: string };

const one = <T,>(value: Rel<T>): T | null => Array.isArray(value) ? value[0] ?? null : value;
const fmt = (value?: string | null) => value ? new Date(value).toLocaleString("pt-BR") : "—";
const fmtDate = (value?: string | null) => value ? new Date(`${value}T12:00:00`).toLocaleDateString("pt-BR") : "—";

export default async function InternacaoPage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const { supabase, empresaId, unidadeId } = await getAssistencialContext();
  if (!unidadeId) return null;

  const [atendimentosReq, internacoesReq, leitosReq, pendenciasReq] = await Promise.all([
    supabase
      .from("atendimentos")
      .select("id,numero_atendimento,data_abertura,paciente:pacientes(nome_completo,cpf,ra,numero_registro)")
      .eq("empresa_id", empresaId)
      .eq("unidade_id", unidadeId)
      .in("status", ["aberto", "em_espera", "em_atendimento"])
      .order("data_abertura", { ascending: false })
      .limit(300),
    supabase
      .from("internacoes")
      .select("id,atendimento_id,setor,quarto,leito,leito_id,acomodacao,motivo,previsao_alta,status,data_internacao,isolamento,tipo_isolamento,atendimento:atendimentos(id,numero_atendimento,paciente:pacientes(nome_completo,ra)),profissional:profissionais(nome_completo)")
      .eq("empresa_id", empresaId)
      .eq("unidade_id", unidadeId)
      .in("status", ["aguardando_leito", "internado", "transferido"])
      .order("data_internacao", { ascending: false })
      .limit(250),
    supabase
      .from("leitos")
      .select("id,setor,quarto,codigo,acomodacao,status,ativo")
      .eq("empresa_id", empresaId)
      .eq("unidade_id", unidadeId)
      .eq("ativo", true)
      .order("setor")
      .order("codigo")
      .limit(1000),
    supabase
      .from("alta_pendencias")
      .select("internacao_id,bloqueia_alta,status")
      .eq("empresa_id", empresaId)
      .eq("unidade_id", unidadeId)
      .eq("bloqueia_alta", true)
      .neq("status", "resolvida")
      .limit(1000),
  ]);

  const atendimentos = (atendimentosReq.data ?? []) as Atendimento[];
  const internacoes = (internacoesReq.data ?? []) as Internacao[];
  const leitos = (leitosReq.data ?? []) as Leito[];
  const pendencias = (pendenciasReq.data ?? []) as PendenciaAlta[];
  const pendenciasPorInternacao = new Map<string, number>();
  for (const item of pendencias) pendenciasPorInternacao.set(item.internacao_id, (pendenciasPorInternacao.get(item.internacao_id) ?? 0) + 1);

  const encounters = atendimentos.map((item) => {
    const paciente = one(item.paciente);
    return {
      id: item.id,
      numero_atendimento: item.numero_atendimento,
      data_abertura: item.data_abertura,
      paciente: {
        nome_completo: paciente?.nome_completo ?? "Paciente",
        cpf: paciente?.cpf ?? null,
        ra: paciente?.ra ?? null,
        numero_registro: paciente?.numero_registro ?? null,
      },
    };
  });

  const livres = leitos.filter((item) => item.status === "livre").length;
  const aguardandoLeito = internacoes.filter((item) => item.status === "aguardando_leito" || !item.leito_id).length;
  const isolamentos = internacoes.filter((item) => item.isolamento).length;
  const comPendenciasAlta = [...pendenciasPorInternacao.keys()].length;

  return (
    <SectionPage
      eyebrow="Assistencial / Internação"
      title="Painel da Internação"
      description="Visão resumida das internações ativas. Leitos, regulação NIR e alta segura possuem áreas próprias para reduzir a complexidade da operação."
      actions={
        <div className="flex flex-wrap gap-2">
          <Link href="/internacao/leitos" className="ui-button-secondary"><BedDouble className="size-4" />Mapa de leitos</Link>
          <Link href="/internacao/nir" className="ui-button-secondary"><Hospital className="size-4" />Gestão NIR</Link>
          <Link href="/internacao/altas" className="ui-button-primary"><ClipboardCheck className="size-4" />Central de altas</Link>
        </div>
      }
    >
      {params.sucesso ? <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">Operação concluída com sucesso.</div> : null}
      {params.erro ? <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">Não foi possível concluir a operação da internação.</div> : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Kpi label="Internações ativas" value={internacoes.length} icon={<UserRoundCheck className="size-5 text-brand-600" />} />
        <Kpi label="Leitos livres" value={livres} icon={<DoorOpen className="size-5 text-emerald-600" />} />
        <Kpi label="Aguardando leito" value={aguardandoLeito} icon={<Hospital className="size-5 text-violet-600" />} />
        <Kpi label="Em isolamento" value={isolamentos} icon={<ShieldAlert className="size-5 text-rose-600" />} />
        <Kpi label="Pendências de alta" value={comPendenciasAlta} icon={<ClipboardCheck className="size-5 text-amber-600" />} />
      </section>

      <section className="mt-5 his-card p-5">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <h2 className="font-black text-slate-950">Nova internação</h2>
            <p className="mt-1 text-sm text-slate-500">Admite o atendimento em leito livre ou envia sem leito para regulação posterior na NIR.</p>
          </div>
          <Link href="/internacao/nir" className="text-xs font-black text-brand-700 hover:underline">Abrir fila regulatória →</Link>
        </div>
        <form action={criarInternacao} className="grid gap-3 lg:grid-cols-4">
          <div className="lg:col-span-4"><EncounterPicker encounters={encounters} name="atendimento_id" /></div>
          <ProfessionalRemotePicker
            empresaId={empresaId}
            name="profissional_responsavel_id"
            label="Responsável clínico"
            placeholder="Buscar responsável por nome, conselho, especialidade ou CBO"
          />
          <input name="setor" required className="ui-input" placeholder="Setor de internação" />
          <select name="leito_id" defaultValue="" className="ui-input"><option value="">Sem leito — enviar para NIR</option>{leitos.filter((item) => item.status === "livre").map((item) => <option key={item.id} value={item.id}>{item.setor} · {item.quarto ?? ""} · {item.codigo}</option>)}</select>
          <select name="acomodacao" defaultValue="" className="ui-input"><option value="">Acomodação</option><option value="enfermaria">Enfermaria</option><option value="apartamento">Apartamento</option><option value="uti">UTI</option><option value="observacao">Observação</option></select>
          <input name="previsao_alta" type="date" className="ui-input" />
          <input name="motivo" className="ui-input lg:col-span-2" placeholder="Motivo da internação" />
          <input name="observacoes" className="ui-input" placeholder="Observações" />
          <button className="ui-button-primary">Registrar internação</button>
        </form>
      </section>

      <section className="mt-5 his-card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div><h2 className="font-black text-slate-950">Pacientes internados</h2><p className="mt-1 text-sm text-slate-500">Resumo assistencial e de localização. Movimentação de leitos fica na NIR e a alta na Central de Altas.</p></div>
          <span className="rounded-xl bg-slate-50 px-3 py-2 text-xs font-bold text-slate-500">{internacoes.length} ativo(s)</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-3">Paciente</th><th className="px-4 py-3">Local</th><th className="px-4 py-3">Responsável</th><th className="px-4 py-3">Internação</th><th className="px-4 py-3">Previsão alta</th><th className="px-4 py-3">Situação</th><th className="px-5 py-3 text-right">Ações</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {internacoes.map((internacao) => {
                const atendimento = one(internacao.atendimento);
                const paciente = one(atendimento?.paciente ?? null);
                const profissional = one(internacao.profissional);
                const blockers = pendenciasPorInternacao.get(internacao.id) ?? 0;
                return (
                  <tr key={internacao.id} className="bg-white align-middle">
                    <td className="px-5 py-4"><p className="font-black text-slate-950">{paciente?.nome_completo ?? "Paciente"}</p><p className="mt-1 text-xs text-slate-500">Atend. #{atendimento?.numero_atendimento ?? "—"} · RA {paciente?.ra ?? "—"}</p></td>
                    <td className="px-4 py-4"><p className="font-semibold text-slate-800">{internacao.setor}</p><p className="text-xs text-slate-500">{internacao.quarto ? `Quarto ${internacao.quarto} · ` : ""}{internacao.leito ?? "Aguardando leito"}</p></td>
                    <td className="px-4 py-4 text-slate-600">{profissional?.nome_completo ?? "A definir"}</td>
                    <td className="px-4 py-4 text-slate-600">{fmt(internacao.data_internacao)}</td>
                    <td className="px-4 py-4 text-slate-600">{fmtDate(internacao.previsao_alta)}</td>
                    <td className="px-4 py-4"><div className="flex flex-wrap gap-1.5">{internacao.isolamento ? <span className="rounded-lg bg-rose-50 px-2 py-1 text-xs font-black text-rose-700">Isolamento{internacao.tipo_isolamento ? ` · ${internacao.tipo_isolamento}` : ""}</span> : null}{blockers ? <span className="rounded-lg bg-amber-50 px-2 py-1 text-xs font-black text-amber-700">{blockers} pendência(s) de alta</span> : <span className="rounded-lg bg-slate-50 px-2 py-1 text-xs font-bold text-slate-500">{internacao.status.replaceAll("_", " ")}</span>}</div></td>
                    <td className="px-5 py-4"><div className="flex justify-end gap-2">{atendimento?.id ? <Link href={`/prontuario/${atendimento.id}` as Route} className="ui-button-secondary">Prontuário</Link> : null}<Link href={`/internacao/altas/${internacao.id}` as Route} className="ui-button-secondary">Alta</Link></div></td>
                  </tr>
                );
              })}
              {!internacoes.length ? <tr><td colSpan={7} className="px-6 py-14 text-center text-slate-500">Nenhuma internação ativa nesta unidade.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>
    </SectionPage>
  );
}

function Kpi({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return <div className="his-kpi"><div className="flex items-center justify-between"><p className="text-xs font-black uppercase tracking-wider text-slate-400">{label}</p>{icon}</div><p className="mt-2 text-3xl font-black text-brand-950">{value}</p></div>;
}
