import type { ReactNode } from "react";
import { SurgeryWorkspaceNav } from "@/components/centro-cirurgico/surgery-workspace-nav";

export default function CentroCirurgicoLayout({ children }: { children: ReactNode }) {
  return <><SurgeryWorkspaceNav />{children}</>;
}
