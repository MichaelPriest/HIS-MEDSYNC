import { Stethoscope } from "lucide-react";
import { ListToolbar, Pagination } from "@/components/cadastros/list-toolbar";
import { RecordDrawer } from "@/components/cadastros/record-drawer";
import { SectionPage } from "@/components/painel/section-page";
import { StatusToast } from "@/components/painel/status-toast";
import { createClient } from "@/lib/supabase/server";
import { criarUrlFotoAssinada } from "@/modules/cadastros/fotos";

const PAGE_SIZE = 20;

export default async function ProfissionaisPage({ searchParams }: { searchParams: Promise<{ sucesso?: string; q?: string; page?: string }> }) {
  const { sucesso, q: rawQuery, page: rawPage } = await searchParams;
  const query = rawQuery?.trim().slice(0, 80) || "";
  const page = Math.max(1, Number.parseInt(rawPage || "1", 10) || 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const supabase = await createClient();
  let request = supabase.from("profissionais").select("id,nome_completo,cpf,conselho,numero_conselho,uf_conselho,especialidade,cbo,telefone,email,foto_path", { count: "exact" }).eq("ativo", true);
  if (query) request = request.ilike("nome_completo", `%${query}%`);
  const { data, error, count } = await request.order("nome_completo").range(from, to);
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));
  const profissionaisComFoto = await Promise.all((data ?? []).map(async (item) => ({ ...item, foto_url: await criarUrlFotoAssinada(supabase, item.foto_path) })));

  return <SectionPage eyebrow="Cadastros / Profissionais" title="Profissionais" description="Cadastro de profissionais assistenciais e administrativos." primaryActionLabel="Novo profissional" primaryActionHref="/profissionais/novo">
    <StatusToast success={sucesso === "cadastrado" ? "Profissional cadastrado com sucesso." : null} />
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm shadow-slate-900/[0.03]">
      <div className="space-y-4 border-b border-slate-100 p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-brand-50 text-brand-700"><Stethoscope className="size-5" /></span><div><h2 className="font-semibold text-slate-900">Profissionais ativos</h2><p className="text-sm text-slate-500">Equipe cadastrada no escopo autorizado.</p></div></div>
          <span className="w-fit rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{count ?? 0} registros</span>
        </div>
        <ListToolbar query={query} placeholder="Buscar profissional pelo nome..." />
      </div>
      {error ? <p className="p-6 text-sm text-red-700">Não foi possível consultar profissionais. Confirme migration e permissões.</p> : profissionaisComFoto.length ? <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-slate-50/80 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-3">Nome</th><th className="px-5 py-3">Conselho</th><th className="px-5 py-3">Especialidade</th><th className="px-5 py-3">CBO</th><th className="px-5 py-3">Telefone</th><th className="px-5 py-3 text-right">Ações</th></tr></thead><tbody className="divide-y divide-slate-100">{profissionaisComFoto.map((item) => <tr key={item.id} className="transition hover:bg-slate-50/70"><td className="px-5 py-4"><div className="flex items-center gap-3"><span className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-xl bg-brand-50 text-sm font-semibold text-brand-700" style={item.foto_url ? { backgroundImage: `url(${item.foto_url})`, backgroundPosition: "center", backgroundSize: "cover" } : undefined}>{item.foto_url ? null : item.nome_completo.slice(0, 1).toUpperCase()}</span><span className="font-medium text-slate-900">{item.nome_completo}</span></div></td><td className="px-5 py-4 text-slate-600">{[item.conselho,item.numero_conselho,item.uf_conselho].filter(Boolean).join(" ") || "—"}</td><td className="px-5 py-4 text-slate-600">{item.especialidade || "—"}</td><td className="px-5 py-4 text-slate-600">{item.cbo || "—"}</td><td className="px-5 py-4 text-slate-600">{item.telefone || "—"}</td><td className="px-5 py-4 text-right"><RecordDrawer title={item.nome_completo} subtitle={item.especialidade || "Profissional"} photoUrl={item.foto_url} fields={[{ label: "CPF", value: item.cpf }, { label: "Conselho", value: [item.conselho, item.numero_conselho, item.uf_conselho].filter(Boolean).join(" ") }, { label: "Especialidade", value: item.especialidade }, { label: "CBO", value: item.cbo }, { label: "Telefone", value: item.telefone }, { label: "E-mail", value: item.email }]} /></td></tr>)}</tbody></table></div> : <div className="p-10 text-center"><span className="mx-auto grid size-12 place-items-center rounded-2xl bg-slate-100 text-slate-400"><Stethoscope className="size-5" /></span><p className="mt-3 text-sm text-slate-500">Nenhum profissional encontrado.</p></div>}
      <Pagination basePath="/profissionais" page={page} totalPages={totalPages} query={query} />
    </section>
  </SectionPage>;
}
