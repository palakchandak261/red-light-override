import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, X, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ViolationEvent } from "@/lib/traffic-types";

const laneName = (l: ViolationEvent["lane"]) =>
  l === "N" ? "North" : l === "S" ? "South" : "West";

function playBeep() {
  try {
    const Ctx = (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext);
    const ctx = new Ctx();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "square";
    o.frequency.value = 880;
    g.gain.value = 0.08;
    o.connect(g); g.connect(ctx.destination);
    o.start();
    o.frequency.setValueAtTime(880, ctx.currentTime);
    o.frequency.setValueAtTime(440, ctx.currentTime + 0.15);
    o.frequency.setValueAtTime(880, ctx.currentTime + 0.3);
    setTimeout(() => { o.stop(); ctx.close(); }, 600);
  } catch { /* ignore */ }
}

interface Props {
  violation: ViolationEvent | null;
  onDismiss: () => void;
  soundEnabled: boolean;
  onToggleSound: () => void;
}

export function ViolationAlert({ violation, onDismiss, soundEnabled, onToggleSound }: Props) {
  const lastIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!violation) return;
    if (lastIdRef.current === violation.id) return;
    lastIdRef.current = violation.id;
    if (soundEnabled) playBeep();
    const t = setTimeout(onDismiss, 6000);
    return () => clearTimeout(t);
  }, [violation, soundEnabled, onDismiss]);

  return (
    <AnimatePresence>
      {violation && (
        <motion.div
          initial={{ y: -40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -40, opacity: 0 }}
          className="fixed top-20 left-1/2 -translate-x-1/2 z-50 w-[min(560px,92vw)]"
        >
          <motion.div
            animate={{ boxShadow: [
              "0 0 0px hsl(var(--signal-red) / 0.0)",
              "0 0 40px hsl(var(--signal-red) / 0.85)",
              "0 0 0px hsl(var(--signal-red) / 0.0)",
            ]}}
            transition={{ duration: 1.1, repeat: Infinity }}
            className="rounded-xl border border-signal-red bg-background/95 backdrop-blur p-4 flex items-center gap-3"
          >
            <motion.div
              animate={{ scale: [1, 1.15, 1] }}
              transition={{ duration: 0.8, repeat: Infinity }}
              className="h-10 w-10 rounded-full bg-signal-red/20 grid place-items-center"
            >
              <AlertTriangle className="h-5 w-5 text-signal-red" />
            </motion.div>
            <div className="flex-1 min-w-0">
              <div className="text-xs uppercase tracking-widest text-signal-red font-semibold">
                🚨 Red Light Violation
              </div>
              <div className="text-sm font-semibold mt-0.5 truncate">
                {laneName(violation.lane)} Lane · {new Date(violation.timestamp).toLocaleTimeString()}
              </div>
            </div>
            <Button size="icon" variant="ghost" onClick={onToggleSound} title={soundEnabled ? "Mute alerts" : "Enable sound"}>
              <Volume2 className={`h-4 w-4 ${soundEnabled ? "text-signal-green" : "text-muted-foreground"}`} />
            </Button>
            <Button size="icon" variant="ghost" onClick={onDismiss}>
              <X className="h-4 w-4" />
            </Button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
