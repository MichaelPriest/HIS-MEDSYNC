import { Stethoscope } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { solicitarAvaliacaoMedica } from "@/modules/avaliacao-medica/actions";

function dataBr(value: string | null) {
  return value ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(value)) : "—";
}

export async function AvaliacaoMedicaPanel({ atendimentoId }: { atendimentoId: string }) {
  const supabase = await createClient();
  const [{ data: especialidades }, { data: solicitacoes }] = await Promise.all([
    supabase.from("profissionais").select("especialidade").eq("ativo", true).not("especialidade", "is", null).order("especialidade").limit(500),
    supabase.from("encaminhamentos_assistenciais")
      .select("id,especialidade,prioridade,status,motivo,created_at,solicitante:profissionais!encaminhamentos_assistenciais_solicitante_profissional_id_fkey(nome_completo)")
      .eq("atendimento_id", atendimentoId)
      .in("tipo_solicitacao", ["avaliacao_medica", "interconsulta"])
      .order("created_at", { ascending: false }).limit(30),
  ]);
  const opcoes = [...new Set((especialidades ?? []).map((item) => String(item.especialidade ?? "").trim()).filter(Boolean))];

  return <section className="ui-card mt-6 p-5">
    <div className="flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-violet-50 text-violet-700"><Stethoscope className="size-5"/></span><div><h2 className="font-semibold text-slate-900">Solicitar avaliação médica / interconsulta</h2><p className="mt-1 text-sm text-slate-500">Escolha apenas a especialidade. O médico solicitante é o usuário logado e o médico avaliador assume pela própria fila da especialidade.</p></div></div>
    <form action={solicitarAvaliacaoMedica} className="mt-4 grid gap-3 lg:grid-cols-[260px_170px_1fr_auto]">
      <input type="hidden" name="atendimento_id" value={atendimentoId}/>
      <select name="especialidade" required defaultValue="" className="ui-input"><option value="">Especialidade da avaliação</option>{opcoes.map((especialidade) => <option key={especialidade} value={especialidade}>{especialidade}</option>)}</select>
      <select name="prioridade" defaultValue="normal" className="ui-input"><option value="normal">Normal</option><option value="preferencial">Prioritária</option><option value="emergencia">Emergência</option></select>
      <input name="motivo" required className="ui-input" placeholder="Motivo clínico / pergunta para o especialista"/>
      <button className="ui-button-primary"><Stethoscope className="size-4"/>Solicitar avaliação</button>
    </form>
    {solicitacoes?.length ? <div className="mt-4 space-y-2 border-t border-slate-100 pt-4">{solicitacoes.map((item) => { const solicitante = Array.isArray(item.solicitante) ? item.solicitante[0] : item.solicitante; return <div key={item.id} className="rounded-xl bg-slate-50 p-3 text-sm"><div className="flex flex-wrap items-center justify-between gap-2"><strong className="text-slate-900">{item.especialidade}</strong><span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-slate-600">{String(item.status).replaceAll("_", " ")}</span></div><p className="mt-1 text-slate-600">{item.motivo || "Sem motivo informado"}</p><p className="mt-1 text-xs text-slate-400">Solicitada por {solicitante?.nome_completo ?? "profissional logado"} · {dataBr(item.created_at)}</p></div>; })}</div> : null}
  </section>;
}
