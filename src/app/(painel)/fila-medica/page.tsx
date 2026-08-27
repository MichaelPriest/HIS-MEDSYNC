import Link from "next/link";
import type { Route } from "next";
import { BellRing, BedDouble, Building2, Clock3, MapPin, Siren, Stethoscope, UserRoundCheck } from "lucide-react";
import { SectionPage } from "@/components/painel/section-page";
import { getAssistencialContext } from "@/modules/assistencial/context";
import { assumirPaciente } from "@/modules/fila-medica/actions";

function one<T>(rel: T | T[] | null): T | null {
  return Array.isArray(rel) ? rel[0] ?? null : rel;
}

function norm(v: string | null | undefined) {
  return (v ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

type Triagem = {
  atendimento_id: string;
  classificacao_risco: string | null;
  queixa_principal: string | null;
  pressao_arterial: string | null;
  frequencia_cardiaca: number | null;
  saturacao_o2: number | null;
  temperatura_c: number | null;
};

type SetorFila = "ps" | "ambulatorio" | "internacao" | "outros";

type AtendimentoFila = {
  numero_atendimento: string | number | null;
  setor_atual: string | null;
  origem: string | null;
  tipo_atendimento: string | null;
};

type ItemFila = {
  id: string;
  atendimento_id: string;
  especialidade: string | null;
  prioridade: string | null;
  created_at: string;
  status: string;
  paciente: { nome_completo: string | null; ra: string | null; numero_registro: string | number | null } | Array<{ nome_completo: string | null; ra: string | null; numero_registro: string | number | null }> | null;
  atendimento: AtendimentoFila | AtendimentoFila[] | null;
};

const SETORES: Array<{ codigo: SetorFila; label: string; descricao: string; ponto: string; icon: typeof Siren }> = [
  { codigo: "ps", label: "Pronto-Socorro", descricao: "Urgência, emergência e demanda espontânea", ponto: "Box Médico 01", icon: Siren },
  { codigo: "ambulatorio", label: "Ambulatório", descricao: "Consultas agendadas e atendimentos eletivos", ponto: "Consultório 01", icon: Building2 },
  { codigo: "internacao", label: "Internação", descricao: "Enfermarias, UTI e avaliações de pacientes internados", ponto: "Leito / Enfermaria", icon: BedDouble },
  { codigo: "outros", label: "Outros setores", descricao: "Filas médicas assistenciais não classificadas acima", ponto: "Ponto de atendimento", icon: Stethoscope },
];

function classificarSetor(atendimento: AtendimentoFila | null): SetorFila {
  const setor = norm(atendimento?.setor_atual).replace(/\s+/g, "_");
  const origem = norm(atendimento?.origem).replace(/\s+/g, "_");
  const tipo = norm(atendimento?.tipo_atendimento).replace(/\s+/g, "_");

  if (["pronto_socorro", "ps", "urgencia", "emergencia"].some((valor) => setor.includes(valor)) || ["urgencia", "emergencia"].some((valor) => tipo.includes(valor))) return "ps";
  if (["internacao", "internado", "enfermaria", "uti", "cti", "semi_intensiva", "centro_cirurgico"].some((valor) => setor.includes(valor)) || tipo.includes("internacao")) return "internacao";
  if (["ambulatorio", "consultorio"].some((valor) => setor.includes(valor)) || ["agenda", "agendamento", "eletivo", "ambulatorio"].some((valor) => origem.includes(valor) || tipo.includes(valor))) return "ambulatorio";
  if (setor === "triagem" && ["demanda_espontanea", "porta", "pronto_atendimento"].some((valor) => origem.includes(valor))) return "ps";
  return "outros";
}

const MENSAGENS_ERRO: Record<string, string> = {
  encaminhamento: "Encaminhamento inválido.",
  "perfil-profissional": "O usuário não está vinculado a um profissional ativo.",
  indisponivel: "Este paciente já foi chamado ou assumido por outro profissional.",
  especialidade: "A especialidade do profissional não corresponde à fila do paciente.",
  atendimento: "Não foi possível atualizar o atendimento clínico.",
  "fila-setorial": "Não foi possível publicar a chamada no painel integrado.",
  assumir: "O paciente foi assumido por outro profissional antes desta chamada.",
};

export default async function FilaMedicaPage({ searchParams }: { searchParams: Promise<{ erro?: string; setor?: string }> }) {
  const { erro, setor: setorParam } = await searchParams;
  const { supabase, user, unidadeId } = await getAssistencialContext();

  let profissional = (await supabase.from("profissionais").select("id,nome_completo,especialidade").eq("usuario_id", user.id).eq("ativo", true).maybeSingle()).data;
  if (!profissional && user.email) {
    profissional = (await supabase.from("profissionais").select("id,nome_completo,especialidade").ilike("email", user.email).eq("ativo", true).limit(1).maybeSingle()).data;
  }

  const { data: fila } = await supabase.from("encaminhamentos_assistenciais")
    .select("id,atendimento_id,especialidade,prioridade,created_at,status,paciente:pacientes(nome_completo,ra,numero_registro),atendimento:atendimentos(numero_atendimento,setor_atual,origem,tipo_atendimento)")
    .eq("unidade_id", unidadeId)
    .eq("status", "aguardando_profissional")
    .order("created_at", { ascending: true })
    .limit(300);

  const itens = (fila ?? []) as unknown as ItemFila[];
  const atendimentoIds = itens.map((item) => item.atendimento_id);
  const { data: triagens } = atendimentoIds.length
    ? await supabase.from("triagens").select("atendimento_id,classificacao_risco,queixa_principal,pressao_arterial,frequencia_cardiaca,saturacao_o2,temperatura_c").in("atendimento_id", atendimentoIds)
    : { data: [] as Triagem[] };
  const triagemPorAtendimento = new Map((triagens ?? []).map((item) => [item.atendimento_id, item as Triagem]));
  const especialidadeProf = norm(profissional?.especialidade);
  const visiveis = itens.filter((item) => {
    const esp = norm(item.especialidade);
    return especialidadeProf && esp && (especialidadeProf.includes(esp) || esp.includes(especialidadeProf));
  });

  const agrupados = new Map<SetorFila, ItemFila[]>(SETORES.map((setor) => [setor.codigo, []]));
  for (const item of visiveis) {
    const atendimento = one(item.atendimento);
    agrupados.get(classificarSetor(atendimento))?.push(item);
  }

  const setorSelecionado = SETORES.some((item) => item.codigo === setorParam) ? setorParam as SetorFila : null;
  const setoresParaExibir = setorSelecionado ? SETORES.filter((item) => item.codigo === setorSelecionado) : SETORES;

  return (
    <SectionPage
      eyebrow="Assistencial / Médico"
      title="Filas médicas por setor"
      description="As filas são separadas por contexto assistencial. O médico continua vendo apenas pacientes compatíveis com sua especialidade, sem misturar Pronto-Socorro, Ambulatório e Internação."
    >
      {erro ? (
        <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {MENSAGENS_ERRO[erro] ?? "Não foi possível chamar e assumir o paciente."}
        </div>
      ) : null}

      {!profissional ? (
        <div className="ui-card p-6">
          <div className="flex items-center gap-3">
            <UserRoundCheck className="size-5 text-amber-600" />
            <div>
              <h2 className="font-semibold text-slate-900">Usuário ainda não vinculado a um profissional</h2>
              <p className="mt-1 text-sm text-slate-500">Vincule este usuário ao cadastro profissional para ativar as filas por especialidade e setor.</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="mb-5 rounded-2xl border border-brand-100 bg-brand-50/60 p-4">
          <div className="flex items-center gap-3">
            <Stethoscope className="size-5 text-brand-700" />
            <div>
              <p className="font-semibold text-brand-950">{profissional.nome_completo}</p>
              <p className="text-sm text-brand-700">Especialidade: {profissional.especialidade || "não informada"}</p>
            </div>
          </div>
        </div>
      )}

      <nav className="mb-6 grid gap-2 sm:grid-cols-2 xl:grid-cols-5" aria-label="Filtrar fila médica por setor">
        <Link href={"/fila-medica" as Route} className={`rounded-2xl border p-3 transition ${!setorSelecionado ? "border-brand-300 bg-brand-50 ring-1 ring-brand-100" : "border-slate-200 bg-white hover:border-brand-200"}`}>
          <p className="text-xs font-black uppercase tracking-wider text-slate-500">Todas</p>
          <p className="mt-1 text-2xl font-black text-slate-950">{visiveis.length}</p>
          <p className="text-xs text-slate-500">Visão agrupada</p>
        </Link>
        {SETORES.map((setor) => {
          const Icon = setor.icon;
          const quantidade = agrupados.get(setor.codigo)?.length ?? 0;
          const ativo = setorSelecionado === setor.codigo;
          return <Link key={setor.codigo} href={`/fila-medica?setor=${setor.codigo}` as Route} className={`rounded-2xl border p-3 transition ${ativo ? "border-brand-300 bg-brand-50 ring-1 ring-brand-100" : "border-slate-200 bg-white hover:border-brand-200"}`}>
            <div className="flex items-center justify-between gap-2"><p className="text-xs font-black uppercase tracking-wider text-slate-500">{setor.label}</p><Icon className="size-4 text-brand-600" /></div>
            <p className="mt-1 text-2xl font-black text-slate-950">{quantidade}</p>
            <p className="truncate text-xs text-slate-500">{setor.descricao}</p>
          </Link>;
        })}
      </nav>

      <div className="space-y-7">
        {setoresParaExibir.map((setor) => {
          const Icon = setor.icon;
          const pacientes = agrupados.get(setor.codigo) ?? [];
          return <section key={setor.codigo}>
            <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
              <div className="flex items-start gap-3">
                <span className="grid size-10 place-items-center rounded-xl bg-brand-50 text-brand-700"><Icon className="size-5" /></span>
                <div><h2 className="font-black text-slate-950">{setor.label}</h2><p className="text-sm text-slate-500">{setor.descricao}</p></div>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">{pacientes.length} aguardando</span>
            </div>

            <div className="space-y-3">
              {pacientes.length ? pacientes.map((item) => {
                const paciente = one(item.paciente);
                const atendimento = one(item.atendimento);
                const triagem = triagemPorAtendimento.get(item.atendimento_id);

                return (
                  <div key={item.id} className="ui-card p-5">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-semibold text-slate-900">{paciente?.nome_completo ?? "Paciente"}</h3>
                          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${item.prioridade === "emergencia" ? "bg-rose-100 text-rose-700" : item.prioridade === "preferencial" ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}`}>
                            {item.prioridade ?? "normal"}
                          </span>
                          {triagem?.classificacao_risco ? <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold capitalize text-slate-700">Risco {triagem.classificacao_risco}</span> : null}
                        </div>
                        <p className="mt-1 text-sm text-slate-500">Atendimento #{atendimento?.numero_atendimento ?? "—"} · Registro #{paciente?.numero_registro ?? "—"} · {paciente?.ra ?? "—"}</p>
                        <p className="mt-2 text-sm text-slate-700"><b>Especialidade:</b> {item.especialidade}</p>
                        <p className="mt-1 text-xs font-semibold text-brand-700">Setor atual: {atendimento?.setor_atual?.replaceAll("_", " ") || setor.label} · Origem: {atendimento?.origem?.replaceAll("_", " ") || "—"}</p>
                        {triagem?.queixa_principal ? <p className="mt-1 text-sm text-slate-700"><b>Queixa:</b> {triagem.queixa_principal}</p> : null}
                        <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
                          {triagem?.pressao_arterial ? <span>PA {triagem.pressao_arterial}</span> : null}
                          {triagem?.frequencia_cardiaca ? <span>FC {triagem.frequencia_cardiaca}</span> : null}
                          {triagem?.saturacao_o2 ? <span>SpO₂ {triagem.saturacao_o2}%</span> : null}
                          {triagem?.temperatura_c ? <span>Temp. {triagem.temperatura_c}°C</span> : null}
                          <span className="flex items-center gap-1"><Clock3 className="size-3" />{new Date(item.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" })}</span>
                        </div>
                      </div>

                      <form action={assumirPaciente} className="flex w-full flex-col gap-2 sm:w-auto sm:min-w-[330px] sm:flex-row">
                        <input type="hidden" name="encaminhamento_id" value={item.id} />
                        <input type="hidden" name="fila_setor" value={setor.codigo} />
                        <label className="relative min-w-0 flex-1">
                          <MapPin className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                          <input
                            name="ponto_atendimento"
                            defaultValue={setor.ponto}
                            required
                            maxLength={80}
                            className="ui-input h-10 w-full pl-9"
                            aria-label="Ponto de atendimento da chamada"
                          />
                        </label>
                        <button className="ui-button-primary h-10 whitespace-nowrap"><BellRing className="size-4" /> Chamar e assumir</button>
                      </form>
                    </div>
                  </div>
                );
              }) : (
                <div className="ui-card border-dashed p-7 text-center text-sm text-slate-500">Nenhum paciente aguardando nesta fila para a especialidade do profissional.</div>
              )}
            </div>
          </section>;
        })}
      </div>
    </SectionPage>
  );
}