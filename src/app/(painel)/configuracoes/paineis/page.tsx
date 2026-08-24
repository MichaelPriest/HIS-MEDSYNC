import { Hash, MonitorCog, PanelsTopLeft, UserRound, Volume2 } from "lucide-react";
import { SectionPage } from "@/components/painel/section-page";
import { createClient } from "@/lib/supabase/server";
import { salvarConfiguracaoPaineis } from "@/modules/configuracoes-paineis/actions";

export default async function ConfiguracaoPaineisPage({ searchParams }: { searchParams: Promise<{ sucesso?: string; erro?: string }> }) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: vinculo } = user ? await supabase.from("usuario_unidades").select("unidade_id").eq("usuario_id", user.id).eq("ativo", true).limit(1).maybeSingle() : { data: null };
  const { data: cfg } = vinculo?.unidade_id
    ? await supabase.from("configuracoes_painel_chamadas").select("modo,recepcao_chama_todos,chamar_por_nome_apos_identificacao,exibir_senha_apoio,tocar_audio,quantidade_guiches").eq("unidade_id", vinculo.unidade_id).maybeSingle()
    : { data: null };

  const config = cfg ?? {
    modo: "integrado",
    recepcao_chama_todos: true,
    chamar_por_nome_apos_identificacao: true,
    exibir_senha_apoio: true,
    tocar_audio: true,
    quantidade_guiches: 3,
  };

  return <SectionPage eyebrow="Configurações / Atendimento" title="Painéis e chamadas" description="Defina painéis, áudio e os pontos de chamada disponíveis na unidade.">
    {params.sucesso ? <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">Configurações salvas.</div> : null}
    {params.erro ? <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">Não foi possível salvar as configurações.</div> : null}

    <form action={salvarConfiguracaoPaineis} className="ui-card p-6">
      <div className="flex items-center gap-3"><span className="grid size-11 place-items-center rounded-xl bg-brand-50 text-brand-700"><MonitorCog className="size-5"/></span><div><h2 className="font-semibold text-slate-900">Modo de operação</h2><p className="text-sm text-slate-500">A configuração vale para a unidade atual.</p></div></div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <label className="cursor-pointer rounded-2xl border border-slate-200 p-5"><input type="radio" name="modo" value="integrado" defaultChecked={config.modo !== "setorial"} className="accent-brand-700"/><div className="mt-3 flex items-center gap-2 font-semibold text-slate-900"><PanelsTopLeft className="size-4 text-brand-700"/>Painel integrado</div><p className="mt-2 text-sm text-slate-500">A recepção pode concentrar chamadas de todos os setores em um único painel.</p></label>
        <label className="cursor-pointer rounded-2xl border border-slate-200 p-5"><input type="radio" name="modo" value="setorial" defaultChecked={config.modo === "setorial"} className="accent-brand-700"/><div className="mt-3 flex items-center gap-2 font-semibold text-slate-900"><MonitorCog className="size-4 text-violet-600"/>Painéis por setor</div><p className="mt-2 text-sm text-slate-500">Recepção, Enfermagem, Laboratório, Imagem, Farmácia e Internação usam painéis separados.</p></label>
      </div>

      <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50/70 p-5">
        <div className="flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white text-brand-700 shadow-sm"><Hash className="size-4"/></span><div className="flex-1"><label htmlFor="quantidade_guiches" className="block text-sm font-semibold text-slate-900">Número de guichês da Recepção</label><p className="mt-1 text-xs leading-5 text-slate-500">A tela de senhas permitirá chamar somente para os guichês cadastrados aqui.</p><input id="quantidade_guiches" name="quantidade_guiches" type="number" min={1} max={30} step={1} defaultValue={Number(config.quantidade_guiches ?? 3)} className="ui-input mt-3 max-w-32"/></div></div>
      </div>

      <div className="mt-6 grid gap-3 md:grid-cols-2">
        <Toggle name="recepcao_chama_todos" checked={config.recepcao_chama_todos} title="Recepção chama todos os setores" text="Permite que a recepção central faça chamadas de qualquer fila."/>
        <Toggle name="chamar_por_nome_apos_identificacao" checked={config.chamar_por_nome_apos_identificacao} title="Chamar por nome após identificação" text="Após identificar o paciente, usa primeiro nome + inicial no painel." icon="user"/>
        <Toggle name="exibir_senha_apoio" checked={config.exibir_senha_apoio} title="Exibir senha de apoio" text="Mantém a senha junto do nome para facilitar a conferência."/>
        <Toggle name="tocar_audio" checked={config.tocar_audio} title="Áudio nas chamadas" text="Permite chamada por voz nos painéis públicos." icon="audio"/>
      </div>

      <div className="mt-6 flex justify-end border-t border-slate-100 pt-5"><button className="ui-button-primary">Salvar configurações</button></div>
    </form>
  </SectionPage>;
}

function Toggle({ name, checked, title, text, icon }: { name: string; checked: boolean; title: string; text: string; icon?: "user" | "audio" }) {
  const Icon = icon === "user" ? UserRound : icon === "audio" ? Volume2 : PanelsTopLeft;
  return <label className="flex cursor-pointer items-start gap-3 rounded-2xl bg-slate-50 p-4"><input type="checkbox" name={name} defaultChecked={checked} className="mt-1 size-4 accent-brand-700"/><Icon className="mt-0.5 size-4 text-brand-700"/><span><strong className="block text-sm text-slate-900">{title}</strong><span className="mt-1 block text-xs text-slate-500">{text}</span></span></label>;
}
