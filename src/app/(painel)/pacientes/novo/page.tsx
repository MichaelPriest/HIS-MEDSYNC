import { PatientRegistrationAdvanced } from "@/components/pacientes/patient-registration-advanced";
import { SectionPage } from "@/components/painel/section-page";
import { createClient } from "@/lib/supabase/server";
import { criarPaciente } from "@/modules/pacientes/actions";

const mensagens: Record<string, string> = {
  "sem-empresa": "Seu usuário não possui vínculo ativo com uma empresa.",
  "sem-permissao": "Seu perfil não possui a permissão pacientes.criar para esta empresa.",
  "falha-permissao": "Não foi possível validar suas permissões.",
  "campos-obrigatorios": "Preencha os campos obrigatórios do cadastro.",
  "nome-invalido": "O nome possui caracteres incompatíveis com o cadastro.",
  "cpf-invalido": "Informe um CPF válido.",
  "cns-invalido": "O CNS informado não passou na validação local de consistência.",
  "responsavel-obrigatorio": "Paciente menor de 18 anos: informe nome, CPF válido e parentesco do responsável.",
  "plano-invalido": "Revise a operadora, o plano e a carteirinha informados.",
  "dados-invalidos": "Um dos dados informados não é compatível com o cadastro atual.",
  "documento-duplicado": "Já existe paciente ativo com este CPF nesta empresa.",
  "falha-cadastro": "O banco recusou o cadastro do paciente. O erro técnico foi registrado no servidor.",
  "foto-tamanho": "A foto deve ter no máximo 5 MB.",
  "foto-formato": "Use uma foto JPG, PNG ou WEBP.",
  "foto-upload": "Não foi possível enviar a foto.",
};

function retornoSeguro(value?: string) {
  if (!value) return null;
  try {
    const url = new URL(value, "https://medsync.local");
    const senha = url.searchParams.get("senha");
    if (url.pathname !== "/atendimentos/novo" || !senha || !/^[0-9a-f-]{36}$/i.test(senha)) return null;
    return `/atendimentos/novo?senha=${encodeURIComponent(senha)}`;
  } catch {
    return null;
  }
}

export default async function NovoPacientePage({ searchParams }: { searchParams: Promise<{ erro?: string; retorno?: string }> }) {
  const { erro, retorno } = await searchParams;
  const retornoAdmissao = retornoSeguro(retorno);
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let empresaId: string | null = null;
  if (user) {
    const { data: vinculo } = await supabase.from("usuario_empresas").select("empresa_id").eq("usuario_id", user.id).eq("ativo", true).limit(1).maybeSingle();
    empresaId = vinculo?.empresa_id ?? null;
  }

  const [{ data: convenios }, { data: planos }] = empresaId ? await Promise.all([
    supabase.from("convenios").select("id,nome_fantasia,registro_ans").eq("empresa_id", empresaId).eq("ativo", true).order("nome_fantasia"),
    supabase.from("convenio_planos").select("id,convenio_id,nome,codigo,carteirinha_mascara,exige_validade_carteirinha").eq("empresa_id", empresaId).eq("ativo", true).order("nome"),
  ]) : [{ data: [] }, { data: [] }];

  return (
    <SectionPage
      eyebrow="Cadastros / Pacientes / Novo"
      title="Novo paciente"
      description={retornoAdmissao ? "Cadastre o beneficiário e retorne automaticamente para a admissão em andamento." : "Cadastro clínico-administrativo com dados regulatórios, plano, LGPD, responsável e alertas."}
    >
      <PatientRegistrationAdvanced
        action={criarPaciente}
        convenios={convenios ?? []}
        planos={planos ?? []}
        retornoAdmissao={retornoAdmissao}
        erro={erro ?? null}
        mensagemErro={erro ? mensagens[erro] ?? mensagens["falha-cadastro"] : null}
      />
    </SectionPage>
  );
}
