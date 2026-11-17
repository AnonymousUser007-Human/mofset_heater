import type { MosfetConfig } from '../types'

interface Props {
  config: MosfetConfig
  onChange: (next: MosfetConfig) => void
}

function Field({
  label,
  value,
  min,
  max,
  step,
  onChange,
  unit,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  onChange: (v: number) => void
  unit?: string
}) {
  return (
    <label className="block">
      <span className="mb-1 flex justify-between font-mono text-[10px] text-muted">
        <span>{label}</span>
        <span className="text-cyan">
          {value}
          {unit}
        </span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-line accent-cyan"
      />
    </label>
  )
}

export function ConfigPanel({ config, onChange }: Props) {
  const set = <K extends keyof MosfetConfig>(key: K, value: MosfetConfig[K]) =>
    onChange({ ...config, [key]: value })

  return (
    <div className="panel-glass h-full rounded-2xl p-4 md:p-5">
      <p className="font-mono text-[10px] tracking-[0.25em] text-cyan uppercase">Firmware Params</p>
      <h2 className="mb-4 font-display text-lg font-bold">Configuration MOSFET</h2>

      <div className="space-y-4">
        <Field
          label="PWM RAW"
          value={config.pwm_raw}
          min={0}
          max={255}
          step={1}
          onChange={(v) => set('pwm_raw', v)}
        />
        <Field
          label="ACTUATEUR"
          value={config.actuator_percent}
          min={0}
          max={100}
          step={1}
          unit="%"
          onChange={(v) => set('actuator_percent', v)}
        />
        <Field
          label="RAMP RATE"
          value={config.ramp_rate}
          min={0.1}
          max={20}
          step={0.1}
          unit="°C/s"
          onChange={(v) => set('ramp_rate', v)}
        />
        <Field
          label="OSC AMPLITUDE"
          value={config.oscillation_amplitude}
          min={0}
          max={15}
          step={0.1}
          unit="°C"
          onChange={(v) => set('oscillation_amplitude', v)}
        />
        <Field
          label="OSC FREQUENCY"
          value={config.oscillation_frequency}
          min={0.05}
          max={5}
          step={0.05}
          unit="Hz"
          onChange={(v) => set('oscillation_frequency', v)}
        />
        <Field
          label="PID Kp"
          value={config.pid_kp}
          min={0}
          max={20}
          step={0.1}
          onChange={(v) => set('pid_kp', v)}
        />
        <Field
          label="PID Ki"
          value={config.pid_ki}
          min={0}
          max={5}
          step={0.05}
          onChange={(v) => set('pid_ki', v)}
        />
        <Field
          label="PID Kd"
          value={config.pid_kd}
          min={0}
          max={10}
          step={0.1}
          onChange={(v) => set('pid_kd', v)}
        />

        <div className="grid grid-cols-2 gap-3 pt-2">
          <label className="block">
            <span className="mb-1 block font-mono text-[10px] text-muted">SERIAL (Ubuntu-Lite)</span>
            <input
              value={config.serial_port}
              onChange={(e) => set('serial_port', e.target.value)}
              className="w-full cursor-text rounded-lg border border-line bg-void px-3 py-2 font-mono text-sm text-text outline-none focus:border-cyan"
            />
          </label>
          <label className="block">
            <span className="mb-1 block font-mono text-[10px] text-muted">BAUD</span>
            <input
              type="number"
              value={config.baud_rate}
              onChange={(e) => set('baud_rate', Number(e.target.value))}
              className="w-full cursor-text rounded-lg border border-line bg-void px-3 py-2 font-mono text-sm text-text outline-none focus:border-cyan"
            />
          </label>
        </div>
      </div>
    </div>
  )
}
