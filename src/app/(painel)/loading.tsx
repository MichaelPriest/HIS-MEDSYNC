export default function PainelLoading() {
  return (
    <div className="ui-fade-in space-y-6" aria-label="Carregando conteúdo" aria-busy="true">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-7">
        <div className="max-w-3xl space-y-3">
          <div className="ui-skeleton h-3 w-32" />
          <div className="ui-skeleton h-8 w-72 max-w-full" />
          <div className="ui-skeleton h-4 w-full max-w-xl" />
        </div>
      </section>
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="ui-skeleton size-10" />
            <div className="ui-skeleton mt-5 h-3 w-24" />
            <div className="ui-skeleton mt-3 h-7 w-32" />
          </div>
        ))}
      </div>
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="ui-skeleton h-5 w-48" />
        <div className="mt-5 space-y-3">
          {Array.from({ length: 5 }).map((_, index) => <div key={index} className="ui-skeleton h-12 w-full" />)}
        </div>
      </section>
    </div>
  );
}
