/*
  Smart Traffic Management - ESP32
  ---------------------------------
  Connects your hardware (3 lanes: N, S, W with IR sensors + TM1637 displays
  + traffic LEDs) to the Smart Traffic Dashboard via WebSocket.

  Libraries required (install from Arduino IDE -> Library Manager):
    - WebSockets       by Markus Sattler
    - ArduinoJson      by Benoit Blanchon
    - TM1637           by Avishay Orpaz

  After flashing:
    1. Open Serial Monitor @ 115200 baud
    2. Note the printed line: ">>> Dashboard URL: ws://192.168.x.x:81/"
    3. In the dashboard, open the gear (Connection Settings),
       turn Simulator OFF, paste the URL, Save.
*/

#include <WiFi.h>
#include <WebSocketsServer.h>
#include <ArduinoJson.h>
#include <TM1637Display.h>
// --- Optional RFID (RC522). Comment out if not wired. ---
#define ENABLE_RFID 1
#include <SPI.h>
#include <MFRC522.h>

// ============ WIFI ============
const char* WIFI_SSID     = "YOUR_WIFI_NAME";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";

// ============ LED PINS ============
#define N_RED   17
#define N_GREEN 14
#define S_RED   5
#define S_GREEN 4
#define W_RED   25
#define W_GREEN 32

// ============ IR SENSORS ============
#define IR_N            34
#define IR_S            33
#define IR_W_COUNT      26
#define IR_W_VIOLATION  35

// ============ DISPLAYS ============
TM1637Display dispN(16, 22);
TM1637Display dispS(21, 18);
TM1637Display dispW(13, 23);

// ============ RFID (RC522) ============
#ifdef ENABLE_RFID
  #define RFID_SS   15
  #define RFID_RST  2
  MFRC522 rfid(RFID_SS, RFID_RST);
  unsigned long lastRfidScan = 0;
  const unsigned long RFID_COOLDOWN_MS = 5000;
  String lastRfidUid = "";
#endif

// Authorized emergency RFID -> {vehicle, lane(1..4)}
struct RfidEntry { const char* uid; const char* vehicle; int lane; };
RfidEntry AUTHORIZED[] = {
  {"AMB101",  "Ambulance",      1},
  {"AMB102",  "Ambulance",      2},
  {"FIRE201", "Fire Truck",     2},
  {"FIRE202", "Fire Truck",     3},
  {"POL301",  "Police Vehicle", 1},
  {"POL302",  "Police Vehicle", 3},
};
const int AUTHORIZED_COUNT = sizeof(AUTHORIZED) / sizeof(AUTHORIZED[0]);

// Emergency override
bool emergencyActive = false;
unsigned long emergencyStart = 0;
const int EMERGENCY_DURATION = 20; // seconds
String emergencyLaneCode = "N";

// ============ WEBSOCKET ============
WebSocketsServer webSocket(81);
unsigned long lastBroadcast = 0;
const unsigned long BROADCAST_MS = 500;

// ============ STATE ============
String currentLane = "N";
String mode = "AUTO";          // AUTO | MANUAL
String forcedLane = "";        // queued by FORCE_GREEN
unsigned long greenStart = 0;
int greenDuration = 15;
int countN = 0, countS = 0, countW = 0;
bool addonApplied = false;

unsigned long lastN = 0, lastS = 0, lastW = 0;
const int detectDelay = 2000;

bool prevN = HIGH, prevS = HIGH, prevW = HIGH, prevViolation = HIGH;

// ============ FORWARD DECLS ============
void broadcastState();
void broadcastViolation(const char* lane);

// ============ SIGNAL CONTROL ============
void allRed() {
  digitalWrite(N_RED, HIGH); digitalWrite(N_GREEN, LOW);
  digitalWrite(S_RED, HIGH); digitalWrite(S_GREEN, LOW);
  digitalWrite(W_RED, HIGH); digitalWrite(W_GREEN, LOW);
}

void greenLane(String lane) {
  allRed();
  currentLane = lane;
  greenStart = millis();
  addonApplied = false;
  if (lane == "N") { digitalWrite(N_RED, LOW); digitalWrite(N_GREEN, HIGH); }
  if (lane == "S") { digitalWrite(S_RED, LOW); digitalWrite(S_GREEN, HIGH); }
  if (lane == "W") { digitalWrite(W_RED, LOW); digitalWrite(W_GREEN, HIGH); }

  int count = (lane == "N") ? countN : (lane == "S") ? countS : countW;
  if (count == 0)       greenDuration = 10;
  else if (count >= 3)  greenDuration = 25;
  else                  greenDuration = 15;

  Serial.printf("GREEN -> %s | count=%d | dur=%d\n", lane.c_str(), count, greenDuration);
  broadcastState();
}

String nextLane(String lane) {
  if (lane == "N") return "S";
  if (lane == "S") return "W";
  return "N";
}

void updateDisplays(int t) {
  dispN.showNumberDec((currentLane == "N") ? t : 0);
  dispS.showNumberDec((currentLane == "S") ? t : 0);
  dispW.showNumberDec((currentLane == "W") ? t : 0);
}

// ============ WS BROADCAST ============
void broadcastState() {
  StaticJsonDocument<256> doc;
  int remaining = greenDuration - (millis() - greenStart) / 1000;
  if (remaining < 0) remaining = 0;
  doc["currentLane"]   = currentLane;
  doc["remainingTime"] = remaining;
  doc["countN"]        = countN;
  doc["countS"]        = countS;
  doc["countW"]        = countW;
  doc["addonApplied"]  = addonApplied;
  doc["mode"]          = mode;
  String out; serializeJson(doc, out);
  webSocket.broadcastTXT(out);
}

void broadcastViolation(const char* lane) {
  StaticJsonDocument<96> doc;
  doc["event"] = "VIOLATION";
  doc["lane"]  = lane;
  String out; serializeJson(doc, out);
  webSocket.broadcastTXT(out);
}

void broadcastEmergency(const char* rfid, const char* vehicle, int lane) {
  StaticJsonDocument<192> doc;
  doc["type"]     = "emergency_vehicle";
  doc["rfid"]     = rfid;
  doc["vehicle"]  = vehicle;
  doc["lane"]     = lane;
  doc["priority"] = true;
  doc["duration"] = EMERGENCY_DURATION;
  String out; serializeJson(doc, out);
  webSocket.broadcastTXT(out);
  Serial.printf("🚑 EMERGENCY -> %s | %s | lane=%d\n", vehicle, rfid, lane);
}

void triggerEmergency(const char* rfid, const char* vehicle, int lane) {
  emergencyActive = true;
  emergencyStart = millis();
  // map lane 1..4 -> N/S/W (4=E unsupported by hardware, stays visual-only)
  if      (lane == 1) emergencyLaneCode = "N";
  else if (lane == 2) emergencyLaneCode = "S";
  else if (lane == 3) emergencyLaneCode = "W";
  else                emergencyLaneCode = "";   // east: no hardware override
  if (emergencyLaneCode.length()) {
    mode = "MANUAL";
    greenLane(emergencyLaneCode);
  }
  broadcastEmergency(rfid, vehicle, lane);
}

// ============ COMMAND HANDLER (from dashboard) ============
void handleCommand(uint8_t* payload, size_t length) {
  StaticJsonDocument<200> doc;
  if (deserializeJson(doc, payload, length)) return;
  const char* action = doc["action"];
  if (!action) return;

  if (strcmp(action, "FORCE_GREEN") == 0) {
    const char* lane = doc["lane"];
    if (lane) {
      forcedLane = String(lane);
      Serial.printf("CMD FORCE_GREEN -> %s\n", lane);
      if (mode == "MANUAL") greenLane(forcedLane);
    }
  } else if (strcmp(action, "RESET_COUNTS") == 0) {
    countN = countS = countW = 0;
    Serial.println("CMD RESET_COUNTS");
    broadcastState();
  } else if (strcmp(action, "SET_MODE") == 0) {
    const char* m = doc["mode"];
    if (m) {
      mode = String(m);
      Serial.printf("CMD SET_MODE -> %s\n", m);
      broadcastState();
    }
  }
}

void onWsEvent(uint8_t num, WStype_t type, uint8_t* payload, size_t length) {
  if (type == WStype_CONNECTED) {
    Serial.printf("[WS] client #%u connected\n", num);
    broadcastState();
  } else if (type == WStype_TEXT) {
    handleCommand(payload, length);
  }
}

// ============ SETUP ============
void setup() {
  Serial.begin(115200);
  pinMode(N_RED, OUTPUT); pinMode(N_GREEN, OUTPUT);
  pinMode(S_RED, OUTPUT); pinMode(S_GREEN, OUTPUT);
  pinMode(W_RED, OUTPUT); pinMode(W_GREEN, OUTPUT);
  pinMode(IR_N, INPUT);
  pinMode(IR_S, INPUT);
  pinMode(IR_W_COUNT, INPUT);
  pinMode(IR_W_VIOLATION, INPUT);
  dispN.setBrightness(7);
  dispS.setBrightness(7);
  dispW.setBrightness(7);

  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("Connecting WiFi");
  while (WiFi.status() != WL_CONNECTED) { delay(400); Serial.print("."); }
  Serial.printf("\nWiFi OK. IP: %s\n", WiFi.localIP().toString().c_str());
  Serial.printf(">>> Dashboard URL: ws://%s:81/\n", WiFi.localIP().toString().c_str());

  webSocket.begin();
  webSocket.onEvent(onWsEvent);

#ifdef ENABLE_RFID
  SPI.begin();           // SCK=18, MISO=19, MOSI=23
  rfid.PCD_Init();
  Serial.println("RFID RC522 ready.");
#endif

  allRed();
  greenLane("N");
  Serial.println("SYSTEM STARTED");
}

// ============ RFID READER ============
#ifdef ENABLE_RFID
String readRfidUid() {
  if (!rfid.PICC_IsNewCardPresent() || !rfid.PICC_ReadCardSerial()) return "";
  String uid = "";
  for (byte i = 0; i < rfid.uid.size; i++) {
    if (rfid.uid.uidByte[i] < 0x10) uid += "0";
    uid += String(rfid.uid.uidByte[i], HEX);
  }
  uid.toUpperCase();
  rfid.PICC_HaltA();
  return uid;
}
#endif

// ============ LOOP ============
void loop() {
  webSocket.loop();

#ifdef ENABLE_RFID
  // -------- RFID emergency scan --------
  if (millis() - lastRfidScan > 300) {
    lastRfidScan = millis();
    String uid = readRfidUid();
    if (uid.length() && uid != lastRfidUid) {
      // For demo: real UIDs are hex (e.g. "A3F12B4C"). We also accept human IDs
      // sent via serial/dashboard. Match against AUTHORIZED list by friendly UID
      // OR by the literal hex stored in `uid`.
      for (int i = 0; i < AUTHORIZED_COUNT; i++) {
        if (uid.equalsIgnoreCase(AUTHORIZED[i].uid)) {
          triggerEmergency(AUTHORIZED[i].uid, AUTHORIZED[i].vehicle, AUTHORIZED[i].lane);
          lastRfidUid = uid;
          break;
        }
      }
    }
  }
  // clear UID cooldown so same tag can re-trigger after a while
  if (millis() - emergencyStart > (unsigned long)(EMERGENCY_DURATION * 1000UL + RFID_COOLDOWN_MS)) {
    lastRfidUid = "";
  }
#endif

  // -------- Emergency override expiry --------
  if (emergencyActive && (millis() - emergencyStart) / 1000 >= (unsigned long)EMERGENCY_DURATION) {
    emergencyActive = false;
    mode = "AUTO";
    Serial.println("EMERGENCY override cleared -> AUTO");
    broadcastState();
  }

  // -------- NORTH (count only when RED) --------
  bool currN = digitalRead(IR_N);
  if (currentLane != "N" && prevN == HIGH && currN == LOW && millis() - lastN > detectDelay) {
    countN++; lastN = millis();
    Serial.printf("CAR -> NORTH | %d\n", countN);
    broadcastState();
  }
  prevN = currN;

  // -------- SOUTH (count only when RED) --------
  bool currS = digitalRead(IR_S);
  if (currentLane != "S" && prevS == HIGH && currS == LOW && millis() - lastS > detectDelay) {
    countS++; lastS = millis();
    Serial.printf("CAR -> SOUTH | %d\n", countS);
    broadcastState();
  }
  prevS = currS;

  // -------- WEST (count only when RED) --------
  bool currW = digitalRead(IR_W_COUNT);
  if (currentLane != "W" && prevW == HIGH && currW == LOW && millis() - lastW > detectDelay) {
    countW++; lastW = millis();
    Serial.printf("CAR -> WEST | %d\n", countW);
    broadcastState();
  }
  prevW = currW;

  // -------- 🚨 VIOLATION (WEST) --------
  bool currV = digitalRead(IR_W_VIOLATION);
  if (currentLane != "W" && prevViolation == HIGH && currV == LOW) {
    Serial.println("🚨 VIOLATION -> WEST jumped RED");
    broadcastViolation("W");
  }
  prevViolation = currV;

  // -------- TIMER --------
  int remaining = greenDuration - (millis() - greenStart) / 1000;
  if (remaining < 0) remaining = 0;
  updateDisplays(remaining);

  // periodic state broadcast (keeps dashboard countdown in sync)
  if (millis() - lastBroadcast > BROADCAST_MS) {
    lastBroadcast = millis();
    broadcastState();
  }

  // -------- SWITCH --------
  if (remaining == 0) {
    if (currentLane == "N") countN = 0;
    if (currentLane == "S") countS = 0;
    if (currentLane == "W") countW = 0;
    String nxt;
    if (mode == "MANUAL" && forcedLane.length()) {
      nxt = forcedLane;
      forcedLane = "";
    } else {
      nxt = nextLane(currentLane);
    }
    greenLane(nxt);
  }

  delay(50);
}
