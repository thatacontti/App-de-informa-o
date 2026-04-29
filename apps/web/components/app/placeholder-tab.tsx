export function PlaceholderTab({
  title,
  step,
  description,
}: {
  title: string;
  step: string;
  description: string;
}) {
  return (
    <div className="mx-auto max-w-[1500px] px-9 py-7">
      <section className="rounded-2xl border border-amber/15 bg-paper p-7 shadow-sm">
        <div className="mb-2 inline-block rounded-sm border border-amber/30 bg-amber/15 px-3 py-1 text-[0.62rem] font-semibold uppercase tracking-[3px] text-terra">
          {step}
        </div>
        <h2 className="font-display text-2xl font-medium text-deep">{title}</h2>
        <p className="mt-2 text-sm text-ink-2">{description}</p>
      </section>
    </div>
  );
}
