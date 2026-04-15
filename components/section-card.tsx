import { ReactNode } from "react";

type SectionCardProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  children: ReactNode;
};

export function SectionCard({
  eyebrow,
  title,
  description,
  children
}: SectionCardProps) {
  return (
    <section className="rounded-[2rem] border border-ink/10 bg-panel/95 p-6 shadow-soft">
      <div className="mb-5 flex flex-col gap-2">
        {eyebrow ? (
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-tide">
            {eyebrow}
          </p>
        ) : null}
        <h2 className="text-2xl font-semibold text-ink">{title}</h2>
        {description ? (
          <p className="max-w-3xl text-sm leading-6 text-ink/70">{description}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}
