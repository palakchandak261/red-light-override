import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { ConnState, TrafficData } from "@/lib/traffic-types";
import { Activity, Wifi, WifiOff, Loader2, Cpu } from "lucide-react";
import { useEffect, useState } from "react";

interface Props {
  conn: ConnState;
  lastUpdate: number | null;
  data: TrafficData | null;
}

const statusMap: Record<ConnState, { label: string; color: string; Icon: typeof Wifi }> = {
  connected: { label: "Connected", color: "text-signal-green", Icon: Wifi },
  simulated: { label: "Simulated", color: "text-primary", Icon: Cpu },
  reconnecting: { label: "Reconnecting", color: "text-signal-yellow", Icon: Loader2 },
  disconnected: { label: "Disconnected", color: "text-signal-red", Icon: WifiOff },
};

function timeAgo(ts: number | null) {
  if (!ts) return "—";
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 1) return "just now";
  if (s < 60) return `${s}s ago`;
  return `${Math.floor(s / 60)}m ago`;
}

export function SystemStatus({ conn, lastUpdate, data }: Props) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((x) => x + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const s = statusMap[conn];
  const stale = lastUpdate ? Date.now() - lastUpdate > 5000 : true;

  const sensors: Array<{ key: "irN" | "irS" | "irW"; label: string }> = [
    { key: "irN", label: "IR_N" },
    { key: "irS", label: "IR_S" },
    { key: "irW", label: "IR_W" },
  ];

  return (
    <Card className="panel border-border p-5">
      <h3 className="text-sm uppercase tracking-widest text-muted-foreground mb-4">System Status</h3>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <s.Icon className={cn("h-4 w-4", s.color, conn === "reconnecting" && "animate-spin")} />
          <span className={cn("text-sm font-semibold", s.color)}>{s.label}</span>
        </div>
        <span className="text-[11px] text-muted-foreground">Last: {timeAgo(lastUpdate)}</span>
      </div>

      <div className="space-y-2">
        {sensors.map((s) => {
          const active = data?.[s.key];
          const healthy = !stale;
          return (
            <div key={s.key} className="flex items-center justify-between text-xs px-3 py-2 rounded-md bg-background/60 border border-border">
              <span className="text-muted-foreground">{s.label}</span>
              <div className="flex items-center gap-2">
                <span className={cn("h-2 w-2 rounded-full", healthy ? "bg-signal-green" : "bg-signal-red", active && "animate-pulse")} />
                <span className={cn("font-mono-tab", healthy ? "text-foreground" : "text-signal-red")}>
                  {healthy ? (active ? "DETECT" : "IDLE") : "OFFLINE"}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex items-center gap-2 text-[11px] text-muted-foreground">
        <Activity className="h-3 w-3" />
        Heartbeat polled every second
      </div>
    </Card>
  );
}
