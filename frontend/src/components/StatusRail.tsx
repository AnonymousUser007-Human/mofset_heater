import { Activity, Cpu, Radio, Zap } from 'lucide-react'
import type { DeviceState } from '../types'
import clsx from 'clsx'

const STATUS_COLOR: Record<string, string> = {
  idle: 'bg-muted',
  booting: 'bg-amber',
  running: 'bg-ok',
  heating: 'bg-heat',
  cooling: 'bg-cyan',
  error: 'bg-heat',
  offline: 'bg-muted',
}

export function StatusRail({ state }: { state: DeviceState }) {
  const metrics = [
    { icon: Activity, label: 'PWM', value: `${state.current_pwm_raw}/255` },
    { icon: Zap, label: 'DAC', value: String(state.dac_code) },
    { icon: Radio, label: 'PUISS', value: `${state.power_w.toFixed(1)} W` },
    {
      icon: Cpu,
      label: 'MODE',
      value: state.config.control_mode.toUpperCase(),
    },
  ]

  return (
    <div className="panel-glass grid grid-cols-2 gap-3 rounded-2xl p-4 md:grid-cols-4 md:gap-4 md:p-5">
      {metrics.map(({ icon: Icon, label, value }) => (
        <div key={label} className="rounded-xl border border-line/80 bg-void/40 px-3 py-3">
          <div className="mb-2 flex items-center gap-2 text-muted">
            <Icon size={14} className="text-cyan" />
            <span className="font-mono text-[10px] tracking-wider">{label}</span>
          </div>
          <p className="font-mono text-lg text-text md:text-xl">{value}</p>
        </div>
      ))}
      <div className="col-span-2 flex items-center gap-3 rounded-xl border border-line/80 bg-void/40 px-3 py-3 md:col-span-4">
        <span
          className={clsx(
            'relative inline-flex h-2.5 w-2.5 rounded-full',
            STATUS_COLOR[state.status] ?? 'bg-muted',
          )}
        >
          <span
            className={clsx(
              'absolute inset-0 animate-[pulse-ring_1.6s_ease-out_infinite] rounded-full',
              STATUS_COLOR[state.status] ?? 'bg-muted',
            )}
          />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[10px] tracking-[0.2em] text-muted uppercase">
            Device · {state.status} · actuateur {state.actuator_percent.toFixed(0)}%
          </p>
          <p className="truncate font-mono text-xs text-text md:text-sm">{state.message}</p>
        </div>
      </div>
    </div>
  )
}
