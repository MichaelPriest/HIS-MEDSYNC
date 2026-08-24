import { BellRing, HeartPulse, MapPin, UserRound } from "lucide-react";
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

  // Um link com ?setor= sempre representa um painel exclusivo daquele setor,
  // independentemente de a configuração geral da unidade ser integrada ou setorial.
  if (setor) {
    const alvo = setor.toLowerCase();
    chamadas = chamadas.filter((item) => item.setor_codigo?.toLowerCase() === alvo || item.setor_nome?.toLowerCase() === alvo);
  }

  const atual = chamadas[0] ?? null;
  const tituloAtual = atual?.identificado && atual?.nome_chamada ? atual.nome_chamada : atual?.senha ?? "—";
  const nomePainel = setor ? (atual?.setor_nome || setor) : modoSetorial ? "Painel setorial" : "Todos os setores";

  return (
    <main className="min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top_right,_rgba(37,99,235,.24),_transparent_26%),linear-gradient(145deg,#07162f_0%,#0b1f44_55%,#10295a_100%)] p-5 text-white sm:p-8 lg:p-10">
      <div className="mx-auto max-w-7xl ui-page-enter">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-white/[0.08] pb-6">
          <div className="flex items-center gap-4">
            <span className="grid size-13 place-items-center rounded-2xl bg-gradient-to-br from-cyan-400 to-blue-500 text-white shadow-xl shadow-blue-950/30"><HeartPulse className="size-6" /></span>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-200/50">MedSync · Painel de Chamadas</p>
              <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">{nomePainel}</h1>
              <p className="mt-1 text-sm text-white/45">{setor ? "Painel exclusivo do setor selecionado." : modoSetorial ? "Chamadas organizadas por setor." : "Painel integrado com chamadas de todos os setores."}</p>
            </div>
          </div>
          <PanelAutoRefresh
            chamada={atual ? {
              senha: atual.senha,
              nome: atual.nome_chamada,
              identificado: atual.identificado,
              ponto: atual.ponto_atendimento,
              setor: atual.setor_nome,
              ultimaChamadaEm: atual.ultima_chamada_em,
            } : null}
          />
        </header>

        <section className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1.55fr)_minmax(330px,.45fr)]">
          <div className="relative overflow-hidden rounded-[32px] bg-white p-8 text-center text-[#0b1f44] shadow-2xl shadow-black/20 sm:p-12 lg:p-14">
            <div className="pointer-events-none absolute -right-20 -top-20 size-56 rounded-full bg-brand-100 blur-3xl" />
            <div className="relative">
              <p className="text-[11px] font-black uppercase tracking-[0.28em] text-brand-600">Chamada atual</p>
              <div className="mt-8 flex items-center justify-center gap-4">
                {atual?.identificado ? <span className="grid size-14 place-items-center rounded-2xl bg-brand-50 text-brand-600"><UserRound className="size-7" /></span> : null}
                <div className={`${atual?.identificado ? "text-5xl sm:text-7xl" : "text-8xl sm:text-[8.5rem]"} font-black leading-none tracking-tight`}>{tituloAtual}</div>
              </div>
              {atual?.identificado ? <p className="mt-5 text-2xl font-black text-brand-700">Senha {atual?.senha}</p> : null}

              <div className="mx-auto mt-9 max-w-xl rounded-[22px] border border-slate-100 bg-slate-50 p-5 sm:p-6">
                <div className="flex items-center justify-center gap-2 text-slate-400"><MapPin className="size-4" /><span className="text-xs font-bold uppercase tracking-[0.14em]">Dirija-se para</span></div>
                <p className="mt-2 text-2xl font-black text-slate-900 sm:text-3xl">{atual?.ponto_atendimento || "Aguarde a próxima chamada"}</p>
                <p className="mt-2 text-sm font-semibold text-slate-500">{atual?.setor_nome ?? (setor || "Recepção")}</p>
              </div>
            </div>
          </div>

          <aside className="rounded-[28px] border border-white/10 bg-white/[0.055] p-5 backdrop-blur-xl sm:p-6">
            <div className="flex items-center justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/35">Histórico</p><h2 className="mt-1 text-lg font-bold">Últimas chamadas</h2></div><span className="grid size-10 place-items-center rounded-xl bg-white/[0.07] text-cyan-300"><BellRing className="size-5" /></span></div>
            <div className="mt-5 space-y-3">
              {chamadas.slice(1).map((item, index) => (
                <div key={`${item.senha}-${item.ultima_chamada_em ?? index}`} className="rounded-2xl border border-white/[0.08] bg-white/[0.05] p-4 transition hover:bg-white/[0.08]">
                  <div className="flex items-start justify-between gap-3"><strong className="text-lg leading-tight">{item.identificado && item.nome_chamada ? item.nome_chamada : item.senha}</strong><span className="shrink-0 rounded-lg bg-white/[0.06] px-2 py-1 text-[10px] font-bold text-white/40">{item.ultima_chamada_em ? new Date(item.ultima_chamada_em).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }) : ""}</span></div>
                  {item.identificado ? <p className="mt-1 text-xs font-semibold text-cyan-200/55">Senha {item.senha}</p> : null}
                  <p className="mt-2 text-sm text-white/55">{item.ponto_atendimento || item.setor_nome}</p>
                </div>
              ))}
              {chamadas.length <= 1 ? <p className="rounded-2xl border border-white/[0.06] bg-white/[0.035] p-5 text-sm text-white/40">Nenhuma chamada anterior neste painel.</p> : null}
            </div>
          </aside>
        </section>

        <footer className="mt-7 flex items-center justify-center gap-2 text-center text-xs text-white/30"><span className="size-1.5 rounded-full bg-cyan-400/60" />Acompanhe a senha no painel e aguarde a orientação da equipe.</footer>
      </div>
    </main>
  );
}
