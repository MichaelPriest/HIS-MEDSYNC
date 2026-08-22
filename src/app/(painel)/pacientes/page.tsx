import { SectionPage } from "@/components/painel/section-page";
import { createClient } from "@/lib/supabase/server";

export default async function PacientesPage({ searchParams }: { searchParams: Promise<{ sucesso?: string }> }) {
  const { sucesso } = await searchParams;
  const supabase = await createClient();
  const { data: pacientes, error } = await supabase.from("pacientes").select("id,nome_completo,nome_social,cpf,cns,data_nascimento,telefone,ativo").eq("ativo", true).order("nome_completo").limit(100);

  return (
    <SectionPage eyebrow="Cadastros / Pacientes" title="Pacientes" description="Central de identificação administrativa dos pacientes da empresa autorizada." primaryActionLabel="Novo paciente" primaryActionHref="/pacientes/novo">
      {sucesso === "cadastrado" ? <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">Paciente cadastrado com sucesso.</div> : null}
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 p-5"><h2 className="font-semibold text-slate-900">Pacientes ativos</h2><p className="mt-1 text-sm text-slate-500">A listagem respeita as políticas RLS e os vínculos do usuário autenticado.</p></div>
        {error ? <p className="p-6 text-sm text-red-700">Não foi possível consultar pacientes. Confirme se a migration do Marco 2 foi aplicada e se o usuário possui permissão.</p> : pacientes?.length ? (
          <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-5 py-3">Paciente</th><th className="px-5 py-3">CPF</th><th className="px-5 py-3">CNS</th><th className="px-5 py-3">Nascimento</th><th className="px-5 py-3">Telefone</th></tr></thead><tbody className="divide-y divide-slate-100">{pacientes.map((paciente) => <tr key={paciente.id}><td className="px-5 py-4 font-medium text-slate-900">{paciente.nome_social || paciente.nome_completo}<span className="block text-xs font-normal text-slate-500">{paciente.nome_social ? paciente.nome_completo : ""}</span></td><td className="px-5 py-4 text-slate-600">{paciente.cpf || "—"}</td><td className="px-5 py-4 text-slate-600">{paciente.cns || "—"}</td><td className="px-5 py-4 text-slate-600">{new Date(`${paciente.data_nascimento}T12:00:00`).toLocaleDateString("pt-BR")}</td><td className="px-5 py-4 text-slate-600">{paciente.telefone || "—"}</td></tr>)}</tbody></table></div>
        ) : <div className="p-8 text-center"><h3 className="font-semibold text-slate-900">Nenhum paciente cadastrado</h3><p className="mt-2 text-sm text-slate-500">Use “Novo paciente” para iniciar o cadastro mestre.</p></div>}
      </section>
    </SectionPage>
  );
}
