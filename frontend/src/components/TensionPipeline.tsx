import { motion } from 'framer-motion'
import { ArrowRight, Send, Square } from 'lucide-react'
import clsx from 'clsx'

interface Props {
  temperature: number
  dacCode: number
  dacBits: number
  powerW: number
  voltage: number
  busy: boolean
  running: boolean
  onSubmit: () => Promise<void>
  onStop: () => Promise<void>
}

function Node({ label, value, unit, accent }: { label: string; value: string; unit?: string; accent: string }) {
  return (
    <div className={`min-w-0 flex-1 rounded-xl border border-line bg-void/50 px-3 py-3 text-center`}>
      <p className="font-mono text-[9px] tracking-[0.2em] text-muted uppercase">{label}</p>
      <p className={`mt-1 font-mono text-lg font-bold ${accent}`}>
        {value}
        {unit && <span className="text-xs text-muted"> {unit}</span>}
      </p>
    </div>
  )
}

export function TensionPipeline({
  temperature,
  dacCode,
  dacBits,
  powerW,
  voltage,
  busy,
  running,
  onSubmit,
  onStop,
}: Props) {
  return (
    <div className="panel-glass flex h-full flex-col rounded-2xl p-4 md:p-5">
      <div className="mb-4">
        <p className="font-mono text-[10px] tracking-[0.25em] text-amber uppercase">Tension</p>
        <h2 className="font-display text-lg font-bold">Temp → DAC → Puiss</h2>
      </div>

      <div className="mb-4 flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
        <Node label="Temp" value={temperature.toFixed(1)} unit="°C" accent="text-cyan" />
        <ArrowRight className="mx-auto hidden shrink-0 text-muted sm:block" size={16} />
        <Node label="DAC" value={String(dacCode)} unit={`/${(1 << dacBits) - 1}`} accent="text-amber" />
        <ArrowRight className="mx-auto hidden shrink-0 text-muted sm:block" size={16} />
        <Node label="Puiss" value={powerW.toFixed(1)} unit="W" accent="text-heat" />
      </div>

      <div className="mb-4 grid grid-cols-2 gap-2 font-mono text-[11px]">
        <div className="rounded-lg border border-line/80 bg-void/40 px-3 py-2">
          <span className="text-muted">V_out</span>
          <p className="text-text">{voltage.toFixed(2)} V</p>
        </div>
        <div className="rounded-lg border border-line/80 bg-void/40 px-3 py-2">
          <span className="text-muted">Chaîne</span>
          <p className="text-cyan">DAC {dacBits}-bit</p>
        </div>
      </div>

      <div className="relative mt-auto overflow-hidden rounded-xl">
        <motion.div
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan to-transparent"
          animate={{ opacity: [0.2, 1, 0.2], scaleX: [0.4, 1, 0.4] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
        />
        <div className="flex flex-col gap-2">
          <motion.button
            type="button"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            disabled={busy}
            onClick={onSubmit}
            className={clsx(
              'inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl px-5 py-3.5',
              'font-display text-sm font-bold tracking-wide transition-colors duration-200',
              'bg-cyan text-void hover:bg-ok disabled:cursor-not-allowed disabled:opacity-50',
            )}
          >
            <Send size={16} />
            SUBMIT
          </motion.button>
          <button
            type="button"
            disabled={!running || busy}
            onClick={onStop}
            className="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-line bg-panel-2 px-5 py-2.5 font-display text-sm font-semibold text-text transition-colors duration-200 hover:border-heat hover:text-heat disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Square size={14} />
            STOP
          </button>
        </div>
      </div>
    </div>
  )
}
