// Mirrors the Arduino loop for offline/demo mode.
import type { Command, Lane, TrafficData, ViolationEvent } from "./traffic-types";

const BASE = 15;
const ADDON = 10;
const next = (l: Lane): Lane => (l === "N" ? "S" : l === "S" ? "W" : "N");

export class TrafficSimulator {
  private state: TrafficData = {
    currentLane: "N",
    remainingTime: BASE,
    countN: 0,
    countS: 0,
    countW: 0,
    addonApplied: false,
    irN: false,
    irS: false,
    irW: false,
    mode: "AUTO",
  };
  private greenTime = BASE;
  private elapsed = 0;
  private timer?: number;
  private listeners = new Set<(d: TrafficData) => void>();
  private violationListeners = new Set<(v: ViolationEvent) => void>();
  private forced: Lane | null = null;

  start() {
    if (this.timer) return;
    this.timer = window.setInterval(() => this.tick(), 1000);
    this.emit();
  }
  stop() {
    if (this.timer) window.clearInterval(this.timer);
    this.timer = undefined;
  }
  subscribe(fn: (d: TrafficData) => void) {
    this.listeners.add(fn);
    fn(this.state);
    return () => this.listeners.delete(fn);
  }
  onViolation(fn: (v: ViolationEvent) => void) {
    this.violationListeners.add(fn);
    return () => this.violationListeners.delete(fn);
  }
  private emitViolation(lane: Lane) {
    const ev: ViolationEvent = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      lane,
      timestamp: Date.now(),
      status: "RED_LIGHT_VIOLATION",
    };
    this.violationListeners.forEach((fn) => fn(ev));
  }
  send(cmd: Command) {
    if (cmd.action === "FORCE_GREEN") {
      this.forced = cmd.lane;
      this.switchTo(cmd.lane);
    } else if (cmd.action === "RESET_COUNTS") {
      this.state = { ...this.state, countN: 0, countS: 0, countW: 0 };
      this.emit();
    } else if (cmd.action === "SET_MODE") {
      this.state = { ...this.state, mode: cmd.mode };
      this.emit();
    }
  }
  private switchTo(lane: Lane) {
    this.greenTime = BASE;
    this.elapsed = 0;
    this.state = {
      ...this.state,
      currentLane: lane,
      remainingTime: BASE,
      addonApplied: false,
      [`count${lane}` as "countN"]: 0,
    } as TrafficData;
    this.emit();
  }
  private tick() {
    // random vehicle arrivals
    (["N", "S", "W"] as Lane[]).forEach((l) => {
      const ir = Math.random() < 0.35;
      this.state = { ...this.state, [`ir${l}` as "irN"]: ir } as TrafficData;
      if (ir) {
        const key = `count${l}` as "countN";
        this.state = { ...this.state, [key]: (this.state[key] as number) + 1 } as TrafficData;
      }
    });

    // addon logic
    const cur = this.state.currentLane;
    const curCount = this.state[`count${cur}` as "countN"] as number;
    if (!this.state.addonApplied && curCount >= 3) {
      this.greenTime = BASE + ADDON;
      this.state = { ...this.state, addonApplied: true };
    }

    // simulated red-light violation on West when West is RED (IR_W_VIOLATION)
    if (cur !== "W" && Math.random() < 0.012) {
      this.emitViolation("W");
    }

    this.elapsed += 1;
    const remaining = Math.max(0, this.greenTime - this.elapsed);
    this.state = { ...this.state, remainingTime: remaining };

    if (remaining === 0) {
      const nxt = this.forced && this.state.mode === "MANUAL" ? this.forced : next(cur);
      this.forced = null;
      this.switchTo(nxt);
      return;
    }
    this.emit();
  }
  private emit() {
    this.listeners.forEach((fn) => fn(this.state));
  }
}
