import Link from "next/link";
import { Clock3, HeartPulse, Stethoscope, UserRound } from "lucide-react";
import { SectionPage } from "@/components/painel/section-page";
import {
  TriageBackgroundForm,
  TriageCallAction,
} from "@/components/triagem/triage-background-actions";
import { getAssistencialContext } from "@/modules/assistencial/context";

type PacienteRel = { nome_completo?: string; cpf?: string | null; ra?: string; numero_registro?: number };
type FilaTriagem = { id: string; atendimento_id: string; status: string; ponto_atendimento: string | null; chamado_em: string | null };

function relPaciente(rel: PacienteRel | PacienteRel[] | null) {
  return Array.isArray(rel) ? rel[0] ?? null : rel;
}

function formatarHora(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
}

function mensagemSucesso(codigo: string | undefined) {
  if (codigo === "encaminhado") return "Triagem concluída. O paciente saiu da fila de triagem e foi encaminhado para a especialidade.";
  if (codigo === "autorizacao") return "Autorização liberada. O paciente foi encaminhado para a triagem e está selecionado para atendimento.";
  return "Atendimento aberto e incluído na fila de triagem.";
}

export default async function TriagemPage({ searchParams }: { searchParams: Promise<{ sucesso?: string; erro?: string; atendimento?: string }> }) {
  const params = await searchParams;
  const { supabase, unidadeId } = await getAssistencialContext();
  const [{ data: atendimentos }, { data: especialidades }] = await Promise.all([
    supabase
      .from("atendimentos")
      .select("id,numero_atendimento,data_abertura,status,cobertura,triagem_concluida_em,paciente:pacientes(nome_completo,cpf,ra,numero_registro)")
      .eq("unidade_id", unidadeId)
      .is("triagem_concluida_em", null)
      .in("status", ["aberto", "em_espera", "em_atendimento"])
      .order("data_abertura", { ascending: true })
      .limit(200),
    supabase.from("catalogos").select("codigo,descricao").eq("ativo", true).eq("tipo", "especialidade").order("descricao").limit(300),
  ]);

  const pendentesBase = atendimentos ?? [];
  const pendentes = params.atendimento
    ? [...pendentesBase].sort((a, b) => {
        if (a.id === params.atendimento) return -1;
        if (b.id === params.atendimento) return 1;
        return 0;
      })
    : pendentesBase;
  const ids = pendentes.map((item) => item.id);
  const { data: filas } = ids.length
    ? await supabase
        .from("filas_setoriais")
        .select("id,atendimento_id,status,ponto_atendimento,chamado_em")
        .eq("unidade_id", unidadeId)
        .in("atendimento_id", ids)
        .eq("setor_codigo", "triagem")
        .in("status", ["aguardando", "chamado", "em_atendimento"])
        .order("created_at", { ascending: false })
    : { data: [] as FilaTriagem[] };

  const filaPorAtendimento = new Map<string, FilaTriagem>();
  for (const fila of (filas ?? []) as FilaTriagem[]) {
    if (!filaPorAtendimento.has(fila.atendimento_id)) filaPorAtendimento.set(fila.atendimento_id, fila);
  }

  const selecionado = pendentes.find((item) => item.id === params.atendimento) ?? pendentes[0] ?? null;
  const pacienteSelecionado = selecionado ? relPaciente(selecionado.paciente) : null;

  return <SectionPage eyebrow="Assistencial / Triagem" title="Fila de triagem" description="Somente atendimentos já abertos e ainda sem triagem concluída aparecem nesta fila. Ao concluir, o paciente sai automaticamente daqui e segue para a fila médica.">
    {params.sucesso ? <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{mensagemSucesso(params.sucesso)}</div> : null}
    {params.erro ? <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">Não foi possível concluir a operação anterior. Verifique atendimento, autorização e permissões da unidade.</div> : null}

    <div className="grid gap-6 xl:grid-cols-[minmax(320px,.78fr)_minmax(0,1.22fr)]">
      <section className="ui-card overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">Fila atual</p>
            <h2 className="mt-1 font-semibold text-slate-900">Aguardando triagem</h2>
          </div>
          <span className="rounded-xl bg-brand-50 px-3 py-2 text-sm font-black text-brand-700">{pendentes.length}</span>
        </div>

        <div className="max-h-[760px] space-y-3 overflow-y-auto p-4">
          {pendentes.map((item, index) => {
            const paciente = relPaciente(item.paciente);
            const fila = filaPorAtendimento.get(item.id);
            const ativo = selecionado?.id === item.id;
            const veioDoFluxo = item.id === params.atendimento;
            const chamado = fila?.status === "chamado" || fila?.status === "em_atendimento";
            return <article key={item.id} className={`rounded-2xl border p-4 transition ${ativo ? "border-brand-300 bg-brand-50/65 ring-2 ring-brand-100" : "border-slate-200 bg-white"}`}>
              <div className="flex items-start gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-slate-100 font-black text-slate-600">{index + 1}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="truncate text-sm font-black text-slate-900">{paciente?.nome_completo ?? "Paciente"}</h3>
                        {veioDoFluxo ? <span className="rounded-lg bg-brand-100 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-brand-700">{params.sucesso === "autorizacao" ? "Guia liberada" : "Selecionado"}</span> : null}
                      </div>
                      <p className="mt-1 text-xs text-slate-500">RA {paciente?.ra ?? "—"} · Atendimento {item.numero_atendimento ?? "—"}</p>
                    </div>
                    {chamado ? <span className="rounded-lg bg-sky-100 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-sky-700">Chamado</span> : <span className="rounded-lg bg-amber-100 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-amber-700">Aguardando</span>}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                    <span className="inline-flex items-center gap-1"><Clock3 className="size-3.5" />Entrada {formatarHora(item.data_abertura)}</span>
                    {fila?.chamado_em ? <span>Última chamada {formatarHora(fila.chamado_em)}</span> : null}
                  </div>
                </div>
              </div>

              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                <TriageCallAction atendimentoId={item.id} chamado={chamado} />
                <Link href={`/triagem?atendimento=${item.id}`} className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-700 px-3 py-2 text-xs font-bold text-white transition hover:bg-brand-800"><HeartPulse className="size-4" />Aplicar triagem</Link>
              </div>
            </article>;
          })}
          {!pendentes.length ? <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center"><HeartPulse className="mx-auto size-8 text-slate-300"/><p className="mt-3 font-semibold text-slate-700">Fila de triagem vazia</p><p className="mt-1 text-sm text-slate-500">Novos pacientes aparecerão aqui somente depois que o atendimento for aberto na Recepção.</p></div> : null}
        </div>
      </section>

      {selecionado ? <TriageBackgroundForm atendimentoId={selecionado.id}>
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 pb-5">
          <div className="flex items-start gap-3"><span className="grid size-11 place-items-center rounded-xl bg-brand-50 text-brand-700"><UserRound className="size-5" /></span><div><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">Paciente selecionado</p><h2 className="mt-1 text-lg font-black text-slate-900">{pacienteSelecionado?.nome_completo ?? "Paciente"}</h2><p className="mt-1 text-sm text-slate-500">RA {pacienteSelecionado?.ra ?? "—"} · Registro #{pacienteSelecionado?.numero_registro ?? "—"} · Atendimento {selecionado.numero_atendimento ?? "—"}</p></div></div>
          <span className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600">{selecionado.cobertura === "convenio" ? "Convênio" : "Particular"}</span>
        </div>

        <div className="mb-6 rounded-2xl border border-brand-100 bg-brand-50/50 p-4"><label className="block space-y-2 text-sm font-medium text-slate-700"><span className="flex items-center gap-2"><Stethoscope className="size-4 text-brand-700"/>Especialidade de destino *</span><select name="especialidade_destino" required defaultValue="" className="ui-input"><option value="">Selecione a especialidade</option>{especialidades?.length ? especialidades.map((item) => <option key={item.codigo} value={item.descricao}>{item.descricao}</option>) : <><option value="Clínica Médica">Clínica Médica</option><option value="Pediatria">Pediatria</option><option value="Ortopedia">Ortopedia</option><option value="Cardiologia">Cardiologia</option><option value="Ginecologia e Obstetrícia">Ginecologia e Obstetrícia</option><option value="Neurologia">Neurologia</option></>}</select><p className="text-xs font-normal text-slate-500">Ao concluir, o paciente deixa esta fila e entra na fila médica da especialidade definida.</p></label></div>

        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          <label className="space-y-2 text-sm font-medium text-slate-700"><span>Peso (kg)</span><input name="peso_kg" inputMode="decimal" className="ui-input" /></label>
          <label className="space-y-2 text-sm font-medium text-slate-700"><span>Altura (cm)</span><input name="altura_cm" inputMode="decimal" className="ui-input" /></label>
          <label className="space-y-2 text-sm font-medium text-slate-700"><span>Pressão arterial</span><input name="pressao_arterial" placeholder="120/80" className="ui-input" /></label>
          <label className="space-y-2 text-sm font-medium text-slate-700"><span>FC (bpm)</span><input name="frequencia_cardiaca" inputMode="numeric" className="ui-input" /></label>
          <label className="space-y-2 text-sm font-medium text-slate-700"><span>FR (irpm)</span><input name="frequencia_respiratoria" inputMode="numeric" className="ui-input" /></label>
          <label className="space-y-2 text-sm font-medium text-slate-700"><span>Sat. O₂ (%)</span><input name="saturacao_o2" inputMode="decimal" className="ui-input" /></label>
          <label className="space-y-2 text-sm font-medium text-slate-700"><span>Temperatura (°C)</span><input name="temperatura_c" inputMode="decimal" className="ui-input" /></label>
          <label className="space-y-2 text-sm font-medium text-slate-700"><span>Glicemia (mg/dL)</span><input name="glicemia_mg_dl" inputMode="decimal" className="ui-input" /></label>
          <label className="space-y-2 text-sm font-medium text-slate-700"><span>Dor (0–10)</span><input name="dor_escala" type="number" min={0} max={10} className="ui-input" /></label>
          <label className="space-y-2 text-sm font-medium text-slate-700"><span>Classificação de risco</span><select name="classificacao_risco" defaultValue="" className="ui-input"><option value="">Não classificado</option><option value="azul">Azul</option><option value="verde">Verde</option><option value="amarelo">Amarelo</option><option value="laranja">Laranja</option><option value="vermelho">Vermelho</option></select></label>
          <label className="space-y-2 text-sm font-medium text-slate-700 md:col-span-2 xl:col-span-4"><span>Queixa principal</span><textarea name="queixa_principal" rows={3} className="ui-input" /></label>
          <label className="space-y-2 text-sm font-medium text-slate-700 md:col-span-2 xl:col-span-4"><span>Observações</span><textarea name="observacoes" rows={3} className="ui-input" /></label>
        </div>
      </TriageBackgroundForm> : <section className="ui-card grid min-h-[420px] place-items-center p-8 text-center"><div><HeartPulse className="mx-auto size-10 text-slate-300"/><h2 className="mt-4 font-semibold text-slate-800">Nenhum atendimento aguardando triagem</h2><p className="mt-2 max-w-md text-sm text-slate-500">A fila é alimentada automaticamente quando a Recepção abre um atendimento.</p></div></section>}
    </div>
  </SectionPage>;
}
