import { useEffect, useRef } from 'react'
import * as THREE from 'three'

interface Props {
  temperature: number
  maxTemperature: number
  active: boolean
}

/** Lightweight WebGL MOSFET die visualization — heat mapped to emissive intensity. */
export function MosfetScene({ temperature, maxTemperature, active }: Props) {
  const mountRef = useRef<HTMLDivElement>(null)
  const stateRef = useRef({ temperature, maxTemperature, active })

  useEffect(() => {
    stateRef.current = { temperature, maxTemperature, active }
  }, [temperature, maxTemperature, active])

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return

    const width = mount.clientWidth || 320
    const height = mount.clientHeight || 240

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(width, height)
    renderer.setClearColor(0x000000, 0)
    mount.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 100)
    camera.position.set(2.4, 1.8, 3.2)
    camera.lookAt(0, 0.2, 0)

    const ambient = new THREE.AmbientLight(0x6a8aaa, 0.55)
    scene.add(ambient)
    const key = new THREE.DirectionalLight(0x2ee6d6, 1.1)
    key.position.set(3, 4, 2)
    scene.add(key)
    const heatLight = new THREE.PointLight(0xff5a36, 0.4, 8)
    heatLight.position.set(0, 0.6, 0.4)
    scene.add(heatLight)

    const group = new THREE.Group()
    scene.add(group)

    // Package body
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(1.6, 0.35, 1.1),
      new THREE.MeshStandardMaterial({
        color: 0x1a222c,
        metalness: 0.35,
        roughness: 0.55,
      }),
    )
    group.add(body)

    // Silicon die
    const dieMat = new THREE.MeshStandardMaterial({
      color: 0x2ee6d6,
      metalness: 0.7,
      roughness: 0.25,
      emissive: new THREE.Color(0xff5a36),
      emissiveIntensity: 0.15,
    })
    const die = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.08, 0.55), dieMat)
    die.position.y = 0.22
    group.add(die)

    // Leads
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

    // Heat haze ring
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(1.1, 0.02, 12, 64),
      new THREE.MeshBasicMaterial({ color: 0xff5a36, transparent: true, opacity: 0.35 }),
    )
    ring.rotation.x = Math.PI / 2
    ring.position.y = 0.1
    group.add(ring)

    let frame = 0
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
      const heat = Math.min(1, Math.max(0, (temp - 24) / Math.max(1, maxT - 24)))

      group.rotation.y = t * 0.35
      group.rotation.x = Math.sin(t * 0.4) * 0.08
      dieMat.emissiveIntensity = 0.12 + heat * 1.6 * (isOn ? 1 : 0.25)
      dieMat.color.setHSL(0.48 - heat * 0.42, 0.85, 0.55)
      heatLight.intensity = 0.2 + heat * 2.2 * (isOn ? 1 : 0.2)
      ring.scale.setScalar(1 + heat * 0.25 + Math.sin(t * 3) * 0.03 * heat)
      ;(ring.material as THREE.MeshBasicMaterial).opacity = 0.15 + heat * 0.45

      frame++
      renderer.render(scene, camera)
    }
    animate()

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', onResize)
      renderer.dispose()
      mount.removeChild(renderer.domElement)
      void frame
    }
  }, [])

  return (
    <div className="panel-glass relative h-full min-h-[240px] overflow-hidden rounded-2xl">
      <div className="pointer-events-none absolute left-4 top-4 z-10">
        <p className="font-mono text-[10px] tracking-[0.25em] text-cyan uppercase">WebGL Die</p>
        <h2 className="font-display text-lg font-bold">MOSFET Package</h2>
      </div>
      <div ref={mountRef} className="absolute inset-0" />
      <div className="pointer-events-none absolute bottom-3 left-4 right-4 flex justify-between font-mono text-[10px] text-muted">
        <span>GPU SCENE · THREE.JS</span>
        <span>{active ? 'ARMED' : 'STANDBY'}</span>
      </div>
    </div>
  )
}
