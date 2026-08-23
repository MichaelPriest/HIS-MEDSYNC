import { HeartPulse, Stethoscope } from "lucide-react";
import { AtendimentoPicker } from "@/components/atendimentos/atendimento-picker";
import { SectionPage } from "@/components/painel/section-page";
import { createClient } from "@/lib/supabase/server";
import { registrarTriagem } from "@/modules/triagem/actions";

function relPaciente(rel: { nome_completo?: string; cpf?: string | null; ra?: string; numero_registro?: number } | { nome_completo?: string; cpf?: string | null; ra?: string; numero_registro?: number }[] | null) {
  return Array.isArray(rel) ? rel[0] ?? null : rel;
}

export default async function TriagemPage({ searchParams }: { searchParams: Promise<{ sucesso?: string; erro?: string; atendimento?: string }> }) {
  const params = await searchParams;
  const supabase = await createClient();
  const [{ data: atendimentos }, { data: especialidades }] = await Promise.all([
    supabase.from("atendimentos").select("id,numero_atendimento,data_abertura,paciente:pacientes(nome_completo,cpf,ra,numero_registro)").in("status", ["aberto","em_espera","em_atendimento"]).order("data_abertura", { ascending: false }).limit(200),
    supabase.from("catalogos").select("codigo,descricao").eq("ativo", true).eq("tipo", "especialidade").order("descricao").limit(300),
  ]);
  const atendimentoOptions = (atendimentos ?? []).map((item) => ({ id: item.id, numero_atendimento: item.numero_atendimento ?? null, data_abertura: item.data_abertura, paciente: relPaciente(item.paciente) ? { nome_completo: relPaciente(item.paciente)?.nome_completo ?? "Paciente", cpf: relPaciente(item.paciente)?.cpf ?? null, ra: relPaciente(item.paciente)?.ra ?? "—", numero_registro: relPaciente(item.paciente)?.numero_registro ?? 0 } : null }));

  return <SectionPage eyebrow="Assistencial / Triagem" title="Triagem e classificação" description="A triagem registra sinais vitais, classifica o risco e define a especialidade que receberá o paciente.">
    {params.sucesso ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{params.sucesso === "encaminhado" ? "Triagem concluída e paciente encaminhado para a fila médica da especialidade." : "Etapa concluída com sucesso."}</div> : null}
    {params.erro ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">Não foi possível concluir a triagem. Verifique autorização, atendimento e especialidade.</div> : null}
    <form action={registrarTriagem} className="ui-card p-6">
      <div className="mb-6 flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-brand-50 text-brand-700"><HeartPulse className="size-5" /></span><div><h2 className="font-semibold text-slate-900">Dados da triagem</h2><p className="text-sm text-slate-500">Ao salvar, o paciente será direcionado para a especialidade informada.</p></div></div>
      <div className="mb-6"><AtendimentoPicker atendimentos={atendimentoOptions} /></div>
      <div className="mb-6 rounded-2xl border border-brand-100 bg-brand-50/50 p-4"><label className="block space-y-2 text-sm font-medium text-slate-700"><span className="flex items-center gap-2"><Stethoscope className="size-4 text-brand-700"/>Especialidade de destino *</span><select name="especialidade_destino" required defaultValue="" className="ui-input"><option value="">Selecione a especialidade</option>{especialidades?.length ? especialidades.map((item) => <option key={item.codigo} value={item.descricao}>{item.descricao}</option>) : <><option value="Clínica Médica">Clínica Médica</option><option value="Pediatria">Pediatria</option><option value="Ortopedia">Ortopedia</option><option value="Cardiologia">Cardiologia</option><option value="Ginecologia e Obstetrícia">Ginecologia e Obstetrícia</option><option value="Neurologia">Neurologia</option></>}</select><p className="text-xs font-normal text-slate-500">Essa definição controla qual fila médica poderá visualizar e assumir o paciente.</p></label></div>
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
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
      <div className="mt-6 flex justify-end border-t border-slate-100 pt-5"><button className="ui-button-primary">Concluir triagem e encaminhar</button></div>
    </form>
  </SectionPage>;
}
