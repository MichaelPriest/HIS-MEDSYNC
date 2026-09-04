import { AssistencialContextHelp } from "@/components/manual/assistencial-context-help";

export default function AssistencialLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AssistencialContextHelp />
      {children}
    </>
  );
}
