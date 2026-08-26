"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const UUID_RE=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function text(formData: FormData,key: string){return String(formData.get(key)??"").trim();}

function motivoValidacao(message?: string|null){
  const value=String(message??"");
  if(value.includes("TISS_GUIA_SEM_PERMISSAO")||value.includes("TISS_GUIA_NAO_AUTENTICADO")) return "permissao";
  if(value.includes("TISS_GUIA_NAO_LOCALIZADA")) return "nao-localizada";
  return "falha";
}

export async function validarGuiaTiss(formData: FormData){
  const guiaId=text(formData,"guia_id");
  if(!UUID_RE.test(guiaId)) redirect("/central-guias?erro=guia");

  const supabase=await createClient();
  const { error }=await supabase.rpc("validar_guia_tiss",{p_guia_id:guiaId});
  if(error){
    console.error("[tiss.guia] falha de validacao",{code:error.code,operation:"validar_guia_tiss"});
    redirect(`/faturamento/guias/${guiaId}?validacao=erro&motivo=${motivoValidacao(error.message)}`);
  }

  revalidatePath(`/faturamento/guias/${guiaId}`);
  redirect(`/faturamento/guias/${guiaId}?validacao=ok`);
}
