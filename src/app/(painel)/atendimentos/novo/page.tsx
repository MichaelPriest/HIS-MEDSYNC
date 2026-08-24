import { redirect } from "next/navigation";
import { AdmissionForm } from "@/components/atendimentos/admission-form";
import type { AdmissionPatient } from "@/components/atendimentos/patient-remote-picker";
import { SectionPage } from "@/components/painel/section-page";
import { abrirAtendimento } from "@/modules/atendimentos/actions";
import { getAssistencialContext } from "@/modules/assistencial/context";

const PATIENT_SELECT = "id,nome_completo,cpf,rg,cns,data_nascimento,nacionalidade,estado_civil,sexo,telefone,email,cep,logradouro,numero,complemento,bairro,cidade,uf,ra,numero_registro";

const ERROS: Record<string, string> = {
  "campos-obrigatorios": "Preencha os campos obrigatórios do paciente e do atendimento.",
  cobertura: "Revise o convênio, plano e os dados da carteirinha.",
  paciente: "O paciente selecionado não está mais disponível para esta admissão.",
  profissional: "O profissional selecionado não está disponível para esta unidade/empresa.",
  permissao: "Seu perfil não possui permissão para abrir atendimentos nesta unidade.",
  "senha-invalida": "Esta senha não está mais disponível para admissão. Ela pode ter sido processada por outro guichê.",
  "falha-cadastro": "Não foi possível concluir a admissão. Nenhuma etapa parcial foi mantida; tente novamente.",
};

export default async function NovoAtendimentoPage({ searchParams }: { searchParams: Promise<{ erro?: string; senha?: string }> }) {
  const { erro, senha: senhaId } = await searchParams;
  const { supabase, empresaId, unidadeId } = await getAssistencialContext();
  if (!senhaId) redirect("/senhas?erro=senha-obrigatoria");

  const { data: senha, error: senhaError } = await supabase
    .from("senhas_atendimento")
    .select("id,senha,status,ponto_atendimento,atendimento_id,paciente_id")
    .eq("id", senhaId)
    .eq("unidade_id", unidadeId)
    .maybeSingle();

  if (senhaError) {
    console.error("[admissao] falha ao validar senha", { code: senhaError.code });
  }
  if (!senha || senha.atendimento_id || senha.status !== "em_atendimento") redirect("/senhas?erro=senha-invalida");

  const pacienteInicialPromise = senha.paciente_id
    ? supabase
        .from("pacientes")
        .select(PATIENT_SELECT)
        .eq("id", senha.paciente_id)
        .eq("empresa_id", empresaId)
        .eq("ativo", true)
        .maybeSingle()
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

  if (pacienteInicialError) {
    console.error("[admissao] falha ao carregar paciente identificado no totem", { code: pacienteInicialError.code });
  }

  const action = abrirAtendimento.bind(null, senhaId);
  const mensagemErro = erro ? ERROS[erro] ?? ERROS["falha-cadastro"] : null;
  const initialPatient = (pacienteInicial ?? null) as AdmissionPatient | null;

  return <SectionPage eyebrow="Recepção / Admissão" title={`Abrir atendimento · Senha ${senha.senha}`} description={`Admissão obrigatoriamente vinculada à senha do totem${senha.ponto_atendimento ? ` · ${senha.ponto_atendimento}` : ""}.`}>
    {mensagemErro ? <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{mensagemErro}</div> : null}
    <div className="mb-4 rounded-2xl border border-brand-100 bg-brand-50 p-4 text-sm text-brand-950">
      <strong>Senha {senha.senha}</strong> validada. {initialPatient ? "O paciente identificado no Totem já foi selecionado automaticamente." : "Pesquise o paciente por nome, CPF, RA ou número de registro."}
    </div>
    <AdmissionForm
      action={action}
      empresaId={empresaId}
      initialPatient={initialPatient}
      profissionais={profissionais ?? []}
      convenios={convenios ?? []}
      planos={planos ?? []}
      tipos={tipos ?? []}
    />
  </SectionPage>;
}
