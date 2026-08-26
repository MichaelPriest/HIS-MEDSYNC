import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PrescricaoPrintButton } from "@/components/prontuario/prescricao-print-button";
import { requireAnyPermission } from "@/lib/permissions/server";

type Rel<T> = T | T[] | null;
function one<T>(value: Rel<T>): T | null { return Array.isArray(value) ? value[0] ?? null : value; }
function fmt(value: string | null | undefined) { return value ? new Intl.DateTimeFormat("pt-BR", { dateStyle:"short", timeStyle:"short", timeZone:"America/Sao_Paulo" }).format(new Date(value)) : "—"; }
function horarios(value: unknown) { return Array.isArray(value) ? value.map(String).join(", ") : typeof value === "string" ? value : ""; }
function tipoLabel(tipo: string | null | undefined) { return tipo === "medicamento" ? "Medicamento" : tipo === "dieta" ? "Dieta / hidratação" : tipo === "cuidado" ? "Cuidado" : tipo || "Item"; }

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ImprimirPrescricaoPage({ params }: { params: Promise<{ atendimentoId:string; prescricaoId:string }> }) {
  const { atendimentoId, prescricaoId } = await params;
  const { supabase, empresaId, unidadeId } = await requireAnyPermission(["prescricao.visualizar", "prontuario.visualizar"]);
  if (!unidadeId) redirect("/painel?erro=unidade");

  const { data: referencia } = await supabase.from("prescricoes")
    .select("id,assinado_em,profissional_id")
    .eq("id",prescricaoId).eq("atendimento_id",atendimentoId).eq("empresa_id",empresaId).eq("unidade_id",unidadeId)
    .not("assinado_em","is",null).maybeSingle();
  if (!referencia?.assinado_em) notFound();

  const [itensRes, empresaRes] = await Promise.all([
    supabase.from("prescricoes").select("id,tipo,item,dose,via,frequencia,duracao,horarios,quantidade,unidade_dose,diluente,velocidade_infusao,instrucoes,orientacoes,se_necessario,status,assinado_em,created_at,profissional:profissionais(nome_completo,especialidade,conselho,numero_conselho,uf_conselho),atendimento:atendimentos(numero_atendimento,paciente:pacientes(nome_completo,ra,numero_registro,cpf,cns,data_nascimento))")
      .eq("atendimento_id",atendimentoId).eq("empresa_id",empresaId).eq("unidade_id",unidadeId)
      .eq("profissional_id",referencia.profissional_id).eq("assinado_em",referencia.assinado_em).order("created_at"),
    supabase.from("empresas").select("razao_social,nome_fantasia,cnpj,cnes,telefone,email,logradouro,numero,bairro,cidade,uf,logo_url,rodape_documentos").eq("id",empresaId).maybeSingle(),
  ]);
  const itens = itensRes.data ?? [];
  if (!itens.length) notFound();

  const ids = itens.map((item) => item.id);
  const { data: componentesData } = await supabase.from("prescricao_componentes")
    .select("id,prescricao_id,dose,quantidade,unidade_dose,ordem,observacoes,item:itens_assistenciais(descricao,concentracao,apresentacao)")
    .eq("empresa_id",empresaId).eq("unidade_id",unidadeId).in("prescricao_id",ids).order("ordem");
  const componentes = componentesData ?? [];

  const primeiro = itens[0];
  const atendimento = one(primeiro.atendimento);
  const paciente = one(atendimento?.paciente);
  const profissional = one(primeiro.profissional);
  const empresa = empresaRes.data;

  return <main className="mx-auto max-w-[1400px] bg-white p-6 text-slate-950 print:max-w-none print:p-0">
    <style>{`@media print { @page { size: A4 landscape; margin: 10mm; } html, body { background: #fff !important; } .prescricao-tabela thead { display: table-header-group; } .prescricao-tabela tr { break-inside: avoid; page-break-inside: avoid; } }`}</style>
    <div className="mb-6 flex items-center justify-between gap-3 print:hidden"><Link href={`/prontuario/${atendimentoId}/prescricao`} className="btn-secondary">← Voltar à prescrição</Link><PrescricaoPrintButton/></div>

    <header className="border-b-2 border-slate-900 pb-4">
      <div className="flex items-start justify-between gap-5"><div className="flex items-start gap-5">{empresa?.logo_url ? <>
        {/* eslint-disable-next-line @next/next/no-img-element -- logo institucional configurável */}
        <img src={empresa.logo_url} alt="Logo da empresa" className="h-14 w-auto max-w-40 object-contain"/>
      </> : null}<div><h1 className="text-xl font-black">{empresa?.nome_fantasia || empresa?.razao_social || "Instituição de saúde"}</h1><p className="mt-1 text-xs text-slate-600">{empresa?.razao_social && empresa.razao_social !== empresa.nome_fantasia ? empresa.razao_social : ""}{empresa?.cnpj ? ` · CNPJ ${empresa.cnpj}` : ""}{empresa?.cnes ? ` · CNES ${empresa.cnes}` : ""}</p><p className="mt-1 text-xs text-slate-600">{[empresa?.logradouro,empresa?.numero,empresa?.bairro,empresa?.cidade,empresa?.uf].filter(Boolean).join(" · ")}</p></div></div><div className="text-right"><h2 className="text-xl font-black uppercase tracking-wide">Prescrição Médica Diária</h2><p className="mt-1 text-xs text-slate-500">Assinada em {fmt(referencia.assinado_em)}</p></div></div>
    </header>

    <section className="grid grid-cols-4 gap-x-5 gap-y-1 border-b border-slate-300 py-3 text-xs"><p className="col-span-2"><strong>Paciente:</strong> {paciente?.nome_completo ?? "—"}</p><p><strong>Atendimento:</strong> #{atendimento?.numero_atendimento ?? "—"}</p><p><strong>RA:</strong> {paciente?.ra ?? "—"}</p><p><strong>Registro:</strong> {paciente?.numero_registro ?? "—"}</p><p><strong>CPF:</strong> {paciente?.cpf ?? "—"}</p><p><strong>CNS:</strong> {paciente?.cns ?? "—"}</p><p><strong>Total:</strong> {itens.length} item(ns)</p></section>

    <section className="py-4">
      <table className="prescricao-tabela w-full border-collapse text-[11px]">
        <thead><tr className="border-y-2 border-slate-800 bg-slate-100 text-left text-[10px] uppercase"><th className="w-10 px-2 py-2">#</th><th className="w-28 px-2 py-2">Tipo</th><th className="px-2 py-2">Item / composição / instruções</th><th className="w-32 px-2 py-2">Dose / qtd.</th><th className="w-20 px-2 py-2">Via</th><th className="w-28 px-2 py-2">Frequência</th><th className="w-44 px-2 py-2">Horários</th></tr></thead>
        <tbody>{itens.map((p,index) => { const comps=componentes.filter((c)=>c.prescricao_id===p.id); const detalhe=[p.dose,p.unidade_dose].filter(Boolean).join(" ") || (p.quantidade ? `${p.quantidade} ${p.unidade_dose ?? ""}` : "—"); return <tr key={p.id} className="border-b border-slate-300 align-top"><td className="px-2 py-2 font-black">{String(index+1).padStart(2,"0")}</td><td className="px-2 py-2 font-bold">{tipoLabel(p.tipo)}</td><td className="px-2 py-2"><p className="font-black">{p.item}</p>{comps.map((c)=>{const ci=one(c.item);return <p key={c.id} className="mt-1">+ {ci?.descricao ?? "Componente"}{ci?.concentracao ? ` · ${ci.concentracao}` : ""}{c.dose ? ` · ${c.dose}` : ""}{c.quantidade ? ` · ${c.quantidade} ${c.unidade_dose ?? ""}` : ""}{c.observacoes ? ` · ${c.observacoes}` : ""}</p>})}{p.diluente ? <p className="mt-1"><strong>Diluente:</strong> {p.diluente}</p> : null}{p.velocidade_infusao ? <p className="mt-1"><strong>Infusão:</strong> {p.velocidade_infusao}</p> : null}{p.instrucoes ? <p className="mt-1"><strong>Instruções:</strong> {p.instrucoes}</p> : null}{p.orientacoes ? <p className="mt-1"><strong>Orientações:</strong> {p.orientacoes}</p> : null}</td><td className="px-2 py-2">{detalhe}</td><td className="px-2 py-2">{p.via ?? "—"}</td><td className="px-2 py-2">{p.frequencia ?? (p.se_necessario ? "Se necessário" : "—")}{p.duracao ? <span className="block text-slate-500">{p.duracao}</span> : null}</td><td className="px-2 py-2 font-semibold">{horarios(p.horarios) || "—"}</td></tr>})}</tbody>
      </table>
    </section>

    <section className="mt-5 border-t border-slate-400 pt-4 text-xs"><p><strong>Prescritor:</strong> {profissional?.nome_completo ?? "—"} {profissional?.especialidade ? `· ${profissional.especialidade}` : ""}</p><p>{profissional?.conselho ? `${profissional.conselho} ${profissional.numero_conselho ?? ""}/${profissional.uf_conselho ?? ""}` : ""}</p><p className="mt-1 text-[10px] text-slate-500">Documento consolidado da prescrição diária · assinatura registrada em {fmt(referencia.assinado_em)}.</p></section>
    {empresa?.rodape_documentos ? <footer className="mt-5 border-t border-slate-200 pt-2 text-center text-[10px] text-slate-500">{empresa.rodape_documentos}</footer> : null}
  </main>;
}
