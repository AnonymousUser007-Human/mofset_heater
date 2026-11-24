import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { motion, useSpring } from 'framer-motion'

interface Props {
  value: number
  temperature?: number
  maxTemperature?: number
  onChange?: (v: number) => void
  live?: boolean
}

type ThermalBand = 'cold' | 'normal' | 'hot'

const START = -135
const SWEEP = 270
const END = START + SWEEP
const TICK_COUNT = 36

function resolveBand(temperature: number, maxTemperature: number): ThermalBand {
  if (temperature <= 28) return 'cold'
  if (temperature >= Math.max(45, maxTemperature * 0.55)) return 'hot'
  return 'normal'
}

const ACCENT = {
  cold: { hex: '#3b82f6', rgb: '59, 130, 246' },
  normal: { hex: '#2ee6d6', rgb: '46, 230, 214' },
  hot: { hex: '#ff5a36', rgb: '255, 90, 54' },
} as const

function pctToDeg(pct: number) {
  return START + (Math.min(100, Math.max(0, pct)) / 100) * SWEEP
}

function degToPct(deg: number) {
  return Math.round(((deg - START) / SWEEP) * 100)
}

/** Soft neumorphic dial — dark app theme, smooth rotate (no snap). */
export function ActuatorGauge({
  value,
  temperature = 25,
  maxTemperature = 85,
  onChange,
  live,
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)
  const lastDeg = useRef(pctToDeg(value))
  const [local, setLocal] = useState(value)

  const band = resolveBand(temperature, maxTemperature)
  const accent = ACCENT[band]

  const angle = useSpring(pctToDeg(value), {
    stiffness: 260,
    damping: 32,
    mass: 0.45,
  })

  useEffect(() => {
    if (dragging.current) return
    setLocal(value)
    const deg = pctToDeg(value)
    lastDeg.current = deg
    angle.set(deg)
  }, [value, angle])

  const ticks = useMemo(() => {
    const items: { i: number; x1: number; y1: number; x2: number; y2: number }[] = []
    for (let i = 0; i <= TICK_COUNT; i++) {
      const deg = START + (i / TICK_COUNT) * SWEEP
      const rad = (deg * Math.PI) / 180
      const outer = 92
      const inner = i % 6 === 0 ? 82 : 85
      items.push({
        i,
        x1: 100 + Math.sin(rad) * outer,
        y1: 100 - Math.cos(rad) * outer,
        x2: 100 + Math.sin(rad) * inner,
        y2: 100 - Math.cos(rad) * inner,
      })
    }
    return items
  }, [])

  const resolveDeg = useCallback((clientX: number, clientY: number) => {
    const el = rootRef.current
    if (!el) return lastDeg.current
    const rect = el.getBoundingClientRect()
    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height / 2
    const dx = clientX - cx
    const dy = clientY - cy
    let deg = (Math.atan2(dx, -dy) * 180) / Math.PI

    // Bottom dead zone: clamp to MIN or MAX — never jump across the gap
    if (deg < START || deg > END) {
      deg = dx < 0 ? START : END
    }

    deg = Math.min(END, Math.max(START, deg))
    lastDeg.current = deg
    return deg
  }, [])

  const applyDeg = useCallback(
    (deg: number) => {
      const pct = Math.min(100, Math.max(0, degToPct(deg)))
      setLocal(pct)
      angle.set(deg)
      onChange?.(pct)
    },
    [angle, onChange],
  )

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!onChange) return
    dragging.current = true
    e.currentTarget.setPointerCapture(e.pointerId)
    applyDeg(resolveDeg(e.clientX, e.clientY))
  }

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragging.current || !onChange) return
    applyDeg(resolveDeg(e.clientX, e.clientY))
  }

  const endDrag = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragging.current) return
    dragging.current = false
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {
      /* ignore */
    }
    applyDeg(lastDeg.current)
  }

  const litTicks = Math.round((local / 100) * TICK_COUNT)

  return (
    <div className="flex flex-col items-center select-none">
      <p className="mb-2 font-mono text-[10px] tracking-[0.2em] text-amber uppercase">
        UGI · Actuateur
      </p>

      <div
        ref={rootRef}
        className="relative h-44 w-44 touch-none sm:h-48 sm:w-48"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        role="slider"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(local)}
        aria-label="Volume actuateur"
      >
        {/* Soft trench base */}
        <div
          className="absolute inset-[6%] rounded-full"
          style={{
            background: 'linear-gradient(145deg, #0a1018, #121b26)',
            boxShadow: `
              inset 4px 4px 10px rgba(0,0,0,0.55),
              inset -3px -3px 8px rgba(46, 230, 214, 0.05),
              0 0 0 1px rgba(30, 45, 61, 0.9)
            `,
          }}
        />

        <svg viewBox="0 0 200 200" className="pointer-events-none absolute inset-0 h-full w-full">
          {ticks.map((t) => {
            const lit = t.i <= litTicks
            return (
              <line
                key={t.i}
                x1={t.x1}
                y1={t.y1}
                x2={t.x2}
                y2={t.y2}
                stroke={lit ? accent.hex : '#3a4a5a'}
                strokeWidth={t.i % 6 === 0 ? 1.8 : 1.2}
                strokeLinecap="round"
                opacity={lit ? 1 : 0.7}
                style={{ transition: 'stroke 0.2s ease' }}
              />
            )
          })}
          <text
            x="34"
            y="168"
            fill="#7a8fa3"
            fontSize="8"
            fontFamily="Share Tech Mono, ui-monospace, monospace"
            letterSpacing="1.2"
          >
            MIN
          </text>
          <text
            x="148"
            y="168"
            fill="#7a8fa3"
            fontSize="8"
            fontFamily="Share Tech Mono, ui-monospace, monospace"
            letterSpacing="1.2"
          >
            MAX
          </text>
        </svg>

        {/* Knob — only this rotates */}
        <motion.div
          className="absolute inset-[18%] cursor-grab active:cursor-grabbing rounded-full"
          style={{
            rotate: angle,
            background: 'linear-gradient(145deg, #1a2430 0%, #121b26 45%, #0d141c 100%)',
            boxShadow: `
              6px 8px 16px rgba(0,0,0,0.55),
              -4px -4px 12px rgba(46, 230, 214, 0.06),
              inset 1px 1px 2px rgba(255,255,255,0.06),
              0 0 18px rgba(${accent.rgb}, ${live ? 0.22 : 0.08})
            `,
            border: '1px solid rgba(30, 45, 61, 0.95)',
            willChange: 'transform',
          }}
        >
          {/* Recessed dimple indicator */}
          <div
            className="absolute left-1/2 top-[12%] h-[18%] w-[18%] -translate-x-1/2 rounded-full"
            style={{
              background: 'radial-gradient(circle at 35% 30%, #243040, #0a1018 70%)',
              boxShadow: `
                inset 2px 2px 4px rgba(0,0,0,0.7),
                inset -1px -1px 2px rgba(255,255,255,0.05),
                0 0 8px rgba(${accent.rgb}, 0.35)
              `,
              border: `1px solid rgba(${accent.rgb}, 0.35)`,
            }}
          />
        </motion.div>

        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span
            className="font-mono text-lg font-bold tabular-nums"
            style={{
              color: accent.hex,
              textShadow: `0 0 12px rgba(${accent.rgb}, 0.45)`,
            }}
          >
            {Math.round(local)}
            <span className="text-xs text-muted">%</span>
          </span>
        </div>
      </div>

      {onChange && (
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={local}
          onChange={(e) => {
            const v = Number(e.target.value)
            lastDeg.current = pctToDeg(v)
            setLocal(v)
            angle.set(pctToDeg(v))
            onChange(v)
          }}
          className="mt-3 h-1.5 w-full max-w-[180px] cursor-pointer appearance-none rounded-full bg-line accent-cyan"
          aria-label="Actuateur"
        />
      )}
      {live && (
        <p className="mt-1 font-mono text-[9px] tracking-wider" style={{ color: accent.hex }}>
          LIVE GATE · {band.toUpperCase()}
        </p>
      )}
    </div>
  )
}
