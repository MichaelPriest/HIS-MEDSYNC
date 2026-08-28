import Link from "next/link";
import { AlertTriangle, ArrowLeft, BadgeDollarSign, ShieldCheck, Users } from "lucide-react";
import { ActionPanel } from "@/components/painel/action-panel";
import { SectionPage } from "@/components/painel/section-page";
import { requireAnyPermission } from "@/lib/permissions/server";
import { salvarAlcadaCompra } from "@/modules/compras/actions";

function one<T>(value: T | T[] | null) { return Array.isArray(value) ? value[0] ?? null : value; }
function money(value: number | string | null) {
  if (value === null || value === undefined || value === "") return "Sem teto";
  return `R$ ${Number(value).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const errorMessages: Record<string, string> = {
  "faixa-sobreposta": "A faixa informada se sobrepõe a outra alçada ativa desta unidade.",
  "perfil-sem-aprovacao": "Todos os perfis da alçada precisam possuir a permissão compras.aprovar.",
  "sem-perfis": "Selecione ao menos um perfil autorizador.",
  salvar: "Não foi possível salvar a regra de alçada.",
};

export default async function AlcadasComprasPage({ searchParams }: {
  searchParams: Promise<{ erro?: string; sucesso?: string }>;
}) {
  const sp = await searchParams;
  const { supabase, empresaId, unidadeId } = await requireAnyPermission(["compras.visualizar", "compras.aprovar", "compras.gerenciar"]);
  const [gerenciarGrant, { data: alcadas }, { data: perfis }] = await Promise.all([
    supabase.rpc("tem_permissao", { p_empresa: empresaId, p_unidade: unidadeId, p_codigo: "compras.gerenciar" }),
    supabase.from("compras_alcadas_aprovacao")
      .select("id,nome,valor_min,valor_max,aprovacoes_necessarias,ativo,updated_at,perfis:compras_alcada_perfis(perfil_id,perfil:perfis(id,nome,nivel_acesso,setor_chave))")
      .eq("empresa_id", empresaId).eq("unidade_id", unidadeId)
      .order("valor_min", { ascending: true }),
    supabase.from("perfis")
      .select("id,nome,nivel_acesso,setor_chave,permissoes:perfil_permissoes(permissao:permissoes(codigo))")
      .eq("empresa_id", empresaId).eq("ativo", true)
      .order("nome"),
  ]);
  const canManage = gerenciarGrant.data === true;
  const eligibleProfiles = (perfis ?? []).filter((perfil) => {
    const grants = Array.isArray(perfil.permissoes) ? perfil.permissoes : [];
    return grants.some((grant) => one(grant.permissao)?.codigo === "compras.aprovar");
  });
  const activeRules = (alcadas ?? []).filter((rule) => rule.ativo);

  return <SectionPage
    eyebrow="Compras / Governança"
    title="Alçadas de aprovação"
    description="Defina quem pode comprometer valores de compra por faixa. A regra é congelada no início da aprovação e exige pessoas distintas conforme a quantidade configurada."
    actions={<Link href="/compras" className="btn-secondary"><ArrowLeft className="size-4" />Compras</Link>}
  >
    {sp.sucesso ? <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">Regra de alçada salva com sucesso.</div> : null}
    {sp.erro ? <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{errorMessages[sp.erro] || "Não foi possível concluir a operação."}</div> : null}

    {!activeRules.length ? <div className="mb-5 flex gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-amber-900"><AlertTriangle className="mt-0.5 size-5 shrink-0" /><div><p className="font-black">Nenhuma alçada ativa configurada</p><p className="mt-1 text-sm">Enquanto não houver uma faixa que cubra o valor da cotação, o banco bloqueia a aprovação. Nenhum limite financeiro padrão foi criado automaticamente.</p></div></div> : null}

    <section className="grid gap-3 sm:grid-cols-3">
      <Kpi icon={<BadgeDollarSign className="size-5" />} label="Regras ativas" value={String(activeRules.length)} />
      <Kpi icon={<ShieldCheck className="size-5" />} label="Total de regras" value={String(alcadas?.length ?? 0)} />
      <Kpi icon={<Users className="size-5" />} label="Perfis elegíveis" value={String(eligibleProfiles.length)} />
    </section>

    {canManage ? <div className="mt-5"><ActionPanel title="Nova faixa de aprovação" description="As faixas ativas não podem se sobrepor. Deixe o máximo em branco para uma faixa sem teto.">
      <form action={salvarAlcadaCompra} className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <input name="nome" required className="ui-input" placeholder="Nome da alçada" />
          <input name="valor_min" required inputMode="decimal" className="ui-input" placeholder="Valor mínimo" />
          <input name="valor_max" inputMode="decimal" className="ui-input" placeholder="Valor máximo (opcional)" />
          <input name="aprovacoes_necessarias" required type="number" min="1" max="10" defaultValue="1" className="ui-input" placeholder="Aprovações" />
          <label className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-700"><input type="checkbox" name="ativa" defaultChecked />Ativa</label>
        </div>
        <ProfileSelector profiles={eligibleProfiles} />
        <div className="flex justify-end"><button className="ui-button-primary">Salvar alçada</button></div>
      </form>
    </ActionPanel></div> : <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">Você pode consultar as alçadas, mas somente usuários com <strong>compras.gerenciar</strong> podem alterar a política.</div>}

    <section className="mt-5 space-y-4">
      {(alcadas ?? []).length ? (alcadas ?? []).map((rule) => {
        const links = Array.isArray(rule.perfis) ? rule.perfis : [];
        const selectedIds = new Set(links.map((item) => item.perfil_id));
        const selectedNames = links.map((item) => one(item.perfil)?.nome).filter(Boolean);
        return <article key={rule.id} className="ui-card overflow-hidden">
          <header className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 bg-slate-50/70 px-5 py-4">
            <div><div className="flex items-center gap-2"><h2 className="font-black text-slate-950">{rule.nome}</h2><span className={`rounded-full px-2.5 py-1 text-[11px] font-black uppercase ${rule.ativo ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"}`}>{rule.ativo ? "Ativa" : "Inativa"}</span></div><p className="mt-1 text-sm text-slate-600">{money(rule.valor_min)} até {money(rule.valor_max)} · {rule.aprovacoes_necessarias} aprovação(ões) distinta(s)</p></div>
            <p className="text-xs text-slate-500">Perfis: {selectedNames.length ? selectedNames.join(", ") : "nenhum"}</p>
          </header>
          {canManage ? <form action={salvarAlcadaCompra} className="space-y-4 p-5">
            <input type="hidden" name="alcada_id" value={rule.id} />
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
              <input name="nome" required defaultValue={rule.nome} className="ui-input" />
              <input name="valor_min" required inputMode="decimal" defaultValue={String(rule.valor_min)} className="ui-input" />
              <input name="valor_max" inputMode="decimal" defaultValue={rule.valor_max === null ? "" : String(rule.valor_max)} className="ui-input" placeholder="Sem teto" />
              <input name="aprovacoes_necessarias" required type="number" min="1" max="10" defaultValue={rule.aprovacoes_necessarias} className="ui-input" />
              <label className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-700"><input type="checkbox" name="ativa" defaultChecked={rule.ativo} />Ativa</label>
            </div>
            <ProfileSelector profiles={eligibleProfiles} selectedIds={selectedIds} />
            <div className="flex justify-end"><button className="btn-secondary">Atualizar regra</button></div>
          </form> : null}
        </article>;
      }) : <div className="ui-card p-6 text-sm text-slate-500">Nenhuma regra cadastrada.</div>}
    </section>
  </SectionPage>;
}

function ProfileSelector({ profiles, selectedIds = new Set<string>() }: { profiles: Array<{ id: string; nome: string; nivel_acesso: string; setor_chave: string | null }>; selectedIds?: Set<string> }) {
  return <fieldset><legend className="mb-2 text-xs font-black uppercase tracking-wider text-slate-500">Perfis autorizados a aprovar nesta faixa</legend><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{profiles.length ? profiles.map((profile) => <label key={profile.id} className="flex items-start gap-2 rounded-xl border border-slate-200 p-3 text-sm"><input type="checkbox" name="perfil_id" value={profile.id} defaultChecked={selectedIds.has(profile.id)} className="mt-1" /><span><strong className="block text-slate-900">{profile.nome}</strong><span className="text-xs text-slate-500">{profile.setor_chave || "sem setor"} · {profile.nivel_acesso}</span></span></label>) : <p className="text-sm text-amber-700">Nenhum perfil ativo com permissão compras.aprovar.</p>}</div></fieldset>;
}

function Kpi({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return <div className="his-kpi"><div className="flex items-center gap-2 text-brand-600">{icon}<p className="text-xs font-bold uppercase tracking-wider text-slate-400">{label}</p></div><p className="mt-2 text-3xl font-black text-slate-950">{value}</p></div>;
}
