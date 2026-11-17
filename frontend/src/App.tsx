import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { motion } from 'framer-motion'
import { ArchitectureStrip } from './components/ArchitectureStrip'
import { ControlCenter } from './components/ControlCenter'
import { DualTempCharts } from './components/DualTempCharts'
import { MosfetMedia } from './components/MosfetMedia'
import { MosfetScene } from './components/MosfetScene'
import { StatusRail } from './components/StatusRail'
import { TensionPipeline } from './components/TensionPipeline'
import { useDevice } from './hooks/useDevice'

export default function App() {
  const {
    state,
    config,
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
  } = useDevice()

  const headerRef = useRef<HTMLElement>(null)

  useEffect(() => {
    if (!headerRef.current) return
    gsap.fromTo(
      headerRef.current.querySelectorAll('[data-rise]'),
      { y: 24, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.7, stagger: 0.08, ease: 'power3.out' },
    )
  }, [])

  const running = ['running', 'heating', 'cooling', 'booting'].includes(state.status)

  return (
    <div className="mx-auto min-h-screen max-w-[1440px] px-4 py-6 md:px-8 md:py-8">
      <header ref={headerRef} className="mb-6 md:mb-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p data-rise className="font-mono text-[11px] tracking-[0.35em] text-cyan uppercase">
              DevSecOps · App web
            </p>
            <h1
              data-rise
              className="font-display text-4xl font-extrabold tracking-tight text-text md:text-5xl"
            >
              MOSFET
              <span className="text-cyan"> CONTROL</span>
            </h1>
            <p data-rise className="mt-2 max-w-2xl text-sm text-muted md:text-base">
              Temp / Num Temp · Auto·Man · Actuateur · Tension (Temp→DAC→Puiss) · Submit vers
              Ubuntu-Lite → Hard.
            </p>
          </div>
          <motion.div
            data-rise
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center gap-3 font-mono text-xs"
          >
            <span
              className={`inline-flex h-2 w-2 rounded-full ${connected ? 'bg-ok' : 'bg-heat'}`}
            />
            <span className="text-muted">{connected ? 'API LINKED' : 'API OFFLINE'}</span>
          </motion.div>
        </div>
        {error && (
          <p className="mt-3 rounded-lg border border-heat/40 bg-heat/10 px-3 py-2 font-mono text-xs text-heat">
            {error}
          </p>
        )}
      </header>

      <div className="mb-4 md:mb-5">
        <StatusRail state={state} />
      </div>

      {/* Whiteboard layout: graphs | controls | tension/submit */}
      <div className="mb-4 grid grid-cols-1 gap-4 md:gap-5 lg:grid-cols-12 lg:items-stretch">
        <div className="lg:col-span-4">
          <DualTempCharts history={state.history} maxTemperature={config.max_temperature} />
        </div>
        <div className="lg:col-span-5">
          <ControlCenter
            config={config}
            currentTemp={state.current_temperature}
            live={running}
            onMode={patchMode}
            onTarget={patchTarget}
            onPwm={patchPwm}
            onManual={patchManual}
            onActuator={patchActuator}
            onMax={patchMax}
          />
        </div>
        <div className="lg:col-span-3">
          <TensionPipeline
            temperature={state.current_temperature}
            dacCode={state.dac_code}
            dacBits={config.dac_bits}
            powerW={state.power_w}
            voltage={state.voltage}
            busy={busy}
            running={running}
            onSubmit={submit}
            onStop={stop}
          />
        </div>
      </div>

      <div className="mb-4 md:mb-5">
        <ArchitectureStrip />
      </div>

      <div className="grid grid-cols-1 gap-4 md:gap-5 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <MosfetScene
            temperature={state.current_temperature}
            maxTemperature={config.max_temperature}
            active={running}
          />
        </div>
        <div className="lg:col-span-7">
          <MosfetMedia
            active={running}
            temperature={state.current_temperature}
          />
        </div>
        <div className="panel-glass rounded-2xl p-4 md:p-5 lg:col-span-12">
          <p className="font-mono text-[10px] tracking-[0.25em] text-amber uppercase">
            Payload Submit
          </p>
          <h2 className="mb-3 font-display text-lg font-bold">Instruction → Ubuntu-Lite / Hard</h2>
          <pre className="overflow-x-auto rounded-xl border border-line bg-void/60 p-4 font-mono text-[11px] leading-relaxed text-cyan md:text-xs">
            {JSON.stringify(
              {
                cmd: 'SUBMIT',
                mode: config.control_mode,
                target_c:
                  config.control_mode === 'manual'
                    ? 20 + (config.manual_temp_input / 100) * (config.max_temperature - 20)
                    : config.target_temperature,
                max_c: config.max_temperature,
                pwm_raw: config.pwm_raw,
                actuator_pct: config.actuator_percent,
                manual_pct: config.manual_temp_input,
                pipeline: ['temp', 'dac', 'puiss'],
                serial_port: config.serial_port,
              },
              null,
              2,
            )}
          </pre>
        </div>
      </div>

      <footer className="mt-8 border-t border-line/60 pt-4 font-mono text-[10px] text-muted">
        App web · FastAPI (Py) · Ubuntu-Lite · C/C++ · MOSFET — Submit dispatch
      </footer>
    </div>
  )
}
