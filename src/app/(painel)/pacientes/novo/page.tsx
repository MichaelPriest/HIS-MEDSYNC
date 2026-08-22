import Link from "next/link";
import { ContactSections } from "@/components/cadastros/contact-sections";
import { PhotoField } from "@/components/cadastros/photo-field";
import { SectionPage } from "@/components/painel/section-page";
import { criarPaciente } from "@/modules/pacientes/actions";

const mensagens: Record<string, string> = {
  "sem-empresa": "Seu usuário não possui vínculo ativo com uma empresa.",
  "campos-obrigatorios": "Preencha os dados obrigatórios, ao menos um email, telefone e endereço completo.",
  "documento-duplicado": "Já existe paciente ativo com este CPF nesta empresa.",
  "falha-cadastro": "Não foi possível cadastrar o paciente. Verifique os dados e sua permissão.",
  "foto-tamanho": "A foto deve ter no máximo 5 MB.",
  "foto-formato": "Use uma foto JPG, PNG ou WEBP.",
  "foto-upload": "Não foi possível enviar a foto. Tente novamente.",
};

function Campo({ label, name, type = "text", required = false, maxLength }: { label: string; name: string; type?: string; required?: boolean; maxLength?: number }) {
  return <label className="space-y-2 text-sm font-medium text-slate-700"><span>{label}{required ? " *" : ""}</span><input name={name} type={type} required={required} maxLength={maxLength} className="ui-input" /></label>;
}

export default async function NovoPacientePage({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const { erro } = await searchParams;
  return (
    <SectionPage eyebrow="Cadastros / Pacientes / Novo" title="Novo paciente" description="Cadastro completo com dados pessoais, foto, múltiplos contatos e endereços.">
      <form action={criarPaciente} className="ui-card p-5 sm:p-6">
        {erro && mensagens[erro] ? <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{mensagens[erro]}</div> : null}
        <PhotoField label="Foto do paciente" />

        <section className="mt-7">
          <h2 className="text-lg font-semibold text-slate-950">Dados Pessoais</h2>
          <p className="mt-1 text-sm text-slate-500">Informações civis e de identificação do paciente.</p>
          <div className="mt-5 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            <Campo label="Nome Completo" name="nome_completo" required />
            <Campo label="CPF" name="cpf" maxLength={14} />
            <Campo label="RG" name="rg" maxLength={30} />
            <Campo label="Data de Nascimento" name="data_nascimento" type="date" required />
            <label className="space-y-2 text-sm font-medium text-slate-700"><span>Nacionalidade</span><select name="nacionalidade" defaultValue="" className="ui-input"><option value="">Selecione uma Nacionalidade</option><option value="brasileiro">Brasileiro(a)</option><option value="estrangeiro">Estrangeiro(a)</option></select></label>
            <label className="space-y-2 text-sm font-medium text-slate-700"><span>Estado Civil</span><select name="estado_civil" defaultValue="" className="ui-input"><option value="">Selecione um Estado Civil</option><option value="solteiro">Solteiro(a)</option><option value="casado">Casado(a)</option><option value="divorciado">Divorciado(a)</option><option value="viuvo">Viúvo(a)</option></select></label>
            <label className="space-y-2 text-sm font-medium text-slate-700"><span>Sexo</span><select name="sexo" defaultValue="" className="ui-input"><option value="">Selecione o Sexo</option><option value="masculino">Masculino</option><option value="feminino">Feminino</option><option value="outros">Outros</option></select></label>
          </div>
        </section>

        <ContactSections />

        <div className="mt-8 flex flex-wrap justify-end gap-3 border-t border-slate-100 pt-5">
          <Link href="/pacientes" className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50">Cancelar</Link>
          <button type="submit" className="ui-button-primary">Salvar paciente</button>
        </div>
      </form>
    </SectionPage>
  );
}
