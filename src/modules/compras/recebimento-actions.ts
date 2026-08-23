"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getAssistencialContext } from "@/modules/assistencial/context";

function text(fd:FormData,key:string){return String(fd.get(key)??"").trim();}
function num(fd:FormData,key:string){const n=Number(text(fd,key).replace(/\./g,"").replace(",","."));return Number.isFinite(n)?n:0;}

export async function receberPedidoCompra(formData:FormData){
  const {supabase,user,empresaId,unidadeId}=await getAssistencialContext();
  const pedidoId=text(formData,"pedido_id");
  const fornecedorId=text(formData,"fornecedor_id")||null;
  const produtoId=text(formData,"produto_id");
  const localId=text(formData,"local_estoque_id");
  const quantidade=num(formData,"quantidade");
  const valorUnitario=num(formData,"valor_unitario");
  if(!pedidoId||!produtoId||!localId||quantidade<=0) redirect("/compras?erro=recebimento");
  const valor=Number((quantidade*valorUnitario).toFixed(2));
  const {data:recebimento,error}=await supabase.from("compras_recebimentos").insert({empresa_id:empresaId,unidade_id:unidadeId,pedido_id:pedidoId,fornecedor_id:fornecedorId,numero_documento:text(formData,"numero_documento")||null,serie_documento:text(formData,"serie_documento")||null,data_emissao:text(formData,"data_emissao")||null,valor_documento:valor,vencimento:text(formData,"vencimento")||null,status:"conferido",observacoes:text(formData,"observacoes")||null,created_by:user.id}).select("id").single();
  if(error||!recebimento) redirect("/compras?erro=recebimento");
  const farmacia=formData.get("farmacia")==="on";
  await supabase.from("compras_recebimento_itens").insert({recebimento_id:recebimento.id,produto_id:produtoId,quantidade,valor_unitario:valorUnitario,lote:text(formData,"lote")||null,validade:text(formData,"validade")||null,local_estoque_id:localId,farmacia});
  await supabase.from("estoque_movimentacoes").insert({empresa_id:empresaId,unidade_id:unidadeId,produto_id:produtoId,local_destino_id:localId,tipo:"entrada_compra",quantidade,lote:text(formData,"lote")||null,validade:text(formData,"validade")||null,valor_unitario:valorUnitario,referencia_tipo:"compra_recebimento",referencia_id:recebimento.id,observacao:farmacia?"Entrada de compra destinada à Farmácia":"Entrada de compra",created_by:user.id});
  if(valor>0){await supabase.from("financeiro_contas_pagar").insert({empresa_id:empresaId,unidade_id:unidadeId,fornecedor_id:fornecedorId,compra_recebimento_id:recebimento.id,documento:text(formData,"numero_documento")||null,competencia:new Date().toISOString().slice(0,7),vencimento:text(formData,"vencimento")||null,valor_bruto:valor,status:"aberto",created_by:user.id});}
  await supabase.from("compras_pedidos").update({status:"recebido",updated_at:new Date().toISOString()}).eq("id",pedidoId);
  revalidatePath("/compras"); revalidatePath("/almoxarifado"); revalidatePath("/financeiro"); revalidatePath("/setores/farmacia");
  redirect(`/compras?recebido=${recebimento.id}`);
}
