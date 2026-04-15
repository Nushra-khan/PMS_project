import { cn, titleCase } from "@/lib/utils";

type StatusBadgeProps = {
  value: string;
};

export function StatusBadge({ value }: StatusBadgeProps) {
  const tone =
    value.includes("wait") || value === "in_progress"
      ? "bg-amber-100 text-amber-900"
      : value.includes("pending") || value === "blocked"
        ? "bg-rose-100 text-rose-900"
        : value === "completed" || value === "shared" || value === "finalized"
          ? "bg-emerald-100 text-emerald-900"
          : "bg-slate-100 text-slate-700";

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold tracking-wide",
        tone
      )}
    >
      {titleCase(value)}
    </span>
  );
}
