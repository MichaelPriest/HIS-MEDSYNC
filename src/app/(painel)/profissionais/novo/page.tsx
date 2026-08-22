import Link from "next/link";
import { PhotoField } from "@/components/cadastros/photo-field";
import { SectionPage } from "@/components/painel/section-page";
import { criarProfissional } from "@/modules/profissionais/actions";

const mensagens: Record<string, string> = {
  "campos-obrigatorios": "Informe ao menos o nome completo.",
  duplicado: "Já existe profissional ativo com este CPF nesta empresa.",
  "falha-cadastro": "Não foi possível cadastrar o profissional. Verifique os dados e sua permissão.",
  "foto-tamanho": "A foto deve ter no máximo 5 MB.",
  "foto-formato": "Use uma foto JPG, PNG ou WEBP.",
  "foto-upload": "Não foi possível enviar a foto. Tente novamente.",
};

function Campo({ label, name, type = "text", maxLength }: { label: string; name: string; type?: string; maxLength?: number }) {
  return <label className="space-y-2 text-sm font-medium text-slate-700"><span>{label}</span><input name={name} type={type} maxLength={maxLength} className="ui-input" /></label>;
}

export default async function NovoProfissionalPage({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const { erro } = await searchParams;
  return <SectionPage eyebrow="Cadastros / Profissionais / Novo" title="Novo profissional" description="Cadastre identidade, foto, credenciais regulatórias e dados de contato do profissional.">
    <form action={criarProfissional} className="ui-card p-6">
      {erro && mensagens[erro] ? <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{mensagens[erro]}</div> : null}
      <PhotoField label="Foto do profissional" />
      <div className="mt-7 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        <label className="space-y-2 text-sm font-medium text-slate-700"><span>Nome completo *</span><input name="nome_completo" required className="ui-input" /></label>
        <Campo label="CPF" name="cpf" maxLength={14} /><Campo label="Conselho" name="conselho" /><Campo label="Número do conselho" name="numero_conselho" /><Campo label="UF do conselho" name="uf_conselho" maxLength={2} /><Campo label="Especialidade" name="especialidade" /><Campo label="CBO" name="cbo" /><Campo label="Telefone" name="telefone" /><Campo label="E-mail" name="email" type="email" />
      </div>
      <div className="mt-8 flex justify-end gap-3 border-t border-slate-100 pt-5"><Link href="/profissionais" className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50">Cancelar</Link><button className="ui-button-primary">Salvar profissional</button></div>
    </form>
  </SectionPage>;
}
