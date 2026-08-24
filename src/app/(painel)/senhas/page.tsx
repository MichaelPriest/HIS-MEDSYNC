import Link from "next/link";
import { BellRing, Clock3, PlayCircle, TicketCheck, UserCheck } from "lucide-react";
import { SectionPage } from "@/components/painel/section-page";
import { QueueAutoRefresh } from "@/components/senhas/queue-auto-refresh";
import { asRoute } from "@/lib/route-cast";
import { chamarProximaSenha, chamarSenha, iniciarAtendimentoSenha } from "@/modules/senhas/actions";
import { getAssistencialContext } from "@/modules/assistencial/context";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function dataSaoPaulo() {
  const parts = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

function horaSaoPaulo(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function mascararCpf(cpf?: string | null) {
  const d = String(cpf ?? "").replace(/\D/g, "");
  return d.length === 11 ? `***.***.***-${d.slice(-2)}` : "CPF identificado";
}

function mensagemErroFila(erro?: string) {
  if (!erro) return null;
  const mensagens: Record<string, string> = {
    "guiche-invalido": "O guichê informado não está habilitado nas configurações da unidade.",
    "sem-fila": "Não há senhas aguardando chamada neste momento.",
    "senha-indisponivel": "Essa senha não está mais disponível para a ação. A fila pode ter sido atualizada por outro guichê.",
    "falha-consulta": "Não foi possível consultar a fila agora. Atualize a página e tente novamente.",
    "falha-atualizacao": "Não foi possível atualizar a senha. O erro técnico foi registrado para análise.",
  };
  return mensagens[erro] ?? "Não foi possível concluir a ação da fila. O erro técnico foi registrado para análise.";
}

function GuicheSelect({ guiches, compact = false, disabled = false }: { guiches: string[]; compact?: boolean; disabled?: boolean }) {
  return <select name="ponto_atendimento" required defaultValue="" disabled={disabled} className={`ui-input ${compact ? "h-9 w-36 py-1.5" : "min-w-44"} disabled:cursor-not-allowed disabled:opacity-60`}>
    <option value="" disabled>Selecionar guichê</option>
    {guiches.map((guiche) => <option key={guiche} value={guiche}>{guiche}</option>)}
  </select>;
}

export default async function SenhasPage({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const { erro } = await searchParams;
  const { supabase, unidadeId } = await getAssistencialContext();
  const hoje = dataSaoPaulo();

  const [{ data: setores, error: setoresError }, { data: configPainel }] = await Promise.all([
    supabase.from("setores_chamada").select("id,nome,codigo").eq("unidade_id", unidadeId).eq("ativo", true).order("ordem"),
    supabase.from("configuracoes_painel_chamadas").select("quantidade_guiches").eq("unidade_id", unidadeId).maybeSingle(),
  ]);

  const quantidadeGuiches = Math.max(1, Math.min(Number(configPainel?.quantidade_guiches ?? 3), 30));
  const guiches = Array.from({ length: quantidadeGuiches }, (_, index) => `Guichê ${String(index + 1).padStart(2, "0")}`);
  const recepcao = setores?.find((item) => item.codigo === "recepcao");

  const { data: senhas, error: senhasError } = recepcao
    ? await supabase.from("senhas_atendimento").select("id,senha,prioridade,status,emitida_em,ponto_atendimento,paciente_id,atendimento_id,sequencial").eq("unidade_id", unidadeId).eq("setor_id", recepcao.id).eq("data_referencia", hoje).in("status", ["aguardando", "chamada", "em_atendimento"]).order("sequencial")
    : { data: [], error: null };

  const pacienteIds = [...new Set((senhas ?? []).map((s) => s.paciente_id).filter((id): id is string => Boolean(id)))];
  const { data: pacientes, error: pacientesError } = pacienteIds.length
    ? await supabase.from("pacientes").select("id,nome_completo,nome_social,cpf").in("id", pacienteIds)
    : { data: [], error: null };

  if (setoresError || senhasError || pacientesError) {
    console.error("[senhas] falha ao carregar fila da recepcao", { setores: setoresError?.code, senhas: senhasError?.code, pacientes: pacientesError?.code, unidadeId, hoje });
  }

  const pacientesPorId = new Map((pacientes ?? []).map((p) => [p.id, p]));
  const aguardando = (senhas ?? []).filter((s) => s.status === "aguardando").length;
  const chamadas = (senhas ?? []).filter((s) => s.status === "chamada").length;
  const identificadas = (senhas ?? []).filter((s) => Boolean(s.paciente_id)).length;
  const emAdmissao = (senhas ?? []).filter((s) => s.status === "em_atendimento" && !s.atendimento_id).length;
  const mensagemErro = mensagemErroFila(erro);

  return <SectionPage eyebrow="Recepção / Senhas" title="Fila de Senhas · Recepção" description="As senhas emitidas no Totem aparecem automaticamente nesta fila. Emergência, preferencial e normal são priorizadas na chamada.">
    {mensagemErro ? <div className={`rounded-xl border p-4 text-sm ${erro === "sem-fila" ? "border-sky-200 bg-sky-50 text-sky-800" : "border-rose-200 bg-rose-50 text-rose-700"}`}>{mensagemErro}</div> : null}
    {setoresError || senhasError || pacientesError ? <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">A fila não pôde ser atualizada completamente. O erro técnico foi registrado no servidor.</div> : null}
    {!recepcao ? <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">O setor Recepção não está configurado para esta unidade.</div> : null}
    {emAdmissao > 0 ? <div className="mt-3 rounded-xl border border-violet-200 bg-violet-50 p-4 text-sm text-violet-800"><strong>{emAdmissao} admissão(ões) em andamento.</strong> Se você saiu para cadastrar um paciente ou consultar outro módulo, use “Continuar admissão” na própria senha.</div> : null}

    <section className="mt-4 grid gap-3 sm:grid-cols-4">
      <div className="ui-card p-4"><p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Aguardando</p><p className="mt-2 text-3xl font-black text-brand-950">{aguardando}</p></div>
      <div className="ui-card p-4"><p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Chamadas</p><p className="mt-2 text-3xl font-black text-violet-700">{chamadas}</p></div>
      <div className="ui-card p-4"><p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Em admissão</p><p className="mt-2 text-3xl font-black text-amber-700">{emAdmissao}</p></div>
      <div className="ui-card p-4"><p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Identificadas por CPF</p><p className="mt-2 text-3xl font-black text-emerald-700">{identificadas}</p></div>
    </section>

    <section className="ui-card mt-5 p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div><h2 className="flex items-center gap-2 font-semibold text-slate-900"><TicketCheck className="size-5 text-brand-700"/>Recepção</h2><p className="mt-1 text-sm text-slate-500">{aguardando > 0 ? `Selecione um dos ${quantidadeGuiches} guichês configurados e chame a próxima senha.` : "Aguardando uma nova senha do Totem. A fila será atualizada automaticamente."}</p></div>
        <div className="flex flex-wrap items-center gap-2"><QueueAutoRefresh unidadeId={unidadeId}/>{recepcao ? <form action={chamarProximaSenha} className="flex flex-col gap-2 sm:flex-row"><input type="hidden" name="setor_id" value={recepcao.id}/><GuicheSelect guiches={guiches} disabled={aguardando === 0}/><button disabled={aguardando === 0} className="ui-button-primary disabled:cursor-not-allowed disabled:opacity-50"><BellRing className="size-4"/> {aguardando > 0 ? "Chamar próxima" : "Fila sem espera"}</button></form> : null}</div>
      </div>
    </section>

    <section className="ui-card mt-5 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-5"><div><h2 className="font-semibold text-slate-900">Fila atual</h2><p className="text-sm text-slate-500">Atualização em tempo real · sincronização de segurança a cada 60 s · {hoje.split("-").reverse().join("/")}</p></div><span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600">{senhas?.length ?? 0} na fila</span></div>
      {senhas?.length ? <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-5 py-3">Senha</th><th className="px-5 py-3">Paciente</th><th className="px-5 py-3">Prioridade</th><th className="px-5 py-3">Emissão</th><th className="px-5 py-3">Status</th><th className="px-5 py-3">Destino</th><th className="px-5 py-3 text-right">Ações</th></tr></thead><tbody className="divide-y divide-slate-100">{senhas.map((item) => {
        const paciente = item.paciente_id ? pacientesPorId.get(item.paciente_id) : null;
        return <tr key={item.id} className="hover:bg-slate-50"><td className="px-5 py-4 text-xl font-black text-brand-950">{item.senha}</td><td className="px-5 py-4">{paciente ? <div><div className="flex items-center gap-1.5 font-semibold text-emerald-800"><UserCheck className="size-4"/>{paciente.nome_social || paciente.nome_completo}</div><div className="mt-0.5 text-xs text-slate-400">{mascararCpf(paciente.cpf)}</div></div> : <span className="text-slate-400">Não identificado</span>}</td><td className="px-5 py-4 capitalize text-slate-600">{item.prioridade}</td><td className="px-5 py-4 text-slate-600"><span className="inline-flex items-center gap-1.5"><Clock3 className="size-3.5"/>{horaSaoPaulo(item.emitida_em)}</span></td><td className="px-5 py-4"><span className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700">{String(item.status).replaceAll("_", " ")}</span></td><td className="px-5 py-4 font-medium text-slate-600">{item.ponto_atendimento || "—"}</td><td className="px-5 py-4"><div className="flex justify-end gap-2">{item.status === "aguardando" ? <form action={chamarSenha} className="flex gap-2"><input type="hidden" name="senha_id" value={item.id}/><GuicheSelect guiches={guiches} compact/><button className="btn-secondary"><BellRing className="size-4"/> Chamar</button></form> : null}{item.status === "chamada" ? <form action={iniciarAtendimentoSenha}><input type="hidden" name="senha_id" value={item.id}/><button className="ui-button-primary"><PlayCircle className="size-4"/> Iniciar admissão</button></form> : null}{item.status === "em_atendimento" && !item.atendimento_id ? <Link href={asRoute(`/atendimentos/novo?senha=${encodeURIComponent(item.id)}`)} className="ui-button-primary"><PlayCircle className="size-4"/> Continuar admissão</Link> : null}</div></td></tr>;
      })}</tbody></table></div> : <div className="p-10 text-center text-sm text-slate-500">Nenhuma senha aguardando na Recepção.</div>}
    </section>
  </SectionPage>;
}
