import { motion } from 'framer-motion'

interface Props {
  value: number
  onChange?: (v: number) => void
  live?: boolean
}

export function ActuatorGauge({ value, onChange, live }: Props) {
  const angle = -120 + (value / 100) * 240

  return (
    <div className="flex flex-col items-center">
      <p className="mb-1 font-mono text-[10px] tracking-[0.2em] text-amber uppercase">UGI · Actuateur</p>
      <div className="relative h-36 w-36">
        <svg viewBox="0 0 120 120" className="h-full w-full">
          <path
            d="M20 90 A 45 45 0 1 1 100 90"
            fill="none"
            stroke="#1e2d3d"
            strokeWidth="10"
            strokeLinecap="round"
          />
          <motion.path
            d="M20 90 A 45 45 0 1 1 100 90"
            fill="none"
            stroke="#2ee6d6"
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={141}
            animate={{ strokeDashoffset: 141 * (1 - value / 100) }}
            transition={{ type: 'spring', stiffness: 70, damping: 18 }}
          />
          <motion.line
            x1="60"
            y1="60"
            x2="60"
            y2="28"
            stroke="#ff5a36"
            strokeWidth="3"
            strokeLinecap="round"
            animate={{ rotate: angle }}
            style={{ transformOrigin: '60px 60px' }}
            transition={{ type: 'spring', stiffness: 80, damping: 16 }}
          />
          <circle cx="60" cy="60" r="5" fill="#e8f1f8" />
        </svg>
        <div className="pointer-events-none absolute inset-0 flex items-end justify-center pb-3">
          <span className="font-mono text-xl font-bold text-text">
            {value.toFixed(0)}
            <span className="text-sm text-muted">%</span>
          </span>
        </div>
      </div>
      {onChange && (
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="mt-2 h-1.5 w-full cursor-pointer appearance-none rounded-full bg-line accent-cyan"
          aria-label="Actuateur"
        />
      )}
      {live && (
        <p className="mt-1 font-mono text-[9px] text-ok">LIVE GATE</p>
      )}
    </div>
  )
}
