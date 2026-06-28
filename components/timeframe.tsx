import { cn } from "@/lib/utils";

const OPTIONS: [label: string, hours: number][] = [
  ["24h", 24],
  ["48h", 48],
  ["7d", 168],
  ["30d", 720],
];

export function Timeframe({ hours, onChange }: { hours: number; onChange: (h: number) => void }) {
  return (
    <div className="flex gap-0.5 rounded-md bg-secondary p-0.5 text-xs">
      {OPTIONS.map(([label, h]) => (
        <button
          key={h}
          onClick={() => onChange(h)}
          className={cn(
            "cursor-pointer rounded px-2 py-0.5 font-medium tabular-nums transition-colors",
            hours === h ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
