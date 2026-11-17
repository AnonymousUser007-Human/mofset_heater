# OSFET Control — DevSecOps

App web React + FastAPI (Python) pour piloter un MOSFET via **Ubuntu-Lite (VM)** → bridge **C/C++ / serial** → hardware.

## Design (tableau)

```
┌──────────────── App web ─────────────────────────────┐
│  Temp        │  Auto (PWM / °C) + Actuateur (%)      │
│  Num Temp    │  Man (Temp input 0–100%)              │ Tension
│              │                                       │ Temp→DAC→Puiss
│              │                                       │ [ SUBMIT ]
└──────────────────────────────────────────────────────┘
 Ubuntu-Lite ──Py──▶ Hard ──▶ Script / C++ ──▶ Image
```

## Démarrage

### Backend

```bash
cd backend
python -m venv .venv
.\.venv\Scripts\activate          # Windows
pip install -r requirements.txt
python run.py
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

- UI : http://127.0.0.1:5173  
- API : http://127.0.0.1:8000/docs

## Flux Submit

1. Régler **Auto** (PWM 0–255 + setpoint °C) ou **Man** (slider 0–100% → °C).
2. Régler l’**actuateur** (gate %).
3. **SUBMIT** envoie le JSON au backend → bridge Ubuntu-Lite → Arduino.
4. Les graphes **Temp** / **Num Temp** et la chaîne **Temp → DAC → Puiss** se mettent à jour en live (WebSocket).

## Endpoints

| Method | Path | Rôle |
|--------|------|------|
| POST | `/api/submit` | Dispatch (alias `/api/boot`) |
| PATCH | `/api/mode` | `auto` / `manual` |
| PATCH | `/api/pwm` | PWM raw 0–255 |
| PATCH | `/api/manual` | Entrée manuelle % |
| PATCH | `/api/actuator` | Actuateur % |
| PATCH | `/api/temperature` | Setpoint Auto |
| PATCH | `/api/max-temperature` | Limite max |
| WS | `/ws/telemetry` | Stream live |

## Arduino

`arduino/mosfet_heater/mosfet_heater.ino` — ouvrir dans Arduino IDE, lib **ArduinoJson**, port série = celui de la VM (`/dev/ttyUSB0` ou `COMx`).

## Image Capture

Photo board **EDUKIT 200** (Jojo_tech / Edulabs — Arduino Nano + MOSFET Q1) :

- `frontend/public/edukit-200.png`
- Affichée dans le panneau **Image Capture** du dashboard (scan live après Submit).

git init
git add .
git commit -m "first commit"
git branch -M main
git remote add origin git@github.com:AnonymousUser007-Human/mofset_heater.git
git push -u origin main