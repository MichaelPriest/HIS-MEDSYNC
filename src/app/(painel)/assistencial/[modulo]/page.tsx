import Link from "next/link";
import type { Route } from "next";
import { Activity, ArrowLeft, Baby, BedDouble, ClipboardCheck, Droplets, FlaskConical, HeartPulse, Pill, Salad, ScanLine, Scissors, ShieldAlert, ShieldCheck, Stethoscope, Syringe, Truck, Wind } from "lucide-react";
import { notFound } from "next/navigation";
import { SectionPage } from "@/components/painel/section-page";
import { EncounterPicker } from "@/components/atendimentos/encounter-picker";
import { createClient } from "@/lib/supabase/server";
import { registrarEspecializado } from "@/modules/assistencial/especializados-actions";

type Field = { name: string; label: string; type?: string; placeholder?: string; required?: boolean; step?: string; min?: number; max?: number; textarea?: boolean; defaultValue?: string; full?: boolean };
type RecentField = readonly [string, string];

export const dynamic = "force-dynamic";
export const revalidate = 0;

const modules = {
  sae: { title:"SAE de Enfermagem", description:"Avaliação, diagnósticos, cuidados, sinais vitais, balanço hídrico, dispositivos, feridas e curativos.", Icon:Activity, tables:["sae_avaliacoes","sae_diagnosticos","sae_cuidados","sae_checagens","sinais_vitais","balancos_hidricos","dispositivos_invasivos","lesoes_pele","curativos"], operationHref:"/setores/enfermagem" },
  medicamentos: { title:"Medicamentos / Farmácia Clínica", description:"Conciliação, validação, dispensação por lote, devolução e administração segura.", Icon:Pill, tables:["prescricoes","validacoes_farmaceuticas","dispensacoes_medicamentos","devolucoes_medicamentos","administracoes_medicamentos","conciliacoes_medicamentosas"], operationHref:"/prescricao" },
  laboratorio: { title:"Laboratório Clínico", description:"Amostra, cadeia de custódia, resultado, referência, críticos, liberação e assinatura.", Icon:FlaskConical, tables:["laboratorio_amostras","laboratorio_resultados","laboratorio_resultados_historico"], operationHref:"/setores/laboratorio" },
  imagem: { title:"Diagnóstico por Imagem", description:"Execução, PACS/DICOM, laudo, assinatura, liberação e histórico.", Icon:ScanLine, tables:["imagem_execucoes","imagem_laudos","imagem_laudos_historico"], operationHref:"/setores/imagem" },
  internacao: { title:"Internação e Leitos", description:"Mapa, ocupação, transferências, diárias, isolamento, higienização e alta.", Icon:BedDouble, tables:["leitos","internacoes","movimentacoes_leitos","internacao_diarias","internacao_isolamentos"], operationHref:"/internacao" },
  urgencia: { title:"Urgência / Emergência", description:"ABCDE, classificação, protocolos, procedimentos, reavaliações e destino.", Icon:HeartPulse, tables:["emergencia_registros","emergencia_reavaliacoes","triagens"], operationHref:"/triagem" },
  "centro-cirurgico": { title:"Centro Cirúrgico / CME", description:"Cirurgia segura, anestesia, RPA, OPME e esterilização rastreável.", Icon:Scissors, tables:["cirurgias","cirurgia_checklist","anestesia_registros","rpa_registros","cirurgia_opme","cme_ciclos"], operationHref:"/internacao" },
  nutricao: { title:"Nutrição Clínica", description:"Triagem, avaliação, necessidades, dietas e aceitação.", Icon:Salad, tables:["nutricao_avaliacoes","nutricao_dietas","nutricao_aceitacoes"], operationHref:"/internacao" },
  hemoterapia: { title:"Hemoterapia", description:"Solicitação, bolsas, compatibilidade, transfusão e hemovigilância.", Icon:Droplets, tables:["hemoterapia_solicitacoes","hemoterapia_bolsas","hemoterapia_compatibilidades","hemoterapia_transfusoes","transfusao_monitoracoes","hemoterapia_reacoes"], operationHref:"/internacao" },
  ccih: { title:"CCIH", description:"Infecções, multirresistência, precauções e vigilância.", Icon:ShieldAlert, tables:["ccih_eventos"], operationHref:"/assistencial" },
  antimicrobianos: { title:"Antimicrobianos", description:"Stewardship, culturas, ajuste renal, restritos e reavaliação.", Icon:Syringe, tables:["antimicrobianos_controle"], operationHref:"/assistencial" },
  uti: { title:"UTI / Ventilação", description:"Parâmetros ventilatórios, gasometria, desmame e monitorização intensiva.", Icon:Wind, tables:["ventilacao_mecanica","sinais_vitais","balancos_hidricos"], operationHref:"/internacao" },
  multiprofissional: { title:"Multiprofissional", description:"Fisioterapia, fono, psicologia, TO, serviço social e demais áreas.", Icon:Stethoscope, tables:["evolucoes_multiprofissionais","procedimentos_assistenciais"], operationHref:"/prontuario" },
  procedimentos: { title:"Procedimentos Assistenciais", description:"Execução estruturada, TUSS, quantidade, resultado e assinatura.", Icon:ClipboardCheck, tables:["procedimentos_assistenciais"], operationHref:"/prontuario" },
  transportes: { title:"Transportes", description:"Transporte interno, externo e inter-hospitalar com requisitos clínicos.", Icon:Truck, tables:["transportes_pacientes"], operationHref:"/assistencial" },
  alta: { title:"Transição / Alta", description:"Planejamento multiprofissional, conciliação e sumário de alta assinado.", Icon:ClipboardCheck, tables:["planejamentos_alta","sumarios_alta","conciliacoes_medicamentosas"], operationHref:"/internacao" },
  "seguranca-paciente": { title:"Segurança do Paciente", description:"Near miss, incidentes, dano, ação imediata e análise institucional.", Icon:ShieldAlert, tables:["eventos_seguranca_paciente"], operationHref:"/assistencial" },
  obstetricia: { title:"Obstetrícia / Parto", description:"Acompanhamento gestacional, trabalho de parto e parto.", Icon:Baby, tables:["obstetricia_registros","partos"], operationHref:"/assistencial" },
  neonatal: { title:"Neonatal", description:"Apgar, reanimação, profilaxias, aleitamento e destino do RN.", Icon:Baby, tables:["neonatal_registros"], operationHref:"/assistencial" },
  obitos: { title:"Óbitos", description:"Constatação, causas, documentação, comunicação familiar e liberação do corpo.", Icon:ShieldCheck, tables:["obitos"], operationHref:"/assistencial" },

  dialise: { title:"Hemodiálise", description:"Prescrição dialítica, acesso vascular, máquina, sessão, ultrafiltração, Kt/V e monitorização.", Icon:Droplets, tables:["dialise_sessoes","dialise_prescricoes","dialise_monitoracoes","dialise_acessos","dialise_maquinas"], fields:[
    {name:"peso_pre_kg",label:"Peso pré-diálise (kg)",type:"number",step:"0.01"},{name:"inicio_em",label:"Início previsto",type:"datetime-local"},{name:"intercorrencias",label:"Observações / intercorrências previstas",textarea:true,full:true}
  ], recentFields:[["status","Status"],["peso_pre_kg","Peso pré"],["inicio_em","Início"]] },
  oncologia: { title:"Oncologia / Quimioterapia", description:"Plano oncológico, protocolo, ciclos, quimioterápicos, dose, dupla checagem e administração.", Icon:Stethoscope, tables:["oncologia_planos","oncologia_ciclos","oncologia_quimioterapia_itens","oncologia_administracoes"], fields:[
    {name:"diagnostico",label:"Diagnóstico oncológico",required:true,full:true},{name:"cid10",label:"CID-10"},{name:"estadiamento",label:"Estadiamento"},{name:"intencao",label:"Intenção terapêutica",placeholder:"curativa, paliativa, adjuvante..."},{name:"protocolo",label:"Protocolo"},{name:"linha_tratamento",label:"Linha de tratamento"},{name:"inicio_previsto",label:"Início previsto",type:"date"},{name:"observacoes",label:"Observações",textarea:true,full:true}
  ], recentFields:[["status","Status"],["diagnostico","Diagnóstico"],["protocolo","Protocolo"],["inicio_previsto","Início"]] },
  radioterapia: { title:"Radioterapia", description:"Planejamento, sítio-alvo, técnica, dose total, frações, equipamento e execução seriada.", Icon:ScanLine, tables:["radioterapia_planos","radioterapia_fracoes"], fields:[
    {name:"diagnostico",label:"Diagnóstico"},{name:"cid10",label:"CID-10"},{name:"sitio_alvo",label:"Sítio-alvo",required:true},{name:"tecnica",label:"Técnica"},{name:"equipamento",label:"Equipamento"},{name:"dose_total_gy",label:"Dose total (Gy)",type:"number",step:"0.001"},{name:"numero_fracoes",label:"Número de frações",type:"number",step:"1"},{name:"dose_fracao_gy",label:"Dose/fração (Gy)",type:"number",step:"0.001"},{name:"inicio_previsto",label:"Início previsto",type:"date"},{name:"observacoes",label:"Observações",textarea:true,full:true}
  ], recentFields:[["status","Status"],["sitio_alvo","Sítio-alvo"],["dose_total_gy","Dose total"],["numero_fracoes","Frações"]] },
  hemodinamica: { title:"Hemodinâmica", description:"Cateterismo, angiografia, intervenção, contraste, radiação, materiais implantados e laudo.", Icon:HeartPulse, tables:["hemodinamica_procedimentos"], fields:[
    {name:"procedimento",label:"Procedimento",required:true,full:true},{name:"codigo_tuss",label:"Código TUSS"},{name:"acesso_vascular",label:"Acesso vascular"},{name:"contraste",label:"Contraste"},{name:"volume_contraste_ml",label:"Volume de contraste (mL)",type:"number",step:"0.01"},{name:"dose_radiacao",label:"Dose de radiação"},{name:"indicacao",label:"Indicação",textarea:true,full:true}
  ], recentFields:[["status","Status"],["procedimento","Procedimento"],["codigo_tuss","TUSS"],["acesso_vascular","Acesso"]] },
  endoscopia: { title:"Endoscopia", description:"Indicação, preparo, sedação, aparelho, achados, biópsias, procedimentos e complicações.", Icon:Activity, tables:["endoscopia_procedimentos"], fields:[
    {name:"tipo",label:"Tipo de exame/procedimento",required:true,full:true},{name:"sedacao",label:"Sedação"},{name:"aparelho",label:"Aparelho"},{name:"indicacao",label:"Indicação",textarea:true,full:true},{name:"preparo",label:"Preparo",textarea:true,full:true}
  ], recentFields:[["status","Status"],["tipo","Tipo"],["sedacao","Sedação"]] },
  "anatomia-patologica": { title:"Anatomia Patológica", description:"Solicitação, material, macroscopia, blocos, lâminas, microscopia, imuno-histoquímica e laudo.", Icon:FlaskConical, tables:["anatomia_patologica_solicitacoes","anatomia_patologica_amostras","anatomia_patologica_laudos"], fields:[
    {name:"tipo_exame",label:"Tipo de exame",required:true},{name:"material",label:"Material",required:true},{name:"sitio_anatomico",label:"Sítio anatômico"},{name:"cid10",label:"CID-10"},{name:"prioridade",label:"Prioridade",defaultValue:"rotina"},{name:"hipotese_diagnostica",label:"Hipótese diagnóstica",textarea:true,full:true}
  ], recentFields:[["status","Status"],["tipo_exame","Exame"],["material","Material"],["prioridade","Prioridade"]] },
  transplantes: { title:"Transplantes", description:"Avaliação, indicação, contraindicações, lista de espera, procedimento e seguimento.", Icon:ShieldCheck, tables:["transplante_avaliacoes","transplante_lista_espera","transplante_procedimentos"], fields:[
    {name:"orgao",label:"Órgão",required:true},{name:"indicacao",label:"Indicação",textarea:true,full:true},{name:"contraindicacoes",label:"Contraindicações",textarea:true,full:true},{name:"parecer",label:"Parecer inicial",textarea:true,full:true}
  ], recentFields:[["status","Status"],["orgao","Órgão"],["parecer","Parecer"]] },
  "home-care": { title:"Home Care", description:"Plano domiciliar, complexidade, equipamentos, insumos, visitas e continuidade assistencial.", Icon:Truck, tables:["homecare_planos","homecare_visitas"], fields:[
    {name:"inicio_em",label:"Início",type:"date"},{name:"complexidade",label:"Complexidade"},{name:"frequencia_visitas",label:"Frequência de visitas"},{name:"objetivos",label:"Objetivos",textarea:true,full:true},{name:"observacoes",label:"Observações",textarea:true,full:true}
  ], recentFields:[["status","Status"],["complexidade","Complexidade"],["inicio_em","Início"],["frequencia_visitas","Visitas"]] },
  paliativos: { title:"Cuidados Paliativos", description:"PPS, elegibilidade, objetivos de cuidado, sintomas, diretivas, suporte e comunicação familiar.", Icon:ShieldCheck, tables:["cuidados_paliativos_planos"], fields:[
    {name:"pps",label:"PPS (%)",type:"number",step:"1",min:0,max:100},{name:"elegibilidade",label:"Elegibilidade"},{name:"objetivos_cuidado",label:"Objetivos de cuidado",textarea:true,full:true},{name:"diretivas_antecipadas",label:"Diretivas antecipadas",textarea:true,full:true},{name:"limitacao_suporte",label:"Limitação de suporte",textarea:true,full:true},{name:"comunicacao_familia",label:"Comunicação com família",textarea:true,full:true},{name:"plano_familiar",label:"Plano familiar",textarea:true,full:true}
  ], recentFields:[["status","Status"],["pps","PPS"],["elegibilidade","Elegibilidade"]] },
  imunizacao: { title:"Imunização", description:"Vacina, dose, fabricante, lote, validade, via, local de aplicação e evento adverso.", Icon:Syringe, tables:["imunizacoes"], fields:[
    {name:"vacina",label:"Vacina",required:true},{name:"dose",label:"Dose"},{name:"fabricante",label:"Fabricante"},{name:"lote",label:"Lote"},{name:"validade",label:"Validade",type:"date"},{name:"via",label:"Via"},{name:"local_aplicacao",label:"Local de aplicação"},{name:"evento_adverso",label:"Evento adverso",textarea:true,full:true},{name:"observacoes",label:"Observações",textarea:true,full:true}
  ], recentFields:[["vacina","Vacina"],["dose","Dose"],["lote","Lote"],["aplicado_em","Aplicação"]] },
} as const;

type Key = keyof typeof modules;

function mostrarValor(value: unknown) {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Sim" : "Não";
  const texto = String(value);
  return texto.length > 90 ? `${texto.slice(0, 87)}...` : texto;
}

export default async function AssistencialModuloPage({ params, searchParams }: { params: Promise<{ modulo: string }>; searchParams: Promise<{ sucesso?: string; erro?: string }> }) {
  const [{ modulo }, query] = await Promise.all([params, searchParams]);
  if (!(modulo in modules)) notFound();
  const config = modules[modulo as Key];
  const supabase = await createClient();
  const counts = await Promise.all(config.tables.map(async (table) => { const { count, error } = await supabase.from(table).select("id", { count: "exact", head: true }); return { table, count: error ? null : count ?? 0 }; }));
  const total = counts.reduce((sum, item) => sum + (item.count ?? 0), 0);
  const fields = ("fields" in config ? config.fields : undefined) as readonly Field[] | undefined;
  const recentFields = ("recentFields" in config ? config.recentFields : undefined) as readonly RecentField[] | undefined;
  const especializado = Boolean(fields);

  let atendimentos: Array<{ id:string; numero_atendimento:string | number | null; data_abertura?:string | null; paciente:{ nome_completo:string; cpf?:string | null; ra?:string | null; numero_registro?:string | number | null } }> = [];
  let recentes: Array<Record<string, unknown>> = [];

  if (especializado) {
    const [{ data: episodios }, recentesResult] = await Promise.all([
      supabase.from("atendimentos").select("id,numero_atendimento,data_abertura,paciente:pacientes(nome_completo,cpf,ra,numero_registro)").order("data_abertura", { ascending: false }).limit(300),
      supabase.from(config.tables[0]).select(["id","created_at",...(recentFields ?? []).map(([key]) => key)].join(",")).order("created_at", { ascending: false }).limit(20),
    ]);
    atendimentos = (episodios ?? []).map((item) => { const paciente = Array.isArray(item.paciente) ? item.paciente[0] : item.paciente; return { id:item.id, numero_atendimento:item.numero_atendimento, data_abertura:item.data_abertura, paciente:{ nome_completo:paciente?.nome_completo ?? "Paciente", cpf:paciente?.cpf ?? null, ra:paciente?.ra ?? null, numero_registro:paciente?.numero_registro ?? null } }; });
    recentes = (recentesResult.data ?? []) as Array<Record<string, unknown>>;
  }

  const Icon = config.Icon;
  return <SectionPage eyebrow="Assistencial" title={config.title} description={config.description}>
    {query.sucesso ? <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">Registro assistencial salvo com sucesso.</div> : null}
    {query.erro ? <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">Não foi possível concluir o registro ({query.erro}).</div> : null}

    <div className="mb-5 flex flex-wrap gap-2"><Link href={"/assistencial" as Route} className="btn-secondary"><ArrowLeft className="size-4"/>Central Assistencial</Link>{"operationHref" in config ? <Link href={config.operationHref as Route} className="ui-button-primary">Abrir operação atual</Link> : <span className="rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-xs font-black uppercase tracking-wider text-violet-700">Módulo especializado</span>}</div>

    <section className="grid gap-4 md:grid-cols-[1fr_250px]"><div className="his-card p-6"><div className="flex items-start gap-4"><span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-brand-50 text-brand-700"><Icon className="size-6"/></span><div><p className="his-eyebrow">Domínio hospitalar</p><h2 className="mt-1 text-xl font-black text-slate-950">{especializado ? "Operação especializada integrada" : "Base integrada implantada"}</h2><p className="mt-2 text-sm leading-6 text-slate-500">As estruturas deste módulo compartilham atendimento, paciente, unidade, profissionais, RLS e rastreabilidade clínica. Registros especializados permanecem no mesmo episódio assistencial.</p></div></div></div><div className="his-kpi"><p className="text-xs font-black uppercase tracking-wider text-slate-400">Registros visíveis</p><p className="mt-3 text-4xl font-black text-brand-950">{total}</p><p className="mt-2 text-xs text-slate-500">no escopo atual.</p></div></section>

    {especializado ? <section className="mt-5 grid gap-5 xl:grid-cols-[1.1fr_.9fr]">
      <form action={registrarEspecializado} className="his-card p-6">
        <input type="hidden" name="modulo" value={modulo} />
        <div className="mb-5"><p className="his-eyebrow">Novo registro</p><h2 className="mt-1 text-lg font-black text-slate-950">Registrar no episódio assistencial</h2><p className="mt-1 text-sm text-slate-500">Selecione o atendimento e preencha os campos essenciais. O paciente e o escopo são derivados do episódio.</p></div>
        <EncounterPicker encounters={atendimentos} name="atendimento_id" />
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {fields?.map((field) => <label key={field.name} className={`space-y-2 text-sm font-semibold text-slate-700 ${field.full ? "md:col-span-2" : ""}`}><span>{field.label}{field.required ? " *" : ""}</span>{field.textarea ? <textarea name={field.name} required={field.required} rows={3} defaultValue={field.defaultValue} className="ui-input" placeholder={field.placeholder} /> : <input name={field.name} required={field.required} type={field.type ?? "text"} step={field.step} min={field.min} max={field.max} defaultValue={field.defaultValue} className="ui-input" placeholder={field.placeholder} />}</label>)}
        </div>
        <div className="mt-6 flex justify-end border-t border-slate-100 pt-5"><button className="ui-button-primary">Salvar registro</button></div>
      </form>

      <section className="his-card overflow-hidden"><div className="border-b border-slate-100 p-5"><h2 className="font-black text-slate-900">Registros recentes</h2><p className="mt-1 text-sm text-slate-500">Últimos registros visíveis da unidade atual.</p></div><div className="max-h-[760px] divide-y divide-slate-100 overflow-y-auto">{recentes.length ? recentes.map((row) => <article key={String(row.id)} className="p-5"><div className="grid gap-3 sm:grid-cols-2">{recentFields?.map(([key,label]) => <div key={key}><p className="text-[10px] font-black uppercase tracking-wider text-slate-400">{label}</p><p className="mt-1 text-sm font-semibold text-slate-800">{mostrarValor(row[key])}</p></div>)}</div><p className="mt-3 text-[11px] text-slate-400">{mostrarValor(row.created_at)}</p></article>) : <p className="p-8 text-center text-sm text-slate-500">Nenhum registro visível neste módulo.</p>}</div></section>
    </section> : null}

    <section className="his-card mt-5 overflow-hidden"><div className="border-b border-slate-100 p-5"><h2 className="font-black text-slate-900">Componentes implantados</h2></div><div className="grid gap-px bg-slate-100 sm:grid-cols-2 xl:grid-cols-3">{counts.map((item) => <div key={item.table} className="bg-white p-5"><p className="text-xs font-bold uppercase tracking-wider text-slate-400">{item.table.replaceAll("_"," ")}</p><p className="mt-2 text-2xl font-black text-slate-900">{item.count ?? "—"}</p></div>)}</div></section>
  </SectionPage>;
}
