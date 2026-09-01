"use client";

import Link from "next/link";
import type { Route } from "next";
import { useMemo, useState } from "react";
import { BookOpenCheck, CircleAlert, Search, UsersRound } from "lucide-react";
import type { KnowledgeBaseArticle } from "@/modules/knowledge-base/articles";

type Props = {
  articles: KnowledgeBaseArticle[];
  categories: string[];
};

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

export function KnowledgeBaseBrowser({ articles, categories }: Props) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("Todas");

  const filtered = useMemo(() => {
    const needle = normalize(query.trim());
    return articles.filter((article) => {
      if (category !== "Todas" && article.category !== category) return false;
      if (!needle) return true;
      const haystack = normalize([
        article.title,
        article.summary,
        article.category,
        ...article.audience,
        ...article.keywords,
        ...article.steps,
      ].join(" "));
      return haystack.includes(needle);
    });
  }, [articles, category, query]);

  return (
    <div>
      <div className="ui-card p-5">
        <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="ui-input w-full pl-10"
              placeholder="Pesquise por módulo, tarefa ou dúvida: triagem, TISS, laudo, glosa..."
              aria-label="Pesquisar na base de conhecimento"
            />
          </label>
          <div className="flex max-w-full gap-2 overflow-x-auto pb-1 lg:max-w-[46rem]">
            {categories.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setCategory(item)}
                className={`shrink-0 rounded-xl border px-3 py-2 text-xs font-bold transition ${category === item ? "border-brand-300 bg-brand-50 text-brand-800" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"}`}
              >
                {item}
              </button>
            ))}
          </div>
        </div>
        <p className="mt-3 text-xs text-slate-500">{filtered.length} artigo(s) encontrado(s). A busca considera títulos, etapas, público e palavras-chave.</p>
      </div>

      {filtered.length ? (
        <div className="mt-5 grid gap-4 xl:grid-cols-2">
          {filtered.map((article) => (
            <article key={article.slug} id={article.slug} className="ui-card overflow-hidden scroll-mt-24">
              <div className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-brand-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-brand-700">{article.category}</span>
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-400"><UsersRound className="size-3.5" />{article.audience.join(" · ")}</span>
                    </div>
                    <h2 className="text-base font-black text-slate-900">{article.title}</h2>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{article.summary}</p>
                  </div>
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-600"><BookOpenCheck className="size-5" /></span>
                </div>

                <details className="mt-4 rounded-2xl border border-slate-200 bg-slate-50/60">
                  <summary className="cursor-pointer list-none px-4 py-3 text-sm font-black text-slate-800">Ver passo a passo</summary>
                  <div className="border-t border-slate-200 px-4 py-4">
                    <ol className="space-y-3">
                      {article.steps.map((step, index) => (
                        <li key={`${article.slug}-${index}`} className="flex gap-3 text-sm leading-6 text-slate-700">
                          <span className="grid size-6 shrink-0 place-items-center rounded-full bg-brand-100 text-[11px] font-black text-brand-800">{index + 1}</span>
                          <span>{step}</span>
                        </li>
                      ))}
                    </ol>
                    {article.warnings?.length ? (
                      <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3">
                        {article.warnings.map((warning) => <p key={warning} className="flex gap-2 text-xs font-semibold leading-5 text-amber-900"><CircleAlert className="mt-0.5 size-4 shrink-0" />{warning}</p>)}
                      </div>
                    ) : null}
                  </div>
                </details>

                <div className="mt-4 flex flex-wrap gap-2">
                  {article.links.map((link) => (
                    <Link key={`${article.slug}-${link.href}`} href={link.href as Route} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 transition hover:border-brand-200 hover:bg-brand-50 hover:text-brand-800">
                      Abrir {link.label}
                    </Link>
                  ))}
                </div>
              </div>
              <div className="border-t border-slate-100 bg-slate-50 px-5 py-3 text-[10px] text-slate-400">Fontes versionadas: {article.sourceDocs.join(" · ")}</div>
            </article>
          ))}
        </div>
      ) : (
        <div className="ui-card mt-5 p-8 text-center">
          <Search className="mx-auto size-8 text-slate-300" />
          <h2 className="mt-3 font-black text-slate-800">Nenhum artigo encontrado</h2>
          <p className="mt-1 text-sm text-slate-500">Tente outro termo ou selecione a categoria “Todas”.</p>
        </div>
      )}
    </div>
  );
}
