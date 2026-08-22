import { HeartPulse } from "lucide-react";
import { SectionPage } from "@/components/painel/section-page";
import { createClient } from "@/lib/supabase/server";
import { registrarTriagem } from "@/modules/triagem/actions";

function relNome(rel: { nome_completo?: string } | { nome_completo?: string }[] | null) { return Array.isArray(rel) ? rel[0]?.nome_completo : rel?.nome_completo; }

export default async function TriagemPage({ searchParams }: { searchParams: Promise<{ sucesso?: string; erro?: string }> }) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data: atendimentos } = await supabase.from("atendimentos").select("id,data_abertura,paciente:pacientes(nome_completo)").in("status", ["aberto","em_espera","em_atendimento"]).order("data_abertura", { ascending: false }).limit(100);
  return <SectionPage eyebrow="Assistencial / Triagem" title="Triagem" description="Registro inicial de sinais vitais, queixa principal e classificação de risco, vinculado ao atendimento.">
    {params.sucesso ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">Triagem registrada com sucesso.</div> : null}
    {params.erro ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">Não foi possível registrar a triagem.</div> : null}
    <form action={registrarTriagem} className="ui-card p-6">
      <div className="mb-6 flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-brand-50 text-brand-700"><HeartPulse className="size-5" /></span><div><h2 className="font-semibold text-slate-900">Dados da triagem</h2><p className="text-sm text-slate-500">Valores devem refletir a aferição realizada no atendimento.</p></div></div>
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        <label className="space-y-2 text-sm font-medium text-slate-700 md:col-span-2 xl:col-span-4"><span>Atendimento *</span><select name="atendimento_id" required defaultValue="" className="ui-input"><option value="">Selecione o atendimento</option>{atendimentos?.map((item) => <option key={item.id} value={item.id}>{relNome(item.paciente) ?? "Paciente"} · {new Date(item.data_abertura).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}</option>)}</select></label>
        <label className="space-y-2 text-sm font-medium text-slate-700"><span>Peso (kg)</span><input name="peso_kg" inputMode="decimal" className="ui-input" /></label>
        <label className="space-y-2 text-sm font-medium text-slate-700"><span>Altura (cm)</span><input name="altura_cm" inputMode="decimal" className="ui-input" /></label>
        <label className="space-y-2 text-sm font-medium text-slate-700"><span>Pressão arterial</span><input name="pressao_arterial" placeholder="120/80" className="ui-input" /></label>
        <label className="space-y-2 text-sm font-medium text-slate-700"><span>FC (bpm)</span><input name="frequencia_cardiaca" inputMode="numeric" className="ui-input" /></label>
        <label className="space-y-2 text-sm font-medium text-slate-700"><span>FR (irpm)</span><input name="frequencia_respiratoria" inputMode="numeric" className="ui-input" /></label>
        <label className="space-y-2 text-sm font-medium text-slate-700"><span>Sat. O₂ (%)</span><input name="saturacao_o2" inputMode="decimal" className="ui-input" /></label>
        <label className="space-y-2 text-sm font-medium text-slate-700"><span>Temperatura (°C)</span><input name="temperatura_c" inputMode="decimal" className="ui-input" /></label>
        <label className="space-y-2 text-sm font-medium text-slate-700"><span>Glicemia (mg/dL)</span><input name="glicemia_mg_dl" inputMode="decimal" className="ui-input" /></label>
        <label className="space-y-2 text-sm font-medium text-slate-700"><span>Dor (0–10)</span><input name="dor_escala" type="number" min={0} max={10} className="ui-input" /></label>
        <label className="space-y-2 text-sm font-medium text-slate-700"><span>Classificação de risco</span><select name="classificacao_risco" defaultValue="" className="ui-input"><option value="">Não classificado</option><option value="azul">Azul</option><option value="verde">Verde</option><option value="amarelo">Amarelo</option><option value="laranja">Laranja</option><option value="vermelho">Vermelho</option></select></label>
        <label className="space-y-2 text-sm font-medium text-slate-700 md:col-span-2 xl:col-span-4"><span>Queixa principal</span><textarea name="queixa_principal" rows={3} className="ui-input" /></label>
        <label className="space-y-2 text-sm font-medium text-slate-700 md:col-span-2 xl:col-span-4"><span>Observações</span><textarea name="observacoes" rows={3} className="ui-input" /></label>
      </div>
      <div className="mt-6 flex justify-end border-t border-slate-100 pt-5"><button className="ui-button-primary">Salvar triagem</button></div>
    </form>
  </SectionPage>;
}
