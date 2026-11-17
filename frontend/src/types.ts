export type DeviceStatus =
  | 'idle'
  | 'booting'
  | 'running'
  | 'heating'
  | 'cooling'
  | 'error'
  | 'offline'

export type ControlMode = 'auto' | 'manual'

export interface MosfetConfig {
  control_mode: ControlMode
  target_temperature: number
  max_temperature: number
  manual_temp_input: number
  pwm_raw: number
  actuator_percent: number
  ramp_rate: number
  oscillation_amplitude: number
  oscillation_frequency: number
  pid_kp: number
  pid_ki: number
  pid_kd: number
  dac_bits: number
  supply_voltage: number
  serial_port: string
  baud_rate: number
}

export interface TelemetryPoint {
  timestamp: string
  temperature: number
  numeric_temperature: number
  target: number
  pwm: number
  pwm_raw: number
  current_ma: number
  voltage: number
  dac_code: number
  power_w: number
  actuator_percent: number
  oscillation: number
}

export interface DeviceState {
  status: DeviceStatus
  session_id: string | null
  config: MosfetConfig
  current_temperature: number
  numeric_temperature: number
  current_pwm: number
  current_pwm_raw: number
  current_ma: number
  voltage: number
  dac_code: number
  power_w: number
  actuator_percent: number
  last_boot: string | null
  last_update: string
  message: string
  history: TelemetryPoint[]
}

export const DEFAULT_CONFIG: MosfetConfig = {
  control_mode: 'auto',
  target_temperature: 35,
  max_temperature: 85,
  manual_temp_input: 42,
  pwm_raw: 220,
  actuator_percent: 100,
  ramp_rate: 2.5,
  oscillation_amplitude: 3,
  oscillation_frequency: 0.4,
  pid_kp: 2,
  pid_ki: 0.15,
  pid_kd: 0.8,
  dac_bits: 12,
  supply_voltage: 12,
  serial_port: '/dev/ttyUSB0',
  baud_rate: 115200,
}

/** Map manual 0–100% input to °C between 20 and max. */
export function manualToCelsius(pct: number, maxTemp: number): number {
  const span = Math.max(1, maxTemp - 20)
  return 20 + (pct / 100) * span
}
