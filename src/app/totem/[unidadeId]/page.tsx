import { HeartPulse, Accessibility, Siren, UsersRound, ScanFace } from "lucide-react";
import { emitirSenhaTotem } from "@/modules/senhas/actions";
import { AutoPrintTicket } from "@/components/totem/auto-print-ticket";

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

export default async function TotemPage({ params, searchParams }: { params: Promise<{ unidadeId: string }>; searchParams: Promise<{ senha?: string; erro?: string; identificado?: string }> }) {
  const { unidadeId } = await params;
  const { senha, erro, identificado } = await searchParams;
  const mensagemErro = erro ? (mensagensErro[erro] ?? mensagensErro["falha-emissao"]) : null;

  return <main className="min-h-screen bg-slate-100 p-5 sm:p-8"><div className="mx-auto max-w-5xl ui-page-enter">
    <header className="totem-no-print mb-8 flex items-center justify-center gap-3 text-center"><span className="grid size-14 place-items-center rounded-2xl bg-brand-950 text-white shadow-lg"><HeartPulse className="size-7" /></span><div><h1 className="text-3xl font-bold tracking-tight text-slate-950">MedSync · Totem de Senhas</h1><p className="mt-1 text-sm text-slate-500">Identifique-se pelo CPF para agilizar a recepção ou retire sua senha normalmente.</p></div></header>
    {senha ? <section className="totem-no-print mb-8 rounded-3xl border border-emerald-200 bg-white p-8 text-center shadow-sm ui-scale-in"><p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-600">Sua senha</p><div className="mt-3 text-7xl font-black tracking-tight text-brand-950">{senha}</div>{identificado === "1" ? <p className="mt-3 font-semibold text-emerald-700">Cadastro localizado. Seus dados ficaram vinculados à senha para agilizar a recepção.</p> : null}<p className="mt-4 text-slate-600">Aguarde a chamada no painel. Tenha seus documentos em mãos.</p></section> : null}
    {senha ? <AutoPrintTicket senha={senha} identificado={identificado === "1"}/> : null}
    {mensagemErro ? <div className="totem-no-print mb-6 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-center text-sm font-medium text-rose-700 ui-fade-up">{mensagemErro}</div> : null}
    <form action={emitirSenhaTotem} className="totem-no-print mb-6 rounded-3xl border border-brand-100 bg-white p-6 shadow-sm"><input type="hidden" name="unidade_id" value={unidadeId}/><div className="flex items-start gap-4"><span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-brand-50 text-brand-700"><ScanFace className="size-6"/></span><div className="flex-1"><h2 className="text-lg font-bold text-slate-950">Já possui cadastro?</h2><p className="mt-1 text-sm text-slate-500">Informe seu CPF. Se localizado, o cadastro será vinculado à senha e a recepção poderá abrir o atendimento mais rapidamente.</p><div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]"><input name="cpf" inputMode="numeric" autoComplete="off" maxLength={14} placeholder="CPF" className="h-12 rounded-xl border border-slate-200 px-4 text-lg outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-100"/><button name="acao" value="identificar" className="h-12 rounded-xl bg-brand-950 px-6 font-bold text-white transition hover:bg-brand-900 active:scale-[0.98]">Identificar e emitir senha</button></div></div></div></form>
    <section className="totem-no-print grid gap-4 md:grid-cols-3 ui-stagger">
      {[{prioridade:"normal",titulo:"Atendimento Geral",texto:"Consultas, exames, internação, informações e recepção.",Icon:UsersRound,cls:"bg-brand-50 text-brand-700"},{prioridade:"preferencial",titulo:"Atendimento Preferencial",texto:"Idosos, gestantes, PCD e demais prioridades legais.",Icon:Accessibility,cls:"bg-violet-50 text-violet-700"},{prioridade:"emergencia",titulo:"Urgência / Emergência",texto:"Para situações que necessitam avaliação prioritária imediata.",Icon:Siren,cls:"bg-rose-100 text-rose-700"}].map(({prioridade,titulo,texto,Icon,cls}) => <form key={prioridade} action={emitirSenhaTotem}><input type="hidden" name="unidade_id" value={unidadeId}/><input type="hidden" name="setor_codigo" value="recepcao"/><input type="hidden" name="prioridade" value={prioridade}/><button className="h-full w-full rounded-3xl border border-slate-200 bg-white p-8 text-left shadow-sm transition hover:-translate-y-1 hover:shadow-md active:translate-y-0"><span className={`grid size-14 place-items-center rounded-2xl ${cls}`}><Icon className="size-7"/></span><h2 className="mt-5 text-xl font-bold text-slate-950">{titulo}</h2><p className="mt-2 text-sm text-slate-500">{texto}</p></button></form>)}
    </section>
    <p className="totem-no-print mt-8 text-center text-xs text-slate-400">O CPF é opcional. Se não quiser se identificar, escolha abaixo o tipo de atendimento para retirar a senha.</p>
  </div></main>;
}
