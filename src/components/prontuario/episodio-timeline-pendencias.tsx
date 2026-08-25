import Link from "next/link";
import type { Route } from "next";
import { AlertTriangle, CheckCircle2, Clock3, FlaskConical, HeartPulse, ListTodo, PackageSearch, Pill, ScanLine, Stethoscope } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

type Evento = {
  id: string;
  em: string;
  titulo: string;
  detalhe: string;
  area: string;
  status?: string | null;
};

type Pendencia = {
  id: string;
  titulo: string;
  detalhe: string;
  area: string;
  prioridade: "critica" | "alta" | "normal";
  href: Route;
};

function dataBr(value: string | null | undefined) {
  return value
    ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(value))
    : "—";
}

function prioridadeClass(prioridade: Pendencia["prioridade"]) {
  if (prioridade === "critica") return "border-rose-200 bg-rose-50 text-rose-800";
  if (prioridade === "alta") return "border-amber-200 bg-amber-50 text-amber-800";
  return "border-slate-200 bg-slate-50 text-slate-700";
}

export async function EpisodioTimelinePendencias({ atendimentoId }: { atendimentoId: string }) {
  const supabase = await createClient();
  const { data: prescricoes } = await supabase
    .from("prescricoes")
    .select("id,item,tipo,status,created_at,assinado_em")
    .eq("atendimento_id", atendimentoId)
    .order("created_at", { ascending: false })
    .limit(100);

  const prescricaoIds = (prescricoes ?? []).map((item) => item.id);
  const [aprazamentosRes, examesRes, labRes, imagemExecRes, imagemLaudoRes, cuidadosRes, materiaisRes, filasRes] = await Promise.all([
    prescricaoIds.length
      ? supabase.from("prescricao_aprazamentos").select("id,prescricao_id,programado_em,status,justificativa,administrado_em").in("prescricao_id", prescricaoIds).order("programado_em", { ascending: false }).limit(200)
      : Promise.resolve({ data: [] }),
    supabase.from("solicitacoes_exames").select("id,exame,modalidade,status,prioridade,created_at").eq("atendimento_id", atendimentoId).order("created_at", { ascending: false }).limit(100),
    supabase.from("laboratorio_resultados").select("id,analito,resultado,valor_numerico,unidade_medida,valor_critico,liberado,liberado_em,notificado_em,created_at").eq("atendimento_id", atendimentoId).order("created_at", { ascending: false }).limit(100),
    supabase.from("imagem_execucoes").select("id,status,accession_number,iniciado_em,finalizado_em,created_at,solicitacao:solicitacoes_exames(exame)").eq("atendimento_id", atendimentoId).order("created_at", { ascending: false }).limit(100),
    supabase.from("imagem_laudos").select("id,status,liberado_em,created_at,execucao_id").eq("atendimento_id", atendimentoId).order("created_at", { ascending: false }).limit(100),
    supabase.from("sae_cuidados").select("id,cuidado,status,proxima_checagem_em,ultima_checagem_em,created_at").eq("atendimento_id", atendimentoId).order("created_at", { ascending: false }).limit(100),
    supabase.from("solicitacoes_materiais_assistenciais").select("id,descricao_item,status,quantidade,unidade_medida,created_at").eq("atendimento_id", atendimentoId).order("created_at", { ascending: false }).limit(100),
    supabase.from("filas_setoriais").select("id,setor_codigo,status,prioridade,motivo,created_at,iniciado_em,concluido_em").eq("atendimento_id", atendimentoId).order("created_at", { ascending: false }).limit(100),
  ]);

  const aprazamentos = aprazamentosRes.data ?? [];
  const exames = examesRes.data ?? [];
  const laboratorio = labRes.data ?? [];
  const imagemExecucoes = imagemExecRes.data ?? [];
  const imagemLaudos = imagemLaudoRes.data ?? [];
  const cuidados = cuidadosRes.data ?? [];
  const materiais = materiaisRes.data ?? [];
  const filas = filasRes.data ?? [];
  const prescricaoPorId = new Map((prescricoes ?? []).map((p) => [p.id, p]));
  const agora = Date.now();

  const pendencias: Pendencia[] = [];

  for (const ap of aprazamentos) {
    if (ap.status !== "pendente") continue;
    const prescricao = prescricaoPorId.get(ap.prescricao_id);
    const atrasada = new Date(ap.programado_em).getTime() < agora;
    pendencias.push({
      id: `med-${ap.id}`,
      titulo: atrasada ? "Medicação atrasada" : "Medicação programada",
      detalhe: `${prescricao?.item ?? "Medicamento"} · ${dataBr(ap.programado_em)}`,
      area: "Medicação",
      prioridade: atrasada ? "critica" : "alta",
      href: "/assistencial/medicamentos" as Route,
    });
  }

  for (const exame of exames) {
    if (["concluido", "liberado", "cancelado"].includes(String(exame.status))) continue;
    const laboratorioExame = String(exame.modalidade ?? "").toLowerCase().includes("laborat");
    pendencias.push({
      id: `exame-${exame.id}`,
      titulo: `${laboratorioExame ? "Laboratório" : "Imagem"} pendente`,
      detalhe: `${exame.exame} · status ${exame.status}`,
      area: laboratorioExame ? "Laboratório" : "Imagem",
      prioridade: ["urgente", "emergencia"].includes(String(exame.prioridade)) ? "alta" : "normal",
      href: (laboratorioExame ? "/assistencial/laboratorio" : "/assistencial/imagem") as Route,
    });
  }

  for (const resultado of laboratorio) {
    if (resultado.valor_critico && !resultado.notificado_em) {
      pendencias.push({
        id: `critico-${resultado.id}`,
        titulo: "Resultado crítico sem comunicação",
        detalhe: `${resultado.analito} · ${resultado.resultado ?? resultado.valor_numerico ?? "resultado crítico"} ${resultado.unidade_medida ?? ""}`.trim(),
        area: "Laboratório",
        prioridade: "critica",
        href: "/assistencial/laboratorio" as Route,
      });
    }
  }

  const laudoPorExecucao = new Set(imagemLaudos.filter((l) => l.status === "liberado").map((l) => l.execucao_id));
  for (const execucao of imagemExecucoes) {
    if (execucao.status === "concluido" && !laudoPorExecucao.has(execucao.id)) {
      const solicitacao = Array.isArray(execucao.solicitacao) ? execucao.solicitacao[0] : execucao.solicitacao;
      pendencias.push({
        id: `laudo-${execucao.id}`,
        titulo: "Exame executado aguardando laudo",
        detalhe: `${solicitacao?.exame ?? "Exame de imagem"} · accession ${execucao.accession_number ?? "—"}`,
        area: "Imagem",
        prioridade: "alta",
        href: "/assistencial/imagem" as Route,
      });
    }
  }

  for (const cuidado of cuidados) {
    if (cuidado.status === "cancelado" || !cuidado.proxima_checagem_em) continue;
    const vencido = new Date(cuidado.proxima_checagem_em).getTime() < agora;
    if (!vencido) continue;
    pendencias.push({
      id: `sae-${cuidado.id}`,
      titulo: "Cuidado de enfermagem vencido",
      detalhe: `${cuidado.cuidado} · previsto ${dataBr(cuidado.proxima_checagem_em)}`,
      area: "Enfermagem",
      prioridade: "alta",
      href: `/assistencial/sae?atendimento=${atendimentoId}` as Route,
    });
  }

  for (const material of materiais) {
    if (["atendido", "cancelado", "concluido"].includes(String(material.status))) continue;
    pendencias.push({
      id: `mat-${material.id}`,
      titulo: "Material aguardando atendimento",
      detalhe: `${material.descricao_item ?? "Material"} · ${material.quantidade ?? "—"} ${material.unidade_medida ?? ""}`.trim(),
      area: "Almoxarifado",
      prioridade: "normal",
      href: "/almoxarifado" as Route,
    });
  }

  for (const fila of filas) {
    if (["concluido", "cancelado"].includes(String(fila.status))) continue;
    pendencias.push({
      id: `fila-${fila.id}`,
      titulo: `Fila de ${fila.setor_codigo}`,
      detalhe: fila.motivo || `Status ${fila.status}`,
      area: "Fluxo",
      prioridade: fila.prioridade === "emergencia" ? "critica" : fila.prioridade === "preferencial" ? "alta" : "normal",
      href: `/assistencial/${fila.setor_codigo}` as Route,
    });
  }

  const eventos: Evento[] = [];
  for (const p of prescricoes ?? []) eventos.push({ id: `p-${p.id}`, em: p.assinado_em ?? p.created_at, titulo: p.item, detalhe: p.status === "ativa" ? "Prescrição assinada/ativa" : `Prescrição ${p.status}`, area: "Prescrição", status: p.status });
  for (const ap of aprazamentos) eventos.push({ id: `a-${ap.id}`, em: ap.administrado_em ?? ap.programado_em, titulo: prescricaoPorId.get(ap.prescricao_id)?.item ?? "Medicamento", detalhe: ap.status === "administrado" ? "Dose administrada" : ap.status === "pendente" ? "Dose programada" : `Dose ${ap.status}`, area: "Medicação", status: ap.status });
  for (const exame of exames) eventos.push({ id: `e-${exame.id}`, em: exame.created_at, titulo: exame.exame, detalhe: `Solicitação de exame · ${exame.status}`, area: String(exame.modalidade ?? "Exame"), status: exame.status });
  for (const r of laboratorio) eventos.push({ id: `l-${r.id}`, em: r.liberado_em ?? r.created_at, titulo: r.analito, detalhe: r.liberado ? "Resultado laboratorial liberado" : "Resultado laboratorial registrado", area: "Laboratório", status: r.valor_critico ? "crítico" : r.liberado ? "liberado" : "registrado" });
  for (const e of imagemExecucoes) {
    const solicitacao = Array.isArray(e.solicitacao) ? e.solicitacao[0] : e.solicitacao;
    eventos.push({ id: `i-${e.id}`, em: e.finalizado_em ?? e.iniciado_em ?? e.created_at, titulo: solicitacao?.exame ?? "Exame de imagem", detalhe: e.status === "concluido" ? "Execução de imagem concluída" : "Execução de imagem iniciada", area: "Imagem", status: e.status });
  }
  for (const l of imagemLaudos) if (l.status === "liberado") eventos.push({ id: `la-${l.id}`, em: l.liberado_em ?? l.created_at, titulo: "Laudo de imagem", detalhe: "Laudo liberado", area: "Imagem", status: "liberado" });
  for (const c of cuidados) if (c.ultima_checagem_em) eventos.push({ id: `c-${c.id}`, em: c.ultima_checagem_em, titulo: c.cuidado, detalhe: "Cuidado de enfermagem checado", area: "Enfermagem", status: c.status });
  for (const m of materiais) eventos.push({ id: `m-${m.id}`, em: m.created_at, titulo: m.descricao_item ?? "Material", detalhe: `Solicitação de material · ${m.status}`, area: "Almoxarifado", status: m.status });
  for (const f of filas) eventos.push({ id: `f-${f.id}`, em: f.concluido_em ?? f.iniciado_em ?? f.created_at, titulo: `Fluxo ${f.setor_codigo}`, detalhe: f.motivo || `Status ${f.status}`, area: "Fluxo", status: f.status });

  eventos.sort((a, b) => new Date(b.em).getTime() - new Date(a.em).getTime());
  const pendenciasOrdenadas = [...pendencias].sort((a, b) => ({ critica: 0, alta: 1, normal: 2 })[a.prioridade] - ({ critica: 0, alta: 1, normal: 2 })[b.prioridade]);
  const criticas = pendenciasOrdenadas.filter((p) => p.prioridade === "critica").length;
  const altas = pendenciasOrdenadas.filter((p) => p.prioridade === "alta").length;

  return (
    <section className="mt-6 space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="his-kpi"><p className="text-xs font-black uppercase tracking-wider text-slate-400">Pendências do episódio</p><p className="mt-2 text-3xl font-black text-brand-950">{pendenciasOrdenadas.length}</p></div>
        <div className="his-kpi"><p className="text-xs font-black uppercase tracking-wider text-slate-400">Críticas</p><p className="mt-2 text-3xl font-black text-rose-700">{criticas}</p></div>
        <div className="his-kpi"><p className="text-xs font-black uppercase tracking-wider text-slate-400">Alta prioridade</p><p className="mt-2 text-3xl font-black text-amber-700">{altas}</p></div>
        <div className="his-kpi"><p className="text-xs font-black uppercase tracking-wider text-slate-400">Eventos consolidados</p><p className="mt-2 text-3xl font-black text-emerald-700">{eventos.length}</p></div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <section className="ui-card p-5">
          <div className="flex items-center gap-3"><ListTodo className="size-5 text-amber-600"/><div><h2 className="font-semibold text-slate-900">Central de pendências do episódio</h2><p className="text-sm text-slate-500">Só mostra o que ainda exige ação da equipe.</p></div></div>
          <div className="mt-4 space-y-3">
            {pendenciasOrdenadas.length ? pendenciasOrdenadas.slice(0, 20).map((p) => <Link key={p.id} href={p.href} className={`block rounded-xl border p-4 transition hover:shadow-sm ${prioridadeClass(p.prioridade)}`}><div className="flex items-start justify-between gap-3"><div><p className="font-black">{p.titulo}</p><p className="mt-1 text-sm opacity-80">{p.detalhe}</p><p className="mt-2 text-xs font-bold uppercase tracking-wide opacity-70">{p.area}</p></div>{p.prioridade === "critica" ? <AlertTriangle className="size-5 shrink-0"/> : <Clock3 className="size-5 shrink-0"/>}</div></Link>) : <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-800"><div className="flex items-center gap-2 font-black"><CheckCircle2 className="size-5"/>Nenhuma pendência operacional detectada</div><p className="mt-1 text-sm">Os fluxos consultados deste atendimento não têm ações em aberto.</p></div>}
          </div>
        </section>

        <section className="ui-card p-5">
          <div className="flex items-center gap-3"><HeartPulse className="size-5 text-brand-700"/><div><h2 className="font-semibold text-slate-900">Timeline assistencial integrada</h2><p className="text-sm text-slate-500">Prescrição, medicação, exames, enfermagem, materiais e movimentações em ordem cronológica.</p></div></div>
          <div className="mt-5 space-y-0">
            {eventos.slice(0, 35).map((evento, index) => <div key={evento.id} className="relative flex gap-3 pb-5"><div className="relative flex w-5 shrink-0 justify-center"><span className="mt-1.5 size-2.5 rounded-full bg-brand-600"/>{index < Math.min(eventos.length, 35) - 1 ? <span className="absolute bottom-0 top-4 w-px bg-slate-200"/> : null}</div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-start justify-between gap-2"><div><p className="font-bold text-slate-900">{evento.titulo}</p><p className="mt-0.5 text-sm text-slate-600">{evento.detalhe}</p></div><span className="text-xs text-slate-400">{dataBr(evento.em)}</span></div><div className="mt-2 flex flex-wrap gap-2"><span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-bold text-slate-600">{evento.area}</span>{evento.status ? <span className="rounded-full bg-brand-50 px-2 py-1 text-[11px] font-bold text-brand-700">{evento.status}</span> : null}</div></div></div>)}
            {!eventos.length ? <p className="rounded-xl bg-slate-50 p-5 text-sm text-slate-500">Ainda não há eventos assistenciais consolidados neste episódio.</p> : null}
          </div>
        </section>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Link href={`/assistencial/sae?atendimento=${atendimentoId}` as Route} className="ui-button-secondary justify-start"><Stethoscope className="size-4"/>Enfermagem / SAE</Link>
        <Link href="/assistencial/medicamentos" className="ui-button-secondary justify-start"><Pill className="size-4"/>Medicações</Link>
        <Link href="/assistencial/laboratorio" className="ui-button-secondary justify-start"><FlaskConical className="size-4"/>Laboratório</Link>
        <Link href="/assistencial/imagem" className="ui-button-secondary justify-start"><ScanLine className="size-4"/>Imagem</Link>
        <Link href="/almoxarifado" className="ui-button-secondary justify-start"><PackageSearch className="size-4"/>Materiais</Link>
      </div>
    </section>
  );
}
