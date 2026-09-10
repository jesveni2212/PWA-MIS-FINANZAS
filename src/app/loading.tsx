export default function Loading() {
  return (
    <main aria-busy="true" aria-label="Cargando tus finanzas" className="mx-auto w-full max-w-6xl px-5 py-8 pb-32 sm:px-8 lg:px-12 lg:py-12 lg:pb-12">
      <div className="grid gap-8 animate-pulse">
        <section className="rounded-[2rem] border border-border bg-panel p-6 shadow-2xl shadow-black/15 sm:p-8">
          <div className="h-3 w-32 rounded-full bg-border" />
          <div className="mt-5 h-10 w-2/3 rounded-xl bg-border" />
          <div className="mt-3 h-4 w-1/2 rounded-full bg-border" />
          <div className="mt-8 grid gap-3 lg:grid-cols-2">
            <div className="h-32 rounded-2xl border border-border bg-background/45" />
            <div className="h-32 rounded-2xl border border-border bg-background/45" />
          </div>
        </section>
        <section className="grid gap-4">
          <div className="h-7 w-48 rounded-lg bg-border" />
          <div className="h-20 rounded-2xl border border-border bg-panel" />
          <div className="h-20 rounded-2xl border border-border bg-panel" />
        </section>
      </div>
    </main>
  );
}
