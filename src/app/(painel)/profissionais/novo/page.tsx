import Link from "next/link";
import { SectionPage } from "@/components/painel/section-page";
import { criarProfissional } from "@/modules/profissionais/actions";

const mensagens: Record<string, string> = {
  "campos-obrigatorios": "Informe ao menos o nome completo.",
  duplicado: "Já existe profissional ativo com este CPF nesta empresa.",
  "falha-cadastro": "Não foi possível cadastrar o profissional. Verifique os dados e sua permissão.",
};

function Campo({ label, name, type = "text", maxLength }: { label: string; name: string; type?: string; maxLength?: number }) {
  return <label className="space-y-2 text-sm font-medium text-slate-700"><span>{label}</span><input name={name} type={type} maxLength={maxLength} className="w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-brand-700" /></label>;
}

export default async function NovoProfissionalPage({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const { erro } = await searchParams;
  return <SectionPage eyebrow="Cadastros / Profissionais / Novo" title="Novo profissional" description="Cadastre identidade, credenciais regulatórias e dados de contato do profissional.">
    <form action={criarProfissional} className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      {erro && mensagens[erro] ? <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{mensagens[erro]}</div> : null}
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        <label className="space-y-2 text-sm font-medium text-slate-700"><span>Nome completo *</span><input name="nome_completo" required className="w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-brand-700" /></label>
        <Campo label="CPF" name="cpf" maxLength={14} /><Campo label="Conselho" name="conselho" /><Campo label="Número do conselho" name="numero_conselho" /><Campo label="UF do conselho" name="uf_conselho" maxLength={2} /><Campo label="Especialidade" name="especialidade" /><Campo label="CBO" name="cbo" /><Campo label="Telefone" name="telefone" /><Campo label="E-mail" name="email" type="email" />
      </div>
      <div className="mt-8 flex justify-end gap-3 border-t border-slate-100 pt-5"><Link href="/profissionais" className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700">Cancelar</Link><button className="rounded-lg bg-brand-950 px-4 py-2 text-sm font-semibold text-white">Salvar profissional</button></div>
    </form>
  </SectionPage>;
}
