import { Accessibility, HeartPulse, ScanFace, ShieldCheck, Siren, UsersRound } from "lucide-react";
import { emitirSenhaTotem } from "@/modules/senhas/actions";
import { AutoPrintTicket } from "@/components/totem/auto-print-ticket";
import { CpfVirtualKeyboard } from "@/components/totem/cpf-virtual-keyboard";

const mensagensErro: Record<string,string> = {
  "unidade-indisponivel": "Esta unidade não está disponível para emissão de senhas.",
  "setor-indisponivel": "A recepção desta unidade ainda não está habilitada para o Totem.",
  "prioridade-invalida": "A prioridade selecionada é inválida. Tente novamente.",
  "cpf-invalido": "Informe um CPF com 11 dígitos para identificar o cadastro.",
  "cpf-nao-localizado": "CPF não localizado nesta unidade. Você ainda pode retirar uma senha normalmente abaixo.",
  "rpc-indisponivel": "O serviço de emissão do Totem está sendo atualizado. Tente novamente.",
  "permissao-rpc": "O Totem ainda não está autorizado a emitir senhas nesta unidade.",
  "falha-emissao": "Não foi possível emitir a senha. Tente novamente ou procure um colaborador.",
  "1": "Não foi possível emitir a senha. Tente novamente ou procure um colaborador.",
};

type TotemSearchParams = {
  senha?: string;
  erro?: string;
  identificado?: string;
  ticket?: string;
  nome?: string;
  cpfFinal?: string;
};

const opcoes = [
  { prioridade: "normal", titulo: "Atendimento Geral", texto: "Consultas, exames, internação, informações e recepção.", Icon: UsersRound, cls: "bg-blue-50 text-blue-700", line: "from-blue-500 to-cyan-400" },
  { prioridade: "preferencial", titulo: "Atendimento Preferencial", texto: "Idosos, gestantes, PCD e demais prioridades legais.", Icon: Accessibility, cls: "bg-violet-50 text-violet-700", line: "from-violet-500 to-fuchsia-400" },
  { prioridade: "emergencia", titulo: "Urgência / Emergência", texto: "Para situações que necessitam avaliação prioritária imediata.", Icon: Siren, cls: "bg-rose-50 text-rose-700", line: "from-rose-500 to-orange-400" },
] as const;

export default async function TotemPage({ params, searchParams }: { params: Promise<{ unidadeId: string }>; searchParams: Promise<TotemSearchParams> }) {
  const { unidadeId } = await params;
  const { senha, erro, identificado, ticket, nome, cpfFinal } = await searchParams;
  const mensagemErro = erro ? (mensagensErro[erro] ?? mensagensErro["falha-emissao"]) : null;
  const cadastroIdentificado = identificado === "1";

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_right,_rgba(59,130,246,.14),_transparent_30%),#f3f7fc] p-4 sm:p-7 lg:p-8">
      <div className="mx-auto max-w-6xl ui-page-enter">
        <header className="totem-no-print relative mb-6 overflow-hidden rounded-[28px] bg-[linear-gradient(120deg,#0b1f44_0%,#173273_58%,#2563eb_100%)] px-6 py-6 text-white shadow-his-float sm:px-8 sm:py-7">
          <div className="pointer-events-none absolute -right-20 -top-28 size-72 rounded-full bg-cyan-300/15 blur-3xl" />
          <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <span className="grid size-14 place-items-center rounded-2xl bg-gradient-to-br from-cyan-400 to-blue-500 shadow-xl shadow-blue-950/25"><HeartPulse className="size-7" /></span>
              <div><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-100/55">MedSync · Autoatendimento</p><h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Totem de Senhas</h1><p className="mt-1 text-sm text-blue-100/65">Identifique-se pelo CPF ou escolha diretamente o tipo de atendimento.</p></div>
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
            </div>
          </section>
        ) : null}

        {senha ? <AutoPrintTicket senha={senha} unidadeId={unidadeId} ticketId={ticket} identificado={cadastroIdentificado} nomeExibicao={nome} cpfFinal={cpfFinal} /> : null}

        {mensagemErro ? <div className="totem-no-print mb-5 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-center text-sm font-semibold text-rose-700 shadow-sm ui-fade-up">{mensagemErro}</div> : null}

        <section className="totem-no-print mb-5 rounded-[24px] border border-[#e4eaf2] bg-white p-5 shadow-his-card sm:p-6 lg:p-7">
          <div className="mb-5 flex items-start gap-4"><span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-brand-50 text-brand-700"><ScanFace className="size-6" /></span><div><p className="his-eyebrow">Identificação rápida</p><h2 className="mt-1 text-xl font-bold text-slate-950">Já possui cadastro?</h2><p className="mt-1 text-sm leading-6 text-slate-500">Digite o CPF no teclado virtual. Se localizado, a recepção receberá sua identificação automaticamente.</p></div></div>
          <CpfVirtualKeyboard unidadeId={unidadeId} />
        </section>

        <div className="totem-no-print mb-3 flex items-center gap-3"><div className="h-px flex-1 bg-slate-200" /><span className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">ou escolha o atendimento</span><div className="h-px flex-1 bg-slate-200" /></div>

        <section className="totem-no-print grid gap-4 md:grid-cols-3 ui-stagger">
          {opcoes.map(({ prioridade, titulo, texto, Icon, cls, line }) => (
            <form key={prioridade} action={emitirSenhaTotem}>
              <input type="hidden" name="unidade_id" value={unidadeId} />
              <input type="hidden" name="setor_codigo" value="recepcao" />
              <input type="hidden" name="prioridade" value={prioridade} />
              <button className="group relative h-full w-full overflow-hidden rounded-[24px] border border-[#e4eaf2] bg-white p-6 text-left shadow-his-card transition hover:-translate-y-1 hover:border-slate-300 hover:shadow-his-float active:translate-y-0 sm:p-7">
                <span className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${line}`} />
                <span className={`grid size-14 place-items-center rounded-2xl ${cls}`}><Icon className="size-7" /></span>
                <h2 className="mt-5 text-xl font-bold text-slate-950">{titulo}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-500">{texto}</p>
                <span className="mt-5 inline-flex text-xs font-bold text-brand-600 transition group-hover:translate-x-1">Retirar senha →</span>
              </button>
            </form>
          ))}
        </section>

        <p className="totem-no-print mt-7 text-center text-xs text-slate-400">O CPF é opcional. Seus dados permanecem protegidos durante o autoatendimento.</p>
      </div>
    </main>
  );
}
