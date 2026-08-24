import Link from "next/link";
import { CalendarCheck2, CalendarDays, CalendarRange, CheckCircle2, Clock3, Hospital, Stethoscope, UserCheck, UserX, XCircle } from "lucide-react";
import { SectionPage } from "@/components/painel/section-page";
import { atualizarStatusAgendamento } from "@/modules/agenda/actions";
import { getAssistencialContext } from "@/modules/assistencial/context";

type PacienteRel = { nome_completo?: string; cpf?: string | null; ra?: string; numero_registro?: number };
type NomeRel = { nome_completo?: string; nome_fantasia?: string; nome?: string; codigo?: string | null };

type Params = { sucesso?: string; erro?: string; q?: string; data?: string; view?: string; status?: string; profissional?: string };

function one<T>(value: T | T[] | null | undefined) { return Array.isArray(value) ? value[0] ?? null : value ?? null; }
function relPaciente(value: PacienteRel | PacienteRel[] | null) { return one(value); }
function relNome(value: NomeRel | NomeRel[] | null) { const item = one(value); return item?.nome_completo ?? item?.nome_fantasia ?? item?.nome ?? null; }
function hojeSP() { return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()); }
function isoDataValida(value?: string) { return /^\d{4}-\d{2}-\d{2}$/.test(value ?? "") ? String(value) : hojeSP(); }
function adicionarDias(data: string, dias: number) { const base = new Date(`${data}T12:00:00-03:00`); base.setUTCDate(base.getUTCDate() + dias); return base.toISOString().slice(0, 10); }
function inicioSemana(data: string) { const base = new Date(`${data}T12:00:00-03:00`); const dia = base.getUTCDay(); return adicionarDias(data, -(dia === 0 ? 6 : dia - 1)); }
function periodo(data: string, view: string) { const inicioData = view === "semana" ? inicioSemana(data) : data; const fimData = adicionarDias(inicioData, view === "semana" ? 7 : 1); return { inicioData, fimData, inicio: `${inicioData}T00:00:00-03:00`, fim: `${fimData}T00:00:00-03:00` }; }
function hora(value: string) { return new Date(value).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }); }
function dia(value: string) { return new Date(value).toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" }); }
function statusLabel(status: string) { return ({ agendado:"Agendado", confirmado:"Confirmado", checkin:"Check-in", atendido:"Atendido", faltou:"Faltou", cancelado:"Cancelado" } as Record<string,string>)[status] ?? status; }
function statusClass(status: string) { return ({ agendado:"bg-slate-100 text-slate-700", confirmado:"bg-sky-100 text-sky-700", checkin:"bg-amber-100 text-amber-800", atendido:"bg-emerald-100 text-emerald-700", faltou:"bg-orange-100 text-orange-700", cancelado:"bg-rose-100 text-rose-700" } as Record<string,string>)[status] ?? "bg-slate-100 text-slate-700"; }

export default async function AgendaPage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const dataSelecionada = isoDataValida(params.data);
  const view = params.view === "semana" ? "semana" : "dia";
  const { inicioData, fimData, inicio, fim } = periodo(dataSelecionada, view);
  const query = params.q?.trim().slice(0, 80) ?? "";
  const { supabase, unidadeId } = await getAssistencialContext();

  let patientIds: string[] | null = null;
  if (query.length >= 2) {
    const { data: found } = await supabase.rpc("buscar_pacientes_admissao", { p_empresa: (await getAssistencialContext()).empresaId, p_busca: query, p_limite: 80 });
    patientIds = (Array.isArray(found) ? found : []).map((item: { id: string }) => item.id);
  }

  let request = supabase
    .from("agendamentos")
    .select("id,inicio,fim,status,tipo_atendimento,especialidade,cirurgia_eletiva,encaixe,retorno,motivo_agendamento,confirmado_em,checkin_em,paciente_id,paciente:pacientes(nome_completo,cpf,ra,numero_registro),profissional:profissionais(nome_completo),convenio:convenios(nome_fantasia),plano:convenio_planos(nome,codigo),local:estruturas_fisicas(nome,tipo)")
    .eq("unidade_id", unidadeId)
    .gte("inicio", inicio)
    .lt("inicio", fim)
    .order("inicio")
    .limit(view === "semana" ? 500 : 250);

  if (params.status && ["agendado","confirmado","checkin","atendido","faltou","cancelado"].includes(params.status)) request = request.eq("status", params.status);
  if (params.profissional) request = request.eq("profissional_id", params.profissional);
  if (patientIds) request = patientIds.length ? request.in("paciente_id", patientIds) : request.eq("paciente_id", "00000000-0000-0000-0000-000000000000");

  const [{ data: agendamentos, error }, { data: profissionais }] = await Promise.all([
    request,
    supabase.from("profissionais").select("id,nome_completo").eq("ativo", true).order("nome_completo").limit(500),
  ]);

  const items = agendamentos ?? [];
  const total = items.length;
  const confirmados = items.filter((item) => item.status === "confirmado").length;
  const chegadas = items.filter((item) => item.status === "checkin").length;
  const cirurgias = items.filter((item) => item.cirurgia_eletiva).length;
  const retornoUrl = `/agenda?data=${encodeURIComponent(dataSelecionada)}&view=${view}${params.status ? `&status=${encodeURIComponent(params.status)}` : ""}${params.profissional ? `&profissional=${encodeURIComponent(params.profissional)}` : ""}${query ? `&q=${encodeURIComponent(query)}` : ""}`;
  const mensagemErro = params.erro === "motivo-cancelamento" ? "Informe o motivo do cancelamento." : params.erro ? "Não foi possível concluir a ação na Agenda." : null;

  return <SectionPage eyebrow="Assistencial / Agenda" title="Agenda operacional" description="Visão diária e semanal com confirmação, check-in direto, faltas, cancelamentos, encaixes, retorno e programação de cirurgia eletiva." primaryActionLabel="Novo agendamento" primaryActionHref="/agenda/novo">
    {params.sucesso ? <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{params.sucesso === "agendado" ? "Agendamento criado com sucesso." : "Agenda atualizada com sucesso."}</div> : null}
    {mensagemErro ? <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{mensagemErro}</div> : null}

    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <Kpi icon={CalendarDays} label="No período" value={String(total)} />
      <Kpi icon={CalendarCheck2} label="Confirmados" value={String(confirmados)} />
      <Kpi icon={UserCheck} label="Em check-in" value={String(chegadas)} />
      <Kpi icon={Hospital} label="Cirurgias eletivas" value={String(cirurgias)} />
    </div>

    <section className="ui-card mt-6 p-5">
      <form className="grid gap-4 lg:grid-cols-[150px_150px_minmax(220px,1fr)_minmax(220px,1fr)_180px_auto]">
        <label className="space-y-1.5 text-xs font-semibold text-slate-600"><span>Data</span><input type="date" name="data" defaultValue={dataSelecionada} className="ui-input" /></label>
        <label className="space-y-1.5 text-xs font-semibold text-slate-600"><span>Visão</span><select name="view" defaultValue={view} className="ui-input"><option value="dia">Dia</option><option value="semana">Semana</option></select></label>
        <label className="space-y-1.5 text-xs font-semibold text-slate-600"><span>Paciente</span><input name="q" defaultValue={query} placeholder="Nome, CPF, RA ou registro" className="ui-input" /></label>
        <label className="space-y-1.5 text-xs font-semibold text-slate-600"><span>Profissional</span><select name="profissional" defaultValue={params.profissional ?? ""} className="ui-input"><option value="">Todos</option>{profissionais?.map((item) => <option key={item.id} value={item.id}>{item.nome_completo}</option>)}</select></label>
        <label className="space-y-1.5 text-xs font-semibold text-slate-600"><span>Status</span><select name="status" defaultValue={params.status ?? ""} className="ui-input"><option value="">Todos</option>{["agendado","confirmado","checkin","atendido","faltou","cancelado"].map((status) => <option key={status} value={status}>{statusLabel(status)}</option>)}</select></label>
        <button className="ui-button-primary self-end">Aplicar</button>
      </form>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4 text-sm text-slate-500"><span>{view === "dia" ? `Agenda de ${new Date(`${inicioData}T12:00:00-03:00`).toLocaleDateString("pt-BR")}` : `Semana de ${new Date(`${inicioData}T12:00:00-03:00`).toLocaleDateString("pt-BR")} a ${new Date(`${adicionarDias(fimData,-1)}T12:00:00-03:00`).toLocaleDateString("pt-BR")}`}</span><div className="flex gap-2"><Link href={`/agenda?data=${adicionarDias(dataSelecionada, view === "semana" ? -7 : -1)}&view=${view}`} className="btn-secondary h-9 text-xs">Anterior</Link><Link href={`/agenda?data=${hojeSP()}&view=${view}`} className="btn-secondary h-9 text-xs">Hoje</Link><Link href={`/agenda?data=${adicionarDias(dataSelecionada, view === "semana" ? 7 : 1)}&view=${view}`} className="btn-secondary h-9 text-xs">Próximo</Link></div></div>
    </section>

    <section className="ui-card mt-6 overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4"><div><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">Grade operacional</p><h2 className="mt-1 font-semibold text-slate-900">{view === "dia" ? "Agenda do dia" : "Agenda da semana"}</h2></div><span className="inline-flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-500"><CalendarRange className="size-4" />{items.length} registro(s)</span></div>
      {error ? <p className="p-6 text-sm text-red-700">Não foi possível consultar a agenda.</p> : items.length ? <div className="overflow-x-auto"><table className="w-full min-w-[1180px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Horário</th><th className="px-4 py-3">Paciente</th><th className="px-4 py-3">Profissional / especialidade</th><th className="px-4 py-3">Local</th><th className="px-4 py-3">Cobertura</th><th className="px-4 py-3">Tipo</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Ações</th></tr></thead><tbody className="divide-y divide-slate-100">{items.map((item) => {
        const paciente = relPaciente(item.paciente);
        const local = one(item.local as NomeRel | NomeRel[] | null);
        return <tr key={item.id} className="align-top hover:bg-slate-50/70">
          <td className="px-4 py-4"><strong className="block text-slate-900">{view === "semana" ? dia(item.inicio) : ""} {hora(item.inicio)}–{hora(item.fim)}</strong>{item.encaixe ? <span className="mt-1 inline-block rounded-md bg-violet-50 px-2 py-1 text-[10px] font-bold uppercase text-violet-700">Encaixe</span> : null}</td>
          <td className="px-4 py-4"><strong className="block text-slate-800">{paciente?.nome_completo ?? "—"}</strong><span className="mt-1 block text-xs text-slate-500">RA {paciente?.ra ?? "—"} · #{paciente?.numero_registro ?? "—"}</span></td>
          <td className="px-4 py-4"><span className="block text-slate-700">{relNome(item.profissional) ?? "A definir"}</span><span className="mt-1 block text-xs text-slate-500">{item.especialidade ?? "Especialidade não definida"}</span></td>
          <td className="px-4 py-4"><span className="text-slate-700">{relNome(item.local) ?? "A definir"}</span>{local?.nome ? null : null}</td>
          <td className="px-4 py-4"><span className="block text-slate-700">{relNome(item.convenio) ?? "Particular"}</span><span className="mt-1 block text-xs text-slate-500">{relNome(item.plano) ?? "—"}</span></td>
          <td className="px-4 py-4"><div className="flex flex-wrap gap-1">{item.cirurgia_eletiva ? <Tag text="Cirurgia eletiva" tone="violet" /> : null}{item.retorno ? <Tag text="Retorno" tone="sky" /> : null}{item.tipo_atendimento ? <Tag text={String(item.tipo_atendimento)} /> : null}</div>{item.motivo_agendamento ? <p className="mt-2 max-w-[220px] text-xs text-slate-500">{item.motivo_agendamento}</p> : null}</td>
          <td className="px-4 py-4"><span className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${statusClass(String(item.status))}`}>{statusLabel(String(item.status))}</span></td>
          <td className="px-4 py-4"><div className="flex min-w-[250px] flex-wrap justify-end gap-2"><Actions item={item} retorno={retornoUrl} /></div></td>
        </tr>;
      })}</tbody></table></div> : <div className="p-12 text-center"><CalendarDays className="mx-auto size-10 text-slate-300"/><p className="mt-3 font-semibold text-slate-700">Nenhum agendamento neste período</p><p className="mt-1 text-sm text-slate-500">Ajuste os filtros ou crie um novo agendamento.</p></div>}
    </section>
  </SectionPage>;
}

function Actions({ item, retorno }: { item: { id:string; status:string; cirurgia_eletiva:boolean }; retorno:string }) {
  const forms = [] as React.ReactNode[];
  if (item.status === "agendado") forms.push(<StatusButton key="confirmar" id={item.id} status="confirmado" retorno={retorno} label="Confirmar" icon={CheckCircle2} />);
  if (["agendado","confirmado"].includes(item.status)) forms.push(<StatusButton key="checkin" id={item.id} status="checkin" retorno={retorno} label={item.cirurgia_eletiva ? "Pré-admissão" : "Check-in"} icon={UserCheck} />);
  if (item.status === "checkin") forms.push(<StatusButton key="atendido" id={item.id} status="atendido" retorno={retorno} label="Atendido" icon={Stethoscope} />);
  if (["agendado","confirmado"].includes(item.status)) forms.push(<StatusButton key="faltou" id={item.id} status="faltou" retorno={retorno} label="Faltou" icon={UserX} />);
  if (["agendado","confirmado","checkin"].includes(item.status)) forms.push(<details key="cancelar" className="relative"><summary className="btn-secondary flex h-9 cursor-pointer list-none items-center gap-1.5 text-xs text-rose-700"><XCircle className="size-3.5"/>Cancelar</summary><form action={atualizarStatusAgendamento} className="absolute right-0 z-20 mt-2 w-72 rounded-2xl border border-slate-200 bg-white p-3 shadow-xl"><input type="hidden" name="agendamento_id" value={item.id}/><input type="hidden" name="status" value="cancelado"/><input type="hidden" name="retorno" value={retorno}/><label className="text-xs font-semibold text-slate-600">Motivo do cancelamento<textarea name="motivo" required rows={3} className="ui-input mt-2"/></label><button className="mt-3 w-full rounded-xl bg-rose-600 px-3 py-2 text-xs font-bold text-white">Confirmar cancelamento</button></form></details>);
  if (item.cirurgia_eletiva && item.status === "checkin") forms.push(<Link key="cirurgia" href={`/assistencial/centro-cirurgico?agendamento=${item.id}`} className="btn-secondary h-9 text-xs text-violet-700">Centro cirúrgico</Link>);
  return <>{forms}</>;
}

function StatusButton({ id, status, retorno, label, icon: Icon }: { id:string; status:string; retorno:string; label:string; icon:typeof Clock3 }) {
  return <form action={atualizarStatusAgendamento}><input type="hidden" name="agendamento_id" value={id}/><input type="hidden" name="status" value={status}/><input type="hidden" name="retorno" value={retorno}/><button className="btn-secondary h-9 text-xs"><Icon className="size-3.5"/>{label}</button></form>;
}
function Kpi({ icon: Icon, label, value }: { icon:typeof CalendarDays; label:string; value:string }) { return <div className="ui-card flex items-center gap-4 p-4"><span className="grid size-11 place-items-center rounded-xl bg-brand-50 text-brand-700"><Icon className="size-5"/></span><div><p className="text-xs uppercase tracking-wide text-slate-400">{label}</p><p className="mt-1 text-xl font-black text-slate-900">{value}</p></div></div>; }
function Tag({ text, tone = "slate" }: { text:string; tone?:"slate"|"violet"|"sky" }) { const cls = tone === "violet" ? "bg-violet-50 text-violet-700" : tone === "sky" ? "bg-sky-50 text-sky-700" : "bg-slate-100 text-slate-600"; return <span className={`rounded-md px-2 py-1 text-[10px] font-bold uppercase tracking-wide ${cls}`}>{text}</span>; }
