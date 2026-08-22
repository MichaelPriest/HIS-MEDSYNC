type ModulePlaceholderProps = {
  title: string;
  description: string;
  items: string[];
};

export function ModulePlaceholder({ title, description, items }: ModulePlaceholderProps) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-2xl">
          <h2 className="font-semibold text-slate-900">{title}</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
        </div>
        <span className="w-fit rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800">
          Aguardando integração
        </span>
      </div>
      <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {items.map((item) => (
          <div key={item} className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            {item}
          </div>
        ))}
      </div>
    </section>
  );
}
