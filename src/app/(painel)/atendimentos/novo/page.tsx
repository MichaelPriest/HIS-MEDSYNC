import { redirect } from "next/navigation";
import { AdmissionForm } from "@/components/atendimentos/admission-form";
import { SectionPage } from "@/components/painel/section-page";
import { createClient } from "@/lib/supabase/server";
import { abrirAtendimento } from "@/modules/atendimentos/actions";
import { getAssistencialContext } from "@/modules/assistencial/context";

export default async function NovoAtendimentoPage({ searchParams }: { searchParams: Promise<{ erro?: string; senha?: string }> }) {
  const { erro, senha: senhaId } = await searchParams;
  const { unidadeId } = await getAssistencialContext();
  if (!senhaId) redirect("/senhas?erro=senha-obrigatoria");
  const supabase = await createClient();
  const { data: senha } = await supabase.from("senhas_atendimento").select("id,senha,status,ponto_atendimento,atendimento_id").eq("id", senhaId).eq("unidade_id", unidadeId).maybeSingle();
  if (!senha || senha.atendimento_id || senha.status !== "em_atendimento") redirect("/senhas?erro=senha-invalida");

  const [{ data: pacientes }, { data: profissionais }, { data: tipos }, { data: convenios }, { data: planos }] = await Promise.all([
    supabase.from("pacientes").select("id,nome_completo,cpf,rg,cns,data_nascimento,nacionalidade,estado_civil,sexo,telefone,email,cep,logradouro,numero,complemento,bairro,cidade,uf,ra,numero_registro").eq("ativo", true).order("nome_completo").limit(1000),
    supabase.from("profissionais").select("id,nome_completo").eq("ativo", true).order("nome_completo").limit(500),
    supabase.from("catalogos").select("codigo,descricao").eq("ativo", true).eq("tipo", "tipo_atendimento").order("descricao"),
    supabase.from("convenios").select("id,nome_fantasia,registro_ans").eq("ativo", true).order("nome_fantasia"),
    supabase.from("convenio_planos").select("id,convenio_id,nome,codigo").eq("ativo", true).order("nome"),
  ]);
  const action = abrirAtendimento.bind(null, senhaId);

  return <SectionPage eyebrow="Recepção / Admissão" title={`Abrir atendimento · Senha ${senha.senha}`} description={`Admissão obrigatoriamente vinculada à senha do totem${senha.ponto_atendimento ? ` · ${senha.ponto_atendimento}` : ""}.`}>
    {erro ? <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">Não foi possível abrir o atendimento. Revise os campos obrigatórios, a cobertura e suas permissões.</div> : null}
    <div className="mb-4 rounded-2xl border border-brand-100 bg-brand-50 p-4 text-sm text-brand-950"><strong>Senha {senha.senha}</strong> validada. Ao concluir a admissão, ela será vinculada ao paciente e ao número do atendimento.</div>
    <AdmissionForm action={action} patients={pacientes ?? []} profissionais={profissionais ?? []} convenios={convenios ?? []} planos={planos ?? []} tipos={tipos ?? []} />
  </SectionPage>;
}
