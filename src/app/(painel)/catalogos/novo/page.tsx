import Link from "next/link";
import { SectionPage } from "@/components/painel/section-page";
import { criarCatalogo } from "@/modules/catalogos/actions";

const mensagens: Record<string, string> = {
  "campos-obrigatorios": "Informe tipo, código e descrição.",
  duplicado: "Já existe item ativo com este tipo e código nesta empresa.",
  "vigencia-invalida": "A vigência final não pode ser anterior à vigência inicial.",
  "sem-permissao": "Seu perfil não possui a permissão catalogos.criar para esta empresa.",
  "erro-permissao": "Não foi possível validar as permissões do seu usuário. Verifique se as migrations mais recentes foram aplicadas.",
  "schema-desatualizado": "O banco está desatualizado para este tipo de catálogo. Aplique as migrations mais recentes do Supabase.",
  "dados-invalidos": "O banco recusou um dos dados informados. Revise tipo, código, descrição e vigência.",
  "falha-cadastro": "Não foi possível cadastrar o item. O erro técnico foi registrado para diagnóstico.",
};

export default async function NovoCatalogoPage({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const { erro } = await searchParams;
  return <SectionPage eyebrow="Cadastros / Catálogos / Novo" title="Novo item de catálogo" description="Cadastre códigos e descrições reutilizáveis pelos módulos assistenciais e administrativos.">
    <form action={criarCatalogo} className="ui-card p-6">
      {erro && mensagens[erro] ? <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{mensagens[erro]}</div> : null}
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        <label className="space-y-2 text-sm font-medium text-slate-700"><span>Tipo *</span><select name="tipo" required className="ui-input"><option value="">Selecione</option><option value="tipo_profissional">Tipo de profissional</option><option value="especialidade">Especialidade</option><option value="cbo">CBO</option><option value="cid10">CID-10</option><option value="tuss">TUSS</option><option value="tipo_atendimento">Tipo de atendimento</option><option value="motivo_classificacao">Motivo / classificação</option></select></label>
        <label className="space-y-2 text-sm font-medium text-slate-700"><span>Código *</span><input name="codigo" required className="ui-input" /></label>
        <label className="space-y-2 text-sm font-medium text-slate-700"><span>Descrição *</span><input name="descricao" required className="ui-input" /></label>
        <label className="space-y-2 text-sm font-medium text-slate-700"><span>Vigência inicial</span><input name="vigencia_inicio" type="date" className="ui-input" /></label>
        <label className="space-y-2 text-sm font-medium text-slate-700"><span>Vigência final</span><input name="vigencia_fim" type="date" className="ui-input" /></label>
      </div>
      <div className="mt-8 flex justify-end gap-3 border-t border-slate-100 pt-5"><Link href="/catalogos" className="btn-secondary">Cancelar</Link><button className="ui-button-primary">Salvar item</button></div>
    </form>
  </SectionPage>;
}
