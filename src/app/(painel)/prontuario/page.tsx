import { ShieldCheck } from "lucide-react";
import { SectionPage } from "@/components/painel/section-page";
import { createClient } from "@/lib/supabase/server";
import { registrarEvolucao } from "@/modules/prontuario/actions";

function relNome(rel: { nome_completo?: string } | { nome_completo?: string }[] | null) { return Array.isArray(rel) ? rel[0]?.nome_completo : rel?.nome_completo; }

export default async function ProntuarioPage({ searchParams }: { searchParams: Promise<{ sucesso?: string; erro?: string }> }) {
  const params = await searchParams;
  const supabase = await createClient();
  const [{ data: atendimentos }, { data: profissionais }, { data: evolucoes }] = await Promise.all([
    supabase.from("atendimentos").select("id,data_abertura,paciente:pacientes(nome_completo)").in("status", ["aberto","em_espera","em_atendimento"]).order("data_abertura", { ascending: false }).limit(100),
    supabase.from("profissionais").select("id,nome_completo").eq("ativo", true).order("nome_completo").limit(500),
    supabase.from("prontuario_evolucoes").select("id,created_at,tipo_evolucao,atendimento:atendimentos(paciente:pacientes(nome_completo)),profissional:profissionais(nome_completo)").order("created_at", { ascending: false }).limit(20),
  ]);
  return <SectionPage eyebrow="Assistencial / Prontuário" title="Prontuário" description="Evoluções clínicas vinculadas ao atendimento, com estrutura SOAP e histórico imutável de autoria.">
    {params.sucesso ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">Evolução registrada com sucesso.</div> : null}
    {params.erro ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">Não foi possível registrar a evolução.</div> : null}
    <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
      <form action={registrarEvolucao} className="ui-card p-6">
        <div className="mb-6 flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-brand-50 text-brand-700"><ShieldCheck className="size-5" /></span><div><h2 className="font-semibold text-slate-900">Nova evolução</h2><p className="text-sm text-slate-500">Registro clínico vinculado ao atendimento e profissional.</p></div></div>
        <div className="grid gap-5 md:grid-cols-2">
          <label className="space-y-2 text-sm font-medium text-slate-700 md:col-span-2"><span>Atendimento *</span><select name="atendimento_id" required defaultValue="" className="ui-input"><option value="">Selecione</option>{atendimentos?.map((item) => <option key={item.id} value={item.id}>{relNome(item.paciente) ?? "Paciente"} · {new Date(item.data_abertura).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}</option>)}</select></label>
          <label className="space-y-2 text-sm font-medium text-slate-700"><span>Profissional *</span><select name="profissional_id" required defaultValue="" className="ui-input"><option value="">Selecione</option>{profissionais?.map((item) => <option key={item.id} value={item.id}>{item.nome_completo}</option>)}</select></label>
          <label className="space-y-2 text-sm font-medium text-slate-700"><span>Tipo</span><select name="tipo_evolucao" defaultValue="evolucao" className="ui-input"><option value="evolucao">Evolução</option><option value="admissao">Admissão</option><option value="intercorrencia">Intercorrência</option><option value="alta">Alta</option></select></label>
          <label className="space-y-2 text-sm font-medium text-slate-700 md:col-span-2"><span>Subjetivo</span><textarea name="subjetivo" rows={3} className="ui-input" /></label>
          <label className="space-y-2 text-sm font-medium text-slate-700 md:col-span-2"><span>Objetivo</span><textarea name="objetivo" rows={3} className="ui-input" /></label>
          <label className="space-y-2 text-sm font-medium text-slate-700 md:col-span-2"><span>Avaliação</span><textarea name="avaliacao" rows={3} className="ui-input" /></label>
          <label className="space-y-2 text-sm font-medium text-slate-700 md:col-span-2"><span>Plano</span><textarea name="plano" rows={3} className="ui-input" /></label>
        </div>
        <div className="mt-6 flex justify-end border-t border-slate-100 pt-5"><button className="ui-button-primary">Registrar evolução</button></div>
      </form>
      <section className="ui-card p-6"><h2 className="font-semibold text-slate-900">Evoluções recentes</h2><div className="mt-4 space-y-3">{evolucoes?.length ? evolucoes.map((item) => { const atendimentoRel = Array.isArray(item.atendimento) ? item.atendimento[0] : item.atendimento; const pacienteRel = Array.isArray(atendimentoRel?.paciente) ? atendimentoRel?.paciente[0] : atendimentoRel?.paciente; const profissionalRel = Array.isArray(item.profissional) ? item.profissional[0] : item.profissional; return <div key={item.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4"><p className="font-semibold text-slate-900">{pacienteRel?.nome_completo ?? "Paciente"}</p><p className="mt-1 text-sm text-slate-600">{profissionalRel?.nome_completo ?? "Profissional"} · {item.tipo_evolucao}</p><p className="mt-1 text-xs text-slate-400">{new Date(item.created_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}</p></div>; }) : <p className="text-sm text-slate-500">Nenhuma evolução visível.</p>}</div></section>
    </div>
  </SectionPage>;
}
