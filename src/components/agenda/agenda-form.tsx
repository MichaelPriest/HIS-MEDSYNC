"use client";

import { useState } from "react";
import { PatientPicker } from "@/components/atendimentos/patient-picker";

type Patient = { id: string; nome_completo: string; cpf: string | null; ra: string; numero_registro: number };
type Profissional = { id: string; nome_completo: string };
type Convenio = { id: string; nome_fantasia: string };
type Tipo = { codigo: string; descricao: string };

export function AgendaForm({ action, pacientes, profissionais, convenios, tipos }: { action: (formData: FormData) => void | Promise<void>; pacientes: Patient[]; profissionais: Profissional[]; convenios: Convenio[]; tipos: Tipo[] }) {
  const [pacienteId, setPacienteId] = useState("");
  return <form action={action} className="ui-card p-6">
    <div className="mb-6"><PatientPicker patients={pacientes} name="paciente_id" value={pacienteId} onChange={setPacienteId} /></div>
    <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
      <label className="space-y-2 text-sm font-medium text-slate-700"><span>Profissional</span><select name="profissional_id" defaultValue="" className="ui-input"><option value="">A definir</option>{profissionais.map((item) => <option key={item.id} value={item.id}>{item.nome_completo}</option>)}</select></label>
      <label className="space-y-2 text-sm font-medium text-slate-700"><span>Convênio</span><select name="convenio_id" defaultValue="" className="ui-input"><option value="">Particular</option>{convenios.map((item) => <option key={item.id} value={item.id}>{item.nome_fantasia}</option>)}</select></label>
      <label className="space-y-2 text-sm font-medium text-slate-700"><span>Tipo de Atendimento</span><select name="tipo_atendimento" defaultValue="" className="ui-input"><option value="">Selecione</option>{tipos.map((item) => <option key={item.codigo} value={item.codigo}>{item.descricao}</option>)}</select></label>
      <label className="space-y-2 text-sm font-medium text-slate-700"><span>Início *</span><input name="inicio" type="datetime-local" required className="ui-input" /></label>
      <label className="space-y-2 text-sm font-medium text-slate-700"><span>Fim *</span><input name="fim" type="datetime-local" required className="ui-input" /></label>
      <label className="space-y-2 text-sm font-medium text-slate-700 md:col-span-2 xl:col-span-3"><span>Observações</span><textarea name="observacoes" rows={4} className="ui-input" /></label>
    </div>
    <div className="mt-8 flex justify-end gap-3 border-t border-slate-100 pt-5"><a href="/agenda" className="btn-secondary">Cancelar</a><button className="ui-button-primary">Salvar agendamento</button></div>
  </form>;
}
