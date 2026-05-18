export type Lane = "N" | "S" | "W" | "E";

export interface TrafficData {
  currentLane: Lane;
  remainingTime: number;
  countN: number;
  countS: number;
  countW: number;
  countE: number;
  addonApplied: boolean;
  // optional sensor + meta
  irN?: boolean;
  irS?: boolean;
  irW?: boolean;
  irE?: boolean;
  mode?: "AUTO" | "MANUAL";
}

export type Command =
  | { action: "FORCE_GREEN"; lane: Lane }
  | { action: "RESET_COUNTS" }
  | { action: "SET_MODE"; mode: "AUTO" | "MANUAL" };

export type ConnState = "connected" | "disconnected" | "reconnecting" | "simulated";

export interface ViolationEvent {
  id: string;
  lane: Lane;
  timestamp: number;
  status: "RED_LIGHT_VIOLATION";
}

export type EmergencyVehicleType = "Ambulance" | "Fire Truck" | "Police Vehicle";
export type EmergencyLaneNum = 1 | 2 | 3 | 4;

export interface EmergencyEvent {
  id: string;
  rfid: string;
  vehicle: EmergencyVehicleType;
  lane: EmergencyLaneNum;
  laneCode: Lane;
  timestamp: number;          // ms
  overrideDuration: number;   // seconds
  status: "ACTIVE" | "CLEARED" | "IGNORED";
}

// Authorized RFID tag registry
export const AUTHORIZED_RFIDS: Record<string, EmergencyVehicleType> = {
  AMB101: "Ambulance",
  AMB102: "Ambulance",
  FIRE201: "Fire Truck",
  FIRE202: "Fire Truck",
  POL301: "Police Vehicle",
  POL302: "Police Vehicle",
};

export const LANE_NUM_TO_CODE: Record<EmergencyLaneNum, Lane> = {
  1: "N", 2: "S", 3: "W", 4: "E",
};
