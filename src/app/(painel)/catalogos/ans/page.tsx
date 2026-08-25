import Link from "next/link";
import { BookOpenCheck, DatabaseZap, ExternalLink, RefreshCw, Search } from "lucide-react";
import { SectionPage } from "@/components/painel/section-page";
import { requireAnyPermission } from "@/lib/permissions/server";
import { importarConceitoTussAns } from "@/modules/ans/actions";
import { ansTussApi, buscarConceitosTuss } from "@/modules/ans/tuss";

const tableLabels: Record<string, string> = {
  "18": "Diárias, taxas e gases medicinais",
  "19": "Materiais e OPME",
  "20": "Medicamentos",
  "22": "Procedimentos e exames",
};

const categories: Record<string, { value: string; label: string }[]> = {
  "18": [
    { value: "diaria", label: "Diária" },
    { value: "taxa", label: "Taxa" },
    { value: "gas_medicinal", label: "Gás medicinal" },
  ],
  "19": [
    { value: "material", label: "Material" },
    { value: "opme", label: "OPME" },
  ],
  "20": [{ value: "medicamento", label: "Medicamento" }],
  "22": [{ value: "procedimento", label: "Procedimento / exame" }],
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AnsTussPage({ searchParams }: {
  searchParams: Promise<{ table?: string; q?: string; page?: string; sucesso?: string; erro?: string; codigo?: string }>;
}) {
  const sp = await searchParams;
  await requireAnyPermission(["catalogos.visualizar", "catalogos.criar"]);
  const table = ansTussApi.supportedTables.includes(sp.table as "18" | "19" | "20" | "22") ? String(sp.table) : "22";
  const query = String(sp.q ?? "").trim().slice(0, 100);
  const page = Math.max(1, Number(sp.page ?? "1") || 1);
  let results: Awaited<ReturnType<typeof buscarConceitosTuss>> = [];
  let apiError = false;
  if (query.length >= 2) {
    try {
      results = await buscarConceitosTuss(table, query, page);
    } catch (error) {
      apiError = true;
      console.error("[catalogos.ans] consultar", error);
    }
  }

  return <SectionPage
    eyebrow="Cadastros / Catálogos / ANS"
    title="Consulta oficial TUSS / ANS"
    description="Pesquise diretamente na API oficial da ANS e importe códigos TUSS para o catálogo assistencial do MedSync."
    actions={<div className="flex gap-2"><Link href="/catalogos" className="ui-button-secondary"><BookOpenCheck className="size-4"/>Catálogos</Link><a href={ansTussApi.documentationUrl} target="_blank" rel="noreferrer" className="ui-button-secondary"><ExternalLink className="size-4"/>Documentação ANS</a></div>}
  >
    {sp.sucesso === "importado" ? <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">Código TUSS {sp.codigo ?? ""} importado/atualizado no catálogo institucional.</div> : null}
    {sp.erro ? <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{sp.erro === "ans-indisponivel" ? "A API da ANS não respondeu no momento. Tente novamente." : sp.erro === "nao-encontrado" ? "O código não foi confirmado novamente na ANS e não foi importado." : sp.erro === "salvar" ? "A ANS confirmou o código, mas o catálogo local não pôde ser atualizado." : "Revise os dados para importação."}</div> : null}

    <section className="ui-card p-5 sm:p-6">
      <div className="flex items-start gap-3"><span className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700"><DatabaseZap className="size-5"/></span><div><h2 className="font-black text-slate-950">API oficial OCLService</h2><p className="mt-1 text-sm text-slate-500">Consulta online, sem cópia estática obrigatória. Ao importar, o MedSync confirma novamente o código na ANS e registra a origem no metadata.</p></div></div>
      <form method="get" className="mt-5 grid gap-3 lg:grid-cols-[280px_1fr_auto]">
        <label className="text-sm font-semibold text-slate-700">Tabela TUSS<select name="table" defaultValue={table} className="ui-input mt-1.5">{ansTussApi.supportedTables.map((item) => <option key={item} value={item}>TUSS {item} · {tableLabels[item]}</option>)}</select></label>
        <label className="text-sm font-semibold text-slate-700">Código ou descrição<input name="q" defaultValue={query} className="ui-input mt-1.5" placeholder="Ex.: consulta, tomografia, dipirona, 10101012"/></label>
        <div className="flex items-end"><button className="ui-button-primary w-full lg:w-auto"><Search className="size-4"/>Consultar ANS</button></div>
      </form>
      {query.length === 1 ? <p className="mt-3 text-xs font-semibold text-amber-700">Digite pelo menos 2 caracteres.</p> : null}
    </section>

    {apiError ? <section className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-5"><div className="flex items-center gap-2 font-black text-amber-900"><RefreshCw className="size-4"/>API da ANS temporariamente indisponível</div><p className="mt-1 text-sm text-amber-800">Nenhum dado local foi alterado. A consulta pode ser repetida com segurança.</p></section> : null}

    {query.length >= 2 && !apiError ? <section className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-5"><div><h2 className="font-black text-slate-950">Resultados oficiais</h2><p className="text-sm text-slate-500">Tabela TUSS {table} · busca “{query}” · página {page}</p></div><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">{results.length} retornados</span></div>
      {results.length ? <div className="divide-y divide-slate-100">{results.map((item, index) => <article key={`${item.code}-${index}`} className="p-4 sm:p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-black text-brand-700">TUSS {table}</span><span className="font-mono text-sm font-black text-slate-900">{item.code}</span></div><p className="mt-2 font-semibold text-slate-800">{item.description}</p></div>
        <form action={importarConceitoTussAns} className="flex flex-col gap-2 sm:flex-row sm:items-end"><input type="hidden" name="table" value={table}/><input type="hidden" name="code" value={item.code}/><input type="hidden" name="query" value={query}/><label className="text-xs font-bold text-slate-500">Categoria<select name="category" defaultValue={categories[table][0].value} className="ui-input mt-1 min-w-44">{categories[table].map((category) => <option key={category.value} value={category.value}>{category.label}</option>)}</select></label><button className="ui-button-primary">Importar para o HIS</button></form></div>
      </article>)}</div> : <div className="p-10 text-center text-sm text-slate-500">Nenhum conceito retornado pela ANS para esta busca.</div>}
      <div className="flex justify-between border-t border-slate-100 p-4"><Link className={`ui-button-secondary ${page <= 1 ? "pointer-events-none opacity-40" : ""}`} href={`/catalogos/ans?table=${table}&q=${encodeURIComponent(query)}&page=${Math.max(1, page - 1)}`}>Anterior</Link><Link className="ui-button-secondary" href={`/catalogos/ans?table=${table}&q=${encodeURIComponent(query)}&page=${page + 1}`}>Próxima</Link></div>
    </section> : null}
  </SectionPage>;
}
