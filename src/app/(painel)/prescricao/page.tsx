import { Pill } from "lucide-react";
import { SectionPage } from "@/components/painel/section-page";
import { EncounterPicker } from "@/components/atendimentos/encounter-picker";
import { createClient } from "@/lib/supabase/server";
import { criarPrescricao } from "@/modules/prescricao/actions";

export default async function PrescricaoPage({ searchParams }: { searchParams: Promise<{ sucesso?: string; erro?: string }> }) {
  const params = await searchParams;
  const supabase = await createClient();
  const [{ data: atendimentos }, { data: profissionais }, { data: recentes }] = await Promise.all([
    supabase.from("atendimentos").select("id,numero_atendimento,data_abertura,paciente:pacientes(nome_completo,cpf,ra,numero_registro)").in("status", ["aberto","em_espera","em_atendimento"]).order("data_abertura", { ascending: false }).limit(300),
    supabase.from("profissionais").select("id,nome_completo").eq("ativo", true).order("nome_completo").limit(500),
    supabase.from("prescricoes").select("id,item,dose,via,frequencia,status,created_at,atendimento:atendimentos(numero_atendimento,paciente:pacientes(nome_completo,ra,numero_registro)),profissional:profissionais(nome_completo)").order("created_at", { ascending: false }).limit(20),
  ]);

  return <SectionPage eyebrow="Assistencial / Prescrição" title="Prescrição" description="Prescrição vinculada ao atendimento, identificada por número do atendimento, RA e registro do paciente.">
    {params.sucesso ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">Prescrição registrada com sucesso.</div> : null}
    {params.erro ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">Não foi possível registrar a prescrição.</div> : null}
    <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
      <form action={criarPrescricao} className="ui-card p-6">
        <div className="mb-6 flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-brand-50 text-brand-700"><Pill className="size-5" /></span><div><h2 className="font-semibold text-slate-900">Nova prescrição</h2><p className="text-sm text-slate-500">Localize o episódio por nome, CPF, RA, registro ou nº do atendimento.</p></div></div>
        <EncounterPicker encounters={(atendimentos ?? []).map((item) => { const p = Array.isArray(item.paciente) ? item.paciente[0] : item.paciente; return { id: item.id, numero_atendimento: item.numero_atendimento, data_abertura: item.data_abertura, paciente: { nome_completo: p?.nome_completo ?? "Paciente", cpf: p?.cpf ?? null, ra: p?.ra ?? "—", numero_registro: p?.numero_registro ?? 0 } }; })} name="atendimento_id" />
        <div className="mt-6 grid gap-5 md:grid-cols-2">
          <label className="space-y-2 text-sm font-medium text-slate-700"><span>Profissional *</span><select name="profissional_id" required defaultValue="" className="ui-input"><option value="">Selecione</option>{profissionais?.map((p) => <option key={p.id} value={p.id}>{p.nome_completo}</option>)}</select></label>
          <label className="space-y-2 text-sm font-medium text-slate-700"><span>Tipo</span><select name="tipo" defaultValue="medicamento" className="ui-input"><option value="medicamento">Medicamento</option><option value="dieta">Dieta</option><option value="cuidado">Cuidado</option><option value="procedimento">Procedimento</option><option value="outro">Outro</option></select></label>
          <label className="space-y-2 text-sm font-medium text-slate-700 md:col-span-2"><span>Item / medicamento *</span><input name="item" required className="ui-input" placeholder="Ex.: Dipirona 500 mg" /></label>
          <label className="space-y-2 text-sm font-medium text-slate-700"><span>Dose</span><input name="dose" className="ui-input" placeholder="Ex.: 1 comprimido" /></label>
          <label className="space-y-2 text-sm font-medium text-slate-700"><span>Via</span><input name="via" className="ui-input" placeholder="VO, EV, IM..." /></label>
          <label className="space-y-2 text-sm font-medium text-slate-700"><span>Frequência</span><input name="frequencia" className="ui-input" placeholder="Ex.: 6/6h" /></label>
          <label className="space-y-2 text-sm font-medium text-slate-700"><span>Duração</span><input name="duracao" className="ui-input" placeholder="Ex.: 5 dias" /></label>
          <label className="space-y-2 text-sm font-medium text-slate-700 md:col-span-2"><span>Instruções</span><textarea name="instrucoes" rows={3} className="ui-input" /></label>
        </div>
        <div className="mt-6 flex justify-end border-t border-slate-100 pt-5"><button className="ui-button-primary">Registrar prescrição</button></div>
      </form>
      <section className="ui-card p-6"><h2 className="font-semibold text-slate-900">Prescrições recentes</h2><div className="mt-4 space-y-3">{recentes?.length ? recentes.map((item) => { const a = Array.isArray(item.atendimento) ? item.atendimento[0] : item.atendimento; const p = Array.isArray(a?.paciente) ? a?.paciente[0] : a?.paciente; const prof = Array.isArray(item.profissional) ? item.profissional[0] : item.profissional; return <div key={item.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-semibold text-slate-900">{item.item}</p><p className="text-sm text-slate-600">{p?.nome_completo ?? "Paciente"} · Atend. #{a?.numero_atendimento ?? "—"}</p><p className="text-xs text-slate-500">{p?.ra ?? "—"} · Registro #{p?.numero_registro ?? "—"} · {prof?.nome_completo ?? "Profissional"}</p></div><span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">{item.status}</span></div></div>; }) : <p className="text-sm text-slate-500">Nenhuma prescrição visível.</p>}</div></section>
    </div>
  </SectionPage>;
}
