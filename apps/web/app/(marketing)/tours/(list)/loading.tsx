export default function ToursLoading() {
  return (
    <section className="mx-auto w-full max-w-6xl px-6 py-20" aria-busy="true" aria-live="polite">
      <div className="h-4 w-16 animate-pulse rounded bg-sand" />
      <div className="mt-4 h-14 w-72 animate-pulse rounded bg-sand" />
      <div className="mt-10 h-24 animate-pulse rounded-xl bg-sand/70" />
      <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="overflow-hidden rounded-xl border border-border bg-surface">
            <div className="aspect-[4/3] animate-pulse bg-sand" />
            <div className="space-y-3 p-5">
              <div className="h-4 w-3/4 animate-pulse rounded bg-sand" />
              <div className="h-4 w-1/2 animate-pulse rounded bg-sand" />
              <div className="h-8 w-24 animate-pulse rounded bg-sand" />
            </div>
          </div>
        ))}
      </div>
      <span className="sr-only">Loading trips</span>
    </section>
  );
}
