import Link from "next/link";
import { SectionPage } from "@/components/painel/section-page";
import { criarConvenio } from "@/modules/convenios/actions";

const mensagens: Record<string, string> = {
  "campos-obrigatorios": "Informe razão social e nome fantasia.",
  duplicado: "Já existe convênio ativo com este registro ANS nesta empresa.",
  "falha-cadastro": "Não foi possível cadastrar o convênio. Verifique os dados e sua permissão.",
};

function Campo({ label, name, type = "text", maxLength, required = false }: { label: string; name: string; type?: string; maxLength?: number; required?: boolean }) {
  return <label className="space-y-2 text-sm font-medium text-slate-700"><span>{label}{required ? " *" : ""}</span><input name={name} type={type} maxLength={maxLength} required={required} className="w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-brand-700" /></label>;
}

export default async function NovoConvenioPage({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const { erro } = await searchParams;
  return <SectionPage eyebrow="Cadastros / Convênios / Novo" title="Novo convênio" description="Cadastre os dados administrativos da operadora que serão reutilizados em autorizações, TISS e faturamento.">
    <form action={criarConvenio} className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      {erro && mensagens[erro] ? <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{mensagens[erro]}</div> : null}
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        <Campo label="Registro ANS" name="registro_ans" maxLength={6} /><Campo label="Razão social" name="razao_social" required /><Campo label="Nome fantasia" name="nome_fantasia" required /><Campo label="CNPJ" name="cnpj" maxLength={18} /><Campo label="Telefone" name="telefone" /><Campo label="E-mail" name="email" type="email" />
      </div>
      <div className="mt-8 flex justify-end gap-3 border-t border-slate-100 pt-5"><Link href="/convenios" className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700">Cancelar</Link><button className="rounded-lg bg-brand-950 px-4 py-2 text-sm font-semibold text-white">Salvar convênio</button></div>
    </form>
  </SectionPage>;
}
