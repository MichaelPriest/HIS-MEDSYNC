import { AlertCircle, ArrowRight, CheckCircle2 } from "lucide-react";

export function FormGuidancePanel({
  validations,
  nextSteps,
}: {
  validations: string[];
  nextSteps: string[];
}) {
  return <div className="mb-5 grid gap-3 lg:grid-cols-2">
    <section className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4">
      <div className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-emerald-100 text-emerald-700"><CheckCircle2 className="size-4" /></span>
        <div className="min-w-0">
          <h2 className="font-bold text-emerald-950">Validações ao salvar</h2>
          <div className="mt-2 space-y-1.5">{validations.map((item) => <p key={item} className="flex gap-2 text-xs leading-5 text-emerald-900"><AlertCircle className="mt-0.5 size-3.5 shrink-0" />{item}</p>)}</div>
        </div>
      </div>
    </section>
    <section className="rounded-2xl border border-brand-200 bg-brand-50/60 p-4">
      <div className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand-100 text-brand-700"><ArrowRight className="size-4" /></span>
        <div className="min-w-0">
          <h2 className="font-bold text-slate-950">Próximas configurações</h2>
          <div className="mt-2 space-y-1.5">{nextSteps.map((item) => <p key={item} className="flex gap-2 text-xs leading-5 text-slate-600"><ArrowRight className="mt-0.5 size-3.5 shrink-0 text-brand-600" />{item}</p>)}</div>
        </div>
      </div>
    </section>
  </div>;
}
