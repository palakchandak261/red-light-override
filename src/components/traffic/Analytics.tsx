import { Card } from "@/components/ui/card";
import type { TrafficData } from "@/lib/traffic-types";
import { useEffect, useRef, useState } from "react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

interface Point { t: number; N: number; S: number; W: number; }

export function Analytics({ data }: { data: TrafficData | null }) {
  const [series, setSeries] = useState<Point[]>([]);
  const ref = useRef<TrafficData | null>(null);
  useEffect(() => { ref.current = data; }, [data]);

  useEffect(() => {
    const id = setInterval(() => {
      const d = ref.current;
      if (!d) return;
      setSeries((s) => {
        const next = [...s, { t: Date.now(), N: d.countN, S: d.countS, W: d.countW }];
        return next.slice(-30);
      });
    }, 2000);
    return () => clearInterval(id);
  }, []);

  const peak = (() => {
    if (!data) return "—";
    const m = Math.max(data.countN, data.countS, data.countW);
    if (m === 0) return "None";
    return data.countN === m ? "North" : data.countS === m ? "South" : "West";
  })();

  return (
    <Card className="panel border-border p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm uppercase tracking-widest text-muted-foreground">Traffic Trends</h3>
        <div className="text-xs text-muted-foreground">
          Peak Lane: <span className="text-primary font-semibold">{peak}</span>
        </div>
      </div>
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={series} margin={{ left: -20, right: 8, top: 8, bottom: 0 }}>
            <defs>
              <linearGradient id="gN" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(var(--signal-green))" stopOpacity={0.6} />
                <stop offset="100%" stopColor="hsl(var(--signal-green))" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gS" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.6} />
                <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gW" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(var(--signal-yellow))" stopOpacity={0.6} />
                <stop offset="100%" stopColor="hsl(var(--signal-yellow))" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="t" hide />
            <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} width={28} />
            <Tooltip
              contentStyle={{
                background: "hsl(var(--popover))",
                border: "1px solid hsl(var(--border))",
                borderRadius: 8,
                fontSize: 12,
              }}
              labelFormatter={(v) => new Date(v).toLocaleTimeString()}
            />
            <Area type="monotone" dataKey="N" stroke="hsl(var(--signal-green))" fill="url(#gN)" strokeWidth={2} />
            <Area type="monotone" dataKey="S" stroke="hsl(var(--primary))" fill="url(#gS)" strokeWidth={2} />
            <Area type="monotone" dataKey="W" stroke="hsl(var(--signal-yellow))" fill="url(#gW)" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
