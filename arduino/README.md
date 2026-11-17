# Arduino MOSFET Heater Template

Open `mosfet_heater/mosfet_heater.ino` in **Arduino IDE**.

## Dependencies

- [ArduinoJson](https://arduinojson.org/) (Library Manager)

## Serial protocol

Baud: **115200**

### Host → Device (Boot App)

```json
{"cmd":"BOOT","target_c":55,"max_c":85,"pwm":40,"ramp":2.5,"osc_amp":3,"osc_hz":0.4,"pid":{"kp":2,"ki":0.15,"kd":0.8}}
```

### Device → Host

```json
{"cmd":"TELEM","temp_c":48.2,"target_c":55,"max_c":85,"pwm":62.1,"armed":true}
```

On a VirtualBox / VMware guest, enable USB or serial passthrough so the FastAPI bridge can open the same COM / tty device configured in the dashboard.
