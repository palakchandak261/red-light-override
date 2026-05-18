// Parses messages coming from the ESP32 over WebSocket / Serial bridge.
// Supports BOTH formats:
//   1) Text line:  "DATA:VIOLATION:NORTH"
//   2) JSON state: { currentLane, remainingTime, countN, countS, countW, addonApplied }
//   3) JSON event: { event: "VIOLATION", lane: "N" }
import type { EmergencyEvent, EmergencyLaneNum, EmergencyVehicleType, Lane, TrafficData, ViolationEvent } from "./traffic-types";
import { AUTHORIZED_RFIDS, LANE_NUM_TO_CODE } from "./traffic-types";

export type ParsedMessage =
  | { type: "state"; data: Partial<TrafficData> }
  | { type: "violation"; event: ViolationEvent }
  | { type: "emergency"; event: EmergencyEvent }
  | { type: "unknown"; raw: string };

const laneFromName = (name: string): Lane | null => {
  const u = name.trim().toUpperCase();
  if (u === "N" || u === "NORTH") return "N";
  if (u === "S" || u === "SOUTH") return "S";
  if (u === "W" || u === "WEST") return "W";
  return null;
};

const makeViolation = (lane: Lane): ViolationEvent => ({
  id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  lane,
  timestamp: Date.now(),
  status: "RED_LIGHT_VIOLATION",
});

export function parseEsp32Message(raw: string): ParsedMessage {
  const text = raw.trim();
  if (!text) return { type: "unknown", raw };

  // Case 1: serial-style text "DATA:VIOLATION:NORTH"
  if (text.startsWith("DATA:")) {
    const parts = text.split(":");
    if (parts[1] === "VIOLATION" && parts[2]) {
      const lane = laneFromName(parts[2]);
      if (lane) return { type: "violation", event: makeViolation(lane) };
    }
    return { type: "unknown", raw };
  }

  // Case 2/3: JSON
  if (text.startsWith("{")) {
    try {
      const obj = JSON.parse(text);
      if (obj.event === "VIOLATION" && obj.lane) {
        const lane = laneFromName(String(obj.lane));
        if (lane) return { type: "violation", event: makeViolation(lane) };
      }
      if (obj.type === "emergency_vehicle" && obj.rfid) {
        const rfid = String(obj.rfid).toUpperCase();
        const vehicle = (AUTHORIZED_RFIDS[rfid] ?? (obj.vehicle as EmergencyVehicleType)) || null;
        const laneNum = Number(obj.lane) as EmergencyLaneNum;
        if (vehicle && [1, 2, 3, 4].includes(laneNum)) {
          const ev: EmergencyEvent = {
            id: `${Date.now()}-${rfid}`,
            rfid,
            vehicle,
            lane: laneNum,
            laneCode: LANE_NUM_TO_CODE[laneNum],
            timestamp: obj.timestamp ? new Date(obj.timestamp).getTime() : Date.now(),
            overrideDuration: Number(obj.duration ?? 20),
            status: "ACTIVE",
          };
          return { type: "emergency", event: ev };
        }
      }
      if ("currentLane" in obj || "remainingTime" in obj) {
        return { type: "state", data: obj as Partial<TrafficData> };
      }
    } catch {
      /* fallthrough */
    }
  }
  return { type: "unknown", raw };
}
