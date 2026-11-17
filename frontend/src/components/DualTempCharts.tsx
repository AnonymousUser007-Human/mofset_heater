import { useMemo } from 'react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { TelemetryPoint } from '../types'

interface Props {
  history: TelemetryPoint[]
  maxTemperature: number
}

function MiniChart({
  title,
  dataKey,
  color,
  data,
  maxY,
}: {
  title: string
  dataKey: 'temp' | 'num'
  color: string
  data: { t: string; temp: number; num: number }[]
  maxY: number
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <p className="mb-1 font-mono text-[10px] tracking-[0.2em] text-cyan uppercase">{title}</p>
      <div className="min-h-[120px] flex-1 md:min-h-[140px]">
        {data.length < 2 ? (
          <div className="flex h-full items-center justify-center border border-dashed border-line font-mono text-[11px] text-muted">
            En attente de Submit…
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
              <defs>
                <linearGradient id={`fill-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity={0.4} />
                  <stop offset="100%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#1e2d3d" strokeDasharray="3 6" vertical={false} />
              <XAxis
                dataKey="t"
                tick={{ fill: '#7a8fa3', fontSize: 9, fontFamily: 'Share Tech Mono' }}
                axisLine={false}
                tickLine={false}
                minTickGap={36}
              />
              <YAxis
                domain={[20, maxY]}
                tick={{ fill: '#7a8fa3', fontSize: 9, fontFamily: 'Share Tech Mono' }}
                axisLine={false}
                tickLine={false}
                width={36}
              />
              <Tooltip
                contentStyle={{
                  background: '#0d141c',
                  border: '1px solid #1e2d3d',
                  borderRadius: 8,
                  fontFamily: 'Share Tech Mono',
                  fontSize: 11,
                }}
              />
              <Area
                type="monotone"
                dataKey={dataKey}
                stroke={color}
                fill={`url(#fill-${dataKey})`}
                strokeWidth={2}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}

export function DualTempCharts({ history, maxTemperature }: Props) {
  const data = useMemo(
    () =>
      history.map((p) => ({
        t: new Date(p.timestamp).toLocaleTimeString('fr-FR', {
          minute: '2-digit',
          second: '2-digit',
        }),
        temp: p.temperature,
        num: p.numeric_temperature,
      })),
    [history],
  )
  const maxY = Math.max(maxTemperature + 5, 100)

  return (
    <div className="panel-glass scanlines flex h-full flex-col gap-4 rounded-2xl p-4 md:p-5">
      <div>
        <p className="font-mono text-[10px] tracking-[0.25em] text-cyan uppercase">App web · Traces</p>
        <h2 className="font-display text-lg font-bold">Temp / Num Temp</h2>
      </div>
      <MiniChart title="Temp" dataKey="temp" color="#2ee6d6" data={data} maxY={maxY} />
      <MiniChart title="Num Temp" dataKey="num" color="#f5a524" data={data} maxY={maxY} />
    </div>
  )
}
