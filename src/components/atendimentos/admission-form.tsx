"use client";

import { AlertTriangle, BadgeCheck, Building2, Clock3, Fingerprint, KeyRound, ShieldAlert, Stethoscope, UserPlus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { AdmissionAttachments } from "@/components/atendimentos/admission-attachments";
import { PatientRemotePicker, type AdmissionPatient } from "@/components/atendimentos/patient-remote-picker";
import { TussProcedurePicker } from "@/components/atendimentos/tuss-procedure-picker";
import { FormTabs } from "@/components/cadastros/form-tabs";
import { MaskedInput } from "@/components/forms/masked-input";
import { createClient } from "@/lib/supabase/client";

type Profissional = {
  id: string;
  nome_completo: string;
  conselho: string | null;
  numero_conselho: string | null;
  uf_conselho: string | null;
  cbo: string | null;
  especialidade: string | null;
};
type Convenio = { id: string; nome_fantasia: string; registro_ans: string | null };
type Plano = {
  id: string;
  convenio_id: string;
  nome: string;
  codigo: string | null;
  carteirinha_mascara: string | null;
  carteirinha_regex: string | null;
  exige_validade_carteirinha: boolean;
};
type Tipo = { codigo: string; descricao: string };
type AnsDomain = { tabela: number; codigo: string; display: string; versao: string; canonical: string };
type Beneficio = {
  id: string;
  convenio_id: string;
  plano_id: string;
  numero_carteirinha: string;
  validade_carteirinha: string | null;
  elegibilidade_status: string | null;
  elegibilidade_verificada_em: string | null;
  elegibilidade_protocolo: string | null;
  elegibilidade_mensagem: string | null;
};
type ReturnInfo = { alerta?: boolean; atendimento_id?: string; data_atendimento?: string; dias?: number; especialidade?: string; motivo?: string };

type Props = {
  action: (formData: FormData) => void | Promise<void>;
  empresaId: string;
  unidadeId: string;
  unitCnes?: string | null;
  serverNow: string;
  initialPatient: AdmissionPatient | null;
  profissionais: Profissional[];
  convenios: Convenio[];
  planos: Plano[];
  tipos: Tipo[];
  tiposAtendimentoAns: AnsDomain[];
  tiposConsultaAns: AnsDomain[];
  initialProfissionalId?: string | null;
  initialCoverage?: "particular" | "convenio";
  initialConvenioId?: string | null;
  initialPlanoId?: string | null;
  initialTipoAtendimento?: string | null;
  initialOrigem?: string | null;
  cancelHref?: string;
  createPatientHref?: string | null;
  submitLabel?: string;
};

function defaultRegime(tipo: string | null | undefined) {
  const value = String(tipo ?? "").toLowerCase();
  if (value.includes("urg") || value.includes("emerg") || value.includes("pronto")) return "pronto_socorro";
  if (value.includes("intern")) return "internacao";
  if (value.includes("tele")) return "telessaude";
  return "ambulatorial";
}

function tipoAnsPorRegime(regime: string) {
  if (regime === "pronto_socorro") return "11";
  if (regime === "internacao") return "07";
  if (regime === "telessaude") return "22";
  return "04";
}

function tipoAnsPorOperacao(tipo: string, regime: string) {
  if (tipo === "consulta") return tipoAnsPorRegime(regime);
  if (tipo === "pequena_cirurgia") return "02";
  if (tipo === "sessao_terapia") return "03";
  if (tipo === "internacao") return "07";
  // SADT/exames é propositalmente não inferido: Tabela 50 distingue 05 e 23.
  return "";
}

function expired(value: string) {
  if (!value) return false;
  const today = new Date();
  const local = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  return value < local;
}

function beep() {
  try {
    const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const context = new AudioContextClass();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.frequency.value = 740;
    gain.gain.value = 0.04;
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.13);
    oscillator.addEventListener("ended", () => void context.close());
  } catch {
    // Navegadores podem bloquear áudio até existir interação explícita.
  }
}

export function AdmissionForm({
  action,
  empresaId,
  unidadeId,
  unitCnes,
  serverNow,
  initialPatient,
  profissionais,
  convenios,
  planos,
  tipos,
  tiposAtendimentoAns,
  tiposConsultaAns,
  initialProfissionalId = null,
  initialCoverage = "particular",
  initialConvenioId = null,
  initialPlanoId = null,
  initialTipoAtendimento = null,
  initialOrigem = null,
  cancelHref = "/atendimentos",
  createPatientHref = null,
  submitLabel = "Abrir atendimento",
}: Props) {
  const supabase = useMemo(() => createClient(), []);
  const initialRegime = defaultRegime(initialTipoAtendimento);
  const [patient, setPatient] = useState<AdmissionPatient | null>(initialPatient);
  const patientId = patient?.id ?? "";
  const [coverage, setCoverage] = useState<"particular" | "convenio">(initialCoverage);
  const [convenioId, setConvenioId] = useState(initialConvenioId ?? "");
  const [planoId, setPlanoId] = useState(initialPlanoId ?? "");
  const [card, setCard] = useState("");
  const [cardValidity, setCardValidity] = useState("");
  const [benefit, setBenefit] = useState<Beneficio | null>(null);
  const [benefitMessage, setBenefitMessage] = useState<string | null>(null);
  const [alerts, setAlerts] = useState<string[]>([]);
  const [atendimentoRn, setAtendimentoRn] = useState(false);
  const [identificacaoMetodo, setIdentificacaoMetodo] = useState<"biometria_digital" | "token">("biometria_digital");
  const [profissionalId, setProfissionalId] = useState(initialProfissionalId ?? "");
  const [returnInfo, setReturnInfo] = useState<ReturnInfo | null>(null);
  const [regime, setRegime] = useState(initialRegime);
  const [tipoTiss, setTipoTiss] = useState("consulta");
  const [tipoAns50, setTipoAns50] = useState(tipoAnsPorRegime(initialRegime));
  const [tipoConsultaAns52, setTipoConsultaAns52] = useState("");
  const [indicacao, setIndicacao] = useState("");
  const [eligibilityMessage, setEligibilityMessage] = useState<string | null>(null);
  const planosFiltrados = useMemo(() => planos.filter((item) => item.convenio_id === convenioId), [planos, convenioId]);
  const selectedPlan = planos.find((item) => item.id === planoId) ?? null;
  const selectedProfessional = profissionais.find((item) => item.id === profissionalId) ?? null;
  const selectedAns50 = tiposAtendimentoAns.find((item) => item.codigo === tipoAns50) ?? null;
  const isExpired = expired(cardValidity);
  const indicationRequired = ["sadt_exames", "pequena_cirurgia", "sessao_terapia"].includes(tipoTiss);
  const ansReady = coverage !== "convenio" || Boolean(tipoAns50 && (tipoAns50 !== "04" || tipoConsultaAns52));
  const suggestedCode = tipoTiss === "consulta" && regime === "ambulatorial" ? "10101012" : tipoTiss === "consulta" && regime === "pronto_socorro" ? "10101039" : null;
  const suggestedDescription = suggestedCode === "10101012" ? "Consulta em consultório (no horário normal ou preestabelecido)" : suggestedCode === "10101039" ? "Consulta em pronto socorro" : null;
  const ansVersion = tiposAtendimentoAns[0]?.versao ?? tiposConsultaAns[0]?.versao ?? null;

  useEffect(() => {
    if (!patientId) {
      setAlerts([]);
      setBenefit(null);
      return;
    }
    let active = true;
    void Promise.all([
      supabase.from("paciente_convenios")
        .select("id,convenio_id,plano_id,numero_carteirinha,validade_carteirinha,elegibilidade_status,elegibilidade_verificada_em,elegibilidade_protocolo,elegibilidade_mensagem")
        .eq("empresa_id", empresaId).eq("paciente_id", patientId).eq("ativo", true)
        .order("principal", { ascending: false }).order("created_at", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("paciente_alertas").select("descricao,severidade")
        .eq("empresa_id", empresaId).eq("paciente_id", patientId).eq("ativo", true).order("severidade"),
      supabase.from("paciente_alergias").select("substancia,reacao,gravidade")
        .eq("empresa_id", empresaId).eq("paciente_id", patientId).eq("status", "ativa"),
    ]).then(([benefitResult, alertResult, allergyResult]) => {
      if (!active) return;
      const mainBenefit = benefitResult.data as Beneficio | null;
      setBenefit(mainBenefit);
      const alertTexts = [
        ...(alertResult.data ?? []).map((item) => String(item.descricao)),
        ...(allergyResult.data ?? []).map((item) => `ALERGIA: ${item.substancia}${item.reacao ? ` · ${item.reacao}` : ""}`),
      ];
      setAlerts(alertTexts);
      if (mainBenefit) {
        const canApply = !initialConvenioId || initialConvenioId === mainBenefit.convenio_id;
        if (canApply) {
          setCoverage("convenio");
          setConvenioId(initialConvenioId ?? mainBenefit.convenio_id);
          setPlanoId(initialPlanoId ?? mainBenefit.plano_id);
          setCard(mainBenefit.numero_carteirinha ?? "");
          setCardValidity(mainBenefit.validade_carteirinha ?? "");
          setBenefitMessage("Vínculo principal do cadastro carregado automaticamente.");
        }
      }
    });
    return () => { active = false; };
  }, [empresaId, initialConvenioId, initialPlanoId, patientId, supabase]);

  useEffect(() => {
    if (!patientId || !profissionalId) {
      setReturnInfo(null);
      return;
    }
    let active = true;
    const timer = window.setTimeout(async () => {
      const { data, error } = await supabase.rpc("verificar_retorno_30_dias", {
        p_paciente_id: patientId,
        p_profissional_id: profissionalId,
        p_unidade_id: unidadeId,
      });
      if (!active) return;
      if (error) setReturnInfo(null);
      else setReturnInfo((data ?? null) as ReturnInfo | null);
    }, 180);
    return () => { active = false; window.clearTimeout(timer); };
  }, [patientId, profissionalId, supabase, unidadeId]);

  async function checkEligibility() {
    setEligibilityMessage("Consultando configuração da operadora…");
    if (!patientId || !convenioId) {
      setEligibilityMessage("Selecione paciente e convênio primeiro.");
      return;
    }
    const { data: config } = await supabase.from("tiss_webservice_configuracoes")
      .select("id,endpoint_url,ambiente,ativo")
      .eq("empresa_id", empresaId).eq("convenio_id", convenioId).eq("ativo", true)
      .or(`unidade_id.is.null,unidade_id.eq.${unidadeId}`).limit(1).maybeSingle();
    if (!config?.endpoint_url) {
      setEligibilityMessage("Elegibilidade online indisponível: Webservice da operadora ainda não configurado para esta unidade.");
      return;
    }
    if (benefit?.elegibilidade_verificada_em) {
      const when = new Date(benefit.elegibilidade_verificada_em).toLocaleString("pt-BR");
      setEligibilityMessage(`Última elegibilidade: ${benefit.elegibilidade_status ?? "sem status"} em ${when}${benefit.elegibilidade_protocolo ? ` · protocolo ${benefit.elegibilidade_protocolo}` : ""}.`);
      return;
    }
    setEligibilityMessage("Canal TISS configurado. A operação específica de elegibilidade da operadora precisa estar parametrizada para executar a consulta online sem simular resposta.");
  }

  const dadosPaciente = <div className="space-y-5">
    <PatientRemotePicker empresaId={empresaId} value={patient} onChange={setPatient} />
    {!patient && createPatientHref ? <div className="flex flex-col gap-2 rounded-2xl border border-violet-200 bg-violet-50 p-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-semibold text-violet-900">Paciente ainda não cadastrado?</p><p className="mt-1 text-xs text-violet-700">Cadastre agora e o sistema voltará automaticamente para esta mesma admissão.</p></div><a href={createPatientHref} className="btn-secondary shrink-0"><UserPlus className="size-4" />Cadastrar paciente</a></div> : null}
    {alerts.length ? <div className="rounded-2xl border border-rose-300 bg-rose-50 p-4"><div className="flex items-center gap-2 text-sm font-black text-rose-900"><ShieldAlert className="size-4" />Alertas do paciente</div><ul className="mt-2 space-y-1 text-xs font-semibold text-rose-800">{alerts.slice(0, 8).map((item, index) => <li key={`${item}-${index}`}>• {item}</li>)}</ul></div> : null}
    <input type="hidden" name="paciente_id" value={patientId} />
    <input type="hidden" name="paciente_nome_social" value={patient?.nome_social ?? ""} />
    <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
      <label className="space-y-2 text-sm font-medium text-slate-700 md:col-span-2"><span>Nome de registro *</span><input name="paciente_nome" defaultValue={patient?.nome_completo ?? ""} key={`nome-${patientId}`} className="ui-input" readOnly /></label>
      <label className="space-y-2 text-sm font-medium text-slate-700"><span>Nome social</span><input value={patient?.nome_social ?? ""} className="ui-input bg-slate-50" readOnly /></label>
      <label className="space-y-2 text-sm font-medium text-slate-700"><span>CPF</span><MaskedInput name="paciente_cpf" mask="cpf" defaultValue={patient?.cpf ?? ""} key={`cpf-${patientId}`} readOnly /></label>
      <label className="space-y-2 text-sm font-medium text-slate-700"><span>RG</span><input name="paciente_rg" defaultValue={patient?.rg ?? ""} key={`rg-${patientId}`} className="ui-input bg-slate-50" readOnly /></label>
      <label className="space-y-2 text-sm font-medium text-slate-700"><span>CNS</span><input name="paciente_cns" defaultValue={patient?.cns ?? ""} key={`cns-${patientId}`} maxLength={15} className="ui-input bg-slate-50" readOnly /></label>
      <label className="space-y-2 text-sm font-medium text-slate-700"><span>Data de nascimento *</span><input name="paciente_data_nascimento" type="date" defaultValue={patient?.data_nascimento ?? ""} key={`nasc-${patientId}`} className="ui-input bg-slate-50" readOnly /></label>
      <input type="hidden" name="paciente_nacionalidade" value={patient?.nacionalidade ?? ""} />
      <input type="hidden" name="paciente_estado_civil" value={patient?.estado_civil ?? ""} />
      <input type="hidden" name="paciente_sexo" value={patient?.sexo ?? "nao_informado"} />
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
    <label className="space-y-2 text-sm font-medium text-slate-700"><span>UF *</span><input name="paciente_estado" maxLength={2} defaultValue={patient?.uf ?? ""} key={`uf-${patientId}`} className="ui-input uppercase" /></label>
  </div>;

  const cobertura = <div className="space-y-5">
    <div className="grid gap-3 sm:grid-cols-2">{(["particular", "convenio"] as const).map((tipo) => <label key={tipo} className={`cursor-pointer rounded-2xl border p-4 transition ${coverage === tipo ? "border-brand-300 bg-brand-50" : "border-slate-200 bg-white"}`}><input type="radio" name="cobertura" value={tipo} checked={coverage === tipo} onChange={() => { setCoverage(tipo); if (tipo === "particular") { setAtendimentoRn(false); setConvenioId(""); setPlanoId(""); setCard(""); setCardValidity(""); } }} className="mr-2 accent-brand-700" /><span className="font-semibold text-slate-900">{tipo === "particular" ? "Particular" : "Convênio"}</span></label>)}</div>
    {coverage === "convenio" ? <>
      {benefitMessage ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-semibold text-emerald-800"><BadgeCheck className="mr-1 inline size-4" />{benefitMessage}</div> : null}
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        <label className="space-y-2 text-sm font-medium text-slate-700"><span>Operadora *</span><select name="convenio_id" value={convenioId} onChange={(event) => { setConvenioId(event.target.value); setPlanoId(""); setCard(""); setCardValidity(""); }} className="ui-input"><option value="">Selecione</option>{convenios.map((item) => <option key={item.id} value={item.id}>{item.nome_fantasia}{item.registro_ans ? ` · ANS ${item.registro_ans}` : ""}</option>)}</select></label>
        <label className="space-y-2 text-sm font-medium text-slate-700"><span>Plano / produto *</span><select name="plano_id" value={planoId} onChange={(event) => setPlanoId(event.target.value)} className="ui-input"><option value="">Selecione</option>{planosFiltrados.map((item) => <option key={item.id} value={item.id}>{item.nome}{item.codigo ? ` · ${item.codigo}` : ""}</option>)}</select></label>
        <label className="space-y-2 text-sm font-medium text-slate-700"><span>Carteirinha *</span><input name="numero_carteirinha" value={card} onChange={(event) => setCard(event.target.value)} placeholder={selectedPlan?.carteirinha_mascara ?? "Conforme operadora"} className="ui-input" /></label>
        <label className="space-y-2 text-sm font-medium text-slate-700"><span>Validade da carteirinha{selectedPlan?.exige_validade_carteirinha ? " *" : ""}</span><input name="validade_carteirinha" type="date" value={cardValidity} onChange={(event) => setCardValidity(event.target.value)} required={Boolean(selectedPlan?.exige_validade_carteirinha)} className={`ui-input ${isExpired ? "border-rose-500 bg-rose-50 text-rose-800" : ""}`} />{isExpired ? <span className="block text-xs font-bold text-rose-700">Carteirinha vencida. A abertura será bloqueada.</span> : null}</label>
        <label className="space-y-2 text-sm font-medium text-slate-700"><span>Nº guia/autorização da operadora</span><input name="numero_autorizacao" className="ui-input" /></label>
        <label className="space-y-2 text-sm font-medium text-slate-700"><span>Senha de autorização</span><input name="senha_autorizacao" className="ui-input" /></label>
      </div>
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-sky-200 bg-sky-50 p-4"><button type="button" onClick={() => void checkEligibility()} className="btn-secondary">Checar elegibilidade</button><p className="min-w-0 flex-1 text-xs text-sky-900">{eligibilityMessage ?? benefit?.elegibilidade_mensagem ?? "Verifique a elegibilidade antes do atendimento quando a operadora possuir integração configurada."}</p></div>
      <div className="rounded-2xl border border-violet-200 bg-violet-50/60 p-4">
        <div className="flex items-start gap-3"><Fingerprint className="mt-0.5 size-5 shrink-0 text-violet-700"/><div><h3 className="font-semibold text-violet-950">Token / biometria da operadora</h3><p className="mt-1 text-xs leading-5 text-violet-800">A referência é armazenada apenas como hash; token e biometria não ficam em texto puro.</p></div></div>
        <div className="mt-4 grid gap-3 md:grid-cols-3"><label className="space-y-2 text-sm font-medium text-slate-700"><span>Método</span><select name="identificacao_metodo" value={identificacaoMetodo} onChange={(event)=>setIdentificacaoMetodo(event.target.value as "biometria_digital"|"token")} className="ui-input"><option value="biometria_digital">Biometria digital</option><option value="token">Token da operadora</option></select></label><label className="space-y-2 text-sm font-medium text-slate-700 md:col-span-2"><span>{identificacaoMetodo === "token" ? "Token dinâmico" : "Referência do leitor / SDK"}</span><span className="relative block"><KeyRound className="pointer-events-none absolute left-3 top-3 size-4 text-slate-400"/><input name="identificacao_referencia" type="password" autoComplete="off" className="ui-input pl-9" /></span></label><label className="space-y-2 text-sm font-medium text-slate-700 md:col-span-3"><span>Dispositivo (opcional)</span><input name="identificacao_dispositivo" className="ui-input" /></label></div>
      </div>
      <label className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition ${atendimentoRn ? "border-brand-300 bg-brand-50" : "border-slate-200 bg-slate-50/70"}`}><input type="checkbox" name="atendimento_rn" value="true" checked={atendimentoRn} onChange={(event) => setAtendimentoRn(event.target.checked)} className="mt-0.5 size-4 accent-brand-700" /><span><span className="block text-sm font-semibold text-slate-900">Atendimento a RN (TISS)</span><span className="mt-1 block text-xs text-slate-500">Use quando o recém-nato utilizar o contrato/carteirinha do responsável.</span></span></label>
    </> : <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-600">Cobertura particular: dados de operadora e autorização não serão exigidos.</div>}
  </div>;

  const profissional = <div className="space-y-5">
    <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
      <label className="space-y-2 text-sm font-medium text-slate-700"><span>Profissional responsável{coverage === "convenio" ? " *" : ""}</span><select name="profissional_id" value={profissionalId} onChange={(event) => { setProfissionalId(event.target.value); if (event.target.value) beep(); }} className="ui-input"><option value="">A definir</option>{profissionais.map((item) => <option key={item.id} value={item.id}>{item.nome_completo}</option>)}</select></label>
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm"><p className="text-xs font-bold uppercase tracking-wide text-slate-400">Conselho</p><p className="mt-1 font-semibold text-slate-800">{selectedProfessional ? `${selectedProfessional.conselho ?? "—"} ${selectedProfessional.numero_conselho ?? "—"} / ${selectedProfessional.uf_conselho ?? "—"}` : "Selecione o profissional"}</p></div>
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm"><p className="text-xs font-bold uppercase tracking-wide text-slate-400">CBO / Especialidade</p><p className="mt-1 font-semibold text-slate-800">{selectedProfessional ? `${selectedProfessional.cbo ?? "CBO ausente"} · ${selectedProfessional.especialidade ?? "Especialidade não informada"}` : "—"}</p></div>
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm"><p className="text-xs font-bold uppercase tracking-wide text-slate-400">CNES da unidade</p><p className={`mt-1 font-semibold ${unitCnes ? "text-slate-800" : "text-rose-700"}`}>{unitCnes ?? "CNES não cadastrado"}</p></div>
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm"><p className="text-xs font-bold uppercase tracking-wide text-slate-400">Nº guia do prestador</p><p className="mt-1 font-semibold text-slate-800">Gerado automaticamente e imutável ao salvar</p></div>
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm"><p className="text-xs font-bold uppercase tracking-wide text-slate-400">Início do atendimento</p><p className="mt-1 font-semibold text-slate-800">{new Date(serverNow).toLocaleString("pt-BR")} · horário do servidor</p></div>
    </div>
    {coverage === "convenio" && selectedProfessional && (!selectedProfessional.cbo || !selectedProfessional.conselho || !selectedProfessional.numero_conselho || !selectedProfessional.uf_conselho) ? <div className="rounded-xl border border-rose-300 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800"><AlertTriangle className="mr-1 inline size-4" />Cadastro profissional incompleto para TISS. Corrija conselho/UF/CBO antes da abertura.</div> : null}
    {returnInfo?.alerta ? <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4"><div className="flex items-start gap-3"><AlertTriangle className="mt-0.5 size-5 text-amber-700"/><div><p className="font-black text-amber-950">Possível retorno em até 30 dias</p><p className="mt-1 text-sm text-amber-800">Há atendimento há {returnInfo.dias ?? "?"} dia(s) na especialidade {returnInfo.especialidade ?? "selecionada"}. A operadora pode tratar a nova cobrança como retorno.</p></div></div></div> : null}
  </div>;

  const faturamento = <div className="space-y-5">
    <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-sm font-black text-emerald-950">Domínios regulatórios ANS / FHIR</p><p className="mt-1 text-xs text-emerald-800">O código e a versão são gravados como snapshot no episódio e seguem para a guia TISS.</p></div>{ansVersion ? <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-emerald-800">ANS {ansVersion}</span> : null}</div>
    </div>
    <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
      <label className="space-y-2 text-sm font-medium text-slate-700"><span>Regime de atendimento *</span><select name="regime_atendimento" value={regime} onChange={(event) => { const next=event.target.value; setRegime(next); if (tipoTiss === "consulta") { const codigo=tipoAnsPorRegime(next); setTipoAns50(codigo); if (codigo !== "04") setTipoConsultaAns52(""); } }} className="ui-input"><option value="ambulatorial">Ambulatorial</option><option value="pronto_socorro">Pronto Socorro</option><option value="internacao">Internação</option><option value="telessaude">Telessaúde</option></select></label>
      <label className="space-y-2 text-sm font-medium text-slate-700"><span>Classificação operacional / cobrança *</span><select name="tipo_atendimento_tiss" value={tipoTiss} onChange={(event) => { const next=event.target.value; setTipoTiss(next); const codigo=tipoAnsPorOperacao(next,regime); setTipoAns50(codigo); if (codigo !== "04") setTipoConsultaAns52(""); }} className="ui-input"><option value="consulta">Consulta</option><option value="sadt_exames">SADT / Exames</option><option value="pequena_cirurgia">Pequena cirurgia</option><option value="sessao_terapia">Sessão de terapia</option><option value="internacao">Internação</option><option value="outro">Outro</option></select></label>
      <label className="space-y-2 text-sm font-medium text-slate-700"><span>Classificação interna *</span><select name="tipo_atendimento" defaultValue={initialTipoAtendimento ?? ""} className="ui-input"><option value="">Selecione</option>{tipos.length ? tipos.map((item) => <option key={item.codigo} value={item.codigo}>{item.descricao}</option>) : <><option value="ambulatorial">Ambulatorial</option><option value="urgencia">Urgência / Emergência</option><option value="internacao">Internação</option><option value="sadt">SADT</option></>}</select></label>
      <label className="space-y-2 text-sm font-medium text-slate-700 xl:col-span-2"><span>Tipo de atendimento ANS · Tabela 50{coverage === "convenio" ? " *" : ""}</span><select name="tipo_atendimento_tuss50_codigo" value={tipoAns50} onChange={(event) => { setTipoAns50(event.target.value); if (event.target.value !== "04") setTipoConsultaAns52(""); }} className="ui-input"><option value="">Selecione o código oficial</option>{tiposAtendimentoAns.map((item) => <option key={item.codigo} value={item.codigo}>{item.codigo} — {item.display}</option>)}</select>{tipoTiss === "sadt_exames" && !tipoAns50 ? <span className="block text-xs font-semibold text-amber-700">Escolha 05 “Exame Ambulatorial” ou 23 “Exame” conforme a regra do atendimento; o sistema não presume esta diferença.</span> : null}</label>
      {tipoAns50 === "04" ? <label className="space-y-2 text-sm font-medium text-slate-700"><span>Tipo de consulta ANS · Tabela 52{coverage === "convenio" ? " *" : ""}</span><select name="tipo_consulta_tuss52_codigo" value={tipoConsultaAns52} onChange={(event) => setTipoConsultaAns52(event.target.value)} className="ui-input"><option value="">Selecione</option>{tiposConsultaAns.map((item) => <option key={item.codigo} value={item.codigo}>{item.codigo} — {item.display}</option>)}</select></label> : <input type="hidden" name="tipo_consulta_tuss52_codigo" value="" />}
      {selectedAns50 ? <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600"><p className="font-bold text-slate-800">Tabela 50 · {selectedAns50.codigo}</p><p className="mt-1">{selectedAns50.display}</p><p className="mt-1 text-slate-400">Versão {selectedAns50.versao}</p></div> : null}
      <TussProcedurePicker key={`${regime}-${tipoTiss}`} empresaId={empresaId} suggestedCode={suggestedCode} suggestedDescription={suggestedDescription} />
      <label className="space-y-2 text-sm font-medium text-slate-700 md:col-span-2 xl:col-span-3"><span>Modelo de indicação clínica</span><select className="ui-input" value="" onChange={(event) => { if (event.target.value) setIndicacao(event.target.value); }}><option value="">Selecionar modelo rápido…</option><option value="Para controle evolutivo de patologia crônica.">Controle evolutivo de patologia crônica</option><option value="Para investigação diagnóstica conforme quadro clínico apresentado.">Investigação diagnóstica</option><option value="Para continuidade de plano terapêutico previamente estabelecido.">Continuidade de plano terapêutico</option></select></label>
      <label className="space-y-2 text-sm font-medium text-slate-700 md:col-span-2 xl:col-span-3"><span>Indicação clínica / justificativa{indicationRequired ? " *" : ""}</span><textarea name="indicacao_clinica" value={indicacao} onChange={(event) => setIndicacao(event.target.value)} required={indicationRequired} rows={4} className="ui-input" placeholder={indicationRequired ? "Obrigatória para este tipo de atendimento." : "Opcional para consulta simples; informe quando clinicamente pertinente."} /></label>
      <label className="space-y-2 text-sm font-medium text-slate-700"><span>Origem</span><select name="origem" defaultValue={initialOrigem ?? ""} className="ui-input"><option value="">Selecione</option><option value="agenda">Agenda</option><option value="demanda_espontanea">Demanda espontânea</option><option value="transferencia">Transferência</option><option value="referencia">Referência</option></select></label>
      <label className="space-y-2 text-sm font-medium text-slate-700 md:col-span-2"><span>Observações administrativas</span><textarea name="observacoes" rows={3} className="ui-input" /></label>
      <AdmissionAttachments />
    </div>
  </div>;

  return <form noValidate action={action} className="ui-card p-5 sm:p-6">
    <div className="mb-5 grid gap-3 md:grid-cols-3"><div className="rounded-xl border border-brand-100 bg-brand-50 p-3"><UserPlus className="size-4 text-brand-700"/><p className="mt-1 text-xs font-bold text-brand-900">1. Paciente</p><p className="text-[11px] text-brand-700">Identificação e alertas</p></div><div className="rounded-xl border border-indigo-100 bg-indigo-50 p-3"><Building2 className="size-4 text-indigo-700"/><p className="mt-1 text-xs font-bold text-indigo-900">2. Cobertura</p><p className="text-[11px] text-indigo-700">Plano, carteira e autorização</p></div><div className="rounded-xl border border-emerald-100 bg-emerald-50 p-3"><Stethoscope className="size-4 text-emerald-700"/><p className="mt-1 text-xs font-bold text-emerald-900">3. TISS</p><p className="text-[11px] text-emerald-700">Profissional, TUSS e antiglosa</p></div></div>
    <FormTabs tabs={[{ id: "paciente", label: "Paciente", content: dadosPaciente }, { id: "endereco", label: "Endereço", content: endereco }, { id: "cobertura", label: "Cobertura / Autorização", content: cobertura }, { id: "profissional", label: "Profissional", content: profissional }, { id: "faturamento", label: "TISS / Faturamento", content: faturamento }]} />
    <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-5"><div className="flex items-center gap-2 text-xs text-slate-500"><Clock3 className="size-4" />Dados regulatórios serão fotografados no momento da abertura.</div><div className="flex gap-3"><a href={cancelHref} className="btn-secondary">Cancelar</a><button disabled={!patient || isExpired || !ansReady} className="ui-button-primary disabled:cursor-not-allowed disabled:opacity-50">{submitLabel}</button></div></div>
  </form>;
}
