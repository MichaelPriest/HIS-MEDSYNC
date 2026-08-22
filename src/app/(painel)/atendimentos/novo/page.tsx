import { AdmissionForm } from "@/components/atendimentos/admission-form";
import { SectionPage } from "@/components/painel/section-page";
import { createClient } from "@/lib/supabase/server";
import { abrirAtendimento } from "@/modules/atendimentos/actions";

// Mantém a consulta alinhada ao tipo Patient usado pelo formulário de admissão.
export default async function NovoAtendimentoPage({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const { erro } = await searchParams;
  const supabase = await createClient();
  const [{ data: pacientes }, { data: profissionais }, { data: tipos }, { data: convenios }, { data: planos }] = await Promise.all([
    supabase.from("pacientes").select("id,nome_completo,cpf,rg,cns,data_nascimento,nacionalidade,estado_civil,sexo,telefone,email,cep,logradouro,numero,complemento,bairro,cidade,uf,ra,numero_registro").eq("ativo", true).order("nome_completo").limit(1000),
    supabase.from("profissionais").select("id,nome_completo").eq("ativo", true).order("nome_completo").limit(500),
    supabase.from("catalogos").select("codigo,descricao").eq("ativo", true).eq("tipo", "tipo_atendimento").order("descricao"),
    supabase.from("convenios").select("id,nome_fantasia,registro_ans").eq("ativo", true).order("nome_fantasia"),
    supabase.from("convenio_planos").select("id,convenio_id,nome,codigo").eq("ativo", true).order("nome"),
  ]);

  return <SectionPage eyebrow="Assistencial / Atendimento / Novo" title="Abrir atendimento" description="Admissão completa com confirmação dos dados civis, endereço, cobertura particular/convênio e dados do episódio assistencial.">
    {erro ? <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">Não foi possível abrir o atendimento. Revise os campos obrigatórios, a cobertura e suas permissões.</div> : null}
    <AdmissionForm action={abrirAtendimento} patients={pacientes ?? []} profissionais={profissionais ?? []} convenios={convenios ?? []} planos={planos ?? []} tipos={tipos ?? []} />
  </SectionPage>;
}
