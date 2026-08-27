"use client";

import { UserPlus } from "lucide-react";
import { useState } from "react";
import { ProfessionalRemotePicker } from "@/components/profissionais/professional-remote-picker";

type Requirements = {
  quantidade_auxiliares?: number;
  anestesista?: boolean;
  instrumentador?: boolean;
  pediatra?: boolean;
  neonatologista?: boolean;
  permite_outros?: boolean;
};

type Props = {
  action: (formData: FormData) => void | Promise<void>;
  empresaId: string;
  cirurgiaId: string;
  procedimentoId: string;
  requisitos?: Requirements | null;
};

export function ProcedureTeamForm({ action, empresaId, cirurgiaId, procedimentoId, requisitos }: Props) {
  const auxCount = Math.max(0, Number(requisitos?.quantidade_auxiliares ?? 0));
  const roles = [
    { value: "cirurgiao_principal", label: "Cirurgião principal" },
    ...(auxCount > 0 ? [{ value: "cirurgiao_auxiliar", label: `Cirurgião auxiliar · até ${auxCount}` }] : []),
    ...(requisitos?.instrumentador ? [{ value: "instrumentador", label: "Instrumentador" }] : []),
    ...(requisitos?.anestesista ? [{ value: "anestesista", label: "Anestesista" }] : []),
    ...(requisitos?.pediatra ? [{ value: "pediatra", label: "Pediatra em sala" }] : []),
    ...(requisitos?.neonatologista ? [{ value: "neonatologista", label: "Neonatologista" }] : []),
    ...(requisitos?.permite_outros !== false ? [{ value: "outro", label: "Outro participante" }] : []),
  ];
  const [papel, setPapel] = useState(roles[0]?.value ?? "outro");

  return <form action={action} className="grid gap-3 md:grid-cols-2">
    <input type="hidden" name="cirurgia_id" value={cirurgiaId} />
    <input type="hidden" name="cirurgia_procedimento_id" value={procedimentoId} />
    <div className="md:col-span-2"><ProfessionalRemotePicker empresaId={empresaId} name="profissional_id" label="Profissional da equipe" required /></div>
    <label className="space-y-2 text-sm font-medium text-slate-700"><span>Papel na sala *</span><select name="papel" value={papel} onChange={(event) => setPapel(event.target.value)} className="ui-input">{roles.map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}</select></label>
    {papel === "cirurgiao_auxiliar" ? <label className="space-y-2 text-sm font-medium text-slate-700"><span>Ordem do auxiliar *</span><select name="ordem" defaultValue="1" className="ui-input">{Array.from({ length: auxCount }, (_, index) => index + 1).map((ordem) => <option key={ordem} value={ordem}>{ordem}º auxiliar</option>)}</select></label> : <input type="hidden" name="ordem" value="" />}
    <label className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700"><input type="checkbox" name="principal" defaultChecked={papel === "cirurgiao_principal"} />Participação principal</label>
    <label className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700"><input type="checkbox" name="registrar_entrada" />Registrar entrada na sala agora</label>
    <label className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700"><input type="checkbox" name="registrar_saida" />Registrar saída da sala agora</label>
    <input name="observacoes" className="ui-input" placeholder="Observações da participação" />
    <button className="ui-button-secondary md:col-span-2"><UserPlus className="size-4" />Adicionar / atualizar membro</button>
  </form>;
}
