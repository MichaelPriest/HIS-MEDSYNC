import { BellRing, HeartPulse, UserRound } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PanelAutoRefresh } from "@/components/senhas/panel-auto-refresh";

type Chamada = { senha?: string; nome_chamada?: string | null; identificado?: boolean; setor_nome?: string; setor_codigo?: string; ponto_atendimento?: string; ultima_chamada_em?: string };

export default async function PainelChamadasPage({ params, searchParams }: { params: Promise<{ unidadeId: string }>; searchParams: Promise<{ setor?: string }> }) {
  const { unidadeId } = await params;
  const { setor } = await searchParams;
  const supabase = await createClient();
  const { data: cfg } = await supabase.from("configuracoes_painel_chamadas").select("modo,recepcao_chama_todos").eq("unidade_id", unidadeId).maybeSingle();
  const modoSetorial = cfg?.modo === "setorial" && !cfg?.recepcao_chama_todos;
  const { data } = await supabase.rpc("listar_painel_chamadas", { p_unidade_id: unidadeId });
  let chamadas = (Array.isArray(data) ? data : []) as Chamada[];
  if (modoSetorial && setor) chamadas = chamadas.filter((item) => item.setor_codigo === setor || item.setor_nome?.toLowerCase() === setor.toLowerCase());
  const atual = chamadas[0] ?? null;
  const tituloAtual = atual?.identificado && atual?.nome_chamada ? atual.nome_chamada : atual?.senha ?? "—";
  const nomePainel = modoSetorial ? (atual?.setor_nome || setor || "Setor") : "Todos os setores";
  return <main className="min-h-screen bg-brand-950 p-6 text-white sm:p-10"><PanelAutoRefresh/><div className="mx-auto max-w-7xl">
    <header className="flex items-center justify-between gap-4"><div className="flex items-center gap-3"><span className="grid size-12 place-items-center rounded-2xl bg-white text-brand-950"><HeartPulse className="size-6"/></span><div><h1 className="text-2xl font-bold">Painel de Chamadas · {nomePainel}</h1><p className="text-sm text-white/50">{modoSetorial ? "Painel configurado para chamadas separadas por setor." : "Painel integrado configurado para exibir chamadas de todos os setores."}</p></div></div><BellRing className="size-8 text-white/50"/></header>
    <section className="mt-10 grid gap-6 lg:grid-cols-[1.4fr_0.6fr]">
      <div className="rounded-[2rem] bg-white p-8 text-center text-brand-950 shadow-2xl sm:p-12"><p className="text-sm font-bold uppercase tracking-[0.28em] text-brand-600">Chamada atual</p><div className="mt-5 flex items-center justify-center gap-3">{atual?.identificado ? <UserRound className="size-10 text-brand-600"/> : null}<div className={`${atual?.identificado ? "text-5xl sm:text-7xl" : "text-8xl sm:text-9xl"} font-black tracking-tight`}>{tituloAtual}</div></div>{atual?.identificado ? <p className="mt-4 text-2xl font-bold text-brand-700">Senha {atual?.senha}</p> : null}<p className="mt-7 text-2xl font-bold">{atual?.ponto_atendimento || "Aguarde a próxima chamada"}</p><p className="mt-2 text-base text-slate-500">{atual?.setor_nome ?? "Recepção"}</p></div>
      <aside className="rounded-[2rem] border border-white/10 bg-white/5 p-6 backdrop-blur"><h2 className="text-sm font-bold uppercase tracking-[0.18em] text-white/45">Últimas chamadas</h2><div className="mt-5 space-y-3">{chamadas.slice(1).map((item, index) => <div key={`${item.senha}-${index}`} className="rounded-2xl border border-white/10 bg-white/5 p-4"><div className="flex items-center justify-between gap-3"><strong className="text-xl">{item.identificado && item.nome_chamada ? item.nome_chamada : item.senha}</strong><span className="text-xs text-white/45">{item.ultima_chamada_em ? new Date(item.ultima_chamada_em).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }) : ""}</span></div>{item.identificado ? <p className="mt-1 text-xs font-semibold text-white/50">Senha {item.senha}</p> : null}<p className="mt-1 text-sm text-white/70">{item.ponto_atendimento || item.setor_nome}</p></div>)}{chamadas.length <= 1 ? <p className="rounded-2xl bg-white/5 p-5 text-sm text-white/45">Nenhuma chamada anterior neste painel.</p> : null}</div></aside>
    </section>
    <p className="mt-8 text-center text-sm text-white/40">Fluxo: Recepção → autorização do convênio quando necessária → triagem define especialidade → fila do profissional logado da especialidade.</p>
  </div></main>;
}
