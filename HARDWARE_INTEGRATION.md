# ESP8266 Hardware Integration Guide (Smart Tank)

This document provides the blueprint for connecting your ESP8266 hardware to the Difwa Vendor system. 

## 1. Hardware Requirements
- **Microcontroller**: ESP8266 (NodeMCU or ESP-01)
- **Sensor**: HC-SR04 Ultrasonic Sensor (To measure water level)
- **Actuator**: 5V/12V Relay Module (To control the water pump)
- **Power**: 5V/1A Power Supply

## 2. Wiring Diagram (Conceptual)
| ESP8266 Pin | Component |
| :--- | :--- |
| **D1 (GPIO 5)** | HC-SR04 Trigger |
| **D2 (GPIO 4)** | HC-SR04 Echo |
| **D3 (GPIO 0)** | Relay Signal (Pump Control) |
| **3V3 & GND** | Power Rails |

## 3. Communication Logic (Protocol)
We use the **Socket.io** protocol for real-time, low-latency communication.

### Data Reporting (Hardware -> Server)
The ESP8266 should send the water level every 2-5 seconds.
- **Event**: `hardware:level-update`
- **Data Payload**: `{ "deviceId": "D-1293-SB", "level": 65 }`

### Command Execution (Server -> Hardware)
The ESP8266 must listen for this event to switch the pump.
- **Event**: `commands:toggle-pump`
- **Data Payload**: `{ "status": true }` (where true is ON, false is OFF)

### Status Confirmation (Hardware -> Server)
Once the relay is switched, the ESP8266 confirms back to the server to update the Web UI.
- **Event**: `hardware:pump-confirm`
- **Data Payload**: `{ "deviceId": "D-1293-SB", "status": true }`

---

## 4. Arduino / C++ Stub Example

```cpp
#include <Arduino.h>
#include <ESP8266WiFi.h>
#include <SocketIoClient.h>

SocketIoClient webSocket;

void onTogglePump(const char * payload, size_t length) {
  // Logic to switch relay
  bool status = (strcmp(payload, "{\"status\":true}") == 0);
  digitalWrite(RELAY_PIN, status ? HIGH : LOW);
  
  // Confirm back to server
  webSocket.emit("hardware:pump-confirm", "{\"deviceId\":\"D-1293-SB\",\"status\":true}");
}

void setup() {
  pinMode(RELAY_PIN, OUTPUT);
  WiFi.begin("SSID", "PASSWORD");
  
  // Connect to your Ngrok/Server URL
  webSocket.begin("nontragic-rodney-allogenically.ngrok-free.dev");
  webSocket.on("commands:toggle-pump", onTogglePump);
}

void loop() {
  webSocket.loop();
  
  // Measure water level and emit
  int level = measureWaterLevel();
  webSocket.emit("hardware:level-update", "{\"deviceId\":\"D-1293-SB\",\"level\":65}");
  delay(2000);
}
```

## 5. Security & Stability
- **Heartbeat**: The server and hardware use Socket.io's built-in heartbeats to detect offline status.
- **Fail-safe**: If Wi-Fi is lost, the hardware should automatically turn OFF the pump to prevent overflow.
