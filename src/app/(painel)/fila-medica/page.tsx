import { BellRing, Clock3, MapPin, Stethoscope, UserRoundCheck } from "lucide-react";
import { SectionPage } from "@/components/painel/section-page";
import { getAssistencialContext } from "@/modules/assistencial/context";
import { assumirPaciente } from "@/modules/fila-medica/actions";

function one<T>(rel: T | T[] | null): T | null {
  return Array.isArray(rel) ? rel[0] ?? null : rel;
}

function norm(v: string | null | undefined) {
  return (v ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

type Triagem = {
  atendimento_id: string;
  classificacao_risco: string | null;
  queixa_principal: string | null;
  pressao_arterial: string | null;
  frequencia_cardiaca: number | null;
  saturacao_o2: number | null;
  temperatura_c: number | null;
};

const MENSAGENS_ERRO: Record<string, string> = {
  encaminhamento: "Encaminhamento inválido.",
  "perfil-profissional": "O usuário não está vinculado a um profissional ativo.",
  indisponivel: "Este paciente já foi chamado ou assumido por outro profissional.",
  especialidade: "A especialidade do profissional não corresponde à fila do paciente.",
  atendimento: "Não foi possível atualizar o atendimento clínico.",
  "fila-setorial": "Não foi possível publicar a chamada no painel integrado.",
  assumir: "O paciente foi assumido por outro profissional antes desta chamada.",
};

export default async function FilaMedicaPage({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const { erro } = await searchParams;
  const { supabase, user, unidadeId } = await getAssistencialContext();

  let profissional = (await supabase.from("profissionais").select("id,nome_completo,especialidade").eq("usuario_id", user.id).eq("ativo", true).maybeSingle()).data;
  if (!profissional && user.email) {
    profissional = (await supabase.from("profissionais").select("id,nome_completo,especialidade").ilike("email", user.email).eq("ativo", true).limit(1).maybeSingle()).data;
  }

  const { data: fila } = await supabase.from("encaminhamentos_assistenciais")
    .select("id,atendimento_id,especialidade,prioridade,created_at,status,paciente:pacientes(nome_completo,ra,numero_registro),atendimento:atendimentos(numero_atendimento,setor_atual)")
    .eq("unidade_id", unidadeId)
    .eq("status", "aguardando_profissional")
    .order("created_at", { ascending: true })
    .limit(200);

  const atendimentoIds = (fila ?? []).map((item) => item.atendimento_id);
  const { data: triagens } = atendimentoIds.length
    ? await supabase.from("triagens").select("atendimento_id,classificacao_risco,queixa_principal,pressao_arterial,frequencia_cardiaca,saturacao_o2,temperatura_c").in("atendimento_id", atendimentoIds)
    : { data: [] as Triagem[] };
  const triagemPorAtendimento = new Map((triagens ?? []).map((item) => [item.atendimento_id, item as Triagem]));
  const especialidadeProf = norm(profissional?.especialidade);
  const visiveis = (fila ?? []).filter((item) => {
    const esp = norm(item.especialidade);
    return especialidadeProf && (especialidadeProf.includes(esp) || esp.includes(especialidadeProf));
  });

  return (
    <SectionPage
      eyebrow="Assistencial / Médico"
      title="Minha fila médica"
      description="Pacientes encaminhados pela triagem para a especialidade vinculada ao profissional logado. A chamada é publicada no painel integrado da unidade."
    >
      {erro ? (
        <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {MENSAGENS_ERRO[erro] ?? "Não foi possível chamar e assumir o paciente."}
        </div>
      ) : null}

      {!profissional ? (
        <div className="ui-card p-6">
          <div className="flex items-center gap-3">
            <UserRoundCheck className="size-5 text-amber-600" />
            <div>
              <h2 className="font-semibold text-slate-900">Usuário ainda não vinculado a um profissional</h2>
              <p className="mt-1 text-sm text-slate-500">Vincule este usuário ao cadastro profissional para ativar a fila por especialidade.</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="mb-5 rounded-2xl border border-brand-100 bg-brand-50/60 p-4">
          <div className="flex items-center gap-3">
            <Stethoscope className="size-5 text-brand-700" />
            <div>
              <p className="font-semibold text-brand-950">{profissional.nome_completo}</p>
              <p className="text-sm text-brand-700">Especialidade: {profissional.especialidade || "não informada"}</p>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {visiveis.length ? visiveis.map((item) => {
          const paciente = one(item.paciente);
          const atendimento = one(item.atendimento);
          const triagem = triagemPorAtendimento.get(item.atendimento_id);
          const prontoSocorro = String(atendimento?.setor_atual ?? "") === "pronto_socorro";
          const pontoPadrao = prontoSocorro ? "Box Médico 01" : "Consultório 01";

          return (
            <div key={item.id} className="ui-card p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h2 className="font-semibold text-slate-900">{paciente?.nome_completo ?? "Paciente"}</h2>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${item.prioridade === "emergencia" ? "bg-rose-100 text-rose-700" : item.prioridade === "preferencial" ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}`}>
                      {item.prioridade ?? "normal"}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-slate-500">Atendimento #{atendimento?.numero_atendimento ?? "—"} · Registro #{paciente?.numero_registro ?? "—"} · {paciente?.ra ?? "—"}</p>
                  <p className="mt-2 text-sm text-slate-700"><b>Especialidade:</b> {item.especialidade}</p>
                  {triagem?.queixa_principal ? <p className="mt-1 text-sm text-slate-700"><b>Queixa:</b> {triagem.queixa_principal}</p> : null}
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
                    {triagem?.pressao_arterial ? <span>PA {triagem.pressao_arterial}</span> : null}
                    {triagem?.frequencia_cardiaca ? <span>FC {triagem.frequencia_cardiaca}</span> : null}
                    {triagem?.saturacao_o2 ? <span>SpO₂ {triagem.saturacao_o2}%</span> : null}
                    {triagem?.temperatura_c ? <span>Temp. {triagem.temperatura_c}°C</span> : null}
                    <span className="flex items-center gap-1"><Clock3 className="size-3" />{new Date(item.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" })}</span>
                  </div>
                </div>

                <form action={assumirPaciente} className="flex w-full flex-col gap-2 sm:w-auto sm:min-w-[330px] sm:flex-row">
                  <input type="hidden" name="encaminhamento_id" value={item.id} />
                  <label className="relative min-w-0 flex-1">
                    <MapPin className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                    <input
                      name="ponto_atendimento"
                      defaultValue={pontoPadrao}
                      required
                      maxLength={80}
                      className="ui-input h-10 w-full pl-9"
                      aria-label="Ponto de atendimento da chamada"
                    />
                  </label>
                  <button className="ui-button-primary h-10 whitespace-nowrap"><BellRing className="size-4" /> Chamar e assumir</button>
                </form>
              </div>
            </div>
          );
        }) : (
          <div className="ui-card p-8 text-center text-sm text-slate-500">Nenhum paciente aguardando para esta especialidade nesta unidade.</div>
        )}
      </div>
    </SectionPage>
  );
}
