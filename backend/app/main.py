from __future__ import annotations

import asyncio
import json
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import Any

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from .device_bridge import bridge
from .models import (
    ActuatorUpdate,
    BootRequest,
    BootResponse,
    DeviceState,
    HealthResponse,
    ManualInputUpdate,
    MaxTemperatureUpdate,
    ModeUpdate,
    MosfetConfig,
    PwmUpdate,
    TemperatureUpdate,
)


class ConnectionManager:
    def __init__(self) -> None:
        self.active: list[WebSocket] = []

    async def connect(self, ws: WebSocket) -> None:
        await ws.accept()
        self.active.append(ws)

    def disconnect(self, ws: WebSocket) -> None:
        if ws in self.active:
            self.active.remove(ws)

    async def broadcast(self, payload: dict[str, Any]) -> None:
        dead: list[WebSocket] = []
        data = json.dumps(payload, default=str)
        for ws in self.active:
            try:
                await ws.send_text(data)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(ws)


manager = ConnectionManager()


async def _on_telemetry(state: DeviceState) -> None:
    await manager.broadcast({"type": "telemetry", "data": state.model_dump(mode="json")})


@asynccontextmanager
async def lifespan(_app: FastAPI):
    bridge.subscribe(_on_telemetry)
    yield


app = FastAPI(
    title="MOSFET DevOps Control Plane",
    description="App web → Py (Ubuntu-Lite) → C/C++ → Hardware MOSFET / DAC / Puissance",
    version="1.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _submit_payload(config: MosfetConfig, session_id: str) -> dict:
    return {
        "cmd": "SUBMIT",
        "mode": config.control_mode.value,
        "target_c": config.effective_target,
        "max_c": config.max_temperature,
        "pwm_raw": config.pwm_raw,
        "actuator_pct": config.actuator_percent,
        "manual_pct": config.manual_temp_input,
        "session_id": session_id,
        "pipeline": ["temp", "dac", "puiss"],
    }


@app.get("/api/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    return HealthResponse(
        status="ok",
        service="mosfet-control-plane",
        version="1.1.0",
        device_status=bridge.state.status,
    )


@app.get("/api/state", response_model=DeviceState)
async def get_state() -> DeviceState:
    return bridge.state


@app.get("/api/config", response_model=MosfetConfig)
async def get_config() -> MosfetConfig:
    return bridge.state.config


@app.put("/api/config", response_model=MosfetConfig)
async def put_config(config: MosfetConfig) -> MosfetConfig:
    bridge.state.config = config
    bridge.state.message = "Configuration staged — click Submit to dispatch"
    await manager.broadcast({"type": "telemetry", "data": bridge.state.model_dump(mode="json")})
    return config


@app.post("/api/submit", response_model=BootResponse)
@app.post("/api/boot", response_model=BootResponse)
async def submit_app(body: BootRequest) -> BootResponse:
    try:
        session_id, message, payload = await bridge.submit(body.config, force=body.force)
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc

    return BootResponse(
        ok=True,
        session_id=session_id,
        status=bridge.state.status,
        message=message,
        dispatched_at=datetime.now(timezone.utc),
        payload=payload or _submit_payload(body.config, session_id),
    )


@app.post("/api/stop")
async def stop_app() -> dict[str, str]:
    await bridge.stop()
    return {"status": "stopped"}


@app.patch("/api/temperature")
async def patch_temperature(body: TemperatureUpdate) -> DeviceState:
    if body.target_temperature > bridge.state.config.max_temperature:
        raise HTTPException(400, "Target exceeds max temperature")
    await bridge.update_target(body.target_temperature)
    return bridge.state


@app.patch("/api/max-temperature")
async def patch_max_temperature(body: MaxTemperatureUpdate) -> DeviceState:
    await bridge.update_max(body.max_temperature)
    return bridge.state


@app.patch("/api/mode")
async def patch_mode(body: ModeUpdate) -> DeviceState:
    await bridge.update_mode(body.control_mode)
    return bridge.state


@app.patch("/api/manual")
async def patch_manual(body: ManualInputUpdate) -> DeviceState:
    await bridge.update_manual(body.manual_temp_input)
    return bridge.state


@app.patch("/api/pwm")
async def patch_pwm(body: PwmUpdate) -> DeviceState:
    await bridge.update_pwm(body.pwm_raw)
    return bridge.state


@app.patch("/api/actuator")
async def patch_actuator(body: ActuatorUpdate) -> DeviceState:
    await bridge.update_actuator(body.actuator_percent)
    return bridge.state


@app.websocket("/ws/telemetry")
async def telemetry_ws(ws: WebSocket) -> None:
    await manager.connect(ws)
    await ws.send_text(
        json.dumps({"type": "telemetry", "data": bridge.state.model_dump(mode="json")}, default=str)
    )
    try:
        while True:
            try:
                await asyncio.wait_for(ws.receive_text(), timeout=30.0)
            except asyncio.TimeoutError:
                await ws.send_text(json.dumps({"type": "ping"}))
    except WebSocketDisconnect:
        manager.disconnect(ws)
