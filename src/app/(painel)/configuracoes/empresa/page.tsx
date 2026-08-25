import Image from "next/image";
import { Building2, ImageIcon, Save, ShieldCheck } from "lucide-react";
import { SectionPage } from "@/components/painel/section-page";
import { requireAnyPermission } from "@/lib/permissions/server";
import { salvarConfiguracaoEmpresa } from "@/modules/empresa/actions";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ConfiguracaoEmpresaPage({ searchParams }: {
  searchParams: Promise<{ sucesso?: string; erro?: string }>;
}) {
  const sp = await searchParams;
  const { supabase, empresaId } = await requireAnyPermission(["empresas.visualizar", "empresas.administrar"]);
  const { data: empresa } = await supabase.from("empresas").select("id,razao_social,nome_fantasia,nome_curto,cnpj,inscricao_estadual,inscricao_municipal,cnes,telefone,whatsapp,email,site,cep,logradouro,numero,complemento,bairro,cidade,uf,logo_url,rodape_documentos,ativo").eq("id", empresaId).maybeSingle();
  if (!empresa) return null;

  return <SectionPage eyebrow="Configurações / Empresa" title="Configuração da empresa"
    description="Dados institucionais e identidade visual utilizados nas telas, cabeçalhos, receitas, atestados, relatórios e demais documentos do HIS.">
    {sp.sucesso === "salvo" ? <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">Configuração da empresa atualizada com sucesso.</div> : null}
    {sp.erro ? <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{sp.erro === "logo" ? "A logo deve ser PNG, JPG, WEBP ou SVG e ter no máximo 2 MB." : sp.erro === "upload" ? "Não foi possível enviar a logo para o armazenamento." : sp.erro === "campos" ? "Revise razão social, nome fantasia e CNPJ." : "Não foi possível salvar os dados da empresa."}</div> : null}

    <form action={salvarConfiguracaoEmpresa} encType="multipart/form-data" className="space-y-5">
      <section className="ui-card p-5 sm:p-6">
        <div className="flex items-start gap-3"><span className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700"><ImageIcon className="size-5"/></span><div><h2 className="font-black text-slate-950">Identidade visual</h2><p className="mt-1 text-sm text-slate-500">A logo será a referência institucional do MedSync para documentos e áreas configuradas do sistema.</p></div></div>
        <div className="mt-5 grid gap-5 lg:grid-cols-[220px_1fr]">
          <div className="flex min-h-36 items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4">{empresa.logo_url ? <Image src={empresa.logo_url} alt={`Logo ${empresa.nome_fantasia}`} width={180} height={100} className="max-h-28 w-auto object-contain" unoptimized/> : <div className="text-center text-slate-400"><Building2 className="mx-auto size-10"/><p className="mt-2 text-xs font-semibold">Sem logo cadastrada</p></div>}</div>
          <div><label className="text-sm font-semibold text-slate-700">Nova logo<input name="logo" type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="ui-input mt-1.5 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:font-semibold"/></label><p className="mt-2 text-xs text-slate-500">PNG, JPG, WEBP ou SVG · máximo 2 MB. Se não selecionar arquivo, a logo atual é mantida.</p></div>
        </div>
      </section>

      <section className="ui-card p-5 sm:p-6">
        <div className="flex items-center gap-3"><Building2 className="size-5 text-brand-700"/><div><h2 className="font-black text-slate-950">Dados institucionais</h2><p className="text-sm text-slate-500">Identificação jurídica e cadastral da instituição.</p></div></div>
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Field label="Razão social *" name="razao_social" value={empresa.razao_social} span="xl:col-span-2" required/>
          <Field label="Nome fantasia *" name="nome_fantasia" value={empresa.nome_fantasia}/>
          <Field label="Nome curto" name="nome_curto" value={empresa.nome_curto}/>
          <Field label="CNPJ *" name="cnpj" value={empresa.cnpj} required/>
          <Field label="Inscrição estadual" name="inscricao_estadual" value={empresa.inscricao_estadual}/>
          <Field label="Inscrição municipal" name="inscricao_municipal" value={empresa.inscricao_municipal}/>
          <Field label="CNES" name="cnes" value={empresa.cnes}/>
        </div>
      </section>

      <section className="ui-card p-5 sm:p-6">
        <h2 className="font-black text-slate-950">Contato</h2><p className="mt-1 text-sm text-slate-500">Dados que podem ser apresentados em documentos e comunicações.</p>
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4"><Field label="Telefone" name="telefone" value={empresa.telefone}/><Field label="WhatsApp" name="whatsapp" value={empresa.whatsapp}/><Field label="E-mail" name="email" value={empresa.email} type="email"/><Field label="Site" name="site" value={empresa.site}/></div>
      </section>

      <section className="ui-card p-5 sm:p-6">
        <h2 className="font-black text-slate-950">Endereço</h2>
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-6"><Field label="CEP" name="cep" value={empresa.cep}/><Field label="Logradouro" name="logradouro" value={empresa.logradouro} span="xl:col-span-3"/><Field label="Número" name="numero" value={empresa.numero}/><Field label="Complemento" name="complemento" value={empresa.complemento}/><Field label="Bairro" name="bairro" value={empresa.bairro} span="xl:col-span-2"/><Field label="Cidade" name="cidade" value={empresa.cidade} span="xl:col-span-2"/><Field label="UF" name="uf" value={empresa.uf}/></div>
      </section>

      <section className="ui-card p-5 sm:p-6">
        <div className="flex items-center gap-2"><ShieldCheck className="size-5 text-brand-700"/><h2 className="font-black text-slate-950">Documentos institucionais</h2></div>
        <label className="mt-4 block text-sm font-semibold text-slate-700">Rodapé padrão<textarea name="rodape_documentos" defaultValue={empresa.rodape_documentos ?? ""} rows={4} className="ui-input mt-1.5 min-h-28" placeholder="Ex.: endereço, telefone, site, mensagem institucional ou informações legais que devem aparecer nos documentos."/></label>
      </section>

      <div className="sticky bottom-4 z-10 flex justify-end"><button className="ui-button-primary shadow-lg"><Save className="size-4"/>Salvar configuração</button></div>
    </form>
  </SectionPage>;
}

function Field({ label, name, value, type = "text", span = "", required = false }: { label: string; name: string; value: string | null; type?: string; span?: string; required?: boolean }) {
  return <label className={`text-sm font-semibold text-slate-700 ${span}`}>{label}<input name={name} type={type} defaultValue={value ?? ""} required={required} className="ui-input mt-1.5"/></label>;
}
