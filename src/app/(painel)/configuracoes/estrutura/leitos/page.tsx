import Link from "next/link";
import { BedDouble, Building2, DoorOpen, ShieldCheck } from "lucide-react";
import { SectionPage } from "@/components/painel/section-page";
import { requirePermission } from "@/lib/permissions/server";
import { criarLeitoOperacional } from "@/modules/internacao/leitos-actions";

type Estrutura = {
  id: string;
  nome: string;
  codigo: string;
  tipo: string;
};

type Leito = {
  id: string;
  codigo: string;
  quarto: string | null;
  tipo: string | null;
  acomodacao: string | null;
  sexo_restricao: string | null;
  isolamento_capaz: boolean | null;
  status: string;
  estrutura_fisica_id: string | null;
  estrutura: Estrutura | Estrutura[] | null;
};

type Params = { sucesso?: string; erro?: string };

const one = <T,>(value: T | T[] | null): T | null => Array.isArray(value) ? value[0] ?? null : value;

const statusLabel: Record<string, string> = {
  livre: "Livre",
  ocupado: "Ocupado",
  reservado: "Reservado",
  higienizacao: "Higienização",
  bloqueado: "Bloqueado",
  manutencao: "Manutenção",
};

export default async function CadastroLeitosPage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const { supabase, empresaId, unidadeId } = await requirePermission("leitos.gerenciar");
  if (!unidadeId) return null;

  const [estruturasReq, leitosReq] = await Promise.all([
    supabase
      .from("estruturas_fisicas")
      .select("id,nome,codigo,tipo")
      .eq("empresa_id", empresaId)
      .eq("unidade_id", unidadeId)
      .eq("ativo", true)
      .eq("permite_internacao", true)
      .order("ordem")
      .order("nome"),
    supabase
      .from("leitos")
      .select("id,codigo,quarto,tipo,acomodacao,sexo_restricao,isolamento_capaz,status,estrutura_fisica_id,estrutura:estruturas_fisicas(id,nome,codigo,tipo)")
      .eq("empresa_id", empresaId)
      .eq("unidade_id", unidadeId)
      .eq("ativo", true)
      .order("setor")
      .order("codigo")
      .limit(1000),
  ]);

  const estruturas = (estruturasReq.data ?? []) as Estrutura[];
  const leitos = (leitosReq.data ?? []) as Leito[];
  const mensagemErro: Record<string, string> = {
    unidade: "Selecione uma unidade para cadastrar leitos.",
    campos: "Informe o código e a ala/UTI do leito.",
    estrutura: "Selecione uma estrutura ativa que permita internação.",
    codigo: "Já existe um leito com esse código na unidade.",
    salvar: "Não foi possível cadastrar o leito.",
  };

  return (
    <SectionPage
      eyebrow="Configurações / Estrutura"
      title="Cadastro de leitos"
      description="Defina os leitos físicos da unidade. Ocupação, reservas, bloqueios e giro são operados nos módulos de Internação e NIR."
      actions={
        <div className="flex gap-2">
          <Link href="/configuracoes/estrutura" className="ui-button-secondary">Estrutura hospitalar</Link>
          <Link href="/internacao/leitos" className="ui-button-primary"><BedDouble className="size-4" />Mapa de leitos</Link>
        </div>
      }
    >
      {params.sucesso ? (
        <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
          Leito cadastrado com sucesso.
        </div>
      ) : null}
      {params.erro ? (
        <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
          {mensagemErro[params.erro] ?? "Não foi possível concluir o cadastro."}
        </div>
      ) : null}

      <section className="grid gap-5 xl:grid-cols-[minmax(340px,.72fr)_minmax(0,1.28fr)]">
        <form action={criarLeitoOperacional} className="his-card p-5">
          <div className="flex items-start gap-3 border-b border-slate-100 pb-4">
            <span className="grid size-10 place-items-center rounded-xl bg-brand-50 text-brand-700"><Building2 className="size-5" /></span>
            <div>
              <h2 className="font-black text-slate-950">Novo leito</h2>
              <p className="mt-1 text-xs leading-5 text-slate-500">Cadastre características permanentes do leito e vincule à ala, enfermaria ou UTI.</p>
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="space-y-1 text-xs font-bold text-slate-600">
              <span>Código *</span>
              <input name="codigo" required placeholder="Ex.: 101-A" className="ui-input uppercase" />
            </label>
            <label className="space-y-1 text-xs font-bold text-slate-600">
              <span>Quarto</span>
              <input name="quarto" placeholder="Ex.: 101" className="ui-input" />
            </label>
            <label className="space-y-1 text-xs font-bold text-slate-600 sm:col-span-2">
              <span>Ala / enfermaria / UTI *</span>
              <select name="estrutura_fisica_id" required defaultValue="" className="ui-input">
                <option value="">Selecione...</option>
                {estruturas.map((item) => <option key={item.id} value={item.id}>{item.nome} · {item.tipo.replaceAll("_", " ")}</option>)}
              </select>
            </label>
            <label className="space-y-1 text-xs font-bold text-slate-600">
              <span>Tipo do leito</span>
              <select name="tipo" defaultValue="enfermaria" className="ui-input">
                <option value="enfermaria">Enfermaria</option>
                <option value="uti">UTI</option>
                <option value="observacao">Observação</option>
                <option value="isolamento">Isolamento</option>
              </select>
            </label>
            <label className="space-y-1 text-xs font-bold text-slate-600">
              <span>Acomodação</span>
              <select name="acomodacao" defaultValue="enfermaria" className="ui-input">
                <option value="enfermaria">Enfermaria</option>
                <option value="apartamento">Apartamento</option>
                <option value="coletiva">Coletiva</option>
                <option value="uti">UTI</option>
                <option value="observacao">Observação</option>
              </select>
            </label>
            <label className="space-y-1 text-xs font-bold text-slate-600">
              <span>Restrição por sexo</span>
              <select name="sexo_restricao" defaultValue="" className="ui-input">
                <option value="">Sem restrição</option>
                <option value="masculino">Masculino</option>
                <option value="feminino">Feminino</option>
              </select>
            </label>
            <label className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-3 text-xs font-bold text-slate-700">
              <input type="checkbox" name="isolamento_capaz" className="size-4 accent-brand-700" />
              Compatível com isolamento
            </label>
          </div>
          <button className="ui-button-primary mt-4 w-full">Cadastrar leito</button>
        </form>

        <section className="his-card overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[.14em] text-slate-400">Cadastro mestre</p>
              <h2 className="mt-1 font-black text-slate-950">Leitos físicos da unidade</h2>
            </div>
            <span className="rounded-xl bg-slate-50 px-3 py-2 text-xs font-bold text-slate-500">{leitos.length} ativos</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3">Leito</th>
                  <th className="px-4 py-3">Estrutura</th>
                  <th className="px-4 py-3">Tipo / acomodação</th>
                  <th className="px-4 py-3">Restrição</th>
                  <th className="px-4 py-3">Isolamento</th>
                  <th className="px-5 py-3">Status atual</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {leitos.map((leito) => {
                  const estrutura = one(leito.estrutura);
                  return (
                    <tr key={leito.id} className="bg-white">
                      <td className="px-5 py-3"><strong className="text-slate-950">{leito.codigo}</strong><span className="ml-2 text-xs text-slate-400">{leito.quarto ? `Quarto ${leito.quarto}` : ""}</span></td>
                      <td className="px-4 py-3 text-slate-600">{estrutura?.nome ?? "Sem vínculo"}</td>
                      <td className="px-4 py-3 text-slate-600">{leito.tipo ?? "—"} · {leito.acomodacao ?? "—"}</td>
                      <td className="px-4 py-3 text-slate-600">{leito.sexo_restricao ?? "Sem restrição"}</td>
                      <td className="px-4 py-3">{leito.isolamento_capaz ? <span className="inline-flex items-center gap-1 rounded-lg bg-cyan-50 px-2 py-1 text-xs font-bold text-cyan-700"><ShieldCheck className="size-3.5" />Sim</span> : <span className="text-xs text-slate-400">Não</span>}</td>
                      <td className="px-5 py-3"><span className="inline-flex items-center gap-1 rounded-lg bg-slate-50 px-2 py-1 text-xs font-bold text-slate-600"><DoorOpen className="size-3.5" />{statusLabel[leito.status] ?? leito.status}</span></td>
                    </tr>
                  );
                })}
                {!leitos.length ? <tr><td colSpan={6} className="px-6 py-12 text-center text-sm text-slate-500">Nenhum leito operacional cadastrado.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </section>
      </section>
    </SectionPage>
  );
}
