import Link from "next/link";
import { ContactSections } from "@/components/cadastros/contact-sections";
import { SectionPage } from "@/components/painel/section-page";
import { criarConvenio } from "@/modules/convenios/actions";

const mensagens: Record<string, string> = {
  "campos-obrigatorios": "Informe os dados obrigatórios, ao menos um email, telefone e endereço completo.",
  duplicado: "Já existe convênio ativo com este registro ANS nesta empresa.",
  "falha-cadastro": "Não foi possível cadastrar o convênio. Verifique os dados e sua permissão.",
};

function Campo({ label, name, type = "text", maxLength, required = false }: { label: string; name: string; type?: string; maxLength?: number; required?: boolean }) {
  return <label className="space-y-2 text-sm font-medium text-slate-700"><span>{label}{required ? " *" : ""}</span><input name={name} type={type} maxLength={maxLength} required={required} className="ui-input" /></label>;
}

export default async function NovoConvenioPage({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const { erro } = await searchParams;
  return <SectionPage eyebrow="Cadastros / Convênios / Novo" title="Novo convênio" description="Cadastro administrativo da operadora com múltiplos contatos e endereços.">
    <form action={criarConvenio} className="ui-card p-5 sm:p-6">
      {erro && mensagens[erro] ? <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{mensagens[erro]}</div> : null}
      <section>
        <h2 className="text-lg font-semibold text-slate-950">Dados da Operadora</h2>
        <p className="mt-1 text-sm text-slate-500">Informações utilizadas em autorizações, TISS e faturamento.</p>
        <div className="mt-5 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          <Campo label="Registro ANS" name="registro_ans" maxLength={6} />
          <Campo label="Razão Social" name="razao_social" required />
          <Campo label="Nome Fantasia" name="nome_fantasia" required />
          <Campo label="CNPJ" name="cnpj" maxLength={18} />
        </div>
      </section>

      <ContactSections defaultAddressType="comercial" />

      <div className="mt-8 flex flex-wrap justify-end gap-3 border-t border-slate-100 pt-5"><Link href="/convenios" className="btn-secondary">Cancelar</Link><button className="ui-button-primary">Salvar convênio</button></div>
    </form>
  </SectionPage>;
}
