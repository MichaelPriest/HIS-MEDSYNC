import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PrescricaoPrintButton } from "@/components/prontuario/prescricao-print-button";
import { requireAnyPermission } from "@/lib/permissions/server";

type Rel<T> = T | T[] | null;
function one<T>(value: Rel<T>): T | null { return Array.isArray(value) ? value[0] ?? null : value; }
function fmt(value: string | null | undefined) { return value ? new Intl.DateTimeFormat("pt-BR", { dateStyle:"short", timeStyle:"short", timeZone:"America/Sao_Paulo" }).format(new Date(value)) : "—"; }

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ImprimirPrescricaoPage({ params }: { params: Promise<{ atendimentoId:string; prescricaoId:string }> }) {
  const { atendimentoId, prescricaoId } = await params;
  const { supabase, empresaId, unidadeId } = await requireAnyPermission(["prescricao.visualizar", "prontuario.visualizar"]);
  if (!unidadeId) redirect("/painel?erro=unidade");

  const [prescricaoRes, componentesRes, empresaRes] = await Promise.all([
    supabase.from("prescricoes").select("id,item,dose,via,frequencia,duracao,horarios,quantidade,unidade_dose,diluente,velocidade_infusao,instrucoes,orientacoes,se_necessario,status,assinado_em,created_at,profissional:profissionais(nome_completo,especialidade,conselho,numero_conselho,uf_conselho),atendimento:atendimentos(numero_atendimento,paciente:pacientes(nome_completo,ra,numero_registro,cpf,cns,data_nascimento))").eq("id",prescricaoId).eq("atendimento_id",atendimentoId).eq("empresa_id",empresaId).eq("unidade_id",unidadeId).not("assinado_em","is",null).maybeSingle(),
    supabase.from("prescricao_componentes").select("id,dose,quantidade,unidade_dose,ordem,observacoes,item:itens_assistenciais(descricao,concentracao,apresentacao)").eq("prescricao_id",prescricaoId).eq("empresa_id",empresaId).eq("unidade_id",unidadeId).order("ordem"),
    supabase.from("empresas").select("razao_social,nome_fantasia,cnpj,cnes,telefone,email,logradouro,numero,bairro,cidade,uf,logo_url,rodape_documentos").eq("id",empresaId).maybeSingle(),
  ]);
  const p = prescricaoRes.data;
  if (!p) notFound();
  const atendimento = one(p.atendimento);
  const paciente = one(atendimento?.paciente);
  const profissional = one(p.profissional);
  const empresa = empresaRes.data;
  const horarios = Array.isArray(p.horarios) ? p.horarios.join(", ") : "";
  const componentes = componentesRes.data ?? [];

  return <main className="mx-auto max-w-4xl bg-white p-6 text-slate-950 sm:p-10 print:max-w-none print:p-0">
    <div className="mb-6 flex items-center justify-between gap-3 print:hidden"><Link href={`/prontuario/${atendimentoId}/prescricao`} className="btn-secondary">← Voltar à prescrição</Link><PrescricaoPrintButton/></div>
    <header className="border-b-2 border-slate-900 pb-5">
      <div className="flex items-start gap-5">{empresa?.logo_url ? <img src={empresa.logo_url} alt="Logo da empresa" className="h-16 w-auto max-w-40 object-contain"/> : null}<div><h1 className="text-xl font-black">{empresa?.nome_fantasia || empresa?.razao_social || "Instituição de saúde"}</h1><p className="mt-1 text-xs text-slate-600">{empresa?.razao_social && empresa.razao_social !== empresa.nome_fantasia ? empresa.razao_social : ""}{empresa?.cnpj ? ` · CNPJ ${empresa.cnpj}` : ""}{empresa?.cnes ? ` · CNES ${empresa.cnes}` : ""}</p><p className="mt-1 text-xs text-slate-600">{[empresa?.logradouro,empresa?.numero,empresa?.bairro,empresa?.cidade,empresa?.uf].filter(Boolean).join(" · ")}</p></div></div>
      <h2 className="mt-6 text-center text-2xl font-black uppercase tracking-wide">Prescrição Médica</h2>
    </header>

    <section className="grid gap-2 border-b border-slate-300 py-5 text-sm sm:grid-cols-2"><p><strong>Paciente:</strong> {paciente?.nome_completo ?? "—"}</p><p><strong>Atendimento:</strong> #{atendimento?.numero_atendimento ?? "—"}</p><p><strong>RA:</strong> {paciente?.ra ?? "—"} · <strong>Registro:</strong> {paciente?.numero_registro ?? "—"}</p><p><strong>CPF/CNS:</strong> {paciente?.cpf ?? "—"} / {paciente?.cns ?? "—"}</p></section>

    <section className="py-6"><div className="rounded-xl border border-slate-300 p-5"><h3 className="text-lg font-black">{p.item}</h3><p className="mt-2 text-sm">{[p.dose,p.via,p.frequencia,p.duracao].filter(Boolean).join(" · ")}</p>{horarios ? <p className="mt-2 text-sm"><strong>Horários:</strong> {horarios}</p> : null}{p.quantidade ? <p className="mt-2 text-sm"><strong>Quantidade:</strong> {p.quantidade} {p.unidade_dose ?? ""}</p> : null}{p.diluente ? <p className="mt-2 text-sm"><strong>Diluente/solução:</strong> {p.diluente}</p> : null}{p.velocidade_infusao ? <p className="mt-2 text-sm"><strong>Velocidade de infusão:</strong> {p.velocidade_infusao}</p> : null}{componentes.length ? <div className="mt-4 border-t border-slate-200 pt-4"><p className="text-xs font-black uppercase tracking-wider text-slate-500">Composição da administração</p>{componentes.map((c) => { const item=one(c.item); return <p key={c.id} className="mt-2 text-sm"><strong>+</strong> {item?.descricao ?? "Componente"}{item?.concentracao ? ` · ${item.concentracao}` : ""}{c.dose ? ` · dose ${c.dose}` : ""}{c.quantidade ? ` · ${c.quantidade} ${c.unidade_dose ?? ""}` : ""}{c.observacoes ? ` · ${c.observacoes}` : ""}</p>; })}</div> : null}{p.instrucoes ? <p className="mt-4 text-sm"><strong>Instruções:</strong> {p.instrucoes}</p> : null}{p.orientacoes ? <p className="mt-2 text-sm"><strong>Orientações:</strong> {p.orientacoes}</p> : null}</div></section>

    <section className="mt-8 border-t border-slate-300 pt-6 text-sm"><p><strong>Prescritor:</strong> {profissional?.nome_completo ?? "—"}</p><p>{profissional?.especialidade ?? ""}{profissional?.conselho ? ` · ${profissional.conselho} ${profissional.numero_conselho ?? ""}/${profissional.uf_conselho ?? ""}` : ""}</p><p className="mt-2 text-xs text-slate-500">Assinada em {fmt(p.assinado_em)} · Documento gerado a partir do prontuário eletrônico.</p></section>
    {empresa?.rodape_documentos ? <footer className="mt-10 border-t border-slate-200 pt-3 text-center text-xs text-slate-500">{empresa.rodape_documentos}</footer> : null}
  </main>;
}
