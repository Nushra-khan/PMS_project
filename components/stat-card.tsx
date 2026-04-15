type StatCardProps = {
  label: string;
  value: string;
  description: string;
};

export function StatCard({ label, value, description }: StatCardProps) {
  return (
    <article className="rounded-3xl border border-ink/10 bg-panel p-6 shadow-soft">
      <p className="text-sm uppercase tracking-[0.18em] text-ink/55">{label}</p>
      <p className="mt-3 text-4xl font-semibold text-ink">{value}</p>
      <p className="mt-3 max-w-xs text-sm leading-6 text-ink/70">{description}</p>
    </article>
  );
}
