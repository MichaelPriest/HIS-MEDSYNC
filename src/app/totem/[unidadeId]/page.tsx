import Link from "next/link";
import type { Route } from "next";
import { Accessibility, ArrowLeft, HeartPulse, ScanFace, ShieldCheck, Siren, UserCheck, UserX, UsersRound } from "lucide-react";
import { emitirSenhaTotem } from "@/modules/senhas/actions";
import { AutoPrintTicket } from "@/components/totem/auto-print-ticket";
import { CpfVirtualKeyboard } from "@/components/totem/cpf-virtual-keyboard";

const mensagensErro: Record<string, string> = {
  "unidade-indisponivel": "Esta unidade não está disponível para emissão de senhas.",
  "setor-indisponivel": "A recepção desta unidade ainda não está habilitada para o Totem.",
  "prioridade-invalida": "A prioridade selecionada é inválida. Tente novamente.",
  "cpf-invalido": "Informe um CPF com 11 dígitos para identificar o cadastro.",
  "cpf-nao-localizado": "CPF não localizado nesta unidade. Você pode voltar e retirar a senha sem identificação.",
  "rpc-indisponivel": "O serviço de emissão do Totem está sendo atualizado. Tente novamente.",
  "permissao-rpc": "O Totem ainda não está autorizado a emitir senhas nesta unidade.",
  "falha-emissao": "Não foi possível emitir a senha. Tente novamente ou procure um colaborador.",
  "1": "Não foi possível emitir a senha. Tente novamente ou procure um colaborador.",
};

type Prioridade = "normal" | "preferencial" | "emergencia";
type TotemSearchParams = {
  senha?: string;
  erro?: string;
  identificado?: string;
  ticket?: string;
  nome?: string;
  cpfFinal?: string;
  prioridade?: string;
  etapa?: string;
};

const opcoes = [
  { prioridade: "normal" as const, titulo: "Atendimento Geral", texto: "Consultas, exames, internação, informações e recepção.", Icon: UsersRound, cls: "bg-blue-50 text-blue-700", line: "from-blue-500 to-cyan-400" },
  { prioridade: "preferencial" as const, titulo: "Atendimento Preferencial", texto: "Idosos, gestantes, PCD e demais prioridades legais.", Icon: Accessibility, cls: "bg-violet-50 text-violet-700", line: "from-violet-500 to-fuchsia-400" },
  { prioridade: "emergencia" as const, titulo: "Urgência / Emergência", texto: "Para situações que necessitam avaliação prioritária imediata.", Icon: Siren, cls: "bg-rose-50 text-rose-700", line: "from-rose-500 to-orange-400" },
] as const;

function prioridadeValida(valor?: string): valor is Prioridade {
  return valor === "normal" || valor === "preferencial" || valor === "emergencia";
}

function opcaoPrioridade(prioridade: Prioridade) {
  return opcoes.find((item) => item.prioridade === prioridade) ?? opcoes[0];
}

export default async function TotemPage({ params, searchParams }: { params: Promise<{ unidadeId: string }>; searchParams: Promise<TotemSearchParams> }) {
  const { unidadeId } = await params;
  const sp = await searchParams;
  const { senha, erro, identificado, ticket, nome, cpfFinal } = sp;
  const prioridade = prioridadeValida(sp.prioridade) ? sp.prioridade : null;
  const etapa = sp.etapa === "cpf" ? "cpf" : sp.etapa === "identificacao" ? "identificacao" : "tipo";
  const mensagemErro = erro ? (mensagensErro[erro] ?? mensagensErro["falha-emissao"]) : null;
  const cadastroIdentificado = identificado === "1";
  const selecionada = prioridade ? opcaoPrioridade(prioridade) : null;

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_right,_rgba(59,130,246,.14),_transparent_30%),#f3f7fc] p-4 sm:p-7 lg:p-8">
      <div className="mx-auto max-w-6xl ui-page-enter">
        <header className="totem-no-print relative mb-6 overflow-hidden rounded-[28px] bg-[linear-gradient(120deg,#0b1f44_0%,#173273_58%,#2563eb_100%)] px-6 py-6 text-white shadow-his-float sm:px-8 sm:py-7">
          <div className="pointer-events-none absolute -right-20 -top-28 size-72 rounded-full bg-cyan-300/15 blur-3xl" />
          <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <span className="grid size-14 place-items-center rounded-2xl bg-gradient-to-br from-cyan-400 to-blue-500 shadow-xl shadow-blue-950/25"><HeartPulse className="size-7" /></span>
              <div><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-100/55">MedSync · Autoatendimento</p><h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Totem de Senhas</h1><p className="mt-1 text-sm text-blue-100/65">Escolha o atendimento e, depois, decida se deseja se identificar pelo CPF.</p></div>
            </div>
            <span className="w-fit rounded-full border border-white/10 bg-white/[0.08] px-3 py-1.5 text-[11px] font-bold text-white/70">Atendimento digital</span>
          </div>
        </header>

        {senha ? (
          <section className="totem-no-print mb-5 overflow-hidden rounded-[28px] border border-emerald-200 bg-white shadow-his-float ui-scale-in">
            <div className="h-1.5 bg-gradient-to-r from-emerald-400 via-cyan-400 to-blue-500" />
            <div className="p-7 text-center sm:p-9">
              <p className="text-[11px] font-black uppercase tracking-[0.24em] text-emerald-600">Senha emitida com sucesso</p>
              <div className="mt-4 text-[76px] font-black leading-none tracking-tight text-[#0b1f44] sm:text-[96px]">{senha}</div>
              {cadastroIdentificado ? <div className="mx-auto mt-6 max-w-xl rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-left"><div className="flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-emerald-600 text-white"><ShieldCheck className="size-5" /></span><div><p className="font-bold text-emerald-950">Cadastro localizado</p>{nome ? <p className="mt-1 text-lg font-bold text-emerald-900">{nome}</p> : null}{cpfFinal ? <p className="mt-1 text-sm text-emerald-800">CPF final **{cpfFinal}</p> : null}<p className="mt-2 text-xs leading-5 text-emerald-700">Somente informações mínimas são exibidas neste Totem.</p></div></div></div> : null}
              <p className="mt-5 text-sm font-medium text-slate-500">Aguarde a chamada no painel e mantenha seus documentos em mãos.</p>
              <Link href={`/totem/${unidadeId}` as Route} className="btn-secondary mt-6">Retirar outra senha</Link>
            </div>
          </section>
        ) : null}

        {senha ? <AutoPrintTicket senha={senha} unidadeId={unidadeId} ticketId={ticket} identificado={cadastroIdentificado} nomeExibicao={nome} cpfFinal={cpfFinal} /> : null}

        {!senha && mensagemErro ? <div className="totem-no-print mb-5 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-center text-sm font-semibold text-rose-700 shadow-sm ui-fade-up">{mensagemErro}</div> : null}

        {!senha && etapa === "tipo" ? (
          <>
            <section className="totem-no-print mb-5 text-center">
              <p className="his-eyebrow">Etapa 1 de 2</p>
              <h2 className="mt-2 text-2xl font-black text-slate-950 sm:text-3xl">Qual tipo de atendimento você precisa?</h2>
              <p className="mt-2 text-sm text-slate-500">Escolha uma opção. Na próxima tela você poderá decidir se deseja informar o CPF.</p>
            </section>
            <section className="totem-no-print grid gap-4 md:grid-cols-3 ui-stagger">
              {opcoes.map(({ prioridade: tipo, titulo, texto, Icon, cls, line }) => (
                <Link key={tipo} href={`/totem/${unidadeId}?prioridade=${tipo}&etapa=identificacao` as Route} className="group relative h-full overflow-hidden rounded-[24px] border border-[#e4eaf2] bg-white p-6 text-left shadow-his-card transition hover:-translate-y-1 hover:border-slate-300 hover:shadow-his-float active:translate-y-0 sm:p-7">
                  <span className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${line}`} />
                  <span className={`grid size-14 place-items-center rounded-2xl ${cls}`}><Icon className="size-7" /></span>
                  <h3 className="mt-5 text-xl font-bold text-slate-950">{titulo}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-500">{texto}</p>
                  <span className="mt-5 inline-flex text-xs font-bold text-brand-600 transition group-hover:translate-x-1">Continuar →</span>
                </Link>
              ))}
            </section>
          </>
        ) : null}

        {!senha && prioridade && etapa === "identificacao" && selecionada ? (
          <section className="totem-no-print mx-auto max-w-3xl rounded-[28px] border border-[#e4eaf2] bg-white p-6 shadow-his-float sm:p-8">
            <Link href={`/totem/${unidadeId}` as Route} className="inline-flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-brand-700"><ArrowLeft className="size-4" />Trocar tipo de atendimento</Link>
            <div className="mt-6 flex items-start gap-4 rounded-2xl bg-slate-50 p-4">
              <span className={`grid size-12 shrink-0 place-items-center rounded-2xl ${selecionada.cls}`}><selecionada.Icon className="size-6" /></span>
              <div><p className="text-xs font-bold uppercase tracking-wider text-slate-400">Tipo selecionado</p><h2 className="mt-1 text-xl font-black text-slate-950">{selecionada.titulo}</h2><p className="mt-1 text-sm text-slate-500">{selecionada.texto}</p></div>
            </div>

            <div className="mt-7 text-center">
              <p className="his-eyebrow">Etapa 2 de 2</p>
              <h2 className="mt-2 text-2xl font-black text-slate-950">Deseja se identificar pelo CPF?</h2>
              <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-500">A identificação é opcional e ajuda a recepção a localizar seu cadastro antes da chamada.</p>
            </div>

            <div className="mt-7 grid gap-4 sm:grid-cols-2">
              <Link href={`/totem/${unidadeId}?prioridade=${prioridade}&etapa=cpf` as Route} className="group rounded-2xl border-2 border-brand-100 bg-brand-50 p-5 text-left transition hover:border-brand-300 hover:bg-brand-100/60"><span className="grid size-11 place-items-center rounded-xl bg-brand-700 text-white"><UserCheck className="size-5" /></span><h3 className="mt-4 font-black text-brand-950">Sim, quero me identificar</h3><p className="mt-1 text-sm text-brand-800/70">Abrir teclado virtual para informar o CPF.</p></Link>
              <form action={emitirSenhaTotem}>
                <input type="hidden" name="unidade_id" value={unidadeId} />
                <input type="hidden" name="setor_codigo" value="recepcao" />
                <input type="hidden" name="prioridade" value={prioridade} />
                <button className="h-full w-full rounded-2xl border-2 border-slate-200 bg-white p-5 text-left transition hover:border-slate-300 hover:bg-slate-50"><span className="grid size-11 place-items-center rounded-xl bg-slate-100 text-slate-600"><UserX className="size-5" /></span><h3 className="mt-4 font-black text-slate-950">Não, emitir sem CPF</h3><p className="mt-1 text-sm text-slate-500">A senha será emitida mantendo o tipo de atendimento selecionado.</p></button>
              </form>
            </div>
          </section>
        ) : null}

        {!senha && prioridade && etapa === "cpf" && selecionada ? (
          <section className="totem-no-print rounded-[24px] border border-[#e4eaf2] bg-white p-5 shadow-his-card sm:p-6 lg:p-7">
            <div className="mb-5 flex items-start gap-4"><span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-brand-50 text-brand-700"><ScanFace className="size-6" /></span><div className="flex-1"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="his-eyebrow">Identificação opcional</p><h2 className="mt-1 text-xl font-bold text-slate-950">Informe o CPF</h2></div><Link href={`/totem/${unidadeId}?prioridade=${prioridade}&etapa=identificacao` as Route} className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-brand-700"><ArrowLeft className="size-3.5" />Voltar</Link></div><p className="mt-1 text-sm leading-6 text-slate-500">Tipo mantido: <strong>{selecionada.titulo}</strong>. Digite o CPF no teclado virtual.</p></div></div>
            <CpfVirtualKeyboard unidadeId={unidadeId} prioridade={prioridade} />
          </section>
        ) : null}

        {!senha ? <p className="totem-no-print mt-7 text-center text-xs text-slate-400">O CPF é opcional. Seus dados permanecem protegidos durante o autoatendimento.</p> : null}
      </div>
    </main>
  );
}
