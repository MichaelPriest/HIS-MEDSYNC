import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  Boxes,
  CheckCircle2,
  ClipboardCheck,
  Scissors,
  ShieldCheck,
  Stethoscope,
} from "lucide-react";
import { SurgerySchedulingForm } from "@/components/centro-cirurgico/surgery-scheduling-form";
import { SectionPage } from "@/components/painel/section-page";
import { getAssistencialContext } from "@/modules/assistencial/context";
import {
  agendarCirurgia,
  registrarOpme,
  salvarAnestesia,
  salvarChecklistCirurgico,
  salvarRpa,
  transicionarCirurgia,
  vincularCicloCme,
} from "@/modules/centro-cirurgico/actions";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Rel<T> = T | T[] | null;
type Paciente = { nome_completo: string | null; cpf: string | null; ra: string | null; numero_registro: string | number | null };
type Atendimento = {
  id: string;
  numero_atendimento: string | number | null;
  data_abertura: string | null;
  cobertura: string | null;
  paciente: Rel<Paciente>;
  convenio: Rel<{ nome_fantasia: string | null }>;
};
type Sala = { sala_id: string; codigo: string; nome: string; status: string | null; equipamentos_prontos: boolean; equipamentos_obrigatorios_indisponiveis: number };
type Cirurgia = {
  id: string;
  atendimento_id: string;
  paciente_id: string;
  procedimento: string;
  codigo_tuss: string | null;
  codigo_contratado: string | null;
  tabela_referencia: string | null;
  contrato_id: string | null;
  tabela_item_id: string | null;
  cirurgia: string | null;
  lateralidade: string | null;
  sala: string | null;
  sala_id: string | null;
  classificacao: string | null;
  porte: string | null;
  porte_anestesico: string | null;
  status: string;
  inicio_previsto: string | null;
  inicio_em: string | null;
  fim_em: string | null;
  cirurgiao_id: string | null;
  anestesista_id: string | null;
  diagnostico_pre: string | null;
  intercorrencias: string | null;
  paciente: Rel<{ nome_completo: string | null; ra: string | null }>;
};
type Checklist = { cirurgia_id: string; etapa: string; itens: Record<string, unknown> | null; concluido: boolean; concluido_em: string | null; observacoes: string | null };
type Anestesia = { cirurgia_id: string; tecnica: string | null; asa: string | null; via_aerea: string | null; inicio_em: string | null; fim_em: string | null; observacoes: string | null };
type Rpa = { cirurgia_id: string; aldrete_entrada: number | null; aldrete_alta: number | null; dor: number | null; nauseas: boolean; destino: string | null; status: string; alta_em: string | null };
type Opme = { id: string; cirurgia_id: string; item: string; codigo: string | null; lote: string | null; serie: string | null; quantidade: number; status: string };
type CmeCiclo = { id: string; codigo_ciclo: string; equipamento: string | null; metodo: string | null; resultado: string | null; status: string; liberado_em: string | null };
type CmeVinculo = { cirurgia_id: string; ciclo_id: string };
type Params = { sucesso?: string; erro?: string; cirurgia?: string };

const one = <T,>(value: Rel<T>): T | null => Array.isArray(value) ? value[0] ?? null : value;
const fmt = (value?: string | null) => value ? new Date(value).toLocaleString("pt-BR") : "—";
const statusLabel = (value: string) => ({ agendada: "Agendada", em_preparo: "Em preparo", em_andamento: "Em cirurgia", recuperacao: "Recuperação", concluida: "Concluída", cancelada: "Cancelada" }[value] ?? value.replaceAll("_", " "));
const etapaLabel = (value: string) => ({ entrada: "Entrada / Sign in", pausa: "Pausa / Time out", saida: "Saída / Sign out" }[value] ?? value);
const checklistConfig = {
  entrada: [["identidade", "Identidade confirmada"], ["procedimento", "Procedimento confirmado"], ["lateralidade", "Lateralidade / sítio confirmados"], ["consentimento", "Consentimento confirmado"], ["jejum", "Jejum confirmado"], ["alergias", "Alergias verificadas"]],
  pausa: [["equipe", "Equipe se apresentou"], ["procedimento_confirmado", "Procedimento reconfirmado"], ["antibiotico", "Antibioticoprofilaxia verificada"], ["equipamentos", "Equipamentos verificados"], ["esterilidade", "Esterilidade confirmada"]],
  saida: [["contagem", "Contagem de compressas/instrumentais"], ["amostras", "Amostras identificadas"], ["opme", "OPME conferida"], ["intercorrencias", "Intercorrências registradas"], ["destino", "Destino pós-operatório definido"]],
} as const;

function nextStatuses(status: string) {
  if (status === "agendada") return ["em_preparo"];
  if (status === "em_preparo") return ["agendada", "em_andamento"];
  if (status === "em_andamento") return ["recuperacao"];
  if (status === "recuperacao") return ["concluida"];
  return [];
}

export default async function CentroCirurgicoPage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const { supabase, empresaId, unidadeId } = await getAssistencialContext();

  const [atendimentosReq, salasReq, cirurgiasReq, checklistsReq, anestesiaReq, rpaReq, opmeReq, ciclosReq, vinculosReq] = await Promise.all([
    supabase.from("atendimentos").select("id,numero_atendimento,data_abertura,cobertura,paciente:pacientes(nome_completo,cpf,ra,numero_registro),convenio:convenios(nome_fantasia)").eq("empresa_id", empresaId).eq("unidade_id", unidadeId).in("status", ["aberto", "em_espera", "em_atendimento"]).order("data_abertura", { ascending: false }).limit(300),
    supabase.from("vw_salas_cirurgicas_prontidao").select("sala_id,codigo,nome,status,equipamentos_prontos,equipamentos_obrigatorios_indisponiveis").eq("empresa_id", empresaId).eq("unidade_id", unidadeId).order("nome"),
    supabase.from("cirurgias").select("id,atendimento_id,paciente_id,procedimento,codigo_tuss,codigo_contratado,tabela_referencia,contrato_id,tabela_item_id,cirurgia,lateralidade,sala,sala_id,classificacao,porte,porte_anestesico,status,inicio_previsto,inicio_em,fim_em,cirurgiao_id,anestesista_id,diagnostico_pre,intercorrencias,paciente:pacientes(nome_completo,ra)").eq("empresa_id", empresaId).eq("unidade_id", unidadeId).order("inicio_previsto", { ascending: true, nullsFirst: false }).limit(150),
    supabase.from("cirurgia_checklist").select("cirurgia_id,etapa,itens,concluido,concluido_em,observacoes").eq("empresa_id", empresaId).eq("unidade_id", unidadeId).order("created_at", { ascending: false }).limit(1000),
    supabase.from("anestesia_registros").select("cirurgia_id,tecnica,asa,via_aerea,inicio_em,fim_em,observacoes").eq("empresa_id", empresaId).eq("unidade_id", unidadeId).order("created_at", { ascending: false }).limit(300),
    supabase.from("rpa_registros").select("cirurgia_id,aldrete_entrada,aldrete_alta,dor,nauseas,destino,status,alta_em").eq("empresa_id", empresaId).eq("unidade_id", unidadeId).order("created_at", { ascending: false }).limit(300),
    supabase.from("cirurgia_opme").select("id,cirurgia_id,item,codigo,lote,serie,quantidade,status").eq("empresa_id", empresaId).eq("unidade_id", unidadeId).order("created_at", { ascending: false }).limit(1000),
    supabase.from("cme_ciclos").select("id,codigo_ciclo,equipamento,metodo,resultado,status,liberado_em").eq("empresa_id", empresaId).eq("unidade_id", unidadeId).eq("status", "liberado").order("liberado_em", { ascending: false }).limit(300),
    supabase.from("cirurgia_cme_ciclos").select("cirurgia_id,ciclo_id").eq("empresa_id", empresaId).eq("unidade_id", unidadeId).limit(1000),
  ]);

  const atendimentos = (atendimentosReq.data ?? []) as unknown as Atendimento[];
  const salas = (salasReq.data ?? []) as Sala[];
  const cirurgias = (cirurgiasReq.data ?? []) as unknown as Cirurgia[];
  const checklists = (checklistsReq.data ?? []) as Checklist[];
  const anestesias = (anestesiaReq.data ?? []) as Anestesia[];
  const rpas = (rpaReq.data ?? []) as Rpa[];
  const opmes = (opmeReq.data ?? []) as Opme[];
  const ciclos = (ciclosReq.data ?? []) as CmeCiclo[];
  const vinculos = (vinculosReq.data ?? []) as CmeVinculo[];

  const professionalIds = [...new Set(cirurgias.flatMap((item) => [item.cirurgiao_id, item.anestesista_id]).filter((id): id is string => Boolean(id)))];
  const profissionaisReq = professionalIds.length
    ? await supabase.from("profissionais").select("id,nome_completo").eq("empresa_id", empresaId).in("id", professionalIds)
    : { data: [] as { id: string; nome_completo: string }[] };
  const profissionalNome = new Map((profissionaisReq.data ?? []).map((item) => [item.id, item.nome_completo]));

  const encounters = atendimentos.map((item) => {
    const paciente = one(item.paciente);
    const convenio = one(item.convenio);
    return {
      id: item.id,
      numero_atendimento: item.numero_atendimento,
      data_abertura: item.data_abertura,
      cobertura: item.cobertura,
      convenio_nome: convenio?.nome_fantasia ?? null,
      paciente: {
        nome_completo: paciente?.nome_completo ?? "Paciente",
        cpf: paciente?.cpf ?? null,
        ra: paciente?.ra ?? null,
        numero_registro: paciente?.numero_registro ?? null,
      },
    };
  });

  const checklistBySurgery = new Map<string, Map<string, Checklist>>();
  for (const item of checklists) {
    const map = checklistBySurgery.get(item.cirurgia_id) ?? new Map<string, Checklist>();
    if (!map.has(item.etapa)) map.set(item.etapa, item);
    checklistBySurgery.set(item.cirurgia_id, map);
  }
  const anestesiaBySurgery = new Map<string, Anestesia>();
  for (const item of anestesias) if (!anestesiaBySurgery.has(item.cirurgia_id)) anestesiaBySurgery.set(item.cirurgia_id, item);
  const rpaBySurgery = new Map<string, Rpa>();
  for (const item of rpas) if (!rpaBySurgery.has(item.cirurgia_id)) rpaBySurgery.set(item.cirurgia_id, item);
  const opmeBySurgery = new Map<string, Opme[]>();
  for (const item of opmes) opmeBySurgery.set(item.cirurgia_id, [...(opmeBySurgery.get(item.cirurgia_id) ?? []), item]);
  const vinculosBySurgery = new Map<string, Set<string>>();
  for (const item of vinculos) vinculosBySurgery.set(item.cirurgia_id, new Set([...(vinculosBySurgery.get(item.cirurgia_id) ?? []), item.ciclo_id]));

  const ativas = cirurgias.filter((item) => !["concluida", "cancelada"].includes(item.status));
  const emSala = cirurgias.filter((item) => item.status === "em_andamento").length;
  const recuperacao = cirurgias.filter((item) => item.status === "recuperacao").length;
  const salasPendentes = salas.filter((item) => !item.equipamentos_prontos).length;

  return (
    <SectionPage
      eyebrow="Assistencial / Bloco Cirúrgico"
      title="Centro Cirúrgico"
      description="Agenda, cirurgia segura, anestesia, OPME, CME, recuperação pós-anestésica e fechamento assistencial/faturamento em um único fluxo transacional."
      actions={<div className="flex flex-wrap gap-2"><Link href="/assistencial/centro-cirurgico/equipamentos" className="ui-button-secondary"><ShieldCheck className="size-4" />Prontidão das salas</Link><Link href="/assistencial/centro-cirurgico/cme" className="ui-button-primary"><Boxes className="size-4" />Abrir CME</Link></div>}
    >
      {params.sucesso ? <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700"><CheckCircle2 className="mr-2 inline size-4" />Operação cirúrgica registrada com sucesso.</div> : null}
      {params.erro ? <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700"><AlertTriangle className="mr-2 inline size-4" />{decodeURIComponent(params.erro)}</div> : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Kpi label="Cirurgias ativas" value={ativas.length} icon={<Scissors className="size-5 text-brand-600" />} />
        <Kpi label="Em cirurgia" value={emSala} icon={<Activity className="size-5 text-rose-600" />} />
        <Kpi label="Em recuperação" value={recuperacao} icon={<Stethoscope className="size-5 text-violet-600" />} />
        <Kpi label="Salas prontas" value={salas.length - salasPendentes} icon={<ShieldCheck className="size-5 text-emerald-600" />} />
        <Kpi label="Salas com pendência" value={salasPendentes} icon={<AlertTriangle className="size-5 text-amber-600" />} />
      </section>

      <section className="mt-5 his-card p-5">
        <div className="mb-4 border-b border-slate-100 pb-4">
          <h2 className="font-black text-slate-950">Agendar cirurgia</h2>
          <p className="mt-1 text-sm text-slate-500">Em convênio, procedimento, código e porte são resolvidos pelo contrato vigente. Cirurgião e anestesista podem ser localizados por nome, CPF, conselho, número, especialidade ou CBO.</p>
        </div>
        <SurgerySchedulingForm action={agendarCirurgia} empresaId={empresaId} encounters={encounters} salas={salas} />
      </section>

      <section className="mt-5 space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div><h2 className="text-lg font-black text-slate-950">Mapa operacional das cirurgias</h2><p className="mt-1 text-sm text-slate-500">As transições ficam bloqueadas no banco enquanto requisitos de segurança não forem atendidos.</p></div>
          <span className="rounded-xl bg-slate-50 px-3 py-2 text-xs font-bold text-slate-500">{cirurgias.length} registro(s)</span>
        </div>
        {cirurgias.map((cirurgia) => {
          const paciente = one(cirurgia.paciente);
          const checklist = checklistBySurgery.get(cirurgia.id) ?? new Map<string, Checklist>();
          const anestesia = anestesiaBySurgery.get(cirurgia.id);
          const rpa = rpaBySurgery.get(cirurgia.id);
          const opmeItems = opmeBySurgery.get(cirurgia.id) ?? [];
          const cmeLinks = vinculosBySurgery.get(cirurgia.id) ?? new Set<string>();
          const sala = salas.find((item) => item.sala_id === cirurgia.sala_id || item.codigo.toLowerCase() === String(cirurgia.sala ?? "").toLowerCase());
          const next = nextStatuses(cirurgia.status);
          return (
            <article key={cirurgia.id} id={`cirurgia-${cirurgia.id}`} className={`his-card overflow-hidden ${params.cirurgia === cirurgia.id ? "ring-2 ring-brand-300" : ""}`}>
              <div className="border-b border-slate-100 p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2"><StatusBadge status={cirurgia.status} />{sala ? <span className={`rounded-full px-2.5 py-1 text-xs font-black ${sala.equipamentos_prontos ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>{sala.equipamentos_prontos ? "Sala pronta" : `${sala.equipamentos_obrigatorios_indisponiveis} equipamento(s) pendente(s)`}</span> : null}{cirurgia.contrato_id ? <span className="rounded-full bg-sky-50 px-2.5 py-1 text-xs font-black text-sky-700">Contrato validado</span> : null}</div>
                    <h3 className="mt-3 text-lg font-black text-slate-950">{paciente?.nome_completo ?? "Paciente"}</h3>
                    <p className="mt-1 text-sm font-semibold text-slate-700">{cirurgia.procedimento}{cirurgia.codigo_tuss ? ` · TUSS ${cirurgia.codigo_tuss}` : cirurgia.codigo_contratado ? ` · Cód. ${cirurgia.codigo_contratado}` : ""}</p>
                    <p className="mt-1 text-xs text-slate-500">RA {paciente?.ra ?? "—"} · Sala {cirurgia.sala ?? "—"} · Previsto {fmt(cirurgia.inicio_previsto)}</p>
                    <p className="mt-1 text-xs text-slate-500">Porte {cirurgia.porte ?? "—"} · Porte anestésico {cirurgia.porte_anestesico ?? "—"}{cirurgia.tabela_referencia ? ` · ${cirurgia.tabela_referencia}` : ""}</p>
                    <p className="mt-1 text-xs text-slate-500">Cirurgião: {cirurgia.cirurgiao_id ? profissionalNome.get(cirurgia.cirurgiao_id) ?? "—" : "A definir"} · Anestesista: {cirurgia.anestesista_id ? profissionalNome.get(cirurgia.anestesista_id) ?? "—" : "Não informado"}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {next.map((status) => <form action={transicionarCirurgia} key={status}><input type="hidden" name="cirurgia_id" value={cirurgia.id} /><input type="hidden" name="novo_status" value={status} /><button className="ui-button-primary">{status === "em_preparo" ? "Iniciar preparo" : status === "em_andamento" ? "Iniciar cirurgia" : status === "recuperacao" ? "Enviar à recuperação" : status === "concluida" ? "Concluir cirurgia" : "Voltar para agendada"}</button></form>)}
                  </div>
                </div>
              </div>

              <div className="grid gap-3 p-5 xl:grid-cols-2">
                <details className="rounded-xl border border-slate-200 p-4" open={cirurgia.status === "em_preparo" || cirurgia.status === "em_andamento"}>
                  <summary className="cursor-pointer font-black text-slate-900"><ClipboardCheck className="mr-2 inline size-4" />Cirurgia segura / checklists</summary>
                  <div className="mt-4 space-y-4">{(["entrada", "pausa", "saida"] as const).map((etapa) => { const atual = checklist.get(etapa); return <form action={salvarChecklistCirurgico} key={etapa} className="rounded-xl bg-slate-50 p-4"><input type="hidden" name="cirurgia_id" value={cirurgia.id} /><input type="hidden" name="etapa" value={etapa} /><div className="mb-3 flex items-center justify-between gap-2"><b>{etapaLabel(etapa)}</b>{atual?.concluido ? <span className="text-xs font-black text-emerald-700">Concluído {fmt(atual.concluido_em)}</span> : <span className="text-xs font-bold text-amber-700">Pendente</span>}</div><div className="grid gap-2 sm:grid-cols-2">{checklistConfig[etapa].map(([key, label]) => <label key={key} className="flex items-start gap-2 text-sm text-slate-700"><input type="checkbox" name={key} defaultChecked={Boolean(atual?.itens?.[key])} className="mt-0.5 size-4" />{label}</label>)}</div><input name="observacoes" defaultValue={atual?.observacoes ?? ""} className="ui-input mt-3" placeholder="Observações da etapa" /><label className="mt-3 flex items-center gap-2 text-sm font-bold text-slate-700"><input type="checkbox" name="concluido" defaultChecked={atual?.concluido ?? false} />Marcar etapa como concluída</label><button className="ui-button-secondary mt-3">Salvar checklist</button></form>})}</div>
                </details>

                <details className="rounded-xl border border-slate-200 p-4" open={cirurgia.status === "em_andamento"}>
                  <summary className="cursor-pointer font-black text-slate-900"><Stethoscope className="mr-2 inline size-4" />Anestesia</summary>
                  <form action={salvarAnestesia} className="mt-4 grid gap-3 sm:grid-cols-2"><input type="hidden" name="cirurgia_id" value={cirurgia.id} /><input name="tecnica" defaultValue={anestesia?.tecnica ?? ""} className="ui-input" placeholder="Técnica anestésica" /><input name="asa" defaultValue={anestesia?.asa ?? ""} className="ui-input" placeholder="ASA" /><input name="via_aerea" defaultValue={anestesia?.via_aerea ?? ""} className="ui-input" placeholder="Via aérea" /><div className="rounded-xl border border-slate-100 p-3 text-sm"><b className="block mb-2">Monitorização</b>{[["monitor_ecg","ECG"],["monitor_spo2","SpO₂"],["monitor_pressao","PA"],["monitor_capnografia","Capnografia"],["monitor_temperatura","Temperatura"]].map(([key,label]) => <label key={key} className="mr-3 inline-flex items-center gap-1.5"><input type="checkbox" name={key} />{label}</label>)}</div><textarea name="medicamentos" className="ui-input min-h-24" placeholder="Medicamentos — um por linha" /><textarea name="fluidos" className="ui-input min-h-24" placeholder="Fluidos — um por linha" /><textarea name="eventos" className="ui-input min-h-24" placeholder="Eventos/intercorrências — um por linha" /><textarea name="observacoes" defaultValue={anestesia?.observacoes ?? ""} className="ui-input min-h-24" placeholder="Observações" /><div className="sm:col-span-2 flex flex-wrap items-center gap-3"><label className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" name="iniciar" />Registrar início</label><label className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" name="finalizar" />Finalizar anestesia</label><button className="ui-button-secondary">Salvar anestesia</button>{anestesia ? <span className="text-xs text-slate-500">Início {fmt(anestesia.inicio_em)} · fim {fmt(anestesia.fim_em)}</span> : null}</div></form>
                </details>

                <details className="rounded-xl border border-slate-200 p-4">
                  <summary className="cursor-pointer font-black text-slate-900"><Boxes className="mr-2 inline size-4" />OPME e rastreabilidade</summary>
                  <div className="mt-4 space-y-2">{opmeItems.map((item) => <div key={item.id} className="rounded-xl bg-slate-50 px-3 py-2 text-sm"><b>{item.item}</b><span className="ml-2 text-xs font-black text-brand-700">{item.status}</span><p className="text-xs text-slate-500">Qtd. {item.quantidade} · código {item.codigo ?? "—"} · lote {item.lote ?? "—"} · série {item.serie ?? "—"}</p></div>)}{!opmeItems.length ? <p className="text-sm text-slate-500">Nenhum OPME registrado.</p> : null}</div>
                  <form action={registrarOpme} className="mt-4 grid gap-3 sm:grid-cols-3"><input type="hidden" name="cirurgia_id" value={cirurgia.id} /><input name="item" required className="ui-input sm:col-span-2" placeholder="Item OPME *" /><input name="codigo" className="ui-input" placeholder="Código" /><input name="fabricante" className="ui-input" placeholder="Fabricante" /><input name="lote" className="ui-input" placeholder="Lote" /><input name="serie" className="ui-input" placeholder="Série" /><input name="registro_anvisa" className="ui-input" placeholder="Registro ANVISA" /><input name="quantidade" type="number" min="0.01" step="0.01" defaultValue="1" className="ui-input" /><select name="status" defaultValue="previsto" className="ui-input"><option value="previsto">Previsto</option><option value="utilizado">Utilizado</option><option value="nao_utilizado">Não utilizado</option><option value="cancelado">Cancelado</option></select><input name="observacoes" className="ui-input sm:col-span-2" placeholder="Observações" /><button className="ui-button-secondary">Registrar OPME</button></form>
                  <form action={vincularCicloCme} className="mt-4 grid gap-3 sm:grid-cols-3"><input type="hidden" name="cirurgia_id" value={cirurgia.id} /><select name="ciclo_id" required defaultValue="" className="ui-input sm:col-span-2"><option value="">Vincular ciclo CME liberado</option>{ciclos.filter((item) => !cmeLinks.has(item.id)).map((item) => <option key={item.id} value={item.id}>{item.codigo_ciclo} · {item.metodo ?? "método não informado"} · {fmt(item.liberado_em)}</option>)}</select><button className="ui-button-secondary">Vincular ciclo</button></form>
                </details>

                <details className="rounded-xl border border-slate-200 p-4" open={cirurgia.status === "recuperacao"}>
                  <summary className="cursor-pointer font-black text-slate-900"><Activity className="mr-2 inline size-4" />RPA / Recuperação pós-anestésica</summary>
                  <form action={salvarRpa} className="mt-4 grid gap-3 sm:grid-cols-4"><input type="hidden" name="cirurgia_id" value={cirurgia.id} /><input name="aldrete_entrada" type="number" step="0.1" defaultValue={rpa?.aldrete_entrada ?? ""} className="ui-input" placeholder="Aldrete entrada" /><input name="aldrete_alta" type="number" step="0.1" defaultValue={rpa?.aldrete_alta ?? ""} className="ui-input" placeholder="Aldrete alta" /><input name="dor" type="number" min="0" max="10" step="0.1" defaultValue={rpa?.dor ?? ""} className="ui-input" placeholder="Dor 0–10" /><input name="pa" className="ui-input" placeholder="PA" /><input name="fc" type="number" className="ui-input" placeholder="FC" /><input name="spo2" type="number" step="0.1" className="ui-input" placeholder="SpO₂" /><input name="temperatura" type="number" step="0.1" className="ui-input" placeholder="Temperatura" /><input name="destino" defaultValue={rpa?.destino ?? ""} className="ui-input" placeholder="Destino" /><textarea name="intercorrencias" className="ui-input min-h-20 sm:col-span-3" placeholder="Intercorrências" /><div className="flex flex-wrap items-center gap-3 sm:col-span-4"><label className="flex items-center gap-2 text-sm"><input type="checkbox" name="nauseas" defaultChecked={rpa?.nauseas ?? false} />Náuseas</label><label className="flex items-center gap-2 text-sm font-black"><input type="checkbox" name="alta" defaultChecked={rpa?.status === "alta"} />Registrar alta da RPA</label><button className="ui-button-secondary">Salvar RPA</button>{rpa ? <span className="text-xs text-slate-500">Status {rpa.status} · alta {fmt(rpa.alta_em)}</span> : null}</div></form>
                </details>
              </div>

              {!["concluida", "cancelada"].includes(cirurgia.status) ? <div className="border-t border-slate-100 bg-rose-50/40 px-5 py-4"><form action={transicionarCirurgia} className="flex flex-wrap items-center gap-3"><input type="hidden" name="cirurgia_id" value={cirurgia.id} /><input type="hidden" name="novo_status" value="cancelada" /><input name="observacoes" required className="ui-input min-w-64 flex-1" placeholder="Motivo obrigatório para cancelamento" /><button className="rounded-xl border border-rose-200 bg-white px-4 py-2 text-sm font-black text-rose-700 hover:bg-rose-50">Cancelar cirurgia</button></form></div> : null}
            </article>
          );
        })}
        {!cirurgias.length ? <div className="his-card p-10 text-center"><Scissors className="mx-auto size-8 text-slate-300" /><p className="mt-3 font-black text-slate-700">Nenhuma cirurgia registrada nesta unidade.</p><p className="mt-1 text-sm text-slate-500">Use o formulário acima para iniciar a agenda cirúrgica operacional.</p></div> : null}
      </section>
    </SectionPage>
  );
}

function Kpi({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return <div className="his-kpi"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-wide text-slate-400">{label}</p><p className="mt-2 text-3xl font-black text-slate-950">{value}</p></div>{icon}</div></div>;
}

function StatusBadge({ status }: { status: string }) {
  const classes = status === "concluida" ? "bg-emerald-50 text-emerald-700" : status === "cancelada" ? "bg-rose-50 text-rose-700" : status === "em_andamento" ? "bg-rose-50 text-rose-700" : status === "recuperacao" ? "bg-violet-50 text-violet-700" : status === "em_preparo" ? "bg-amber-50 text-amber-700" : "bg-brand-50 text-brand-700";
  return <span className={`rounded-full px-3 py-1 text-xs font-black ${classes}`}>{statusLabel(status)}</span>;
}
