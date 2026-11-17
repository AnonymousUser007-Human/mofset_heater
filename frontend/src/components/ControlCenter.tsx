import { motion } from 'framer-motion'
import clsx from 'clsx'
import { ActuatorGauge } from './ActuatorGauge'
import { manualToCelsius, type ControlMode, type MosfetConfig } from '../types'

interface Props {
  config: MosfetConfig
  currentTemp: number
  live: boolean
  onMode: (m: ControlMode) => void
  onTarget: (v: number) => void
  onPwm: (v: number) => void
  onManual: (v: number) => void
  onActuator: (v: number) => void
  onMax: (v: number) => void
}

export function ControlCenter({
  config,
  currentTemp,
  live,
  onMode,
  onTarget,
  onPwm,
  onManual,
  onActuator,
  onMax,
}: Props) {
  const auto = config.control_mode === 'auto'
  const manC = manualToCelsius(config.manual_temp_input, config.max_temperature)

  return (
    <div className="panel-glass flex h-full flex-col gap-4 rounded-2xl p-4 md:p-5">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="font-mono text-[10px] tracking-[0.25em] text-cyan uppercase">Centre de commande</p>
          <h2 className="font-display text-lg font-bold">Auto / Man</h2>
        </div>
        <div className="flex rounded-xl border border-line bg-void/50 p-1">
          {(['auto', 'manual'] as ControlMode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => onMode(m)}
              className={clsx(
                'cursor-pointer rounded-lg px-3 py-1.5 font-mono text-[11px] tracking-wider uppercase transition-colors duration-200',
                config.control_mode === m
                  ? 'bg-cyan text-void'
                  : 'text-muted hover:text-text',
              )}
            >
              {m === 'auto' ? 'Auto' : 'Man'}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div
          className={clsx(
            'rounded-xl border p-3 transition-opacity duration-200',
            auto ? 'border-cyan/40 bg-cyan/5' : 'border-line opacity-55',
          )}
        >
          <p className="mb-2 font-mono text-[10px] tracking-wider text-cyan uppercase">Auto</p>
          <label className="mb-3 block">
            <span className="mb-1 flex justify-between font-mono text-[10px] text-muted">
              <span>PWM</span>
              <span className="text-text">{config.pwm_raw}</span>
            </span>
            <input
              type="range"
              min={0}
              max={255}
              value={config.pwm_raw}
              disabled={!auto}
              onChange={(e) => onPwm(Number(e.target.value))}
              className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-line accent-cyan disabled:cursor-not-allowed"
            />
          </label>
          <label className="block">
            <span className="mb-1 flex justify-between font-mono text-[10px] text-muted">
              <span>SETPOINT</span>
              <span className="text-amber">{config.target_temperature.toFixed(0)} °C</span>
            </span>
            <input
              type="range"
              min={20}
              max={config.max_temperature}
              step={0.5}
              value={Math.min(config.target_temperature, config.max_temperature)}
              disabled={!auto}
              onChange={(e) => onTarget(Number(e.target.value))}
              className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-line accent-amber disabled:cursor-not-allowed"
            />
          </label>
          <motion.p
            key={currentTemp.toFixed(1)}
            initial={{ opacity: 0.5 }}
            animate={{ opacity: 1 }}
            className="mt-3 font-mono text-2xl font-bold text-text"
          >
            {currentTemp.toFixed(1)}
            <span className="text-sm text-muted"> °C live</span>
          </motion.p>
        </div>

        <ActuatorGauge
          value={config.actuator_percent}
          onChange={onActuator}
          live={live}
        />
      </div>

      <div
        className={clsx(
          'rounded-xl border p-3 transition-opacity duration-200',
          !auto ? 'border-amber/40 bg-amber/5' : 'border-line opacity-55',
        )}
      >
        <p className="mb-2 font-mono text-[10px] tracking-wider text-amber uppercase">Man · Temp input</p>
        <label className="block">
          <span className="mb-1 flex justify-between font-mono text-[10px] text-muted">
            <span>0 — 100%</span>
            <span className="text-text">
              {config.manual_temp_input.toFixed(0)}% → {manC.toFixed(1)} °C
            </span>
          </span>
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={config.manual_temp_input}
            disabled={auto}
            onChange={(e) => onManual(Number(e.target.value))}
            className="h-2 w-full cursor-pointer appearance-none rounded-full bg-line accent-heat disabled:cursor-not-allowed"
            aria-label="Température manuelle"
          />
        </label>
      </div>

      <label className="mt-auto block">
        <span className="mb-1 flex justify-between font-mono text-[10px] text-muted">
          <span>MAX LIMIT</span>
          <span className="text-heat">{config.max_temperature.toFixed(0)} °C</span>
        </span>
        <input
          type="range"
          min={30}
          max={150}
          value={config.max_temperature}
          onChange={(e) => onMax(Number(e.target.value))}
          className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-line accent-heat"
        />
      </label>
    </div>
  )
}
