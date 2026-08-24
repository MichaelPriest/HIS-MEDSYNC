"use client";

import { useMemo, useState } from "react";
import { FormTabs } from "@/components/cadastros/form-tabs";
import { MaskedInput } from "@/components/forms/masked-input";
import { PatientRemotePicker, type AdmissionPatient } from "@/components/atendimentos/patient-remote-picker";

type Profissional = { id: string; nome_completo: string };
type Convenio = { id: string; nome_fantasia: string; registro_ans: string | null };
type Plano = { id: string; convenio_id: string; nome: string; codigo: string | null };
type Tipo = { codigo: string; descricao: string };

export function AdmissionForm({
  action,
  empresaId,
  initialPatient,
  profissionais,
  convenios,
  planos,
  tipos,
  initialProfissionalId = null,
  initialCoverage = "particular",
  initialConvenioId = null,
  initialPlanoId = null,
  initialTipoAtendimento = null,
  initialOrigem = null,
  cancelHref = "/atendimentos",
  submitLabel = "Abrir atendimento",
}: {
  action: (formData: FormData) => void | Promise<void>;
  empresaId: string;
  initialPatient: AdmissionPatient | null;
  profissionais: Profissional[];
  convenios: Convenio[];
  planos: Plano[];
  tipos: Tipo[];
  initialProfissionalId?: string | null;
  initialCoverage?: "particular" | "convenio";
  initialConvenioId?: string | null;
  initialPlanoId?: string | null;
  initialTipoAtendimento?: string | null;
  initialOrigem?: string | null;
  cancelHref?: string;
  submitLabel?: string;
}) {
  const [patient, setPatient] = useState<AdmissionPatient | null>(initialPatient);
  const patientId = patient?.id ?? "";
  const [coverage, setCoverage] = useState<"particular" | "convenio">(initialCoverage);
  const [convenioId, setConvenioId] = useState(initialConvenioId ?? "");
  const [atendimentoRn, setAtendimentoRn] = useState(false);
  const planosFiltrados = useMemo(() => planos.filter((item) => item.convenio_id === convenioId), [planos, convenioId]);

  const dadosPaciente = <div className="space-y-5">
    <PatientRemotePicker empresaId={empresaId} value={patient} onChange={setPatient} />
    <input type="hidden" name="paciente_id" value={patientId} />
    <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
      <label className="space-y-2 text-sm font-medium text-slate-700 md:col-span-2"><span>Nome completo *</span><input name="paciente_nome" defaultValue={patient?.nome_completo ?? ""} key={`nome-${patientId}`} className="ui-input" /></label>
      <label className="space-y-2 text-sm font-medium text-slate-700"><span>CPF</span><MaskedInput name="paciente_cpf" mask="cpf" defaultValue={patient?.cpf ?? ""} key={`cpf-${patientId}`} /></label>
      <label className="space-y-2 text-sm font-medium text-slate-700"><span>RG</span><input name="paciente_rg" defaultValue={patient?.rg ?? ""} key={`rg-${patientId}`} className="ui-input" /></label>
      <label className="space-y-2 text-sm font-medium text-slate-700"><span>CNS</span><input name="paciente_cns" defaultValue={patient?.cns ?? ""} key={`cns-${patientId}`} maxLength={15} className="ui-input" /></label>
      <label className="space-y-2 text-sm font-medium text-slate-700"><span>Data de nascimento *</span><input name="paciente_data_nascimento" type="date" defaultValue={patient?.data_nascimento ?? ""} key={`nasc-${patientId}`} className="ui-input" /></label>
      <label className="space-y-2 text-sm font-medium text-slate-700"><span>Nacionalidade</span><select name="paciente_nacionalidade" defaultValue={patient?.nacionalidade ?? ""} key={`nac-${patientId}`} className="ui-input"><option value="">Selecione</option><option value="brasileiro">Brasileiro(a)</option><option value="estrangeiro">Estrangeiro(a)</option></select></label>
      <label className="space-y-2 text-sm font-medium text-slate-700"><span>Estado civil</span><select name="paciente_estado_civil" defaultValue={patient?.estado_civil ?? ""} key={`ec-${patientId}`} className="ui-input"><option value="">Selecione</option><option value="solteiro">Solteiro(a)</option><option value="casado">Casado(a)</option><option value="divorciado">Divorciado(a)</option><option value="viuvo">Viúvo(a)</option></select></label>
      <label className="space-y-2 text-sm font-medium text-slate-700"><span>Sexo</span><select name="paciente_sexo" defaultValue={patient?.sexo ?? ""} key={`sexo-${patientId}`} className="ui-input"><option value="">Selecione</option><option value="masculino">Masculino</option><option value="feminino">Feminino</option><option value="outros">Outros</option><option value="nao_informado">Não informado</option></select></label>
      <label className="space-y-2 text-sm font-medium text-slate-700"><span>Telefone *</span><MaskedInput name="paciente_telefone" mask="telefone" defaultValue={patient?.telefone ?? ""} key={`tel-${patientId}`} /></label>
      <label className="space-y-2 text-sm font-medium text-slate-700"><span>E-mail</span><input name="paciente_email" type="email" defaultValue={patient?.email ?? ""} key={`email-${patientId}`} className="ui-input" /></label>
    </div>
  </div>;

  const endereco = <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
    <label className="space-y-2 text-sm font-medium text-slate-700"><span>CEP</span><MaskedInput name="paciente_cep" mask="cep" defaultValue={patient?.cep ?? ""} key={`cep-${patientId}`} /></label>
    <label className="space-y-2 text-sm font-medium text-slate-700 md:col-span-2"><span>Endereço *</span><input name="paciente_endereco" defaultValue={patient?.logradouro ?? ""} key={`end-${patientId}`} className="ui-input" /></label>
    <label className="space-y-2 text-sm font-medium text-slate-700"><span>Número *</span><input name="paciente_numero" defaultValue={patient?.numero ?? ""} key={`num-${patientId}`} className="ui-input" /></label>
    <label className="space-y-2 text-sm font-medium text-slate-700"><span>Complemento</span><input name="paciente_complemento" defaultValue={patient?.complemento ?? ""} key={`comp-${patientId}`} className="ui-input" /></label>
    <label className="space-y-2 text-sm font-medium text-slate-700"><span>Bairro *</span><input name="paciente_bairro" defaultValue={patient?.bairro ?? ""} key={`bairro-${patientId}`} className="ui-input" /></label>
    <label className="space-y-2 text-sm font-medium text-slate-700"><span>Cidade *</span><input name="paciente_cidade" defaultValue={patient?.cidade ?? ""} key={`cidade-${patientId}`} className="ui-input" /></label>
    <label className="space-y-2 text-sm font-medium text-slate-700"><span>Estado *</span><input name="paciente_estado" maxLength={2} defaultValue={patient?.uf ?? ""} key={`uf-${patientId}`} className="ui-input uppercase" /></label>
  </div>;

  const cobertura = <div className="space-y-5">
    <div className="grid gap-3 sm:grid-cols-2">
      {(["particular", "convenio"] as const).map((tipo) => <label key={tipo} className={`cursor-pointer rounded-2xl border p-4 transition ${coverage === tipo ? "border-brand-300 bg-brand-50" : "border-slate-200 bg-white"}`}><input type="radio" name="cobertura" value={tipo} checked={coverage === tipo} onChange={() => { setCoverage(tipo); if (tipo === "particular") { setAtendimentoRn(false); setConvenioId(""); } }} className="mr-2 accent-brand-700" /><span className="font-semibold text-slate-900">{tipo === "particular" ? "Particular" : "Convênio"}</span><p className="mt-1 text-xs text-slate-500">{tipo === "particular" ? "Atendimento sem cobertura de operadora." : "Atendimento vinculado a operadora, plano e carteirinha."}</p></label>)}
    </div>
    {coverage === "convenio" ? <>
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        <label className="space-y-2 text-sm font-medium text-slate-700"><span>Convênio *</span><select name="convenio_id" value={convenioId} onChange={(e) => setConvenioId(e.target.value)} className="ui-input"><option value="">Selecione</option>{convenios.map((item) => <option key={item.id} value={item.id}>{item.nome_fantasia}{item.registro_ans ? ` · ANS ${item.registro_ans}` : ""}</option>)}</select></label>
        <label className="space-y-2 text-sm font-medium text-slate-700"><span>Plano *</span><select name="plano_id" defaultValue={initialPlanoId ?? ""} key={`plano-${convenioId}`} className="ui-input"><option value="">Selecione</option>{planosFiltrados.map((item) => <option key={item.id} value={item.id}>{item.nome}{item.codigo ? ` · ${item.codigo}` : ""}</option>)}</select></label>
        <label className="space-y-2 text-sm font-medium text-slate-700"><span>Carteirinha *</span><input name="numero_carteirinha" className="ui-input" /></label>
        <label className="space-y-2 text-sm font-medium text-slate-700"><span>Validade da carteirinha</span><input name="validade_carteirinha" type="date" className="ui-input" /></label>
        <label className="space-y-2 text-sm font-medium text-slate-700"><span>Nº autorização</span><input name="numero_autorizacao" className="ui-input" /></label>
        <label className="space-y-2 text-sm font-medium text-slate-700"><span>Senha autorização</span><input name="senha_autorizacao" className="ui-input" /></label>
      </div>
      <label className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition ${atendimentoRn ? "border-brand-300 bg-brand-50" : "border-slate-200 bg-slate-50/70"}`}>
        <input type="checkbox" name="atendimento_rn" value="true" checked={atendimentoRn} onChange={(event) => setAtendimentoRn(event.target.checked)} className="mt-0.5 size-4 accent-brand-700" />
        <span><span className="block text-sm font-semibold text-slate-900">Atendimento a RN (TISS)</span><span className="mt-1 block text-xs leading-5 text-slate-500">Marque quando o atendimento for prestado ao recém-nato utilizando o contrato/carteirinha do responsável. Marcado será registrado como indicador “S”; desmarcado como “N” no snapshot da guia TISS.</span></span>
      </label>
    </> : <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-600">Cobertura definida como particular. Convênio, plano, carteirinha e indicador TISS de atendimento a RN não serão vinculados a este atendimento.</div>}
  </div>;

  const atendimento = <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
    <label className="space-y-2 text-sm font-medium text-slate-700"><span>Profissional</span><select name="profissional_id" defaultValue={initialProfissionalId ?? ""} className="ui-input"><option value="">A definir</option>{profissionais.map((item) => <option key={item.id} value={item.id}>{item.nome_completo}</option>)}</select></label>
    <label className="space-y-2 text-sm font-medium text-slate-700"><span>Tipo de atendimento *</span><select name="tipo_atendimento" defaultValue={initialTipoAtendimento ?? ""} className="ui-input"><option value="">Selecione</option>{tipos.length ? tipos.map((item) => <option key={item.codigo} value={item.codigo}>{item.descricao}</option>) : <><option value="ambulatorial">Ambulatorial</option><option value="urgencia">Urgência / Emergência</option><option value="internacao">Internação</option><option value="sadt">SADT</option></>}</select></label>
    <label className="space-y-2 text-sm font-medium text-slate-700"><span>Origem</span><select name="origem" defaultValue={initialOrigem ?? ""} className="ui-input"><option value="">Selecione</option><option value="agenda">Agenda</option><option value="demanda_espontanea">Demanda espontânea</option><option value="transferencia">Transferência</option><option value="referencia">Referência</option></select></label>
    <label className="space-y-2 text-sm font-medium text-slate-700 md:col-span-2 xl:col-span-3"><span>Observações</span><textarea name="observacoes" rows={4} className="ui-input" /></label>
  </div>;

  return <form noValidate action={action} className="ui-card p-5 sm:p-6">
    <FormTabs tabs={[{ id: "paciente", label: "Paciente", content: dadosPaciente }, { id: "endereco", label: "Endereço", content: endereco }, { id: "cobertura", label: "Particular / Convênio", content: cobertura }, { id: "atendimento", label: "Atendimento", content: atendimento }]} />
    <div className="mt-8 flex justify-end gap-3 border-t border-slate-100 pt-5"><a href={cancelHref} className="btn-secondary">Cancelar</a><button disabled={!patient} className="ui-button-primary disabled:cursor-not-allowed disabled:opacity-50">{submitLabel}</button></div>
  </form>;
}
