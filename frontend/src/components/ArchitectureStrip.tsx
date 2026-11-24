import { Cpu, Laptop, Code2, Workflow } from 'lucide-react'

const NODES = [
  { icon: Laptop, label: 'Ubuntu-Lite', sub: 'VM' },
  { icon: Workflow, label: 'Py', sub: 'FastAPI' },
  { icon: Cpu, label: 'Hard', sub: 'MOSFET' },
  { icon: Code2, label: 'C / C++', sub: 'Firmware' },
]

export function ArchitectureStrip() {
  return (
    <div className="panel-glass rounded-2xl p-4 md:p-5">
      <p className="mb-3 font-mono text-[10px] tracking-[0.25em] text-muted uppercase">
        Pipeline matériel
      </p>
      <div className="flex flex-wrap items-center justify-between gap-3">
        {NODES.map((n, i) => (
          <div key={n.label} className="flex items-center gap-3">
            <div className="flex items-center gap-2 rounded-xl border border-line bg-void/40 px-3 py-2">
              <n.icon size={16} className="text-cyan" />
              <div>
                <p className="font-mono text-xs text-text">{n.label}</p>
                <p className="font-mono text-[9px] text-muted">{n.sub}</p>
              </div>
            </div>
            {i < NODES.length - 1 && (
              <span className="hidden font-mono text-cyan/60 sm:inline">→</span>
            )}
          </div>
        ))}
      </div>
      <p className="mt-3 font-mono text-[10px] leading-relaxed text-muted">
        App web → Submit → bridge Python sur Ubuntu-Lite → script / C++ → hardware. WebGL Die
        suit la température live (cold / normal / hot).
      </p>
    </div>
  )
}
