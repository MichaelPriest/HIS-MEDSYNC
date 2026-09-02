import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(_request: Request, { params }: { params: Promise<{ xmlId: string }> }) {
  const { xmlId } = await params;
  const supabase = await createClient();
  const { data: xml } = await supabase.from("tiss_xmls").select("id,lote_id,tipo_mensagem,xml_conteudo,xsd_validado,lote:tiss_lotes(numero_lote)").eq("id", xmlId).maybeSingle();
  if (!xml) return NextResponse.json({ error: "XML não encontrado" }, { status: 404 });
  if (!xml.xsd_validado) return NextResponse.json({ error: "XML ainda não validado contra XSD oficial" }, { status: 409 });

  const lote = Array.isArray(xml.lote) ? xml.lote[0] : xml.lote;
  const nome = `tiss-${lote?.numero_lote ?? xml.lote_id ?? "documento"}-${xml.tipo_mensagem}.xml`.replace(/[^a-zA-Z0-9._-]/g, "-");
  const latin1 = /<\?xml[^>]*encoding=["']ISO-8859-1["']/i.test(xml.xml_conteudo);
  const bytes = new Uint8Array(Buffer.from(xml.xml_conteudo, latin1 ? "latin1" : "utf8"));

  return new Response(bytes, {
    status: 200,
    headers: {
      "Content-Type": `application/xml; charset=${latin1 ? "iso-8859-1" : "utf-8"}`,
      "Content-Disposition": `attachment; filename="${nome}"`,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
