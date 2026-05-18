import { useEffect, useState } from "react";
import { useEsp32 } from "@/hooks/useEsp32";
import { useEmergency } from "@/hooks/useEmergency";
import { IntersectionView } from "@/components/traffic/IntersectionView";
import { VehicleCounters } from "@/components/traffic/VehicleCounters";
import { SmartDecision } from "@/components/traffic/SmartDecision";
import { ControlPanel } from "@/components/traffic/ControlPanel";
import { SystemStatus } from "@/components/traffic/SystemStatus";
import { Analytics } from "@/components/traffic/Analytics";
import { ConnectionSettings } from "@/components/traffic/ConnectionSettings";
import { ViolationAlert } from "@/components/traffic/ViolationAlert";
import { ViolationsLog } from "@/components/traffic/ViolationsLog";
import { EmergencyPanel } from "@/components/traffic/EmergencyPanel";
import { EmergencyAlert } from "@/components/traffic/EmergencyAlert";
import { EmergencyLog } from "@/components/traffic/EmergencyLog";
import { Badge } from "@/components/ui/badge";
import { TrafficCone, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

const Index = () => {
  const {
    data, conn, lastUpdate, send, config, updateConfig,
    violations, latestViolation, clearViolations, dismissLatestViolation,
  } = useEsp32();

  const emergency = useEmergency({
    wsUrl: config.wsUrl,
    useDashboardSim: config.useSimulator,
  });

  const [soundEnabled, setSoundEnabled] = useState(true);
  const [violatingLane, setViolatingLane] = useState<"N" | "S" | "W" | null>(null);

  useEffect(() => {
    if (!latestViolation) return;
    setViolatingLane(latestViolation.lane);
    const t = setTimeout(() => setViolatingLane(null), 5000);
    return () => clearTimeout(t);
  }, [latestViolation]);

  // When emergency arrives on an ESP32-controlled lane, force-green it
  useEffect(() => {
    if (!emergency.active) return;
    const lc = emergency.active.laneCode;
    if (lc === "N" || lc === "S" || lc === "W") {
      send({ action: "SET_MODE", mode: "MANUAL" });
      send({ action: "FORCE_GREEN", lane: lc });
    }
    return () => { send({ action: "SET_MODE", mode: "AUTO" }); };
  }, [emergency.active, send]);

  const fallback = data ?? {
    currentLane: "N" as const,
    remainingTime: 0, countN: 0, countS: 0, countW: 0, addonApplied: false,
  };

  const emLane = emergency.active?.laneCode ?? null;
  const displayData = emLane && (emLane === "N" || emLane === "S" || emLane === "W")
    ? { ...fallback, currentLane: emLane, remainingTime: emergency.remaining }
    : fallback;

  const dotColor =
    conn === "connected" ? "bg-signal-green" :
    conn === "simulated" ? "bg-primary" :
    conn === "reconnecting" ? "bg-signal-yellow animate-pulse-soft" :
    "bg-signal-red";

  const modeBadge =
    emergency.mode === "EMERGENCY" ? { dot: "bg-signal-red animate-pulse-soft", label: "EMERGENCY MODE", cls: "border-signal-red text-signal-red" } :
    emergency.mode === "SIMULATION" ? { dot: "bg-signal-yellow", label: "SIMULATION MODE", cls: "border-signal-yellow/60 text-signal-yellow" } :
    { dot: "bg-signal-green", label: "NORMAL MODE", cls: "border-signal-green/60 text-signal-green" };

  return (
    <main className="min-h-screen">
      <ViolationAlert
        violation={latestViolation}
        onDismiss={dismissLatestViolation}
        soundEnabled={soundEnabled}
        onToggleSound={() => setSoundEnabled((s) => !s)}
      />
      <EmergencyAlert
        event={emergency.active}
        remaining={emergency.remaining}
        soundEnabled={soundEnabled}
        onDismiss={emergency.dismiss}
      />

      <header className="border-b border-border/60 backdrop-blur-md sticky top-0 z-10 bg-background/70">
        <div className="container flex items-center justify-between py-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg border border-primary/40 grid place-items-center neon-green">
              <TrafficCone className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-semibold tracking-tight">Smart Traffic Control</h1>
              <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                <ShieldCheck className="h-3 w-3" /> Government Operations Console · Junction A-01
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="outline" className={cn("gap-2 px-3 py-1.5", modeBadge.cls)}>
              <span className={cn("h-2 w-2 rounded-full", modeBadge.dot)} />
              <span className="text-xs uppercase tracking-widest">{modeBadge.label}</span>
            </Badge>
            <Badge variant="outline" className="gap-2 px-3 py-1.5">
              <span className={cn("h-2 w-2 rounded-full", dotColor)} />
              <span className="text-xs uppercase tracking-widest">{conn}</span>
            </Badge>
            <ConnectionSettings config={config} onSave={updateConfig} />
          </div>
        </div>
      </header>

      <section className="container py-6 grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <div className="panel rounded-2xl border border-border p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm uppercase tracking-widest text-muted-foreground">Live Intersection</h2>
                <p className="text-xs text-muted-foreground mt-1">3-lane junction · synchronized with ESP32</p>
              </div>
              <div className="text-right">
                <div className="text-[11px] text-muted-foreground uppercase tracking-widest">Active</div>
                <div className="text-2xl font-bold text-signal-green font-mono-tab">Lane {displayData.currentLane}</div>
              </div>
            </div>
            <IntersectionView data={displayData} violatingLane={violatingLane} emergencyLane={emLane} />
          </div>

          <EmergencyPanel
            active={emergency.active}
            remaining={emergency.remaining}
            rfidStatus={emergency.rfidStatus}
            useDummy={emergency.useDummy}
            onToggleDummy={emergency.toggleDummy}
            onSimulate={emergency.triggerManual}
          />

          <div className="grid gap-6 md:grid-cols-2">
            <VehicleCounters data={displayData} />
            <SmartDecision data={displayData} />
          </div>

          <EmergencyLog events={emergency.log} onClear={emergency.clearLog} />

          <ViolationsLog violations={violations} onClear={clearViolations} />

          <Analytics data={data} />
        </div>

        <aside className="space-y-6">
          <SystemStatus conn={conn} lastUpdate={lastUpdate} data={data} />
          <ControlPanel data={displayData} send={send} />
        </aside>
      </section>

      <footer className="container py-6 text-center text-xs text-muted-foreground">
        Real-time bidirectional channel · WebSocket primary · REST fallback · Violation + RFID Emergency monitoring active
      </footer>
    </main>
  );
};

export default Index;
