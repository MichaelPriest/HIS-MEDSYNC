import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("Suprimentos do Centro Cirúrgico sem reload", () => {
  it("mantém os quatro RPCs canônicos e não usa redirect", () => {
    const actions = read("src/modules/centro-cirurgico/suprimentos-background-actions.ts");

    expect(actions).toContain("BackgroundActionState");
    expect(actions).toContain("centro_cirurgico_requisitar_suprimentos_operacional");
    expect(actions).toContain("centro_cirurgico_receber_suprimentos_operacional");
    expect(actions).toContain("centro_cirurgico_consumir_suprimento_operacional");
    expect(actions).toContain("centro_cirurgico_estornar_consumo_operacional");
    expect(actions).toContain("revalidatePath");
    expect(actions).not.toContain('from "next/navigation"');
    expect(actions).not.toMatch(/\bredirect\s*\(/);
  });

  it("preserva as barreiras de medicamento, lote e OPME no feedback operacional", () => {
    const actions = read("src/modules/centro-cirurgico/suprimentos-background-actions.ts");

    expect(actions).toContain("CC_MEDICAMENTO_EXIGE_FLUXO_FARMACIA_PRESCRICAO");
    expect(actions).toContain("Prescrição → Farmácia → Dispensação → Administração");
    expect(actions).toContain("CC_SUPRIMENTO_LOTE_VENCIDO");
    expect(actions).toContain("CC_SUPRIMENTO_ESTOQUE_INSUFICIENTE");
    expect(actions).toContain("CC_OPME_SERIE_JA_UTILIZADA");
    expect(actions).toContain("CC_OPME_ESTORNO_DEVE_SER_INTEGRAL");
    expect(actions).toContain("Após conclusão/cancelamento da cirurgia, o estorno deve seguir o fluxo de Auditoria.");
  });

  it("usa useActionState e feedback inline no formulário compartilhado", () => {
    const form = read("src/components/centro-cirurgico/surgical-supply-background-form.tsx");

    expect(form).toContain("useActionState");
    expect(form).toContain('aria-live="polite"');
    expect(form).toContain("Salvando…");
    expect(form).toContain('kind: SurgicalSupplyKind');
    expect(form).not.toContain("router.refresh");
    expect(form).not.toContain("window.location");
  });

  it("mantém requisição, recebimento, consumo e estorno na tela da cirurgia", () => {
    const page = read("src/app/(painel)/assistencial/centro-cirurgico/suprimentos/[cirurgiaId]/page.tsx");

    expect(page).toContain("SurgicalSupplyBackgroundForm");
    expect(page).toContain('kind="request"');
    expect(page).toContain('kind="receive"');
    expect(page).toContain('kind="consume"');
    expect(page).toContain('kind="reverse"');
    expect(page).toContain("Medicamentos não são baixados nesta tela");
    expect(page).toContain("Prescrição → Farmácia → Dispensação → Enfermagem/Administração → Estoque");
    expect(page).toContain("notFound()");
    expect(page).not.toContain("searchParams");
    expect(page).not.toContain("requisitarSuprimentosCirurgicosAction");
    expect(page).not.toContain("receberSuprimentosCirurgicosAction");
    expect(page).not.toContain("consumirSuprimentoCirurgicoAction");
    expect(page).not.toContain("estornarConsumoCirurgicoAction");
  });

  it("remove feedback por query string também da listagem", () => {
    const page = read("src/app/(painel)/assistencial/centro-cirurgico/suprimentos/page.tsx");

    expect(page).not.toContain("searchParams");
    expect(page).not.toContain("params.sucesso");
    expect(page).not.toContain("params.erro");
  });
});
