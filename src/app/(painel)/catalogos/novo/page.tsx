import Link from "next/link";
import { SectionPage } from "@/components/painel/section-page";
import { criarCatalogo } from "@/modules/catalogos/actions";

const mensagens: Record<string, string> = {
  "campos-obrigatorios": "Informe tipo, código e descrição.",
  duplicado: "Já existe item ativo com este tipo e código nesta empresa.",
  "falha-cadastro": "Não foi possível cadastrar o item. Verifique os dados e sua permissão.",
};

export default async function NovoCatalogoPage({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const { erro } = await searchParams;
  return <SectionPage eyebrow="Cadastros / Catálogos / Novo" title="Novo item de catálogo" description="Cadastre códigos e descrições reutilizáveis pelos módulos assistenciais e administrativos.">
    <form action={criarCatalogo} className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      {erro && mensagens[erro] ? <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{mensagens[erro]}</div> : null}
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        <label className="space-y-2 text-sm font-medium text-slate-700"><span>Tipo *</span><select name="tipo" required className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5"><option value="">Selecione</option><option value="especialidade">Especialidade</option><option value="cbo">CBO</option><option value="cid10">CID-10</option><option value="tuss">TUSS</option><option value="tipo_atendimento">Tipo de atendimento</option><option value="motivo_classificacao">Motivo / classificação</option></select></label>
        <label className="space-y-2 text-sm font-medium text-slate-700"><span>Código *</span><input name="codigo" required className="w-full rounded-lg border border-slate-300 px-3 py-2.5" /></label>
        <label className="space-y-2 text-sm font-medium text-slate-700"><span>Descrição *</span><input name="descricao" required className="w-full rounded-lg border border-slate-300 px-3 py-2.5" /></label>
        <label className="space-y-2 text-sm font-medium text-slate-700"><span>Vigência inicial</span><input name="vigencia_inicio" type="date" className="w-full rounded-lg border border-slate-300 px-3 py-2.5" /></label>
        <label className="space-y-2 text-sm font-medium text-slate-700"><span>Vigência final</span><input name="vigencia_fim" type="date" className="w-full rounded-lg border border-slate-300 px-3 py-2.5" /></label>
      </div>
      <div className="mt-8 flex justify-end gap-3 border-t border-slate-100 pt-5"><Link href="/catalogos" className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700">Cancelar</Link><button className="rounded-lg bg-brand-950 px-4 py-2 text-sm font-semibold text-white">Salvar item</button></div>
    </form>
  </SectionPage>;
}
