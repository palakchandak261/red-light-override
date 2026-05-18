import { motion, AnimatePresence } from "framer-motion";
import { Ambulance, Flame, Shield, Siren, Radio, Clock, MapPin, Zap } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { EmergencyEvent, EmergencyVehicleType } from "@/lib/traffic-types";
import { cn } from "@/lib/utils";

const ICONS: Record<EmergencyVehicleType, typeof Ambulance> = {
  Ambulance, "Fire Truck": Flame, "Police Vehicle": Shield,
};
const COLORS: Record<EmergencyVehicleType, string> = {
  Ambulance: "text-signal-red",
  "Fire Truck": "text-signal-yellow",
  "Police Vehicle": "text-signal-cyan",
};

interface Props {
  active: EmergencyEvent | null;
  remaining: number;
  rfidStatus: "IDLE" | "SCANNING" | "DETECTED" | "REJECTED";
  useDummy: boolean;
  onToggleDummy: (v: boolean) => void;
  onSimulate: () => void;
}

export function EmergencyPanel({ active, remaining, rfidStatus, useDummy, onToggleDummy, onSimulate }: Props) {
  const Vehicle = active ? ICONS[active.vehicle] : Siren;
  const vColor = active ? COLORS[active.vehicle] : "text-muted-foreground";

  return (
    <div className={cn(
      "panel rounded-2xl border p-5 relative overflow-hidden transition-colors",
      active ? "border-signal-red" : "border-border"
    )}>
      {/* Animated background glow on active */}
      <AnimatePresence>
        {active && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 pointer-events-none"
            style={{ background: "radial-gradient(circle at 20% 30%, hsl(var(--signal-red) / 0.15), transparent 60%)" }}
          />
        )}
      </AnimatePresence>

      <div className="flex items-start justify-between gap-3 relative">
        <div className="flex items-center gap-3">
          <motion.div
            animate={active ? { scale: [1, 1.15, 1] } : {}}
            transition={{ duration: 0.8, repeat: Infinity }}
            className={cn(
              "h-11 w-11 rounded-xl border grid place-items-center",
              active ? "border-signal-red bg-signal-red/15" : "border-border bg-muted/30"
            )}
          >
            <Siren className={cn("h-5 w-5", active ? "text-signal-red" : "text-muted-foreground")} />
          </motion.div>
          <div>
            <h3 className="text-sm font-semibold tracking-tight">Emergency Vehicle Detection</h3>
            <p className="text-[11px] text-muted-foreground uppercase tracking-widest">RFID Priority Corridor</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Dummy</span>
          <Switch checked={useDummy} onCheckedChange={onToggleDummy} />
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-5 relative">
        <Stat icon={<Radio className="h-3.5 w-3.5" />} label="RFID Status">
          <span className={cn(
            "text-sm font-semibold",
            rfidStatus === "DETECTED" && "text-signal-red animate-pulse-soft",
            rfidStatus === "SCANNING" && "text-signal-yellow",
            rfidStatus === "IDLE" && "text-muted-foreground",
          )}>{rfidStatus}</span>
        </Stat>
        <Stat icon={<Vehicle className="h-3.5 w-3.5" />} label="Vehicle">
          <span className={cn("text-sm font-semibold", active ? vColor : "text-muted-foreground")}>
            {active?.vehicle ?? "—"}
          </span>
        </Stat>
        <Stat icon={<MapPin className="h-3.5 w-3.5" />} label="Lane">
          <span className="text-sm font-semibold font-mono-tab">
            {active ? `${active.lane} · ${active.laneCode}` : "—"}
          </span>
        </Stat>
        <Stat icon={<Clock className="h-3.5 w-3.5" />} label="Detected">
          <span className="text-sm font-semibold font-mono-tab">
            {active ? new Date(active.timestamp).toLocaleTimeString() : "—"}
          </span>
        </Stat>
        <Stat icon={<Zap className="h-3.5 w-3.5" />} label="Priority">
          <span className={cn("text-sm font-semibold", active ? "text-signal-green" : "text-muted-foreground")}>
            {active ? "OVERRIDE ON" : "STANDBY"}
          </span>
        </Stat>
        <Stat icon={<Radio className="h-3.5 w-3.5" />} label="RFID Tag">
          <span className="text-sm font-semibold font-mono-tab truncate">{active?.rfid ?? "—"}</span>
        </Stat>
      </div>

      {/* Override timer / green corridor visualization */}
      <div className={cn(
        "mt-5 rounded-xl border p-4 relative overflow-hidden",
        active ? "border-signal-green/60 bg-signal-green/5" : "border-border bg-muted/10"
      )}>
        {active && (
          <motion.div
            initial={{ x: "-100%" }} animate={{ x: "100%" }}
            transition={{ duration: 2.4, repeat: Infinity, ease: "linear" }}
            className="absolute inset-y-0 w-1/3 pointer-events-none"
            style={{ background: "linear-gradient(90deg, transparent, hsl(var(--signal-green) / 0.25), transparent)" }}
          />
        )}
        <div className="flex items-center justify-between relative">
          <div>
            <div className={cn(
              "text-[11px] uppercase tracking-widest",
              active ? "text-signal-green" : "text-muted-foreground"
            )}>
              {active ? "Emergency Override Active" : "Normal Cycle"}
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">
              {active ? `Green corridor on Lane ${active.lane} (${active.laneCode})` : "Awaiting RFID scan"}
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">resumes in</div>
            <div className={cn(
              "text-3xl font-bold font-mono-tab leading-none mt-1",
              active ? "text-signal-green" : "text-muted-foreground"
            )}>
              {active ? `${remaining}s` : "—"}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between gap-2">
        <Badge variant="outline" className="gap-1.5">
          <span className={cn("h-1.5 w-1.5 rounded-full",
            active ? "bg-signal-red animate-pulse-soft" : "bg-signal-green")} />
          <span className="text-[10px] uppercase tracking-widest">
            {active ? "Emergency Mode" : "Listening"}
          </span>
        </Badge>
        <Button size="sm" variant="outline" onClick={onSimulate} disabled={!!active}>
          <Siren className="h-3.5 w-3.5 mr-1" /> Simulate Detection
        </Button>
      </div>
    </div>
  );
}

function Stat({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border/60 bg-card/40 p-3">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-muted-foreground">
        {icon}{label}
      </div>
      <div className="mt-1">{children}</div>
    </div>
  );
}
