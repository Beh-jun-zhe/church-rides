import { cn } from "@/lib/utils";

const toneClassMap: Record<"green" | "amber" | "red" | "slate" | "blue", string> = {
  green: "bg-emerald-100 text-emerald-900 border-emerald-200",
  amber: "bg-amber-100 text-amber-900 border-amber-200",
  red: "bg-rose-100 text-rose-900 border-rose-200",
  slate: "bg-slate-100 text-slate-900 border-slate-200",
  blue: "bg-sky-100 text-sky-900 border-sky-200",
};

export function StatusBadge({
  label,
  tone,
}: {
  label: string;
  tone: "green" | "amber" | "red" | "slate" | "blue";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold tracking-wide",
        toneClassMap[tone],
      )}
    >
      {label}
    </span>
  );
}
