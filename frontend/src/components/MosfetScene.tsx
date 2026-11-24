import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'

interface Props {
  temperature: number
  maxTemperature: number
  active: boolean
}

type ThermalBand = 'cold' | 'normal' | 'hot'
type RenderMode = 'pending' | 'webgl' | 'css'

function resolveBand(temperature: number, maxTemperature: number): ThermalBand {
  if (temperature <= 28) return 'cold'
  if (temperature >= Math.max(45, maxTemperature * 0.55)) return 'hot'
  return 'normal'
}

const BAND_HEX = {
  cold: 0x3b82f6,
  normal: 0x2ee6d6,
  hot: 0xff5a36,
} as const

const BAND_CSS = {
  cold: { hex: '#3b82f6', rgb: '59, 130, 246' },
  normal: { hex: '#2ee6d6', rgb: '46, 230, 214' },
  hot: { hex: '#ff5a36', rgb: '255, 90, 54' },
} as const

const BAND_LABEL = {
  cold: 'COLD · TEMP DOWN',
  normal: 'NORMAL',
  hot: 'HOT · TEMP RISE',
} as const

/** Probe WebGL before Three.js — avoids hard crash on VM/llvmpipe. */
function canCreateWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas')
    const opts: WebGLContextAttributes = {
      alpha: true,
      antialias: false,
      depth: true,
      failIfMajorPerformanceCaveat: false,
      powerPreference: 'low-power',
    }
    const gl =
      canvas.getContext('webgl2', opts) ||
      canvas.getContext('webgl', opts) ||
      canvas.getContext('experimental-webgl', opts)
    if (!gl || !(gl instanceof WebGLRenderingContext || (window.WebGL2RenderingContext && gl instanceof WebGL2RenderingContext))) {
      return false
    }
    // Force a tiny draw; some VMs create context then fail on first use
    gl.clearColor(0, 0, 0, 0)
    gl.clear(gl.COLOR_BUFFER_BIT)
    const lose = (gl as WebGLRenderingContext).getExtension('WEBGL_lose_context')
    lose?.loseContext()
    return true
  } catch {
    return false
  }
}

function createRenderer(canvas: HTMLCanvasElement): THREE.WebGLRenderer | null {
  try {
    return new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      alpha: true,
      powerPreference: 'low-power',
      failIfMajorPerformanceCaveat: false,
      preserveDrawingBuffer: false,
    })
  } catch {
    return null
  }
}

/** CSS 3D package — used when WebGL is unavailable (VirtualBox / llvmpipe). */
function CssMosfetFallback({
  band,
  autoSpin,
  rotRef,
}: {
  band: ThermalBand
  autoSpin: boolean
  rotRef: MutableRefObject<{ x: number; y: number }>
}) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)
  const last = useRef({ x: 0, y: 0 })
  const [, tick] = useState(0)
  const accent = BAND_CSS[band]

  useEffect(() => {
    if (!autoSpin) return
    let raf = 0
    const loop = () => {
      if (!dragging.current) {
        rotRef.current.y += 0.6
        tick((n) => n + 1)
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [autoSpin, rotRef])

  const onDown = (e: ReactPointerEvent) => {
    dragging.current = true
    last.current = { x: e.clientX, y: e.clientY }
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }
  const onMove = (e: ReactPointerEvent) => {
    if (!dragging.current) return
    const dx = e.clientX - last.current.x
    const dy = e.clientY - last.current.y
    last.current = { x: e.clientX, y: e.clientY }
    rotRef.current.y += dx * 0.45
    rotRef.current.x = Math.max(-40, Math.min(40, rotRef.current.x + dy * 0.35))
    tick((n) => n + 1)
  }
  const onUp = (e: ReactPointerEvent) => {
    dragging.current = false
    try {
      ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
    } catch {
      /* ignore */
    }
  }

  const { x, y } = rotRef.current

  return (
    <div
      ref={wrapRef}
      className="absolute inset-0 flex cursor-grab items-center justify-center active:cursor-grabbing"
      style={{ perspective: 900, touchAction: 'none' }}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
    >
      <div
        className="relative h-40 w-56"
        style={{
          transformStyle: 'preserve-3d',
          transform: `rotateX(${18 + x}deg) rotateY(${y}deg)`,
        }}
      >
        {/* Body */}
        <div
          className="absolute inset-x-6 inset-y-12 rounded-md"
          style={{
            background: 'linear-gradient(145deg, #243040, #121820)',
            boxShadow: `0 0 28px rgba(${accent.rgb}, 0.35), 0 12px 28px rgba(0,0,0,0.5)`,
            border: '1px solid #1e2d3d',
            transform: 'translateZ(12px)',
          }}
        />
        {/* Die */}
        <div
          className="absolute left-1/2 top-[38%] h-8 w-16 -translate-x-1/2 rounded-sm"
          style={{
            background: accent.hex,
            boxShadow: `0 0 22px rgba(${accent.rgb}, 0.85)`,
            transform: 'translateZ(20px)',
            opacity: 0.95,
          }}
        />
        {/* Leads */}
        {[-1, 0, 1].map((i) => (
          <div
            key={`f-${i}`}
            className="absolute bottom-6 h-1.5 w-10 rounded-sm bg-[#b8c4d0]"
            style={{
              left: `calc(50% + ${i * 28}px - 20px)`,
              transform: 'translateZ(8px) rotateX(70deg)',
              boxShadow: '0 2px 4px rgba(0,0,0,0.4)',
            }}
          />
        ))}
        {/* Glow ring */}
        <div
          className="absolute left-1/2 top-1/2 h-36 w-36 -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{
            border: `2px solid rgba(${accent.rgb}, 0.45)`,
            boxShadow: `0 0 24px rgba(${accent.rgb}, 0.35)`,
            transform: 'rotateX(78deg) translateZ(-4px)',
          }}
        />
      </div>
    </div>
  )
}

/** MOSFET scene: WebGL when possible, CSS 3D fallback for VMs without WebGL. */
export function MosfetScene({ temperature, maxTemperature, active }: Props) {
  const mountRef = useRef<HTMLDivElement>(null)
  const stateRef = useRef({ temperature, maxTemperature, active })
  const controlsRef = useRef<OrbitControls | null>(null)
  const cssRotRef = useRef({ x: 0, y: 0 })
  const [autoSpin, setAutoSpin] = useState(true)
  const [mode, setMode] = useState<RenderMode>('pending')
  const [hint, setHint] = useState('Checking GPU…')

  const band = useMemo(
    () => resolveBand(temperature, maxTemperature),
    [temperature, maxTemperature],
  )

  useEffect(() => {
    stateRef.current = { temperature, maxTemperature, active }
  }, [temperature, maxTemperature, active])

  useEffect(() => {
    const controls = controlsRef.current
    if (controls) controls.autoRotate = autoSpin
  }, [autoSpin])

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return

    if (!canCreateWebGL()) {
      setMode('css')
      setHint('CSS 3D · Drag to rotate (WebGL unavailable in VM)')
      return
    }

    const canvas = document.createElement('canvas')
    canvas.style.display = 'block'
    canvas.style.width = '100%'
    canvas.style.height = '100%'
    canvas.style.cursor = 'grab'
    canvas.style.touchAction = 'none'
    mount.appendChild(canvas)

    const renderer = createRenderer(canvas)
    if (!renderer) {
      mount.removeChild(canvas)
      setMode('css')
      setHint('CSS 3D · Drag to rotate (WebGL unavailable in VM)')
      return
    }

    setMode('webgl')
    setHint('Drag to rotate · Scroll to zoom')

    const width = mount.clientWidth || 640
    const height = mount.clientHeight || 360
    renderer.setPixelRatio(1) // keep low for VM software GL
    renderer.setSize(width, height, false)
    renderer.setClearColor(0x000000, 0)

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 100)
    camera.position.set(2.6, 1.9, 3.4)

    const controls = new OrbitControls(camera, canvas)
    controls.enableDamping = true
    controls.dampingFactor = 0.08
    controls.enablePan = true
    controls.enableZoom = true
    controls.minDistance = 1.6
    controls.maxDistance = 9
    controls.target.set(0, 0.15, 0)
    controls.autoRotate = mount.dataset.autospin !== '0'
    controls.autoRotateSpeed = 1.4
    controls.update()
    controlsRef.current = controls

    let idleTimer: ReturnType<typeof setTimeout> | null = null
    const onControlStart = () => {
      canvas.style.cursor = 'grabbing'
      controls.autoRotate = false
      setHint('Moving…')
      if (idleTimer) clearTimeout(idleTimer)
    }
    const onControlEnd = () => {
      canvas.style.cursor = 'grab'
      setHint('Drag to rotate · Scroll to zoom')
      if (idleTimer) clearTimeout(idleTimer)
      idleTimer = setTimeout(() => {
        const wantAuto = mount.dataset.autospin !== '0'
        controls.autoRotate = wantAuto
      }, 2200)
    }
    controls.addEventListener('start', onControlStart)
    controls.addEventListener('end', onControlEnd)

    const ambient = new THREE.AmbientLight(0x6a8aaa, 0.55)
    scene.add(ambient)
    const key = new THREE.DirectionalLight(0xffffff, 1.05)
    key.position.set(3, 4, 2)
    scene.add(key)
    const heatLight = new THREE.PointLight(BAND_HEX.normal, 0.45, 10)
    heatLight.position.set(0, 0.7, 0.4)
    scene.add(heatLight)

    const group = new THREE.Group()
    scene.add(group)

    const body = new THREE.Mesh(
      new THREE.BoxGeometry(1.6, 0.35, 1.1),
      new THREE.MeshStandardMaterial({
        color: 0x1a222c,
        metalness: 0.35,
        roughness: 0.55,
      }),
    )
    group.add(body)

    const dieMat = new THREE.MeshStandardMaterial({
      color: BAND_HEX.normal,
      metalness: 0.7,
      roughness: 0.25,
      emissive: new THREE.Color(BAND_HEX.normal),
      emissiveIntensity: 0.2,
    })
    const die = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.08, 0.55), dieMat)
    die.position.y = 0.22
    group.add(die)

    const leadMat = new THREE.MeshStandardMaterial({
      color: 0xb8c4d0,
      metalness: 0.95,
      roughness: 0.2,
    })
    for (let i = -1; i <= 1; i++) {
      const lead = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.04, 0.9), leadMat)
      lead.position.set(i * 0.45, -0.05, 0.85)
      group.add(lead)
      const leadB = lead.clone()
      leadB.position.z = -0.85
      group.add(leadB)
    }

    const ringMat = new THREE.MeshBasicMaterial({
      color: BAND_HEX.normal,
      transparent: true,
      opacity: 0.35,
    })
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.1, 0.025, 12, 64), ringMat)
    ring.rotation.x = Math.PI / 2
    ring.position.y = 0.1
    group.add(ring)

    const glowMat = new THREE.MeshBasicMaterial({
      color: BAND_HEX.normal,
      transparent: true,
      opacity: 0.12,
      side: THREE.DoubleSide,
    })
    const glow = new THREE.Mesh(new THREE.CircleGeometry(1.35, 48), glowMat)
    glow.rotation.x = -Math.PI / 2
    glow.position.y = -0.12
    group.add(glow)

    const targetColor = new THREE.Color(BAND_HEX.normal)
    const currentColor = new THREE.Color(BAND_HEX.normal)
    let raf = 0
    const clock = new THREE.Clock()
    let contextLost = false

    const onContextLost = (e: Event) => {
      e.preventDefault()
      contextLost = true
      setMode('css')
      setHint('CSS 3D · Drag to rotate (WebGL context lost)')
    }
    canvas.addEventListener('webglcontextlost', onContextLost)

    const onResize = () => {
      if (!mount || contextLost) return
      const w = mount.clientWidth
      const h = mount.clientHeight
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      renderer.setSize(w, h, false)
    }
    window.addEventListener('resize', onResize)

    const animate = () => {
      raf = requestAnimationFrame(animate)
      if (contextLost) return
      const t = clock.getElapsedTime()
      const { temperature: temp, maxTemperature: maxT, active: isOn } = stateRef.current
      const thermal = resolveBand(temp, maxT)
      const heat = Math.min(1, Math.max(0, (temp - 24) / Math.max(1, maxT - 24)))

      targetColor.setHex(BAND_HEX[thermal])
      currentColor.lerp(targetColor, 0.06)
      controls.update()

      dieMat.color.copy(currentColor)
      dieMat.emissive.copy(currentColor)
      dieMat.emissiveIntensity =
        (thermal === 'hot' ? 0.55 : thermal === 'cold' ? 0.28 : 0.35) +
        heat * 1.1 * (isOn ? 1 : 0.35)

      heatLight.color.copy(currentColor)
      heatLight.intensity =
        (thermal === 'hot' ? 1.4 : thermal === 'cold' ? 0.55 : 0.75) +
        heat * 1.6 * (isOn ? 1 : 0.25)

      ringMat.color.copy(currentColor)
      ringMat.opacity =
        0.18 +
        (thermal === 'hot' ? 0.5 : thermal === 'cold' ? 0.28 : 0.35) +
        Math.sin(t * 4) * 0.04
      ring.scale.setScalar(1 + heat * 0.28 + Math.sin(t * 2.8) * 0.04)

      glowMat.color.copy(currentColor)
      glowMat.opacity = 0.06 + heat * 0.22 * (isOn ? 1 : 0.4)

      try {
        renderer.render(scene, camera)
      } catch {
        contextLost = true
        setMode('css')
        setHint('CSS 3D · Drag to rotate (WebGL failed)')
      }
    }
    animate()

    return () => {
      cancelAnimationFrame(raf)
      if (idleTimer) clearTimeout(idleTimer)
      canvas.removeEventListener('webglcontextlost', onContextLost)
      controls.removeEventListener('start', onControlStart)
      controls.removeEventListener('end', onControlEnd)
      controls.dispose()
      controlsRef.current = null
      window.removeEventListener('resize', onResize)
      renderer.dispose()
      dieMat.dispose()
      leadMat.dispose()
      ringMat.dispose()
      glowMat.dispose()
      ;(body.material as THREE.Material).dispose()
      body.geometry.dispose()
      die.geometry.dispose()
      ring.geometry.dispose()
      glow.geometry.dispose()
      if (mount.contains(canvas)) mount.removeChild(canvas)
    }
  }, [])

  const bandClass =
    band === 'hot' ? 'text-heat' : band === 'cold' ? 'text-blue-400' : 'text-cyan'

  const resetView = useCallback(() => {
    if (mode === 'webgl' && controlsRef.current) {
      controlsRef.current.object.position.set(2.6, 1.9, 3.4)
      controlsRef.current.target.set(0, 0.15, 0)
      controlsRef.current.update()
      return
    }
    cssRotRef.current = { x: 0, y: 0 }
    setHint((h) => h) // force paint via state if needed
    setAutoSpin((v) => v)
  }, [mode])

  // Force CSS fallback re-render on reset
  const [, force] = useState(0)
  const doReset = () => {
    resetView()
    if (mode !== 'webgl') {
      cssRotRef.current = { x: 0, y: 0 }
      force((n) => n + 1)
    }
  }

  return (
    <div className="panel-glass relative h-full min-h-[320px] overflow-hidden rounded-2xl md:min-h-[420px]">
      <div className="pointer-events-none absolute left-4 top-4 z-10 md:left-5 md:top-5">
        <p className="font-mono text-[10px] tracking-[0.25em] text-cyan uppercase">
          {mode === 'css' ? 'CSS Die · VM Safe' : 'WebGL Die'}
        </p>
        <h2 className="font-display text-lg font-bold md:text-xl">MOSFET Package</h2>
        <p className={`mt-1 font-mono text-[10px] tracking-[0.18em] ${bandClass}`}>
          {BAND_LABEL[band]} · {temperature.toFixed(1)}°C
        </p>
      </div>

      <div className="absolute right-3 top-3 z-10 flex gap-2 md:right-4 md:top-4">
        <button
          type="button"
          onClick={() => {
            setAutoSpin((v) => {
              const next = !v
              const mount = mountRef.current
              if (mount) mount.dataset.autospin = next ? '1' : '0'
              if (controlsRef.current) controlsRef.current.autoRotate = next
              return next
            })
          }}
          className="cursor-pointer rounded-lg border border-line bg-void/80 px-2.5 py-1 font-mono text-[10px] text-muted backdrop-blur-sm transition-colors hover:border-cyan/40 hover:text-cyan"
        >
          {autoSpin ? 'AUTO ON' : 'AUTO OFF'}
        </button>
        <button
          type="button"
          onClick={doReset}
          className="cursor-pointer rounded-lg border border-line bg-void/80 px-2.5 py-1 font-mono text-[10px] text-muted backdrop-blur-sm transition-colors hover:border-cyan/40 hover:text-cyan"
        >
          RESET
        </button>
      </div>

      <div ref={mountRef} className="absolute inset-0" data-autospin="1" />

      {mode === 'css' && (
        <CssMosfetFallback band={band} autoSpin={autoSpin} rotRef={cssRotRef} />
      )}

      <div className="pointer-events-none absolute bottom-3 left-4 right-4 flex justify-between font-mono text-[10px] text-muted md:left-5 md:right-5">
        <span>{hint}</span>
        <span className={active ? 'text-ok' : ''}>{active ? 'ARMED' : 'STANDBY'}</span>
      </div>
    </div>
  )
}
