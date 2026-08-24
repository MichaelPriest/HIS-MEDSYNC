import { BedDouble, Building2, Hospital, Layers3, MapPinned, Plus, Workflow } from "lucide-react";
import { SectionPage } from "@/components/painel/section-page";
import { requirePermission } from "@/lib/permissions/server";
import { alternarEstruturaFisica, criarEstruturaFisica } from "@/modules/estrutura/actions";

type Estrutura = {
  id: string;
  parent_id: string | null;
  codigo: string;
  nome: string;
  tipo: string;
  capacidade_leitos: number | null;
  permite_internacao: boolean;
  permite_cirurgia: boolean;
  permite_atendimento: boolean;
  ordem: number;
  ativo: boolean;
};

const tipos = [
  ["bloco", "Bloco / Edifício"],
  ["andar", "Andar / Pavimento"],
  ["ala", "Ala"],
  ["setor", "Setor"],
  ["uti", "UTI"],
  ["centro_cirurgico", "Centro Cirúrgico"],
  ["centro_obstetrico", "Centro Obstétrico"],
  ["pronto_socorro", "Pronto-Socorro"],
  ["enfermaria", "Enfermaria"],
  ["ambulatorio", "Ambulatório"],
  ["consultorio", "Consultório"],
  ["sala", "Sala"],
  ["posto_enfermagem", "Posto de Enfermagem"],
  ["apoio", "Área de Apoio"],
  ["outro", "Outro"],
] as const;

function labelTipo(tipo: string) {
  return tipos.find(([value]) => value === tipo)?.[1] ?? tipo.replaceAll("_", " ");
}

function ordenarHierarquia(items: Estrutura[]) {
  const children = new Map<string | null, Estrutura[]>();
  for (const item of items) {
    const list = children.get(item.parent_id) ?? [];
    list.push(item);
    children.set(item.parent_id, list);
  }
  for (const list of children.values()) list.sort((a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome, "pt-BR"));

  const output: Array<Estrutura & { nivel: number }> = [];
  const visit = (parentId: string | null, nivel: number) => {
    for (const item of children.get(parentId) ?? []) {
      output.push({ ...item, nivel });
      visit(item.id, nivel + 1);
    }
  };
  visit(null, 0);
  return output;
}

export default async function EstruturaHospitalarPage({ searchParams }: { searchParams: Promise<{ sucesso?: string; erro?: string }> }) {
  const params = await searchParams;
  const { supabase, unidadeId } = await requirePermission("estrutura.visualizar");
  if (!unidadeId) return <SectionPage eyebrow="Configurações / Estrutura" title="Estrutura hospitalar" description="Selecione uma unidade para configurar a estrutura física." />;

  const { data } = await supabase
    .from("estruturas_fisicas")
    .select("id,parent_id,codigo,nome,tipo,capacidade_leitos,permite_internacao,permite_cirurgia,permite_atendimento,ordem,ativo")
    .eq("unidade_id", unidadeId)
    .order("ordem")
    .order("nome");

  const estruturas = (data ?? []) as Estrutura[];
  const hierarquia = ordenarHierarquia(estruturas);
  const ativas = estruturas.filter((item) => item.ativo);
  const totalLeitosPlanejado = estruturas.reduce((total, item) => total + Number(item.capacidade_leitos ?? 0), 0);

  return <SectionPage eyebrow="Configurações / Estrutura" title="Estrutura hospitalar" description="Cadastre a hierarquia física da unidade: blocos, andares, alas, setores, UTI, centro cirúrgico, enfermarias, consultórios e demais áreas.">
    {params.sucesso ? <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">Estrutura atualizada com sucesso.</div> : null}
    {params.erro ? <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">Não foi possível salvar a estrutura. Verifique código, hierarquia, permissões e dados informados.</div> : null}

    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <Kpi icon={Building2} label="Locais cadastrados" value={String(estruturas.length)} />
      <Kpi icon={Workflow} label="Locais ativos" value={String(ativas.length)} />
      <Kpi icon={Hospital} label="Áreas assistenciais" value={String(estruturas.filter((item) => item.permite_atendimento).length)} />
      <Kpi icon={BedDouble} label="Capacidade planejada" value={`${totalLeitosPlanejado} leitos`} />
    </div>

    <div className="mt-6 grid gap-6 2xl:grid-cols-[minmax(360px,.72fr)_minmax(0,1.28fr)]">
      <form action={criarEstruturaFisica} className="ui-card p-6">
        <div className="flex items-start gap-3 border-b border-slate-100 pb-5"><span className="grid size-11 place-items-center rounded-xl bg-brand-50 text-brand-700"><Plus className="size-5" /></span><div><h2 className="font-semibold text-slate-900">Adicionar local</h2><p className="mt-1 text-sm text-slate-500">Monte a estrutura de cima para baixo: bloco → andar → ala → setor/sala.</p></div></div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <label className="space-y-2 text-sm font-medium text-slate-700 md:col-span-2"><span>Nome *</span><input name="nome" required placeholder="Ex.: UTI Adulto" className="ui-input" /></label>
          <label className="space-y-2 text-sm font-medium text-slate-700"><span>Código</span><input name="codigo" placeholder="Ex.: UTI_ADULTO" className="ui-input uppercase" /><span className="block text-xs font-normal text-slate-400">Se vazio, será gerado a partir do nome.</span></label>
          <label className="space-y-2 text-sm font-medium text-slate-700"><span>Tipo *</span><select name="tipo" required defaultValue="setor" className="ui-input">{tipos.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label className="space-y-2 text-sm font-medium text-slate-700 md:col-span-2"><span>Local superior</span><select name="parent_id" defaultValue="" className="ui-input"><option value="">Raiz da unidade</option>{hierarquia.filter((item) => item.ativo).map((item) => <option key={item.id} value={item.id}>{"— ".repeat(Math.min(item.nivel, 4))}{item.nome} · {labelTipo(item.tipo)}</option>)}</select></label>
          <label className="space-y-2 text-sm font-medium text-slate-700"><span>Capacidade de leitos</span><input name="capacidade_leitos" type="number" min={0} step={1} className="ui-input" /></label>
          <label className="space-y-2 text-sm font-medium text-slate-700"><span>Ordem de exibição</span><input name="ordem" type="number" defaultValue={0} step={1} className="ui-input" /></label>
          <label className="space-y-2 text-sm font-medium text-slate-700 md:col-span-2"><span>Descrição</span><textarea name="descricao" rows={3} className="ui-input" /></label>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <Check name="permite_atendimento" title="Área assistencial" text="Pode receber atendimento/paciente." defaultChecked />
          <Check name="permite_internacao" title="Permite internação" text="Área pode conter leitos de internação." />
          <Check name="permite_cirurgia" title="Permite cirurgia" text="Área pertence ao fluxo cirúrgico." />
          <Check name="criar_setor_operacional" title="Criar setor operacional" text="Vincula a área à tabela de setores quando aplicável." defaultChecked />
        </div>

        <div className="mt-6 flex justify-end border-t border-slate-100 pt-5"><button className="ui-button-primary">Cadastrar estrutura</button></div>
      </form>

      <section className="ui-card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4"><div><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">Hierarquia da unidade</p><h2 className="mt-1 font-semibold text-slate-900">Mapa estrutural</h2></div><span className="inline-flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-500"><MapPinned className="size-4" />{estruturas.length} itens</span></div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-3">Estrutura</th><th className="px-4 py-3">Tipo</th><th className="px-4 py-3">Código</th><th className="px-4 py-3">Capacidade</th><th className="px-4 py-3">Uso</th><th className="px-4 py-3">Status</th><th className="px-5 py-3 text-right">Ação</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {hierarquia.map((item) => <tr key={item.id} className={item.ativo ? "bg-white" : "bg-slate-50/60 text-slate-400"}>
                <td className="px-5 py-3"><div className="flex items-center" style={{ paddingLeft: `${Math.min(item.nivel, 6) * 18}px` }}>{item.nivel ? <span className="mr-2 text-slate-300">└</span> : null}<span className="font-semibold text-slate-800">{item.nome}</span></div></td>
                <td className="px-4 py-3"><span className="rounded-lg bg-brand-50 px-2 py-1 text-xs font-semibold text-brand-700">{labelTipo(item.tipo)}</span></td>
                <td className="px-4 py-3 font-mono text-xs text-slate-500">{item.codigo}</td>
                <td className="px-4 py-3">{item.capacidade_leitos === null ? "—" : `${item.capacidade_leitos} leitos`}</td>
                <td className="px-4 py-3"><div className="flex flex-wrap gap-1">{item.permite_atendimento ? <Tag>Assistencial</Tag> : null}{item.permite_internacao ? <Tag>Internação</Tag> : null}{item.permite_cirurgia ? <Tag>Cirurgia</Tag> : null}{!item.permite_atendimento && !item.permite_internacao && !item.permite_cirurgia ? <span className="text-xs text-slate-400">Estrutural</span> : null}</div></td>
                <td className="px-4 py-3"><span className={`rounded-lg px-2 py-1 text-xs font-semibold ${item.ativo ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{item.ativo ? "Ativo" : "Inativo"}</span></td>
                <td className="px-5 py-3 text-right"><form action={alternarEstruturaFisica}><input type="hidden" name="estrutura_id" value={item.id}/><input type="hidden" name="ativo" value={item.ativo ? "false" : "true"}/><button className="btn-secondary !px-3 !py-1.5 !text-xs">{item.ativo ? "Inativar" : "Reativar"}</button></form></td>
              </tr>)}
              {!hierarquia.length ? <tr><td colSpan={7} className="px-6 py-14 text-center"><Layers3 className="mx-auto size-9 text-slate-300"/><p className="mt-3 font-semibold text-slate-700">Nenhuma estrutura cadastrada</p><p className="mt-1 text-sm text-slate-500">Comece pelo bloco ou andar principal da unidade.</p></td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>

    <div className="mt-6 grid gap-4 md:grid-cols-3">
      <Hint icon={Building2} title="Hierarquia flexível" text="Blocos, andares e alas organizam os setores sem limitar o desenho físico do hospital." />
      <Hint icon={Layers3} title="Leitos e salas" text="Leitos e salas cirúrgicas poderão ser vinculados diretamente ao local físico cadastrado." />
      <Hint icon={Hospital} title="Setores operacionais" text="UTI, centro cirúrgico, enfermaria e outros setores podem ser sincronizados para uso assistencial." />
    </div>
  </SectionPage>;
}

function Kpi({ icon: Icon, label, value }: { icon: typeof Building2; label: string; value: string }) {
  return <div className="ui-card flex items-center gap-4 p-4"><span className="grid size-11 place-items-center rounded-xl bg-brand-50 text-brand-700"><Icon className="size-5" /></span><div><p className="text-xs uppercase tracking-wide text-slate-400">{label}</p><p className="mt-1 text-xl font-black text-slate-900">{value}</p></div></div>;
}

function Check({ name, title, text, defaultChecked = false }: { name: string; title: string; text: string; defaultChecked?: boolean }) {
  return <label className="flex cursor-pointer items-start gap-3 rounded-2xl bg-slate-50 p-4"><input type="checkbox" name={name} defaultChecked={defaultChecked} className="mt-1 size-4 accent-brand-700"/><span><strong className="block text-sm text-slate-900">{title}</strong><span className="mt-1 block text-xs text-slate-500">{text}</span></span></label>;
}

function Tag({ children }: { children: React.ReactNode }) {
  return <span className="rounded-md bg-slate-100 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-600">{children}</span>;
}

function Hint({ icon: Icon, title, text }: { icon: typeof Building2; title: string; text: string }) {
  return <div className="rounded-2xl border border-slate-200 bg-white p-4"><div className="flex items-start gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-slate-50 text-brand-700"><Icon className="size-4" /></span><div><h3 className="text-sm font-semibold text-slate-900">{title}</h3><p className="mt-1 text-xs leading-5 text-slate-500">{text}</p></div></div></div>;
}
