import { Ambulance, Flame, Shield, Trash2 } from "lucide-react";
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

export function EmergencyLog({ events, onClear }: { events: EmergencyEvent[]; onClear: () => void }) {
  return (
    <div className="panel rounded-2xl border border-border p-5">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-sm font-semibold tracking-tight">Emergency Event Log</h3>
          <p className="text-[11px] text-muted-foreground uppercase tracking-widest">RFID activations · live</p>
        </div>
        <Button size="sm" variant="ghost" onClick={onClear} disabled={!events.length}>
          <Trash2 className="h-3.5 w-3.5 mr-1" /> Clear
        </Button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-[10px] uppercase tracking-widest text-muted-foreground border-b border-border/60">
              <th className="text-left font-medium py-2">RFID</th>
              <th className="text-left font-medium py-2">Vehicle</th>
              <th className="text-left font-medium py-2">Lane</th>
              <th className="text-left font-medium py-2">Time</th>
              <th className="text-left font-medium py-2">Override</th>
              <th className="text-left font-medium py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {events.length === 0 && (
              <tr><td colSpan={6} className="py-6 text-center text-muted-foreground">
                No emergency events yet
              </td></tr>
            )}
            {events.map((e) => {
              const Icon = ICONS[e.vehicle];
              return (
                <tr key={e.id} className="border-b border-border/30 last:border-0 hover:bg-muted/20">
                  <td className="py-2 font-mono-tab">{e.rfid}</td>
                  <td className={cn("py-2 flex items-center gap-1.5", COLORS[e.vehicle])}>
                    <Icon className="h-3.5 w-3.5" /> {e.vehicle}
                  </td>
                  <td className="py-2 font-mono-tab">{e.lane} · {e.laneCode}</td>
                  <td className="py-2 font-mono-tab text-muted-foreground">
                    {new Date(e.timestamp).toLocaleTimeString()}
                  </td>
                  <td className="py-2 font-mono-tab">{e.overrideDuration}s</td>
                  <td className="py-2">
                    <Badge variant="outline" className={cn(
                      "text-[10px] uppercase tracking-widest",
                      e.status === "ACTIVE"
                        ? "border-signal-red text-signal-red"
                        : "border-signal-green/60 text-signal-green"
                    )}>
                      {e.status}
                    </Badge>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
