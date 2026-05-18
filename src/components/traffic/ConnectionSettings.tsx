import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Settings } from "lucide-react";
import type { Esp32Config } from "@/hooks/useEsp32";
import { toast } from "sonner";

interface Props {
  config: Esp32Config;
  onSave: (c: Esp32Config) => void;
}

export function ConnectionSettings({ config, onSave }: Props) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(config);

  const save = () => {
    onSave(draft);
    toast.success(draft.useSimulator ? "Simulator enabled" : "Reconnecting to ESP32…");
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Settings className="h-4 w-4" /> ESP32
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>ESP32 Connection</DialogTitle>
          <DialogDescription>
            Configure the WebSocket and REST endpoints exposed by your ESP32 firmware.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <div>
              <Label className="text-sm">Use built-in simulator</Label>
              <p className="text-xs text-muted-foreground">Mirrors your Arduino logic for demos.</p>
            </div>
            <Switch checked={draft.useSimulator} onCheckedChange={(v) => setDraft({ ...draft, useSimulator: v })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ws">WebSocket URL</Label>
            <Input id="ws" placeholder="ws://192.168.1.50:81/" value={draft.wsUrl} onChange={(e) => setDraft({ ...draft, wsUrl: e.target.value })} disabled={draft.useSimulator} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="rest">REST Command URL (fallback)</Label>
            <Input id="rest" placeholder="http://192.168.1.50/cmd" value={draft.restUrl} onChange={(e) => setDraft({ ...draft, restUrl: e.target.value })} disabled={draft.useSimulator} />
          </div>
          <div className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground space-y-1 border border-border">
            <p className="font-semibold text-foreground">ESP32 Firmware Notes</p>
            <p>• Send JSON every loop: <code>{`{currentLane,remainingTime,countN,countS,countW,addonApplied}`}</code></p>
            <p>• Accept commands: <code>{`{action:"FORCE_GREEN",lane:"N"}`}</code></p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={save}>Save & Connect</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
