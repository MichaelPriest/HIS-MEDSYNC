import { BadgeCheck, DoorOpen, IdCard, ShieldAlert, UserRoundCheck, UsersRound } from "lucide-react";
import { SectionPage } from "@/components/painel/section-page";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function countRows(table: string) {
  const supabase = await createClient();
  const { count, error } = await supabase.from(table).select("id", { count: "exact", head: true });
  return error ? null : count ?? 0;
}

export default async function SegurancaPage() {
  const [visitantes, visitas, credenciais, acessos, ocorrencias, pontos] = await Promise.all([
    countRows("visitantes"),
    countRows("visitas"),
    countRows("seguranca_credenciais"),
    countRows("seguranca_acessos"),
    countRows("seguranca_ocorrencias"),
    countRows("seguranca_pontos_acesso"),
  ]);

  const cards = [
    { label: "Visitantes", value: visitantes, Icon: UsersRound, description: "Cadastro, identificação e bloqueios do visitante." },
    { label: "Visitas", value: visitas, Icon: UserRoundCheck, description: "Autorizações, destino, validade, check-in e check-out." },
    { label: "Credenciais", value: credenciais, Icon: IdCard, description: "Credenciais temporárias ou funcionais e sua validade." },
    { label: "Acessos", value: acessos, Icon: DoorOpen, description: "Entradas, saídas, resultado e trilha de acesso físico." },
    { label: "Ocorrências", value: ocorrencias, Icon: ShieldAlert, description: "Registro de ocorrências, gravidade, status e resolução." },
    { label: "Pontos de acesso", value: pontos, Icon: BadgeCheck, description: "Portarias, portas e locais controlados por unidade." },
  ];

  return (
    <SectionPage
      eyebrow="Apoio / Segurança e Portaria"
      title="Segurança / Portaria"
      description="Workspace operacional para visitantes, credenciais, acessos físicos e ocorrências, separado dos módulos clínicos."
    >
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map(({ label, value, Icon, description }) => (
          <article key={label} className="his-card p-5">
            <div className="flex items-start justify-between gap-3">
              <span className="grid size-10 place-items-center rounded-xl bg-brand-50 text-brand-700"><Icon className="size-4.5" /></span>
              <span className="text-2xl font-black text-slate-950">{value === null ? "—" : value}</span>
            </div>
            <h2 className="mt-4 font-black text-slate-900">{label}</h2>
            <p className="mt-1 text-sm leading-5 text-slate-500">{description}</p>
          </article>
        ))}
      </section>

      <section className="his-card mt-5 p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-amber-50 text-amber-700"><ShieldAlert className="size-5" /></span>
          <div><h2 className="font-black text-slate-950">Operação segregada da assistência</h2><p className="mt-1 text-sm leading-6 text-slate-500">Portaria e segurança passam a ter área própria no mapa do sistema. Acesso a prontuário, internação ou dados clínicos continua condicionado às permissões específicas desses módulos; o perfil de segurança não recebe acesso clínico apenas por estar no mesmo HIS.</p></div>
        </div>
      </section>
    </SectionPage>
  );
}
