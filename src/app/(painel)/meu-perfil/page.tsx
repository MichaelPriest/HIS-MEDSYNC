import { PhotoField } from "@/components/cadastros/photo-field";
import { SectionPage } from "@/components/painel/section-page";
import { createClient } from "@/lib/supabase/server";
import { criarUrlFotoAssinada } from "@/modules/cadastros/fotos";
import { atualizarMeuPerfil } from "@/modules/usuarios/actions";

export default async function MeuPerfilPage({ searchParams }: { searchParams: Promise<{ sucesso?: string; erro?: string }> }) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: perfil }, { data: vinculos }] = await Promise.all([
    supabase.from("usuarios").select("nome,telefone,cargo,foto_path").eq("id", user.id).maybeSingle(),
    supabase.from("usuario_perfis").select("perfil:perfis(nome),unidade:unidades(nome),empresa:empresas(nome_fantasia)").eq("usuario_id", user.id).eq("ativo", true),
  ]);
  const fotoUrl = await criarUrlFotoAssinada(supabase, perfil?.foto_path ?? null);

  return <SectionPage eyebrow="Conta / Meu Perfil" title="Meu Perfil" description="Dados pessoais do usuário logado, vínculos e perfis de acesso.">
    {params.sucesso ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">Perfil atualizado com sucesso.</div> : null}
    {params.erro ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">Não foi possível atualizar o perfil.</div> : null}
    <div className="grid gap-6 xl:grid-cols-[1fr_0.8fr]">
      <form action={atualizarMeuPerfil} className="ui-card p-6">
        {fotoUrl ? <div className="mb-5 flex items-center gap-3"><span className="size-16 rounded-2xl bg-cover bg-center" style={{ backgroundImage: `url(${fotoUrl})` }} /><div><p className="font-semibold text-slate-900">Foto atual</p><p className="text-sm text-slate-500">Selecione outra imagem para substituir.</p></div></div> : null}
        <PhotoField label="Foto do perfil" />
        <div className="mt-6 grid gap-5 md:grid-cols-2">
          <label className="space-y-2 text-sm font-medium text-slate-700"><span>Nome *</span><input name="nome" required defaultValue={perfil?.nome ?? ""} className="ui-input" /></label>
          <label className="space-y-2 text-sm font-medium text-slate-700"><span>E-mail</span><input value={user.email ?? ""} disabled className="ui-input bg-slate-50" /></label>
          <label className="space-y-2 text-sm font-medium text-slate-700"><span>Telefone</span><input name="telefone" defaultValue={perfil?.telefone ?? ""} className="ui-input" /></label>
          <label className="space-y-2 text-sm font-medium text-slate-700"><span>Cargo</span><input name="cargo" defaultValue={perfil?.cargo ?? ""} className="ui-input" /></label>
        </div>
        <div className="mt-6 flex justify-end border-t border-slate-100 pt-5"><button className="ui-button-primary">Salvar perfil</button></div>
      </form>

      <section className="ui-card p-6"><h2 className="text-lg font-semibold text-slate-950">Acessos e vínculos</h2><p className="mt-1 text-sm text-slate-500">Perfis concedidos ao usuário nas empresas e unidades.</p><div className="mt-5 space-y-3">{vinculos?.length ? vinculos.map((vinculo, index) => { const perfilRel = Array.isArray(vinculo.perfil) ? vinculo.perfil[0] : vinculo.perfil; const unidadeRel = Array.isArray(vinculo.unidade) ? vinculo.unidade[0] : vinculo.unidade; const empresaRel = Array.isArray(vinculo.empresa) ? vinculo.empresa[0] : vinculo.empresa; return <div key={index} className="rounded-xl border border-slate-200 bg-slate-50 p-4"><p className="font-semibold text-slate-900">{perfilRel?.nome ?? "Perfil"}</p><p className="mt-1 text-sm text-slate-600">{empresaRel?.nome_fantasia ?? "Empresa"}{unidadeRel?.nome ? ` · ${unidadeRel.nome}` : " · Todas as unidades"}</p></div>; }) : <p className="text-sm text-slate-500">Nenhum vínculo ativo encontrado.</p>}</div></section>
    </div>
  </SectionPage>;
}
