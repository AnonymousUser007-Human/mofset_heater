import type { ControlMode, DeviceState, MosfetConfig } from './types'

const API = '/api'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    ...init,
  })
  if (!res.ok) {
    const detail = await res.text()
    throw new Error(detail || res.statusText)
  }
  return res.json() as Promise<T>
}

export const api = {
  health: () => request<{ status: string; device_status: string }>('/health'),
  getState: () => request<DeviceState>('/state'),
  putConfig: (config: MosfetConfig) =>
    request<MosfetConfig>('/config', { method: 'PUT', body: JSON.stringify(config) }),
  submit: (config: MosfetConfig, force = true) =>
    request<{
      ok: boolean
      session_id: string
      message: string
      payload: Record<string, unknown>
    }>('/submit', { method: 'POST', body: JSON.stringify({ config, force }) }),
  stop: () => request<{ status: string }>('/stop', { method: 'POST' }),
  setTemperature: (target_temperature: number) =>
    request<DeviceState>('/temperature', {
      method: 'PATCH',
      body: JSON.stringify({ target_temperature }),
    }),
  setMaxTemperature: (max_temperature: number) =>
    request<DeviceState>('/max-temperature', {
      method: 'PATCH',
      body: JSON.stringify({ max_temperature }),
    }),
  setMode: (control_mode: ControlMode) =>
    request<DeviceState>('/mode', {
      method: 'PATCH',
      body: JSON.stringify({ control_mode }),
    }),
  setManual: (manual_temp_input: number) =>
    request<DeviceState>('/manual', {
      method: 'PATCH',
      body: JSON.stringify({ manual_temp_input }),
    }),
  setPwm: (pwm_raw: number) =>
    request<DeviceState>('/pwm', {
      method: 'PATCH',
      body: JSON.stringify({ pwm_raw }),
    }),
  setActuator: (actuator_percent: number) =>
    request<DeviceState>('/actuator', {
      method: 'PATCH',
      body: JSON.stringify({ actuator_percent }),
    }),
}

export function connectTelemetry(onMessage: (state: DeviceState) => void): () => void {
  const proto = window.location.protocol === 'https:' ? 'wss' : 'ws'
  const ws = new WebSocket(`${proto}://${window.location.host}/ws/telemetry`)

  ws.onmessage = (ev) => {
    try {
      const msg = JSON.parse(ev.data as string) as { type: string; data?: DeviceState }
      if (msg.type === 'telemetry' && msg.data) onMessage(msg.data)
    } catch {
      /* ignore */
    }
  }

  return () => ws.close()
}
