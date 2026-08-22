import { UsersRound } from "lucide-react";
import { ListToolbar, Pagination } from "@/components/cadastros/list-toolbar";
import { RecordDrawer } from "@/components/cadastros/record-drawer";
import { SectionPage } from "@/components/painel/section-page";
import { StatusToast } from "@/components/painel/status-toast";
import { createClient } from "@/lib/supabase/server";
import { criarUrlFotoAssinada } from "@/modules/cadastros/fotos";

const PAGE_SIZE = 20;

export default async function PacientesPage({ searchParams }: { searchParams: Promise<{ sucesso?: string; q?: string; page?: string }> }) {
  const { sucesso, q: rawQuery, page: rawPage } = await searchParams;
  const query = rawQuery?.trim().slice(0, 80) || "";
  const safeQuery = query.replace(/[,%()]/g, " ").trim();
  const queryDigits = query.replace(/\D/g, "");
  const page = Math.max(1, Number.parseInt(rawPage || "1", 10) || 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const supabase = await createClient();
  let request = supabase.from("pacientes").select("id,nome_completo,nome_social,cpf,cns,data_nascimento,telefone,email,sexo,cidade,uf,ativo,foto_path,numero_registro,ra", { count: "exact" }).eq("ativo", true);
  if (safeQuery) {
    const filters = [`nome_completo.ilike.%${safeQuery}%`, `ra.ilike.%${safeQuery}%`];
    if (queryDigits) { filters.push(`cpf.ilike.%${queryDigits}%`, `cns.ilike.%${queryDigits}%`); }
    if (/^\d+$/.test(queryDigits) && queryDigits.length <= 12) filters.push(`numero_registro.eq.${Number(queryDigits)}`);
    request = request.or(filters.join(","));
  }
  const { data: pacientes, error, count } = await request.order("nome_completo").range(from, to);
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));
  const pacientesComFoto = await Promise.all((pacientes ?? []).map(async (paciente) => ({ ...paciente, foto_url: await criarUrlFotoAssinada(supabase, paciente.foto_path) })));

  return <SectionPage eyebrow="Cadastros / Pacientes" title="Pacientes" description="Localize por nome, CPF, CNS, RA ou número de registro." primaryActionLabel="Novo paciente" primaryActionHref="/pacientes/novo">
    <StatusToast success={sucesso === "cadastrado" ? "Paciente cadastrado com sucesso." : null} />
    <section className="ui-card overflow-hidden">
      <div className="space-y-4 border-b border-slate-100 p-5"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-brand-50 text-brand-700"><UsersRound className="size-5" /></span><div><h2 className="font-semibold text-slate-900">Pacientes ativos</h2><p className="text-sm text-slate-500">Registros visíveis conforme RLS e vínculos.</p></div></div><span className="w-fit rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{count ?? 0} registros</span></div><ListToolbar query={query} placeholder="Buscar por nome, CPF, CNS, RA ou registro..." /></div>
      {error ? <p className="p-6 text-sm text-red-700">Não foi possível consultar pacientes. Confirme a migration 008 e as permissões.</p> : pacientesComFoto.length ? <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-slate-50/80 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-3">Paciente</th><th className="px-5 py-3">Registro / RA</th><th className="px-5 py-3">CPF</th><th className="px-5 py-3">Nascimento</th><th className="px-5 py-3">Telefone</th><th className="px-5 py-3 text-right">Ações</th></tr></thead><tbody className="divide-y divide-slate-100">{pacientesComFoto.map((paciente) => <tr key={paciente.id} className="transition hover:bg-slate-50/70"><td className="px-5 py-4"><div className="flex items-center gap-3"><span className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-xl bg-brand-50 text-sm font-semibold text-brand-700" style={paciente.foto_url ? { backgroundImage: `url(${paciente.foto_url})`, backgroundPosition: "center", backgroundSize: "cover" } : undefined}>{paciente.foto_url ? null : (paciente.nome_social || paciente.nome_completo).slice(0, 1).toUpperCase()}</span><div className="font-medium text-slate-900">{paciente.nome_social || paciente.nome_completo}<span className="block text-xs font-normal text-slate-500">{paciente.nome_social ? paciente.nome_completo : ""}</span></div></div></td><td className="px-5 py-4"><span className="block font-medium text-slate-700">#{paciente.numero_registro}</span><span className="text-xs text-brand-700">{paciente.ra}</span></td><td className="px-5 py-4 text-slate-600">{paciente.cpf || "—"}</td><td className="px-5 py-4 text-slate-600">{new Date(`${paciente.data_nascimento}T12:00:00`).toLocaleDateString("pt-BR")}</td><td className="px-5 py-4 text-slate-600">{paciente.telefone || "—"}</td><td className="px-5 py-4 text-right"><RecordDrawer title={paciente.nome_social || paciente.nome_completo} subtitle={`${paciente.ra} · Registro #${paciente.numero_registro}`} photoUrl={paciente.foto_url} fields={[{ label: "Registro", value: String(paciente.numero_registro) }, { label: "RA", value: paciente.ra }, { label: "CPF", value: paciente.cpf }, { label: "CNS", value: paciente.cns }, { label: "Nascimento", value: new Date(`${paciente.data_nascimento}T12:00:00`).toLocaleDateString("pt-BR") }, { label: "Telefone", value: paciente.telefone }, { label: "E-mail", value: paciente.email }]} /></td></tr>)}</tbody></table></div> : <div className="p-10 text-center"><h3 className="font-semibold text-slate-900">Nenhum paciente encontrado</h3><p className="mt-1 text-sm text-slate-500">Busque por nome, documento, RA ou registro.</p></div>}
      <Pagination basePath="/pacientes" page={page} totalPages={totalPages} query={query} />
    </section>
  </SectionPage>;
}
