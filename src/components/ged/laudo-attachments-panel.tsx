import Link from "next/link";
import type { Route } from "next";
import { FileCheck2, FileLock2, Files, FileUp } from "lucide-react";
import { GedUploadForm } from "@/components/ged/ged-upload-form";
import { getCurrentNavigationAccess } from "@/lib/permissions/server-navigation";

type Props = {
  tipo: "laboratorio" | "imagem";
  laudoId: string;
};

export async function LaudoAttachmentsPanel({ tipo, laudoId }: Props) {
  const { supabase, grantedPermissions } = await getCurrentNavigationAccess();
  const relation = tipo === "laboratorio" ? "laboratorio_laudo_id" : "imagem_laudo_id";
  const setorWritePermissions = tipo === "laboratorio"
    ? ["laboratorio.gerenciar", "laboratorio.laudar", "laboratorio.liberar"]
    : ["imagem.gerenciar", "imagem.laudar", "imagem.liberar_laudo"];
  const hasGedWrite = ["ged.enviar", "ged.gerenciar", "ged.administrar"].some((code) => grantedPermissions.includes(code));
  const hasSectorWrite = setorWritePermissions.some((code) => grantedPermissions.includes(code));
  const canUpload = grantedPermissions.includes("ged.administrar") || (hasGedWrite && hasSectorWrite);

  const { data: docs } = await supabase
    .from("ged_documentos")
    .select("id,titulo,nome_arquivo,mime_type,versao,status,confidencial,assinado_em,created_at")
    .eq(relation, laudoId)
    .neq("status", "cancelado")
    .order("created_at", { ascending: false })
    .limit(50);
  const rows = docs ?? [];
  const activeRows = rows.filter((doc) => doc.status === "ativo");

  if (!rows.length && !canUpload) return null;

  return (
    <section className="his-card mt-5 overflow-hidden">
      <div className="flex flex-col gap-4 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="flex items-start gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-brand-50 text-brand-700"><Files className="size-5" /></span>
          <div>
            <h2 className="font-black text-slate-950">Anexos do laudo</h2>
            <p className="mt-1 text-sm text-slate-500">Documentos versionados no GED e vinculados diretamente a este laudo.</p>
          </div>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">{activeRows.length} ativo{activeRows.length === 1 ? "" : "s"}</span>
      </div>

      {rows.length ? (
        <div className="divide-y divide-slate-100">
          {rows.map((doc) => (
            <div key={doc.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate font-bold text-slate-900">{doc.titulo}</p>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">v{doc.versao}</span>
                  {doc.status !== "ativo" ? <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold capitalize text-amber-700">{doc.status}</span> : null}
                  {doc.confidencial ? <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-700"><FileLock2 className="size-3" />Confidencial</span> : null}
                  {doc.assinado_em ? <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700"><FileCheck2 className="size-3" />Assinado</span> : null}
                </div>
                <p className="mt-1 truncate text-xs text-slate-500">{doc.nome_arquivo} · {new Date(doc.created_at).toLocaleString("pt-BR")}</p>
              </div>
              <Link href={`/ged/${doc.id}` as Route} className="btn-secondary h-9 shrink-0 text-xs">Abrir anexo</Link>
            </div>
          ))}
        </div>
      ) : <div className="px-5 py-5 text-sm text-slate-500">Nenhum anexo documental vinculado a este laudo.</div>}

      {canUpload ? (
        <details className="border-t border-slate-100 bg-slate-50/50">
          <summary className="flex cursor-pointer list-none items-center gap-2 px-5 py-4 text-sm font-black text-brand-700"><FileUp className="size-4" />Adicionar anexo</summary>
          <div className="border-t border-slate-100 p-5">
            <GedUploadForm
              compact
              laboratorioLaudoId={tipo === "laboratorio" ? laudoId : null}
              imagemLaudoId={tipo === "imagem" ? laudoId : null}
              defaultTitulo={`Anexo do laudo de ${tipo === "laboratorio" ? "laboratório" : "imagem"}`}
              defaultCategoria="clinico"
              defaultSubcategoria={tipo === "laboratorio" ? "laboratorio" : "imagem"}
              defaultConfidencial
            />
          </div>
        </details>
      ) : null}
    </section>
  );
}
