import { Canvas } from '@react-three/fiber'
import { useEffect, useMemo, useState } from 'react'
import * as THREE from 'three'
import { copy } from '../../config/copy'
import { useDarkroomVault } from '../VaultBridge'
import { SceneErrorBoundary } from '../scene/SceneErrorBoundary'
import { DR_COLORS, DR_FONTS } from '../theme'
import { useReel } from './ReelStage'
import { makeBookCoverBitmap, makeLeatherBumpBitmap, resolveBookTitle } from './bookCoverTex'

export interface BookCoverSceneProps {
  title: string
  byline?: string
  coverPhotoUrl?: string
  onContinue: () => void
}

function BookProps() {
  return (
    <group position={[0.35, 0.02, 0.15]} rotation={[0, -0.15, 0]}>
      <mesh position={[0, 0.004, 0]} rotation={[-Math.PI / 2, 0, 0.35]}>
        <planeGeometry args={[0.14, 0.09]} />
        <meshStandardMaterial color="#f0b81f" roughness={0.75} metalness={0.05} />
      </mesh>
      <mesh position={[-0.12, 0.012, 0.08]} rotation={[-Math.PI / 2, 0, -0.5]}>
        <planeGeometry args={[0.11, 0.075]} />
        <meshStandardMaterial color="#d8d2c8" roughness={0.9} />
      </mesh>
    </group>
  )
}

function BookMesh({
  title,
  byline,
  photo,
}: {
  title: string
  byline?: string
  photo: HTMLImageElement | null
}) {
  const { coverMap, bumpMap } = useMemo(() => {
    const bumpCanvas = makeLeatherBumpBitmap(512)
    const bump = new THREE.CanvasTexture(bumpCanvas)
    bump.wrapS = bump.wrapT = THREE.RepeatWrapping

    const coverCanvas = makeBookCoverBitmap({ title, byline, photo })
    const cover = new THREE.CanvasTexture(coverCanvas)
    cover.colorSpace = THREE.SRGBColorSpace

    return { coverMap: cover, bumpMap: bump }
  }, [title, byline, photo])

  const materials = useMemo(() => {
    return [
      new THREE.MeshStandardMaterial({ color: '#5c3018', roughness: 0.82, metalness: 0.05 }),
      new THREE.MeshStandardMaterial({ color: '#5c3018', roughness: 0.82, metalness: 0.05 }),
      new THREE.MeshStandardMaterial({ color: '#3d2212', roughness: 0.88, metalness: 0.04 }),
      new THREE.MeshStandardMaterial({ color: '#3d2212', roughness: 0.88, metalness: 0.04 }),
      new THREE.MeshStandardMaterial({
        map: coverMap,
        bumpMap,
        bumpScale: 0.018,
        color: '#5c3018',
        roughness: 0.78,
        metalness: 0.06,
      }),
      new THREE.MeshStandardMaterial({ color: '#2a1208', roughness: 0.85, metalness: 0.08 }),
    ]
  }, [coverMap, bumpMap])

  useEffect(() => () => materials.forEach((m) => m.dispose()), [materials])

  return (
    <group position={[0, 0.1, 0]} rotation={[0, -0.35, 0]}>
      <mesh castShadow receiveShadow position={[0, 0, 0]} material={materials}>
        <boxGeometry args={[0.58, 0.09, 0.78]} />
      </mesh>
      <mesh position={[-0.27, 0, 0]} castShadow>
        <boxGeometry args={[0.05, 0.1, 0.78]} />
        <meshStandardMaterial color="#2a1208" roughness={0.85} metalness={0.08} />
      </mesh>
    </group>
  )
}

function BookCoverR3F({
  title,
  byline,
  coverPhotoUrl,
}: {
  title: string
  byline?: string
  coverPhotoUrl?: string
}) {
  const [photo, setPhoto] = useState<HTMLImageElement | null>(null)

  useEffect(() => {
    if (!coverPhotoUrl) {
      setPhoto(null)
      return
    }
    let cancelled = false
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      if (!cancelled) setPhoto(img)
    }
    img.src = coverPhotoUrl
    return () => {
      cancelled = true
    }
  }, [coverPhotoUrl])

  return (
    <>
      <color attach="background" args={['#0b0705']} />
      <hemisphereLight args={['#ffcfa0', '#1a0e08', 0.45]} />
      <spotLight
        position={[1.8, 2.4, 1.2]}
        angle={0.42}
        penumbra={0.35}
        intensity={28}
        color={DR_COLORS.spot}
        castShadow
        shadow-mapSize={[512, 512]}
      />
      <pointLight position={[-1.2, 1.1, -0.6]} intensity={4} color={DR_COLORS.rim} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[3.2, 2.4]} />
        <meshStandardMaterial color={DR_COLORS.woodTint} roughness={0.88} metalness={0.03} />
      </mesh>
      <BookMesh title={title} byline={byline} photo={photo} />
      <BookProps />
    </>
  )
}

function BookCanvas({
  title,
  byline,
  coverPhotoUrl,
  onLost,
}: {
  title: string
  byline?: string
  coverPhotoUrl?: string
  onLost: () => void
}) {
  return (
    <Canvas
      data-testid="book-cover-canvas"
      camera={{ position: [0.55, 0.75, 1.35], fov: 38 }}
      dpr={[1, 2]}
      shadows
      className="h-full w-full"
      gl={{ antialias: true }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping
        gl.toneMappingExposure = 1.05
        gl.outputColorSpace = THREE.SRGBColorSpace
        gl.domElement.addEventListener('webglcontextlost', (event) => {
          event.preventDefault()
          onLost()
        })
      }}
    >
      <BookCoverR3F title={title} byline={byline} coverPhotoUrl={coverPhotoUrl} />
    </Canvas>
  )
}

export function BookCoverScene({ title, byline, coverPhotoUrl, onContinue }: BookCoverSceneProps) {
  const [lost, setLost] = useState(false)

  return (
    <section
      data-testid="book-cover-stage"
      className="relative flex min-h-[58vh] flex-col items-center gap-6 px-4 py-8"
      style={{ background: DR_COLORS.bg, color: DR_COLORS.cream }}
      aria-label="相册封面"
    >
      <header className="text-center" style={{ fontFamily: DR_FONTS.mono }}>
        <p className="text-[10px] uppercase tracking-[0.2em] opacity-55">Scene · 相册</p>
        <h2 className="mt-2 text-2xl" style={{ fontFamily: DR_FONTS.display }}>
          {title}
        </h2>
        {byline ? (
          <p className="mt-1 text-sm opacity-75" style={{ fontFamily: DR_FONTS.hand }}>
            {byline}
          </p>
        ) : null}
      </header>

      <div className="relative h-[min(52vh,480px)] w-full max-w-3xl overflow-hidden rounded-xl border border-[#2a1a12] shadow-[0_16px_48px_rgba(0,0,0,.55)]">
        <SceneErrorBoundary lost={lost}>
          <BookCanvas title={title} byline={byline} coverPhotoUrl={coverPhotoUrl} onLost={() => setLost(true)} />
        </SceneErrorBoundary>
      </div>

      <button
        type="button"
        onClick={onContinue}
        className="border px-8 py-2 text-lg"
        style={{
          fontFamily: DR_FONTS.hand,
          borderColor: DR_COLORS.accent,
          color: DR_COLORS.accent,
          transform: 'rotate(-2deg)',
        }}
      >
        {copy.darkroom.reelContinue} → 片尾
      </button>
    </section>
  )
}

export function BookCoverBeat() {
  const { next } = useReel()
  const { notes, photos, readBlob } = useDarkroomVault()
  const title = resolveBookTitle({ noteTitle: notes[0]?.title })
  const byline = copy.darkroom.creditsSignoff
  const [coverPhotoUrl, setCoverPhotoUrl] = useState<string | undefined>()

  useEffect(() => {
    const thumb = photos[0]?.thumb
    if (!thumb) {
      setCoverPhotoUrl(undefined)
      return
    }
    let cancelled = false
    let objectUrl: string | undefined
    readBlob(thumb)
      .then((bytes) => {
        if (cancelled || !bytes?.length) return
        const blob = new Blob([bytes], { type: 'image/jpeg' })
        objectUrl = URL.createObjectURL(blob)
        setCoverPhotoUrl(objectUrl)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [photos, readBlob])

  return <BookCoverScene title={title} byline={byline} coverPhotoUrl={coverPhotoUrl} onContinue={next} />
}
