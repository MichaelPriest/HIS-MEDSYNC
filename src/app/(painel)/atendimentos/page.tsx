import Link from "next/link";
import type { Route } from "next";
import { ClipboardList, IdCard } from "lucide-react";
import { ListToolbar } from "@/components/cadastros/list-toolbar";
import { SectionPage } from "@/components/painel/section-page";
import { createClient } from "@/lib/supabase/server";

function relNome(rel: { nome_completo?: string } | { nome_completo?: string }[] | null) { return Array.isArray(rel) ? rel[0]?.nome_completo : rel?.nome_completo; }
function relPaciente(rel: { nome_completo?: string; ra?: string; numero_registro?: number } | { nome_completo?: string; ra?: string; numero_registro?: number }[] | null) { return Array.isArray(rel) ? rel[0] : rel; }

const filtros = [
  ["ativos", "Ativos"],
  ["espera", "Em espera"],
  ["atendimento", "Em atendimento"],
  ["alta", "Alta"],
  ["todos", "Todos"],
] as const;

export default async function AtendimentosPage({ searchParams }: { searchParams: Promise<{ sucesso?: string; q?: string; status?: string }> }) {
  const { sucesso, q: rawQuery, status: rawStatus } = await searchParams;
  const query = rawQuery?.trim().slice(0, 80) || "";
  const status = filtros.some(([value]) => value === rawStatus) ? rawStatus! : query ? "todos" : "ativos";
  const safeQuery = query.replace(/[,%()]/g, " ").trim();
  const digits = query.replace(/\D/g, "");
  const supabase = await createClient();

  let patientIds: string[] | null = null;
  if (safeQuery) {
    const filters = [`nome_completo.ilike.%${safeQuery}%`, `ra.ilike.%${safeQuery}%`];
    if (digits) filters.push(`cpf.ilike.%${digits}%`, `cns.ilike.%${digits}%`);
    if (/^\d+$/.test(digits) && digits.length <= 12) filters.push(`numero_registro.eq.${Number(digits)}`);
    const { data: found } = await supabase.from("pacientes").select("id").eq("ativo", true).or(filters.join(",")).limit(200);
    patientIds = (found ?? []).map((item) => item.id);
  }

  let request = supabase.from("atendimentos").select("id,numero_atendimento,status,tipo_atendimento,data_abertura,paciente:pacientes(nome_completo,ra,numero_registro),profissional:profissionais(nome_completo)").order("data_abertura", { ascending: false }).limit(100);
  if (status === "ativos") request = request.in("status", ["aberto", "em_espera", "em_atendimento"]);
  if (status === "espera") request = request.eq("status", "em_espera");
  if (status === "atendimento") request = request.eq("status", "em_atendimento");
  if (status === "alta") request = request.eq("status", "alta");
  if (query) {
    if (/^\d+$/.test(digits) && Number(digits) >= 1000000) request = request.eq("numero_atendimento", Number(digits));
    else if (patientIds) request = patientIds.length ? request.in("paciente_id", patientIds) : request.eq("paciente_id", "00000000-0000-0000-0000-000000000000");
  }
  const { data, error } = await request;

  return <SectionPage eyebrow="Jornada / Atendimento" title="Atendimentos" description="Encontre o episódio e continue a jornada do paciente a partir de um único ponto." primaryActionLabel="Abrir novo atendimento" primaryActionHref="/atendimentos/novo">
    {sucesso ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">Atendimento aberto com sucesso.</div> : null}
    <section className="ui-card overflow-hidden">
      <div className="space-y-4 border-b border-slate-100 p-5">
        <div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-brand-50 text-brand-700"><ClipboardList className="size-5" /></span><div><h2 className="font-semibold text-slate-900">Fila e histórico</h2><p className="text-sm text-slate-500">Busque por atendimento, paciente, CPF, CNS, RA ou registro e abra o prontuário integrado.</p></div></div>
        <ListToolbar query={query} placeholder="Buscar nº atendimento, nome, CPF, CNS, RA ou registro..." />
        <div className="flex flex-wrap gap-2">{filtros.map(([value,label])=>{const href=`/atendimentos?status=${value}${query?`&q=${encodeURIComponent(query)}`:""}` as Route;const active=status===value;return <Link key={value} href={href} className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${active?"bg-brand-700 text-white":"bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>{label}</Link>})}</div>
      </div>
      {error ? <p className="p-6 text-sm text-red-700">Não foi possível consultar atendimentos. Confirme a migration 008.</p> : data?.length ? <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-5 py-3">Atendimento</th><th className="px-5 py-3">Paciente</th><th className="px-5 py-3">Registro / RA</th><th className="px-5 py-3">Profissional</th><th className="px-5 py-3">Tipo</th><th className="px-5 py-3">Abertura</th><th className="px-5 py-3">Status</th><th className="px-5 py-3 text-right">Ação</th></tr></thead><tbody className="divide-y divide-slate-100">{data.map((item) => { const paciente = relPaciente(item.paciente); const href = `/prontuario/${item.id}` as Route; const identificacaoHref = `/prontuario/${item.id}/identificacao` as Route; return <tr key={item.id} className="hover:bg-slate-50"><td className="px-5 py-4"><Link href={href} className="font-semibold text-brand-800 hover:underline">#{item.numero_atendimento}</Link></td><td className="px-5 py-4"><Link href={href} className="font-medium text-slate-900 hover:text-brand-700">{paciente?.nome_completo ?? "—"}</Link></td><td className="px-5 py-4"><span className="block text-sm font-medium text-slate-700">#{paciente?.numero_registro ?? "—"}</span><span className="text-xs text-brand-700">{paciente?.ra ?? "—"}</span></td><td className="px-5 py-4 text-slate-600">{relNome(item.profissional) ?? "Não definido"}</td><td className="px-5 py-4 text-slate-600">{item.tipo_atendimento}</td><td className="px-5 py-4 text-slate-600">{new Date(item.data_abertura).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}</td><td className="px-5 py-4"><span className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700">{String(item.status).replaceAll("_", " ")}</span></td><td className="px-5 py-4"><div className="flex justify-end gap-2"><Link href={identificacaoHref} className="ui-button-secondary whitespace-nowrap"><IdCard className="size-4"/>Identificação</Link><Link href={href} className="ui-button-secondary whitespace-nowrap">Abrir prontuário</Link></div></td></tr>; })}</tbody></table></div> : <div className="p-10 text-center text-sm text-slate-500">Nenhum atendimento encontrado neste filtro.</div>}
    </section>
  </SectionPage>;
}