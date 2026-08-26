import Link from "next/link";
import type { Route } from "next";

export default async function ContaLayout({children,params}:{children:React.ReactNode;params:Promise<{contaId:string}>}){
  const {contaId}=await params;
  const conta=`/faturamento/${contaId}` as Route;
  const lancamentos=`/faturamento/${contaId}/lancamentos` as Route;
  const catalogo=`/faturamento/${contaId}/catalogo` as Route;
  const procedimentos=`/faturamento/${contaId}/procedimentos-cirurgicos` as Route;
  return <>
    <div className="mx-auto mb-4 flex w-full max-w-[1600px] flex-wrap gap-2 px-4 pt-4 sm:px-6 lg:px-8">
      <Link href={conta} className="ui-button-secondary">Conta hospitalar</Link>
      <Link href={lancamentos} className="ui-button-primary">Lançamentos</Link>
      <Link href={catalogo} className="ui-button-secondary">Buscar itens</Link>
      <Link href={procedimentos} className="ui-button-secondary">Procedimentos cirúrgicos / SADT</Link>
    </div>
    {children}
  </>;
}
