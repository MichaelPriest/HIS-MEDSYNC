import Link from "next/link";

export default async function ContaLayout({children,params}:{children:React.ReactNode;params:Promise<{contaId:string}>}){
  const {contaId}=await params;
  const base=`/faturamento/${contaId}`;
  return <>
    <div className="mx-auto mb-4 flex w-full max-w-[1600px] flex-wrap gap-2 px-4 pt-4 sm:px-6 lg:px-8">
      <Link href={base} className="ui-button-secondary">Conta hospitalar</Link>
      <Link href={`${base}/lancamentos`} className="ui-button-primary">Lançamentos</Link>
      <Link href={`${base}/catalogo`} className="ui-button-secondary">Buscar itens</Link>
      <Link href={`${base}/procedimentos-cirurgicos`} className="ui-button-secondary">Procedimentos cirúrgicos / SADT</Link>
    </div>
    {children}
  </>;
}
