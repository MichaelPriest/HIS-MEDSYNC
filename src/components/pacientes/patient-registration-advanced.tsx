"use client";

import Link from "next/link";
import { AlertTriangle, Baby, BadgeCheck, HeartPulse, ShieldCheck, UserRound } from "lucide-react";
import { useMemo, useState } from "react";
import { ContactSections } from "@/components/cadastros/contact-sections";
import { PhotoField } from "@/components/cadastros/photo-field";
import { MaskedInput } from "@/components/forms/masked-input";

type Convenio = { id: string; nome_fantasia: string; registro_ans: string | null };
type Plano = { id: string; convenio_id: string; nome: string; codigo: string | null; carteirinha_mascara: string | null; exige_validade_carteirinha: boolean };

function ageFromDate(value: string) {
  if (!value) return null;
  const birth = new Date(`${value}T12:00:00`);
  if (Number.isNaN(birth.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const beforeBirthday = today.getMonth() < birth.getMonth() || (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate());
  if (beforeBirthday) age -= 1;
  return age;
}

function nameIsValid(value: string) {
  return /^[\p{L}\p{M}][\p{L}\p{M}\s'-]*$/u.test(value.trim());
}

export function PatientRegistrationAdvanced({
  action,
  convenios,
  planos,
  retornoAdmissao,
  erro,
  mensagemErro,
}: {
  action: (formData: FormData) => void | Promise<void>;
  convenios: Convenio[];
  planos: Plano[];
  retornoAdmissao?: string | null;
  erro?: string | null;
  mensagemErro?: string | null;
}) {
  const [birthDate, setBirthDate] = useState("");
  const [name, setName] = useState("");
  const [convenioId, setConvenioId] = useState("");
  const [planoId, setPlanoId] = useState("");
  const age = ageFromDate(birthDate);
  const minor = age !== null && age < 18;
  const selectedPlan = planos.find((item) => item.id === planoId) ?? null;
  const plans = useMemo(() => planos.filter((item) => item.convenio_id === convenioId), [convenioId, planos]);

  return (
    <form action={action} noValidate className="space-y-5">
      {retornoAdmissao ? <input type="hidden" name="retorno" value={retornoAdmissao} /> : null}
      {retornoAdmissao ? <div className="rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-800"><strong>Admissão preservada.</strong> Ao salvar, o paciente volta selecionado para a mesma abertura.</div> : null}
      {erro && mensagemErro ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{mensagemErro}</div> : null}

      <section className="ui-card p-5 sm:p-6">
        <div className="mb-5 flex items-start gap-3"><span className="grid size-10 place-items-center rounded-xl bg-brand-50 text-brand-700"><UserRound className="size-5" /></span><div><h2 className="font-black text-slate-900">Identificação e dados regulatórios</h2><p className="mt-1 text-sm text-slate-500">Dados do beneficiário usados na assistência e nos snapshots TISS.</p></div></div>
        <PhotoField label="Foto do paciente" />
        <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          <label className="space-y-2 text-sm font-medium text-slate-700 md:col-span-2"><span>Nome completo do beneficiário *</span><input name="nome_completo" value={name} onChange={(e)=>setName(e.target.value)} required className={`ui-input ${name && !nameIsValid(name) ? "border-rose-400 bg-rose-50" : ""}`} autoComplete="name" />{name && !nameIsValid(name) ? <span className="block text-xs text-rose-600">Use somente letras, espaços, hífen ou apóstrofo.</span> : null}</label>
          <label className="space-y-2 text-sm font-medium text-slate-700"><span>Nome social</span><input name="nome_social" className="ui-input" /><span className="block text-xs font-normal text-slate-400">Usado em chamadas e telas assistenciais; o nome de registro permanece no faturamento.</span></label>
          <label className="space-y-2 text-sm font-medium text-slate-700"><span>Data de nascimento *</span><input name="data_nascimento" type="date" value={birthDate} onChange={(e)=>setBirthDate(e.target.value)} required className="ui-input" />{age !== null ? <span className={`block text-xs font-semibold ${minor ? "text-amber-700" : "text-slate-500"}`}>{age} ano(s){minor ? " · responsável obrigatório" : ""}</span> : null}</label>
          <label className="space-y-2 text-sm font-medium text-slate-700"><span>Sexo / gênero (domínio regulatório) *</span><select name="sexo" defaultValue="nao_informado" className="ui-input"><option value="masculino">Masculino</option><option value="feminino">Feminino</option><option value="nao_informado">Não informado</option></select></label>
          <label className="space-y-2 text-sm font-medium text-slate-700"><span>CPF *</span><MaskedInput mask="cpf" name="cpf" required inputMode="numeric" /><span className="block text-xs font-normal text-slate-400">Validação de dígitos verificadores no servidor.</span></label>
          <label className="space-y-2 text-sm font-medium text-slate-700"><span>CNS / Cartão SUS</span><input name="cns" inputMode="numeric" maxLength={15} pattern="[0-9]{15}" className="ui-input" placeholder="15 dígitos" /><span className="block text-xs font-normal text-slate-400">Triagem local de consistência; validação definitiva pode ser confirmada no CADSUS.</span></label>
          <label className="space-y-2 text-sm font-medium text-slate-700"><span>RG</span><input name="rg" maxLength={30} className="ui-input" /></label>
          <label className="space-y-2 text-sm font-medium text-slate-700"><span>Nacionalidade</span><select name="nacionalidade" defaultValue="" className="ui-input"><option value="">Selecione</option><option value="brasileiro">Brasileiro(a)</option><option value="estrangeiro">Estrangeiro(a)</option></select></label>
          <label className="space-y-2 text-sm font-medium text-slate-700"><span>Estado civil</span><select name="estado_civil" defaultValue="" className="ui-input"><option value="">Selecione</option><option value="solteiro">Solteiro(a)</option><option value="casado">Casado(a)</option><option value="divorciado">Divorciado(a)</option><option value="viuvo">Viúvo(a)</option></select></label>
        </div>
      </section>

      <section className="ui-card p-5 sm:p-6">
        <div className="mb-5 flex items-start gap-3"><span className="grid size-10 place-items-center rounded-xl bg-indigo-50 text-indigo-700"><BadgeCheck className="size-5" /></span><div><h2 className="font-black text-slate-900">Vínculo com plano de saúde</h2><p className="mt-1 text-sm text-slate-500">Opcional no cadastro; quando informado, a admissão poderá carregar esses dados automaticamente.</p></div></div>
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          <label className="space-y-2 text-sm font-medium text-slate-700"><span>Operadora</span><select name="paciente_convenio_id" value={convenioId} onChange={(e)=>{setConvenioId(e.target.value);setPlanoId("");}} className="ui-input"><option value="">Sem convênio</option>{convenios.map((item)=><option key={item.id} value={item.id}>{item.nome_fantasia}{item.registro_ans ? ` · ANS ${item.registro_ans}` : ""}</option>)}</select></label>
          <label className="space-y-2 text-sm font-medium text-slate-700"><span>Plano / produto</span><select name="paciente_plano_id" value={planoId} onChange={(e)=>setPlanoId(e.target.value)} disabled={!convenioId} className="ui-input"><option value="">Selecione</option>{plans.map((item)=><option key={item.id} value={item.id}>{item.nome}{item.codigo ? ` · ${item.codigo}` : ""}</option>)}</select></label>
          <label className="space-y-2 text-sm font-medium text-slate-700"><span>Número da carteirinha</span><input name="paciente_numero_carteirinha" className="ui-input" placeholder={selectedPlan?.carteirinha_mascara ?? "Conforme padrão da operadora"} /></label>
          <label className="space-y-2 text-sm font-medium text-slate-700"><span>Validade da carteira{selectedPlan?.exige_validade_carteirinha ? " *" : ""}</span><input name="paciente_validade_carteirinha" type="date" required={Boolean(selectedPlan?.exige_validade_carteirinha)} className="ui-input" /></label>
        </div>
      </section>

      <section className="ui-card p-5 sm:p-6">
        <div className="mb-4 flex items-start gap-3"><span className="grid size-10 place-items-center rounded-xl bg-emerald-50 text-emerald-700"><ShieldCheck className="size-5" /></span><div><h2 className="font-black text-slate-900">Contato, endereço e consentimento de comunicação</h2><p className="mt-1 text-sm text-slate-500">O endereço usa ViaCEP e os consentimentos ficam registrados separadamente.</p></div></div>
        <ContactSections />
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700"><input type="checkbox" name="consentimento_whatsapp" value="1" className="mt-0.5 size-4 accent-brand-700" /><span><strong className="block text-slate-900">Autoriza lembretes por WhatsApp/SMS</strong><span className="mt-1 block text-xs text-slate-500">Agenda, orientações operacionais e lembretes assistenciais.</span></span></label>
          <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700"><input type="checkbox" name="consentimento_email" value="1" className="mt-0.5 size-4 accent-brand-700" /><span><strong className="block text-slate-900">Autoriza lembretes por e-mail</strong><span className="mt-1 block text-xs text-slate-500">O consentimento poderá ser revogado posteriormente.</span></span></label>
        </div>
      </section>

      <section className={`ui-card p-5 sm:p-6 ${minor ? "border-amber-300 bg-amber-50/30" : ""}`}>
        <div className="mb-5 flex items-start gap-3"><span className="grid size-10 place-items-center rounded-xl bg-amber-50 text-amber-700"><Baby className="size-5" /></span><div><h2 className="font-black text-slate-900">Responsável legal / financeiro</h2><p className="mt-1 text-sm text-slate-500">{minor ? "Paciente menor de 18 anos: os campos abaixo são obrigatórios." : "Preenchimento opcional para maiores de idade."}</p></div></div>
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          <label className="space-y-2 text-sm font-medium text-slate-700"><span>Nome do responsável{minor ? " *" : ""}</span><input name="responsavel_nome" required={minor} className="ui-input" /></label>
          <label className="space-y-2 text-sm font-medium text-slate-700"><span>CPF do responsável{minor ? " *" : ""}</span><MaskedInput mask="cpf" name="responsavel_cpf" required={minor} /></label>
          <label className="space-y-2 text-sm font-medium text-slate-700"><span>Grau de parentesco{minor ? " *" : ""}</span><input name="responsavel_parentesco" required={minor} className="ui-input" placeholder="Mãe, pai, tutor(a)..." /></label>
        </div>
      </section>

      <section className="rounded-2xl border border-rose-200 bg-rose-50/70 p-5 sm:p-6">
        <div className="flex items-start gap-3"><span className="grid size-10 place-items-center rounded-xl bg-white text-rose-700"><AlertTriangle className="size-5" /></span><div className="flex-1"><h2 className="font-black text-rose-950">Alergias e condições de alerta</h2><p className="mt-1 text-sm text-rose-800">Esse resumo aparecerá em destaque no contexto assistencial. Use apenas alertas relevantes.</p><textarea name="alerta_assistencial" rows={3} className="ui-input mt-4 border-rose-200 bg-white" placeholder="Ex.: alergia grave à penicilina; diabetes; gestação de alto risco..." /></div></div>
      </section>

      <div className="flex flex-wrap justify-end gap-3">
        <Link href={retornoAdmissao ?? "/pacientes"} className="btn-secondary">Cancelar</Link>
        <button type="submit" disabled={Boolean(name && !nameIsValid(name))} className="ui-button-primary"><HeartPulse className="size-4" />{retornoAdmissao ? "Salvar e voltar à admissão" : "Salvar paciente"}</button>
      </div>
    </form>
  );
}
