import { redirect } from "next/navigation";
import { AdmissionForm } from "@/components/atendimentos/admission-form";
import type { AdmissionPatient } from "@/components/atendimentos/patient-remote-picker";
import { SectionPage } from "@/components/painel/section-page";
import { abrirAtendimento, abrirAtendimentoAgendado } from "@/modules/atendimentos/actions";
import { getAssistencialContext } from "@/modules/assistencial/context";

const PATIENT_SELECT = "id,nome_completo,cpf,rg,cns,data_nascimento,nacionalidade,estado_civil,sexo,telefone,email,cep,logradouro,numero,complemento,bairro,cidade,uf,ra,numero_registro";

const ERROS: Record<string, string> = {
  "campos-obrigatorios": "Preencha os campos obrigatórios do paciente e do atendimento.",
  cobertura: "Revise o convênio, plano e os dados da carteirinha.",
  paciente: "O paciente selecionado não está mais disponível para esta admissão.",
  profissional: "O profissional selecionado não está disponível para esta unidade/empresa.",
  permissao: "Seu perfil não possui permissão para abrir atendimentos nesta unidade.",
  "senha-invalida": "Esta senha não está mais disponível para admissão. Ela pode ter sido processada por outro guichê.",
  "agendamento-invalido": "Este agendamento não está mais disponível para abertura de atendimento. Verifique o check-in ou se ele já foi admitido.",
  "agendamento-cirurgico": "Cirurgia eletiva deve seguir pelo fluxo de pré-admissão/centro cirúrgico.",
  "identificacao-obrigatoria": "Este convênio exige biometria ou token para concluir a admissão. Informe a identificação do beneficiário na aba Particular / Convênio.",
  "falha-cadastro": "Não foi possível concluir a admissão. Nenhuma etapa parcial foi mantida; tente novamente.",
};

type Search = { erro?: string; senha?: string; agendamento?: string; paciente?: string; cadastro?: string };

type AgendaInicial = {
  id: string;
  status: string;
  cirurgia_eletiva: boolean;
  paciente_id: string;
  profissional_id: string | null;
  convenio_id: string | null;
  plano_id: string | null;
  tipo_atendimento: string | null;
  especialidade: string | null;
};

export default async function NovoAtendimentoPage({ searchParams }: { searchParams: Promise<Search> }) {
  const { erro, senha: senhaId, agendamento: agendamentoId, paciente: pacienteRetornoId, cadastro } = await searchParams;
  const { supabase, empresaId, unidadeId } = await getAssistencialContext();

  if ((!senhaId && !agendamentoId) || (senhaId && agendamentoId)) redirect("/atendimentos?erro=origem-admissao-invalida");

  let sourcePatientId: string | null = null;
  let senha: { id: string; senha: string; ponto_atendimento: string | null } | null = null;
  let agenda: AgendaInicial | null = null;

  if (senhaId) {
    const { data, error: senhaError } = await supabase
      .from("senhas_atendimento")
      .select("id,senha,status,ponto_atendimento,atendimento_id,paciente_id")
      .eq("id", senhaId)
      .eq("unidade_id", unidadeId)
      .maybeSingle();

    if (senhaError) console.error("[admissao] falha ao validar senha", { code: senhaError.code });
    if (!data || data.atendimento_id || data.status !== "em_atendimento") redirect("/senhas?erro=senha-invalida");
    senha = { id: data.id, senha: data.senha, ponto_atendimento: data.ponto_atendimento };
    sourcePatientId = data.paciente_id ?? pacienteRetornoId ?? null;
  } else if (agendamentoId) {
    const [{ data, error: agendaError }, { data: atendimentoExistente }] = await Promise.all([
      supabase
        .from("agendamentos")
        .select("id,status,cirurgia_eletiva,paciente_id,profissional_id,convenio_id,plano_id,tipo_atendimento,especialidade")
        .eq("id", agendamentoId)
        .eq("unidade_id", unidadeId)
        .maybeSingle(),
      supabase.from("atendimentos").select("id").eq("agendamento_id", agendamentoId).maybeSingle(),
    ]);

    if (agendaError) console.error("[admissao.agenda] falha ao validar agendamento", { code: agendaError.code });
    if (!data || data.status !== "checkin" || data.cirurgia_eletiva || atendimentoExistente) redirect("/agenda?erro=agendamento-invalido");
    agenda = data as AgendaInicial;
    sourcePatientId = data.paciente_id;
  }

  const pacienteInicialPromise = sourcePatientId
    ? supabase.from("pacientes").select(PATIENT_SELECT).eq("id", sourcePatientId).eq("empresa_id", empresaId).eq("ativo", true).maybeSingle()
    : Promise.resolve({ data: null, error: null });

  const [
    { data: pacienteInicial, error: pacienteInicialError },
    { data: profissionais },
    { data: tipos },
    { data: convenios },
    { data: planos },
  ] = await Promise.all([
    pacienteInicialPromise,
    supabase.from("profissionais").select("id,nome_completo").eq("empresa_id", empresaId).eq("ativo", true).order("nome_completo").limit(500),
    supabase.from("catalogos").select("codigo,descricao").eq("ativo", true).eq("tipo", "tipo_atendimento").order("descricao"),
    supabase.from("convenios").select("id,nome_fantasia,registro_ans").eq("empresa_id", empresaId).eq("ativo", true).order("nome_fantasia"),
    supabase.from("convenio_planos").select("id,convenio_id,nome,codigo").eq("empresa_id", empresaId).eq("ativo", true).order("nome"),
  ]);

  if (pacienteInicialError) console.error("[admissao] falha ao carregar paciente da origem", { code: pacienteInicialError.code });

  const initialPatient = (pacienteInicial ?? null) as AdmissionPatient | null;
  const mensagemErro = erro ? ERROS[erro] ?? ERROS["falha-cadastro"] : null;
  const isAgenda = Boolean(agenda && agendamentoId);
  const action = isAgenda && agendamentoId ? abrirAtendimentoAgendado.bind(null, agendamentoId) : abrirAtendimento.bind(null, String(senhaId));
  const title = isAgenda ? "Abrir atendimento agendado" : `Abrir atendimento · Senha ${senha?.senha ?? "—"}`;
  const description = isAgenda
    ? "Check-in confirmado na Agenda. Revise os dados administrativos e abra o episódio sem necessidade de senha do Totem."
    : `Admissão vinculada à senha do Totem${senha?.ponto_atendimento ? ` · ${senha.ponto_atendimento}` : ""}.`;
  const admissionReturn = senhaId ? `/atendimentos/novo?senha=${encodeURIComponent(senhaId)}` : null;
  const createPatientHref = admissionReturn ? `/pacientes/novo?retorno=${encodeURIComponent(admissionReturn)}` : null;

  return <SectionPage eyebrow={isAgenda ? "Agenda / Check-in / Admissão" : "Recepção / Admissão"} title={title} description={description}>
    {mensagemErro ? <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{mensagemErro}</div> : null}
    {cadastro === "parcial" ? <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">O paciente foi criado e já está selecionado, mas algum contato/endereço complementar não pôde ser salvo. Revise o cadastro depois da admissão.</div> : null}
    <div className="mb-4 rounded-2xl border border-brand-100 bg-brand-50 p-4 text-sm text-brand-950">
      {isAgenda ? <><strong>Check-in da Agenda validado.</strong> O paciente agendado está bloqueado para preservar o vínculo correto com RA/prontuário.</> : <><strong>Senha {senha?.senha}</strong> validada. {initialPatient ? (pacienteRetornoId && !senhaId ? "O paciente cadastrado foi selecionado automaticamente." : "O paciente está selecionado e a admissão pode continuar.") : "Pesquise o paciente por nome, CPF, RA ou número de registro; se ele ainda não existir, use “Cadastrar paciente”."}</>}
    </div>
    <AdmissionForm
      action={action}
      empresaId={empresaId}
      initialPatient={initialPatient}
      profissionais={profissionais ?? []}
      convenios={convenios ?? []}
      planos={planos ?? []}
      tipos={tipos ?? []}
      initialProfissionalId={agenda?.profissional_id ?? null}
      initialCoverage={agenda?.convenio_id ? "convenio" : "particular"}
      initialConvenioId={agenda?.convenio_id ?? null}
      initialPlanoId={agenda?.plano_id ?? null}
      initialTipoAtendimento={agenda?.tipo_atendimento ?? (isAgenda ? "ambulatorial" : null)}
      initialOrigem={isAgenda ? "agenda" : null}
      cancelHref={isAgenda ? "/agenda" : "/senhas"}
      createPatientHref={createPatientHref}
      submitLabel={isAgenda ? "Abrir atendimento agendado" : "Abrir atendimento"}
    />
  </SectionPage>;
}
