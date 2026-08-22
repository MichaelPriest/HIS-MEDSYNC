import { BedDouble } from "lucide-react";
import { SectionPage } from "@/components/painel/section-page";
import { EncounterPicker } from "@/components/atendimentos/encounter-picker";
import { createClient } from "@/lib/supabase/server";
import { criarInternacao } from "@/modules/internacao/actions";

export default async function InternacaoPage({ searchParams }: { searchParams: Promise<{ sucesso?: string; erro?: string }> }) {
  const params = await searchParams;
  const supabase = await createClient();
  const [{ data: atendimentos }, { data: profissionais }, { data: internados }] = await Promise.all([
    supabase.from("atendimentos").select("id,numero_atendimento,data_abertura,paciente:pacientes(nome_completo,cpf,ra,numero_registro)").in("status", ["aberto","em_espera","em_atendimento"]).order("data_abertura", { ascending: false }).limit(300),
    supabase.from("profissionais").select("id,nome_completo").eq("ativo", true).order("nome_completo").limit(500),
    supabase.from("internacoes").select("id,setor,leito,acomodacao,status,data_internacao,atendimento:atendimentos(numero_atendimento,paciente:pacientes(nome_completo,ra,numero_registro)),profissional:profissionais(nome_completo)").in("status", ["aguardando_leito","internado","transferido"]).order("data_internacao", { ascending: false }).limit(100),
  ]);

  return <SectionPage eyebrow="Assistencial / Internação" title="Internação" description="Admissão em leito e acompanhamento do paciente usando atendimento, RA e registro como identificadores.">
    {params.sucesso ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">Internação registrada com sucesso.</div> : null}
    {params.erro ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">Não foi possível registrar a internação.</div> : null}
    <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
      <form action={criarInternacao} className="ui-card p-6">
        <div className="mb-6 flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-brand-50 text-brand-700"><BedDouble className="size-5" /></span><div><h2 className="font-semibold text-slate-900">Nova internação</h2><p className="text-sm text-slate-500">Vincule o leito ao episódio assistencial correto.</p></div></div>
        <EncounterPicker encounters={(atendimentos ?? []).map((item) => { const p = Array.isArray(item.paciente) ? item.paciente[0] : item.paciente; return { id: item.id, numero_atendimento: item.numero_atendimento, data_abertura: item.data_abertura, paciente: { nome_completo: p?.nome_completo ?? "Paciente", cpf: p?.cpf ?? null, ra: p?.ra ?? "—", numero_registro: p?.numero_registro ?? 0 } }; })} name="atendimento_id" />
        <div className="mt-6 grid gap-5 md:grid-cols-2">
          <label className="space-y-2 text-sm font-medium text-slate-700 md:col-span-2"><span>Profissional responsável</span><select name="profissional_responsavel_id" defaultValue="" className="ui-input"><option value="">A definir</option>{profissionais?.map((p) => <option key={p.id} value={p.id}>{p.nome_completo}</option>)}</select></label>
          <label className="space-y-2 text-sm font-medium text-slate-700"><span>Setor *</span><input name="setor" required className="ui-input" placeholder="Ex.: Clínica Médica" /></label>
          <label className="space-y-2 text-sm font-medium text-slate-700"><span>Leito</span><input name="leito" className="ui-input" placeholder="Ex.: 204-B" /></label>
          <label className="space-y-2 text-sm font-medium text-slate-700"><span>Acomodação</span><select name="acomodacao" defaultValue="" className="ui-input"><option value="">Selecione</option><option value="enfermaria">Enfermaria</option><option value="apartamento">Apartamento</option><option value="uti">UTI</option><option value="observacao">Observação</option></select></label>
          <label className="space-y-2 text-sm font-medium text-slate-700"><span>Previsão de alta</span><input name="previsao_alta" type="date" className="ui-input" /></label>
          <label className="space-y-2 text-sm font-medium text-slate-700 md:col-span-2"><span>Motivo da internação</span><textarea name="motivo" rows={3} className="ui-input" /></label>
          <label className="space-y-2 text-sm font-medium text-slate-700 md:col-span-2"><span>Observações</span><textarea name="observacoes" rows={3} className="ui-input" /></label>
        </div>
        <div className="mt-6 flex justify-end border-t border-slate-100 pt-5"><button className="ui-button-primary">Registrar internação</button></div>
      </form>
      <section className="ui-card overflow-hidden"><div className="border-b border-slate-100 p-5"><h2 className="font-semibold text-slate-900">Pacientes internados</h2><p className="text-sm text-slate-500">Internações ativas e aguardando leito.</p></div>{internados?.length ? <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-5 py-3">Paciente</th><th className="px-5 py-3">Local</th><th className="px-5 py-3">Responsável</th><th className="px-5 py-3">Status</th></tr></thead><tbody className="divide-y divide-slate-100">{internados.map((item) => { const a = Array.isArray(item.atendimento) ? item.atendimento[0] : item.atendimento; const p = Array.isArray(a?.paciente) ? a?.paciente[0] : a?.paciente; const prof = Array.isArray(item.profissional) ? item.profissional[0] : item.profissional; return <tr key={item.id} className="hover:bg-slate-50"><td className="px-5 py-4"><p className="font-medium text-slate-900">{p?.nome_completo ?? "Paciente"}</p><p className="text-xs text-slate-500">Atend. #{a?.numero_atendimento ?? "—"} · {p?.ra ?? "—"} · Reg. #{p?.numero_registro ?? "—"}</p></td><td className="px-5 py-4 text-slate-600">{item.setor}{item.leito ? ` · ${item.leito}` : ""}</td><td className="px-5 py-4 text-slate-600">{prof?.nome_completo ?? "—"}</td><td className="px-5 py-4"><span className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700">{item.status}</span></td></tr>; })}</tbody></table></div> : <div className="p-10 text-center text-sm text-slate-500">Nenhuma internação ativa.</div>}</section>
    </div>
  </SectionPage>;
}
