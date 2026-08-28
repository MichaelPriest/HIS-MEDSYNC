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
    { value: "cirurgiao_principal", label: "Cirurgião" },
    { value: "cirurgiao_auxiliar:1", label: `1º auxiliar${auxCount >= 1 ? " · previsto na tabela" : ""}` },
    { value: "cirurgiao_auxiliar:2", label: `2º auxiliar${auxCount >= 2 ? " · previsto na tabela" : ""}` },
    { value: "cirurgiao_auxiliar:3", label: `3º auxiliar${auxCount >= 3 ? " · previsto na tabela" : ""}` },
    { value: "cirurgiao_auxiliar:4", label: `4º auxiliar${auxCount >= 4 ? " · previsto na tabela" : ""}` },
    { value: "anestesista", label: `Anestesista${requisitos?.anestesista ? " · previsto na tabela" : ""}` },
    { value: "auxiliar_anestesia", label: "Auxiliar do anestesista" },
    { value: "instrumentador", label: `Instrumentador${requisitos?.instrumentador ? " · requerido" : ""}` },
    { value: "pediatra", label: `Pediatra${requisitos?.pediatra ? " · requerido" : ""}` },
    { value: "neonatologista", label: `Neonatologista${requisitos?.neonatologista ? " · requerido" : ""}` },
    { value: "perfusionista", label: "Perfusionista" },
    { value: "enfermeiro", label: "Enfermeiro" },
    { value: "tecnico_enfermagem", label: "Técnico de enfermagem" },
    { value: "circulante_sala", label: "Circulante de sala" },
    { value: "tecnico_radiologia", label: "Técnico de radiologia" },
    { value: "outro", label: "Outro participante" },
  ];
  const [papel, setPapel] = useState(roles[0]?.value ?? "outro");

  return <form action={action} className="grid gap-3 md:grid-cols-2">
    <input type="hidden" name="cirurgia_id" value={cirurgiaId} />
    <input type="hidden" name="cirurgia_procedimento_id" value={procedimentoId} />
    <div className="md:col-span-2"><ProfessionalRemotePicker empresaId={empresaId} name="profissional_id" label="Profissional da equipe" required /></div>
    <label className="space-y-2 text-sm font-medium text-slate-700"><span>Papel na sala *</span><select name="papel_selecao" value={papel} onChange={(event) => setPapel(event.target.value)} className="ui-input">{roles.map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}</select></label>
    <input type="hidden" name="papel" value={papel.startsWith("cirurgiao_auxiliar:") ? "cirurgiao_auxiliar" : papel} />
    <input type="hidden" name="ordem" value={papel.startsWith("cirurgiao_auxiliar:") ? papel.split(":")[1] : ""} />
    <label className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700"><input type="checkbox" name="principal" defaultChecked={papel === "cirurgiao_principal"} />Participação principal</label>
    <label className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700"><input type="checkbox" name="registrar_entrada" />Registrar entrada na sala agora</label>
    <label className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700"><input type="checkbox" name="registrar_saida" />Registrar saída da sala agora</label>
    <input name="observacoes" className="ui-input" placeholder="Observações da participação" />
    <button className="ui-button-secondary md:col-span-2"><UserPlus className="size-4" />Adicionar / atualizar membro</button>
  </form>;
}
