import { UsersRound } from "lucide-react";
import { SectionPage } from "@/components/painel/section-page";
import { createClient } from "@/lib/supabase/server";
import { criarUrlFotoAssinada } from "@/modules/cadastros/fotos";

export default async function PacientesPage({ searchParams }: { searchParams: Promise<{ sucesso?: string }> }) {
  const { sucesso } = await searchParams;
  const supabase = await createClient();
  const { data: pacientes, error } = await supabase.from("pacientes").select("id,nome_completo,nome_social,cpf,cns,data_nascimento,telefone,ativo,foto_path").eq("ativo", true).order("nome_completo").limit(100);
  const pacientesComFoto = await Promise.all((pacientes ?? []).map(async (paciente) => ({ ...paciente, foto_url: await criarUrlFotoAssinada(supabase, paciente.foto_path) })));

  return (
    <SectionPage eyebrow="Cadastros / Pacientes" title="Pacientes" description="Central de identificação administrativa dos pacientes da empresa autorizada." primaryActionLabel="Novo paciente" primaryActionHref="/pacientes/novo">
      {sucesso === "cadastrado" ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">Paciente cadastrado com sucesso.</div> : null}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm shadow-slate-900/[0.03]">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-brand-50 text-brand-700"><UsersRound className="size-5" /></span><div><h2 className="font-semibold text-slate-900">Pacientes ativos</h2><p className="text-sm text-slate-500">Registros visíveis conforme RLS e vínculos.</p></div></div>
          <span className="w-fit rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{pacientesComFoto.length} exibidos</span>
        </div>
        {error ? <p className="p-6 text-sm text-red-700">Não foi possível consultar pacientes. Confirme migration e permissões.</p> : pacientesComFoto.length ? (
          <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-slate-50/80 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-3">Paciente</th><th className="px-5 py-3">CPF</th><th className="px-5 py-3">CNS</th><th className="px-5 py-3">Nascimento</th><th className="px-5 py-3">Telefone</th></tr></thead><tbody className="divide-y divide-slate-100">{pacientesComFoto.map((paciente) => <tr key={paciente.id} className="transition hover:bg-slate-50/70"><td className="px-5 py-4"><div className="flex items-center gap-3"><span className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-xl bg-brand-50 text-sm font-semibold text-brand-700" style={paciente.foto_url ? { backgroundImage: `url(${paciente.foto_url})`, backgroundPosition: "center", backgroundSize: "cover" } : undefined}>{paciente.foto_url ? null : (paciente.nome_social || paciente.nome_completo).slice(0, 1).toUpperCase()}</span><div className="font-medium text-slate-900">{paciente.nome_social || paciente.nome_completo}<span className="block text-xs font-normal text-slate-500">{paciente.nome_social ? paciente.nome_completo : ""}</span></div></div></td><td className="px-5 py-4 text-slate-600">{paciente.cpf || "—"}</td><td className="px-5 py-4 text-slate-600">{paciente.cns || "—"}</td><td className="px-5 py-4 text-slate-600">{new Date(`${paciente.data_nascimento}T12:00:00`).toLocaleDateString("pt-BR")}</td><td className="px-5 py-4 text-slate-600">{paciente.telefone || "—"}</td></tr>)}</tbody></table></div>
        ) : <div className="p-10 text-center"><span className="mx-auto grid size-12 place-items-center rounded-2xl bg-slate-100 text-slate-400"><UsersRound className="size-5" /></span><h3 className="mt-3 font-semibold text-slate-900">Nenhum paciente cadastrado</h3><p className="mt-1 text-sm text-slate-500">Use “Novo paciente” para iniciar o cadastro mestre.</p></div>}
      </section>
    </SectionPage>
  );
}
