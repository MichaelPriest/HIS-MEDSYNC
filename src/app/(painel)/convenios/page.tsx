import Link from "next/link";
import { Building2, FileText, Handshake, Search, ShieldCheck } from "lucide-react";
import { CadastrosWorkspaceNav, CadastroKpi } from "@/components/cadastros/cadastros-workspace-nav";
import { SectionPage } from "@/components/painel/section-page";
import { createClient } from "@/lib/supabase/server";
import { criarUrlFotoAssinada } from "@/modules/cadastros/fotos";

export default async function ConveniosPage({ searchParams }: { searchParams: Promise<{ sucesso?: string;q?:string }> }) {
  const { sucesso,q:rawQ } = await searchParams;const q=rawQ?.trim().slice(0,80)||"";
  const supabase = await createClient();
  let request=supabase.from("convenios").select("id,registro_ans,razao_social,nome_fantasia,cnpj,telefone,logo_path",{count:"exact"}).eq("ativo", true);
  if(q)request=request.or(`nome_fantasia.ilike.%${q.replace(/[,%()]/g," ")}%,razao_social.ilike.%${q.replace(/[,%()]/g," ")}%,registro_ans.ilike.%${q.replace(/\D/g,"")}%`);
  const { data, error,count } = await request.order("nome_fantasia").limit(200);
  const convenios = await Promise.all((data ?? []).map(async (item) => ({ ...item, logo_url: await criarUrlFotoAssinada(supabase, item.logo_path) })));
  const comAns=convenios.filter(c=>Boolean(c.registro_ans)).length;
  const semAns=convenios.length-comAns;

  return <SectionPage eyebrow="Cadastros / Convênios" title="Convênios e operadoras" description="Operadoras, identificação ANS e atalhos para contratos, autorizações e faturamento." primaryActionLabel="Novo convênio" primaryActionHref="/convenios/novo">
    <CadastrosWorkspaceNav active="/convenios"/>
    {sucesso === "cadastrado" ? <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">Convênio cadastrado com sucesso.</div> : null}
    <section className="mb-5 grid gap-3 sm:grid-cols-3"><CadastroKpi label="Operadoras ativas" value={count??convenios.length} detail="Disponíveis no atendimento"/><CadastroKpi label="Com registro ANS" value={comAns}/><CadastroKpi label="Sem registro ANS" value={semAns} detail={semAns?"Revisar antes de usar TISS":"Cadastro regulatório completo"}/></section>
    <section className="ui-card overflow-hidden">
      <div className="border-b border-slate-100 p-5"><div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between"><div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-brand-50 text-brand-700"><Building2 className="size-5" /></span><div><h2 className="font-semibold text-slate-900">Carteira de convênios</h2><p className="text-sm text-slate-500">Pesquise por operadora, razão social ou registro ANS.</p></div></div><form className="flex w-full max-w-xl gap-2"><div className="relative flex-1"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400"/><input name="q" defaultValue={q} className="ui-input pl-9" placeholder="Buscar convênio ou ANS..."/></div><button className="ui-button-secondary">Buscar</button></form></div></div>
      {error ? <p className="p-6 text-sm text-red-700">Não foi possível consultar convênios. Confirme migration e permissões.</p> : convenios.length ? <div className="divide-y divide-slate-100">{convenios.map((item) => <article key={item.id} className="p-5 transition hover:bg-slate-50/60"><div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"><div className="flex min-w-0 items-center gap-4"><span className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-xl border border-slate-200 bg-white text-brand-700" style={item.logo_url ? { backgroundImage: `url(${item.logo_url})`, backgroundPosition: "center", backgroundSize: "contain", backgroundRepeat: "no-repeat" } : undefined}>{item.logo_url ? null : <Building2 className="size-5" />}</span><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><Link href={`/convenios/${item.id}`} className="truncate font-bold text-slate-950 hover:text-brand-700">{item.nome_fantasia}</Link><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${item.registro_ans?"bg-emerald-50 text-emerald-700":"bg-amber-50 text-amber-700"}`}>{item.registro_ans?`ANS ${item.registro_ans}`:"ANS pendente"}</span></div><p className="mt-1 truncate text-sm text-slate-500">{item.razao_social}</p><p className="mt-1 text-xs text-slate-400">CNPJ {item.cnpj||"—"} · {item.telefone||"Sem telefone"}</p></div></div><div className="flex flex-wrap gap-2"><Link href={`/convenios/${item.id}`} className="ui-button-primary">Abrir ficha 360°</Link><Link href="/comercial" className="ui-button-secondary"><Handshake className="size-4"/>Contratos</Link><Link href="/central-guias" className="ui-button-secondary"><ShieldCheck className="size-4"/>Guias</Link><Link href="/faturamento" className="ui-button-secondary"><FileText className="size-4"/>Faturamento</Link></div></div></article>)}</div> : <div className="p-10 text-center"><span className="mx-auto grid size-12 place-items-center rounded-2xl bg-slate-100 text-slate-400"><Building2 className="size-5" /></span><h3 className="mt-3 font-semibold text-slate-900">Nenhum convênio encontrado</h3><p className="mt-1 text-sm text-slate-500">Altere a busca ou cadastre uma nova operadora.</p></div>}
    </section>
  </SectionPage>;
}
