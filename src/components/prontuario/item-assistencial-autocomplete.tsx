"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Item = {
  id: string;
  codigo_interno: string;
  categoria: string;
  descricao: string;
  unidade_medida: string | null;
  apresentacao: string | null;
  concentracao: string | null;
  codigo_tuss: string | null;
};

const categoriaLabel: Record<string, string> = {
  medicamento: "Medicamento",
  material: "Material",
  opme: "OPME",
  gas_medicinal: "Gás medicinal",
  procedimento: "Procedimento / exame",
  outro: "Outro",
};

export function ItemAssistencialAutocomplete({ empresaId }: { empresaId: string }) {
  const supabase = useMemo(() => createClient(), []);
  const [termo, setTermo] = useState("");
  const [selecionado, setSelecionado] = useState<Item | null>(null);
  const [resultados, setResultados] = useState<Item[]>([]);
  const [carregando, setCarregando] = useState(false);
  const seq = useRef(0);

  useEffect(() => {
    const q = termo.trim();
    if (selecionado || q.length < 2) {
      setResultados([]);
      setCarregando(false);
      return;
    }

    const atual = ++seq.current;
    const timer = window.setTimeout(async () => {
      setCarregando(true);
      const base = () => supabase
        .from("itens_assistenciais")
        .select("id,codigo_interno,categoria,descricao,unidade_medida,apresentacao,concentracao,codigo_tuss")
        .eq("empresa_id", empresaId)
        .eq("ativo", true)
        .in("categoria", ["medicamento", "material", "opme", "gas_medicinal", "procedimento", "outro"]);

      const [porDescricao, porCodigo, porTuss] = await Promise.all([
        base().ilike("descricao", `%${q}%`).order("descricao").limit(20),
        base().ilike("codigo_interno", `%${q}%`).order("descricao").limit(10),
        base().ilike("codigo_tuss", `%${q}%`).order("descricao").limit(10),
      ]);

      if (atual !== seq.current) return;
      const unicos = new Map<string, Item>();
      for (const item of [...(porDescricao.data ?? []), ...(porCodigo.data ?? []), ...(porTuss.data ?? [])] as Item[]) {
        unicos.set(item.id, item);
      }
      setResultados([...unicos.values()].slice(0, 25));
      setCarregando(false);
    }, 220);

    return () => window.clearTimeout(timer);
  }, [empresaId, selecionado, supabase, termo]);

  return (
    <div className="relative md:col-span-2 xl:col-span-4">
      <input type="hidden" name="item_assistencial_id" value={selecionado?.id ?? ""} />
      <label className="block space-y-2 text-sm font-semibold text-slate-700">
        <span>Medicamento, material, exame ou procedimento *</span>
        <span className="relative block">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <input
            value={selecionado ? [selecionado.descricao, selecionado.concentracao, selecionado.apresentacao].filter(Boolean).join(" · ") : termo}
            onChange={(event) => {
              setSelecionado(null);
              setTermo(event.target.value);
            }}
            autoComplete="off"
            className="ui-input pl-10 pr-10"
            placeholder="Comece a digitar: dipirona, ceftriaxona, hemograma, tomografia..."
            required={!selecionado}
          />
          {(selecionado || termo) ? (
            <button
              type="button"
              aria-label="Limpar item"
              onClick={() => { setSelecionado(null); setTermo(""); setResultados([]); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
            >
              <X className="size-4" />
            </button>
          ) : null}
        </span>
      </label>

      {!selecionado && termo.trim().length >= 2 ? (
        <div className="absolute z-30 mt-1 max-h-80 w-full overflow-auto rounded-xl border border-slate-200 bg-white p-1 shadow-xl">
          {carregando ? <p className="px-3 py-3 text-sm text-slate-500">Localizando no catálogo...</p> : null}
          {!carregando && resultados.length === 0 ? <p className="px-3 py-3 text-sm text-slate-500">Nenhum item ativo encontrado.</p> : null}
          {resultados.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => { setSelecionado(item); setTermo(""); setResultados([]); }}
              className="block w-full rounded-lg px-3 py-2.5 text-left hover:bg-slate-50"
            >
              <span className="block text-sm font-bold text-slate-900">{item.descricao}</span>
              <span className="mt-0.5 block text-xs text-slate-500">
                {categoriaLabel[item.categoria] ?? item.categoria}
                {item.concentracao ? ` · ${item.concentracao}` : ""}
                {item.apresentacao ? ` · ${item.apresentacao}` : ""}
                {item.codigo_tuss ? ` · TUSS ${item.codigo_tuss}` : ""}
              </span>
            </button>
          ))}
        </div>
      ) : null}

      {selecionado ? (
        <p className="mt-2 text-xs font-semibold text-emerald-700">
          Selecionado do catálogo institucional: {categoriaLabel[selecionado.categoria] ?? selecionado.categoria}. O vínculo com estoque é tratado internamente.
        </p>
      ) : (
        <p className="mt-2 text-xs text-slate-500">Os resultados aparecem automaticamente enquanto você digita. Não é necessário abrir ou escolher produto de estoque.</p>
      )}
    </div>
  );
}
