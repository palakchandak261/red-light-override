import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Ambulance, Flame, Shield, Siren, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { EmergencyEvent, EmergencyVehicleType } from "@/lib/traffic-types";

const ICONS: Record<EmergencyVehicleType, typeof Ambulance> = {
  Ambulance, "Fire Truck": Flame, "Police Vehicle": Shield,
};

function playSiren() {
  try {
    const Ctx = (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext);
    const ctx = new Ctx();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sawtooth";
    g.gain.value = 0.06;
    o.connect(g); g.connect(ctx.destination);
    o.start();
    const t = ctx.currentTime;
    [t, t + 0.4, t + 0.8].forEach((tt) => {
      o.frequency.setValueAtTime(700, tt);
      o.frequency.linearRampToValueAtTime(1100, tt + 0.2);
      o.frequency.linearRampToValueAtTime(700, tt + 0.4);
    });
    setTimeout(() => { o.stop(); ctx.close(); }, 1300);
  } catch { /* ignore */ }
}

interface Props {
  event: EmergencyEvent | null;
  remaining: number;
  soundEnabled: boolean;
  onDismiss: () => void;
}

export function EmergencyAlert({ event, remaining, soundEnabled, onDismiss }: Props) {
  const seenRef = useRef<string | null>(null);
  useEffect(() => {
    if (!event) return;
    if (seenRef.current === event.id) return;
    seenRef.current = event.id;
    if (soundEnabled) playSiren();
  }, [event, soundEnabled]);

  const Icon = event ? ICONS[event.vehicle] : Siren;

  return (
    <AnimatePresence>
      {event && (
        <motion.div
          initial={{ y: -60, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -60, opacity: 0 }}
          className="fixed top-20 left-1/2 -translate-x-1/2 z-50 w-[min(620px,94vw)]"
        >
          <motion.div
            animate={{ boxShadow: [
              "0 0 0px hsl(var(--signal-red) / 0)",
              "0 0 48px hsl(var(--signal-red) / 0.9)",
              "0 0 0px hsl(var(--signal-red) / 0)",
            ]}}
            transition={{ duration: 1.1, repeat: Infinity }}
            className="rounded-2xl border-2 border-signal-red bg-background/95 backdrop-blur p-4 flex items-center gap-4"
          >
            <motion.div
              animate={{ x: [-4, 4, -4], scale: [1, 1.1, 1] }}
              transition={{ duration: 0.6, repeat: Infinity }}
              className="h-14 w-14 rounded-xl bg-signal-red/20 grid place-items-center border border-signal-red/60"
            >
              <Icon className="h-7 w-7 text-signal-red" />
            </motion.div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[11px] uppercase tracking-widest text-signal-red font-bold">
                  🚨 Emergency Priority Active
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-signal-red/15 text-signal-red font-mono-tab">
                  {event.rfid}
                </span>
              </div>
              <div className="text-base font-semibold mt-0.5 truncate">
                {event.vehicle} approaching Lane {event.lane} ({event.laneCode})
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                Green corridor engaged · {new Date(event.timestamp).toLocaleTimeString()}
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">override</div>
              <div className="text-2xl font-bold text-signal-green font-mono-tab leading-none mt-0.5">
                {remaining}s
              </div>
            </div>
            <Button size="icon" variant="ghost" onClick={onDismiss}>
              <X className="h-4 w-4" />
            </Button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
