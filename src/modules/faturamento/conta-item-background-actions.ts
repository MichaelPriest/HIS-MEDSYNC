"use server";

import { revalidatePath } from "next/cache";
import type { BackgroundActionState } from "@/lib/actions/background-action";
import { saveBillingAccountItem } from "@/modules/faturamento/conta-item-service";

export type BillingItemActionData = {
  itemId: string;
  mode: "created" | "updated";
};

function refreshBillingItemPaths(contaId: string) {
  revalidatePath("/faturamento");
  revalidatePath("/faturamento/producao");
  revalidatePath(`/faturamento/${contaId}`);
  revalidatePath(`/faturamento/${contaId}/catalogo`);
  revalidatePath(`/faturamento/${contaId}/lancamentos`);
}

export async function salvarLancamentoContaBackground(
  contaId: string,
  _previous: BackgroundActionState<BillingItemActionData>,
  formData: FormData,
): Promise<BackgroundActionState<BillingItemActionData>> {
  const result = await saveBillingAccountItem(contaId, formData);
  if (!result.ok) {
    // Também cobre a rara falha após o item já ter sido persistido e antes de
    // concluir um recálculo opcional: a tela deve refletir o estado real do banco.
    refreshBillingItemPaths(contaId);
    return { status: "error", code: result.code, message: result.message };
  }

  refreshBillingItemPaths(contaId);
  return {
    status: "success",
    code: result.mode === "created" ? "item-adicionado" : "item-atualizado",
    message: result.mode === "created"
      ? "Lançamento incluído e totais da conta recalculados."
      : "Lançamento atualizado e conta preparada para nova validação.",
    data: { itemId: result.itemId, mode: result.mode },
  };
}
