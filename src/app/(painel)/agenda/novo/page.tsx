import Link from "next/link";
import { SectionPage } from "@/components/painel/section-page";
import { createClient } from "@/lib/supabase/server";
import { criarAgendamento } from "@/modules/agenda/actions";

export default async function NovoAgendamentoPage({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const { erro } = await searchParams;
  const supabase = await createClient();
  const [{ data: pacientes }, { data: profissionais }, { data: convenios }, { data: tipos }] = await Promise.all([
    supabase.from("pacientes").select("id,nome_completo").eq("ativo", true).order("nome_completo").limit(500),
    supabase.from("profissionais").select("id,nome_completo").eq("ativo", true).order("nome_completo").limit(500),
    supabase.from("convenios").select("id,nome_fantasia").eq("ativo", true).order("nome_fantasia").limit(300),
    supabase.from("catalogos").select("codigo,descricao").eq("ativo", true).eq("tipo", "tipo_atendimento").order("descricao"),
  ]);
  return <SectionPage eyebrow="Assistencial / Agenda / Novo" title="Novo agendamento" description="Agende paciente, profissional, convênio e janela de atendimento.">
    <form action={criarAgendamento} className="ui-card p-6">
      {erro ? <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">Preencha paciente, início e fim e confirme suas permissões.</div> : null}
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        <label className="space-y-2 text-sm font-medium text-slate-700 md:col-span-2"><span>Paciente *</span><select name="paciente_id" required defaultValue="" className="ui-input"><option value="">Selecione o paciente</option>{pacientes?.map((item) => <option key={item.id} value={item.id}>{item.nome_completo}</option>)}</select></label>
        <label className="space-y-2 text-sm font-medium text-slate-700"><span>Profissional</span><select name="profissional_id" defaultValue="" className="ui-input"><option value="">A definir</option>{profissionais?.map((item) => <option key={item.id} value={item.id}>{item.nome_completo}</option>)}</select></label>
        <label className="space-y-2 text-sm font-medium text-slate-700"><span>Convênio</span><select name="convenio_id" defaultValue="" className="ui-input"><option value="">Particular</option>{convenios?.map((item) => <option key={item.id} value={item.id}>{item.nome_fantasia}</option>)}</select></label>
        <label className="space-y-2 text-sm font-medium text-slate-700"><span>Início *</span><input name="inicio" type="datetime-local" required className="ui-input" /></label>
        <label className="space-y-2 text-sm font-medium text-slate-700"><span>Fim *</span><input name="fim" type="datetime-local" required className="ui-input" /></label>
        <label className="space-y-2 text-sm font-medium text-slate-700"><span>Tipo de Atendimento</span><select name="tipo_atendimento" defaultValue="" className="ui-input"><option value="">Selecione</option>{tipos?.map((item) => <option key={item.codigo} value={item.codigo}>{item.descricao}</option>)}</select></label>
        <label className="space-y-2 text-sm font-medium text-slate-700 md:col-span-2 xl:col-span-3"><span>Observações</span><textarea name="observacoes" rows={4} className="ui-input" /></label>
      </div>
      <div className="mt-8 flex justify-end gap-3 border-t border-slate-100 pt-5"><Link href="/agenda" className="btn-secondary">Cancelar</Link><button className="ui-button-primary">Salvar agendamento</button></div>
    </form>
  </SectionPage>;
}
