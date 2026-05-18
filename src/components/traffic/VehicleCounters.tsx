import { motion } from "framer-motion";
import type { TrafficData } from "@/lib/traffic-types";
import { Card } from "@/components/ui/card";

const lanes = [
  { key: "countN", label: "North", color: "hsl(var(--signal-green))" },
  { key: "countS", label: "South", color: "hsl(var(--primary))" },
  { key: "countW", label: "West", color: "hsl(var(--signal-yellow))" },
] as const;

export function VehicleCounters({ data }: { data: TrafficData }) {
  const max = Math.max(1, data.countN, data.countS, data.countW, 5);
  return (
    <Card className="panel border-border p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm uppercase tracking-widest text-muted-foreground">Vehicle Counts</h3>
        <span className="text-[10px] text-muted-foreground">live • per lane</span>
      </div>
      <div className="space-y-4">
        {lanes.map((l) => {
          const v = data[l.key] as number;
          const pct = (v / max) * 100;
          const high = v >= 3;
          return (
            <div key={l.key}>
              <div className="flex items-center justify-between text-sm mb-1.5">
                <span className="text-foreground/90">{l.label}</span>
                <span className="font-mono-tab font-semibold" style={{ color: high ? "hsl(var(--signal-yellow))" : "hsl(var(--foreground))" }}>
                  {v}
                </span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: l.color, boxShadow: `0 0 12px ${l.color}` }}
                  animate={{ width: `${pct}%` }}
                  transition={{ type: "spring", stiffness: 120, damping: 20 }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
