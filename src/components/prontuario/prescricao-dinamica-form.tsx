"use client";

import { useMemo, useState } from "react";
import { FlaskConical, PackagePlus, Pill, Plus, Stethoscope } from "lucide-react";
import { ItemAssistencialAutocomplete, type ItemAssistencialSelecionado } from "@/components/prontuario/item-assistencial-autocomplete";
import { criarPrescricaoMedica } from "@/modules/prontuario-medico/prescricao-actions";

const TIPOS_IMAGEM = new Set(["raio_x", "tomografia", "ressonancia", "ultrassonografia", "mamografia", "densitometria"]);

function metadataString(item: ItemAssistencialSelecionado | null, key: string) {
  const value = item?.metadata?.[key];
  return typeof value === "string" ? value.toLowerCase() : null;
}

export function PrescricaoDinamicaForm({ empresaId, atendimentoId }: { empresaId: string; atendimentoId: string }) {
  const [item, setItem] = useState<ItemAssistencialSelecionado | null>(null);
  const [compor, setCompor] = useState(false);

  const tipoExame = metadataString(item, "tipo_exame");
  const isMedicamento = item?.categoria === "medicamento";
  const isMaterial = item ? ["material", "opme", "gas_medicinal"].includes(item.categoria) : false;
  const isProcedimento = item?.categoria === "procedimento";
  const isExame = Boolean(isProcedimento && (tipoExame === "laboratorio" || TIPOS_IMAGEM.has(tipoExame ?? "")));
  const destino = useMemo(() => {
    if (tipoExame === "laboratorio") return "Laboratório";
    if (TIPOS_IMAGEM.has(tipoExame ?? "")) return "Imagem";
    return null;
  }, [tipoExame]);

  return (
    <form action={criarPrescricaoMedica} className="mt-5 space-y-5">
      <input type="hidden" name="atendimento_id" value={atendimentoId} />

      <ItemAssistencialAutocomplete
        empresaId={empresaId}
        onSelecionado={(novo) => { setItem(novo); if (novo?.categoria !== "medicamento") setCompor(false); }}
        placeholder="Digite medicamento, material, hemograma, raio-X, tomografia..."
      />

      {!item ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
          Selecione um item do catálogo. O formulário será adaptado automaticamente ao tipo do lançamento.
        </div>
      ) : null}

      {isMedicamento ? (
        <section className="space-y-4 rounded-2xl border border-emerald-100 bg-emerald-50/40 p-4">
          <div className="flex items-center gap-2"><Pill className="size-5 text-emerald-700"/><div><h3 className="font-black text-slate-900">Prescrição de medicamento</h3><p className="text-xs text-slate-500">Dose, via, frequência e aprazamento clínico.</p></div></div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <label className="space-y-2 text-sm font-semibold text-slate-700"><span>Dose *</span><input name="dose" className="ui-input" placeholder="Ex.: 1 g" required/></label>
            <label className="space-y-2 text-sm font-semibold text-slate-700"><span>Via *</span><select name="via" className="ui-input" required defaultValue=""><option value="" disabled>Selecione</option><option>VO</option><option>EV</option><option>IM</option><option>SC</option><option>SL</option><option>INALATÓRIA</option><option>TÓPICA</option><option>RETAL</option><option>OCULAR</option><option>NASAL</option></select></label>
            <label className="space-y-2 text-sm font-semibold text-slate-700"><span>Quantidade</span><input name="quantidade" type="number" step="0.0001" min="0" className="ui-input"/></label>
            <label className="space-y-2 text-sm font-semibold text-slate-700"><span>Unidade da dose</span><input name="unidade_dose" className="ui-input" placeholder={item.unidade_medida ?? "mg, g, mL..."}/></label>
            <label className="space-y-2 text-sm font-semibold text-slate-700"><span>Frequência padrão *</span><select name="frequencia" className="ui-input" required defaultValue=""><option value="" disabled>Selecione</option><option value="24/24h">24/24h — 08:00</option><option value="12/12h">12/12h — 08:00 e 20:00</option><option value="8/8h">8/8h — 06:00, 14:00 e 22:00</option><option value="6/6h">6/6h — 00:00, 06:00, 12:00 e 18:00</option><option value="4/4h">4/4h — 02:00, 06:00, 10:00, 14:00, 18:00 e 22:00</option><option value="dose_unica">Dose única</option><option value="se_necessario">Se necessário / PRN</option></select></label>
            <label className="space-y-2 text-sm font-semibold text-slate-700"><span>Duração</span><input name="duracao" className="ui-input" placeholder="Ex.: 5 dias"/></label>
            <label className="space-y-2 text-sm font-semibold text-slate-700"><span>Início</span><input name="inicio_em" type="datetime-local" className="ui-input"/></label>
            <label className="space-y-2 text-sm font-semibold text-slate-700"><span>Fim</span><input name="fim_em" type="datetime-local" className="ui-input"/></label>
            <label className="space-y-2 text-sm font-semibold text-slate-700 md:col-span-2"><span>Diluente / solução</span><input name="diluente" className="ui-input" placeholder="Quando aplicável"/></label>
            <label className="space-y-2 text-sm font-semibold text-slate-700 md:col-span-2"><span>Velocidade de infusão</span><input name="velocidade_infusao" className="ui-input" placeholder="Ex.: 100 mL/h"/></label>
            <label className="space-y-2 text-sm font-semibold text-slate-700 md:col-span-2"><span>Instruções de administração</span><textarea name="instrucoes" rows={3} className="ui-input min-h-24"/></label>
            <label className="space-y-2 text-sm font-semibold text-slate-700 md:col-span-2"><span>Orientações</span><textarea name="orientacoes" rows={3} className="ui-input min-h-24"/></label>
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700"><input type="checkbox" name="se_necessario"/>Se necessário / PRN</label>
          </div>

          <div className="rounded-xl border border-emerald-200 bg-white p-4">
            <button type="button" onClick={() => setCompor((v) => !v)} className="flex items-center gap-2 text-sm font-black text-emerald-700"><Plus className="size-4"/>{compor ? "Ocultar composição" : "Adicionar medicamento à mesma solução/administração"}</button>
            {compor ? <div className="mt-4 space-y-4">
              <p className="text-xs text-slate-500">Exemplo: Soro fisiológico 0,9% + dipirona. Cada componente continua rastreável separadamente.</p>
              {[1, 2].map((n) => <div key={n} className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 md:grid-cols-4">
                <div className="md:col-span-4"><ItemAssistencialAutocomplete empresaId={empresaId} name={`componente_${n}_id`} label={`Componente adicional ${n}`} required={false} apenasMedicamentos placeholder="Digite dipirona, ondansetrona, ceftriaxona..."/></div>
                <label className="space-y-1 text-xs font-semibold text-slate-600"><span>Dose</span><input name={`componente_${n}_dose`} className="ui-input"/></label>
                <label className="space-y-1 text-xs font-semibold text-slate-600"><span>Quantidade</span><input name={`componente_${n}_quantidade`} type="number" step="0.0001" min="0" className="ui-input"/></label>
                <label className="space-y-1 text-xs font-semibold text-slate-600"><span>Unidade</span><input name={`componente_${n}_unidade`} className="ui-input" placeholder="mg, g, mL..."/></label>
                <label className="space-y-1 text-xs font-semibold text-slate-600"><span>Observação</span><input name={`componente_${n}_observacao`} className="ui-input"/></label>
              </div>)}
            </div> : null}
          </div>
        </section>
      ) : null}

      {isMaterial ? (
        <section className="space-y-4 rounded-2xl border border-sky-100 bg-sky-50/40 p-4">
          <div className="flex items-center gap-2"><PackagePlus className="size-5 text-sky-700"/><div><h3 className="font-black text-slate-900">Solicitação de material</h3><p className="text-xs text-slate-500">Será encaminhada ao Almoxarifado; estoque permanece invisível ao médico.</p></div></div>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2 text-sm font-semibold text-slate-700"><span>Quantidade *</span><input name="quantidade" type="number" step="0.0001" min="0.0001" className="ui-input" required/></label>
            <label className="space-y-2 text-sm font-semibold text-slate-700"><span>Unidade</span><input className="ui-input" value={item.unidade_medida ?? "Unidade do catálogo"} readOnly/></label>
            <label className="space-y-2 text-sm font-semibold text-slate-700 md:col-span-2"><span>Observação / finalidade</span><textarea name="instrucoes" rows={3} className="ui-input min-h-24"/></label>
          </div>
        </section>
      ) : null}

      {isExame ? (
        <section className="space-y-4 rounded-2xl border border-violet-100 bg-violet-50/40 p-4">
          <div className="flex items-center gap-2"><FlaskConical className="size-5 text-violet-700"/><div><h3 className="font-black text-slate-900">Solicitação de exame</h3><p className="text-xs text-slate-500">Destino automático: {destino ?? "setor executor"}.</p></div></div>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2 text-sm font-semibold text-slate-700"><span>Prioridade *</span><select name="prioridade" className="ui-input" defaultValue="rotina" required><option value="rotina">Rotina</option><option value="urgente">Urgente</option><option value="emergencia">Emergência</option></select></label>
            {tipoExame !== "laboratorio" ? <label className="space-y-2 text-sm font-semibold text-slate-700"><span>Lateralidade</span><select name="lateralidade" className="ui-input" defaultValue=""><option value="">Não se aplica</option><option value="direita">Direita</option><option value="esquerda">Esquerda</option><option value="bilateral">Bilateral</option></select></label> : null}
            <label className="space-y-2 text-sm font-semibold text-slate-700 md:col-span-2"><span>Indicação clínica *</span><textarea name="instrucoes" rows={4} className="ui-input min-h-28" required placeholder="Hipótese diagnóstica, sinais/sintomas e motivo do exame"/></label>
          </div>
        </section>
      ) : null}

      {isProcedimento && !isExame ? (
        <section className="space-y-4 rounded-2xl border border-amber-100 bg-amber-50/40 p-4">
          <div className="flex items-center gap-2"><Stethoscope className="size-5 text-amber-700"/><div><h3 className="font-black text-slate-900">Solicitação de procedimento</h3><p className="text-xs text-slate-500">Será criado como procedimento assistencial programado.</p></div></div>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2 text-sm font-semibold text-slate-700"><span>Quantidade *</span><input name="quantidade" type="number" step="0.0001" min="0.0001" defaultValue="1" className="ui-input" required/></label>
            <label className="space-y-2 text-sm font-semibold text-slate-700"><span>Lateralidade</span><select name="lateralidade" className="ui-input" defaultValue=""><option value="">Não se aplica</option><option value="direita">Direita</option><option value="esquerda">Esquerda</option><option value="bilateral">Bilateral</option></select></label>
            <label className="space-y-2 text-sm font-semibold text-slate-700 md:col-span-2"><span>Indicação / observações</span><textarea name="instrucoes" rows={4} className="ui-input min-h-28"/></label>
          </div>
        </section>
      ) : null}

      {item?.categoria === "outro" ? (
        <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <label className="block space-y-2 text-sm font-semibold text-slate-700"><span>Orientações / cuidado</span><textarea name="instrucoes" rows={4} className="ui-input min-h-28"/></label>
        </section>
      ) : null}

      {item ? <div className="flex justify-end"><button className="ui-button-primary"><Pill className="size-4"/>Salvar solicitação</button></div> : null}
    </form>
  );
}
