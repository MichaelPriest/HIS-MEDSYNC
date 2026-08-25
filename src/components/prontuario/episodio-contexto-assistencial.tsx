import { Activity, ShieldCheck, Stethoscope } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

function one<T>(rel: T | T[] | null): T | null {
  return Array.isArray(rel) ? rel[0] ?? null : rel;
}

function text(value: string | number | null | undefined, fallback = "—") {
  return value === null || value === undefined || value === "" ? fallback : String(value);
}

function money(value: number | null | undefined) {
  return value === null || value === undefined
    ? "—"
    : new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value));
}

function riskClass(risk: string | null | undefined) {
  switch ((risk ?? "").toLowerCase()) {
    case "vermelho": return "bg-rose-100 text-rose-800 ring-rose-200";
    case "laranja": return "bg-orange-100 text-orange-800 ring-orange-200";
    case "amarelo": return "bg-amber-100 text-amber-800 ring-amber-200";
    case "verde": return "bg-emerald-100 text-emerald-800 ring-emerald-200";
    case "azul": return "bg-sky-100 text-sky-800 ring-sky-200";
    default: return "bg-slate-100 text-slate-700 ring-slate-200";
  }
}

export async function EpisodioContextoAssistencial({ atendimentoId }: { atendimentoId: string }) {
  const supabase = await createClient();

  const [{ data: atendimento }, { data: triagem }, { data: guia }, { data: autorizacao }] = await Promise.all([
    supabase.from("atendimentos")
      .select("id,numero_atendimento,status,setor_atual,tipo_atendimento,cobertura,numero_carteirinha,validade_carteirinha,especialidade_destino,paciente:pacientes(nome_completo,ra,numero_registro),convenio:convenios(nome_fantasia,razao_social),plano:convenio_planos(nome,codigo)")
      .eq("id", atendimentoId)
      .maybeSingle(),
    supabase.from("triagens")
      .select("pressao_arterial,frequencia_cardiaca,frequencia_respiratoria,saturacao_o2,temperatura_c,glicemia_mg_dl,dor_escala,classificacao_risco,queixa_principal,observacoes,updated_at")
      .eq("atendimento_id", atendimentoId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.from("central_guias")
      .select("id,status,tipo,numero_guia_prestador,numero_guia_operadora,senha,validade_senha,protocolo,codigo_procedimento,descricao_procedimento,quantidade_solicitada,quantidade_autorizada,valor_solicitado,valor_autorizado,data_retorno,updated_at")
      .eq("atendimento_id", atendimentoId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.from("autorizacoes_atendimento")
      .select("id,status,numero_guia_prestador,numero_guia_operadora,senha_autorizacao,validade,observacao,updated_at")
      .eq("atendimento_id", atendimentoId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (!atendimento) return null;

  const paciente = one(atendimento.paciente);
  const convenio = one(atendimento.convenio);
  const plano = one(atendimento.plano);
  const guiaStatus = guia?.status ?? autorizacao?.status ?? "sem guia";
  const guiaOperadora = guia?.numero_guia_operadora ?? autorizacao?.numero_guia_operadora;
  const guiaPrestador = guia?.numero_guia_prestador ?? autorizacao?.numero_guia_prestador;
  const senha = guia?.senha ?? autorizacao?.senha_autorizacao;
  const validade = guia?.validade_senha ?? autorizacao?.validade;

  return (
    <section className="mx-auto mb-5 w-full max-w-[1600px] px-4 sm:px-6 lg:px-8">
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 bg-slate-50/70 px-4 py-3 sm:px-5">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-brand-600">Contexto assistencial do episódio</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">{paciente?.nome_completo ?? "Paciente"} · Atendimento #{atendimento.numero_atendimento}</p>
            <p className="mt-0.5 text-xs text-slate-500">Registro #{paciente?.numero_registro ?? "—"} · {paciente?.ra ?? "—"} · {text(atendimento.tipo_atendimento)}</p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="rounded-full bg-brand-50 px-2.5 py-1 font-bold text-brand-700">{text(atendimento.setor_atual, "sem setor")}</span>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 font-bold text-slate-700">{text(atendimento.status)}</span>
            {atendimento.especialidade_destino ? <span className="rounded-full bg-violet-50 px-2.5 py-1 font-bold text-violet-700">{atendimento.especialidade_destino}</span> : null}
          </div>
        </div>

        <div className="grid gap-0 lg:grid-cols-3">
          <div className="border-b border-slate-100 p-4 sm:p-5 lg:border-b-0 lg:border-r">
            <div className="flex items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 text-sm font-black text-slate-900"><Activity className="size-4 text-emerald-600"/>Triagem</h2>
              <span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase ring-1 ${riskClass(triagem?.classificacao_risco)}`}>{text(triagem?.classificacao_risco, "sem risco")}</span>
            </div>
            {triagem ? <>
              <p className="mt-3 text-sm font-semibold text-slate-800">{text(triagem.queixa_principal, "Queixa não informada")}</p>
              <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                <Metric label="PA" value={triagem.pressao_arterial}/>
                <Metric label="FC" value={triagem.frequencia_cardiaca}/>
                <Metric label="FR" value={triagem.frequencia_respiratoria}/>
                <Metric label="SpO₂" value={triagem.saturacao_o2 == null ? null : `${triagem.saturacao_o2}%`}/>
                <Metric label="Temp." value={triagem.temperatura_c == null ? null : `${triagem.temperatura_c} °C`}/>
                <Metric label="Dor" value={triagem.dor_escala}/>
                <Metric label="Glicemia" value={triagem.glicemia_mg_dl == null ? null : `${triagem.glicemia_mg_dl} mg/dL`}/>
              </div>
              {triagem.observacoes ? <p className="mt-3 text-xs leading-5 text-slate-500">{triagem.observacoes}</p> : null}
            </> : <p className="mt-3 text-sm text-slate-500">Triagem não localizada para este episódio.</p>}
          </div>

          <div className="border-b border-slate-100 p-4 sm:p-5 lg:border-b-0 lg:border-r">
            <div className="flex items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 text-sm font-black text-slate-900"><ShieldCheck className="size-4 text-brand-700"/>Cobertura e autorização</h2>
              <span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase ${guiaStatus === "autorizada" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>{guiaStatus.replaceAll("_", " ")}</span>
            </div>
            <p className="mt-3 text-sm font-semibold text-slate-800">{atendimento.cobertura === "convenio" ? (convenio?.nome_fantasia || convenio?.razao_social || "Convênio") : "Particular"}</p>
            <p className="mt-1 text-xs text-slate-500">Plano: {plano?.nome ?? "—"} {plano?.codigo ? `· ${plano.codigo}` : ""}</p>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <Metric label="Carteirinha" value={atendimento.numero_carteirinha}/>
              <Metric label="Guia prestador" value={guiaPrestador}/>
              <Metric label="Guia operadora" value={guiaOperadora}/>
              <Metric label="Senha" value={senha}/>
              <Metric label="Validade" value={validade}/>
              <Metric label="Protocolo" value={guia?.protocolo}/>
            </div>
          </div>

          <div className="p-4 sm:p-5">
            <h2 className="flex items-center gap-2 text-sm font-black text-slate-900"><Stethoscope className="size-4 text-violet-700"/>Procedimento autorizado</h2>
            {guia ? <>
              <p className="mt-3 text-sm font-semibold text-slate-800">{guia.codigo_procedimento ? `${guia.codigo_procedimento} · ` : ""}{text(guia.descricao_procedimento, guia.tipo)}</p>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <Metric label="Qtd. solicitada" value={guia.quantidade_solicitada}/>
                <Metric label="Qtd. autorizada" value={guia.quantidade_autorizada}/>
                <Metric label="Valor solicitado" value={money(guia.valor_solicitado)}/>
                <Metric label="Valor autorizado" value={money(guia.valor_autorizado)}/>
              </div>
              {guia.valor_solicitado != null && guia.valor_autorizado != null && Number(guia.valor_solicitado) !== Number(guia.valor_autorizado) ? <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">Atenção: o valor autorizado diverge do valor solicitado.</p> : null}
            </> : <p className="mt-3 text-sm text-slate-500">Nenhuma guia da Central de Guias vinculada a este episódio.</p>}
          </div>
        </div>
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string | number | null | undefined }) {
  return <div className="rounded-xl bg-slate-50 px-2.5 py-2"><p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</p><p className="mt-0.5 truncate font-semibold text-slate-700" title={text(value)}>{text(value)}</p></div>;
}
