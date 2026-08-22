import Link from "next/link";
import { PhotoField } from "@/components/cadastros/photo-field";
import { SectionPage } from "@/components/painel/section-page";
import { criarPaciente } from "@/modules/pacientes/actions";

const mensagens: Record<string, string> = {
  "sem-empresa": "Seu usuário não possui vínculo ativo com uma empresa.",
  "campos-obrigatorios": "Preencha nome completo e data de nascimento.",
  "documento-duplicado": "Já existe paciente ativo com este CPF ou CNS nesta empresa.",
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
    <SectionPage eyebrow="Cadastros / Pacientes / Novo" title="Novo paciente" description="Cadastro mestre administrativo do paciente, protegido por vínculo de empresa, permissão e RLS.">
      <form action={criarPaciente} className="ui-card p-6">
        {erro && mensagens[erro] ? <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{mensagens[erro]}</div> : null}
        <PhotoField label="Foto do paciente" />
        <h2 className="mt-7 text-base font-semibold text-slate-900">Identificação</h2>
        <div className="mt-4 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          <Campo label="Nome completo" name="nome_completo" required />
          <Campo label="Nome social" name="nome_social" />
          <Campo label="CPF" name="cpf" maxLength={14} />
          <Campo label="CNS" name="cns" maxLength={18} />
          <Campo label="Data de nascimento" name="data_nascimento" type="date" required />
          <label className="space-y-2 text-sm font-medium text-slate-700"><span>Sexo</span><select name="sexo" defaultValue="nao_informado" className="ui-input"><option value="nao_informado">Não informado</option><option value="feminino">Feminino</option><option value="masculino">Masculino</option><option value="intersexo">Intersexo</option></select></label>
          <Campo label="Telefone" name="telefone" />
          <Campo label="E-mail" name="email" type="email" />
        </div>
        <h2 className="mt-8 border-t border-slate-100 pt-6 text-base font-semibold text-slate-900">Endereço</h2>
        <div className="mt-4 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          <Campo label="CEP" name="cep" maxLength={9} /><Campo label="Logradouro" name="logradouro" /><Campo label="Número" name="numero" /><Campo label="Complemento" name="complemento" /><Campo label="Bairro" name="bairro" /><Campo label="Cidade" name="cidade" /><Campo label="UF" name="uf" maxLength={2} />
        </div>
        <h2 className="mt-8 border-t border-slate-100 pt-6 text-base font-semibold text-slate-900">Contato de emergência</h2>
        <div className="mt-4 grid gap-5 md:grid-cols-2"><Campo label="Nome" name="contato_emergencia_nome" /><Campo label="Telefone" name="contato_emergencia_telefone" /></div>
        <div className="mt-8 flex justify-end gap-3 border-t border-slate-100 pt-5"><Link href="/pacientes" className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50">Cancelar</Link><button type="submit" className="ui-button-primary">Salvar paciente</button></div>
      </form>
    </SectionPage>
  );
}
