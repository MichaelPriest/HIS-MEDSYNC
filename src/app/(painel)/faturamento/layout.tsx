import { BillingWorkspaceNav } from "@/components/faturamento/billing-workspace-nav";

export default function FaturamentoLayout({ children }: { children: React.ReactNode }) {
  return <>
    <BillingWorkspaceNav />
    {children}
  </>;
}
