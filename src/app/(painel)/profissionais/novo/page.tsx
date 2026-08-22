import Link from "next/link";
import { ContactSections } from "@/components/cadastros/contact-sections";
import { PhotoField } from "@/components/cadastros/photo-field";
import { SectionPage } from "@/components/painel/section-page";
import { createClient } from "@/lib/supabase/server";
import { criarProfissional } from "@/modules/profissionais/actions";

const mensagens: Record<string, string> = {
  "campos-obrigatorios": "Preencha nome, tipo profissional e ao menos um email, telefone e endereço.",
  duplicado: "Já existe profissional ativo com este CPF nesta empresa.",
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
  const { data: tipos } = await supabase.from("tipos_profissional").select("id,nome").eq("ativo", true).order("ordem").order("nome");

  return <SectionPage eyebrow="Cadastros / Profissionais / Novo" title="Novo profissional" description="Cadastro completo para médicos, enfermagem, anestesistas e demais categorias profissionais.">
    <form action={criarProfissional} className="ui-card p-5 sm:p-6">
      {erro && mensagens[erro] ? <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{mensagens[erro]}</div> : null}
      <PhotoField label="Foto do profissional" />

      <section className="mt-7">
        <h2 className="text-lg font-semibold text-slate-950">Dados Pessoais</h2>
        <div className="mt-5 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          <Campo label="Nome Completo" name="nome_completo" required />
          <Campo label="CPF" name="cpf" maxLength={14} />
          <Campo label="RG" name="rg" maxLength={30} />
          <Campo label="Data de Nascimento" name="data_nascimento" type="date" />
          <label className="space-y-2 text-sm font-medium text-slate-700"><span>Nacionalidade</span><select name="nacionalidade" defaultValue="" className="ui-input"><option value="">Selecione uma Nacionalidade</option><option value="brasileiro">Brasileiro(a)</option><option value="estrangeiro">Estrangeiro(a)</option></select></label>
          <label className="space-y-2 text-sm font-medium text-slate-700"><span>Estado Civil</span><select name="estado_civil" defaultValue="" className="ui-input"><option value="">Selecione um Estado Civil</option><option value="solteiro">Solteiro(a)</option><option value="casado">Casado(a)</option><option value="divorciado">Divorciado(a)</option><option value="viuvo">Viúvo(a)</option></select></label>
          <label className="space-y-2 text-sm font-medium text-slate-700"><span>Sexo</span><select name="sexo" defaultValue="" className="ui-input"><option value="">Selecione o Sexo</option><option value="masculino">Masculino</option><option value="feminino">Feminino</option><option value="outros">Outros</option></select></label>
          <label className="space-y-2 text-sm font-medium text-slate-700"><span>Tipo de Profissional *</span><select name="tipo_profissional_id" required defaultValue="" className="ui-input"><option value="">Selecione o tipo</option>{tipos?.map((tipo) => <option key={tipo.id} value={tipo.id}>{tipo.nome}</option>)}</select></label>
        </div>
      </section>

      <section className="mt-8 border-t border-slate-100 pt-6">
        <h2 className="text-lg font-semibold text-slate-950">Dados Profissionais</h2>
        <p className="mt-1 text-sm text-slate-500">Conselho, registro, especialidade e CBO conforme a categoria.</p>
        <div className="mt-5 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          <Campo label="Conselho" name="conselho" />
          <Campo label="Número do Conselho" name="numero_conselho" />
          <Campo label="UF do Conselho" name="uf_conselho" maxLength={2} />
          <Campo label="Especialidade" name="especialidade" />
          <Campo label="CBO" name="cbo" />
        </div>
      </section>

      <ContactSections />

      <div className="mt-8 flex flex-wrap justify-end gap-3 border-t border-slate-100 pt-5"><Link href="/profissionais" className="btn-secondary">Cancelar</Link><button className="ui-button-primary">Salvar profissional</button></div>
    </form>
  </SectionPage>;
}
