import { motion } from "framer-motion";
import type { Lane, TrafficData } from "@/lib/traffic-types";
import { cn } from "@/lib/utils";

const laneConfig: Record<Lane, { label: string; pos: string; arrow: string; rotation: number }> = {
  N: { label: "NORTH", pos: "top-4 left-1/2 -translate-x-1/2", arrow: "↓", rotation: 180 },
  S: { label: "SOUTH", pos: "bottom-4 left-1/2 -translate-x-1/2", arrow: "↑", rotation: 0 },
  W: { label: "WEST",  pos: "left-4 top-1/2 -translate-y-1/2", arrow: "→", rotation: 90 },
};

// Rotation order used by ESP32: N → S → W → N
const ROTATION: Lane[] = ["N", "S", "W"];
const BASE_GREEN = 8;     // seconds (matches ESP32 baseline)
const PER_VEHICLE = 2;    // seconds added per waiting vehicle

function estimateGreenDuration(count: number): number {
  return BASE_GREEN + Math.min(count, 6) * PER_VEHICLE;
}

/** Estimated seconds until `lane` gets green, given current state. */
function estimateWaitTime(lane: Lane, data: TrafficData): number {
  if (lane === data.currentLane) return 0;
  const startIdx = ROTATION.indexOf(data.currentLane);
  const targetIdx = ROTATION.indexOf(lane);
  let wait = data.remainingTime; // finish current green
  let i = (startIdx + 1) % ROTATION.length;
  while (i !== targetIdx) {
    const l = ROTATION[i];
    const c = data[`count${l}` as "countN"] as number;
    wait += estimateGreenDuration(c);
    i = (i + 1) % ROTATION.length;
  }
  return wait;
}

function SignalLight({ active, color }: { active: boolean; color: "green" | "red" }) {
  const base = color === "green" ? "bg-signal-green" : "bg-signal-red";
  const glow = color === "green" ? "neon-green" : "neon-red";
  return (
    <div
      className={cn(
        "h-3 w-3 rounded-full transition-all",
        active ? `${base} ${glow}` : "bg-muted opacity-30"
      )}
    />
  );
}

function TrafficSignalPole({ 
  lane, 
  data, 
  violating 
}: { 
  lane: Lane; 
  data: TrafficData; 
  violating: boolean;
}) {
  const isActive = data.currentLane === lane;
  const count = data[`count${lane}` as "countN"] as number;
  const config = laneConfig[lane];
  
  return (
    <motion.div
      layout
      className={cn(
        "absolute z-20 panel rounded-lg border p-3 w-40",
        config.pos,
        violating ? "border-signal-red neon-red" :
          isActive ? "border-signal-green neon-green" : "border-border"
      )}
      animate={{
        scale: isActive ? 1.02 : 1,
        opacity: violating ? [1, 0.6, 1] : 1,
      }}
      transition={
        violating
          ? { opacity: { duration: 0.4, repeat: Infinity }, scale: { type: "spring", stiffness: 200, damping: 20 } }
          : { type: "spring", stiffness: 200, damping: 20 }
      }
    >
      <div className="flex items-center justify-between text-xs text-muted-foreground tracking-widest">
        <span>{config.label}</span>
        <span className="text-base">{config.arrow}</span>
      </div>
      
      {/* Traffic Light */}
      <div className="mt-2 flex items-center gap-3">
        <div className="flex flex-col gap-1 rounded-full bg-black p-1.5 border-2 border-zinc-700 shadow-lg">
          <SignalLight active={!isActive} color="red" />
          <div className="h-2.5 w-2.5 rounded-full bg-yellow-500/20" />
          <SignalLight active={isActive} color="green" />
        </div>
        <div className="flex-1">
          <div className={cn(
            "font-mono-tab text-3xl leading-none font-bold",
            isActive ? "text-signal-green" : "text-signal-red"
          )}>
            {isActive
              ? String(data.remainingTime).padStart(2, "0")
              : String(estimateWaitTime(lane, data)).padStart(2, "0")}
          </div>
          <div className={cn(
            "text-[9px] uppercase tracking-widest mt-0.5",
            isActive ? "text-signal-green/80" : "text-signal-red/80"
          )}>
            {isActive ? "green · sec" : "wait · sec"}
          </div>
        </div>
      </div>
      
      <div className="mt-2 flex items-center justify-between text-xs pt-2 border-t border-border/50">
        <span className="text-muted-foreground">Vehicles</span>
        <span className={cn("font-mono-tab font-semibold", count >= 3 ? "text-signal-yellow" : "text-foreground")}>
          {count}
        </span>
      </div>
    </motion.div>
  );
}

export function IntersectionView({
  data,
  violatingLane = null,
  emergencyLane = null,
}: {
  data: TrafficData;
  violatingLane?: Lane | null;
  emergencyLane?: Lane | "E" | null;
}) {
  return (
    <div className="relative w-full max-w-[720px] mx-auto rounded-2xl border border-border panel overflow-hidden"
         style={{ aspectRatio: "4/3" }}>

      {/* Green corridor overlay when emergency override is active */}
      {emergencyLane && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: [0.25, 0.55, 0.25] }}
          transition={{ duration: 1.4, repeat: Infinity }}
          className="absolute z-10 pointer-events-none"
          style={
            emergencyLane === "N" ? { top: 0, left: "50%", transform: "translateX(-50%)", width: "8rem", height: "50%",
              background: "linear-gradient(180deg, hsl(var(--signal-green) / 0.55), transparent)" } :
            emergencyLane === "S" ? { bottom: 0, left: "50%", transform: "translateX(-50%)", width: "8rem", height: "50%",
              background: "linear-gradient(0deg, hsl(var(--signal-green) / 0.55), transparent)" } :
            emergencyLane === "W" ? { left: 0, top: "50%", transform: "translateY(-50%)", height: "8rem", width: "50%",
              background: "linear-gradient(90deg, hsl(var(--signal-green) / 0.55), transparent)" } :
            { right: 0, top: "50%", transform: "translateY(-50%)", height: "8rem", width: "50%",
              background: "linear-gradient(270deg, hsl(var(--signal-green) / 0.55), transparent)" }
          }
        />
      )}

      {/* Asphalt base */}
      <div className="absolute inset-0 bg-[#2a2a2a]" 
           style={{ 
             backgroundImage: `
               radial-gradient(ellipse at 30% 20%, rgba(60,60,60,0.4) 0%, transparent 50%),
               radial-gradient(ellipse at 70% 80%, rgba(50,50,50,0.3) 0%, transparent 40%),
               linear-gradient(135deg, rgba(40,40,40,1) 0%, rgba(35,35,35,1) 100%)
             `
           }} 
      />
      
      {/* Grass/ground area in corners (4 corners now) */}
      <div className="absolute top-0 left-0 w-[30%] h-[30%] bg-[#1a2a1a]/30 rounded-br-[60px]" />
      <div className="absolute top-0 right-0 w-[30%] h-[30%] bg-[#1a2a1a]/30 rounded-bl-[60px]" />
      <div className="absolute bottom-0 left-0 w-[30%] h-[30%] bg-[#1a2a1a]/30 rounded-tr-[60px]" />
      <div className="absolute bottom-0 right-0 w-[30%] h-[30%] bg-[#1a2a1a]/30 rounded-tl-[60px]" />
      
      {/* NORTH ROAD (vertical, coming from top) */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-[50%]">
        {/* Road surface */}
        <div className="absolute inset-0 bg-[#333]" 
             style={{
               backgroundImage: `linear-gradient(180deg, #3a3a3a 0%, #333 50%, #2a2a2a 100%)`
             }}
        />
        {/* Center double yellow line */}
        <div className="absolute left-1/2 top-0 -translate-x-1/2 w-0 h-full flex flex-col">
          <div className="flex-1 border-l-2 border-dashed border-yellow-400/80" />
        </div>
        {/* Edge white lines */}
        <div className="absolute left-1 w-0.5 h-full bg-white/70" />
        <div className="absolute right-1 w-0.5 h-full bg-white/70" />
      </div>
      
      {/* SOUTH ROAD (vertical, going down) */}
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-32 h-[50%]">
        <div className="absolute inset-0 bg-[#333]"
             style={{
               backgroundImage: `linear-gradient(180deg, #2a2a2a 0%, #333 50%, #3a3a3a 100%)`
             }}
        />
        {/* Center double yellow line */}
        <div className="absolute left-1/2 top-0 -translate-x-1/2 w-0 h-full flex flex-col">
          <div className="flex-1 border-l-2 border-dashed border-yellow-400/80" />
        </div>
        {/* Edge white lines */}
        <div className="absolute left-1 w-0.5 h-full bg-white/70" />
        <div className="absolute right-1 w-0.5 h-full bg-white/70" />
      </div>
      
      {/* WEST ROAD (horizontal, coming from left) */}
      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[50%] h-32">
        <div className="absolute inset-0 bg-[#333]"
             style={{
               backgroundImage: `linear-gradient(90deg, #3a3a3a 0%, #333 50%, #2a2a2a 100%)`
             }}
        />
        {/* Center double yellow line */}
        <div className="absolute top-1/2 left-0 -translate-y-1/2 w-full h-0 flex">
          <div className="flex-1 border-t-2 border-dashed border-yellow-400/80" />
        </div>
        {/* Edge white lines */}
        <div className="absolute top-1 left-0 w-full h-0.5 bg-white/70" />
        <div className="absolute bottom-1 left-0 w-full h-0.5 bg-white/70" />
      </div>
      
      {/* EAST ROAD (horizontal, going right) — visual only, no signal */}
      <div className="absolute right-0 top-1/2 -translate-y-1/2 w-[50%] h-32">
        <div className="absolute inset-0 bg-[#333]"
             style={{
               backgroundImage: `linear-gradient(90deg, #2a2a2a 0%, #333 50%, #3a3a3a 100%)`
             }}
        />
        {/* Center double yellow line */}
        <div className="absolute top-1/2 left-0 -translate-y-1/2 w-full h-0 flex">
          <div className="flex-1 border-t-2 border-dashed border-yellow-400/80" />
        </div>
        {/* Edge white lines */}
        <div className="absolute top-1 left-0 w-full h-0.5 bg-white/70" />
        <div className="absolute bottom-1 left-0 w-full h-0.5 bg-white/70" />
      </div>
      
      {/* INTERSECTION CENTER */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32">
        {/* Crosswalk - North */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-6 -mt-6">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="absolute w-3 h-full bg-white/30" style={{ left: `${i * 25}%` }} />
          ))}
        </div>
        {/* Crosswalk - South */}
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-24 h-6 -mb-6">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="absolute w-3 h-full bg-white/30" style={{ left: `${i * 25}%` }} />
          ))}
        </div>
        {/* Crosswalk - West */}
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-6 h-24 -ml-6">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="absolute w-full h-3 bg-white/30" style={{ top: `${i * 25}%` }} />
          ))}
        </div>
        {/* Crosswalk - East */}
        <div className="absolute right-0 top-1/2 -translate-y-1/2 w-6 h-24 -mr-6">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="absolute w-full h-3 bg-white/30" style={{ top: `${i * 25}%` }} />
          ))}
        </div>
      </div>
      
      {/* Direction labels on road */}
      <div className="absolute top-[22%] left-1/2 -translate-x-1/2 text-[10px] text-white/30 font-bold tracking-widest rotate-180">IN</div>
      <div className="absolute bottom-[22%] left-1/2 -translate-x-1/2 text-[10px] text-white/30 font-bold tracking-widest">OUT</div>
      <div className="absolute left-[22%] top-1/2 -translate-y-1/2 text-[10px] text-white/30 font-bold tracking-widest">IN</div>
      <div className="absolute right-[22%] top-1/2 -translate-y-1/2 text-[10px] text-white/30 font-bold tracking-widest">OUT</div>
      
      {/* Traffic Signal Poles (N, S, W controlled by hardware) */}
      <TrafficSignalPole lane="N" data={data} violating={violatingLane === "N"} />
      <TrafficSignalPole lane="S" data={data} violating={violatingLane === "S"} />
      <TrafficSignalPole lane="W" data={data} violating={violatingLane === "W"} />

      {/* EAST — passive / uncontrolled indicator */}
      <div className="absolute z-20 top-1/2 right-4 -translate-y-1/2 panel rounded-lg border border-dashed border-border/70 p-3 w-40 opacity-80">
        <div className="flex items-center justify-between text-xs text-muted-foreground tracking-widest">
          <span>EAST</span>
          <span className="text-base">←</span>
        </div>
        <div className="mt-2 flex items-center gap-3">
          <div className="flex flex-col gap-1 rounded-full bg-black p-1.5 border-2 border-zinc-700 shadow-lg opacity-50">
            <div className="h-3 w-3 rounded-full bg-muted opacity-30" />
            <div className="h-2.5 w-2.5 rounded-full bg-yellow-500/20" />
            <div className="h-3 w-3 rounded-full bg-muted opacity-30" />
          </div>
          <div className="flex-1">
            <div className="font-mono-tab text-xs leading-tight text-muted-foreground">
              No signal
            </div>
            <div className="text-[9px] uppercase tracking-widest text-muted-foreground/70 mt-1">
              Uncontrolled
            </div>
          </div>
        </div>
        <div className="mt-2 text-[9px] text-muted-foreground/60 italic pt-2 border-t border-border/50">
          Not wired to ESP32
        </div>
      </div>
    </div>
  );
}
