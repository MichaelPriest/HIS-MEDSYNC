import { AlertTriangle, Barcode, CheckCircle2, Clock3, Pill, UserRoundCheck } from "lucide-react";
import { SectionPage } from "@/components/painel/section-page";
import { getAssistencialContext } from "@/modules/assistencial/context";
import { checarAdministracaoEnfermagemAction } from "@/modules/enfermagem/actions";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PacienteRel = { nome_completo: string | null; ra: string | null; numero_registro: string | null; cpf: string | null; cns: string | null };
type AtendimentoRel = { numero_atendimento: number | string | null; paciente_id: string | null; paciente: PacienteRel | PacienteRel[] | null };
type PrescricaoRel = { item: string | null; dose: string | null; via: string | null; frequencia: string | null; produto_id: string | null; atendimento_id: string | null; atendimento: AtendimentoRel | AtendimentoRel[] | null };
type Aprazamento = { id: string; prescricao_id: string; programado_em: string; tolerancia_minutos: number | null; status: string; justificativa: string | null; prescricao: PrescricaoRel | PrescricaoRel[] | null };
type Dispensacao = { id: string; prescricao_id: string; item: string; lote: string | null; dispensado_em: string | null; status: string };
type Profissional = { id: string; nome_completo: string; especialidade: string | null };

function one<T>(value: T | T[] | null) {
  return Array.isArray(value) ? value[0] ?? null : value;
}

function when(value: string | null | undefined) {
  return value
    ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(value))
    : "—";
}

export default async function EnfermagemChecagemPage({ searchParams }: { searchParams: Promise<{ sucesso?: string; erro?: string }> }) {
  const sp = await searchParams;
  const { supabase, user, empresaId, unidadeId } = await getAssistencialContext();
  const agora = new Date();
  const inicio = new Date(agora.getTime() - 12 * 3600000).toISOString();
  const fim = new Date(agora.getTime() + 36 * 3600000).toISOString();

  const [aprazRes, dispRes, profissionalRes, segundoProfRes] = await Promise.all([
    supabase
      .from("prescricao_aprazamentos")
      .select("id,prescricao_id,programado_em,tolerancia_minutos,status,justificativa,prescricao:prescricoes(item,dose,via,frequencia,produto_id,atendimento_id,atendimento:atendimentos(numero_atendimento,paciente_id,paciente:pacientes(nome_completo,ra,numero_registro,cpf,cns)))")
      .eq("empresa_id", empresaId)
      .eq("unidade_id", unidadeId)
      .gte("programado_em", inicio)
      .lte("programado_em", fim)
      .order("programado_em", { ascending: true })
      .limit(300),
    supabase
      .from("dispensacoes_medicamentos")
      .select("id,prescricao_id,item,lote,dispensado_em,status")
      .eq("empresa_id", empresaId)
      .eq("unidade_id", unidadeId)
      .in("status", ["dispensado", "parcial"])
      .order("dispensado_em", { ascending: false })
      .limit(300),
    supabase
      .from("profissionais")
      .select("id,nome_completo,especialidade")
      .eq("empresa_id", empresaId)
      .eq("usuario_id", user.id)
      .eq("ativo", true)
      .limit(1)
      .maybeSingle(),
    supabase
      .from("profissionais")
      .select("id,nome_completo,especialidade")
      .eq("empresa_id", empresaId)
      .eq("ativo", true)
      .order("nome_completo")
      .limit(500),
  ]);

  let profissional = profissionalRes.data;
  if (!profissional && user.email) {
    profissional = (
      await supabase
        .from("profissionais")
        .select("id,nome_completo,especialidade")
        .eq("empresa_id", empresaId)
        .ilike("email", user.email)
        .eq("ativo", true)
        .limit(1)
        .maybeSingle()
    ).data;
  }

  const aprazamentos = (aprazRes.data ?? []) as unknown as Aprazamento[];
  const dispensacoes = (dispRes.data ?? []) as unknown as Dispensacao[];
  const profissionais = (segundoProfRes.data ?? []) as unknown as Profissional[];
  const pendentes = aprazamentos.filter((item) => item.status === "pendente");
  const atrasados = pendentes.filter((item) => new Date(item.programado_em).getTime() + Number(item.tolerancia_minutos ?? 30) * 60000 < Date.now());
  const proximas = pendentes.filter((item) => !atrasados.includes(item));

  return (
    <SectionPage
      eyebrow="Assistencial / Enfermagem"
      title="Checagem de Prescrição"
      description="Administração de medicamentos aprazados, com identificação do paciente, rastreabilidade profissional e registro de recusa ou omissão."
    >
      {sp.sucesso ? <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">Checagem registrada: {sp.sucesso}.</div> : null}
      {sp.erro ? <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">Não foi possível registrar a checagem: {decodeURIComponent(sp.erro)}.</div> : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="his-kpi"><p className="text-xs font-black uppercase text-slate-400">Pendentes</p><p className="mt-2 text-3xl font-black text-amber-700">{pendentes.length}</p></div>
        <div className="his-kpi"><p className="text-xs font-black uppercase text-slate-400">Atrasadas</p><p className="mt-2 text-3xl font-black text-rose-700">{atrasados.length}</p></div>
        <div className="his-kpi"><p className="text-xs font-black uppercase text-slate-400">Próximas</p><p className="mt-2 text-3xl font-black text-brand-700">{proximas.length}</p></div>
        <div className="his-kpi"><p className="text-xs font-black uppercase text-slate-400">Profissional logado</p><p className="mt-2 text-base font-black text-slate-950">{profissional?.nome_completo ?? "Sem vínculo"}</p><p className="mt-1 text-xs text-slate-500">{profissional?.especialidade ?? "Vincule este usuário a um profissional"}</p></div>
      </section>

      {!profissional ? <section className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4"><div className="flex items-center gap-3"><UserRoundCheck className="size-5 text-amber-700"/><p className="text-sm font-semibold text-amber-900">A checagem fica bloqueada enquanto o usuário logado não estiver vinculado a um profissional ativo.</p></div></section> : null}

      <section className="mt-6">
        <div className="mb-3 flex items-center gap-3"><Barcode className="size-5 text-brand-700"/><div><h2 className="font-black text-slate-900">Doses aprazadas</h2><p className="text-sm text-slate-500">A prescrição médica define a frequência e os horários; a Enfermagem confirma a administração real.</p></div></div>
        <div className="space-y-3">
          {pendentes.length ? pendentes.map((ap) => {
            const prescricao = one(ap.prescricao);
            const atendimento = one(prescricao?.atendimento ?? null);
            const paciente = one(atendimento?.paciente ?? null);
            const disponiveis = dispensacoes.filter((d) => d.prescricao_id === ap.prescricao_id);
            const atrasado = new Date(ap.programado_em).getTime() + Number(ap.tolerancia_minutos ?? 30) * 60000 < Date.now();
            return (
              <article key={ap.id} className={`his-card p-5 ${atrasado ? "border-rose-200" : ""}`}>
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2"><p className="font-black text-slate-950">{prescricao?.item ?? "Medicamento"}</p>{atrasado ? <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-1 text-[11px] font-black text-rose-700"><AlertTriangle className="size-3"/>Atrasada</span> : <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-black text-emerald-700"><Clock3 className="size-3"/>No prazo</span>}</div>
                    <p className="mt-1 text-sm text-slate-600">{prescricao?.dose ?? "—"} · {prescricao?.via ?? "—"} · {prescricao?.frequencia ?? "—"}</p>
                    <p className="mt-2 text-sm font-bold text-slate-800">{paciente?.nome_completo ?? "Paciente"}</p>
                    <p className="mt-1 text-xs text-slate-500">Atend. #{atendimento?.numero_atendimento ?? "—"} · RA {paciente?.ra ?? "—"} · Registro {paciente?.numero_registro ?? "—"}</p>
                    <p className="mt-2 text-xs font-black text-brand-700">Programada para {when(ap.programado_em)}</p>
                  </div>

                  {profissional ? <form action={checarAdministracaoEnfermagemAction} className="grid w-full gap-2 lg:max-w-3xl lg:grid-cols-2">
                    <input type="hidden" name="aprazamento_id" value={ap.id}/>
                    <select name="dispensacao_id" className="ui-input" defaultValue=""><option value="">Dispensação vinculada</option>{disponiveis.map((d) => <option key={d.id} value={d.id}>{d.item} · lote {d.lote ?? "—"} · {when(d.dispensado_em)}</option>)}</select>
                    <select name="status" className="ui-input" defaultValue="administrado"><option value="administrado">Administrado</option><option value="recusado">Recusado pelo paciente</option><option value="omitido">Omitido / não administrado</option></select>
                    <input name="codigo_paciente" required className="ui-input" autoComplete="off" placeholder="Ler pulseira: RA / registro / CNS / CPF"/>
                    <input name="codigo_medicamento" className="ui-input" autoComplete="off" placeholder="Ler código do medicamento"/>
                    <input name="dose" className="ui-input" defaultValue={prescricao?.dose ?? ""} placeholder="Dose administrada"/>
                    <input name="via" className="ui-input" defaultValue={prescricao?.via ?? ""} placeholder="Via"/>
                    <select name="segundo_profissional_id" className="ui-input" defaultValue=""><option value="">Sem segundo profissional</option>{profissionais.filter((pr) => pr.id !== profissional.id).map((pr) => <option key={pr.id} value={pr.id}>{pr.nome_completo}</option>)}</select>
                    <label className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 text-sm font-semibold"><input type="checkbox" name="dupla_checagem"/>Dupla checagem</label>
                    <input name="justificativa" className="ui-input lg:col-span-2" placeholder="Justificativa obrigatória para recusa ou omissão"/>
                    <button className="ui-button-primary lg:col-span-2 lg:justify-self-end"><CheckCircle2 className="size-4"/>Confirmar checagem</button>
                  </form> : null}
                </div>
              </article>
            );
          }) : <div className="his-card p-8 text-center text-sm text-slate-500"><Pill className="mx-auto mb-2 size-5"/>Nenhuma dose pendente na janela atual.</div>}
        </div>
      </section>
    </SectionPage>
  );
}
