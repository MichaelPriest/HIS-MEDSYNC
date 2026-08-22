"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { FormTabs } from "@/components/cadastros/form-tabs";
import { MaskedInput } from "@/components/forms/masked-input";
import { PatientPicker } from "@/components/atendimentos/patient-picker";

type Patient = {
  id: string;
  nome_completo: string;
  cpf: string | null;
  rg: string | null;
  data_nascimento: string;
  sexo: string | null;
  telefone: string | null;
  email: string | null;
  cep: string | null;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
  ra: string;
  numero_registro: number;
};

type Profissional = { id: string; nome_completo: string };
type Convenio = { id: string; nome_fantasia: string; registro_ans: string | null };
type Plano = { id: string; convenio_id: string; nome: string; codigo: string | null };
type Tipo = { codigo: string; descricao: string };

export function AdmissionForm({
  action,
  patients,
  profissionais,
  convenios,
  planos,
  tipos,
}: {
  action: (formData: FormData) => void | Promise<void>;
  patients: Patient[];
  profissionais: Profissional[];
  convenios: Convenio[];
  planos: Plano[];
  tipos: Tipo[];
}) {
  const [patientId, setPatientId] = useState("");
  const patient = useMemo(() => patients.find((item) => item.id === patientId) ?? null, [patients, patientId]);
  const [coverage, setCoverage] = useState<"particular" | "convenio">("particular");
  const [convenioId, setConvenioId] = useState("");
  const planosFiltrados = useMemo(() => planos.filter((item) => item.convenio_id === convenioId), [planos, convenioId]);

  const dadosPaciente = <div className="space-y-5">
    <PatientPicker patients={patients.map((p) => ({ id: p.id, nome_completo: p.nome_completo, cpf: p.cpf, ra: p.ra, numero_registro: p.numero_registro }))} name="paciente_id" value={patientId} onChange={setPatientId} />
    {patient ? <div className="rounded-2xl border border-brand-100 bg-brand-50/60 p-4 text-sm text-brand-950"><div className="font-semibold">Paciente localizado</div><div className="mt-1 flex flex-wrap gap-x-5 gap-y-1 text-xs"><span>Registro #{patient.numero_registro}</span><span>{patient.ra}</span><span>{patient.cpf ? `CPF ${patient.cpf}` : "CPF não informado"}</span></div></div> : null}
    <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
      <label className="space-y-2 text-sm font-medium text-slate-700 md:col-span-2"><span>Nome completo *</span><input name="paciente_nome" required defaultValue={patient?.nome_completo ?? ""} key={`nome-${patientId}`} className="ui-input" /></label>
      <label className="space-y-2 text-sm font-medium text-slate-700"><span>CPF</span><MaskedInput name="paciente_cpf" mask="cpf" defaultValue={patient?.cpf ?? ""} key={`cpf-${patientId}`} /></label>
      <label className="space-y-2 text-sm font-medium text-slate-700"><span>RG</span><input name="paciente_rg" defaultValue={patient?.rg ?? ""} key={`rg-${patientId}`} className="ui-input" /></label>
      <label className="space-y-2 text-sm font-medium text-slate-700"><span>Data de nascimento *</span><input name="paciente_data_nascimento" type="date" required defaultValue={patient?.data_nascimento ?? ""} key={`nasc-${patientId}`} className="ui-input" /></label>
      <label className="space-y-2 text-sm font-medium text-slate-700"><span>Sexo</span><select name="paciente_sexo" defaultValue={patient?.sexo ?? ""} key={`sexo-${patientId}`} className="ui-input"><option value="">Selecione</option><option value="masculino">Masculino</option><option value="feminino">Feminino</option><option value="outros">Outros</option><option value="nao_informado">Não informado</option></select></label>
      <label className="space-y-2 text-sm font-medium text-slate-700"><span>Telefone *</span><MaskedInput name="paciente_telefone" mask="telefone" required defaultValue={patient?.telefone ?? ""} key={`tel-${patientId}`} /></label>
      <label className="space-y-2 text-sm font-medium text-slate-700"><span>E-mail</span><input name="paciente_email" type="email" defaultValue={patient?.email ?? ""} key={`email-${patientId}`} className="ui-input" /></label>
    </div>
  </div>;

  const endereco = <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
    <label className="space-y-2 text-sm font-medium text-slate-700"><span>CEP</span><MaskedInput name="paciente_cep" mask="cep" defaultValue={patient?.cep ?? ""} key={`cep-${patientId}`} /></label>
    <label className="space-y-2 text-sm font-medium text-slate-700 md:col-span-2"><span>Endereço *</span><input name="paciente_endereco" required defaultValue={patient?.logradouro ?? ""} key={`end-${patientId}`} className="ui-input" /></label>
    <label className="space-y-2 text-sm font-medium text-slate-700"><span>Número *</span><input name="paciente_numero" required defaultValue={patient?.numero ?? ""} key={`num-${patientId}`} className="ui-input" /></label>
    <label className="space-y-2 text-sm font-medium text-slate-700"><span>Complemento</span><input name="paciente_complemento" defaultValue={patient?.complemento ?? ""} key={`comp-${patientId}`} className="ui-input" /></label>
    <label className="space-y-2 text-sm font-medium text-slate-700"><span>Bairro *</span><input name="paciente_bairro" required defaultValue={patient?.bairro ?? ""} key={`bairro-${patientId}`} className="ui-input" /></label>
    <label className="space-y-2 text-sm font-medium text-slate-700"><span>Cidade *</span><input name="paciente_cidade" required defaultValue={patient?.cidade ?? ""} key={`cidade-${patientId}`} className="ui-input" /></label>
    <label className="space-y-2 text-sm font-medium text-slate-700"><span>Estado *</span><input name="paciente_estado" required maxLength={2} defaultValue={patient?.uf ?? ""} key={`uf-${patientId}`} className="ui-input uppercase" /></label>
  </div>;

  const cobertura = <div className="space-y-5">
    <div className="grid gap-3 sm:grid-cols-2">
      {(["particular", "convenio"] as const).map((tipo) => <label key={tipo} className={`cursor-pointer rounded-2xl border p-4 transition ${coverage === tipo ? "border-brand-300 bg-brand-50" : "border-slate-200 bg-white"}`}><input type="radio" name="cobertura" value={tipo} checked={coverage === tipo} onChange={() => setCoverage(tipo)} className="mr-2 accent-brand-700" /><span className="font-semibold text-slate-900">{tipo === "particular" ? "Particular" : "Convênio"}</span><p className="mt-1 text-xs text-slate-500">{tipo === "particular" ? "Atendimento sem cobertura de operadora." : "Atendimento vinculado a operadora, plano e carteirinha."}</p></label>)}
    </div>
    {coverage === "convenio" ? <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
      <label className="space-y-2 text-sm font-medium text-slate-700"><span>Convênio *</span><select name="convenio_id" required value={convenioId} onChange={(e) => setConvenioId(e.target.value)} className="ui-input"><option value="">Selecione</option>{convenios.map((item) => <option key={item.id} value={item.id}>{item.nome_fantasia}{item.registro_ans ? ` · ANS ${item.registro_ans}` : ""}</option>)}</select></label>
      <label className="space-y-2 text-sm font-medium text-slate-700"><span>Plano *</span><select name="plano_id" required defaultValue="" className="ui-input"><option value="">Selecione</option>{planosFiltrados.map((item) => <option key={item.id} value={item.id}>{item.nome}{item.codigo ? ` · ${item.codigo}` : ""}</option>)}</select></label>
      <label className="space-y-2 text-sm font-medium text-slate-700"><span>Carteirinha *</span><input name="numero_carteirinha" required className="ui-input" /></label>
      <label className="space-y-2 text-sm font-medium text-slate-700"><span>Validade da carteirinha</span><input name="validade_carteirinha" type="date" className="ui-input" /></label>
      <label className="space-y-2 text-sm font-medium text-slate-700"><span>Nº autorização</span><input name="numero_autorizacao" className="ui-input" /></label>
      <label className="space-y-2 text-sm font-medium text-slate-700"><span>Senha autorização</span><input name="senha_autorizacao" className="ui-input" /></label>
    </div> : <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-600">Cobertura definida como particular. Convênio, plano e carteirinha não serão vinculados a este atendimento.</div>}
  </div>;

  const atendimento = <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
    <label className="space-y-2 text-sm font-medium text-slate-700"><span>Profissional</span><select name="profissional_id" defaultValue="" className="ui-input"><option value="">A definir</option>{profissionais.map((item) => <option key={item.id} value={item.id}>{item.nome_completo}</option>)}</select></label>
    <label className="space-y-2 text-sm font-medium text-slate-700"><span>Tipo de atendimento *</span><select name="tipo_atendimento" required defaultValue="" className="ui-input"><option value="">Selecione</option>{tipos.length ? tipos.map((item) => <option key={item.codigo} value={item.codigo}>{item.descricao}</option>) : <><option value="ambulatorial">Ambulatorial</option><option value="urgencia">Urgência / Emergência</option><option value="internacao">Internação</option><option value="sadt">SADT</option></>}</select></label>
    <label className="space-y-2 text-sm font-medium text-slate-700"><span>Origem</span><select name="origem" defaultValue="" className="ui-input"><option value="">Selecione</option><option value="agenda">Agenda</option><option value="demanda_espontanea">Demanda espontânea</option><option value="transferencia">Transferência</option><option value="referencia">Referência</option></select></label>
    <label className="space-y-2 text-sm font-medium text-slate-700 md:col-span-2 xl:col-span-3"><span>Observações</span><textarea name="observacoes" rows={4} className="ui-input" /></label>
  </div>;

  return <form action={action} className="ui-card p-5 sm:p-6">
    <FormTabs tabs={[{ id: "paciente", label: "Paciente", content: dadosPaciente }, { id: "endereco", label: "Endereço", content: endereco }, { id: "cobertura", label: "Particular / Convênio", content: cobertura }, { id: "atendimento", label: "Atendimento", content: atendimento }]} />
    <div className="mt-8 flex justify-end gap-3 border-t border-slate-100 pt-5"><a href="/atendimentos" className="btn-secondary">Cancelar</a><button className="ui-button-primary">Abrir atendimento</button></div>
  </form>;
}
