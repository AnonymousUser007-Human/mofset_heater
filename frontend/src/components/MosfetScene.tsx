import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'

interface Props {
  temperature: number
  maxTemperature: number
  active: boolean
}

type ThermalBand = 'cold' | 'normal' | 'hot'

function resolveBand(temperature: number, maxTemperature: number): ThermalBand {
  const coldCeil = 28
  const hotFloor = Math.max(45, maxTemperature * 0.55)
  if (temperature <= coldCeil) return 'cold'
  if (temperature >= hotFloor) return 'hot'
  return 'normal'
}

const BAND_HEX = {
  cold: 0x3b82f6,
  normal: 0x2ee6d6,
  hot: 0xff5a36,
} as const

const BAND_LABEL = {
  cold: 'COLD · TEMP DOWN',
  normal: 'NORMAL',
  hot: 'HOT · TEMP RISE',
} as const

/** Lightweight WebGL MOSFET die — continuous rotate + thermal color bands. */
export function MosfetScene({ temperature, maxTemperature, active }: Props) {
  const mountRef = useRef<HTMLDivElement>(null)
  const stateRef = useRef({ temperature, maxTemperature, active })
  const band = useMemo(
    () => resolveBand(temperature, maxTemperature),
    [temperature, maxTemperature],
  )

  useEffect(() => {
    stateRef.current = { temperature, maxTemperature, active }
  }, [temperature, maxTemperature, active])

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return

    const width = mount.clientWidth || 640
    const height = mount.clientHeight || 360

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(width, height)
    renderer.setClearColor(0x000000, 0)
    mount.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 100)
    camera.position.set(2.6, 1.9, 3.4)
    camera.lookAt(0, 0.2, 0)

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

    const onResize = () => {
      if (!mount) return
      const w = mount.clientWidth
      const h = mount.clientHeight
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      renderer.setSize(w, h)
    }
    window.addEventListener('resize', onResize)

    const animate = () => {
      raf = requestAnimationFrame(animate)
      const t = clock.getElapsedTime()
      const { temperature: temp, maxTemperature: maxT, active: isOn } = stateRef.current
      const thermal = resolveBand(temp, maxT)
      const heat = Math.min(1, Math.max(0, (temp - 24) / Math.max(1, maxT - 24)))

      targetColor.setHex(BAND_HEX[thermal])
      currentColor.lerp(targetColor, 0.06)

      // Continuous 3D orbit
      group.rotation.y = t * 0.55
      group.rotation.x = Math.sin(t * 0.55) * 0.18
      group.rotation.z = Math.cos(t * 0.35) * 0.06

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

      renderer.render(scene, camera)
    }
    animate()

    return () => {
      cancelAnimationFrame(raf)
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
      if (mount.contains(renderer.domElement)) {
        mount.removeChild(renderer.domElement)
      }
    }
  }, [])

  const bandClass =
    band === 'hot' ? 'text-heat' : band === 'cold' ? 'text-blue-400' : 'text-cyan'

  return (
    <div className="panel-glass relative h-full min-h-[320px] overflow-hidden rounded-2xl md:min-h-[420px]">
      <div className="pointer-events-none absolute left-4 top-4 z-10 md:left-5 md:top-5">
        <p className="font-mono text-[10px] tracking-[0.25em] text-cyan uppercase">WebGL Die</p>
        <h2 className="font-display text-lg font-bold md:text-xl">MOSFET Package</h2>
        <p className={`mt-1 font-mono text-[10px] tracking-[0.18em] ${bandClass}`}>
          {BAND_LABEL[band]} · {temperature.toFixed(1)}°C
        </p>
      </div>
      <div ref={mountRef} className="absolute inset-0" />
      <div className="pointer-events-none absolute bottom-3 left-4 right-4 flex justify-between font-mono text-[10px] text-muted md:left-5 md:right-5">
        <span>GPU SCENE · THREE.JS · ROTATE</span>
        <span className={active ? 'text-ok' : ''}>{active ? 'ARMED' : 'STANDBY'}</span>
      </div>
    </div>
  )
}
