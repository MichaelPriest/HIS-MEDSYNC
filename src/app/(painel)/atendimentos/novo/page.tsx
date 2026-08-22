import Link from "next/link";
import { SectionPage } from "@/components/painel/section-page";
import { createClient } from "@/lib/supabase/server";
import { abrirAtendimento } from "@/modules/atendimentos/actions";

export default async function NovoAtendimentoPage({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const { erro } = await searchParams;
  const supabase = await createClient();
  const [{ data: pacientes }, { data: profissionais }, { data: tipos }] = await Promise.all([
    supabase.from("pacientes").select("id,nome_completo").eq("ativo", true).order("nome_completo").limit(500),
    supabase.from("profissionais").select("id,nome_completo").eq("ativo", true).order("nome_completo").limit(500),
    supabase.from("catalogos").select("codigo,descricao").eq("ativo", true).eq("tipo", "tipo_atendimento").order("descricao"),
  ]);
  return <SectionPage eyebrow="Assistencial / Atendimento / Novo" title="Abrir atendimento" description="Crie o registro ADT que será a referência para triagem, prontuário, prescrição e faturamento.">
    <form action={abrirAtendimento} className="ui-card p-6">
      {erro ? <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">Preencha os dados obrigatórios e confirme suas permissões.</div> : null}
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        <label className="space-y-2 text-sm font-medium text-slate-700 md:col-span-2"><span>Paciente *</span><select name="paciente_id" required defaultValue="" className="ui-input"><option value="">Selecione o paciente</option>{pacientes?.map((item) => <option key={item.id} value={item.id}>{item.nome_completo}</option>)}</select></label>
        <label className="space-y-2 text-sm font-medium text-slate-700"><span>Profissional</span><select name="profissional_id" defaultValue="" className="ui-input"><option value="">A definir</option>{profissionais?.map((item) => <option key={item.id} value={item.id}>{item.nome_completo}</option>)}</select></label>
        <label className="space-y-2 text-sm font-medium text-slate-700"><span>Tipo de Atendimento *</span><select name="tipo_atendimento" required defaultValue="" className="ui-input"><option value="">Selecione</option>{tipos?.length ? tipos.map((item) => <option key={item.codigo} value={item.codigo}>{item.descricao}</option>) : <><option value="ambulatorial">Ambulatorial</option><option value="urgencia">Urgência / Emergência</option><option value="internacao">Internação</option><option value="sadt">SADT</option></>}</select></label>
        <label className="space-y-2 text-sm font-medium text-slate-700"><span>Origem</span><select name="origem" defaultValue="" className="ui-input"><option value="">Selecione</option><option value="agenda">Agenda</option><option value="demanda_espontanea">Demanda espontânea</option><option value="transferencia">Transferência</option><option value="referencia">Referência</option></select></label>
        <label className="space-y-2 text-sm font-medium text-slate-700 md:col-span-2 xl:col-span-3"><span>Observações</span><textarea name="observacoes" rows={4} className="ui-input" /></label>
      </div>
      <div className="mt-8 flex justify-end gap-3 border-t border-slate-100 pt-5"><Link href="/atendimentos" className="btn-secondary">Cancelar</Link><button className="ui-button-primary">Abrir atendimento</button></div>
    </form>
  </SectionPage>;
}
