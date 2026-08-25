import Link from "next/link";
import { ContactSections } from "@/components/cadastros/contact-sections";
import { FormGuidancePanel } from "@/components/cadastros/form-guidance-panel";
import { FormJourney } from "@/components/cadastros/form-journey";
import { FormTabs } from "@/components/cadastros/form-tabs";
import { PhotoField } from "@/components/cadastros/photo-field";
import { MaskedInput } from "@/components/forms/masked-input";
import { SectionPage } from "@/components/painel/section-page";
import { asRoute } from "@/lib/route-cast";
import { criarPaciente } from "@/modules/pacientes/actions";

const mensagens: Record<string, string> = {
  "sem-empresa": "Seu usuário não possui vínculo ativo com uma empresa.",
  "sem-permissao": "Seu perfil não possui a permissão pacientes.criar para esta empresa. Verifique o perfil do usuário nas configurações de acesso.",
  "falha-permissao": "Não foi possível validar suas permissões. Verifique se as migrations mais recentes foram aplicadas ao Supabase.",
  "campos-obrigatorios": "Preencha os dados obrigatórios, ao menos um email, telefone e endereço completo.",
  "dados-invalidos": "Um dos dados informados não é compatível com o cadastro atual do banco. Revise os campos ou aplique as migrations mais recentes.",
  "documento-duplicado": "Já existe paciente ativo com este CPF nesta empresa.",
  "falha-cadastro": "O banco recusou o cadastro do paciente. O erro técnico foi registrado no log do servidor para diagnóstico.",
  "foto-tamanho": "A foto deve ter no máximo 5 MB.",
  "foto-formato": "Use uma foto JPG, PNG ou WEBP.",
  "foto-upload": "Não foi possível enviar a foto. Tente novamente.",
};

function Campo({ label, name, type = "text", required = false, maxLength }: { label: string; name: string; type?: string; required?: boolean; maxLength?: number }) {
  return <label className="space-y-2 text-sm font-medium text-slate-700"><span>{label}{required ? " *" : ""}</span><input name={name} type={type} required={required} maxLength={maxLength} className="ui-input" /></label>;
}

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
  const dadosPessoais = <div className="space-y-6"><PhotoField label="Foto do paciente" /><div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3"><Campo label="Nome Completo" name="nome_completo" required /><label className="space-y-2 text-sm font-medium text-slate-700"><span>CPF</span><MaskedInput mask="cpf" name="cpf" inputMode="numeric" /></label><Campo label="RG" name="rg" maxLength={30} /><Campo label="Data de Nascimento" name="data_nascimento" type="date" required /><label className="space-y-2 text-sm font-medium text-slate-700"><span>Nacionalidade</span><select name="nacionalidade" defaultValue="" className="ui-input"><option value="">Selecione uma Nacionalidade</option><option value="brasileiro">Brasileiro(a)</option><option value="estrangeiro">Estrangeiro(a)</option></select></label><label className="space-y-2 text-sm font-medium text-slate-700"><span>Estado Civil</span><select name="estado_civil" defaultValue="" className="ui-input"><option value="">Selecione um Estado Civil</option><option value="solteiro">Solteiro(a)</option><option value="casado">Casado(a)</option><option value="divorciado">Divorciado(a)</option><option value="viuvo">Viúvo(a)</option></select></label><label className="space-y-2 text-sm font-medium text-slate-700"><span>Sexo</span><select name="sexo" defaultValue="" className="ui-input"><option value="">Selecione o Sexo</option><option value="masculino">Masculino</option><option value="feminino">Feminino</option><option value="intersexo">Intersexo</option><option value="outros">Outros</option></select></label></div></div>;
  return <SectionPage eyebrow="Cadastros / Pacientes / Novo" title="Novo paciente" description={retornoAdmissao ? "Cadastre o paciente e retorne automaticamente para a admissão em andamento." : "Cadastro completo dividido por tipo de informação."}>
    <FormJourney steps={[{label:"Identificação",description:"Nome, nascimento, documentos e foto.",required:true},{label:"Contatos",description:"Telefone e e-mail para comunicação.",required:true},{label:"Endereço",description:"Endereço principal do paciente.",required:true},{label:"Após salvar",description:"Biometria, convênio e histórico ficam na ficha do paciente."}]}/>
    <FormGuidancePanel validations={["Nome e data de nascimento são obrigatórios.","O CPF, quando informado, não pode duplicar outro paciente ativo da mesma empresa.","É necessário informar ao menos um telefone, e-mail e endereço completo."]} nextSteps={["Abra a ficha 360° para revisar RA, registro e histórico assistencial.","Cadastre foto/biometria/token na área de Identificação quando aplicável.","Na admissão, vincule convênio, plano e carteirinha ao episódio — não ao cadastro mestre."]}/>
    <form action={criarPaciente} noValidate className="ui-card p-5 sm:p-6">{retornoAdmissao ? <input type="hidden" name="retorno" value={retornoAdmissao} /> : null}{retornoAdmissao ? <div className="mb-5 rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-800"><strong>Admissão preservada.</strong> Ao salvar, este paciente será selecionado automaticamente na senha que estava em atendimento.</div> : null}{erro && mensagens[erro] ? <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{mensagens[erro]}</div> : null}<FormTabs tabs={[{ id: "pessoal", label: "Dados Pessoais", content: dadosPessoais }, { id: "contatos", label: "Contatos e Endereços", content: <ContactSections /> }]} /><div className="mt-8 flex flex-wrap justify-end gap-3 border-t border-slate-100 pt-5"><Link href={retornoAdmissao ? asRoute(retornoAdmissao) : "/pacientes"} className="btn-secondary">Cancelar</Link><button type="submit" className="ui-button-primary">{retornoAdmissao ? "Salvar e voltar à admissão" : "Salvar paciente"}</button></div></form>
  </SectionPage>;
}
