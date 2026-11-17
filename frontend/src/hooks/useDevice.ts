import { useCallback, useEffect, useRef, useState } from 'react'
import { api, connectTelemetry } from '../api'
import {
  DEFAULT_CONFIG,
  type ControlMode,
  type DeviceState,
  type MosfetConfig,
} from '../types'

const IDLE_STATE: DeviceState = {
  status: 'idle',
  session_id: null,
  config: DEFAULT_CONFIG,
  current_temperature: 25,
  numeric_temperature: 25,
  current_pwm: 0,
  current_pwm_raw: 0,
  current_ma: 0,
  voltage: 0,
  dac_code: 0,
  power_w: 0,
  actuator_percent: 0,
  last_boot: null,
  last_update: new Date().toISOString(),
  message: 'Standby — waiting for Submit',
  history: [],
}

function isLive(status: string) {
  return ['running', 'heating', 'cooling', 'booting'].includes(status)
}

export function useDevice() {
  const [state, setState] = useState<DeviceState>(IDLE_STATE)
  const [config, setConfig] = useState<MosfetConfig>(DEFAULT_CONFIG)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [connected, setConnected] = useState(false)
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  const debounce = (key: string, fn: () => void, ms = 140) => {
    if (timers.current[key]) clearTimeout(timers.current[key])
    timers.current[key] = setTimeout(fn, ms)
  }

  useEffect(() => {
    let unsub = () => {}
    ;(async () => {
      try {
        const s = await api.getState()
        setState(s)
        setConfig(s.config)
        setConnected(true)
        setError(null)
      } catch {
        setError('Backend injoignable — lance FastAPI sur :8000')
        setConnected(false)
      }
      unsub = connectTelemetry((s) => {
        setState(s)
        setConnected(true)
        if (isLive(s.status)) {
          setConfig((c) => ({
            ...c,
            target_temperature: s.config.target_temperature,
            max_temperature: s.config.max_temperature,
            control_mode: s.config.control_mode,
            manual_temp_input: s.config.manual_temp_input,
            pwm_raw: s.config.pwm_raw,
            actuator_percent: s.config.actuator_percent,
          }))
        }
      })
    })()
    return () => {
      unsub()
      Object.values(timers.current).forEach(clearTimeout)
    }
  }, [])

  const submit = useCallback(async () => {
    setBusy(true)
    setError(null)
    try {
      const payload = {
        ...config,
        target_temperature: Math.min(config.target_temperature, config.max_temperature),
      }
      await api.putConfig(payload)
      const res = await api.submit(payload, true)
      setState((prev) => ({ ...prev, message: res.message, session_id: res.session_id }))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Submit failed')
    } finally {
      setBusy(false)
    }
  }, [config])

  const stop = useCallback(async () => {
    setBusy(true)
    try {
      await api.stop()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Stop failed')
    } finally {
      setBusy(false)
    }
  }, [])

  const livePatch = useCallback(
    (key: string, call: () => Promise<unknown>) => {
      debounce(key, async () => {
        if (!isLive(state.status)) return
        try {
          await call()
        } catch (e) {
          setError(e instanceof Error ? e.message : 'Update failed')
        }
      })
    },
    [state.status],
  )

  const patchTarget = useCallback(
    (target_temperature: number) => {
      const capped = Math.min(target_temperature, config.max_temperature)
      setConfig((c) => ({ ...c, target_temperature: capped }))
      livePatch('temp', () => api.setTemperature(capped))
    },
    [config.max_temperature, livePatch],
  )

  const patchMax = useCallback(
    (max_temperature: number) => {
      setConfig((c) => ({
        ...c,
        max_temperature,
        target_temperature: Math.min(c.target_temperature, max_temperature),
      }))
      livePatch('max', () => api.setMaxTemperature(max_temperature))
    },
    [livePatch],
  )

  const patchMode = useCallback(
    (control_mode: ControlMode) => {
      setConfig((c) => ({ ...c, control_mode }))
      livePatch('mode', () => api.setMode(control_mode))
    },
    [livePatch],
  )

  const patchManual = useCallback(
    (manual_temp_input: number) => {
      setConfig((c) => ({ ...c, manual_temp_input }))
      livePatch('manual', () => api.setManual(manual_temp_input))
    },
    [livePatch],
  )

  const patchPwm = useCallback(
    (pwm_raw: number) => {
      setConfig((c) => ({ ...c, pwm_raw }))
      livePatch('pwm', () => api.setPwm(pwm_raw))
    },
    [livePatch],
  )

  const patchActuator = useCallback(
    (actuator_percent: number) => {
      setConfig((c) => ({ ...c, actuator_percent }))
      livePatch('act', () => api.setActuator(actuator_percent))
    },
    [livePatch],
  )

  return {
    state,
    config,
    setConfig,
    busy,
    error,
    connected,
    submit,
    stop,
    patchTarget,
    patchMax,
    patchMode,
    patchManual,
    patchPwm,
    patchActuator,
  }
}
