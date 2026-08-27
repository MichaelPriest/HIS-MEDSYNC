import Link from "next/link";
import type { Route } from "next";
import { CalendarDays, FileText, GraduationCap, IdCard, UsersRound } from "lucide-react";
import { SectionPage } from "@/components/painel/section-page";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function countRows(table: string) {
  const supabase = await createClient();
  const { count, error } = await supabase.from(table).select("id", { count: "exact", head: true });
  return error ? null : count ?? 0;
}

export default async function RhPage() {
  const [colaboradores, escalas, treinamentos, documentos] = await Promise.all([
    countRows("rh_colaboradores"),
    countRows("rh_escalas"),
    countRows("rh_treinamentos"),
    countRows("rh_documentos"),
  ]);

  const areas = [
    { label: "Colaboradores", value: colaboradores, Icon: UsersRound, description: "Matrícula, vínculo, cargo, setor, jornada e situação funcional." },
    { label: "Escalas", value: escalas, Icon: CalendarDays, description: "Escalas por unidade, setor, colaborador, início, fim e tipo de jornada." },
    { label: "Treinamentos", value: treinamentos, Icon: GraduationCap, description: "Treinamentos obrigatórios, carga horária, validade e participação." },
    { label: "Documentos", value: documentos, Icon: IdCard, description: "Documentos ocupacionais e funcionais vinculados ao GED institucional." },
  ];

  return (
    <SectionPage
      eyebrow="Gestão / Recursos Humanos"
      title="Recursos Humanos"
      description="Workspace do RH separado da Central Assistencial, com dados funcionais, escalas, treinamentos e documentos sob o mesmo escopo empresa/unidade."
    >
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {areas.map(({ label, value, Icon, description }) => (
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
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-brand-600">Documentação transversal</p>
            <h2 className="mt-1 text-lg font-black text-slate-950">Documentos do colaborador no GED</h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">O cadastro de RH já referencia documentos do GED. Arquivos, versões e integridade documental permanecem no repositório transversal, evitando armazenamento paralelo.</p>
          </div>
          <Link href={"/ged" as Route} className="ui-button-primary shrink-0"><FileText className="size-4" /> Abrir GED</Link>
        </div>
      </section>
    </SectionPage>
  );
}
