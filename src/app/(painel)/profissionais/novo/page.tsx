import Link from "next/link";
import { ContactSections } from "@/components/cadastros/contact-sections";
import { FormTabs } from "@/components/cadastros/form-tabs";
import { PhotoField } from "@/components/cadastros/photo-field";
import { MaskedInput } from "@/components/forms/masked-input";
import { SectionPage } from "@/components/painel/section-page";
import { createClient } from "@/lib/supabase/server";
import { criarProfissional } from "@/modules/profissionais/actions";

const mensagens: Record<string, string> = {
  "campos-obrigatorios": "Preencha dados pessoais, tipo profissional, contrato e ao menos um email, telefone e endereço.",
  duplicado: "Já existe profissional ativo com este CPF nesta empresa.",
  "tipo-invalido": "O tipo de profissional selecionado não existe, está inativo ou pertence a outra empresa.",
  "sem-permissao": "Seu usuário não possui permissão para cadastrar profissionais.",
  "falha-cadastro": "Não foi possível cadastrar o profissional. Verifique os dados e sua permissão.",
  "foto-tamanho": "A foto deve ter no máximo 5 MB.",
  "foto-formato": "Use uma foto JPG, PNG ou WEBP.",
  "foto-upload": "Não foi possível enviar a foto. Tente novamente.",
};

function Campo({ label, name, type = "text", maxLength, required = false }: { label: string; name: string; type?: string; maxLength?: number; required?: boolean }) {
  return <label className="space-y-2 text-sm font-medium text-slate-700"><span>{label}{required ? " *" : ""}</span><input name={name} type={type} maxLength={maxLength} required={required} className="ui-input" /></label>;
}

export default async function NovoProfissionalPage({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const { erro } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let empresaId: string | null = null;
  if (user) {
    const { data: vinculo } = await supabase
      .from("usuario_empresas")
      .select("empresa_id")
      .eq("usuario_id", user.id)
      .eq("ativo", true)
      .limit(1)
      .maybeSingle();
    empresaId = vinculo?.empresa_id ?? null;
  }

  const [{ data: tiposCatalogo }, { data: tiposLegados }] = await Promise.all([
    empresaId
      ? supabase
          .from("catalogos")
          .select("id,codigo,descricao")
          .eq("empresa_id", empresaId)
          .eq("tipo", "tipo_profissional")
          .eq("ativo", true)
          .order("descricao")
      : Promise.resolve({ data: [] as Array<{ id: string; codigo: string; descricao: string }> }),
    supabase.from("tipos_profissional").select("id,codigo,nome").eq("ativo", true).order("ordem").order("nome"),
  ]);

  const temCatalogos = Boolean(tiposCatalogo?.length);

  const pessoal = <div className="space-y-6"><PhotoField label="Foto do profissional" /><div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3"><Campo label="Nome Completo" name="nome_completo" required /><label className="space-y-2 text-sm font-medium text-slate-700"><span>CPF</span><MaskedInput mask="cpf" name="cpf" inputMode="numeric" /></label><Campo label="RG" name="rg" maxLength={30} /><Campo label="Data de Nascimento" name="data_nascimento" type="date" /><label className="space-y-2 text-sm font-medium text-slate-700"><span>Nacionalidade</span><select name="nacionalidade" defaultValue="" className="ui-input"><option value="">Selecione</option><option value="brasileiro">Brasileiro(a)</option><option value="estrangeiro">Estrangeiro(a)</option></select></label><label className="space-y-2 text-sm font-medium text-slate-700"><span>Estado Civil</span><select name="estado_civil" defaultValue="" className="ui-input"><option value="">Selecione</option><option value="solteiro">Solteiro(a)</option><option value="casado">Casado(a)</option><option value="divorciado">Divorciado(a)</option><option value="viuvo">Viúvo(a)</option></select></label><label className="space-y-2 text-sm font-medium text-slate-700"><span>Sexo</span><select name="sexo" defaultValue="" className="ui-input"><option value="">Selecione</option><option value="masculino">Masculino</option><option value="feminino">Feminino</option><option value="outros">Outros</option></select></label></div></div>;

  const profissional = <div className="space-y-3"><div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3"><label className="space-y-2 text-sm font-medium text-slate-700"><span>Tipo de Profissional *</span><select name="tipo_profissional_ref" required defaultValue="" className="ui-input"><option value="">Selecione o tipo</option>{temCatalogos ? tiposCatalogo?.map((tipo) => <option key={tipo.id} value={`catalogo:${tipo.id}`}>{tipo.descricao}</option>) : tiposLegados?.map((tipo) => <option key={tipo.id} value={`legado:${tipo.id}`}>{tipo.nome}</option>)}</select></label><Campo label="Conselho" name="conselho" /><Campo label="Número do Conselho" name="numero_conselho" /><Campo label="UF do Conselho" name="uf_conselho" maxLength={2} /><Campo label="Especialidade" name="especialidade" /><Campo label="CBO" name="cbo" /></div>{temCatalogos ? <p className="text-xs text-slate-500">Os tipos acima são carregados de Cadastros → Catálogos → Tipo de profissional desta empresa.</p> : <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">Nenhum Tipo de profissional empresarial foi encontrado. O sistema está exibindo os tipos legados. Cadastre novos tipos em Catálogos.</p>}</div>;

  const contrato = <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3"><label className="space-y-2 text-sm font-medium text-slate-700"><span>Tipo de Contrato *</span><select name="tipo_contrato" required defaultValue="" className="ui-input"><option value="">Selecione</option><option value="clt">CLT</option><option value="pj">Pessoa Jurídica</option><option value="cooperado">Cooperado</option><option value="autonomo">Autônomo</option><option value="estatutario">Estatutário</option><option value="credenciado">Credenciado</option><option value="prestador">Prestador</option><option value="outro">Outro</option></select></label><Campo label="Matrícula" name="matricula" /><Campo label="Data de Início" name="data_inicio_contrato" type="date" required /><Campo label="Data de Fim" name="data_fim_contrato" type="date" /><Campo label="Carga Horária Semanal" name="carga_horaria_semanal" /><label className="space-y-2 text-sm font-medium text-slate-700"><span>Tipo de Remuneração</span><select name="tipo_remuneracao" defaultValue="" className="ui-input"><option value="">Selecione</option><option value="mensal">Mensal</option><option value="hora">Hora</option><option value="plantao">Plantão</option><option value="procedimento">Procedimento</option><option value="producao">Produção</option><option value="outro">Outro</option></select></label><Campo label="Valor da Remuneração" name="valor_remuneracao" /><label className="space-y-2 text-sm font-medium text-slate-700 md:col-span-2 xl:col-span-3"><span>Observações Contratuais</span><textarea name="observacoes_contrato" rows={4} className="ui-input" /></label></div>;

  return <SectionPage eyebrow="Cadastros / Profissionais / Novo" title="Novo profissional" description="Cadastro completo com dados pessoais, profissionais, contrato e contatos."><form noValidate action={criarProfissional} className="ui-card p-5 sm:p-6">{erro && mensagens[erro] ? <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{mensagens[erro]}</div> : null}<FormTabs tabs={[{ id: "pessoal", label: "Dados Pessoais", content: pessoal }, { id: "profissional", label: "Dados Profissionais", content: profissional }, { id: "contrato", label: "Contrato", content: contrato }, { id: "contatos", label: "Contatos e Endereços", content: <ContactSections /> }]} /><div className="mt-8 flex flex-wrap justify-end gap-3 border-t border-slate-100 pt-5"><Link href="/profissionais" className="btn-secondary">Cancelar</Link><button className="ui-button-primary">Salvar profissional</button></div></form></SectionPage>;
}
