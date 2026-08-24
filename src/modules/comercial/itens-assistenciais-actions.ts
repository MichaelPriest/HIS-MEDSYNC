"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAnyPermission } from "@/lib/permissions/server";

const route = "/comercial/tabelas/itens";

const categorias = new Set([
  "diaria",
  "taxa",
  "gas_medicinal",
  "material",
  "opme",
  "medicamento",
  "procedimento",
  "pacote",
  "outro",
]);

function text(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();
  return value || null;
}

function decimal(value: string | null) {
  if (!value) return null;
  const normalized = value.replace(/\s/g, "").replace(/\.(?=\d{3}(?:\D|$))/g, "").replace(",", ".");
  const number = Number(normalized);
  return Number.isFinite(number) ? number : null;
}

function tussForCategoria(categoria: string) {
  if (["diaria", "taxa", "gas_medicinal"].includes(categoria)) return 18;
  if (["material", "opme"].includes(categoria)) return 19;
  if (categoria === "medicamento") return 20;
  if (categoria === "procedimento") return 22;
  return null;
}

function normalizarTabelaTuss(categoria: string, raw: string | null) {
  const esperada = tussForCategoria(categoria);
  if (!raw) return esperada;
  const parsed = Number(raw);
  if (![18, 19, 20, 22].includes(parsed)) return null;
  if (esperada !== null && parsed !== esperada) return null;
  return parsed;
}

function bool(value: string | null) {
  if (!value) return false;
  return ["1", "true", "sim", "s", "yes", "on"].includes(value.trim().toLowerCase());
}

function splitCsvLine(line: string, separator: string) {
  const cells: string[] = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (quoted && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === separator && !quoted) {
      cells.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  cells.push(current.trim());
  return cells;
}

function normalizeHeader(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

export async function salvarItemAssistencial(formData: FormData) {
  const { supabase, user, empresaId } = await requireAnyPermission([
    "tabelas_comerciais.gerenciar",
    "estoque.gerenciar",
  ]);

  const codigoInterno = text(formData, "codigo_interno");
  const categoria = text(formData, "categoria") ?? "outro";
  const descricao = text(formData, "descricao");
  if (!codigoInterno || !descricao || !categorias.has(categoria)) redirect(`${route}?erro=campos`);

  const tabelaTuss = normalizarTabelaTuss(categoria, text(formData, "tabela_tuss"));
  if (text(formData, "tabela_tuss") && tabelaTuss === null) redirect(`${route}?erro=tuss-categoria`);

  const payload = {
    empresa_id: empresaId,
    codigo_interno: codigoInterno,
    categoria,
    tabela_tuss: tabelaTuss,
    codigo_tuss: text(formData, "codigo_tuss"),
    descricao,
    unidade_medida: text(formData, "unidade_medida"),
    fabricante: text(formData, "fabricante"),
    marca: text(formData, "marca"),
    apresentacao: text(formData, "apresentacao"),
    principio_ativo: text(formData, "principio_ativo"),
    concentracao: text(formData, "concentracao"),
    forma_farmaceutica: text(formData, "forma_farmaceutica"),
    tipo_opme: text(formData, "tipo_opme"),
    codigo_anvisa: text(formData, "codigo_anvisa"),
    ean: text(formData, "ean"),
    ggrem: text(formData, "ggrem"),
    codigo_brasindice: text(formData, "codigo_brasindice"),
    codigo_simpro: text(formData, "codigo_simpro"),
    cobranca_fracionada: formData.get("cobranca_fracionada") === "on",
    fracao_minima: decimal(text(formData, "fracao_minima")),
    ativo: true,
    updated_at: new Date().toISOString(),
    updated_by: user.id,
    created_by: user.id,
  };

  const { error } = await supabase
    .from("itens_assistenciais")
    .upsert(payload, { onConflict: "empresa_id,codigo_interno" });
  if (error) {
    console.error("[itens-assistenciais] salvar", { code: error.code });
    redirect(`${route}?erro=salvar`);
  }

  revalidatePath(route);
  revalidatePath("/almoxarifado");
  redirect(`${route}?sucesso=salvo`);
}

export async function importarItensAssistenciais(formData: FormData) {
  const { supabase, user, empresaId } = await requireAnyPermission([
    "tabelas_comerciais.gerenciar",
    "estoque.gerenciar",
  ]);
  const arquivo = formData.get("arquivo");
  if (!(arquivo instanceof File) || arquivo.size === 0 || arquivo.size > 15 * 1024 * 1024) {
    redirect(`${route}?erro=arquivo`);
  }

  const raw = (await arquivo.text()).replace(/^\uFEFF/, "");
  const lines = raw.split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) redirect(`${route}?erro=arquivo-vazio`);
  const separator = lines[0].includes(";") ? ";" : ",";
  const headers = splitCsvLine(lines[0], separator).map(normalizeHeader);
  const index = (...names: string[]) => headers.findIndex((header) => names.includes(header));
  const value = (cells: string[], ...names: string[]) => {
    const idx = index(...names);
    return idx >= 0 ? String(cells[idx] ?? "").trim() : "";
  };
  const codigoIndex = index("codigo_interno", "codigo", "codigo_item");
  const descricaoIndex = index("descricao", "nome");
  if (codigoIndex < 0 || descricaoIndex < 0) redirect(`${route}?erro=colunas`);

  const rows = [] as Array<Record<string, unknown>>;
  let rejeitados = 0;
  for (const line of lines.slice(1)) {
    const cells = splitCsvLine(line, separator);
    const codigoInterno = String(cells[codigoIndex] ?? "").trim();
    const descricao = String(cells[descricaoIndex] ?? "").trim();
    const categoria = value(cells, "categoria", "tipo").toLowerCase().replaceAll(" ", "_") || "outro";
    if (!codigoInterno || !descricao || !categorias.has(categoria)) {
      rejeitados += 1;
      continue;
    }
    const tabelaRaw = value(cells, "tabela_tuss", "tabela_tiss", "tabela");
    const tabelaTuss = normalizarTabelaTuss(categoria, tabelaRaw || null);
    if (tabelaRaw && tabelaTuss === null) {
      rejeitados += 1;
      continue;
    }
    rows.push({
      empresa_id: empresaId,
      codigo_interno: codigoInterno,
      categoria,
      tabela_tuss: tabelaTuss,
      codigo_tuss: value(cells, "codigo_tuss", "tuss") || null,
      descricao,
      unidade_medida: value(cells, "unidade_medida", "unidade") || null,
      fabricante: value(cells, "fabricante", "laboratorio") || null,
      marca: value(cells, "marca") || null,
      apresentacao: value(cells, "apresentacao") || null,
      principio_ativo: value(cells, "principio_ativo") || null,
      concentracao: value(cells, "concentracao") || null,
      forma_farmaceutica: value(cells, "forma_farmaceutica") || null,
      tipo_opme: value(cells, "tipo_opme") || null,
      codigo_anvisa: value(cells, "codigo_anvisa", "anvisa", "registro_anvisa") || null,
      ean: value(cells, "ean", "gtin", "codigo_barras") || null,
      ggrem: value(cells, "ggrem") || null,
      codigo_brasindice: value(cells, "codigo_brasindice", "brasindice") || null,
      codigo_simpro: value(cells, "codigo_simpro", "simpro") || null,
      cobranca_fracionada: bool(value(cells, "cobranca_fracionada", "fracionado")),
      fracao_minima: decimal(value(cells, "fracao_minima") || null),
      ativo: !["0", "false", "nao", "não", "n"].includes(value(cells, "ativo").toLowerCase()),
      created_by: user.id,
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    });
  }

  if (!rows.length) redirect(`${route}?erro=sem-itens`);
  for (let start = 0; start < rows.length; start += 500) {
    const { error } = await supabase
      .from("itens_assistenciais")
      .upsert(rows.slice(start, start + 500), { onConflict: "empresa_id,codigo_interno" });
    if (error) {
      console.error("[itens-assistenciais] importar", { code: error.code, start });
      redirect(`${route}?erro=importacao`);
    }
  }

  revalidatePath(route);
  redirect(`${route}?importados=${rows.length}&rejeitados=${rejeitados}`);
}

export async function criarProdutoEstoqueDoItem(formData: FormData) {
  const { supabase, user, empresaId } = await requireAnyPermission(["estoque.gerenciar"]);
  const itemId = text(formData, "item_id");
  if (!itemId) redirect(`${route}?erro=item`);

  const { data: item } = await supabase
    .from("itens_assistenciais")
    .select("id,codigo_interno,categoria,descricao,unidade_medida,codigo_tuss,codigo_brasindice,codigo_simpro,codigo_anvisa,ean,ggrem")
    .eq("id", itemId)
    .eq("empresa_id", empresaId)
    .eq("ativo", true)
    .maybeSingle();
  if (!item) redirect(`${route}?erro=item`);
  if (!["medicamento", "material", "opme", "gas_medicinal"].includes(item.categoria)) {
    redirect(`${route}?erro=nao-estocavel`);
  }

  const { data: existente } = await supabase
    .from("estoque_produtos")
    .select("id")
    .eq("empresa_id", empresaId)
    .eq("item_assistencial_id", item.id)
    .limit(1)
    .maybeSingle();
  if (existente) redirect(`${route}?sucesso=ja-vinculado`);

  const { error } = await supabase.from("estoque_produtos").insert({
    empresa_id: empresaId,
    item_assistencial_id: item.id,
    codigo: item.codigo_interno,
    descricao: item.descricao,
    tipo: item.categoria,
    unidade_medida: item.unidade_medida || "UN",
    codigo_tuss: item.codigo_tuss,
    codigo_brasindice: item.codigo_brasindice,
    codigo_simpro: item.codigo_simpro,
    codigo_anvisa: item.codigo_anvisa,
    ean: item.ean,
    ggrem: item.ggrem,
    estoque_minimo: 0,
    ativo: true,
    created_by: user.id,
    updated_by: user.id,
  });
  if (error) {
    console.error("[itens-assistenciais] criar estoque", { code: error.code });
    redirect(`${route}?erro=estoque`);
  }

  revalidatePath(route);
  revalidatePath("/almoxarifado");
  redirect(`${route}?sucesso=estoque`);
}

export async function inativarItemAssistencial(formData: FormData) {
  const { supabase, user, empresaId } = await requireAnyPermission(["tabelas_comerciais.gerenciar"]);
  const itemId = text(formData, "item_id");
  if (!itemId) redirect(`${route}?erro=item`);
  const { error } = await supabase
    .from("itens_assistenciais")
    .update({ ativo: false, updated_at: new Date().toISOString(), updated_by: user.id })
    .eq("id", itemId)
    .eq("empresa_id", empresaId);
  if (error) redirect(`${route}?erro=inativar`);
  revalidatePath(route);
  redirect(`${route}?sucesso=inativado`);
}
