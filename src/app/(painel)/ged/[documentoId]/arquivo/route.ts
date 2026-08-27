import { NextRequest, NextResponse } from "next/server";
import { getRequestAuthContext } from "@/lib/auth/request-context";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ documentoId: string }> },
) {
  const { documentoId } = await params;
  const { supabase, user } = await getRequestAuthContext();
  if (!user) return NextResponse.redirect(new URL("/login", request.url));

  const { data: doc, error } = await supabase
    .from("ged_documentos")
    .select("id,nome_arquivo,storage_bucket,storage_path")
    .eq("id", documentoId)
    .maybeSingle();

  if (error || !doc) {
    return NextResponse.json({ error: "Documento não encontrado ou sem permissão." }, { status: 404 });
  }

  const download = request.nextUrl.searchParams.get("download") === "1";
  const { data, error: signedError } = await supabase.storage
    .from(doc.storage_bucket)
    .createSignedUrl(
      doc.storage_path,
      60,
      download ? { download: doc.nome_arquivo } : undefined,
    );

  if (signedError || !data?.signedUrl) {
    return NextResponse.json({ error: "Arquivo indisponível no Storage." }, { status: 404 });
  }

  return NextResponse.redirect(data.signedUrl, 307);
}
