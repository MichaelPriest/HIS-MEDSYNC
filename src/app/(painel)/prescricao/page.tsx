import { Pill, ShieldCheck, Ban, Clock3 } from "lucide-react";
import { SectionPage } from "@/components/painel/section-page";
import { EncounterPicker } from "@/components/atendimentos/encounter-picker";
import { createClient } from "@/lib/supabase/server";
import { assinarPrescricaoAction, criarPrescricao, suspenderPrescricaoAction } from "@/modules/prescricao/actions";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function PrescricaoPage({ searchParams }: { searchParams: Promise<{ sucesso?: string; erro?: string }> }) {
  const params = await searchParams;
  const supabase = await createClient();
  const [{ data: atendimentos }, { data: profissionais }, { data: produtos }, { data: recentes }] = await Promise.all([
    supabase.from("atendimentos").select("id,numero_atendimento,data_abertura,paciente:pacientes(nome_completo,cpf,ra,numero_registro)").in("status", ["aberto","em_espera","em_atendimento"]).order("data_abertura", { ascending: false }).limit(300),
    supabase.from("profissionais").select("id,nome_completo").eq("ativo", true).order("nome_completo").limit(500),
    supabase.from("estoque_produtos").select("id,codigo,descricao,unidade_medida,tipo").eq("ativo", true).order("descricao").limit(1000),
    supabase.from("prescricoes").select("id,item,dose,via,frequencia,status,assinado_em,requer_validacao_farmaceutica,created_at,atendimento:atendimentos(numero_atendimento,paciente:pacientes(nome_completo,ra,numero_registro)),profissional:profissionais(nome_completo)").order("created_at", { ascending: false }).limit(40),
  ]);

  return <SectionPage eyebrow="Assistencial / Prescrição" title="Prescrição Hospitalar" description="Rascunho, assinatura, validação farmacêutica, dispensação e administração integrados ao episódio assistencial.">
    {params.sucesso ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">Operação concluída: {params.sucesso}.</div> : null}
    {params.erro ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">Não foi possível concluir a operação: {params.erro}.</div> : null}

    <div className="grid gap-6 xl:grid-cols-[1.1fr_.9fr]">
      <form action={criarPrescricao} className="his-card p-6">
        <div className="mb-6 flex items-center gap-3"><span className="grid size-11 place-items-center rounded-2xl bg-brand-50 text-brand-700"><Pill className="size-5" /></span><div><h2 className="font-black text-slate-900">Novo item de prescrição</h2><p className="text-sm text-slate-500">O item nasce como rascunho. A Farmácia só recebe medicamento após assinatura.</p></div></div>
        <EncounterPicker encounters={(atendimentos ?? []).map((item) => { const p = Array.isArray(item.paciente) ? item.paciente[0] : item.paciente; return { id: item.id, numero_atendimento: item.numero_atendimento, data_abertura: item.data_abertura, paciente: { nome_completo: p?.nome_completo ?? "Paciente", cpf: p?.cpf ?? null, ra: p?.ra ?? "—", numero_registro: p?.numero_registro ?? 0 } }; })} name="atendimento_id" />
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <label className="space-y-2 text-sm font-semibold text-slate-700"><span>Profissional *</span><select name="profissional_id" required defaultValue="" className="ui-input"><option value="">Selecione</option>{profissionais?.map((p) => <option key={p.id} value={p.id}>{p.nome_completo}</option>)}</select></label>
          <label className="space-y-2 text-sm font-semibold text-slate-700"><span>Tipo *</span><select name="tipo" defaultValue="medicamento" className="ui-input"><option value="medicamento">Medicamento</option><option value="dieta">Dieta</option><option value="cuidado">Cuidado</option><option value="procedimento">Procedimento</option><option value="outro">Outro</option></select></label>
          <label className="space-y-2 text-sm font-semibold text-slate-700 md:col-span-2"><span>Produto do estoque</span><select name="produto_id" defaultValue="" className="ui-input"><option value="">Sem vínculo / item livre</option>{produtos?.map((p) => <option key={p.id} value={p.id}>{p.codigo} · {p.descricao} · {p.unidade_medida}</option>)}</select></label>
          <label className="space-y-2 text-sm font-semibold text-slate-700 md:col-span-2"><span>Item / medicamento *</span><input name="item" required className="ui-input" placeholder="Ex.: Dipirona 1 g/2 mL" /></label>
          <label className="space-y-2 text-sm font-semibold text-slate-700"><span>Dose</span><input name="dose" className="ui-input" placeholder="Ex.: 1 g" /></label>
          <label className="space-y-2 text-sm font-semibold text-slate-700"><span>Via</span><input name="via" className="ui-input" placeholder="VO, EV, IM, SC..." /></label>
          <label className="space-y-2 text-sm font-semibold text-slate-700"><span>Quantidade</span><input name="quantidade" type="number" step="0.0001" className="ui-input" /></label>
          <label className="space-y-2 text-sm font-semibold text-slate-700"><span>Unidade da dose</span><input name="unidade_dose" className="ui-input" placeholder="mg, g, mL, UI..." /></label>
          <label className="space-y-2 text-sm font-semibold text-slate-700"><span>Frequência</span><input name="frequencia" className="ui-input" placeholder="6/6h, 8/8h..." /></label>
          <label className="space-y-2 text-sm font-semibold text-slate-700"><span>Duração</span><input name="duracao" className="ui-input" /></label>
          <label className="space-y-2 text-sm font-semibold text-slate-700"><span>Início</span><input name="inicio_em" type="datetime-local" className="ui-input" /></label>
          <label className="space-y-2 text-sm font-semibold text-slate-700"><span>Fim</span><input name="fim_em" type="datetime-local" className="ui-input" /></label>
          <label className="space-y-2 text-sm font-semibold text-slate-700 md:col-span-2"><span>Horários</span><input name="horarios" className="ui-input" placeholder="06:00, 12:00, 18:00, 00:00" /></label>
          <label className="space-y-2 text-sm font-semibold text-slate-700 md:col-span-2"><span>Aprazamento</span><input name="aprazamento" className="ui-input" placeholder="Horários ou programação institucional" /></label>
          <label className="space-y-2 text-sm font-semibold text-slate-700"><span>Diluente</span><input name="diluente" className="ui-input" /></label>
          <label className="space-y-2 text-sm font-semibold text-slate-700"><span>Velocidade de infusão</span><input name="velocidade_infusao" className="ui-input" /></label>
          <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-semibold text-slate-700"><input type="checkbox" name="se_necessario" />Se necessário / PRN</label>
          <label className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-800"><input type="checkbox" name="requer_validacao_farmaceutica" />Exigir validação farmacêutica</label>
          <label className="space-y-2 text-sm font-semibold text-slate-700 md:col-span-2"><span>Instruções</span><textarea name="instrucoes" rows={3} className="ui-input" /></label>
          <label className="space-y-2 text-sm font-semibold text-slate-700 md:col-span-2"><span>Orientações</span><textarea name="orientacoes" rows={3} className="ui-input" /></label>
        </div>
        <div className="mt-6 flex justify-end border-t border-slate-100 pt-5"><button className="ui-button-primary">Salvar rascunho</button></div>
      </form>

      <section className="his-card overflow-hidden">
        <div className="border-b border-slate-100 p-5"><h2 className="font-black text-slate-900">Itens recentes</h2><p className="text-sm text-slate-500">Assine, acompanhe a validação e suspenda sem editar conteúdo já assinado.</p></div>
        <div className="max-h-[920px] divide-y divide-slate-100 overflow-y-auto">
          {recentes?.length ? recentes.map((item) => { const a = Array.isArray(item.atendimento) ? item.atendimento[0] : item.atendimento; const p = Array.isArray(a?.paciente) ? a?.paciente[0] : a?.paciente; const prof = Array.isArray(item.profissional) ? item.profissional[0] : item.profissional; return <article key={item.id} className="p-5">
            <div className="flex items-start justify-between gap-3"><div><p className="font-black text-slate-900">{item.item}</p><p className="mt-1 text-sm text-slate-600">{item.dose || "—"} · {item.via || "—"} · {item.frequencia || "—"}</p><p className="mt-1 text-xs text-slate-500">{p?.nome_completo ?? "Paciente"} · Atend. #{a?.numero_atendimento ?? "—"} · {prof?.nome_completo ?? "Profissional"}</p></div><span className={`rounded-full px-2.5 py-1 text-[11px] font-black ${item.status === "ativa" ? "bg-emerald-50 text-emerald-700" : item.status === "rascunho" ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-600"}`}>{item.status}</span></div>
            <div className="mt-3 flex flex-wrap gap-2 text-xs">{item.assinado_em ? <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-1 font-bold text-brand-700"><ShieldCheck className="size-3.5" />Assinada</span> : <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 font-bold text-amber-700"><Clock3 className="size-3.5" />Aguardando assinatura</span>}{item.requer_validacao_farmaceutica ? <span className="rounded-full bg-violet-50 px-2.5 py-1 font-bold text-violet-700">Validação farmacêutica</span> : null}</div>
            <div className="mt-4 flex flex-wrap gap-2">
              {!item.assinado_em && item.status === "rascunho" ? <form action={assinarPrescricaoAction}><input type="hidden" name="prescricao_id" value={item.id} /><button className="ui-button-primary"><ShieldCheck className="size-4" />Assinar e ativar</button></form> : null}
              {item.status === "ativa" ? <form action={suspenderPrescricaoAction} className="flex min-w-[260px] flex-1 gap-2"><input type="hidden" name="prescricao_id" value={item.id} /><input name="motivo" required className="ui-input" placeholder="Motivo da suspensão" /><button className="btn-secondary text-rose-700"><Ban className="size-4" />Suspender</button></form> : null}
            </div>
          </article>; }) : <p className="p-8 text-center text-sm text-slate-500">Nenhuma prescrição visível.</p>}
        </div>
      </section>
    </div>
  </SectionPage>;
}
