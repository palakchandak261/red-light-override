import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import type { Command, Lane, TrafficData } from "@/lib/traffic-types";
import { RotateCcw, Siren } from "lucide-react";

interface Props {
  data: TrafficData;
  send: (c: Command) => Promise<{ ok: boolean }>;
}

export function ControlPanel({ data, send }: Props) {
  const [busy, setBusy] = useState(false);
  const mode = data.mode ?? "AUTO";

  const dispatch = async (cmd: Command, label: string) => {
    setBusy(true);
    const r = await send(cmd);
    setBusy(false);
    if (r.ok) toast.success(`${label} sent to ESP32`);
    else toast.error(`Failed to send ${label}`);
  };

  return (
    <Card className="panel border-border p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm uppercase tracking-widest text-muted-foreground">Manual Override</h3>
        <div className="flex items-center gap-2">
          <Label htmlFor="mode" className="text-xs text-muted-foreground">
            {mode === "AUTO" ? "Auto" : "Manual"}
          </Label>
          <Switch
            id="mode"
            checked={mode === "MANUAL"}
            onCheckedChange={(v) =>
              dispatch({ action: "SET_MODE", mode: v ? "MANUAL" : "AUTO" }, `${v ? "Manual" : "Auto"} mode`)
            }
          />
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2 mb-3">
        {(["N", "S", "W", "E"] as Lane[]).map((l) => (
          <Button
            key={l}
            variant="outline"
            disabled={busy || mode === "AUTO"}
            onClick={() => dispatch({ action: "FORCE_GREEN", lane: l }, `Force Green ${l}`)}
            className="border-signal-green/40 hover:bg-signal-green/10 hover:text-signal-green hover:border-signal-green disabled:opacity-40"
          >
            <Siren className="h-3.5 w-3.5 mr-1" />
            Force {l}
          </Button>
        ))}
      </div>
      <Button
        variant="secondary"
        disabled={busy}
        onClick={() => dispatch({ action: "RESET_COUNTS" }, "Reset Counts")}
        className="w-full"
      >
        <RotateCcw className="h-3.5 w-3.5 mr-2" /> Reset Vehicle Counts
      </Button>
      {mode === "AUTO" && (
        <p className="text-[11px] text-muted-foreground mt-3">
          Switch to Manual to override lane priority.
        </p>
      )}
    </Card>
  );
}
