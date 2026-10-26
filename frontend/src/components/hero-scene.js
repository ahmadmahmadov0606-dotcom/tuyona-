import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'

const PETAL_COLORS = ['#f4c6cf', '#fbe9e4', '#e88fa3', '#c9415f', '#fff4ea']

// Гулбарг: шакли қатрагӣ, ки каме хам шудааст.
function petalGeometry() {
  const s = new THREE.Shape()
  s.moveTo(0, -0.16)
  s.bezierCurveTo(0.15, -0.1, 0.16, 0.1, 0, 0.17)
  s.bezierCurveTo(-0.16, 0.1, -0.15, -0.1, 0, -0.16)
  const g = new THREE.ShapeGeometry(s, 10)
  const p = g.attributes.position
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i)
    p.setZ(i, x * x * 2.4 - y * 0.25)
  }
  g.computeVertexNormals()
  return g
}

// Алмос (brilliant cut) бо LatheGeometry ва рӯяҳои ҳамвор.
function gemGeometry() {
  const pts = [
    new THREE.Vector2(0, -0.26),
    new THREE.Vector2(0.2, -0.02),
    new THREE.Vector2(0.21, 0),
    new THREE.Vector2(0.13, 0.09),
    new THREE.Vector2(0, 0.09),
  ]
  const g = new THREE.LatheGeometry(pts, 10)
  return g.toNonIndexed()
}

function dotTexture() {
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const x = c.getContext('2d')
  const gr = x.createRadialGradient(32, 32, 0, 32, 32, 32)
  gr.addColorStop(0, 'rgba(255,240,200,1)')
  gr.addColorStop(0.35, 'rgba(240,200,120,.55)')
  gr.addColorStop(1, 'rgba(240,200,120,0)')
  x.fillStyle = gr
  x.fillRect(0, 0, 64, 64)
  return new THREE.CanvasTexture(c)
}

export function createScene(container, getAnchor) {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.15
  renderer.outputColorSpace = THREE.SRGBColorSpace
  container.appendChild(renderer.domElement)

  const scene = new THREE.Scene()
  const pmrem = new THREE.PMREMGenerator(renderer)
  const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
  scene.environment = envTex

  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100)
  camera.position.set(0, 0, 8)

  scene.add(new THREE.AmbientLight(0xffe8f0, 0.35))
  const key = new THREE.DirectionalLight(0xfff1d6, 2.2)
  key.position.set(3, 4, 5)
  scene.add(key)
  const rim = new THREE.PointLight(0xff6f9a, 18, 20)
  rim.position.set(-3, -1, 2)
  scene.add(rim)

  // ---- Ангуштаринҳо (Hopf link: ду ҳалқаи воқеан ба ҳам бандшуда) ----
  const rings = new THREE.Group()
  const gold = new THREE.MeshPhysicalMaterial({ color: 0xf2c879, metalness: 1, roughness: 0.16, clearcoat: 0.6, clearcoatRoughness: 0.2 })
  const roseGold = new THREE.MeshPhysicalMaterial({ color: 0xf0b49a, metalness: 1, roughness: 0.2, clearcoat: 0.5 })
  const torus = new THREE.TorusGeometry(1, 0.12, 48, 180)
  const ringA = new THREE.Mesh(torus, gold)
  ringA.position.x = -0.5
  const ringB = new THREE.Mesh(torus, roseGold)
  ringB.position.x = 0.5
  ringB.rotation.x = Math.PI / 2
  rings.add(ringA, ringB)

  // Алмос болои ҳалқаи тиллоӣ
  const gemHolder = new THREE.Group()
  const gem = new THREE.Mesh(gemGeometry(), new THREE.MeshPhysicalMaterial({
    color: 0xffffff, metalness: 0, roughness: 0, transmission: 1, thickness: 0.4, ior: 2.2,
    iridescence: 0.6, flatShading: true, envMapIntensity: 2.4,
  }))
  gem.position.y = 0.27
  const prongs = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.05, 0.16, 10, 1, true), gold)
  prongs.position.y = 0.08
  gemHolder.add(gem, prongs)
  gemHolder.position.set(-0.5, 1.1, 0)
  rings.add(gemHolder)
  rings.rotation.set(0.35, -0.5, 0.15)
  scene.add(rings)

  // ---- Гулбаргҳо ----
  const PETALS = window.innerWidth < 700 ? 38 : 70
  const petals = new THREE.InstancedMesh(
    petalGeometry(),
    new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: 0.55, metalness: 0, transparent: true, opacity: 0.92 }),
    PETALS,
  )
  const pState = []
  const color = new THREE.Color()
  const spread = { x: 9, y: 5.5 }
  for (let i = 0; i < PETALS; i++) {
    pState.push({
      x: (Math.random() - 0.5) * spread.x * 2,
      y: (Math.random() - 0.5) * spread.y * 2,
      z: -3 + Math.random() * 5,
      rx: Math.random() * 6, ry: Math.random() * 6, rz: Math.random() * 6,
      vr: 0.3 + Math.random() * 0.9,
      fall: 0.18 + Math.random() * 0.32,
      sway: Math.random() * 6,
      s: 0.6 + Math.random() * 0.9,
    })
    petals.setColorAt(i, color.set(PETAL_COLORS[i % PETAL_COLORS.length]))
  }
  scene.add(petals)

  // ---- Гарди тиллоӣ ----
  const DUST = 420
  const dPos = new Float32Array(DUST * 3)
  for (let i = 0; i < DUST; i++) {
    dPos[i * 3] = (Math.random() - 0.5) * 20
    dPos[i * 3 + 1] = (Math.random() - 0.5) * 12
    dPos[i * 3 + 2] = -6 + Math.random() * 8
  }
  const dustGeo = new THREE.BufferGeometry()
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dPos, 3))
  const dustTex = dotTexture()
  const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({
    size: 0.09, map: dustTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: 0xffd99a,
  }))
  scene.add(dust)

  // ---- Андоза ва ҷойгиркунӣ аз рӯи anchor ----
  const target = new THREE.Vector3()
  let ringScale = 1
  const layout = () => {
    const w = container.clientWidth, h = container.clientHeight
    if (!w || !h) return
    renderer.setSize(w, h, false)
    camera.aspect = w / h
    camera.updateProjectionMatrix()
    const halfH = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.position.z
    const halfW = halfH * camera.aspect
    spread.x = halfW + 1
    spread.y = halfH + 1
    const a = getAnchor?.()
    const cr = container.getBoundingClientRect()
    if (a) {
      const r = a.getBoundingClientRect()
      const cx = r.left + r.width / 2 - cr.left, cy = r.top + r.height / 2 - cr.top
      target.set(((cx / w) * 2 - 1) * halfW, (-(cy / h) * 2 + 1) * halfH, 0)
      const ww = (r.width / w) * halfW * 2, wh = (r.height / h) * halfH * 2
      ringScale = Math.max(0.35, Math.min(ww / 3.3, wh / 2.9, 1.35))
    } else {
      target.set(halfW * 0.45, 0, 0)
      ringScale = 1
    }
    rings.position.copy(target)
    rings.scale.setScalar(ringScale)
  }
  const ro = new ResizeObserver(layout)
  ro.observe(container)
  const anchorEl = getAnchor?.()
  if (anchorEl) ro.observe(anchorEl)
  layout()

  // ---- Мушак: параллакс ----
  const mouse = { x: 0, y: 0, tx: 0, ty: 0 }
  const onMove = (e) => {
    mouse.tx = (e.clientX / window.innerWidth) * 2 - 1
    mouse.ty = (e.clientY / window.innerHeight) * 2 - 1
  }
  window.addEventListener('pointermove', onMove, { passive: true })

  // ---- Давр ----
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), pos = new THREE.Vector3(), scl = new THREE.Vector3()
  const clock = new THREE.Clock()
  let raf = 0, visible = true, running = false, t = 0

  const frame = () => {
    const dt = Math.min(clock.getDelta(), 0.05)
    t += dt
    mouse.x += (mouse.tx - mouse.x) * 0.05
    mouse.y += (mouse.ty - mouse.y) * 0.05

    rings.rotation.y = -0.5 + t * 0.35 + mouse.x * 0.35
    rings.rotation.x = 0.35 + Math.sin(t * 0.6) * 0.12 + mouse.y * 0.25
    rings.position.y = target.y + Math.sin(t * 1.1) * 0.08 * ringScale
    gem.rotation.y = t * 1.4
    rim.position.x = -3 + Math.sin(t * 0.7) * 2

    for (let i = 0; i < PETALS; i++) {
      const p = pState[i]
      p.y -= p.fall * dt
      p.x += Math.sin(t * 0.8 + p.sway) * 0.004
      p.rx += p.vr * dt; p.ry += p.vr * 0.7 * dt; p.rz += p.vr * 0.4 * dt
      if (p.y < -spread.y) { p.y = spread.y; p.x = (Math.random() - 0.5) * spread.x * 2 }
      pos.set(p.x, p.y, p.z)
      q.setFromEuler(e.set(p.rx, p.ry, p.rz))
      scl.setScalar(p.s)
      petals.setMatrixAt(i, m.compose(pos, q, scl))
    }
    petals.instanceMatrix.needsUpdate = true

    dust.rotation.y = t * 0.02 + mouse.x * 0.05
    dust.rotation.x = mouse.y * 0.03
    dust.material.opacity = 0.75 + Math.sin(t * 2) * 0.2

    camera.position.x = mouse.x * 0.25
    camera.position.y = -mouse.y * 0.18
    camera.lookAt(0, 0, 0)
    renderer.render(scene, camera)
    running = !reduce && visible
    if (running) raf = requestAnimationFrame(frame)
  }
  const start = () => { if (!running && !reduce) { running = true; clock.getDelta(); raf = requestAnimationFrame(frame) } }
  frame()
  // Агар ҳаракат хомӯш бошад ҳам, як кадри зебо мекашем
  if (reduce) { t = 1.2; frame() }

  let onScreen = true
  const io = new IntersectionObserver(([en]) => {
    onScreen = en.isIntersecting
    visible = onScreen && !document.hidden
    if (visible) start()
  })
  io.observe(container)
  const onVis = () => {
    visible = onScreen && !document.hidden
    if (visible) start()
  }
  document.addEventListener('visibilitychange', onVis)

  requestAnimationFrame(() => container.classList.add('ready'))

  return () => {
    cancelAnimationFrame(raf)
    ro.disconnect(); io.disconnect()
    window.removeEventListener('pointermove', onMove)
    document.removeEventListener('visibilitychange', onVis)
    scene.traverse((o) => {
      o.geometry?.dispose()
      if (o.material) [].concat(o.material).forEach((mt) => mt.dispose())
    })
    dustTex.dispose(); envTex.dispose(); pmrem.dispose()
    renderer.dispose()
    renderer.domElement.remove()
  }
}
