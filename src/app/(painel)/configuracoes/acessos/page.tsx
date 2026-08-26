import { KeyRound, ShieldCheck, UserCog, UsersRound } from "lucide-react";
import { ActionPanel } from "@/components/painel/action-panel";
import { SectionPage } from "@/components/painel/section-page";
import { requirePermission } from "@/lib/permissions/server";
import {
  atualizarPermissoesPerfil,
  criarPerfilAcesso,
  removerVinculoPerfil,
  vincularPerfilUsuario,
} from "@/modules/usuarios/acessos-actions";

type Perfil = { id: string; nome: string; sistema: boolean; ativo: boolean };
type Permissao = { id: string; codigo: string; descricao: string; ativo: boolean };
type PerfilPermissao = { perfil_id: string; permissao_id: string };
type Usuario = { id: string; nome: string; cargo: string | null; ativo: boolean };
type UsuarioEmpresa = { usuario_id: string; usuario: Usuario | Usuario[] | null };
type Unidade = { id: string; nome: string; ativo: boolean };
type Vinculo = {
  id: string;
  usuario_id: string;
  perfil_id: string;
  unidade_id: string | null;
  ativo: boolean;
  perfil: { id: string; nome: string } | Array<{ id: string; nome: string }> | null;
  unidade: { nome: string } | Array<{ nome: string }> | null;
};

function one<T>(value: T | T[] | null) {
  return Array.isArray(value) ? value[0] ?? null : value;
}

function domainLabel(domain: string) {
  const labels: Record<string, string> = {
    empresas: "Empresas",
    estrutura: "Estrutura",
    usuarios: "Usuários e acessos",
    pacientes: "Pacientes",
    profissionais: "Profissionais",
    convenios: "Convênios",
    catalogos: "Catálogos",
    agenda: "Agenda",
    recepcao: "Recepção",
    senhas: "Senhas",
    paineis: "Painéis",
    atendimentos: "Atendimentos",
    autorizacoes: "Autorizações",
    guias: "Guias",
    triagem: "Triagem",
    fila_medica: "Fila médica",
    prontuario: "Prontuário",
    prescricao: "Prescrição",
    assistencial: "Assistencial",
    sae: "SAE / Enfermagem",
    enfermagem: "Enfermagem",
    farmacia: "Farmácia",
    medicamentos: "Medicamentos",
    laboratorio: "Laboratório",
    imagem: "Imagem / RIS-PACS",
    exames: "Exames",
    internacao: "Internação",
    alta: "Alta e transição",
    centro_cirurgico: "Centro cirúrgico",
    cme: "CME",
    nutricao: "Nutrição",
    hemoterapia: "Hemoterapia",
    ccih: "CCIH",
    antimicrobianos: "Antimicrobianos",
    uti: "UTI",
    multiprofissional: "Equipe multiprofissional",
    procedimentos_assistenciais: "Procedimentos assistenciais",
    transportes: "Transportes",
    seguranca_paciente: "Segurança do paciente",
    obstetricia: "Obstetrícia",
    neonatal: "Neonatal",
    obitos: "Óbitos",
    dialise: "Hemodiálise",
    oncologia: "Oncologia",
    radioterapia: "Radioterapia",
    hemodinamica: "Hemodinâmica",
    endoscopia: "Endoscopia",
    anatomia_patologica: "Anatomia Patológica",
    transplantes: "Transplantes",
    homecare: "Home Care",
    paliativos: "Cuidados Paliativos",
    imunizacao: "Imunização",
    rh: "Recursos Humanos",
    seguranca: "Segurança / Portaria",
    visitantes: "Visitantes e acompanhantes",
    compras: "Compras",
    estoque: "Estoque",
    almoxarifado: "Almoxarifado",
    credenciamento: "Credenciamento",
    comercial: "Comercial",
    tabelas_comerciais: "Tabelas comerciais",
    tabelas_procedimentos: "Procedimentos",
    auditoria: "Auditoria",
    contas_medicas: "Contas médicas",
    faturamento: "Faturamento",
    tiss: "TISS",
    glosas: "Glosas",
    financeiro: "Financeiro",
    nfse: "NFS-e",
    ged: "GED",
    diretoria: "Diretoria",
    ti: "Tecnologia / TI",
    engenharia_clinica: "Engenharia Clínica",
    configuracoes: "Configurações",
  };
  return labels[domain] ?? domain.replaceAll("_", " ");
}

export default async function AcessosPage({
  searchParams,
}: {
  searchParams: Promise<{ sucesso?: string; erro?: string }>;
}) {
  const query = await searchParams;
  const { supabase, empresaId } = await requirePermission("usuarios.administrar");

  const [perfisResult, permissoesResult, perfilPermissoesResult, usuariosResult, unidadesResult, vinculosResult] = await Promise.all([
    supabase.from("perfis").select("id,nome,sistema,ativo").eq("empresa_id", empresaId).order("nome"),
    supabase.from("permissoes").select("id,codigo,descricao,ativo").eq("ativo", true).order("codigo"),
    supabase.from("perfil_permissoes").select("perfil_id,permissao_id"),
    supabase.from("usuario_empresas").select("usuario_id,usuario:usuarios(id,nome,cargo,ativo)").eq("empresa_id", empresaId).eq("ativo", true),
    supabase.from("unidades").select("id,nome,ativo").eq("empresa_id", empresaId).eq("ativo", true).order("nome"),
    supabase.from("usuario_perfis").select("id,usuario_id,perfil_id,unidade_id,ativo,perfil:perfis(id,nome),unidade:unidades(nome)").eq("empresa_id", empresaId).eq("ativo", true),
  ]);

  const perfis = (perfisResult.data ?? []) as Perfil[];
  const permissoes = (permissoesResult.data ?? []) as Permissao[];
  const perfilPermissoes = (perfilPermissoesResult.data ?? []) as PerfilPermissao[];
  const usuariosEmpresa = (usuariosResult.data ?? []) as unknown as UsuarioEmpresa[];
  const unidades = (unidadesResult.data ?? []) as Unidade[];
  const vinculos = (vinculosResult.data ?? []) as unknown as Vinculo[];
  const usuarios = usuariosEmpresa
    .map((item) => one(item.usuario))
    .filter((item): item is Usuario => Boolean(item?.id))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

  const selectedByProfile = new Map<string, Set<string>>();
  for (const item of perfilPermissoes) {
    if (!selectedByProfile.has(item.perfil_id)) selectedByProfile.set(item.perfil_id, new Set());
    selectedByProfile.get(item.perfil_id)?.add(item.permissao_id);
  }

  const groupedPermissions = new Map<string, Permissao[]>();
  for (const permissao of permissoes) {
    const domain = permissao.codigo.split(".")[0];
    if (!groupedPermissions.has(domain)) groupedPermissions.set(domain, []);
    groupedPermissions.get(domain)?.push(permissao);
  }

  const activeProfiles = perfis.filter((perfil) => perfil.ativo);
  const linksByUser = new Map<string, Vinculo[]>();
  for (const vinculo of vinculos) {
    if (!linksByUser.has(vinculo.usuario_id)) linksByUser.set(vinculo.usuario_id, []);
    linksByUser.get(vinculo.usuario_id)?.push(vinculo);
  }

  return (
    <SectionPage
      eyebrow="Configurações / Segurança"
      title="Usuários e Acessos"
      description="Administre perfis, permissões e escopo por unidade. Todos os setores assistenciais e administrativos usam esta mesma matriz de autorização."
    >
      {query.sucesso ? <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">Alteração concluída: {query.sucesso.replaceAll("-", " ")}.</div> : null}
      {query.erro ? <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">Operação bloqueada: {query.erro.replaceAll("-", " ")}.</div> : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi icon={UsersRound} label="Usuários vinculados" value={usuarios.length} />
        <Kpi icon={ShieldCheck} label="Perfis ativos" value={activeProfiles.length} />
        <Kpi icon={KeyRound} label="Permissões ativas" value={permissoes.length} />
        <Kpi icon={UserCog} label="Vínculos perfil/unidade" value={vinculos.length} />
      </section>

      <section className="mt-5 grid gap-5 xl:grid-cols-[0.82fr_1.18fr]">
        <div className="space-y-5">
          <ActionPanel title="Criar perfil de acesso" description="Crie um perfil e depois selecione exatamente as capacidades que ele poderá executar.">
            <form action={criarPerfilAcesso} className="flex flex-col gap-3 sm:flex-row">
              <input name="nome" required minLength={2} className="ui-input flex-1" placeholder="Ex.: Farmácia Clínica" />
              <button className="ui-button-primary">Criar perfil</button>
            </form>
          </ActionPanel>

          <section className="his-card overflow-hidden">
            <div className="border-b border-slate-100 p-5">
              <h2 className="font-black text-slate-900">Vincular perfil ao usuário</h2>
              <p className="mt-1 text-sm text-slate-500">O perfil pode valer para toda a empresa ou somente para uma unidade.</p>
            </div>
            <form action={vincularPerfilUsuario} className="grid gap-3 p-5">
              <label className="text-sm font-semibold text-slate-700">Usuário
                <select name="usuario_id" required defaultValue="" className="ui-input mt-2">
                  <option value="">Selecione</option>
                  {usuarios.map((usuario) => <option key={usuario.id} value={usuario.id}>{usuario.nome}{usuario.cargo ? ` · ${usuario.cargo}` : ""}</option>)}
                </select>
              </label>
              <label className="text-sm font-semibold text-slate-700">Perfil
                <select name="perfil_id" required defaultValue="" className="ui-input mt-2">
                  <option value="">Selecione</option>
                  {activeProfiles.map((perfil) => <option key={perfil.id} value={perfil.id}>{perfil.nome}</option>)}
                </select>
              </label>
              <label className="text-sm font-semibold text-slate-700">Escopo
                <select name="unidade_id" defaultValue="" className="ui-input mt-2">
                  <option value="">Toda a empresa</option>
                  {unidades.map((unidade) => <option key={unidade.id} value={unidade.id}>{unidade.nome}</option>)}
                </select>
              </label>
              <button className="ui-button-primary justify-self-end">Aplicar acesso</button>
            </form>
          </section>
        </div>

        <section className="his-card overflow-hidden">
          <div className="border-b border-slate-100 p-5">
            <h2 className="font-black text-slate-900">Usuários e perfis efetivos</h2>
            <p className="mt-1 text-sm text-slate-500">Revogue vínculos sem apagar histórico. A própria conta do administrador não pode ser desvinculada por esta tela.</p>
          </div>
          <div className="max-h-[720px] divide-y divide-slate-100 overflow-y-auto">
            {usuarios.length ? usuarios.map((usuario) => {
              const userLinks = linksByUser.get(usuario.id) ?? [];
              return <article key={usuario.id} className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div><p className="font-black text-slate-900">{usuario.nome}</p><p className="mt-1 text-xs text-slate-500">{usuario.cargo ?? "Sem cargo informado"}</p></div>
                  <span className={`rounded-full px-2.5 py-1 text-[11px] font-black ${usuario.ativo ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{usuario.ativo ? "ativo" : "inativo"}</span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {userLinks.length ? userLinks.map((vinculo) => {
                    const perfil = one(vinculo.perfil);
                    const unidade = one(vinculo.unidade);
                    return <form key={vinculo.id} action={removerVinculoPerfil} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1.5">
                      <input type="hidden" name="vinculo_id" value={vinculo.id} />
                      <span className="text-xs font-bold text-slate-700">{perfil?.nome ?? "Perfil"}<span className="ml-1 font-medium text-slate-400">· {unidade?.nome ?? "empresa"}</span></span>
                      <button aria-label={`Remover perfil ${perfil?.nome ?? ""}`} className="text-xs font-black text-rose-600 hover:text-rose-800">×</button>
                    </form>;
                  }) : <span className="text-xs text-slate-400">Nenhum perfil ativo.</span>}
                </div>
              </article>;
            }) : <p className="p-8 text-center text-sm text-slate-500">Nenhum usuário vinculado à empresa.</p>}
          </div>
        </section>
      </section>

      <section className="mt-5">
        <div className="mb-4"><p className="his-eyebrow">Matriz de autorização</p><h2 className="mt-1 text-xl font-black text-slate-950">Permissões por perfil</h2><p className="mt-1 text-sm text-slate-500">A matriz inclui os setores clínicos, diagnóstico, internação, faturamento, gestão, RH, Segurança/Portaria e demais módulos do HIS.</p></div>
        <div className="space-y-3">
          {activeProfiles.map((perfil) => {
            const selected = selectedByProfile.get(perfil.id) ?? new Set<string>();
            const administrator = perfil.sistema && ["administrador", "admin"].includes(perfil.nome.toLowerCase());
            return <details id={`perfil-${perfil.id}`} key={perfil.id} className="his-card overflow-hidden">
              <summary className="flex cursor-pointer list-none items-center gap-4 p-5">
                <span className="grid size-11 place-items-center rounded-2xl bg-brand-50 text-brand-700"><ShieldCheck className="size-5" /></span>
                <div className="min-w-0 flex-1"><h3 className="font-black text-slate-900">{perfil.nome}</h3><p className="mt-1 text-xs text-slate-500">{perfil.sistema ? "Perfil do sistema" : "Perfil personalizado"} · {selected.size} permissão(ões)</p></div>
                {administrator ? <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">acesso total</span> : null}
              </summary>
              <div className="border-t border-slate-100 bg-slate-50/40 p-5">
                {administrator ? (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">
                    <p>O perfil Administrador deve possuir todas as permissões ativas, incluindo todos os setores assistenciais e administrativos.</p>
                    <form action={atualizarPermissoesPerfil} className="mt-3 flex justify-end">
                      <input type="hidden" name="perfil_id" value={perfil.id} />
                      <button className="ui-button-primary">Sincronizar acesso total</button>
                    </form>
                  </div>
                ) : (
                  <form action={atualizarPermissoesPerfil}>
                    <input type="hidden" name="perfil_id" value={perfil.id} />
                    <div className="grid gap-4 xl:grid-cols-2 2xl:grid-cols-3">
                      {[...groupedPermissions.entries()].map(([domain, items]) => <fieldset key={domain} className="rounded-2xl border border-slate-200 bg-white p-4">
                        <legend className="px-1 text-xs font-black uppercase tracking-wider text-slate-500">{domainLabel(domain)}</legend>
                        <div className="mt-2 space-y-2.5">{items.map((permission) => <label key={permission.id} className="flex items-start gap-2.5 text-sm text-slate-700">
                          <input type="checkbox" name="permissoes" value={permission.codigo} defaultChecked={selected.has(permission.id)} className="mt-0.5 size-4 rounded border-slate-300" />
                          <span><strong className="block text-xs font-bold text-slate-800">{permission.codigo}</strong><span className="text-xs text-slate-500">{permission.descricao}</span></span>
                        </label>)}</div>
                      </fieldset>)}
                    </div>
                    <div className="mt-5 flex justify-end border-t border-slate-200 pt-4"><button className="ui-button-primary">Salvar matriz do perfil</button></div>
                  </form>
                )}
              </div>
            </details>;
          })}
        </div>
      </section>
    </SectionPage>
  );
}

function Kpi({ icon: Icon, label, value }: { icon: typeof UsersRound; label: string; value: number }) {
  return <div className="his-kpi"><div className="flex items-center justify-between"><p className="text-xs font-black uppercase tracking-wider text-slate-400">{label}</p><Icon className="size-5 text-brand-600" /></div><p className="mt-2 text-3xl font-black text-brand-950">{value}</p></div>;
}
