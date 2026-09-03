import Link from "next/link";
import {
  BellRing,
  CalendarCheck2,
  ClipboardList,
  Clock3,
  MonitorCog,
  PlayCircle,
  ScanLine,
  TicketCheck,
  UserCheck,
  UsersRound,
} from "lucide-react";
import { SectionPage } from "@/components/painel/section-page";
import { ReceptionCockpitRefresh } from "@/components/recepcao/reception-cockpit-refresh";
import { asRoute } from "@/lib/route-cast";
import { getAssistencialContext } from "@/modules/assistencial/context";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PacienteRel = {
  nome_completo?: string;
  nome_social?: string | null;
  ra?: string | null;
  numero_registro?: number | null;
};

type ProfissionalRel = { nome_completo?: string };
type PendingItem = {
  key: string;
  origem: "Totem" | "Agenda";
  titulo: string;
  paciente: string;
  detalhe: string;
  horario: string;
  sortAt: string;
  href: string;
  actionLabel: string;
  tone: "amber" | "violet";
};

function one<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

function hojeSP() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function adicionarDias(data: string, dias: number) {
  const base = new Date(`${data}T12:00:00-03:00`);
  base.setUTCDate(base.getUTCDate() + dias);
  return base.toISOString().slice(0, 10);
}

function horaSP(value?: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function nomePaciente(value: PacienteRel | PacienteRel[] | null | undefined) {
  const paciente = one(value);
  return paciente?.nome_social || paciente?.nome_completo || "Paciente não identificado";
}

function nomeProfissional(value: ProfissionalRel | ProfissionalRel[] | null | undefined) {
  return one(value)?.nome_completo ?? "Profissional não definido";
}

function statusLabel(value: string) {
  return ({
    aberto: "Aberto",
    em_espera: "Em espera",
    em_atendimento: "Em atendimento",
  } as Record<string, string>)[value] ?? value.replaceAll("_", " ");
}

export default async function ReceptionCockpitPage() {
  const { supabase, unidadeId } = await getAssistencialContext();
  const hoje = hojeSP();
  const amanha = adicionarDias(hoje, 1);
  const inicio = `${hoje}T00:00:00-03:00`;
  const fim = `${amanha}T00:00:00-03:00`;

  const { data: setores, error: setoresError } = await supabase
    .from("setores_chamada")
    .select("id,nome,codigo")
    .eq("unidade_id", unidadeId)
    .eq("ativo", true)
    .order("ordem");
  const recepcao = setores?.find((item) => item.codigo === "recepcao") ?? null;

  const selectSenha = "id,senha,prioridade,status,emitida_em,data_referencia,ponto_atendimento,paciente_id,atendimento_id,sequencial,paciente:pacientes(nome_completo,nome_social,ra,numero_registro)";
  const [filaHojeResult, pendenciasAnterioresResult] = recepcao
    ? await Promise.all([
        supabase
          .from("senhas_atendimento")
          .select(selectSenha)
          .eq("unidade_id", unidadeId)
          .eq("setor_id", recepcao.id)
          .eq("data_referencia", hoje)
          .in("status", ["aguardando", "chamada", "em_atendimento"])
          .order("sequencial")
          .limit(150),
        supabase
          .from("senhas_atendimento")
          .select(selectSenha)
          .eq("unidade_id", unidadeId)
          .eq("setor_id", recepcao.id)
          .is("atendimento_id", null)
          .in("status", ["chamada", "em_atendimento"])
          .neq("data_referencia", hoje)
          .order("data_referencia", { ascending: false })
          .order("sequencial")
          .limit(80),
      ])
    : [{ data: [], error: null }, { data: [], error: null }];

  const [agendaResult, atendimentosResult] = await Promise.all([
    supabase
      .from("agendamentos")
      .select("id,inicio,status,tipo_atendimento,especialidade,cirurgia_eletiva,paciente_id,profissional_id,paciente:pacientes(nome_completo,nome_social,ra,numero_registro),profissional:profissionais(nome_completo)")
      .eq("unidade_id", unidadeId)
      .eq("status", "checkin")
      .eq("cirurgia_eletiva", false)
      .gte("inicio", inicio)
      .lt("inicio", fim)
      .order("inicio")
      .limit(150),
    supabase
      .from("atendimentos")
      .select("id,numero_atendimento,status,tipo_atendimento,data_abertura,paciente_id,profissional_id,paciente:pacientes(nome_completo,nome_social,ra,numero_registro),profissional:profissionais(nome_completo)")
      .eq("unidade_id", unidadeId)
      .in("status", ["aberto", "em_espera", "em_atendimento"])
      .order("data_abertura", { ascending: false })
      .limit(80),
  ]);

  const senhasMap = new Map<string, NonNullable<typeof filaHojeResult.data>[number]>();
  for (const item of [...(pendenciasAnterioresResult.data ?? []), ...(filaHojeResult.data ?? [])]) senhasMap.set(item.id, item);
  const senhas = [...senhasMap.values()];
  const agenda = agendaResult.data ?? [];
  const atendimentos = atendimentosResult.data ?? [];

  const agendaIds = agenda.map((item) => item.id);
  const agendasComAtendimento = new Set<string>();
  if (agendaIds.length) {
    const { data: existentes, error: existentesError } = await supabase
      .from("atendimentos")
      .select("agendamento_id")
      .in("agendamento_id", agendaIds);
    if (existentesError) console.error("[recepcao.cockpit] falha ao conferir agendas já admitidas", { code: existentesError.code });
    for (const item of existentes ?? []) if (item.agendamento_id) agendasComAtendimento.add(item.agendamento_id);
  }

  const checkinsPendentes = agenda.filter((item) => !agendasComAtendimento.has(item.id));
  const aguardandoHoje = senhas.filter((item) => item.data_referencia === hoje && item.status === "aguardando").length;
  const chamadas = senhas.filter((item) => item.status === "chamada" && !item.atendimento_id).length;
  const emAdmissao = senhas.filter((item) => item.status === "em_atendimento" && !item.atendimento_id).length;

  const pendencias: PendingItem[] = [
    ...senhas
      .filter((item) => !item.atendimento_id && ["chamada", "em_atendimento"].includes(item.status))
      .map((item) => ({
        key: `senha-${item.id}`,
        origem: "Totem" as const,
        titulo: `Senha ${item.senha}`,
        paciente: nomePaciente(item.paciente as PacienteRel | PacienteRel[] | null),
        detalhe: item.status === "em_atendimento"
          ? `Admissão iniciada${item.ponto_atendimento ? ` · ${item.ponto_atendimento}` : ""}`
          : `Paciente chamado${item.ponto_atendimento ? ` · ${item.ponto_atendimento}` : ""}`,
        horario: horaSP(item.emitida_em),
        sortAt: item.emitida_em ?? `${item.data_referencia}T00:00:00-03:00`,
        href: item.status === "em_atendimento"
          ? `/atendimentos/novo?senha=${encodeURIComponent(item.id)}`
          : "/senhas",
        actionLabel: item.status === "em_atendimento" ? "Continuar admissão" : "Abrir fila de senhas",
        tone: item.status === "em_atendimento" ? "violet" as const : "amber" as const,
      })),
    ...checkinsPendentes.map((item) => ({
      key: `agenda-${item.id}`,
      origem: "Agenda" as const,
      titulo: item.especialidade || item.tipo_atendimento || "Atendimento agendado",
      paciente: nomePaciente(item.paciente as PacienteRel | PacienteRel[] | null),
      detalhe: nomeProfissional(item.profissional as ProfissionalRel | ProfissionalRel[] | null),
      horario: horaSP(item.inicio),
      sortAt: item.inicio,
      href: `/atendimentos/novo?agendamento=${encodeURIComponent(item.id)}`,
      actionLabel: "Abrir atendimento",
      tone: "amber" as const,
    })),
  ].sort((a, b) => new Date(a.sortAt).getTime() - new Date(b.sortAt).getTime());

  const loadError = setoresError
    ?? filaHojeResult.error
    ?? pendenciasAnterioresResult.error
    ?? agendaResult.error
    ?? atendimentosResult.error;

  if (loadError) console.error("[recepcao.cockpit] carregamento parcial", { code: loadError.code, unidadeId });

  return (
    <SectionPage
      eyebrow="Recepção / Operação"
      title="Cockpit da Recepção"
      description="Uma visão única da chegada até a abertura do atendimento, preservando o Totem para demanda espontânea e o check-in da Agenda para pacientes agendados."
    >
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <ReceptionCockpitRefresh unidadeId={unidadeId} />
        <Link href="/senhas" className="btn-secondary"><TicketCheck className="size-4" />Fila de senhas</Link>
        <Link href="/agenda" className="btn-secondary"><CalendarCheck2 className="size-4" />Agenda</Link>
        <Link href="/atendimentos" className="btn-secondary"><ClipboardList className="size-4" />Atendimentos</Link>
        <Link href={asRoute(`/totem/${unidadeId}`)} target="_blank" className="btn-secondary"><ScanLine className="size-4" />Abrir Totem</Link>
        <Link href={asRoute(`/painel-chamadas/${unidadeId}`)} target="_blank" className="btn-secondary"><MonitorCog className="size-4" />Painel de chamadas</Link>
      </div>

      {loadError ? (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Parte da operação não pôde ser atualizada agora. As telas de origem continuam disponíveis e nenhuma etapa foi alterada.
        </div>
      ) : null}
      {!recepcao ? (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          O setor Recepção precisa estar ativo em Painéis e chamadas para que as senhas do Totem apareçam neste cockpit.
        </div>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Kpi icon={BellRing} label="Aguardando no Totem" value={aguardandoHoje} tone="brand" />
        <Kpi icon={TicketCheck} label="Chamadas" value={chamadas} tone="amber" />
        <Kpi icon={PlayCircle} label="Em admissão" value={emAdmissao} tone="violet" />
        <Kpi icon={CalendarCheck2} label="Check-ins da Agenda" value={checkinsPendentes.length} tone="amber" />
        <Kpi icon={UsersRound} label="Atendimentos ativos" value={atendimentos.length} tone="emerald" />
      </section>

      <section className="ui-card mt-5 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-5">
          <div>
            <h2 className="font-black text-slate-900">Próximos passos da Recepção</h2>
            <p className="mt-1 text-sm text-slate-500">Somente pacientes já chamados no Totem ou com check-in válido na Agenda podem seguir para abertura.</p>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-600">{pendencias.length} pendência(s)</span>
        </div>
        {pendencias.length ? (
          <div className="divide-y divide-slate-100">
            {pendencias.slice(0, 30).map((item) => (
              <div key={item.key} className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex min-w-0 gap-3">
                  <span className={`grid size-11 shrink-0 place-items-center rounded-xl ${item.tone === "violet" ? "bg-violet-50 text-violet-700" : "bg-amber-50 text-amber-700"}`}>
                    {item.origem === "Totem" ? <TicketCheck className="size-5" /> : <CalendarCheck2 className="size-5" />}
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <strong className="text-sm text-slate-900">{item.paciente}</strong>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-slate-500">{item.origem}</span>
                    </div>
                    <p className="mt-1 text-sm font-semibold text-slate-700">{item.titulo}</p>
                    <p className="mt-1 text-xs text-slate-500">{item.detalhe} · <Clock3 className="mb-0.5 inline size-3" /> {item.horario}</p>
                  </div>
                </div>
                <Link href={asRoute(item.href)} className="ui-button-primary shrink-0"><PlayCircle className="size-4" />{item.actionLabel}</Link>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-10 text-center">
            <UserCheck className="mx-auto size-8 text-emerald-500" />
            <p className="mt-3 font-semibold text-slate-800">Nenhuma admissão pendente agora.</p>
            <p className="mt-1 text-sm text-slate-500">Novas chegadas aparecerão aqui automaticamente após chamada do Totem ou check-in da Agenda.</p>
          </div>
        )}
      </section>

      <section className="ui-card mt-5 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-5">
          <div><h2 className="font-black text-slate-900">Atendimentos ativos</h2><p className="mt-1 text-sm text-slate-500">Acompanhe os episódios já abertos sem misturá-los com a fila de chegada.</p></div>
          <Link href={asRoute("/atendimentos?status=ativos")} className="btn-secondary">Ver relação completa</Link>
        </div>
        {atendimentos.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-5 py-3">Atendimento / Guia</th><th className="px-5 py-3">Paciente</th><th className="px-5 py-3">Profissional</th><th className="px-5 py-3">Abertura</th><th className="px-5 py-3">Status</th><th className="px-5 py-3 text-right">Ação</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {atendimentos.slice(0, 12).map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50">
                    <td className="px-5 py-4 font-black text-brand-800">#{item.numero_atendimento}</td>
                    <td className="px-5 py-4 font-semibold text-slate-900">{nomePaciente(item.paciente as PacienteRel | PacienteRel[] | null)}</td>
                    <td className="px-5 py-4 text-slate-600">{nomeProfissional(item.profissional as ProfissionalRel | ProfissionalRel[] | null)}</td>
                    <td className="px-5 py-4 text-slate-600">{horaSP(item.data_abertura)}</td>
                    <td className="px-5 py-4"><span className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700">{statusLabel(String(item.status))}</span></td>
                    <td className="px-5 py-4 text-right"><Link href={asRoute(`/prontuario/${item.id}`)} className="btn-secondary">Abrir prontuário</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="p-8 text-center text-sm text-slate-500">Nenhum atendimento ativo nesta unidade.</p>}
      </section>
    </SectionPage>
  );
}

function Kpi({ icon: Icon, label, value, tone }: { icon: typeof BellRing; label: string; value: number; tone: "brand" | "amber" | "violet" | "emerald" }) {
  const toneClass = {
    brand: "bg-brand-50 text-brand-700",
    amber: "bg-amber-50 text-amber-700",
    violet: "bg-violet-50 text-violet-700",
    emerald: "bg-emerald-50 text-emerald-700",
  }[tone];
  return <div className="ui-card p-4"><div className="flex items-center justify-between gap-3"><p className="text-xs font-black uppercase tracking-wider text-slate-400">{label}</p><span className={`grid size-9 place-items-center rounded-xl ${toneClass}`}><Icon className="size-4" /></span></div><p className="mt-2 text-3xl font-black text-brand-950">{value}</p></div>;
}
