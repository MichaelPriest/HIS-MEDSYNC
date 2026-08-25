#!/usr/bin/env python3
"""Importa tabelas historicas/comerciais XML para o Supabase.

Uso:
  SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
    python scripts/import-reference-xml.py AMB90.xml CBHPM3.xml glosas.xml deparatuss.xml

O script nao altera os XMLs. Cada item recebe hash da origem e o carregamento e idempotente.
"""
from __future__ import annotations

import hashlib
import json
import os
import re
import sys
import urllib.error
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Any, Iterable

SUPABASE_URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
BATCH = int(os.environ.get("REFERENCE_IMPORT_BATCH", "500"))

TABLES = {
    "AMB90.xml": ("AMB90", "AMB 1990", "AMB", "1990"),
    "AMB92.xml": ("AMB92", "AMB 1992", "AMB", "1992"),
    "AMB96.xml": ("AMB96", "AMB 1996", "AMB", "1996"),
    "AMB99.xml": ("AMB99", "AMB 1999", "AMB", "1999"),
    "AMIL_PAR_06.xml": ("AMIL_PAR_06", "AMIL PAR 06", "OPERADORA", "06"),
    "CBHPM3.xml": ("CBHPM3", "CBHPM 3", "CBHPM", "3"),
    "CBHPM4.xml": ("CBHPM4", "CBHPM 4", "CBHPM", "4"),
    "CBHPM5.xml": ("CBHPM5", "CBHPM 5", "CBHPM", "5"),
    "CBHPM5ver2009.xml": ("CBHPM5_2009", "CBHPM 5 versao 2009", "CBHPM", "5/2009"),
    "CBHPM2014.xml": ("CBHPM2014", "CBHPM 2014", "CBHPM", "2014"),
}


def api(path: str, method: str = "GET", body: Any | None = None, prefer: str | None = None) -> Any:
    if not SUPABASE_URL or not SERVICE_KEY:
        raise SystemExit("Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.")
    data = None if body is None else json.dumps(body, ensure_ascii=False).encode("utf-8")
    headers = {
        "apikey": SERVICE_KEY,
        "Authorization": f"Bearer {SERVICE_KEY}",
        "Content-Type": "application/json",
    }
    if prefer:
        headers["Prefer"] = prefer
    req = urllib.request.Request(f"{SUPABASE_URL}/rest/v1/{path}", data=data, method=method, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=120) as res:
            raw = res.read().decode("utf-8")
            return json.loads(raw) if raw else None
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"Supabase {exc.code}: {detail}") from exc


def batches(rows: list[dict[str, Any]]) -> Iterable[list[dict[str, Any]]]:
    for i in range(0, len(rows), BATCH):
        yield rows[i : i + BATCH]


def num(value: str | None) -> float | None:
    if value is None or not value.strip():
        return None
    try:
        return float(value.replace(",", "."))
    except ValueError:
        return None


def txt(node: ET.Element, *names: str) -> str | None:
    for name in names:
        found = node.find(name)
        if found is not None and found.text is not None:
            return found.text.strip()
    return None


def item_hash(values: dict[str, Any]) -> str:
    raw = json.dumps(values, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def ensure_table(path: Path, count: int) -> str:
    code, name, kind, version = TABLES[path.name]
    payload = [{
        "codigo": code,
        "nome": name,
        "tipo": kind,
        "versao": version,
        "fonte": path.name,
        "status": "historica",
        "metadados": {"arquivo": path.name, "registros": count},
    }]
    api("referencia_tabelas?on_conflict=codigo", "POST", payload, "resolution=merge-duplicates,return=representation")
    found = api(f"referencia_tabelas?codigo=eq.{code}&select=id")
    if not found:
        raise RuntimeError(f"Tabela {code} nao encontrada apos upsert")
    return found[0]["id"]


def parse_procedures(path: Path) -> tuple[str, list[dict[str, Any]]]:
    root = ET.parse(path).getroot()
    table_id = ensure_table(path, len(root))
    rows: list[dict[str, Any]] = []
    for idx, node in enumerate(root, start=1):
        code = txt(node, "codigoAMB", "codigo")
        desc = txt(node, "descricaoAMB", "descricao")
        if not code or not desc:
            continue
        item: dict[str, Any] = {
            "tabela_id": table_id,
            "codigo": code,
            "descricao": desc,
            "quantidade_ch": num(txt(node, "quantidadeCH")),
            "quantidade_aux": num(txt(node, "quantidadeAux")),
            "porte": txt(node, "porte"),
            "fracao_porte": num(txt(node, "fracaoPorte")),
            "valor_porte": num(txt(node, "valorPorte")),
            "custo_operacional": num(txt(node, "custoOperacional")),
            "porte_cirurgico": txt(node, "porteCirurgico"),
            "ch_anestesista": num(txt(node, "CHAnestesista")),
            "porte_anestesista": txt(node, "porteAnestesista"),
            "valor_porte_anestesista": num(txt(node, "valorPorteAnestesista")),
            "quantidade_filme": num(txt(node, "quantidadeFilme")),
            "origem_linha": idx,
            "atributos": {},
        }
        item["origem_hash"] = item_hash(item)
        rows.append(item)
    return table_id, rows


def import_procedures(path: Path) -> None:
    _, rows = parse_procedures(path)
    for part in batches(rows):
        api("referencia_itens?on_conflict=tabela_id,codigo", "POST", part, "resolution=merge-duplicates")
    print(f"{path.name}: {len(rows)} itens importados/atualizados")


def import_glosas(path: Path) -> None:
    root = ET.parse(path).getroot()
    rows = []
    for node in root:
        code, motivo = txt(node, "codigo"), txt(node, "motivo")
        if code and motivo:
            rows.append({"codigo": code, "motivo": motivo, "fonte": path.name, "ativo": True})
    for part in batches(rows):
        api("referencia_glosas?on_conflict=codigo", "POST", part, "resolution=merge-duplicates")
    print(f"{path.name}: {len(rows)} glosas importadas/atualizadas")


def equivalence_rows_from_tree(path: Path) -> list[dict[str, Any]]:
    root = ET.parse(path).getroot()
    rows = []
    for node in root:
        oa = txt(node, "CodigoAMB", "codigo_AMB")
        od = txt(node, "DescricaoAMB", "descricao_AMB")
        da = txt(node, "CodigoTUSS", "codigo_TUSS")
        dd = txt(node, "DescricaoTUSS", "descricao_TUSS")
        if oa and da:
            rows.append({
                "sistema_origem": "AMB", "codigo_origem": oa, "descricao_origem": od,
                "sistema_destino": "TUSS", "codigo_destino": da, "descricao_destino": dd,
                "fonte": path.name, "status": "ativa",
            })
    return rows


def recover_equivalences(path: Path) -> tuple[list[dict[str, Any]], int]:
    raw = path.read_text(encoding="utf-8", errors="replace")
    blocks = re.findall(r"<procedimento>(.*?)</procedimento>", raw, flags=re.S | re.I)
    rows, rejected = [], 0
    def grab(block: str, tag: str) -> str | None:
        m = re.search(rf"<{tag}>(.*?)</{tag}>", block, flags=re.S | re.I)
        if not m:
            return None
        return re.sub(r"\s+", " ", m.group(1)).strip()
    for block in blocks:
        oa, od = grab(block, "codigo_AMB"), grab(block, "descricao_AMB")
        da, dd = grab(block, "codigo_TUSS"), grab(block, "descricao_TUSS")
        if not oa or not da:
            rejected += 1
            continue
        rows.append({
            "sistema_origem": "AMB", "codigo_origem": oa, "descricao_origem": od,
            "sistema_destino": "TUSS", "codigo_destino": da, "descricao_destino": dd,
            "fonte": path.name, "status": "revisar" if not od or not dd else "ativa",
            "observacao": "Importado em modo de recuperacao de XML malformado" if path.name == "dados.xml" else None,
        })
    return rows, rejected


def import_equivalences(path: Path) -> None:
    rejected = 0
    try:
        rows = equivalence_rows_from_tree(path)
    except ET.ParseError:
        rows, rejected = recover_equivalences(path)
    for part in batches(rows):
        api("referencia_equivalencias?on_conflict=sistema_origem,codigo_origem,sistema_destino,codigo_destino,fonte", "POST", part, "resolution=merge-duplicates")
    print(f"{path.name}: {len(rows)} equivalencias importadas; {rejected} blocos rejeitados")


def main(argv: list[str]) -> None:
    if not argv:
        raise SystemExit("Informe um ou mais arquivos XML.")
    for value in argv:
        path = Path(value)
        if not path.exists():
            raise SystemExit(f"Arquivo nao encontrado: {path}")
        if path.name in TABLES:
            import_procedures(path)
        elif path.name == "glosas.xml":
            import_glosas(path)
        elif path.name in {"deparatuss.xml", "dados.xml"}:
            import_equivalences(path)
        else:
            raise SystemExit(f"Layout ainda nao mapeado: {path.name}")


if __name__ == "__main__":
    main(sys.argv[1:])
