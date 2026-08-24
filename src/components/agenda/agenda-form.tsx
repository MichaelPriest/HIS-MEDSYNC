"use client";

import { useMemo, useState } from "react";
import { CalendarClock, Hospital, Stethoscope } from "lucide-react";
import { PatientRemotePicker, type AdmissionPatient } from "@/components/atendimentos/patient-remote-picker";

type Profissional = { id: string; nome_completo: string; especialidade: string | null };
type Convenio = { id: string; nome_fantasia: string };
type Plano = { id: string; convenio_id: string; nome: string; codigo: string | null };
type Tipo = { codigo: string; descricao: string };
type Especialidade = { codigo: string; descricao: string };
type Local = { id: string; nome: string; tipo: string };

export function AgendaForm({
  action,
  empresaId,
  profissionais,
  convenios,
  planos,
  tipos,
  especialidades,
  locais,
}: {
  action: (formData: FormData) => void | Promise<void>;
  empresaId: string;
  profissionais: Profissional[];
  convenios: Convenio[];
  planos: Plano[];
  tipos: Tipo[];
  especialidades: Especialidade[];
  locais: Local[];
}) {
  const [patient, setPatient] = useState<AdmissionPatient | null>(null);
  const [convenioId, setConvenioId] = useState("");
  const [profissionalId, setProfissionalId] = useState("");
  const [especialidade, setEspecialidade] = useState("");
  const [cirurgiaEletiva, setCirurgiaEletiva] = useState(false);

  const planosFiltrados = useMemo(() => planos.filter((item) => item.convenio_id === convenioId), [planos, convenioId]);
  const profissionalSelecionado = profissionais.find((item) => item.id === profissionalId);

  function selecionarProfissional(id: string) {
    setProfissionalId(id);
    const profissional = profissionais.find((item) => item.id === id);
    if (profissional?.especialidade) setEspecialidade(profissional.especialidade);
  }

  return <form action={action} className="space-y-6">
    <section className="ui-card p-6">
      <div className="mb-5 flex items-start gap-3 border-b border-slate-100 pb-5"><span className="grid size-10 place-items-center rounded-xl bg-brand-50 text-brand-700"><CalendarClock className="size-5" /></span><div><h2 className="font-semibold text-slate-900">Paciente e horário</h2><p className="mt-1 text-sm text-slate-500">Pesquise o paciente sob demanda. Agendamentos comuns não geram senha de Totem.</p></div></div>
      <PatientRemotePicker empresaId={empresaId} value={patient} onChange={setPatient} />
      <input type="hidden" name="paciente_id" value={patient?.id ?? ""} />
      <div className="mt-5 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        <label className="space-y-2 text-sm font-medium text-slate-700"><span>Início *</span><input name="inicio" type="datetime-local" required className="ui-input" /></label>
        <label className="space-y-2 text-sm font-medium text-slate-700"><span>Fim *</span><input name="fim" type="datetime-local" required className="ui-input" /></label>
        <label className="space-y-2 text-sm font-medium text-slate-700"><span>Tipo de atendimento</span><select name="tipo_atendimento" defaultValue="" className="ui-input"><option value="">Selecione</option>{tipos.map((item) => <option key={item.codigo} value={item.codigo}>{item.descricao}</option>)}</select></label>
        <label className="space-y-2 text-sm font-medium text-slate-700"><span>Motivo do agendamento</span><input name="motivo_agendamento" placeholder="Ex.: primeira consulta, revisão, exame..." className="ui-input" /></label>
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <Check name="encaixe" title="Encaixe" text="Identifica horário inserido fora da grade regular." />
        <Check name="retorno" title="Retorno" text="Marca consulta de retorno do paciente." />
        <label className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-4 ${cirurgiaEletiva ? "border-violet-200 bg-violet-50" : "border-slate-200 bg-slate-50"}`}><input type="checkbox" name="cirurgia_eletiva" value="true" checked={cirurgiaEletiva} onChange={(event) => setCirurgiaEletiva(event.target.checked)} className="mt-1 size-4 accent-violet-700"/><span><strong className="block text-sm text-slate-900">Cirurgia eletiva</strong><span className="mt-1 block text-xs text-slate-500">Encaminha para pré-admissão e fluxo do centro cirúrgico.</span></span></label>
      </div>
    </section>

    <section className="ui-card p-6">
      <div className="mb-5 flex items-start gap-3 border-b border-slate-100 pb-5"><span className="grid size-10 place-items-center rounded-xl bg-sky-50 text-sky-700"><Stethoscope className="size-5" /></span><div><h2 className="font-semibold text-slate-900">Profissional e local</h2><p className="mt-1 text-sm text-slate-500">O sistema bloqueia sobreposição do mesmo profissional ou do mesmo local físico.</p></div></div>
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        <label className="space-y-2 text-sm font-medium text-slate-700"><span>Profissional</span><select name="profissional_id" value={profissionalId} onChange={(event) => selecionarProfissional(event.target.value)} className="ui-input"><option value="">A definir</option>{profissionais.map((item) => <option key={item.id} value={item.id}>{item.nome_completo}{item.especialidade ? ` · ${item.especialidade}` : ""}</option>)}</select></label>
        <label className="space-y-2 text-sm font-medium text-slate-700"><span>Especialidade</span><select name="especialidade" value={especialidade} onChange={(event) => setEspecialidade(event.target.value)} className="ui-input"><option value="">{profissionalSelecionado?.especialidade ? "Especialidade do profissional" : "Selecione"}</option>{especialidades.map((item) => <option key={item.codigo} value={item.descricao}>{item.descricao}</option>)}</select></label>
        <label className="space-y-2 text-sm font-medium text-slate-700"><span>Consultório / sala / setor</span><select name="estrutura_fisica_id" defaultValue="" className="ui-input"><option value="">A definir</option>{locais.map((item) => <option key={item.id} value={item.id}>{item.nome} · {item.tipo.replaceAll("_", " ")}</option>)}</select></label>
      </div>
    </section>

    <section className="ui-card p-6">
      <div className="mb-5 flex items-start gap-3 border-b border-slate-100 pb-5"><span className="grid size-10 place-items-center rounded-xl bg-emerald-50 text-emerald-700"><Hospital className="size-5" /></span><div><h2 className="font-semibold text-slate-900">Cobertura e observações</h2><p className="mt-1 text-sm text-slate-500">Plano é filtrado automaticamente conforme o convênio selecionado.</p></div></div>
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        <label className="space-y-2 text-sm font-medium text-slate-700"><span>Convênio</span><select name="convenio_id" value={convenioId} onChange={(event) => setConvenioId(event.target.value)} className="ui-input"><option value="">Particular</option>{convenios.map((item) => <option key={item.id} value={item.id}>{item.nome_fantasia}</option>)}</select></label>
        <label className="space-y-2 text-sm font-medium text-slate-700"><span>Plano</span><select name="plano_id" defaultValue="" disabled={!convenioId} className="ui-input"><option value="">{convenioId ? "Selecione o plano" : "Particular"}</option>{planosFiltrados.map((item) => <option key={item.id} value={item.id}>{item.nome}{item.codigo ? ` · ${item.codigo}` : ""}</option>)}</select></label>
        <label className="space-y-2 text-sm font-medium text-slate-700 md:col-span-2 xl:col-span-3"><span>Observações</span><textarea name="observacoes" rows={4} className="ui-input" /></label>
      </div>
    </section>

    {cirurgiaEletiva ? <div className="rounded-2xl border border-violet-200 bg-violet-50 p-4 text-sm text-violet-800"><strong>Fluxo de cirurgia eletiva:</strong> este registro entra na Agenda como programação. A admissão cirúrgica, sala, equipe, anestesia e demais itens serão vinculados no módulo cirúrgico; não será tratada como consulta ambulatorial comum.</div> : null}

    <div className="flex justify-end gap-3"><a href="/agenda" className="btn-secondary">Cancelar</a><button disabled={!patient} className="ui-button-primary disabled:cursor-not-allowed disabled:opacity-50">Salvar agendamento</button></div>
  </form>;
}

function Check({ name, title, text }: { name: string; title: string; text: string }) {
  return <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4"><input type="checkbox" name={name} value="true" className="mt-1 size-4 accent-brand-700"/><span><strong className="block text-sm text-slate-900">{title}</strong><span className="mt-1 block text-xs text-slate-500">{text}</span></span></label>;
}
