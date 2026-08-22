import Link from "next/link";
import { ContactSections } from "@/components/cadastros/contact-sections";
import { FormTabs } from "@/components/cadastros/form-tabs";
import { PhotoField } from "@/components/cadastros/photo-field";
import { SectionPage } from "@/components/painel/section-page";
import { criarConvenio } from "@/modules/convenios/actions";

const mensagens: Record<string, string> = {
  "campos-obrigatorios": "Informe os dados obrigatórios, ao menos um email, telefone e endereço completo.",
  duplicado: "Já existe convênio ativo com este registro ANS nesta empresa.",
  "falha-cadastro": "Não foi possível cadastrar o convênio. Verifique os dados e sua permissão.",
  "foto-tamanho": "O logo deve ter no máximo 5 MB.",
  "foto-formato": "Use logo em JPG, PNG ou WEBP.",
  "foto-upload": "Não foi possível enviar o logo.",
};

function Campo({ label, name, type = "text", maxLength, required = false }: { label: string; name: string; type?: string; maxLength?: number; required?: boolean }) {
  return <label className="space-y-2 text-sm font-medium text-slate-700"><span>{label}{required ? " *" : ""}</span><input name={name} type={type} maxLength={maxLength} required={required} className="ui-input" /></label>;
}

export default async function NovoConvenioPage({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const { erro } = await searchParams;
  const dados = <div className="space-y-6"><PhotoField label="Logo da operadora" name="logo" /><div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3"><Campo label="Registro ANS" name="registro_ans" maxLength={6} /><Campo label="Razão Social" name="razao_social" required /><Campo label="Nome Fantasia" name="nome_fantasia" required /><Campo label="CNPJ" name="cnpj" maxLength={18} /></div></div>;
  return <SectionPage eyebrow="Cadastros / Convênios / Novo" title="Novo convênio" description="Operadora com logo, dados administrativos, contatos e endereços."><form action={criarConvenio} className="ui-card p-5 sm:p-6">{erro && mensagens[erro] ? <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{mensagens[erro]}</div> : null}<FormTabs tabs={[{ id: "operadora", label: "Dados da Operadora", content: dados }, { id: "contatos", label: "Contatos e Endereços", content: <ContactSections defaultAddressType="comercial" defaultPhoneType="comercial" /> }]} /><div className="mt-8 flex flex-wrap justify-end gap-3 border-t border-slate-100 pt-5"><Link href="/convenios" className="btn-secondary">Cancelar</Link><button className="ui-button-primary">Salvar convênio</button></div></form></SectionPage>;
}
