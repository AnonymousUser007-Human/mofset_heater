/**
 * MOSFET Heater — DevSecOps template (Ubuntu-Lite → Py → C/C++ → Hard)
 * --------------------------------------------------------------------
 * Flash with Arduino IDE. The App web Submit button dispatches JSON over
 * serial (VM passthrough /dev/ttyUSB0 or COM*).
 *
 * Pipeline mirrored in firmware:
 *   Temp sense → DAC-equivalent PWM scaling → Power (MOSFET gate)
 *
 * Modes:
 *   AUTO   — target_c + pwm_raw (0-255) + actuator_pct
 *   MANUAL — manual_pct (0-100) mapped to temperature band
 */

#include <ArduinoJson.h>

const int MOSFET_PIN = 9;
const int TEMP_PIN   = A0;
const int LED_PIN    = 13;

enum Mode { MODE_AUTO = 0, MODE_MANUAL = 1 };

struct HeaterConfig {
  Mode  mode = MODE_AUTO;
  float target_c = 35.0;
  float max_c    = 85.0;
  float manual_pct = 42.0;
  int   pwm_raw  = 220;
  float actuator_pct = 100.0;
  float osc_amp  = 3.0;
  float osc_hz   = 0.4;
  float kp = 2.0, ki = 0.15, kd = 0.8;
  int   dac_bits = 12;
  bool  armed    = false;
};

HeaterConfig cfg;
float integral = 0.0;
float lastError = 0.0;
float numTemp = 25.0;
unsigned long lastPidMs = 0;
String serialBuf;

float readTemperatureC() {
  int raw = analogRead(TEMP_PIN);
  float voltage = raw * (5.0 / 1023.0);
  return (voltage - 0.5) * 100.0; // TMP36-style placeholder
}

float effectiveTarget() {
  if (cfg.mode == MODE_MANUAL) {
    float span = max(1.0f, cfg.max_c - 20.0f);
    return 20.0f + (cfg.manual_pct / 100.0f) * span;
  }
  return cfg.target_c;
}

int tempToDac(float tempC) {
  float span = max(1.0f, cfg.max_c - 20.0f);
  float norm = constrain((tempC - 20.0f) / span, 0.0f, 1.0f);
  int maxCode = (1 << cfg.dac_bits) - 1;
  return (int)(norm * maxCode);
}

float pidCompute(float setpoint, float measured, float dt) {
  float error = setpoint - measured;
  integral += error * dt;
  integral = constrain(integral, -50.0, 50.0);
  float derivative = (error - lastError) / max(dt, 0.001f);
  lastError = error;
  float out = cfg.kp * error + cfg.ki * integral + cfg.kd * derivative;
  return constrain(out, 0.0, 100.0);
}

void handleSubmitJson(const String &line) {
  StaticJsonDocument<512> doc;
  if (deserializeJson(doc, line)) return;

  const char *cmd = doc["cmd"] | "";
  if (strcmp(cmd, "SUBMIT") != 0 && strcmp(cmd, "BOOT") != 0 && strcmp(cmd, "SET") != 0) return;

  const char *mode = doc["mode"] | "auto";
  cfg.mode = (strcmp(mode, "manual") == 0) ? MODE_MANUAL : MODE_AUTO;
  cfg.target_c = doc["target_c"] | cfg.target_c;
  cfg.max_c = doc["max_c"] | cfg.max_c;
  cfg.pwm_raw = doc["pwm_raw"] | cfg.pwm_raw;
  cfg.actuator_pct = doc["actuator_pct"] | cfg.actuator_pct;
  cfg.manual_pct = doc["manual_pct"] | cfg.manual_pct;
  cfg.osc_amp = doc["osc_amp"] | cfg.osc_amp;
  cfg.osc_hz = doc["osc_hz"] | cfg.osc_hz;
  cfg.dac_bits = doc["dac_bits"] | cfg.dac_bits;

  if (doc.containsKey("pid")) {
    cfg.kp = doc["pid"]["kp"] | cfg.kp;
    cfg.ki = doc["pid"]["ki"] | cfg.ki;
    cfg.kd = doc["pid"]["kd"] | cfg.kd;
  }

  if (cfg.target_c > cfg.max_c) cfg.target_c = cfg.max_c;
  cfg.armed = true;
  integral = 0.0;
  lastError = 0.0;

  StaticJsonDocument<192> ack;
  ack["ok"] = true;
  ack["cmd"] = "ACK_SUBMIT";
  ack["mode"] = cfg.mode == MODE_MANUAL ? "manual" : "auto";
  ack["target_c"] = effectiveTarget();
  serializeJson(ack, Serial);
  Serial.println();
}

void pollSerial() {
  while (Serial.available()) {
    char c = (char)Serial.read();
    if (c == '\n') {
      serialBuf.trim();
      if (serialBuf.length() > 0) handleSubmitJson(serialBuf);
      serialBuf = "";
    } else {
      serialBuf += c;
      if (serialBuf.length() > 500) serialBuf = "";
    }
  }
}

void setup() {
  pinMode(MOSFET_PIN, OUTPUT);
  pinMode(LED_PIN, OUTPUT);
  analogWrite(MOSFET_PIN, 0);
  Serial.begin(115200);
  Serial.println(F("{\"ok\":true,\"cmd\":\"READY\",\"device\":\"mosfet_heater\",\"bridge\":\"ubuntu-lite\"}"));
}

void loop() {
  pollSerial();

  unsigned long now = millis();
  float dt = (now - lastPidMs) / 1000.0;
  if (dt < 0.05) return;
  lastPidMs = now;

  float tempC = readTemperatureC();
  numTemp = numTemp * 0.82f + tempC * 0.18f;

  float pwmPct = 0.0;
  if (cfg.armed) {
    float tSec = now / 1000.0;
    float osc = cfg.osc_amp * sin(2.0 * PI * cfg.osc_hz * tSec);
    float setpoint = constrain(effectiveTarget() + osc, 0.0, cfg.max_c);
    pwmPct = pidCompute(setpoint, tempC, dt);
    pwmPct *= (cfg.actuator_pct / 100.0f);

    // Blend Auto PWM raw bias
    if (cfg.mode == MODE_AUTO) {
      float bias = (cfg.pwm_raw / 255.0f) * 100.0f;
      pwmPct = constrain(0.65f * pwmPct + 0.35f * bias, 0.0f, 100.0f);
    }

    if (tempC >= cfg.max_c) {
      pwmPct = 0.0;
      digitalWrite(LED_PIN, HIGH);
    } else {
      digitalWrite(LED_PIN, LOW);
    }
  }

  analogWrite(MOSFET_PIN, (int)(constrain(pwmPct, 0.0, 100.0) * 2.55));

  StaticJsonDocument<320> tel;
  tel["cmd"] = "TELEM";
  tel["temp_c"] = tempC;
  tel["num_temp_c"] = numTemp;
  tel["target_c"] = effectiveTarget();
  tel["max_c"] = cfg.max_c;
  tel["pwm_raw"] = (int)(pwmPct * 2.55);
  tel["dac"] = tempToDac(tempC);
  tel["actuator_pct"] = cfg.actuator_pct;
  tel["armed"] = cfg.armed;
  serializeJson(tel, Serial);
  Serial.println();
}
