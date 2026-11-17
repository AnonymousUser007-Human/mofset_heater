import { useEffect, useState } from 'react'
import { Aperture, Cpu, Flame, ImageIcon } from 'lucide-react'
import { motion } from 'framer-motion'

interface Props {
  active?: boolean
  temperature?: number
}

/** Image Capture — EDUKIT 200 (Jojo_tech / Edulabs) board reference. */
export function MosfetMedia({ active = false, temperature = 25 }: Props) {
  const [failed, setFailed] = useState(false)
  const [capturedAt, setCapturedAt] = useState(() => new Date())

  useEffect(() => {
    if (!active) return
    const id = setInterval(() => setCapturedAt(new Date()), 2000)
    return () => clearInterval(id)
  }, [active])

  const heat = Math.min(1, Math.max(0, (temperature - 24) / 60))

  return (
    <div className="panel-glass overflow-hidden rounded-2xl">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line/80 px-4 py-3 md:px-5">
        <div>
          <p className="font-mono text-[10px] tracking-[0.25em] text-amber uppercase">
            Image Capture
          </p>
          <h2 className="font-display text-lg font-bold">EDUKIT 200 · Hard</h2>
        </div>
        <div className="flex items-center gap-2 font-mono text-[10px] text-muted">
          <Aperture size={14} className={active ? 'text-cyan' : 'text-muted'} />
          <span>{active ? 'STREAM LIVE' : 'FRAME HOLD'}</span>
          <span className="text-cyan">
            {capturedAt.toLocaleTimeString('fr-FR', {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            })}
          </span>
        </div>
      </div>

      <div className="relative aspect-[16/10] bg-void/90">
        {!failed ? (
          <>
            <img
              src="/edukit-200.png"
              alt="EDUKIT 200 — Arduino Nano, MOSFET Q1 avec dissipateur — Jojo_tech and Robotics Group / Edulabs"
              className="h-full w-full object-cover object-center"
              onError={() => setFailed(true)}
            />
            <motion.div
              className="pointer-events-none absolute inset-0"
              animate={{
                boxShadow: active
                  ? `inset 0 0 ${40 + heat * 60}px rgba(255, 90, 54, ${0.12 + heat * 0.35})`
                  : 'inset 0 0 0 rgba(0,0,0,0)',
              }}
              transition={{ duration: 0.6 }}
            />
            {/* Scan line */}
            {active && (
              <motion.div
                className="pointer-events-none absolute inset-x-0 h-px bg-gradient-to-r from-transparent via-cyan to-transparent"
                animate={{ top: ['8%', '92%', '8%'] }}
                transition={{ duration: 3.6, repeat: Infinity, ease: 'linear' }}
              />
            )}
            {/* Hotspot labels */}
            <div className="pointer-events-none absolute left-3 top-3 rounded-lg border border-cyan/30 bg-void/75 px-2 py-1 backdrop-blur-sm">
              <p className="flex items-center gap-1 font-mono text-[9px] text-cyan">
                <Cpu size={10} /> Arduino Nano
              </p>
            </div>
            <div className="pointer-events-none absolute bottom-3 right-3 rounded-lg border border-heat/40 bg-void/75 px-2 py-1 backdrop-blur-sm">
              <p className="flex items-center gap-1 font-mono text-[9px] text-heat">
                <Flame size={10} /> Q1 MOSFET + heatsink
              </p>
            </div>
            <div className="pointer-events-none absolute bottom-3 left-3 rounded-lg border border-line bg-void/75 px-2 py-1 backdrop-blur-sm">
              <p className="font-mono text-[9px] text-muted">Jojo_tech · Edulabs</p>
            </div>
          </>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center">
            <ImageIcon className="text-muted" size={32} />
            <p className="font-mono text-[11px] text-muted">
              Image manquante — place <span className="text-cyan">public/edukit-200.png</span>
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
