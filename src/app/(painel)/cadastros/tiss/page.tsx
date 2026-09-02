import type { Route } from "next";
import Link from "next/link";
import {
  AlertTriangle,
  BookOpenCheck,
  Building2,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Hospital,
  ShieldCheck,
  Stethoscope,
  UsersRound,
} from "lucide-react";
import { CadastrosWorkspaceNav, CadastroKpi } from "@/components/cadastros/cadastros-workspace-nav";
import { CompanyTissProfileForm, UnitTissProfileForm } from "@/components/cadastros/institution-tiss-profile-forms";
import { SectionPage } from "@/components/painel/section-page";
import { getAssistencialContext } from "@/modules/assistencial/context";

function digits(value: string | null | undefined) {
  return String(value ?? "").replace(/\D/g, "");
}
function present(value: string | null | undefined) {
  return Boolean(String(value ?? "").trim());
}
function validCnpj(value: string | null | undefined) {
  return digits(value).length === 14;
}
function validCnes(value: string | null | undefined) {
  return digits(value).length === 7;
}
function validAns(value: string | null | undefined) {
  return digits(value).length === 6;
}
function professionalReady(item: { cbo: string | null; conselho: string | null; numero_conselho: string | null; uf_conselho: string | null }) {
  return present(item.cbo) && present(item.conselho) && present(item.numero_conselho) && /^[A-Za-z]{2}$/.test(String(item.uf_conselho ?? "").trim());
}

export default async function CadastrosTissPage() {
  const { supabase, empresaId, unidadeId } = await getAssistencialContext();
  const [empresaRes, unidadeRes, profissionaisRes, profissionaisPendentesCount, conveniosRes, conveniosPendentesCount, pacientesRes, pacientesIncompletosCount, itensSemTussCount, itensSemTussRes] = await Promise.all([
    supabase.from("empresas").select("id,razao_social,nome_fantasia,cnpj,cnes").eq("id", empresaId).maybeSingle(),
    supabase.from("unidades").select("id,nome,cnes").eq("id", unidadeId).maybeSingle(),
    supabase.from("profissionais").select("id,nome_completo,cbo,conselho,numero_conselho,uf_conselho").eq("ativo", true).or("cbo.is.null,conselho.is.null,numero_conselho.is.null,uf_conselho.is.null").order("nome_completo").limit(12),
    supabase.from("profissionais").select("id", { count: "exact", head: true }).eq("ativo", true).or("cbo.is.null,conselho.is.null,numero_conselho.is.null,uf_conselho.is.null"),
    supabase.from("convenios").select("id,nome_fantasia,razao_social,registro_ans,cnpj").eq("ativo", true).is("registro_ans", null).order("nome_fantasia").limit(12),
    supabase.from("convenios").select("id", { count: "exact", head: true }).eq("ativo", true).is("registro_ans", null),
    supabase.from("pacientes").select("id,nome_completo,ra,numero_registro,cpf,cns").eq("ativo", true).or("cpf.is.null,cns.is.null").order("nome_completo").limit(12),
    supabase.from("pacientes").select("id", { count: "exact", head: true }).eq("ativo", true).or("cpf.is.null,cns.is.null"),
    supabase.from("tabelas_procedimentos_itens").select("id", { count: "exact", head: true }).eq("ativo", true).is("codigo_tuss", null),
    supabase.from("tabelas_procedimentos_itens").select("id,codigo,codigo_tuss,descricao,tipo_item,edicao:tabelas_procedimentos_edicoes(nome_edicao,fonte:tabelas_procedimentos_fontes(nome,codigo))").eq("ativo", true).is("codigo_tuss", null).order("descricao").limit(12),
  ]);

  const empresa = empresaRes.data;
  const unidade = unidadeRes.data;
  const empresaReady = Boolean(empresa && validCnpj(empresa.cnpj) && validCnes(empresa.cnes));
  const unidadeReady = Boolean(unidade && validCnes(unidade.cnes));
  const profissionaisPendentes = profissionaisRes.data ?? [];
  const conveniosPendentes = conveniosRes.data ?? [];
  const pacientesIncompletos = pacientesRes.data ?? [];
  const itensSemTuss = itensSemTussRes.data ?? [];
  const blockers = (empresaReady ? 0 : 1) + (unidadeReady ? 0 : 1) + Number(profissionaisPendentesCount.count ?? 0) + Number(conveniosPendentesCount.count ?? 0) + Number(itensSemTussCount.count ?? 0);

  return <SectionPage eyebrow="Cadastros / TISS" title="Prontidão cadastral para TISS" description="Corrija dados regulatórios na origem antes que cheguem à Guia TISS. Carteirinha, autorização e senha continuam pertencendo ao episódio/atendimento, não ao cadastro mestre." actions={<Link href="/faturamento/guias" className="ui-button-secondary">Abrir Guias TISS</Link>}>
    <CadastrosWorkspaceNav active="/cadastros/tiss" />
    <section className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      <CadastroKpi label="Bloqueios cadastrais" value={blockers} detail={blockers ? "Corrigir antes da geração final" : "Base sem pendências detectadas"} />
      <CadastroKpi label="Profissionais pendentes" value={profissionaisPendentesCount.count ?? 0} detail="Conselho, UF e CBO" />
      <CadastroKpi label="Convênios sem ANS" value={conveniosPendentesCount.count ?? 0} detail="Registro da operadora" />
      <CadastroKpi label="Itens sem TUSS" value={itensSemTussCount.count ?? 0} detail="Mapeamento do catálogo comercial" />
      <CadastroKpi label="Identidade a revisar" value={pacientesIncompletosCount.count ?? 0} detail="CPF/CNS — qualidade documental" />
    </section>

    <section className={`mb-5 rounded-2xl border p-5 ${blockers ? "border-amber-200 bg-amber-50" : "border-emerald-200 bg-emerald-50"}`}>
      <div className="flex items-start gap-3">{blockers ? <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-700" /> : <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-700" />}<div><h2 className={`font-black ${blockers ? "text-amber-950" : "text-emerald-950"}`}>{blockers ? "A base ainda possui bloqueios para o wire TISS 4.03.00" : "Cadastros mestres prontos para o TISS detectado"}</h2><p className={`mt-1 text-sm ${blockers ? "text-amber-800" : "text-emerald-800"}`}>Esta central não inventa código regulatório e não corrige dados automaticamente. Cada pendência leva ao cadastro de origem; a Guia TISS continua executando sua própria validação antes de entrar em lote.</p></div></div>
    </section>

    <div className="grid gap-5 xl:grid-cols-2">
      <ReadinessCard icon={Building2} title="Prestador / Empresa" description="Identificação jurídica e CNES usados na mensagem enviada à operadora." ready={empresaReady} href="/configuracoes/empresa" items={[{ label: "CNPJ", value: empresa?.cnpj ?? null, ok: validCnpj(empresa?.cnpj) }, { label: "CNES", value: empresa?.cnes ?? null, ok: validCnes(empresa?.cnes) }]} />
      <ReadinessCard icon={Hospital} title="Unidade ativa" description="O CNES da unidade precisa corresponder ao local assistencial efetivamente utilizado." ready={unidadeReady} items={[{ label: unidade?.nome ?? "Unidade ativa", value: unidade?.cnes ?? null, ok: validCnes(unidade?.cnes) }]} />
    </div>

    {empresa && unidade ? <section className="mt-5 grid gap-5 xl:grid-cols-2"><CompanyTissProfileForm cnpj={empresa.cnpj} cnes={empresa.cnes} /><UnitTissProfileForm unidadeId={unidade.id} nome={unidade.nome} cnes={unidade.cnes} /></section> : null}

    <section className="mt-5 grid gap-5 xl:grid-cols-2">
      <PendingList icon={Stethoscope} title="Profissionais" description="Conselho, número, UF e CBO devem existir na ficha do profissional. A normalização para os domínios ANS acontece na validação TISS." empty="Nenhum profissional ativo com campo regulatório nulo." href="/profissionais" rows={profissionaisPendentes.map((item) => ({ key: item.id, title: item.nome_completo, detail: [item.conselho, item.numero_conselho, item.uf_conselho, item.cbo ? `CBO ${item.cbo}` : null].filter(Boolean).join(" · ") || "Dados regulatórios ausentes", ready: professionalReady(item), editHref: `/profissionais/${item.id}` as Route }))} />
      <PendingList icon={Building2} title="Convênios / operadoras" description="O registro ANS é a identificação regulatória da operadora no TISS. CNPJ e contrato comercial não substituem esse código." empty="Todos os convênios ativos possuem registro ANS cadastrado." href="/convenios" rows={conveniosPendentes.map((item) => ({ key: item.id, title: item.nome_fantasia || item.razao_social, detail: item.cnpj ? `CNPJ ${item.cnpj}` : "CNPJ não informado", ready: validAns(item.registro_ans), editHref: `/convenios/${item.id}` as Route }))} />
      <PendingList icon={BookOpenCheck} title="Procedimentos e tabelas" description="Itens comerciais sem código TUSS precisam de mapeamento antes de alimentar cobrança regulatória. Não é criado código TUSS artificial." empty="Nenhum item ativo sem código TUSS foi localizado." href="/comercial/tabelas" rows={itensSemTuss.map((item) => { const edicao = Array.isArray(item.edicao) ? item.edicao[0] : item.edicao; const fonte = edicao && (Array.isArray(edicao.fonte) ? edicao.fonte[0] : edicao.fonte); return { key: item.id, title: `${item.codigo} · ${item.descricao}`, detail: [fonte?.codigo, fonte?.nome, edicao?.nome_edicao, item.tipo_item].filter(Boolean).join(" · ") || "Tabela comercial", ready: present(item.codigo_tuss) }; })} />
      <PendingList icon={UsersRound} title="Pacientes — qualidade documental" description="CPF/CNS pertencem à identidade mestre. Ausência aqui é sinalizada para saneamento, mas a obrigatoriedade TISS final depende do tipo de mensagem e do episódio." empty="Nenhum paciente ativo com CPF ou CNS nulo foi localizado." href="/pacientes" tone="quality" rows={pacientesIncompletos.map((item) => ({ key: item.id, title: item.nome_completo, detail: `${item.ra} · Registro #${item.numero_registro} · CPF ${item.cpf || "—"} · CNS ${item.cns || "—"}`, ready: present(item.cpf) && present(item.cns), editHref: `/pacientes/${item.id}/identificacao` as Route }))} />
    </section>
  </SectionPage>;
}

function ReadinessCard({ icon: Icon, title, description, ready, href, items }: { icon: typeof ShieldCheck; title: string; description: string; ready: boolean; href?: Route; items: Array<{ label: string; value: string | null; ok: boolean }> }) {
  return <article className="ui-card p-5"><div className="flex items-start justify-between gap-4"><div className="flex items-start gap-3"><span className={`grid size-10 shrink-0 place-items-center rounded-xl ${ready ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}><Icon className="size-5" /></span><div><h2 className="font-black text-slate-950">{title}</h2><p className="mt-1 text-sm text-slate-500">{description}</p></div></div><Status ready={ready} /></div><div className="mt-4 grid gap-2 sm:grid-cols-2">{items.map((item) => <div key={item.label} className="rounded-xl border border-slate-200 p-3"><p className="text-[11px] font-black uppercase tracking-wide text-slate-400">{item.label}</p><div className="mt-1 flex items-center justify-between gap-2"><span className="truncate text-sm font-semibold text-slate-800">{item.value || "Não informado"}</span>{item.ok ? <CheckCircle2 className="size-4 shrink-0 text-emerald-600" /> : <AlertTriangle className="size-4 shrink-0 text-amber-600" />}</div></div>)}</div>{href ? <div className="mt-4 flex justify-end"><Link href={href} className="ui-button-secondary">Corrigir cadastro <ChevronRight className="size-4" /></Link></div> : null}</article>;
}
function PendingList({ icon: Icon, title, description, empty, href, rows, tone = "blocking" }: { icon: typeof ClipboardCheck; title: string; description: string; empty: string; href: Route; rows: Array<{ key: string; title: string; detail: string; ready: boolean; editHref?: Route }>; tone?: "blocking" | "quality" }) {
  return <article className="ui-card overflow-hidden"><div className="flex items-start justify-between gap-4 border-b border-slate-100 p-5"><div className="flex items-start gap-3"><span className={`grid size-10 shrink-0 place-items-center rounded-xl ${tone === "quality" ? "bg-blue-50 text-blue-700" : "bg-amber-50 text-amber-700"}`}><Icon className="size-5" /></span><div><h2 className="font-black text-slate-950">{title}</h2><p className="mt-1 text-sm text-slate-500">{description}</p></div></div><Link href={href} className="text-xs font-black text-brand-700 hover:underline">Ver todos</Link></div>{rows.length ? <div className="divide-y divide-slate-100">{rows.map((row) => <div key={row.key} className="flex items-center justify-between gap-4 px-5 py-4"><div className="min-w-0"><p className="truncate font-semibold text-slate-900">{row.title}</p><p className="mt-1 truncate text-xs text-slate-500">{row.detail}</p></div><div className="flex shrink-0 items-center gap-2"><Status ready={row.ready} quality={tone === "quality"} />{row.editHref ? <Link href={row.editHref} className="ui-button-secondary !px-3 !py-1.5 !text-xs">Corrigir</Link> : null}</div></div>)}</div> : <div className="flex items-center gap-3 p-5 text-sm font-semibold text-emerald-700"><CheckCircle2 className="size-5" />{empty}</div>}</article>;
}
function Status({ ready, quality = false }: { ready: boolean; quality?: boolean }) {
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wide ${ready ? "bg-emerald-50 text-emerald-700" : quality ? "bg-blue-50 text-blue-700" : "bg-amber-50 text-amber-700"}`}>{ready ? "Pronto" : quality ? "Revisar" : "Pendente"}</span>;
}
