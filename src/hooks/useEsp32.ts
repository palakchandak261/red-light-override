import { useEffect, useRef, useState, useCallback } from "react";
import type { Command, ConnState, TrafficData, ViolationEvent } from "@/lib/traffic-types";
import { TrafficSimulator } from "@/lib/traffic-simulator";
import { parseEsp32Message } from "@/lib/esp32-parser";

export interface Esp32Config {
  wsUrl: string;
  restUrl: string;
  useSimulator: boolean;
}

const STORAGE_KEY = "esp32.config.v1";
const VIOLATIONS_KEY = "esp32.violations.v1";
const MAX_VIOLATIONS = 20;

export const defaultConfig: Esp32Config = {
  wsUrl: "",
  restUrl: "",
  useSimulator: true,
};

export function loadConfig(): Esp32Config {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...defaultConfig, ...JSON.parse(raw) };
  } catch {}
  return defaultConfig;
}
export function saveConfig(c: Esp32Config) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(c));
}

function loadViolations(): ViolationEvent[] {
  try {
    const raw = localStorage.getItem(VIOLATIONS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}

export function useEsp32() {
  const [config, setConfig] = useState<Esp32Config>(() => loadConfig());
  const [data, setData] = useState<TrafficData | null>(null);
  const [conn, setConn] = useState<ConnState>("disconnected");
  const [lastUpdate, setLastUpdate] = useState<number | null>(null);
  const [violations, setViolations] = useState<ViolationEvent[]>(() => loadViolations());
  const [latestViolation, setLatestViolation] = useState<ViolationEvent | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectRef = useRef<number | null>(null);
  const simRef = useRef<TrafficSimulator | null>(null);

  const recordViolation = useCallback((ev: ViolationEvent) => {
    setLatestViolation(ev);
    setViolations((prev) => {
      const next = [ev, ...prev].slice(0, MAX_VIOLATIONS);
      try { localStorage.setItem(VIOLATIONS_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  const handleRaw = useCallback((raw: string) => {
    const msg = parseEsp32Message(raw);
    if (msg.type === "state") {
      setData((prev) => ({ ...(prev ?? ({} as TrafficData)), ...msg.data } as TrafficData));
      setLastUpdate(Date.now());
    } else if (msg.type === "violation") {
      recordViolation(msg.event);
      setLastUpdate(Date.now());
    }
  }, [recordViolation]);

  const connectWs = useCallback(() => {
    if (!config.wsUrl) return;
    setConn("reconnecting");
    try {
      const ws = new WebSocket(config.wsUrl);
      wsRef.current = ws;
      ws.onopen = () => setConn("connected");
      ws.onmessage = (e) => handleRaw(typeof e.data === "string" ? e.data : "");
      ws.onerror = () => setConn("disconnected");
      ws.onclose = () => {
        setConn("disconnected");
        if (!config.useSimulator && config.wsUrl) {
          reconnectRef.current = window.setTimeout(connectWs, 3000);
        }
      };
    } catch {
      setConn("disconnected");
    }
  }, [config.wsUrl, config.useSimulator, handleRaw]);

  useEffect(() => {
    wsRef.current?.close();
    wsRef.current = null;
    if (reconnectRef.current) window.clearTimeout(reconnectRef.current);
    simRef.current?.stop();
    simRef.current = null;

    if (config.useSimulator) {
      const sim = new TrafficSimulator();
      simRef.current = sim;
      const unsubState = sim.subscribe((d) => {
        setData(d);
        setLastUpdate(Date.now());
      });
      const unsubViol = sim.onViolation((ev) => recordViolation(ev));
      sim.start();
      setConn("simulated");
      return () => {
        unsubState();
        unsubViol();
        sim.stop();
      };
    }
    if (config.wsUrl) connectWs();
    return () => {
      wsRef.current?.close();
      if (reconnectRef.current) window.clearTimeout(reconnectRef.current);
    };
  }, [config.useSimulator, config.wsUrl, connectWs, recordViolation]);

  const send = useCallback(
    async (cmd: Command) => {
      if (config.useSimulator && simRef.current) {
        simRef.current.send(cmd);
        return { ok: true };
      }
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify(cmd));
        return { ok: true };
      }
      if (config.restUrl) {
        try {
          const r = await fetch(config.restUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(cmd),
          });
          return { ok: r.ok };
        } catch {
          return { ok: false };
        }
      }
      return { ok: false };
    },
    [config]
  );

  const updateConfig = useCallback((c: Esp32Config) => {
    saveConfig(c);
    setConfig(c);
  }, []);

  const clearViolations = useCallback(() => {
    setViolations([]);
    setLatestViolation(null);
    try { localStorage.removeItem(VIOLATIONS_KEY); } catch {}
  }, []);

  const dismissLatestViolation = useCallback(() => setLatestViolation(null), []);

  const triggerViolation = useCallback((lane: "N" | "S" | "W" = "W") => {
    if (config.useSimulator && simRef.current) {
      simRef.current.triggerViolation(lane);
    }
  }, [config.useSimulator]);

  return {
    data, conn, lastUpdate, send, config, updateConfig,
    violations, latestViolation, clearViolations, dismissLatestViolation,
    triggerViolation,
  };
}
