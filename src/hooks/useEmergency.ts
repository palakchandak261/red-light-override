import { useCallback, useEffect, useRef, useState } from "react";
import { AUTHORIZED_RFIDS, LANE_NUM_TO_CODE, type EmergencyEvent, type EmergencyLaneNum, type EmergencyVehicleType } from "@/lib/traffic-types";
import { parseEsp32Message } from "@/lib/esp32-parser";

const LOG_KEY = "emergency.log.v1";
const TOGGLE_KEY = "emergency.dummy.v1";
const MAX_LOG = 25;
const DEFAULT_OVERRIDE = 20;

type Mode = "NORMAL" | "EMERGENCY" | "SIMULATION";

function loadLog(): EmergencyEvent[] {
  try { const r = localStorage.getItem(LOG_KEY); if (r) return JSON.parse(r); } catch { /* noop */ }
  return [];
}
function loadToggle(): boolean {
  try { const r = localStorage.getItem(TOGGLE_KEY); if (r) return JSON.parse(r); } catch { /* noop */ }
  return true; // default dummy ON for demo
}

function randomDummy(): EmergencyEvent {
  const rfids = Object.keys(AUTHORIZED_RFIDS);
  const rfid = rfids[Math.floor(Math.random() * rfids.length)];
  const vehicle: EmergencyVehicleType = AUTHORIZED_RFIDS[rfid];
  const laneNum = ((Math.floor(Math.random() * 4) + 1) as EmergencyLaneNum);
  return {
    id: `${Date.now()}-${rfid}`,
    rfid, vehicle, lane: laneNum,
    laneCode: LANE_NUM_TO_CODE[laneNum],
    timestamp: Date.now(),
    overrideDuration: DEFAULT_OVERRIDE,
    status: "ACTIVE",
  };
}

export function useEmergency(opts: { wsUrl: string; useDashboardSim: boolean }) {
  const { wsUrl, useDashboardSim } = opts;
  const [useDummy, setUseDummy] = useState<boolean>(() => loadToggle());
  const [log, setLog] = useState<EmergencyEvent[]>(() => loadLog());
  const [active, setActive] = useState<EmergencyEvent | null>(null);
  const [remaining, setRemaining] = useState<number>(0);
  const [rfidStatus, setRfidStatus] = useState<"IDLE" | "SCANNING" | "DETECTED" | "REJECTED">("IDLE");
  const [mode, setMode] = useState<Mode>("NORMAL");

  const wsRef = useRef<WebSocket | null>(null);
  const tickRef = useRef<number | null>(null);
  const dummyRef = useRef<number | null>(null);
  const wsOpenRef = useRef(false);

  const pushLog = useCallback((ev: EmergencyEvent) => {
    setLog((prev) => {
      const next = [ev, ...prev].slice(0, MAX_LOG);
      try { localStorage.setItem(LOG_KEY, JSON.stringify(next)); } catch { /* noop */ }
      return next;
    });
  }, []);

  const trigger = useCallback((ev: EmergencyEvent) => {
    setRfidStatus("DETECTED");
    setActive(ev);
    setRemaining(ev.overrideDuration);
    setMode((m) => (m === "SIMULATION" ? "SIMULATION" : "EMERGENCY"));
    pushLog(ev);
  }, [pushLog]);

  // Countdown loop
  useEffect(() => {
    if (!active) return;
    if (tickRef.current) window.clearInterval(tickRef.current);
    tickRef.current = window.setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          window.clearInterval(tickRef.current!);
          tickRef.current = null;
          setActive((curr) => {
            if (curr) {
              const cleared: EmergencyEvent = { ...curr, status: "CLEARED" };
              setLog((prev) => {
                const next = [cleared, ...prev.filter((e) => e.id !== curr.id)].slice(0, MAX_LOG);
                try { localStorage.setItem(LOG_KEY, JSON.stringify(next)); } catch { /* noop */ }
                return next;
              });
            }
            return null;
          });
          setRfidStatus("IDLE");
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => { if (tickRef.current) window.clearInterval(tickRef.current); };
  }, [active]);

  // WS listener (passive — only listens for emergency messages)
  useEffect(() => {
    wsRef.current?.close();
    wsRef.current = null;
    wsOpenRef.current = false;
    if (!wsUrl || useDashboardSim) return;
    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;
      ws.onopen = () => { wsOpenRef.current = true; };
      ws.onclose = () => { wsOpenRef.current = false; };
      ws.onerror = () => { wsOpenRef.current = false; };
      ws.onmessage = (e) => {
        if (typeof e.data !== "string") return;
        const msg = parseEsp32Message(e.data);
        if (msg.type === "emergency") trigger(msg.event);
      };
    } catch { /* noop */ }
    return () => { wsRef.current?.close(); };
  }, [wsUrl, useDashboardSim, trigger]);

  // Mode resolver
  useEffect(() => {
    if (active) return;
    const hardwareOnline = !useDashboardSim && wsOpenRef.current;
    if (useDummy || useDashboardSim || !hardwareOnline) setMode("SIMULATION");
    else setMode("NORMAL");
  }, [useDummy, useDashboardSim, active, remaining]);

  // Dummy generator
  // Emergency-vehicle red-light-jumper events are pushed manually in simulation mode.
  // Use `triggerManual` (wired to the "Simulate Detection" button) — no auto generator.
  useEffect(() => {
    if (dummyRef.current) { window.clearTimeout(dummyRef.current); dummyRef.current = null; }
  }, [useDummy, active]);

  const toggleDummy = useCallback((v: boolean) => {
    setUseDummy(v);
    try { localStorage.setItem(TOGGLE_KEY, JSON.stringify(v)); } catch { /* noop */ }
  }, []);

  const clearLog = useCallback(() => {
    setLog([]);
    try { localStorage.removeItem(LOG_KEY); } catch { /* noop */ }
  }, []);

  const triggerManual = useCallback(() => { trigger(randomDummy()); }, [trigger]);

  const dismiss = useCallback(() => {
    if (!active) return;
    const cleared: EmergencyEvent = { ...active, status: "CLEARED" };
    setLog((prev) => [cleared, ...prev.filter((e) => e.id !== active.id)].slice(0, MAX_LOG));
    try { localStorage.setItem(LOG_KEY, JSON.stringify([cleared, ...log.filter((e) => e.id !== active.id)].slice(0, MAX_LOG))); } catch { /* noop */ }
    setActive(null);
    setRemaining(0);
    setRfidStatus("IDLE");
  }, [active, log]);

  return {
    mode, active, remaining, rfidStatus, log,
    useDummy, toggleDummy, triggerManual, dismiss, clearLog,
  };
}
