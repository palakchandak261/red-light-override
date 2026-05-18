import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, Plus, Zap } from "lucide-react";
import type { TrafficData } from "@/lib/traffic-types";
import { Card } from "@/components/ui/card";

export function SmartDecision({ data }: { data: TrafficData }) {
  const cur = data.currentLane;
  const curCount = data[`count${cur}` as "countN"] as number;
  const high = curCount >= 3;
  return (
    <Card className="panel border-border p-5">
      <h3 className="text-sm uppercase tracking-widest text-muted-foreground mb-3">Smart Decision Engine</h3>
      <div className="space-y-2 min-h-[88px]">
        <AnimatePresence mode="popLayout">
          {high && (
            <motion.div
              key="high"
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-2 rounded-lg border border-signal-yellow/40 bg-signal-yellow/10 px-3 py-2 text-signal-yellow"
            >
              <AlertTriangle className="h-4 w-4" />
              <span className="text-sm font-medium">High Traffic Detected — Lane {cur}</span>
            </motion.div>
          )}
          {data.addonApplied && (
            <motion.div
              key="addon"
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-2 rounded-lg border border-signal-green/40 bg-signal-green/10 px-3 py-2 text-signal-green"
            >
              <Plus className="h-4 w-4" />
              <span className="text-sm font-medium">+10 sec extension applied</span>
            </motion.div>
          )}
          {!high && !data.addonApplied && (
            <motion.div
              key="ok"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-muted-foreground"
            >
              <Zap className="h-4 w-4 text-primary" />
              <span className="text-sm">Operating in normal flow</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Card>
  );
}
