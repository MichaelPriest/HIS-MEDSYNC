import { BillingWorkspaceNav } from "@/components/faturamento/billing-workspace-nav";

export default function FinanceiroLayout({ children }: { children: React.ReactNode }) {
  return <>
    <BillingWorkspaceNav />
    {children}
  </>;
}
