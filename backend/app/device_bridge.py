"""
Bridge: App web → FastAPI (Py) → Ubuntu-Lite VM → C/C++ / serial → Hardware MOSFET.

Without hardware attached, runs a thermal + DAC/power simulator for the dashboard.
"""

from __future__ import annotations

import asyncio
import math
import uuid
from datetime import datetime, timezone
from typing import Awaitable, Callable, Optional

from .models import ControlMode, DeviceState, DeviceStatus, MosfetConfig, TelemetryPoint

TelemetryCallback = Callable[[DeviceState], Awaitable[None]]


class DeviceBridge:
    def __init__(self) -> None:
        self.state = DeviceState()
        self._task: Optional[asyncio.Task] = None
        self._listeners: list[TelemetryCallback] = []
        self._t0 = datetime.now(timezone.utc).timestamp()
        self._lock = asyncio.Lock()
        self._num_temp = 25.0

    def subscribe(self, cb: TelemetryCallback) -> None:
        self._listeners.append(cb)

    def unsubscribe(self, cb: TelemetryCallback) -> None:
        if cb in self._listeners:
            self._listeners.remove(cb)

    async def _notify(self) -> None:
        for cb in list(self._listeners):
            try:
                await cb(self.state)
            except Exception:
                pass

    def _build_payload(self, config: MosfetConfig) -> dict:
        return {
            "cmd": "SUBMIT",
            "mode": config.control_mode.value,
            "target_c": round(config.effective_target, 2),
            "max_c": config.max_temperature,
            "pwm_raw": config.pwm_raw,
            "actuator_pct": config.actuator_percent,
            "manual_pct": config.manual_temp_input,
            "ramp": config.ramp_rate,
            "osc_amp": config.oscillation_amplitude,
            "osc_hz": config.oscillation_frequency,
            "pid": {"kp": config.pid_kp, "ki": config.pid_ki, "kd": config.pid_kd},
            "dac_bits": config.dac_bits,
            "v_supply": config.supply_voltage,
            "bridge": "ubuntu-lite→py→c++→hard",
        }

    @staticmethod
    def _temp_to_dac(temp: float, max_c: float, bits: int) -> int:
        span = max(1.0, max_c - 20.0)
        norm = min(1.0, max(0.0, (temp - 20.0) / span))
        return int(round(norm * ((1 << bits) - 1)))

    async def submit(self, config: MosfetConfig, force: bool = False) -> tuple[str, str, dict]:
        async with self._lock:
            if self.state.status in (DeviceStatus.RUNNING, DeviceStatus.HEATING, DeviceStatus.COOLING) and not force:
                return self.state.session_id or "", "Already running — force=true to re-submit", {}

            if config.effective_target > config.max_temperature:
                self.state.status = DeviceStatus.ERROR
                self.state.message = "Rejected: effective target exceeds max temperature"
                await self._notify()
                raise ValueError(self.state.message)

            session_id = str(uuid.uuid4())
            self.state.config = config
            self.state.session_id = session_id
            self.state.status = DeviceStatus.BOOTING
            self.state.message = "Submit → Ubuntu-Lite Py bridge → C/C++ → Hard…"
            self.state.last_boot = datetime.now(timezone.utc)
            self.state.history = []
            self._num_temp = self.state.current_temperature
            await self._notify()

            await asyncio.sleep(0.7)
            payload = self._build_payload(config)

            self.state.status = DeviceStatus.RUNNING
            self.state.message = (
                f"Submit OK — {config.control_mode.value.upper()} on {config.serial_port} "
                f"(PWM {config.pwm_raw}, actuateur {config.actuator_percent:.0f}%)"
            )
            self._t0 = datetime.now(timezone.utc).timestamp()

            if self._task and not self._task.done():
                self._task.cancel()
            self._task = asyncio.create_task(self._simulate_loop())
            await self._notify()
            return session_id, self.state.message, payload

    # Alias used by existing /api/boot route
    async def boot(self, config: MosfetConfig, force: bool = False) -> tuple[str, str]:
        sid, msg, _ = await self.submit(config, force)
        return sid, msg

    async def update_target(self, temperature: float) -> None:
        cfg = self.state.config
        capped = min(temperature, cfg.max_temperature)
        self.state.config = cfg.model_copy(update={"target_temperature": capped})
        if self.state.status in (DeviceStatus.RUNNING, DeviceStatus.HEATING, DeviceStatus.COOLING):
            self.state.message = f"Auto setpoint → {capped:.1f}°C"
        await self._notify()

    async def update_max(self, max_temperature: float) -> None:
        cfg = self.state.config
        target = min(cfg.target_temperature, max_temperature)
        self.state.config = cfg.model_copy(
            update={"max_temperature": max_temperature, "target_temperature": target}
        )
        self.state.message = f"Safety ceiling → {max_temperature:.1f}°C"
        await self._notify()

    async def update_mode(self, mode: ControlMode) -> None:
        self.state.config = self.state.config.model_copy(update={"control_mode": mode})
        self.state.message = f"Mode → {mode.value.upper()}"
        await self._notify()

    async def update_manual(self, pct: float) -> None:
        self.state.config = self.state.config.model_copy(update={"manual_temp_input": pct})
        if self.state.config.control_mode == ControlMode.MANUAL:
            self.state.message = f"Man input → {pct:.0f}% ({self.state.config.effective_target:.1f}°C)"
        await self._notify()

    async def update_pwm(self, pwm_raw: int) -> None:
        self.state.config = self.state.config.model_copy(update={"pwm_raw": pwm_raw})
        self.state.message = f"PWM raw → {pwm_raw}/255"
        await self._notify()

    async def update_actuator(self, pct: float) -> None:
        self.state.config = self.state.config.model_copy(update={"actuator_percent": pct})
        self.state.message = f"Actuateur → {pct:.0f}%"
        await self._notify()

    async def stop(self) -> None:
        async with self._lock:
            if self._task and not self._task.done():
                self._task.cancel()
            self.state.status = DeviceStatus.IDLE
            self.state.current_pwm = 0.0
            self.state.current_pwm_raw = 0
            self.state.current_ma = 0.0
            self.state.voltage = 0.0
            self.state.dac_code = 0
            self.state.power_w = 0.0
            self.state.actuator_percent = 0.0
            self.state.message = "Stopped — MOSFET / DAC gated off"
            await self._notify()

    async def _simulate_loop(self) -> None:
        ambient = 24.0
        temp = self.state.current_temperature
        try:
            while True:
                cfg = self.state.config
                now = datetime.now(timezone.utc)
                elapsed = now.timestamp() - self._t0

                osc = cfg.oscillation_amplitude * math.sin(
                    2 * math.pi * cfg.oscillation_frequency * elapsed
                )
                desired = min(cfg.effective_target + osc, cfg.max_temperature)
                error = desired - temp
                step = max(-cfg.ramp_rate, min(cfg.ramp_rate, error)) * 0.35
                temp = max(ambient, temp + step)

                # Numeric temp = lightly filtered sensor estimate (Num Temp graph)
                self._num_temp = self._num_temp * 0.82 + temp * 0.18

                duty = cfg.pwm_raw / 255.0 * 100.0
                act = cfg.actuator_percent / 100.0

                if temp >= cfg.max_temperature - 0.05:
                    temp = cfg.max_temperature
                    self.state.status = DeviceStatus.HEATING
                    self.state.message = "HARD LIMIT — PWM / DAC clamped"
                    pwm = max(5.0, duty * 0.2) * act
                elif abs(error) < 0.4:
                    self.state.status = DeviceStatus.RUNNING
                    pwm = duty * (0.55 + 0.2 * math.sin(elapsed)) * act
                elif error > 0:
                    self.state.status = DeviceStatus.HEATING
                    pwm = min(100.0, duty + abs(error) * 4) * act
                else:
                    self.state.status = DeviceStatus.COOLING
                    pwm = max(0.0, duty * 0.3) * act

                if cfg.control_mode == ControlMode.MANUAL:
                    # Manual drives closer to mapped setpoint with fixed PWM bias
                    pwm = min(100.0, max(pwm, cfg.manual_temp_input * act * 0.85))

                pwm_raw = int(round(pwm / 100.0 * 255))
                voltage = cfg.supply_voltage * (pwm / 100.0)
                current_ma = pwm * 28.0 * act + abs(osc) * 12
                dac = self._temp_to_dac(temp, cfg.max_temperature, cfg.dac_bits)
                # Power ≈ V * I, scaled by actuator
                power_w = round((voltage * (current_ma / 1000.0)) * act, 2)

                point = TelemetryPoint(
                    timestamp=now,
                    temperature=round(temp, 2),
                    numeric_temperature=round(self._num_temp, 2),
                    target=round(cfg.effective_target, 2),
                    pwm=round(pwm, 2),
                    pwm_raw=pwm_raw,
                    current_ma=round(current_ma, 1),
                    voltage=round(voltage, 2),
                    dac_code=dac,
                    power_w=power_w,
                    actuator_percent=cfg.actuator_percent,
                    oscillation=round(osc, 3),
                )

                self.state.current_temperature = point.temperature
                self.state.numeric_temperature = point.numeric_temperature
                self.state.current_pwm = point.pwm
                self.state.current_pwm_raw = point.pwm_raw
                self.state.current_ma = point.current_ma
                self.state.voltage = point.voltage
                self.state.dac_code = point.dac_code
                self.state.power_w = point.power_w
                self.state.actuator_percent = point.actuator_percent
                self.state.last_update = now
                self.state.history.append(point)
                if len(self.state.history) > 180:
                    self.state.history = self.state.history[-180:]

                await self._notify()
                await asyncio.sleep(0.12)
        except asyncio.CancelledError:
            return


bridge = DeviceBridge()
