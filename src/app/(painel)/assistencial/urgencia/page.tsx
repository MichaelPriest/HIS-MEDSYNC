import Link from "next/link";
import type { Route } from "next";
import { AlertTriangle, BedDouble, Clock3, HeartPulse, RefreshCw, ShieldAlert, Stethoscope } from "lucide-react";
import { SectionPage } from "@/components/painel/section-page";
import { ActionPanel } from "@/components/painel/action-panel";
import { EncounterPicker } from "@/components/atendimentos/encounter-picker";
import { requireAnyPermission } from "@/lib/permissions/server";
import { abrirRegistroEmergencia, encerrarRegistroEmergencia, registrarReavaliacaoEmergencia } from "@/modules/urgencia/actions";

type Rel<T> = T | T[] | null;
type Paciente = { nome_completo: string | null; cpf: string | null; cns: string | null; ra: string | null; numero_registro: number | null };
type AtendimentoRel = { numero_atendimento: string | number | null; status: string | null; setor_atual: string | null; paciente: Rel<Paciente> };
type ProfissionalRel = { nome_completo: string | null };
type Registro = {
  id: string;
  atendimento_id: string;
  origem: string | null;
  mecanismo: string | null;
  classificacao_risco: string | null;
  protocolo: string | null;
  sala: string | null;
  estado_geral: string | null;
  via_aerea: string | null;
  respiracao: string | null;
  circulacao: string | null;
  neurologico: string | null;
  exposicao: string | null;
  procedimentos_imediatos: unknown;
  reavaliacao_em: string | null;
  destino: string | null;
  observacoes: string | null;
  status: string;
  created_at: string;
  atendimento: Rel<AtendimentoRel>;
  profissional: Rel<ProfissionalRel>;
};
type Reavaliacao = {
  id: string;
  emergencia_id: string;
  reavaliado_em: string;
  queixa: string | null;
  classificacao_risco: string | null;
  dor: number | null;
  conduta: string | null;
  destino: string | null;
  observacoes: string | null;
  profissional: Rel<ProfissionalRel>;
};

type AtendimentoPickerRow = {
  id: string;
  numero_atendimento: string | number | null;
  data_abertura: string | null;
  paciente: Rel<Paciente>;
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

function one<T>(value: Rel<T>): T | null {
  return Array.isArray(value) ? value[0] ?? null : value;
}

function when(value?: string | null) {
  return value ? new Date(value).toLocaleString("pt-BR") : "—";
}

function procedures(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

const riskStyle: Record<string, string> = {
  vermelho: "border-rose-300 bg-rose-50 text-rose-800",
  laranja: "border-orange-300 bg-orange-50 text-orange-800",
  amarelo: "border-amber-300 bg-amber-50 text-amber-800",
  verde: "border-emerald-300 bg-emerald-50 text-emerald-800",
  azul: "border-blue-300 bg-blue-50 text-blue-800",
};

const riskWeight: Record<string, number> = { vermelho: 0, laranja: 1, amarelo: 2, verde: 3, azul: 4 };

export default async function UrgenciaPage({
  searchParams,
}: {
  searchParams: Promise<{ atendimento?: string; registro?: string; sucesso?: string; erro?: string }>;
}) {
  const sp = await searchParams;
  const { supabase, empresaId, unidadeId } = await requireAnyPermission([
    "emergencia.visualizar",
    "emergencia.gerenciar",
    "emergencia.reavaliar",
  ]);

  if (!unidadeId) return null;

  const [atReq, regReq, reavReq] = await Promise.all([
    supabase
      .from("atendimentos")
      .select("id,numero_atendimento,data_abertura,paciente:pacientes(nome_completo,cpf,cns,ra,numero_registro)")
      .eq("empresa_id", empresaId)
      .eq("unidade_id", unidadeId)
      .in("status", ["aberto", "em_espera", "em_atendimento"])
      .order("data_abertura", { ascending: false })
      .limit(400),
    supabase
      .from("emergencia_registros")
      .select("id,atendimento_id,origem,mecanismo,classificacao_risco,protocolo,sala,estado_geral,via_aerea,respiracao,circulacao,neurologico,exposicao,procedimentos_imediatos,reavaliacao_em,destino,observacoes,status,created_at,atendimento:atendimentos(numero_atendimento,status,setor_atual,paciente:pacientes(nome_completo,cpf,cns,ra,numero_registro)),profissional:profissionais(nome_completo)")
      .eq("empresa_id", empresaId)
      .eq("unidade_id", unidadeId)
      .order("created_at", { ascending: false })
      .limit(200),
    supabase
      .from("emergencia_reavaliacoes")
      .select("id,emergencia_id,reavaliado_em,queixa,classificacao_risco,dor,conduta,destino,observacoes,profissional:profissionais(nome_completo)")
      .eq("empresa_id", empresaId)
      .eq("unidade_id", unidadeId)
      .order("reavaliado_em", { ascending: false })
      .limit(500),
  ]);

  const atendimentos = (atReq.data ?? []) as AtendimentoPickerRow[];
  const registros = (regReq.data ?? []) as Registro[];
  const reavaliacoes = (reavReq.data ?? []) as Reavaliacao[];
  const active = registros.filter((item) => item.status !== "encerrado");
  const now = Date.now();
  const overdue = active.filter((item) => item.reavaliacao_em && new Date(item.reavaliacao_em).getTime() <= now).length;
  const highRisk = active.filter((item) => ["vermelho", "laranja"].includes(String(item.classificacao_risco ?? "").toLowerCase())).length;
  const withoutDestination = active.filter((item) => !item.destino).length;

  const encounters = atendimentos.map((item) => {
    const patient = one(item.paciente);
    return {
      id: item.id,
      numero_atendimento: item.numero_atendimento,
      data_abertura: item.data_abertura,
      paciente: {
        nome_completo: patient?.nome_completo ?? "Paciente",
        cpf: patient?.cpf ?? null,
        ra: patient?.ra ?? null,
        numero_registro: patient?.numero_registro ?? null,
      },
    };
  });

  const ordered = [...active].sort((a, b) => {
    const riskA = riskWeight[String(a.classificacao_risco ?? "").toLowerCase()] ?? 99;
    const riskB = riskWeight[String(b.classificacao_risco ?? "").toLowerCase()] ?? 99;
    if (riskA !== riskB) return riskA - riskB;
    const timeA = a.reavaliacao_em ? new Date(a.reavaliacao_em).getTime() : Number.MAX_SAFE_INTEGER;
    const timeB = b.reavaliacao_em ? new Date(b.reavaliacao_em).getTime() : Number.MAX_SAFE_INTEGER;
    return timeA - timeB;
  });

  return (
    <SectionPage
      eyebrow="Assistencial / Urgência"
      title="Central de Urgência e Emergência"
      description="ABCDE, classificação de risco, reavaliação programada e destino assistencial no mesmo episódio do paciente."
      actions={<Link href="/triagem" className="ui-button-secondary"><Stethoscope className="size-4" />Triagem</Link>}
    >
      {sp.sucesso ? <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">Operação concluída: {sp.sucesso.replaceAll("-", " ")}.</div> : null}
      {sp.erro ? <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">Atenção: {sp.erro.replaceAll("-", " ")}.</div> : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Em atendimento" value={active.length} icon={<HeartPulse className="size-5 text-brand-600" />} />
        <Kpi label="Alta prioridade" value={highRisk} icon={<ShieldAlert className="size-5 text-rose-600" />} />
        <Kpi label="Reavaliação vencida" value={overdue} icon={<Clock3 className="size-5 text-amber-600" />} />
        <Kpi label="Sem destino definido" value={withoutDestination} icon={<AlertTriangle className="size-5 text-violet-600" />} />
      </section>

      <div className="mt-5">
        <ActionPanel
          title="Abrir atendimento de urgência"
          description="Selecione o episódio existente; o registro permanece ligado ao mesmo RA, prontuário, prescrição, exames e eventual internação."
          defaultOpen={Boolean(sp.atendimento)}
        >
          <form action={abrirRegistroEmergencia} className="grid gap-3 lg:grid-cols-4">
            <div className="lg:col-span-4">
              <EncounterPicker encounters={encounters} name="atendimento_id" defaultValue={sp.atendimento ?? ""} />
            </div>
            <label className="text-sm font-semibold text-slate-700">Origem<input name="origem" className="ui-input mt-1.5" placeholder="Demanda espontânea, SAMU, transferência..." /></label>
            <label className="text-sm font-semibold text-slate-700">Mecanismo<input name="mecanismo" className="ui-input mt-1.5" placeholder="Clínico, trauma, acidente..." /></label>
            <label className="text-sm font-semibold text-slate-700">Classificação<select name="classificacao_risco" defaultValue="" className="ui-input mt-1.5"><option value="">Não informada</option><option value="vermelho">Vermelho</option><option value="laranja">Laranja</option><option value="amarelo">Amarelo</option><option value="verde">Verde</option><option value="azul">Azul</option></select></label>
            <label className="text-sm font-semibold text-slate-700">Sala<input name="sala" className="ui-input mt-1.5" placeholder="Sala vermelha, box 03..." /></label>
            <label className="text-sm font-semibold text-slate-700 lg:col-span-2">Protocolo<input name="protocolo" className="ui-input mt-1.5" placeholder="Dor torácica, AVC, sepse, trauma..." /></label>
            <label className="text-sm font-semibold text-slate-700 lg:col-span-2">Estado geral<input name="estado_geral" className="ui-input mt-1.5" placeholder="Impressão inicial / estabilidade" /></label>
            <AbcdeFields />
            <label className="text-sm font-semibold text-slate-700 lg:col-span-2">Procedimentos imediatos<textarea name="procedimentos_imediatos" rows={4} className="ui-input mt-1.5 min-h-28" placeholder="Um procedimento por linha" /></label>
            <label className="text-sm font-semibold text-slate-700">Próxima reavaliação<input name="reavaliacao_em" type="datetime-local" className="ui-input mt-1.5" /></label>
            <label className="text-sm font-semibold text-slate-700">Destino inicial<select name="destino" defaultValue="" className="ui-input mt-1.5"><option value="">Em definição</option><option value="observacao">Observação</option><option value="internacao">Internação</option><option value="uti">UTI</option><option value="centro_cirurgico">Centro cirúrgico</option><option value="alta">Alta</option><option value="transferencia">Transferência</option></select></label>
            <label className="text-sm font-semibold text-slate-700 lg:col-span-4">Observações<textarea name="observacoes" rows={3} className="ui-input mt-1.5 min-h-24" /></label>
            <div className="lg:col-span-4 flex justify-end"><button className="ui-button-primary"><HeartPulse className="size-4" />Abrir registro de urgência</button></div>
          </form>
        </ActionPanel>
      </div>

      <section className="mt-6">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div><h2 className="text-lg font-black text-slate-950">Fila clínica ativa</h2><p className="text-sm text-slate-500">Ordenada por risco e horário da próxima reavaliação.</p></div>
          <Link href="/assistencial/urgencia" className="ui-button-secondary"><RefreshCw className="size-4" />Atualizar</Link>
        </div>

        <div className="space-y-3">
          {ordered.length ? ordered.map((registro) => {
            const atendimento = one(registro.atendimento);
            const paciente = one(atendimento?.paciente ?? null);
            const profissional = one(registro.profissional);
            const risk = String(registro.classificacao_risco ?? "não classificado").toLowerCase();
            const latest = reavaliacoes.find((item) => item.emergencia_id === registro.id) ?? null;
            const due = Boolean(registro.reavaliacao_em && new Date(registro.reavaliacao_em).getTime() <= now);
            const open = sp.registro === registro.id;
            const prontuarioHref = `/prontuario/${registro.atendimento_id}` as Route;
            const internacaoHref = `/internacao/nova/${registro.atendimento_id}` as Route;
            return (
              <details key={registro.id} open={open} className="ui-card overflow-hidden">
                <summary className="cursor-pointer list-none p-4 sm:p-5">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded-full border px-2.5 py-1 text-xs font-black capitalize ${riskStyle[risk] ?? "border-slate-200 bg-slate-50 text-slate-700"}`}>{risk}</span>
                        {due ? <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-black text-amber-800">Reavaliar agora</span> : null}
                        <span className="text-xs font-semibold text-slate-400">Sala {registro.sala ?? "—"}</span>
                      </div>
                      <h3 className="mt-2 truncate text-base font-black text-slate-950">{paciente?.nome_completo ?? "Paciente"}</h3>
                      <p className="mt-1 text-xs text-slate-500">Atend. #{atendimento?.numero_atendimento ?? "—"} · RA {paciente?.ra ?? "—"} · Registro #{paciente?.numero_registro ?? "—"}</p>
                    </div>
                    <div className="grid gap-1 text-sm sm:grid-cols-3 lg:min-w-[520px]">
                      <Mini label="Entrada" value={when(registro.created_at)} />
                      <Mini label="Reavaliação" value={when(registro.reavaliacao_em)} attention={due} />
                      <Mini label="Destino" value={registro.destino ?? "Em definição"} />
                    </div>
                  </div>
                </summary>

                <div className="border-t border-slate-100 bg-slate-50/45 p-4 sm:p-5">
                  <div className="grid gap-4 xl:grid-cols-[1fr_1.15fr]">
                    <div className="space-y-4">
                      <section className="rounded-xl border border-slate-200 bg-white p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2"><h4 className="font-black text-slate-900">ABCDE / registro inicial</h4><span className="text-xs text-slate-400">{profissional?.nome_completo ?? "Profissional não vinculado"}</span></div>
                        <div className="mt-3 grid gap-2 sm:grid-cols-2"><Mini label="A · Via aérea" value={registro.via_aerea ?? "—"} /><Mini label="B · Respiração" value={registro.respiracao ?? "—"} /><Mini label="C · Circulação" value={registro.circulacao ?? "—"} /><Mini label="D · Neurológico" value={registro.neurologico ?? "—"} /><Mini label="E · Exposição" value={registro.exposicao ?? "—"} /><Mini label="Estado geral" value={registro.estado_geral ?? "—"} /></div>
                        {procedures(registro.procedimentos_imediatos).length ? <div className="mt-3 rounded-lg bg-slate-50 p-3"><p className="text-xs font-black uppercase tracking-wider text-slate-400">Procedimentos imediatos</p><ul className="mt-2 space-y-1 text-sm text-slate-700">{procedures(registro.procedimentos_imediatos).map((item) => <li key={item}>• {item}</li>)}</ul></div> : null}
                      </section>

                      <section className="rounded-xl border border-slate-200 bg-white p-4">
                        <h4 className="font-black text-slate-900">Última reavaliação</h4>
                        {latest ? <div className="mt-3 text-sm text-slate-700"><p><b>{when(latest.reavaliado_em)}</b> · risco {latest.classificacao_risco ?? "—"} · dor {latest.dor ?? "—"}/10</p>{latest.queixa ? <p className="mt-2"><b>Queixa:</b> {latest.queixa}</p> : null}{latest.conduta ? <p className="mt-1"><b>Conduta:</b> {latest.conduta}</p> : null}</div> : <p className="mt-3 text-sm text-slate-500">Ainda sem reavaliação estruturada.</p>}
                      </section>

                      <div className="flex flex-wrap gap-2">
                        <Link href={prontuarioHref} className="ui-button-primary">Abrir prontuário</Link>
                        <Link href={`/triagem?atendimento=${registro.atendimento_id}` as Route} className="ui-button-secondary">Triagem</Link>
                        <Link href={`/prescricao?atendimento=${registro.atendimento_id}` as Route} className="ui-button-secondary">Prescrição</Link>
                        <Link href={internacaoHref} className="ui-button-secondary"><BedDouble className="size-4" />Internar</Link>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <form action={registrarReavaliacaoEmergencia} className="rounded-xl border border-slate-200 bg-white p-4">
                        <input type="hidden" name="emergencia_id" value={registro.id} />
                        <h4 className="font-black text-slate-900">Registrar reavaliação</h4>
                        <div className="mt-3 grid gap-3 sm:grid-cols-2">
                          <label className="text-xs font-bold text-slate-600 sm:col-span-2">Queixa / mudança clínica<input name="queixa" className="ui-input mt-1.5" /></label>
                          <label className="text-xs font-bold text-slate-600">Classificação<select name="classificacao_risco" defaultValue={registro.classificacao_risco ?? ""} className="ui-input mt-1.5"><option value="">Não informada</option><option value="vermelho">Vermelho</option><option value="laranja">Laranja</option><option value="amarelo">Amarelo</option><option value="verde">Verde</option><option value="azul">Azul</option></select></label>
                          <label className="text-xs font-bold text-slate-600">Dor 0–10<input name="dor" type="number" min={0} max={10} className="ui-input mt-1.5" /></label>
                          <VitalsFields />
                          <AbcdeFields compact />
                          <label className="text-xs font-bold text-slate-600 sm:col-span-2">Conduta<textarea name="conduta" rows={3} className="ui-input mt-1.5 min-h-20" /></label>
                          <label className="text-xs font-bold text-slate-600">Destino<select name="destino" defaultValue={registro.destino ?? ""} className="ui-input mt-1.5"><option value="">Em definição</option><option value="observacao">Observação</option><option value="internacao">Internação</option><option value="uti">UTI</option><option value="centro_cirurgico">Centro cirúrgico</option><option value="alta">Alta</option><option value="transferencia">Transferência</option></select></label>
                          <label className="text-xs font-bold text-slate-600">Próxima reavaliação<input name="proxima_reavaliacao_em" type="datetime-local" className="ui-input mt-1.5" /></label>
                          <label className="text-xs font-bold text-slate-600 sm:col-span-2">Observações<input name="observacoes" className="ui-input mt-1.5" /></label>
                        </div>
                        <div className="mt-3 flex justify-end"><button className="ui-button-primary">Salvar reavaliação</button></div>
                      </form>

                      <form action={encerrarRegistroEmergencia} className="rounded-xl border border-slate-200 bg-white p-4">
                        <input type="hidden" name="emergencia_id" value={registro.id} />
                        <h4 className="font-black text-slate-900">Definir destino e encerrar urgência</h4>
                        <div className="mt-3 grid gap-3 sm:grid-cols-[220px_1fr_auto]">
                          <select name="destino" required defaultValue={registro.destino ?? ""} className="ui-input"><option value="">Destino...</option><option value="alta">Alta</option><option value="internacao">Internação</option><option value="uti">UTI</option><option value="centro_cirurgico">Centro cirúrgico</option><option value="transferencia">Transferência</option><option value="observacao">Observação encerrada</option></select>
                          <input name="observacoes" className="ui-input" placeholder="Orientação / condição no destino" />
                          <button className="ui-button-secondary">Encerrar</button>
                        </div>
                        <p className="mt-2 text-xs text-slate-400">Se o destino for internação, a admissão contextual deste mesmo atendimento será aberta automaticamente.</p>
                      </form>
                    </div>
                  </div>
                </div>
              </details>
            );
          }) : <div className="ui-card p-8 text-center"><HeartPulse className="mx-auto size-8 text-slate-300" /><p className="mt-3 font-semibold text-slate-700">Nenhum paciente em atendimento de urgência.</p><p className="mt-1 text-sm text-slate-500">Abra um registro acima usando um atendimento já existente.</p></div>}
        </div>
      </section>
    </SectionPage>
  );
}

function Kpi({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return <div className="his-kpi"><div className="flex items-center justify-between"><p className="text-xs font-black uppercase tracking-wider text-slate-400">{label}</p>{icon}</div><p className="mt-2 text-3xl font-black text-brand-950">{value}</p></div>;
}

function Mini({ label, value, attention = false }: { label: string; value: string; attention?: boolean }) {
  return <div className={`rounded-lg px-3 py-2 ${attention ? "bg-amber-100 text-amber-900" : "bg-slate-50 text-slate-700"}`}><p className="text-[10px] font-black uppercase tracking-wider opacity-60">{label}</p><p className="mt-0.5 line-clamp-2 text-xs font-semibold capitalize">{value}</p></div>;
}

function AbcdeFields({ compact = false }: { compact?: boolean }) {
  const cls = compact ? "text-xs font-bold text-slate-600" : "text-sm font-semibold text-slate-700";
  const span = compact ? "sm:col-span-2" : "lg:col-span-2";
  return <>
    <label className={cls}>A · Via aérea<input name="via_aerea" className="ui-input mt-1.5" placeholder="Pérvia / intervenção" /></label>
    <label className={cls}>B · Respiração<input name="respiracao" className="ui-input mt-1.5" placeholder="Ventilação / oxigenação" /></label>
    <label className={cls}>C · Circulação<input name="circulacao" className="ui-input mt-1.5" placeholder="Perfusão / hemorragia" /></label>
    <label className={cls}>D · Neurológico<input name="neurologico" className="ui-input mt-1.5" placeholder="Glasgow / pupilas / déficit" /></label>
    <label className={`${cls} ${span}`}>E · Exposição<input name="exposicao" className="ui-input mt-1.5" placeholder="Lesões, temperatura, exposição completa" /></label>
  </>;
}

function VitalsFields() {
  return <>
    <label className="text-xs font-bold text-slate-600">PA<input name="pa" className="ui-input mt-1.5" placeholder="120/80" /></label>
    <label className="text-xs font-bold text-slate-600">FC<input name="fc" type="number" min={0} className="ui-input mt-1.5" /></label>
    <label className="text-xs font-bold text-slate-600">FR<input name="fr" type="number" min={0} className="ui-input mt-1.5" /></label>
    <label className="text-xs font-bold text-slate-600">SpO₂ %<input name="spo2" type="number" min={0} max={100} className="ui-input mt-1.5" /></label>
    <label className="text-xs font-bold text-slate-600">Temperatura<input name="temperatura" inputMode="decimal" className="ui-input mt-1.5" /></label>
    <label className="text-xs font-bold text-slate-600">Glicemia<input name="glicemia" type="number" min={0} className="ui-input mt-1.5" /></label>
  </>;
}
