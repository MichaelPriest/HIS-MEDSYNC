import { PackageCheck, Pill, ShieldCheck, Undo2 } from "lucide-react";
import { SectionPage } from "@/components/painel/section-page";
import { getAssistencialContext } from "@/modules/assistencial/context";
import { devolverMedicamentoAction, dispensarComponentePrescricaoAction, dispensarPrescricaoAction, validarPrescricaoFarmaceuticaAction } from "@/modules/assistencial/medicamentos-actions";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Paciente = { nome_completo: string | null; ra: string | null; numero_registro: string | null };
type Atendimento = { numero_atendimento: string | number | null; paciente: Paciente | Paciente[] | null };
type Validacao = { status: string | null; intervencao: string | null };
type Prescricao = {
  id: string; item: string; dose: string | null; via: string | null; frequencia: string | null; quantidade: number | null;
  unidade_dose: string | null; requer_validacao_farmaceutica: boolean; assinado_em: string | null; status: string;
  produto_id: string | null; atendimento: Atendimento | Atendimento[] | null; validacao: Validacao | Validacao[] | null;
};
type ItemComponente = { descricao: string; concentracao: string | null; apresentacao: string | null };
type Componente = { id: string; prescricao_id: string; item_assistencial_id: string; dose: string | null; quantidade: number | null; unidade_dose: string | null; ordem: number; observacoes: string | null; item: ItemComponente | ItemComponente[] | null };
type Produto = { id: string; item_assistencial_id: string | null; descricao: string; codigo: string; codigo_barras: string | null; unidade_medida: string };
type LoteProduto = { codigo: string; descricao: string; codigo_barras: string | null; unidade_medida: string };
type Lote = { id: string; produto_id: string; numero_lote: string | null; validade: string | null; quantidade: number; produto: LoteProduto | LoteProduto[] | null };
type Dispensacao = { id: string; prescricao_id: string | null; prescricao_componente_id: string | null; item: string; lote: string | null; quantidade_atendida: number | null; quantidade: number; dispensado_em: string | null; status: string };

function one<T>(value: T | T[] | null) { return Array.isArray(value) ? value[0] ?? null : value; }
function when(value: string | null | undefined) { return value ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(value)) : "—"; }

export default async function MedicamentosPage({ searchParams }: { searchParams: Promise<{ sucesso?: string; erro?: string }> }) {
  const sp = await searchParams;
  const { supabase, empresaId, unidadeId } = await getAssistencialContext();

  const [pRes, cRes, produtosRes, lotesRes, dRes] = await Promise.all([
    supabase.from("prescricoes").select("id,item,dose,via,frequencia,quantidade,unidade_dose,requer_validacao_farmaceutica,assinado_em,status,produto_id,atendimento:atendimentos(numero_atendimento,paciente:pacientes(nome_completo,ra,numero_registro)),validacao:validacoes_farmaceuticas(status,intervencao)").eq("empresa_id", empresaId).eq("unidade_id", unidadeId).eq("tipo", "medicamento").eq("status", "ativa").not("assinado_em", "is", null).order("created_at", { ascending: false }).limit(150),
    supabase.from("prescricao_componentes").select("id,prescricao_id,item_assistencial_id,dose,quantidade,unidade_dose,ordem,observacoes,item:itens_assistenciais(descricao,concentracao,apresentacao)").eq("empresa_id", empresaId).eq("unidade_id", unidadeId).order("ordem"),
    supabase.from("estoque_produtos").select("id,item_assistencial_id,descricao,codigo,codigo_barras,unidade_medida").eq("empresa_id", empresaId).eq("ativo", true).not("item_assistencial_id", "is", null).limit(3000),
    supabase.from("estoque_lotes").select("id,produto_id,numero_lote,validade,quantidade,produto:estoque_produtos(codigo,descricao,codigo_barras,unidade_medida)").eq("empresa_id", empresaId).eq("unidade_id", unidadeId).gt("quantidade", 0).order("validade", { ascending: true }).limit(3000),
    supabase.from("dispensacoes_medicamentos").select("id,prescricao_id,prescricao_componente_id,item,lote,quantidade,quantidade_atendida,dispensado_em,status").eq("empresa_id", empresaId).eq("unidade_id", unidadeId).order("dispensado_em", { ascending: false }).limit(100),
  ]);

  const prescricoes = (pRes.data ?? []) as unknown as Prescricao[];
  const componentes = (cRes.data ?? []) as unknown as Componente[];
  const produtos = (produtosRes.data ?? []) as unknown as Produto[];
  const lotes = (lotesRes.data ?? []) as unknown as Lote[];
  const dispensacoes = (dRes.data ?? []) as unknown as Dispensacao[];
  const validacaoPendente = prescricoes.filter((p) => p.requer_validacao_farmaceutica && !["validada", "validada_com_ressalva"].includes(one(p.validacao)?.status ?? "")).length;
  const componentesPendentes = componentes.filter((c) => prescricoes.some((p) => p.id === c.prescricao_id) && !dispensacoes.some((d) => d.prescricao_componente_id === c.id && ["dispensado", "parcial"].includes(d.status))).length;

  return <SectionPage eyebrow="Assistencial / Farmácia" title="Farmácia Clínica e Dispensação" description="Validação farmacêutica, composição da prescrição, separação por lote/validade e devolução. A checagem de administração é exclusiva do módulo da Enfermagem.">
    {sp.sucesso ? <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">Operação concluída: {sp.sucesso}.</div> : null}
    {sp.erro ? <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">Operação bloqueada: {decodeURIComponent(sp.erro)}.</div> : null}

    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <div className="his-kpi"><p className="text-xs font-black uppercase text-slate-400">Prescrições ativas</p><p className="mt-2 text-3xl font-black text-brand-950">{prescricoes.length}</p></div>
      <div className="his-kpi"><p className="text-xs font-black uppercase text-slate-400">Validação pendente</p><p className="mt-2 text-3xl font-black text-violet-700">{validacaoPendente}</p></div>
      <div className="his-kpi"><p className="text-xs font-black uppercase text-slate-400">Componentes a dispensar</p><p className="mt-2 text-3xl font-black text-amber-700">{componentesPendentes}</p></div>
      <div className="his-kpi"><p className="text-xs font-black uppercase text-slate-400">Dispensações recentes</p><p className="mt-2 text-3xl font-black text-emerald-700">{dispensacoes.length}</p></div>
    </section>

    <section className="his-card mt-5 overflow-hidden">
      <div className="border-b border-slate-100 p-5"><div className="flex items-center gap-3"><ShieldCheck className="size-5 text-violet-700"/><div><h2 className="font-black">Prescrições liberadas para a Farmácia</h2><p className="text-sm text-slate-500">Somente prescrições finalizadas pelo médico aparecem aqui.</p></div></div></div>
      <div className="divide-y divide-slate-100">{prescricoes.length ? prescricoes.map((p) => {
        const atendimento = one(p.atendimento); const paciente = one(atendimento?.paciente ?? null); const validacao = one(p.validacao); const comps = componentes.filter((c) => c.prescricao_id === p.id);
        const lotesPrincipal = lotes.filter((l) => l.produto_id === p.produto_id);
        const validada = !p.requer_validacao_farmaceutica || ["validada", "validada_com_ressalva"].includes(validacao?.status ?? "");
        return <article key={p.id} className="p-5"><div className="flex flex-col gap-4 xl:flex-row xl:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="font-black text-slate-900">{p.item}</p><span className="rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-black text-emerald-700">assinada</span></div><p className="mt-1 text-sm text-slate-600">{p.dose ?? "—"} · {p.via ?? "—"} · {p.frequencia ?? "—"}</p><p className="mt-1 text-xs text-slate-500">{paciente?.nome_completo ?? "Paciente"} · RA {paciente?.ra ?? "—"} · Atend. #{atendimento?.numero_atendimento ?? "—"}</p>{p.requer_validacao_farmaceutica ? <p className="mt-2 text-xs font-bold text-violet-700">Farmácia: {validacao?.status ?? "pendente"}</p> : null}</div><div className="w-full xl:max-w-3xl">
          {!validada ? <form action={validarPrescricaoFarmaceuticaAction} className="rounded-xl border border-violet-100 bg-violet-50 p-3"><input type="hidden" name="prescricao_id" value={p.id}/><div className="grid gap-2 sm:grid-cols-3">{[["alergias","Alergias"],["interacoes","Interações"],["dose","Dose"],["via","Via"],["funcao_renal","Função renal"],["duplicidade","Duplicidade"]].map(([name,label]) => <label key={name} className="text-xs font-bold text-violet-900"><input name={name} type="checkbox" className="mr-1.5"/>{label}</label>)}</div><textarea name="intervencao" rows={2} className="ui-input mt-2" placeholder="Intervenção farmacêutica / observações"/><div className="mt-2 flex gap-2"><select name="status" className="ui-input" defaultValue="validada"><option value="validada">Validar</option><option value="validada_com_ressalva">Validar com ressalva</option><option value="intervencao">Solicitar intervenção</option><option value="rejeitada">Rejeitar</option></select><button className="ui-button-primary">Registrar validação</button></div></form> : <div className="space-y-3">
            {p.produto_id ? <form action={dispensarPrescricaoAction} className="flex flex-col gap-2 rounded-xl border border-slate-200 p-3 sm:flex-row"><input type="hidden" name="prescricao_id" value={p.id}/><div className="flex-1"><p className="mb-1 text-xs font-black uppercase text-slate-500">Item principal</p><select name="estoque_lote_id" required defaultValue="" className="ui-input"><option value="">Selecionar lote FEFO</option>{lotesPrincipal.map((l) => { const prod=one(l.produto); return <option key={l.id} value={l.id}>{prod?.descricao ?? "Produto"} · lote {l.numero_lote ?? "s/lote"} · val. {l.validade ?? "—"} · saldo {l.quantidade}</option>; })}</select></div><input name="quantidade" required type="number" step="0.0001" min="0.0001" defaultValue={p.quantidade ?? 1} className="ui-input self-end sm:w-28"/><button className="ui-button-primary self-end whitespace-nowrap"><PackageCheck className="size-4"/>Dispensar</button></form> : null}
            {comps.map((c) => { const item=one(c.item); const produto=produtos.find((prod) => prod.item_assistencial_id === c.item_assistencial_id); const lotesComp=produto ? lotes.filter((l) => l.produto_id === produto.id) : []; const jaDispensado=dispensacoes.some((d) => d.prescricao_componente_id === c.id && ["dispensado","parcial"].includes(d.status)); return <div key={c.id} className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-3"><p className="text-xs font-black uppercase text-emerald-700">Componente {c.ordem}</p><p className="mt-1 font-bold text-slate-900">+ {item?.descricao ?? "Componente"}{c.dose ? ` · ${c.dose}` : ""}</p>{jaDispensado ? <p className="mt-2 text-xs font-black text-emerald-700">Já dispensado</p> : produto ? <form action={dispensarComponentePrescricaoAction} className="mt-2 flex flex-col gap-2 sm:flex-row"><input type="hidden" name="prescricao_componente_id" value={c.id}/><select name="estoque_lote_id" required defaultValue="" className="ui-input flex-1"><option value="">Selecionar lote FEFO de {produto.descricao}</option>{lotesComp.map((l) => <option key={l.id} value={l.id}>Lote {l.numero_lote ?? "s/lote"} · val. {l.validade ?? "—"} · saldo {l.quantidade}</option>)}</select><input name="quantidade" required type="number" step="0.0001" min="0.0001" defaultValue={c.quantidade ?? 1} className="ui-input sm:w-28"/><button className="ui-button-primary whitespace-nowrap"><PackageCheck className="size-4"/>Dispensar componente</button></form> : <p className="mt-2 text-xs font-bold text-amber-700">Componente sem vínculo interno com produto de estoque. Cadastre o vínculo item assistencial → estoque.</p>}</div>; })}
          </div>}
        </div></div></article>;
      }) : <p className="p-8 text-center text-sm text-slate-500">Nenhuma prescrição assinada aguardando Farmácia.</p>}</div>
    </section>

    <section className="his-card mt-5 overflow-hidden"><div className="border-b border-slate-100 p-5"><div className="flex items-center gap-3"><Pill className="size-5 text-brand-700"/><div><h2 className="font-black">Dispensações recentes / devolução</h2><p className="text-sm text-slate-500">Rastreabilidade por prescrição, componente e lote.</p></div></div></div><div className="divide-y divide-slate-100">{dispensacoes.slice(0,50).map((d) => <article key={d.id} className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between"><div><p className="font-bold">{d.item}</p><p className="text-xs text-slate-500">Lote {d.lote ?? "—"} · {when(d.dispensado_em)} · quantidade {d.quantidade_atendida ?? d.quantidade}{d.prescricao_componente_id ? " · componente da solução" : ""}</p></div>{["dispensado","parcial"].includes(d.status) ? <form action={devolverMedicamentoAction} className="flex flex-col gap-2 sm:flex-row"><input type="hidden" name="dispensacao_id" value={d.id}/><input name="quantidade" type="number" step="0.0001" min="0.0001" required className="ui-input sm:w-28" placeholder="Qtd."/><input name="motivo" required className="ui-input" placeholder="Motivo da devolução"/><button className="btn-secondary whitespace-nowrap"><Undo2 className="size-4"/>Devolver</button></form> : null}</article>)}</div></section>
  </SectionPage>;
}
