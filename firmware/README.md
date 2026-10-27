# SOL-OSINT | HASAD-Live: ESP32 Hardware Bridge & Solenoid Firmware

## Overview
This firmware module turns standard ESP32 development boards (WROOM-32, ESP32-S3) into field solenoid actuation nodes for precision agriculture irrigation circles and drip manifolds.

### Hardware Bill of Materials (BOM)
1. **Microcontroller**: ESP32 DevKit V1 / NodeMCU-32S.
2. **Relay Module**: 1-Channel 5V/12V Optocoupled Relay or Power MOSFET Switch (Active-Low).
3. **Solenoid Valve**: 12V/24V DC Normally Closed (NC) Irrigation Solenoid Valve.
4. **Power Supply**: 12V Solar Panel + MPPT Charge Controller + 3.2V LiFePO4 Battery with 5V Step-Up/LDO.
5. **Optional Flow Sensor**: YF-S201 Hall-Effect Flow Meter (1/2" NPT).

### Pin Assignment
| Pin | Function | Notes |
|---|---|---|
| GPIO 16 | Relay / Valve Actuator | Active-Low (`LOW` = Open, `HIGH` = Closed) |
| GPIO 17 | Flow Sensor Pulse Input | Attached Interrupt (Rising Edge) |
| GPIO 34 | Battery ADC | Voltage Divider (100k / 33k) |
| GPIO 2  | Status LED | Solid Blue when Valve is Active |

### Server Endpoints
- **Poll Command**: `GET /api/hasad/get-valve-command?nodeId=...`
- **Telemetry Ack**: `POST /api/hasad/valve-status-ack`

### Compilation & Flash
1. Install Arduino IDE or PlatformIO.
2. Add ESP32 Board Support: `https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json`.
3. Install **ArduinoJson** library (v6 or v7) via Library Manager.
4. Open `firmware/esp32_solenoid_node.ino`, update `WIFI_SSID`, `WIFI_PASSWORD`, and `SERVER_BASE_URL`.
5. Upload at 115200 baud.
