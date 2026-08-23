import { BellRing, HeartPulse } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PanelAutoRefresh } from "@/components/senhas/panel-auto-refresh";

export default async function PainelChamadasPage({ params }: { params: Promise<{ unidadeId: string }> }) {
  const { unidadeId } = await params;
  const supabase = await createClient();
  const { data } = await supabase.rpc("listar_painel_chamadas", { p_unidade_id: unidadeId });
  const chamadas = Array.isArray(data) ? data : [];
  const atual = chamadas[0] ?? null;
  return <main className="min-h-screen bg-brand-950 p-6 text-white sm:p-10"><PanelAutoRefresh/><div className="mx-auto max-w-7xl">
    <header className="flex items-center justify-between gap-4"><div className="flex items-center gap-3"><span className="grid size-12 place-items-center rounded-2xl bg-white text-brand-950"><HeartPulse className="size-6"/></span><div><h1 className="text-2xl font-bold">Painel de Chamadas</h1><p className="text-sm text-white/50">Acompanhe sua senha e o local de atendimento</p></div></div><BellRing className="size-8 text-white/50"/></header>
    <section className="mt-10 grid gap-6 lg:grid-cols-[1.4fr_0.6fr]">
      <div className="rounded-[2rem] bg-white p-8 text-center text-brand-950 shadow-2xl sm:p-12"><p className="text-sm font-bold uppercase tracking-[0.28em] text-brand-600">Senha chamada</p><div className="mt-5 text-8xl font-black tracking-tight sm:text-9xl">{atual?.senha ?? "—"}</div><p className="mt-7 text-2xl font-bold">{atual?.ponto_atendimento || "Aguarde a próxima chamada"}</p><p className="mt-2 text-base text-slate-500">{atual?.setor_nome ?? "Recepção"}</p></div>
      <aside className="rounded-[2rem] border border-white/10 bg-white/5 p-6 backdrop-blur"><h2 className="text-sm font-bold uppercase tracking-[0.18em] text-white/45">Últimas chamadas</h2><div className="mt-5 space-y-3">{chamadas.slice(1).map((item: { senha?: string; setor_nome?: string; ponto_atendimento?: string; ultima_chamada_em?: string }, index: number) => <div key={`${item.senha}-${index}`} className="rounded-2xl border border-white/10 bg-white/5 p-4"><div className="flex items-center justify-between gap-3"><strong className="text-2xl">{item.senha}</strong><span className="text-xs text-white/45">{item.ultima_chamada_em ? new Date(item.ultima_chamada_em).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }) : ""}</span></div><p className="mt-1 text-sm text-white/70">{item.ponto_atendimento || item.setor_nome}</p></div>)}{chamadas.length <= 1 ? <p className="rounded-2xl bg-white/5 p-5 text-sm text-white/45">Nenhuma chamada anterior.</p> : null}</div></aside>
    </section>
    <p className="mt-8 text-center text-sm text-white/40">Mantenha atenção ao painel e aos avisos sonoros do setor.</p>
  </div></main>;
}
