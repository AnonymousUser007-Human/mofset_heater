from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field, model_validator


class DeviceStatus(str, Enum):
    IDLE = "idle"
    BOOTING = "booting"
    RUNNING = "running"
    HEATING = "heating"
    COOLING = "cooling"
    ERROR = "error"
    OFFLINE = "offline"


class ControlMode(str, Enum):
    AUTO = "auto"
    MANUAL = "manual"


class MosfetConfig(BaseModel):
    """Configuration dispatched on Submit / Boot toward Ubuntu-Lite → Hard."""

    control_mode: ControlMode = ControlMode.AUTO
    target_temperature: float = Field(35.0, ge=0.0, le=120.0, description="Setpoint °C (Auto)")
    max_temperature: float = Field(85.0, ge=30.0, le=150.0, description="Hard safety limit °C")
    manual_temp_input: float = Field(42.0, ge=0.0, le=100.0, description="Manual temp input % → °C map")
    pwm_raw: int = Field(220, ge=0, le=255, description="PWM 8-bit (Auto)")
    actuator_percent: float = Field(100.0, ge=0.0, le=100.0, description="Actuateur / UGI %")
    ramp_rate: float = Field(2.5, ge=0.1, le=20.0)
    oscillation_amplitude: float = Field(3.0, ge=0.0, le=15.0)
    oscillation_frequency: float = Field(0.4, ge=0.05, le=5.0)
    pid_kp: float = Field(2.0, ge=0.0, le=50.0)
    pid_ki: float = Field(0.15, ge=0.0, le=10.0)
    pid_kd: float = Field(0.8, ge=0.0, le=20.0)
    dac_bits: int = Field(12, ge=8, le=16, description="DAC resolution")
    supply_voltage: float = Field(12.0, ge=3.3, le=48.0)
    serial_port: str = Field("/dev/ttyUSB0", description="Ubuntu-Lite serial device")
    baud_rate: int = Field(115200, ge=9600, le=921600)

    @property
    def pwm_duty(self) -> float:
        return round(self.pwm_raw / 255.0 * 100.0, 2)

    @property
    def effective_target(self) -> float:
        if self.control_mode == ControlMode.MANUAL:
            # Map 0–100% input onto 20°C … max_temperature
            span = max(1.0, self.max_temperature - 20.0)
            return 20.0 + (self.manual_temp_input / 100.0) * span
        return self.target_temperature

    @model_validator(mode="after")
    def clamp_targets(self) -> MosfetConfig:
        if self.target_temperature > self.max_temperature:
            self.target_temperature = self.max_temperature
        return self


class TemperatureUpdate(BaseModel):
    target_temperature: float = Field(..., ge=0.0, le=120.0)


class MaxTemperatureUpdate(BaseModel):
    max_temperature: float = Field(..., ge=30.0, le=150.0)


class ModeUpdate(BaseModel):
    control_mode: ControlMode


class ManualInputUpdate(BaseModel):
    manual_temp_input: float = Field(..., ge=0.0, le=100.0)


class PwmUpdate(BaseModel):
    pwm_raw: int = Field(..., ge=0, le=255)


class ActuatorUpdate(BaseModel):
    actuator_percent: float = Field(..., ge=0.0, le=100.0)


class BootRequest(BaseModel):
    config: MosfetConfig
    force: bool = False


class BootResponse(BaseModel):
    ok: bool
    session_id: str
    status: DeviceStatus
    message: str
    dispatched_at: datetime
    payload: dict


class TelemetryPoint(BaseModel):
    timestamp: datetime
    temperature: float
    numeric_temperature: float
    target: float
    pwm: float
    pwm_raw: int
    current_ma: float
    voltage: float
    dac_code: int
    power_w: float
    actuator_percent: float
    oscillation: float


class DeviceState(BaseModel):
    status: DeviceStatus = DeviceStatus.IDLE
    session_id: Optional[str] = None
    config: MosfetConfig = Field(default_factory=MosfetConfig)
    current_temperature: float = 25.0
    numeric_temperature: float = 25.0
    current_pwm: float = 0.0
    current_pwm_raw: int = 0
    current_ma: float = 0.0
    voltage: float = 0.0
    dac_code: int = 0
    power_w: float = 0.0
    actuator_percent: float = 0.0
    last_boot: Optional[datetime] = None
    last_update: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    message: str = "Standby — waiting for Submit"
    history: list[TelemetryPoint] = Field(default_factory=list)


class HealthResponse(BaseModel):
    status: str
    service: str
    version: str
    device_status: DeviceStatus
