import type { Route } from "next";
import Link from "next/link";
import { AlertTriangle, BedDouble, Clock3, DoorOpen, Filter, LockKeyhole, Search, ShieldCheck, Sparkles, UserRoundCheck } from "lucide-react";
import { SectionPage } from "@/components/painel/section-page";
import { requireAnyPermission } from "@/lib/permissions/server";
import {
  bloquearLeitoOperacional,
  concluirHigienizacaoOperacional,
  desbloquearLeitoOperacional,
  iniciarHigienizacaoOperacional,
} from "@/modules/internacao/leitos-actions";

type Rel<T> = T | T[] | null;
type Estrutura = { id: string; nome: string; codigo: string; tipo: string };
type Leito = {
  id: string;
  setor: string;
  quarto: string | null;
  codigo: string;
  tipo: string | null;
  acomodacao: string | null;
  sexo_restricao: string | null;
  isolamento_capaz: boolean | null;
  status: string;
  estrutura: Rel<Estrutura>;
};
type Paciente = { nome_completo: string | null; ra: string | null };
type Atendimento = { id: string; numero_atendimento: string | number | null; paciente: Rel<Paciente> };
type Reserva = { id: string; leito_id: string; reservado_ate: string | null; atendimento: Rel<Atendimento> };
type Bloqueio = { id: string; leito_id: string; tipo: string; motivo: string | null };
type Higienizacao = { id: string; leito_id: string; status: string; solicitada_em: string | null };
type Internacao = {
  id: string;
  leito_id: string | null;
  data_internacao: string | null;
  previsao_alta: string | null;
  isolamento: boolean | null;
  tipo_isolamento: string | null;
  atendimento: Rel<Atendimento>;
};
type Params = { q?: string; status?: string; setor?: string; sucesso?: string; erro?: string };

type BedCardProps = {
  bed: Leito;
  reserva?: Reserva;
  bloqueio?: Bloqueio;
  higiene?: Higienizacao;
  internacao?: Internacao;
  canManage: boolean;
};

const one = <T,>(value: Rel<T>): T | null => Array.isArray(value) ? value[0] ?? null : value;
const fmt = (value?: string | null) => value ? new Date(value).toLocaleString("pt-BR") : "—";
const fmtDate = (value?: string | null) => value ? new Date(`${value}T12:00:00`).toLocaleDateString("pt-BR") : "—";
const durationSince = (value?: string | null) => {
  if (!value) return "—";
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60000));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours < 24) return `${hours}h${rest ? ` ${rest}min` : ""}`;
  const days = Math.floor(hours / 24);
  return `${days}d ${hours % 24}h`;
};

const statusLabels: Record<string, string> = {
  livre: "Livre",
  ocupado: "Ocupado",
  reservado: "Reservado",
  higienizacao: "Higienização",
  bloqueado: "Bloqueado",
  manutencao: "Manutenção",
};

const statusStyle: Record<string, string> = {
  livre: "border-emerald-200 bg-emerald-50 text-emerald-700",
  ocupado: "border-blue-200 bg-blue-50 text-blue-700",
  reservado: "border-violet-200 bg-violet-50 text-violet-700",
  higienizacao: "border-amber-200 bg-amber-50 text-amber-700",
  bloqueado: "border-rose-200 bg-rose-50 text-rose-700",
  manutencao: "border-slate-300 bg-slate-100 text-slate-700",
};

function keyArea(leito: Leito) {
  return one(leito.estrutura)?.nome ?? leito.setor ?? "Sem ala definida";
}

export default async function LeitosPage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const { supabase, empresaId, unidadeId } = await requireAnyPermission([
    "internacao.visualizar",
    "leitos.gerenciar",
    "internacao.gerenciar",
  ]);
  if (!unidadeId) return null;

  const [manageReq, leitosReq, reservasReq, bloqueiosReq, higieneReq, internacoesReq] = await Promise.all([
    supabase.rpc("tem_permissao", { p_empresa: empresaId, p_unidade: unidadeId, p_codigo: "leitos.gerenciar" }),
    supabase
      .from("leitos")
      .select("id,setor,quarto,codigo,tipo,acomodacao,sexo_restricao,isolamento_capaz,status,estrutura:estruturas_fisicas(id,nome,codigo,tipo)")
      .eq("empresa_id", empresaId)
      .eq("unidade_id", unidadeId)
      .eq("ativo", true)
      .order("setor")
      .order("codigo")
      .limit(1000),
    supabase
      .from("leito_reservas")
      .select("id,leito_id,reservado_ate,atendimento:atendimentos(id,numero_atendimento,paciente:pacientes(nome_completo,ra))")
      .eq("empresa_id", empresaId)
      .eq("unidade_id", unidadeId)
      .eq("status", "ativa"),
    supabase
      .from("leito_bloqueios")
      .select("id,leito_id,tipo,motivo")
      .eq("empresa_id", empresaId)
      .eq("unidade_id", unidadeId)
      .eq("status", "ativo"),
    supabase
      .from("leito_higienizacoes")
      .select("id,leito_id,status,solicitada_em")
      .eq("empresa_id", empresaId)
      .eq("unidade_id", unidadeId)
      .in("status", ["pendente", "em_andamento"]),
    supabase
      .from("internacoes")
      .select("id,leito_id,data_internacao,previsao_alta,isolamento,tipo_isolamento,atendimento:atendimentos(id,numero_atendimento,paciente:pacientes(nome_completo,ra))")
      .eq("empresa_id", empresaId)
      .eq("unidade_id", unidadeId)
      .in("status", ["internado", "transferido"]),
  ]);

  const canManage = manageReq.data === true;
  const allBeds = (leitosReq.data ?? []) as Leito[];
  const reservas = (reservasReq.data ?? []) as Reserva[];
  const bloqueios = (bloqueiosReq.data ?? []) as Bloqueio[];
  const higienizacoes = (higieneReq.data ?? []) as Higienizacao[];
  const internacoes = (internacoesReq.data ?? []) as Internacao[];

  const reservaByBed = new Map(reservas.map((item) => [item.leito_id, item]));
  const bloqueioByBed = new Map(bloqueios.map((item) => [item.leito_id, item]));
  const higieneByBed = new Map(higienizacoes.map((item) => [item.leito_id, item]));
  const internacaoByBed = new Map(internacoes.filter((item) => item.leito_id).map((item) => [item.leito_id as string, item]));

  const query = params.q?.trim().toLowerCase() ?? "";
  const setor = params.setor?.trim() ?? "";
  const status = params.status?.trim() ?? "";
  const areas = [...new Set(allBeds.map(keyArea))].sort((a, b) => a.localeCompare(b, "pt-BR"));

  const filtered = allBeds.filter((bed) => {
    if (status && bed.status !== status) return false;
    if (setor && keyArea(bed) !== setor) return false;
    if (query) {
      const internacao = internacaoByBed.get(bed.id);
      const atendimento = one(internacao?.atendimento ?? null);
      const paciente = one(atendimento?.paciente ?? null);
      const haystack = `${keyArea(bed)} ${bed.setor} ${bed.quarto ?? ""} ${bed.codigo} ${bed.acomodacao ?? ""} ${bed.tipo ?? ""} ${paciente?.nome_completo ?? ""} ${paciente?.ra ?? ""}`.toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    return true;
  });

  const stats = {
    total: allBeds.length,
    livre: allBeds.filter((item) => item.status === "livre").length,
    ocupado: allBeds.filter((item) => item.status === "ocupado").length,
    reservado: allBeds.filter((item) => item.status === "reservado").length,
    giro: allBeds.filter((item) => item.status === "higienizacao").length,
    indisponivel: allBeds.filter((item) => ["bloqueado", "manutencao"].includes(item.status)).length,
  };
  const ocupacao = stats.total ? Math.round((stats.ocupado / stats.total) * 100) : 0;
  const groups = new Map<string, Leito[]>();
  for (const bed of filtered) groups.set(keyArea(bed), [...(groups.get(keyArea(bed)) ?? []), bed]);

  const successMessage: Record<string, string> = {
    bloqueio: "Leito bloqueado com sucesso.",
    desbloqueio: "Leito liberado do bloqueio.",
    "higienizacao-iniciada": "Higienização iniciada.",
    "higienizacao-concluida": "Higienização concluída e leito liberado.",
  };
  const errorMessage: Record<string, string> = {
    "campos-operacao": "Preencha os dados necessários para a operação do leito.",
    bloqueio: "Não foi possível bloquear o leito.",
    desbloqueio: "Não foi possível liberar o bloqueio.",
    higienizacao: "Não foi possível atualizar a higienização.",
  };

  return (
    <SectionPage
      eyebrow="Assistencial / Internação"
      title="Mapa de Leitos"
      description="Censo operacional em tempo real por ala e UTI, com ocupação, giro, indisponibilidade e contexto do paciente."
      actions={
        <div className="flex gap-2">
          <Link href="/internacao/nir" className="ui-button-primary">Gestão NIR</Link>
          {canManage ? <Link href="/configuracoes/estrutura/leitos" className="ui-button-secondary">Cadastro de leitos</Link> : null}
        </div>
      }
    >
      {params.sucesso ? <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">{successMessage[params.sucesso] ?? "Operação concluída."}</div> : null}
      {params.erro ? <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{errorMessage[params.erro] ?? "Não foi possível concluir a operação."}</div> : null}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-brand-100 bg-brand-50 px-4 py-3 text-sm text-brand-950">
        <div><strong>Foco desta tela:</strong> disponibilidade física, ocupante, bloqueio/manutenção e higienização do leito.</div>
        <div className="flex flex-wrap gap-2 text-xs font-bold"><span className="rounded-lg bg-white px-2.5 py-1 text-brand-700">Reservas e alocação → NIR</span><span className="rounded-lg bg-white px-2.5 py-1 text-brand-700">Cadastro → Estrutura</span></div>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-7">
        <Kpi label="Leitos ativos" value={stats.total} icon={<BedDouble className="size-5 text-brand-600" />} />
        <Kpi label="Livres" value={stats.livre} icon={<DoorOpen className="size-5 text-emerald-600" />} />
        <Kpi label="Ocupados" value={stats.ocupado} icon={<UserRoundCheck className="size-5 text-blue-600" />} />
        <Kpi label="Reservados" value={stats.reservado} icon={<Clock3 className="size-5 text-violet-600" />} />
        <Kpi label="Em higienização" value={stats.giro} icon={<Sparkles className="size-5 text-amber-600" />} />
        <Kpi label="Indisponíveis" value={stats.indisponivel} icon={<LockKeyhole className="size-5 text-rose-600" />} />
        <div className="his-kpi"><p className="text-xs font-black uppercase tracking-wider text-slate-400">Taxa de ocupação</p><p className="mt-2 text-3xl font-black text-brand-950">{ocupacao}%</p><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-brand-600" style={{ width: `${Math.min(100, ocupacao)}%` }} /></div></div>
      </section>

      <form className="his-card mt-5 grid gap-3 p-4 md:grid-cols-[1fr_240px_200px_auto]">
        <label className="relative"><Search className="absolute left-3 top-3 size-4 text-slate-400" /><input name="q" defaultValue={params.q ?? ""} placeholder="Leito, quarto, ala, paciente ou RA..." className="ui-input pl-9" /></label>
        <select name="setor" defaultValue={setor} className="ui-input"><option value="">Todas as alas/UTI</option>{areas.map((item) => <option key={item} value={item}>{item}</option>)}</select>
        <select name="status" defaultValue={status} className="ui-input"><option value="">Todos os status</option>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
        <button className="ui-button-secondary"><Filter className="size-4" />Filtrar</button>
      </form>

      <div className="mt-4 space-y-4">
        {[...groups.entries()].map(([area, beds]) => {
          const livres = beds.filter((item) => item.status === "livre").length;
          const ocupados = beds.filter((item) => item.status === "ocupado").length;
          const giro = beds.filter((item) => item.status === "higienizacao").length;
          const areaOccupancy = beds.length ? Math.round((ocupados / beds.length) * 100) : 0;
          return (
            <section key={area} className="his-card overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/60 px-5 py-4">
                <div><p className="text-[10px] font-black uppercase tracking-[.14em] text-slate-400">Ala / UTI</p><h2 className="mt-1 text-base font-black text-slate-950">{area}</h2></div>
                <div className="flex flex-wrap items-center gap-2 text-xs font-bold"><span className="rounded-lg bg-emerald-50 px-2.5 py-1 text-emerald-700">{livres} livres</span><span className="rounded-lg bg-blue-50 px-2.5 py-1 text-blue-700">{ocupados} ocupados</span><span className="rounded-lg bg-amber-50 px-2.5 py-1 text-amber-700">{giro} em giro</span><span className="rounded-lg bg-white px-2.5 py-1 text-slate-500 ring-1 ring-slate-200">{areaOccupancy}% ocupação</span></div>
              </div>
              <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                {beds.map((bed) => (
                  <BedCard
                    key={bed.id}
                    bed={bed}
                    reserva={reservaByBed.get(bed.id)}
                    bloqueio={bloqueioByBed.get(bed.id)}
                    higiene={higieneByBed.get(bed.id)}
                    internacao={internacaoByBed.get(bed.id)}
                    canManage={canManage}
                  />
                ))}
              </div>
            </section>
          );
        })}

        {!filtered.length ? (
          <div className="his-card p-12 text-center">
            <BedDouble className="mx-auto size-10 text-slate-300" />
            <p className="mt-3 font-black text-slate-700">Nenhum leito encontrado</p>
            <p className="mt-1 text-sm text-slate-500">Ajuste os filtros ou verifique o cadastro em Configurações → Estrutura → Cadastro de leitos.</p>
          </div>
        ) : null}
      </div>
    </SectionPage>
  );
}

function BedCard({ bed, reserva, bloqueio, higiene, internacao, canManage }: BedCardProps) {
  const atendimento = one(internacao?.atendimento ?? null);
  const paciente = one(atendimento?.paciente ?? null);
  const reservadoAtendimento = one(reserva?.atendimento ?? null);
  const reservadoPaciente = one(reservadoAtendimento?.paciente ?? null);

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">{bed.quarto ? `Quarto ${bed.quarto}` : bed.tipo ?? "Leito"}</p>
          <h3 className="mt-1 text-xl font-black text-slate-950">{bed.codigo}</h3>
          <p className="mt-1 text-xs text-slate-500">{bed.acomodacao ?? bed.tipo ?? "—"}{bed.sexo_restricao ? ` · ${bed.sexo_restricao}` : ""}</p>
        </div>
        <span className={`rounded-full border px-2.5 py-1 text-xs font-black ${statusStyle[bed.status] ?? "border-slate-200 bg-slate-50 text-slate-700"}`}>{statusLabels[bed.status] ?? bed.status}</span>
      </div>

      <div className="mt-3 flex flex-wrap gap-1">
        {bed.isolamento_capaz ? <span className="rounded-md bg-cyan-50 px-2 py-1 text-[10px] font-black uppercase text-cyan-700"><ShieldCheck className="mr-1 inline size-3" />Apto a isolamento</span> : null}
        {internacao?.isolamento ? <span className="rounded-md bg-rose-50 px-2 py-1 text-[10px] font-black uppercase text-rose-700"><AlertTriangle className="mr-1 inline size-3" />Paciente em isolamento{internacao.tipo_isolamento ? ` · ${internacao.tipo_isolamento}` : ""}</span> : null}
      </div>

      {paciente ? (
        <div className="mt-3 rounded-xl bg-blue-50 p-3 text-xs text-blue-950">
          <div className="font-black">{paciente.nome_completo}</div>
          <div className="mt-1">Atend. #{atendimento?.numero_atendimento ?? "—"} · RA {paciente.ra ?? "—"}</div>
          <div className="mt-2 grid grid-cols-2 gap-2 border-t border-blue-100 pt-2 text-[11px]">
            <div><span className="block font-bold text-blue-500">Permanência</span>{durationSince(internacao?.data_internacao)}</div>
            <div><span className="block font-bold text-blue-500">Previsão de alta</span>{fmtDate(internacao?.previsao_alta)}</div>
          </div>
          {atendimento?.id ? <Link href={`/prontuario/${atendimento.id}` as Route} className="mt-3 inline-flex font-black text-blue-700 hover:underline">Abrir prontuário →</Link> : null}
        </div>
      ) : null}

      {reservadoPaciente ? (
        <div className="mt-3 rounded-xl bg-violet-50 p-3 text-xs text-violet-950">
          <b>Reservado para {reservadoPaciente.nome_completo}</b>
          <br />Atend. #{reservadoAtendimento?.numero_atendimento ?? "—"} · até {fmt(reserva?.reservado_ate)}
          <br /><Link href="/internacao/nir" className="mt-2 inline-flex font-black text-violet-700 hover:underline">Gerenciar reserva na NIR →</Link>
        </div>
      ) : null}

      {bloqueio ? <div className="mt-3 rounded-xl bg-rose-50 p-3 text-xs text-rose-950"><b>{bloqueio.tipo.replaceAll("_", " ")}</b>{bloqueio.motivo ? ` · ${bloqueio.motivo}` : ""}</div> : null}
      {higiene ? <div className="mt-3 rounded-xl bg-amber-50 p-3 text-xs text-amber-950"><b>Higienização {higiene.status.replaceAll("_", " ")}</b><br />Solicitada há {durationSince(higiene.solicitada_em)} · {fmt(higiene.solicitada_em)}</div> : null}

      {canManage && bed.status === "livre" ? (
        <details className="mt-4 border-t border-slate-100 pt-3">
          <summary className="cursor-pointer text-xs font-black text-brand-700">Bloqueio / manutenção</summary>
          <form action={bloquearLeitoOperacional} className="mt-3 grid gap-2">
            <input type="hidden" name="leito_id" value={bed.id} />
            <select name="tipo" defaultValue="operacional" className="ui-input">
              <option value="operacional">Bloqueio operacional</option>
              <option value="manutencao">Manutenção</option>
              <option value="isolamento">Bloqueio para isolamento</option>
            </select>
            <input name="motivo" required placeholder="Motivo do bloqueio" className="ui-input" />
            <input name="previsto_ate" type="datetime-local" className="ui-input" />
            <button className="ui-button-secondary w-full">Tornar indisponível</button>
          </form>
        </details>
      ) : null}

      {canManage && bloqueio ? (
        <form action={desbloquearLeitoOperacional} className="mt-4 border-t border-slate-100 pt-3">
          <input type="hidden" name="bloqueio_id" value={bloqueio.id} />
          <button className="ui-button-secondary w-full">Encerrar bloqueio e reavaliar disponibilidade</button>
        </form>
      ) : null}

      {canManage && bed.status === "higienizacao" && higiene?.status !== "em_andamento" ? (
        <form action={iniciarHigienizacaoOperacional} className="mt-4 border-t border-slate-100 pt-3">
          <input type="hidden" name="leito_id" value={bed.id} />
          <button className="ui-button-primary w-full">Iniciar higienização</button>
        </form>
      ) : null}

      {canManage && bed.status === "higienizacao" && higiene?.status === "em_andamento" ? (
        <form action={concluirHigienizacaoOperacional} className="mt-4 border-t border-slate-100 pt-3">
          <input type="hidden" name="leito_id" value={bed.id} />
          <button className="ui-button-primary w-full">Concluir higienização e liberar</button>
        </form>
      ) : null}
    </article>
  );
}

function Kpi({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return <div className="his-kpi"><div className="flex items-center justify-between"><p className="text-xs font-black uppercase tracking-wider text-slate-400">{label}</p>{icon}</div><p className="mt-2 text-3xl font-black text-brand-950">{value}</p></div>;
}
