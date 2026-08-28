import Link from "next/link";
import { Boxes, CheckCircle2, Scissors, TriangleAlert } from "lucide-react";
import { SectionPage } from "@/components/painel/section-page";
import { getAssistencialContext } from "@/modules/assistencial/context";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Rel<T> = T | T[] | null;
type Cirurgia = {
  id: string;
  atendimento_id: string;
  procedimento: string;
  status: string;
  inicio_previsto: string | null;
  paciente: Rel<{ nome_completo: string | null; ra: string | null }>;
};
type Req = { id: string; cirurgia_id: string | null; status: string; prioridade: string };

type Params = { sucesso?: string; erro?: string };

function one<T>(value: Rel<T>) { return Array.isArray(value) ? value[0] ?? null : value; }
function fmt(value: string | null) {
  return value ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(value)) : "—";
}
function statusClass(status: string) {
  if (status === "em_andamento") return "bg-rose-50 text-rose-700";
  if (status === "em_preparo") return "bg-amber-50 text-amber-700";
  if (status === "concluida") return "bg-emerald-50 text-emerald-700";
  return "bg-slate-100 text-slate-700";
}

export default async function SuprimentosCirurgicosPage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const { supabase, empresaId, unidadeId } = await getAssistencialContext();
  const [cirurgiasReq, requisicoesReq] = await Promise.all([
    supabase.from("cirurgias")
      .select("id,atendimento_id,procedimento,status,inicio_previsto,paciente:pacientes(nome_completo,ra)")
      .eq("empresa_id", empresaId).eq("unidade_id", unidadeId)
      .order("inicio_previsto", { ascending: false, nullsFirst: false }).limit(180),
    supabase.from("estoque_requisicoes_setoriais")
      .select("id,cirurgia_id,status,prioridade")
      .eq("empresa_id", empresaId).eq("unidade_id", unidadeId).not("cirurgia_id", "is", null).limit(1200),
  ]);

  const cirurgias = (cirurgiasReq.data ?? []) as unknown as Cirurgia[];
  const requisicoes = (requisicoesReq.data ?? []) as Req[];
  const reqByCirurgia = new Map<string, Req[]>();
  for (const req of requisicoes) if (req.cirurgia_id) reqByCirurgia.set(req.cirurgia_id, [...(reqByCirurgia.get(req.cirurgia_id) ?? []), req]);
  const abertas = cirurgias.filter((item) => !["concluida", "cancelada"].includes(item.status));
  const pendentes = requisicoes.filter((item) => !["recebida", "cancelada"].includes(item.status)).length;
  const urgentes = requisicoes.filter((item) => !["recebida", "cancelada"].includes(item.status) && item.prioridade === "urgente").length;

  return <SectionPage eyebrow="Assistencial / Bloco Cirúrgico" title="Suprimentos Cirúrgicos" description="Requisição ao Almoxarifado/Farmácia Satélite, transferência por lote, recebimento no bloco, consumo físico, OPME e estorno com rastreabilidade até o Livro de Produção." actions={<Link href="/assistencial/centro-cirurgico" className="ui-button-secondary"><Scissors className="size-4"/>Central Cirúrgica</Link>}>
    {params.sucesso ? <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700"><CheckCircle2 className="mr-2 inline size-4"/>Operação concluída.</div> : null}
    {params.erro ? <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700"><TriangleAlert className="mr-2 inline size-4"/>{decodeURIComponent(params.erro)}</div> : null}

    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Kpi label="Cirurgias abertas" value={abertas.length}/>
      <Kpi label="Em sala" value={cirurgias.filter((item) => item.status === "em_andamento").length}/>
      <Kpi label="Requisições pendentes" value={pendentes}/>
      <Kpi label="Urgentes" value={urgentes}/>
    </section>

    <section className="his-card mt-5 overflow-hidden">
      <div className="border-b border-slate-100 px-5 py-4"><h2 className="font-black text-slate-950">Cirurgias e cadeia de suprimentos</h2><p className="mt-1 text-sm text-slate-500">A baixa de medicamento não é feita aqui: medicamento permanece no fluxo Prescrição → Farmácia → Dispensação → Administração.</p></div>
      <div className="divide-y divide-slate-100">
        {cirurgias.length ? cirurgias.map((cirurgia) => {
          const paciente = one(cirurgia.paciente);
          const reqs = reqByCirurgia.get(cirurgia.id) ?? [];
          const reqPendentes = reqs.filter((item) => !["recebida", "cancelada"].includes(item.status)).length;
          return <div key={cirurgia.id} className="flex flex-col gap-3 p-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2"><b className="text-slate-950">{paciente?.nome_completo ?? "Paciente"}</b><span className={`rounded-full px-2.5 py-1 text-xs font-black uppercase ${statusClass(cirurgia.status)}`}>{cirurgia.status.replaceAll("_", " ")}</span>{reqPendentes ? <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-black text-amber-700">{reqPendentes} requisição(ões) pendente(s)</span> : null}</div>
              <p className="mt-1 text-sm font-semibold text-slate-700">{cirurgia.procedimento}</p>
              <p className="mt-1 text-xs text-slate-500">RA {paciente?.ra ?? "—"} · previsto {fmt(cirurgia.inicio_previsto)} · {reqs.length} requisição(ões)</p>
            </div>
            <Link href={`/assistencial/centro-cirurgico/suprimentos/${cirurgia.id}`} className="ui-button-primary"><Boxes className="size-4"/>Abrir suprimentos</Link>
          </div>;
        }) : <p className="p-8 text-center text-sm text-slate-500">Nenhuma cirurgia cadastrada.</p>}
      </div>
    </section>
  </SectionPage>;
}

function Kpi({ label, value }: { label: string; value: number }) {
  return <div className="his-kpi"><p className="text-xs font-black uppercase tracking-wider text-slate-400">{label}</p><p className="mt-2 text-3xl font-black text-slate-950">{value}</p></div>;
}
