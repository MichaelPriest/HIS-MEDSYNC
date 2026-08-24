import Link from "next/link";
import { BedDouble, Building2, DoorOpen, Filter, LockKeyhole, RefreshCw, Search, ShieldCheck, Sparkles, UserRoundCheck } from "lucide-react";
import { SectionPage } from "@/components/painel/section-page";
import { requireAnyPermission } from "@/lib/permissions/server";
import { bloquearLeito, cancelarReservaLeito, concluirHigienizacaoLeito, desbloquearLeito, iniciarHigienizacaoLeito, reservarLeito } from "@/modules/internacao/actions";
import { criarLeitoOperacional } from "@/modules/internacao/leitos-actions";

type Rel<T> = T | T[] | null;
type Estrutura = { id: string; nome: string; codigo: string; tipo: string; parent_id: string | null; capacidade_leitos: number | null };
type Leito = { id: string; setor: string; quarto: string | null; codigo: string; tipo: string | null; acomodacao: string | null; sexo_restricao: string | null; isolamento_capaz: boolean | null; status: string; estrutura_fisica_id: string | null; estrutura: Rel<Estrutura> };
type Paciente = { nome_completo: string | null; ra: string | null };
type Atendimento = { id: string; numero_atendimento: string | number | null; paciente: Rel<Paciente> };
type Reserva = { id: string; leito_id: string; reservado_ate: string | null; atendimento: Rel<Atendimento> };
type Bloqueio = { id: string; leito_id: string; tipo: string; motivo: string | null };
type Higienizacao = { id: string; leito_id: string; status: string; solicitada_em: string | null };
type Internacao = { id: string; leito_id: string | null; atendimento: Rel<Atendimento> };
type Params = { q?: string; status?: string; setor?: string; sucesso?: string; erro?: string };

const one = <T,>(value: Rel<T>): T | null => Array.isArray(value) ? value[0] ?? null : value;
const fmt = (value?: string | null) => value ? new Date(value).toLocaleString("pt-BR") : "—";
const statusLabels: Record<string, string> = { livre: "Livre", ocupado: "Ocupado", reservado: "Reservado", higienizacao: "Higienização", bloqueado: "Bloqueado", manutencao: "Manutenção" };
const statusStyle: Record<string, string> = {
  livre: "border-emerald-200 bg-emerald-50 text-emerald-700",
  ocupado: "border-blue-200 bg-blue-50 text-blue-700",
  reservado: "border-violet-200 bg-violet-50 text-violet-700",
  higienizacao: "border-amber-200 bg-amber-50 text-amber-700",
  bloqueado: "border-rose-200 bg-rose-50 text-rose-700",
  manutencao: "border-slate-300 bg-slate-100 text-slate-700",
};

function keyArea(leito: Leito) {
  const estrutura = one(leito.estrutura);
  return estrutura?.nome ?? leito.setor ?? "Sem ala definida";
}

export default async function LeitosPage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const { supabase, empresaId, unidadeId } = await requireAnyPermission(["internacao.visualizar", "leitos.gerenciar", "internacao.gerenciar"]);
  if (!unidadeId) return null;

  const [leitosReq, estruturasReq, reservasReq, bloqueiosReq, higieneReq, internacoesReq, atendimentosReq] = await Promise.all([
    supabase.from("leitos").select("id,setor,quarto,codigo,tipo,acomodacao,sexo_restricao,isolamento_capaz,status,estrutura_fisica_id,estrutura:estruturas_fisicas(id,nome,codigo,tipo,parent_id,capacidade_leitos)").eq("empresa_id", empresaId).eq("unidade_id", unidadeId).eq("ativo", true).order("setor").order("codigo").limit(1000),
    supabase.from("estruturas_fisicas").select("id,nome,codigo,tipo,parent_id,capacidade_leitos").eq("empresa_id", empresaId).eq("unidade_id", unidadeId).eq("ativo", true).eq("permite_internacao", true).order("ordem").order("nome"),
    supabase.from("leito_reservas").select("id,leito_id,reservado_ate,atendimento:atendimentos(id,numero_atendimento,paciente:pacientes(nome_completo,ra))").eq("empresa_id", empresaId).eq("unidade_id", unidadeId).eq("status", "ativa"),
    supabase.from("leito_bloqueios").select("id,leito_id,tipo,motivo").eq("empresa_id", empresaId).eq("unidade_id", unidadeId).eq("status", "ativo"),
    supabase.from("leito_higienizacoes").select("id,leito_id,status,solicitada_em").eq("empresa_id", empresaId).eq("unidade_id", unidadeId).in("status", ["pendente", "em_andamento"]),
    supabase.from("internacoes").select("id,leito_id,atendimento:atendimentos(id,numero_atendimento,paciente:pacientes(nome_completo,ra))").eq("empresa_id", empresaId).eq("unidade_id", unidadeId).in("status", ["internado", "transferido"]),
    supabase.from("atendimentos").select("id,numero_atendimento,paciente:pacientes(nome_completo,ra)").eq("empresa_id", empresaId).eq("unidade_id", unidadeId).in("status", ["aberto", "em_espera", "em_atendimento"]).order("data_abertura", { ascending: false }).limit(300),
  ]);

  const allBeds = (leitosReq.data ?? []) as Leito[];
  const estruturas = (estruturasReq.data ?? []) as Estrutura[];
  const reservas = (reservasReq.data ?? []) as Reserva[];
  const bloqueios = (bloqueiosReq.data ?? []) as Bloqueio[];
  const higienizacoes = (higieneReq.data ?? []) as Higienizacao[];
  const internacoes = (internacoesReq.data ?? []) as Internacao[];
  const atendimentos = (atendimentosReq.data ?? []) as Atendimento[];

  const query = params.q?.trim().toLowerCase() ?? "";
  const setor = params.setor?.trim() ?? "";
  const status = params.status?.trim() ?? "";
  const areas = [...new Set(allBeds.map(keyArea))].sort((a, b) => a.localeCompare(b, "pt-BR"));

  const filtered = allBeds.filter((bed) => {
    if (status && bed.status !== status) return false;
    if (setor && keyArea(bed) !== setor) return false;
    if (query) {
      const haystack = `${keyArea(bed)} ${bed.setor} ${bed.quarto ?? ""} ${bed.codigo} ${bed.acomodacao ?? ""} ${bed.tipo ?? ""}`.toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    return true;
  });

  const stats = {
    total: allBeds.length,
    livre: allBeds.filter((item) => item.status === "livre").length,
    ocupado: allBeds.filter((item) => item.status === "ocupado").length,
    giro: allBeds.filter((item) => item.status === "higienizacao").length,
    indisponivel: allBeds.filter((item) => ["bloqueado", "manutencao"].includes(item.status)).length,
  };
  const ocupacao = stats.total ? Math.round((stats.ocupado / stats.total) * 100) : 0;
  const groups = new Map<string, Leito[]>();
  for (const bed of filtered) groups.set(keyArea(bed), [...(groups.get(keyArea(bed)) ?? []), bed]);

  const mensagemErro: Record<string, string> = {
    unidade: "Selecione uma unidade para gerenciar leitos.", campos: "Informe código e ala/UTI do leito.", estrutura: "Selecione uma área ativa que permita internação.", codigo: "Já existe um leito com esse código na unidade.", salvar: "Não foi possível cadastrar o leito.",
  };

  return <SectionPage eyebrow="Assistencial / Internação" title="Mapa operacional de leitos" description="Censo por ala e UTI com ocupação, giro, bloqueios, reservas e cadastro de leitos operacionais." actions={<div className="flex gap-2"><Link href="/internacao/nir" className="ui-button-primary">Gestão NIR</Link><Link href="/configuracoes/estrutura" className="ui-button-secondary">Estrutura hospitalar</Link></div>}>
    {params.sucesso ? <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">Leito cadastrado com sucesso.</div> : null}
    {params.erro ? <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{mensagemErro[params.erro] ?? "Não foi possível concluir a operação."}</div> : null}

    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
      <Kpi label="Leitos ativos" value={stats.total} icon={<BedDouble className="size-5 text-brand-600"/>}/>
      <Kpi label="Livres" value={stats.livre} icon={<DoorOpen className="size-5 text-emerald-600"/>}/>
      <Kpi label="Ocupados" value={stats.ocupado} icon={<UserRoundCheck className="size-5 text-blue-600"/>}/>
      <Kpi label="Em giro" value={stats.giro} icon={<Sparkles className="size-5 text-amber-600"/>}/>
      <Kpi label="Indisponíveis" value={stats.indisponivel} icon={<LockKeyhole className="size-5 text-rose-600"/>}/>
      <div className="his-kpi"><p className="text-xs font-black uppercase tracking-wider text-slate-400">Taxa de ocupação</p><p className="mt-2 text-3xl font-black text-brand-950">{ocupacao}%</p><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-brand-600" style={{ width: `${Math.min(100, ocupacao)}%` }}/></div></div>
    </section>

    <section className="mt-5 grid gap-5 2xl:grid-cols-[minmax(330px,.65fr)_minmax(0,1.35fr)]">
      <form action={criarLeitoOperacional} className="his-card p-5">
        <div className="flex items-start gap-3 border-b border-slate-100 pb-4"><span className="grid size-10 place-items-center rounded-xl bg-brand-50 text-brand-700"><Building2 className="size-5"/></span><div><h2 className="font-black text-slate-950">Cadastrar leito</h2><p className="mt-1 text-xs leading-5 text-slate-500">O leito operacional fica vinculado à ala, enfermaria ou UTI configurada.</p></div></div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="space-y-1 text-xs font-bold text-slate-600"><span>Código *</span><input name="codigo" required placeholder="Ex.: 101-A" className="ui-input uppercase"/></label>
          <label className="space-y-1 text-xs font-bold text-slate-600"><span>Quarto</span><input name="quarto" placeholder="Ex.: 101" className="ui-input"/></label>
          <label className="space-y-1 text-xs font-bold text-slate-600 sm:col-span-2"><span>Ala / UTI *</span><select name="estrutura_fisica_id" required defaultValue="" className="ui-input"><option value="">Selecione...</option>{estruturas.map((item) => <option key={item.id} value={item.id}>{item.nome} · {item.tipo.replaceAll("_", " ")}</option>)}</select></label>
          <label className="space-y-1 text-xs font-bold text-slate-600"><span>Tipo</span><select name="tipo" defaultValue="enfermaria" className="ui-input"><option value="enfermaria">Enfermaria</option><option value="uti">UTI</option><option value="observacao">Observação</option><option value="isolamento">Isolamento</option></select></label>
          <label className="space-y-1 text-xs font-bold text-slate-600"><span>Acomodação</span><select name="acomodacao" defaultValue="enfermaria" className="ui-input"><option value="enfermaria">Enfermaria</option><option value="apartamento">Apartamento</option><option value="coletiva">Coletiva</option><option value="uti">UTI</option><option value="observacao">Observação</option></select></label>
          <label className="space-y-1 text-xs font-bold text-slate-600"><span>Restrição por sexo</span><select name="sexo_restricao" defaultValue="" className="ui-input"><option value="">Sem restrição</option><option value="masculino">Masculino</option><option value="feminino">Feminino</option></select></label>
          <label className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-3 text-xs font-bold text-slate-700"><input type="checkbox" name="isolamento_capaz" className="size-4 accent-brand-700"/>Compatível com isolamento</label>
        </div>
        <button className="ui-button-primary mt-4 w-full">Cadastrar leito</button>
      </form>

      <div className="space-y-4">
        <form className="his-card grid gap-3 p-4 md:grid-cols-[1fr_220px_190px_auto]">
          <label className="relative"><Search className="absolute left-3 top-3 size-4 text-slate-400"/><input name="q" defaultValue={params.q ?? ""} placeholder="Buscar ala, quarto ou leito..." className="ui-input pl-9"/></label>
          <select name="setor" defaultValue={setor} className="ui-input"><option value="">Todas as alas/UTI</option>{areas.map((item) => <option key={item} value={item}>{item}</option>)}</select>
          <select name="status" defaultValue={status} className="ui-input"><option value="">Todos os status</option>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
          <button className="ui-button-secondary"><Filter className="size-4"/>Filtrar</button>
        </form>

        {[...groups.entries()].map(([area, beds]) => {
          const livres = beds.filter((item) => item.status === "livre").length;
          const ocupados = beds.filter((item) => item.status === "ocupado").length;
          return <section key={area} className="his-card overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/60 px-5 py-4"><div><p className="text-[10px] font-black uppercase tracking-[.14em] text-slate-400">Ala / setor</p><h2 className="mt-1 text-base font-black text-slate-950">{area}</h2></div><div className="flex gap-2 text-xs font-bold"><span className="rounded-lg bg-emerald-50 px-2.5 py-1 text-emerald-700">{livres} livres</span><span className="rounded-lg bg-blue-50 px-2.5 py-1 text-blue-700">{ocupados} ocupados</span><span className="rounded-lg bg-white px-2.5 py-1 text-slate-500 ring-1 ring-slate-200">{beds.length} total</span></div></div>
            <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">{beds.map((bed) => <BedCard key={bed.id} bed={bed} reservas={reservas} bloqueios={bloqueios} higienizacoes={higienizacoes} internacoes={internacoes} atendimentos={atendimentos}/>)}</div>
          </section>;
        })}

        {!filtered.length ? <div className="his-card p-12 text-center"><BedDouble className="mx-auto size-10 text-slate-300"/><p className="mt-3 font-black text-slate-700">Nenhum leito encontrado</p><p className="mt-1 text-sm text-slate-500">Ajuste os filtros ou cadastre um novo leito operacional.</p></div> : null}
      </div>
    </section>
  </SectionPage>;
}

function BedCard({ bed, reservas, bloqueios, higienizacoes, internacoes, atendimentos }: { bed: Leito; reservas: Reserva[]; bloqueios: Bloqueio[]; higienizacoes: Higienizacao[]; internacoes: Internacao[]; atendimentos: Atendimento[] }) {
  const reserva = reservas.find((item) => item.leito_id === bed.id);
  const bloqueio = bloqueios.find((item) => item.leito_id === bed.id);
  const higiene = higienizacoes.find((item) => item.leito_id === bed.id);
  const internacao = internacoes.find((item) => item.leito_id === bed.id);
  const ocupadoAtendimento = one(internacao?.atendimento ?? null);
  const ocupadoPaciente = one(ocupadoAtendimento?.paciente ?? null);
  const reservadoAtendimento = one(reserva?.atendimento ?? null);
  const reservadoPaciente = one(reservadoAtendimento?.paciente ?? null);

  return <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
    <div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-wider text-slate-400">{bed.quarto ? `Quarto ${bed.quarto}` : bed.tipo ?? "Leito"}</p><h3 className="mt-1 text-xl font-black text-slate-950">{bed.codigo}</h3><p className="mt-1 text-xs text-slate-500">{bed.acomodacao ?? bed.tipo ?? "—"}{bed.sexo_restricao ? ` · ${bed.sexo_restricao}` : ""}</p></div><span className={`rounded-full border px-2.5 py-1 text-xs font-black ${statusStyle[bed.status] ?? "border-slate-200 bg-slate-50 text-slate-700"}`}>{statusLabels[bed.status] ?? bed.status}</span></div>
    <div className="mt-3 flex flex-wrap gap-1">{bed.isolamento_capaz ? <span className="rounded-md bg-cyan-50 px-2 py-1 text-[10px] font-black uppercase text-cyan-700"><ShieldCheck className="mr-1 inline size-3"/>Isolamento</span> : null}</div>
    {ocupadoPaciente ? <div className="mt-3 rounded-xl bg-blue-50 p-3 text-xs text-blue-900"><b>{ocupadoPaciente.nome_completo}</b><br/>Atend. #{ocupadoAtendimento?.numero_atendimento ?? "—"} · RA {ocupadoPaciente.ra ?? "—"}</div> : null}
    {reservadoPaciente ? <div className="mt-3 rounded-xl bg-violet-50 p-3 text-xs text-violet-900"><b>Reservado para {reservadoPaciente.nome_completo}</b><br/>até {fmt(reserva?.reservado_ate)}</div> : null}
    {bloqueio ? <div className="mt-3 rounded-xl bg-rose-50 p-3 text-xs text-rose-900"><b>{bloqueio.tipo}</b>{bloqueio.motivo ? ` · ${bloqueio.motivo}` : ""}</div> : null}
    {higiene ? <div className="mt-3 rounded-xl bg-amber-50 p-3 text-xs text-amber-900"><b>Higienização {higiene.status.replaceAll("_", " ")}</b><br/>{fmt(higiene.solicitada_em)}</div> : null}

    <details className="mt-4 border-t border-slate-100 pt-3"><summary className="cursor-pointer text-xs font-black text-brand-700">Ações do leito</summary><div className="mt-3 space-y-2">
      {bed.status === "livre" ? <>
        <form action={reservarLeito} className="grid gap-2"><input type="hidden" name="leito_id" value={bed.id}/><select name="atendimento_id" required defaultValue="" className="ui-input"><option value="">Reservar para...</option>{atendimentos.map((item) => { const paciente = one(item.paciente); return <option key={item.id} value={item.id}>#{item.numero_atendimento} · {paciente?.nome_completo ?? "Paciente"}</option>; })}</select><input name="reservado_ate" type="datetime-local" className="ui-input"/><button className="ui-button-secondary w-full">Reservar</button></form>
        <form action={bloquearLeito} className="grid gap-2"><input type="hidden" name="leito_id" value={bed.id}/><select name="tipo" defaultValue="operacional" className="ui-input"><option value="operacional">Bloqueio operacional</option><option value="manutencao">Manutenção</option><option value="isolamento">Isolamento</option></select><input name="motivo" required placeholder="Motivo do bloqueio" className="ui-input"/><button className="ui-button-secondary w-full">Bloquear</button></form>
      </> : null}
      {reserva ? <form action={cancelarReservaLeito}><input type="hidden" name="reserva_id" value={reserva.id}/><input type="hidden" name="motivo" value="Cancelada pelo mapa operacional"/><button className="ui-button-secondary w-full">Cancelar reserva</button></form> : null}
      {bloqueio ? <form action={desbloquearLeito}><input type="hidden" name="bloqueio_id" value={bloqueio.id}/><button className="ui-button-secondary w-full">Encerrar bloqueio</button></form> : null}
      {bed.status === "higienizacao" && higiene?.status !== "em_andamento" ? <form action={iniciarHigienizacaoLeito}><input type="hidden" name="leito_id" value={bed.id}/><button className="ui-button-primary w-full">Iniciar higienização</button></form> : null}
      {bed.status === "higienizacao" && higiene?.status === "em_andamento" ? <form action={concluirHigienizacaoLeito}><input type="hidden" name="leito_id" value={bed.id}/><button className="ui-button-primary w-full">Concluir e liberar</button></form> : null}
    </div></details>
  </article>;
}

function Kpi({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return <div className="his-kpi"><div className="flex items-center justify-between"><p className="text-xs font-black uppercase tracking-wider text-slate-400">{label}</p>{icon}</div><p className="mt-2 text-3xl font-black text-brand-950">{value}</p></div>;
}
