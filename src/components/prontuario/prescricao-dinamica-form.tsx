"use client";

import { useMemo, useState } from "react";
import { ClipboardCheck, FlaskConical, PackagePlus, Pill, Plus, Stethoscope } from "lucide-react";
import { ItemAssistencialAutocomplete, type ItemAssistencialSelecionado } from "@/components/prontuario/item-assistencial-autocomplete";
import { adicionarItemPrescricaoDiaAction } from "@/modules/prontuario-medico/prescricao-dia-actions";

const TIPOS_IMAGEM = new Set(["raio_x", "tomografia", "ressonancia", "ultrassonografia", "mamografia", "densitometria"]);
const FREQUENCIAS = [
  { value: "24/24h", label: "24/24h", horarios: "08:00" },
  { value: "12/12h", label: "12/12h", horarios: "08:00, 20:00" },
  { value: "8/8h", label: "8/8h", horarios: "06:00, 14:00, 22:00" },
  { value: "6/6h", label: "6/6h", horarios: "00:00, 06:00, 12:00, 18:00" },
  { value: "4/4h", label: "4/4h", horarios: "02:00, 06:00, 10:00, 14:00, 18:00, 22:00" },
  { value: "2/2h", label: "2/2h", horarios: "00:00, 02:00, 04:00, 06:00, 08:00, 10:00, 12:00, 14:00, 16:00, 18:00, 20:00, 22:00" },
  { value: "1x/dia", label: "1x ao dia", horarios: "08:00" },
  { value: "2x/dia", label: "2x ao dia", horarios: "08:00, 20:00" },
  { value: "3x/dia", label: "3x ao dia", horarios: "06:00, 14:00, 22:00" },
  { value: "4x/dia", label: "4x ao dia", horarios: "00:00, 06:00, 12:00, 18:00" },
  { value: "dose_unica", label: "Dose única", horarios: "" },
  { value: "se_necessario", label: "Se necessário / PRN", horarios: "" },
] as const;

type Aba = "medicamentos" | "exames" | "procedimentos" | "materiais" | "revisao";
type Contadores = Record<Aba, number>;

const ABAS: Array<{ id: Aba; label: string; icon: typeof Pill }> = [
  { id: "medicamentos", label: "Medicamentos / Soluções", icon: Pill },
  { id: "exames", label: "Exames", icon: FlaskConical },
  { id: "procedimentos", label: "Procedimentos", icon: Stethoscope },
  { id: "materiais", label: "Materiais / OPME", icon: PackagePlus },
  { id: "revisao", label: "Revisão", icon: ClipboardCheck },
];

function metadataString(item: ItemAssistencialSelecionado | null, key: string) {
  const value = item?.metadata?.[key];
  return typeof value === "string" ? value.toLowerCase() : null;
}

export function PrescricaoDinamicaForm({
  empresaId,
  atendimentoId,
  abaInicial = "medicamentos",
  contadores,
  revisao,
}: {
  empresaId: string;
  atendimentoId: string;
  abaInicial?: Aba;
  contadores: Contadores;
  revisao?: React.ReactNode;
}) {
  const [aba, setAba] = useState<Aba>(abaInicial);
  const [item, setItem] = useState<ItemAssistencialSelecionado | null>(null);
  const [compor, setCompor] = useState(false);
  const [frequencia, setFrequencia] = useState("");
  const [horarios, setHorarios] = useState("");

  const tipoExame = metadataString(item, "tipo_exame");
  const isExameSelecionado = Boolean(item?.categoria === "procedimento" && (tipoExame === "laboratorio" || TIPOS_IMAGEM.has(tipoExame ?? "")));
  const destino = useMemo(() => tipoExame === "laboratorio" ? "Laboratório" : TIPOS_IMAGEM.has(tipoExame ?? "") ? "Imagem" : null, [tipoExame]);

  function mudarAba(nova: Aba) {
    setAba(nova);
    setItem(null);
    setCompor(false);
    setFrequencia("");
    setHorarios("");
  }
  function mudarFrequencia(value: string) {
    setFrequencia(value);
    setHorarios(FREQUENCIAS.find((opcao) => opcao.value === value)?.horarios ?? "");
  }

  const categorias = aba === "medicamentos" ? ["medicamento"] : aba === "materiais" ? ["material", "opme", "gas_medicinal"] : aba === "exames" || aba === "procedimentos" ? ["procedimento"] : [];

  return (
    <div className="mt-5 space-y-5">
      <div className="flex gap-2 overflow-x-auto border-b border-slate-200 pb-2">
        {ABAS.map((tab) => {
          const Icon = tab.icon;
          return <button key={tab.id} type="button" onClick={() => mudarAba(tab.id)} className={`flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-sm font-black ${aba === tab.id ? "bg-brand-950 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}><Icon className="size-4"/>{tab.label}<span className={`rounded-full px-2 py-0.5 text-xs ${aba === tab.id ? "bg-white/20" : "bg-white"}`}>{contadores[tab.id]}</span></button>;
        })}
      </div>

      {aba === "revisao" ? revisao : (
        <form action={adicionarItemPrescricaoDiaAction} className="space-y-5">
          <input type="hidden" name="atendimento_id" value={atendimentoId}/>
          <input type="hidden" name="aba" value={aba}/>
          <ItemAssistencialAutocomplete
            key={aba}
            empresaId={empresaId}
            categoriasPermitidas={categorias}
            label={aba === "medicamentos" ? "Medicamento / solução" : aba === "exames" ? "Exame" : aba === "procedimentos" ? "Procedimento" : "Material / OPME / gás medicinal"}
            onSelecionado={(novo) => setItem(novo)}
            placeholder={aba === "medicamentos" ? "Digite dipirona, soro fisiológico, ondansetrona..." : aba === "exames" ? "Digite hemograma, raio-X, tomografia, ressonância..." : aba === "procedimentos" ? "Digite o procedimento..." : "Digite agulha, cateter, equipo, OPME..."}
          />

          {!item ? <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">Adicione quantos itens forem necessários. Eles permanecerão em rascunho até a finalização da prescrição do dia.</div> : null}

          {aba === "medicamentos" && item ? <section className="space-y-4 rounded-2xl border border-emerald-100 bg-emerald-50/40 p-4">
            <div className="flex items-center gap-2"><Pill className="size-5 text-emerald-700"/><div><h3 className="font-black">Medicamento / solução</h3><p className="text-xs text-slate-500">Frequência institucional preenche os horários automaticamente.</p></div></div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <label className="space-y-2 text-sm font-semibold"><span>Dose *</span><input name="dose" className="ui-input" required placeholder="Ex.: 1 g"/></label>
              <label className="space-y-2 text-sm font-semibold"><span>Via *</span><select name="via" className="ui-input" required defaultValue=""><option value="" disabled>Selecione</option>{["VO","EV","IM","SC","SL","INALATÓRIA","TÓPICA","RETAL","OCULAR","NASAL"].map((v) => <option key={v}>{v}</option>)}</select></label>
              <label className="space-y-2 text-sm font-semibold"><span>Quantidade</span><input name="quantidade" type="number" step="0.0001" min="0" className="ui-input"/></label>
              <label className="space-y-2 text-sm font-semibold"><span>Unidade</span><input name="unidade_dose" className="ui-input" placeholder={item.unidade_medida ?? "mg, g, mL..."}/></label>
              <label className="space-y-2 text-sm font-semibold"><span>Frequência *</span><select name="frequencia" className="ui-input" required value={frequencia} onChange={(e) => mudarFrequencia(e.target.value)}><option value="" disabled>Selecione</option>{FREQUENCIAS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}</select></label>
              <label className="space-y-2 text-sm font-semibold xl:col-span-2"><span>Horários automáticos</span><input name="horarios" className="ui-input" value={horarios} onChange={(e) => setHorarios(e.target.value)} placeholder="Definidos pela frequência"/><span className="block text-xs font-normal text-slate-500">Podem ser ajustados por necessidade clínica.</span></label>
              <label className="space-y-2 text-sm font-semibold"><span>Duração</span><input name="duracao" className="ui-input" placeholder="Ex.: 5 dias"/></label>
              <label className="space-y-2 text-sm font-semibold"><span>Início</span><input name="inicio_em" type="datetime-local" className="ui-input"/></label>
              <label className="space-y-2 text-sm font-semibold"><span>Fim</span><input name="fim_em" type="datetime-local" className="ui-input"/></label>
              <label className="space-y-2 text-sm font-semibold"><span>Velocidade de infusão</span><input name="velocidade_infusao" className="ui-input" placeholder="Ex.: 100 mL/h"/></label>
              <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" name="se_necessario"/>Se necessário / PRN</label>
              <label className="space-y-2 text-sm font-semibold md:col-span-2"><span>Instruções</span><textarea name="instrucoes" rows={3} className="ui-input min-h-24"/></label>
              <label className="space-y-2 text-sm font-semibold md:col-span-2"><span>Orientações</span><textarea name="orientacoes" rows={3} className="ui-input min-h-24"/></label>
            </div>
            <div className="rounded-xl border border-emerald-200 bg-white p-4">
              <button type="button" onClick={() => setCompor((v) => !v)} className="flex items-center gap-2 text-sm font-black text-emerald-700"><Plus className="size-4"/>{compor ? "Ocultar composição" : "Adicionar medicamento à mesma solução/administração"}</button>
              {compor ? <div className="mt-4 space-y-4"><p className="text-xs text-slate-500">Ex.: SF 0,9% + dipirona. Cada componente permanece rastreável.</p>{[1,2].map((n) => <div key={n} className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 md:grid-cols-4"><div className="md:col-span-4"><ItemAssistencialAutocomplete empresaId={empresaId} name={`componente_${n}_id`} label={`Componente adicional ${n}`} required={false} apenasMedicamentos placeholder="Digite o medicamento adicional..."/></div><input name={`componente_${n}_dose`} className="ui-input" placeholder="Dose"/><input name={`componente_${n}_quantidade`} type="number" step="0.0001" min="0" className="ui-input" placeholder="Quantidade"/><input name={`componente_${n}_unidade`} className="ui-input" placeholder="Unidade"/><input name={`componente_${n}_observacao`} className="ui-input" placeholder="Observação"/></div>)}</div> : null}
            </div>
          </section> : null}

          {aba === "exames" && item ? <section className="space-y-4 rounded-2xl border border-violet-100 bg-violet-50/40 p-4">
            <div><h3 className="font-black">Solicitação de exame</h3><p className="text-xs text-slate-500">{isExameSelecionado ? `Destino após finalizar: ${destino ?? "setor executor"}` : "Selecione um exame classificado no catálogo."}</p></div>
            <div className="grid gap-4 md:grid-cols-2"><label className="space-y-2 text-sm font-semibold"><span>Prioridade *</span><select name="prioridade" className="ui-input" defaultValue="rotina"><option value="rotina">Rotina</option><option value="urgente">Urgente</option><option value="emergencia">Emergência</option></select></label>{tipoExame !== "laboratorio" ? <label className="space-y-2 text-sm font-semibold"><span>Lateralidade</span><select name="lateralidade" className="ui-input" defaultValue=""><option value="">Não se aplica</option><option value="direita">Direita</option><option value="esquerda">Esquerda</option><option value="bilateral">Bilateral</option></select></label> : null}<label className="space-y-2 text-sm font-semibold md:col-span-2"><span>Indicação clínica *</span><textarea name="instrucoes" required rows={4} className="ui-input min-h-28"/></label></div>
          </section> : null}

          {aba === "procedimentos" && item ? <section className="space-y-4 rounded-2xl border border-amber-100 bg-amber-50/40 p-4"><h3 className="font-black">Procedimento</h3><div className="grid gap-4 md:grid-cols-2"><label className="space-y-2 text-sm font-semibold"><span>Quantidade *</span><input name="quantidade" type="number" min="0.0001" step="0.0001" defaultValue="1" required className="ui-input"/></label><label className="space-y-2 text-sm font-semibold"><span>Lateralidade</span><select name="lateralidade" className="ui-input" defaultValue=""><option value="">Não se aplica</option><option value="direita">Direita</option><option value="esquerda">Esquerda</option><option value="bilateral">Bilateral</option></select></label><label className="space-y-2 text-sm font-semibold md:col-span-2"><span>Indicação / observações</span><textarea name="instrucoes" rows={4} className="ui-input min-h-28"/></label></div></section> : null}

          {aba === "materiais" && item ? <section className="space-y-4 rounded-2xl border border-sky-100 bg-sky-50/40 p-4"><h3 className="font-black">Material / OPME</h3><div className="grid gap-4 md:grid-cols-2"><label className="space-y-2 text-sm font-semibold"><span>Quantidade *</span><input name="quantidade" type="number" min="0.0001" step="0.0001" required className="ui-input"/></label><label className="space-y-2 text-sm font-semibold"><span>Unidade</span><input className="ui-input" value={item.unidade_medida ?? "UN"} readOnly/></label><label className="space-y-2 text-sm font-semibold md:col-span-2"><span>Finalidade / observação</span><textarea name="instrucoes" rows={3} className="ui-input min-h-24"/></label></div></section> : null}

          {item ? <div className="flex justify-end"><button className="ui-button-primary"><Plus className="size-4"/>Adicionar ao rascunho do dia</button></div> : null}
        </form>
      )}
    </div>
  );
}
