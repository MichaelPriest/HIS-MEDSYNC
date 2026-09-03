import { Calculator, GitBranch, PackageCheck, ShieldCheck } from "lucide-react";
import { CadastrosWorkspaceNav, CadastroKpi } from "@/components/cadastros/cadastros-workspace-nav";
import {
  CommercialCbhpmPortBackgroundForm,
  CommercialPackageBackgroundForm,
  CommercialPackageItemBackgroundForm,
  CommercialRuleBackgroundForm,
} from "@/components/comercial/commercial-background-forms";
import { SectionPage } from "@/components/painel/section-page";
import { createClient } from "@/lib/supabase/server";

function one<T>(value: T | T[] | null) {
  return Array.isArray(value) ? value[0] ?? null : value;
}

function money(value: unknown) {
  const parsed = Number(value ?? 0);
  return parsed.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function conditionSummary(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "Sem condição adicional";
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([key]) => key !== "origem_vinculo_tabela_id")
    .map(([key, raw]) => {
      const labels: Record<string, string> = {
        urgencia: "Urgência",
        horario_especial: "Horário especial",
        acomodacao_individual: "Acomodação individual",
        anestesia: "Anestesia",
        sequencia: "Sequência",
        sequencia_min: "Sequência mínima",
        sequencia_max: "Sequência máxima",
        quantidade_auxiliares_min: "Auxiliares mín.",
        via_acesso: "Via",
        mesma_via: "Mesma via",
        origem_tipo: "Origem",
        codigo: "Código",
      };
      const rendered = typeof raw === "boolean" ? (raw ? "sim" : "não") : String(raw);
      return `${labels[key] ?? key}: ${rendered}`;
    });
  return entries.length ? entries.join(" · ") : "Sem condição adicional";
}

const categoryOptions = [
  ["geral", "Geral"],
  ["procedimentos", "Procedimentos"],
  ["cirurgias", "Cirurgias"],
  ["sadt", "SADT / exames"],
  ["honorarios", "Honorários"],
  ["anestesia", "Anestesia"],
  ["auxiliares", "Auxiliares"],
  ["diarias", "Diárias"],
  ["taxas", "Taxas"],
  ["gases", "Gases medicinais"],
  ["materiais", "Materiais"],
  ["medicamentos", "Medicamentos"],
  ["opme", "OPME"],
] as const;

export default async function RegrasPage() {
  const supabase = await createClient();
  const [
    { data: contratos },
    { data: regras },
    { data: pacotes },
    { data: vinculosComerciais },
    { data: portesCbhpm },
  ] = await Promise.all([
    supabase
      .from("credenciamento_contratos")
      .select("id,numero_contrato,convenio:convenios(nome_fantasia)")
      .eq("status", "ativo")
      .order("created_at", { ascending: false }),
    supabase
      .from("contrato_regras_faturamento")
      .select("id,categoria,codigo_regra,descricao,percentual,valor_fixo,prioridade,condicoes,vigencia_inicio,vigencia_fim,operacao,aplica_sobre,encerra_processamento,contrato:credenciamento_contratos(numero_contrato,convenio:convenios(nome_fantasia))")
      .eq("ativo", true)
      .order("prioridade"),
    supabase
      .from("contrato_pacotes")
      .select("id,codigo,nome,valor,vigencia_inicio,vigencia_fim,inclusoes,exclusoes,contrato:credenciamento_contratos(numero_contrato,convenio:convenios(nome_fantasia)),itens:contrato_pacote_itens(id,codigo,tabela,quantidade_inclusa,cobranca_excedente)")
      .eq("ativo", true)
      .order("codigo"),
    supabase
      .from("contrato_tabelas_comerciais")
      .select("id,contrato_id,categoria,prioridade,ativo,fonte:tabelas_comerciais_fontes(nome,codigo,tipo),contrato:credenciamento_contratos(numero_contrato,convenio:convenios(nome_fantasia))")
      .eq("ativo", true)
      .order("prioridade"),
    supabase
      .from("contrato_cbhpm_portes")
      .select("id,vinculo_id,tipo,porte,valor,vigencia_inicio,vigencia_fim,ativo,observacoes,updated_at")
      .order("updated_at", { ascending: false }),
  ]);

  const cbhpmLinks = (vinculosComerciais ?? []).filter((link) => one(link.fonte)?.tipo === "cbhpm");
  const cbhpmLinkMap = new Map(cbhpmLinks.map((link) => [link.id, link]));
  const semVigencia = (regras ?? []).filter((rule) => !rule.vigencia_inicio && !rule.vigencia_fim).length;
  const rulesWithConditions = (regras ?? []).filter((rule) => {
    const conditions = rule.condicoes;
    return Boolean(conditions && typeof conditions === "object" && !Array.isArray(conditions) && Object.keys(conditions).length);
  }).length;
  const activePorts = (portesCbhpm ?? []).filter((row) => row.ativo).length;

  return <SectionPage
    eyebrow="Comercial / Contratos"
    title="Motor de regras, CBHPM e pacotes"
    description="Defina a cobrança contratual com prioridade, vigência e condições estruturadas. As alterações são salvas em segundo plano por RPC e ficam disponíveis para a memória de cálculo do faturamento."
  >
    <CadastrosWorkspaceNav active="/comercial/regras" />

    <section className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      <CadastroKpi label="Contratos ativos" value={contratos?.length ?? 0} />
      <CadastroKpi label="Regras ativas" value={regras?.length ?? 0} detail={`${rulesWithConditions} com condições explícitas`} />
      <CadastroKpi label="Vínculos CBHPM" value={cbhpmLinks.length} detail={`${activePorts} valores de porte ativos`} />
      <CadastroKpi label="Pacotes ativos" value={pacotes?.length ?? 0} />
      <CadastroKpi
        label="Regras sem vigência"
        value={semVigencia}
        detail={semVigencia ? "Revisar para evitar aplicação indefinida" : "Todas as regras têm vigência"}
      />
    </section>

    <div className="mb-5 grid gap-3 md:grid-cols-3">
      <Guide icon={<GitBranch className="size-4" />} title="Ordem determinística" text="Menor prioridade numérica é avaliada primeiro. Regras cumulativas registram valor antes e depois na memória de cálculo." />
      <Guide icon={<ShieldCheck className="size-4" />} title="Sem preço inventado" text="A regra só transforma um preço contratual resolvido. Sem tabela, edição, base ou DePara válido, o item fica sem preço contratual." />
      <Guide icon={<PackageCheck className="size-4" />} title="Pacotes explícitos" text="Inclusões, exclusões e excedentes permanecem vinculados ao contrato e auditáveis por item." />
    </div>

    <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
      <CommercialRuleBackgroundForm className="ui-card p-5">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-brand-50 p-2 text-brand-700"><Calculator className="size-5" /></div>
          <div>
            <h2 className="font-semibold">Nova regra contratual</h2>
            <p className="mt-1 text-xs leading-5 text-slate-500">Use condições estruturadas para múltiplos, urgência, horário especial, acomodação, anestesia, auxiliares e via. Não é necessário escrever JSON.</p>
          </div>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2">
          <Field label="Contrato">
            <select name="contrato_id" required defaultValue="" className="ui-input">
              <option value="">Selecione o contrato</option>
              {contratos?.map((contract) => {
                const convenio = one(contract.convenio);
                return <option key={contract.id} value={contract.id}>{convenio?.nome_fantasia ?? "Convênio"} · {contract.numero_contrato || "s/n"}</option>;
              })}
            </select>
          </Field>
          <Field label="Categoria de cobrança">
            <select name="categoria" defaultValue="procedimentos" className="ui-input">
              {categoryOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </Field>
          <Field label="Código da regra">
            <input name="codigo_regra" required className="ui-input" placeholder="Ex.: MULTIPLO_2, URGENCIA" />
          </Field>
          <Field label="Descrição">
            <input name="descricao" required className="ui-input" placeholder="O que esta regra representa no contrato" />
          </Field>
          <Field label="Operação">
            <select name="operacao" defaultValue="multiplicar_percentual" className="ui-input">
              <option value="multiplicar_percentual">Usar percentual do valor</option>
              <option value="acrescentar_percentual">Acrescentar percentual</option>
              <option value="descontar_percentual">Descontar percentual</option>
              <option value="somar_valor_fixo">Somar valor fixo</option>
              <option value="substituir_valor">Substituir por valor fixo</option>
            </select>
          </Field>
          <Field label="Aplicar sobre">
            <select name="aplica_sobre" defaultValue="valor_atual" className="ui-input">
              <option value="valor_atual">Valor acumulado até esta regra</option>
              <option value="valor_base">Valor-base contratual</option>
            </select>
          </Field>
          <Field label="Percentual">
            <input name="percentual" inputMode="decimal" className="ui-input" placeholder="Ex.: 70 ou 30" />
          </Field>
          <Field label="Valor fixo">
            <input name="valor_fixo" inputMode="decimal" className="ui-input" placeholder="Opcional, conforme operação" />
          </Field>
          <Field label="Prioridade">
            <input name="prioridade" type="number" min="0" defaultValue="100" className="ui-input" />
          </Field>
          <label className="flex items-center gap-2 self-end rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-semibold text-slate-700">
            <input type="checkbox" name="encerra_processamento" /> Encerrar regras posteriores quando aplicada
          </label>
        </div>

        <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
          <div className="mb-3">
            <h3 className="text-sm font-semibold text-slate-900">Condições de aplicação</h3>
            <p className="text-xs text-slate-500">Campos vazios significam “indiferente”. Combine somente as condições previstas no contrato.</p>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <TriState name="urgencia_condicao" label="Urgência" />
            <TriState name="horario_especial_condicao" label="Horário especial" />
            <TriState name="acomodacao_individual_condicao" label="Acomodação individual" />
            <TriState name="anestesia_condicao" label="Anestesia" />
            <TriState name="mesma_via_condicao" label="Mesma via de acesso" />
            <Field label="Via de acesso"><input name="via_acesso" className="ui-input" placeholder="Ex.: mesma, diferente, única" /></Field>
            <Field label="Sequência exata"><input name="sequencia" type="number" min="1" className="ui-input" placeholder="Ex.: 2" /></Field>
            <Field label="Sequência mínima"><input name="sequencia_min" type="number" min="1" className="ui-input" placeholder="Ex.: 2" /></Field>
            <Field label="Sequência máxima"><input name="sequencia_max" type="number" min="1" className="ui-input" placeholder="Ex.: 4" /></Field>
            <Field label="Auxiliares mínimos"><input name="quantidade_auxiliares_min" type="number" min="0" className="ui-input" placeholder="Ex.: 1" /></Field>
            <Field label="Tipo de origem"><input name="origem_tipo" className="ui-input" placeholder="Ex.: honorario, cirurgia" /></Field>
            <Field label="Código específico"><input name="codigo_item" className="ui-input" placeholder="Código da tabela/TUSS quando necessário" /></Field>
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <Field label="Início da vigência"><input type="date" name="vigencia_inicio" className="ui-input" /></Field>
          <Field label="Fim da vigência"><input type="date" name="vigencia_fim" className="ui-input" /></Field>
        </div>
      </CommercialRuleBackgroundForm>

      <CommercialPackageBackgroundForm className="ui-card p-5">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-emerald-50 p-2 text-emerald-700"><PackageCheck className="size-5" /></div>
          <div>
            <h2 className="font-semibold">Novo pacote</h2>
            <p className="mt-1 text-xs leading-5 text-slate-500">Cadastre o preço fechado e documente inclusões/exclusões. Os itens detalhados são vinculados logo abaixo.</p>
          </div>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          <Field label="Contrato">
            <select name="contrato_id" required defaultValue="" className="ui-input">
              <option value="">Selecione o contrato</option>
              {contratos?.map((contract) => {
                const convenio = one(contract.convenio);
                return <option key={contract.id} value={contract.id}>{convenio?.nome_fantasia ?? "Convênio"} · {contract.numero_contrato || "s/n"}</option>;
              })}
            </select>
          </Field>
          <Field label="Código"><input name="codigo" required className="ui-input" placeholder="Código do pacote" /></Field>
          <Field label="Nome"><input name="nome" required className="ui-input" placeholder="Nome do pacote" /></Field>
          <Field label="Valor"><input name="valor" required inputMode="decimal" className="ui-input" placeholder="0,00" /></Field>
          <Field label="Início"><input type="date" name="vigencia_inicio" className="ui-input" /></Field>
          <Field label="Fim"><input type="date" name="vigencia_fim" className="ui-input" /></Field>
          <Field label="Inclusões"><textarea name="inclusoes" className="ui-input min-h-28" placeholder="Uma inclusão por linha" /></Field>
          <Field label="Exclusões"><textarea name="exclusoes" className="ui-input min-h-28" placeholder="Uma exclusão por linha" /></Field>
          <div className="md:col-span-2"><Field label="Observações"><textarea name="observacoes" className="ui-input min-h-20" placeholder="Condições comerciais relevantes para auditoria" /></Field></div>
        </div>
      </CommercialPackageBackgroundForm>
    </div>

    <section className="ui-card mt-6 overflow-hidden">
      <div className="border-b border-slate-100 px-5 py-4">
        <h2 className="font-semibold">Regras ativas</h2>
        <p className="text-xs text-slate-500">A lista mostra a operação e as condições que serão registradas na memória de cálculo quando a regra for aplicada.</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr><th className="px-4 py-3">Convênio</th><th className="px-4 py-3">Regra</th><th className="px-4 py-3">Operação</th><th className="px-4 py-3">Condições</th><th className="px-4 py-3">Prior.</th><th className="px-4 py-3">Vigência</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {regras?.length ? regras.map((rule) => {
              const contract = one(rule.contrato);
              const convenio = contract ? one(contract.convenio) : null;
              return <tr key={rule.id} className="align-top">
                <td className="px-4 py-3">{convenio?.nome_fantasia ?? "—"}<div className="text-xs text-slate-400">{contract?.numero_contrato || "s/n"}</div></td>
                <td className="px-4 py-3"><b>{rule.codigo_regra}</b><div className="mt-1 text-xs text-slate-500">{rule.descricao}</div><span className="mt-2 inline-flex rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-600">{rule.categoria}</span></td>
                <td className="px-4 py-3"><div className="font-medium text-slate-800">{rule.operacao}</div><div className="mt-1 text-xs text-slate-500">{rule.percentual != null ? `${rule.percentual}%` : ""}{rule.percentual != null && rule.valor_fixo != null ? " + " : ""}{rule.valor_fixo != null ? money(rule.valor_fixo) : ""}</div><div className="text-[11px] text-slate-400">sobre {rule.aplica_sobre === "valor_base" ? "valor-base" : "valor atual"}{rule.encerra_processamento ? " · encerra fluxo" : ""}</div></td>
                <td className="max-w-sm px-4 py-3 text-xs leading-5 text-slate-600">{conditionSummary(rule.condicoes)}</td>
                <td className="px-4 py-3 font-mono text-xs">{rule.prioridade}</td>
                <td className="px-4 py-3 whitespace-nowrap text-xs">{rule.vigencia_inicio || "—"} → {rule.vigencia_fim || "aberta"}</td>
              </tr>;
            }) : <tr><td colSpan={6} className="p-8 text-center text-slate-500">Nenhuma regra ativa cadastrada.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>

    <section className="ui-card mt-6 overflow-hidden">
      <div className="border-b border-slate-100 px-5 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-semibold">Portes CBHPM versionados</h2>
            <p className="mt-1 max-w-3xl text-xs leading-5 text-slate-500">Cadastre o valor monetário negociado para cada porte por vínculo e vigência. O HIS usa o porte da edição CBHPM como atributo e resolve o valor contratual aqui; não existe valor monetário genérico embutido no sistema.</p>
          </div>
          <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-bold text-brand-700">{activePorts} ativo(s)</span>
        </div>
      </div>

      <div className="grid gap-5 p-5 xl:grid-cols-[0.9fr_1.1fr]">
        <CommercialCbhpmPortBackgroundForm className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="md:col-span-2">
              <Field label="Vínculo CBHPM">
                <select name="vinculo_id" required defaultValue="" className="ui-input">
                  <option value="">Selecione contrato e tabela CBHPM</option>
                  {cbhpmLinks.map((link) => {
                    const source = one(link.fonte);
                    const contract = one(link.contrato);
                    const convenio = contract ? one(contract.convenio) : null;
                    return <option key={link.id} value={link.id}>{convenio?.nome_fantasia ?? "Convênio"} · {contract?.numero_contrato || "s/n"} · {link.categoria} · {source?.nome ?? source?.codigo ?? "CBHPM"}</option>;
                  })}
                </select>
              </Field>
            </div>
            <Field label="Tipo de porte">
              <select name="tipo" defaultValue="procedimento" className="ui-input">
                <option value="procedimento">Procedimento</option>
                <option value="anestesia">Anestesia</option>
              </select>
            </Field>
            <Field label="Porte">
              <input name="porte" required className="ui-input" placeholder="Porte conforme edição/contrato" />
            </Field>
            <Field label="Valor contratual">
              <input name="valor" required inputMode="decimal" className="ui-input" placeholder="0,00" />
            </Field>
            <Field label="Início da vigência">
              <input type="date" name="vigencia_inicio" className="ui-input" />
            </Field>
            <Field label="Fim da vigência">
              <input type="date" name="vigencia_fim" className="ui-input" />
            </Field>
            <div className="md:col-span-2"><Field label="Observações"><textarea name="observacoes" className="ui-input min-h-20" placeholder="Fonte contratual, aditivo ou observação para auditoria" /></Field></div>
          </div>
          {!cbhpmLinks.length ? <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">Nenhum vínculo CBHPM ativo foi encontrado. Vincule uma fonte CBHPM ao contrato antes de cadastrar valores de porte.</p> : null}
        </CommercialCbhpmPortBackgroundForm>

        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr><th className="px-4 py-3">Contrato / tabela</th><th className="px-4 py-3">Tipo</th><th className="px-4 py-3">Porte</th><th className="px-4 py-3">Valor</th><th className="px-4 py-3">Vigência</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {portesCbhpm?.length ? portesCbhpm.map((row) => {
                const link = cbhpmLinkMap.get(row.vinculo_id);
                const source = link ? one(link.fonte) : null;
                const contract = link ? one(link.contrato) : null;
                const convenio = contract ? one(contract.convenio) : null;
                return <tr key={row.id} className={row.ativo ? "align-top" : "align-top opacity-60"}>
                  <td className="px-4 py-3"><div className="font-medium text-slate-800">{convenio?.nome_fantasia ?? "Vínculo histórico"}</div><div className="mt-1 text-xs text-slate-500">{contract?.numero_contrato || "s/n"} · {source?.nome ?? source?.codigo ?? "CBHPM"}{link?.categoria ? ` · ${link.categoria}` : ""}</div></td>
                  <td className="px-4 py-3"><span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">{row.tipo === "anestesia" ? "Anestesia" : "Procedimento"}</span></td>
                  <td className="px-4 py-3 font-mono font-semibold">{row.porte}</td>
                  <td className="px-4 py-3 font-semibold text-slate-900">{money(row.valor)}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-xs"><div>{row.vigencia_inicio || "—"} → {row.vigencia_fim || "aberta"}</div><div className={row.ativo ? "mt-1 font-semibold text-emerald-700" : "mt-1 font-semibold text-slate-500"}>{row.ativo ? "Ativo" : "Inativo"}</div></td>
                </tr>;
              }) : <tr><td colSpan={5} className="p-8 text-center text-slate-500">Nenhum valor de porte CBHPM versionado ainda.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </section>

    <section className="mt-6 grid gap-4">
      {pacotes?.length ? pacotes.map((packageRow) => {
        const contract = one(packageRow.contrato);
        const convenio = contract ? one(contract.convenio) : null;
        const items = Array.isArray(packageRow.itens) ? packageRow.itens : [];
        return <div key={packageRow.id} className="ui-card p-5">
          <div className="flex flex-wrap justify-between gap-3">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-semibold">{packageRow.codigo} · {packageRow.nome}</h2>
                <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-700">{items.length} item(ns)</span>
              </div>
              <p className="mt-1 text-sm text-slate-500">{convenio?.nome_fantasia ?? "Convênio"} · {money(packageRow.valor)}</p>
            </div>
            <span className="text-xs text-slate-400">{packageRow.vigencia_inicio || "—"} → {packageRow.vigencia_fim || "aberta"}</span>
          </div>

          <CommercialPackageItemBackgroundForm className="mt-4 grid gap-3 md:grid-cols-4">
            <input type="hidden" name="pacote_id" value={packageRow.id} />
            <Field label="Código do item"><input name="codigo" required className="ui-input" placeholder="Código" /></Field>
            <Field label="Tabela"><input name="tabela" className="ui-input" placeholder="TUSS, própria, AMB..." /></Field>
            <Field label="Qtd. inclusa"><input name="quantidade_inclusa" inputMode="decimal" className="ui-input" placeholder="Ex.: 1" /></Field>
            <label className="flex items-center gap-2 self-end rounded-xl border border-slate-200 px-3 py-3 text-sm"><input type="checkbox" name="cobranca_excedente" />Cobrar excedente</label>
          </CommercialPackageItemBackgroundForm>

          {items.length ? <div className="mt-4 flex flex-wrap gap-2">{items.map((item) => <span key={item.id} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm">{item.codigo}{item.tabela ? ` · ${item.tabela}` : ""}{item.quantidade_inclusa ? ` · ${item.quantidade_inclusa}` : ""}{item.cobranca_excedente ? " · excedente" : ""}</span>)}</div> : <p className="mt-4 text-xs font-medium text-amber-700">Pacote ainda sem itens detalhados.</p>}
        </div>;
      }) : <div className="ui-card p-8 text-center text-slate-500">Nenhum pacote ativo cadastrado.</div>}
    </section>
  </SectionPage>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="grid gap-1 text-xs font-semibold text-slate-500"><span>{label}</span>{children}</label>;
}

function TriState({ name, label }: { name: string; label: string }) {
  return <Field label={label}>
    <select name={name} defaultValue="" className="ui-input">
      <option value="">Indiferente</option>
      <option value="true">Sim</option>
      <option value="false">Não</option>
    </select>
  </Field>;
}

function Guide({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return <div className="rounded-2xl border border-slate-200 bg-white p-4">
    <div className="flex items-center gap-2 text-sm font-semibold text-slate-950">{icon}{title}</div>
    <p className="mt-1 text-xs leading-5 text-slate-500">{text}</p>
  </div>;
}
