export type Scene = 'garage' | 'track' | 'vault'

function CarSilhouette() {
  return (
    <svg viewBox="0 0 400 120" className="absolute bottom-[14%] left-1/2 w-[min(92vw,520px)] -translate-x-1/2 opacity-40">
      <path d="M20 88 L40 70 L120 60 L170 40 L240 34 L300 46 L360 60 L385 72 L388 88 Z" fill="#131315" stroke="#2a2a2e" />
      <path d="M172 44 L238 38 L282 51 L186 57 Z" fill="#09090b" stroke="#36363c" strokeWidth="0.8" />
      <path d="M60 79 L345 70" stroke="var(--accent)" strokeWidth="1.2" />
      <path d="M362 64 L384 71" stroke="var(--accent-hi)" strokeWidth="2.2" />
      <circle cx="95" cy="88" r="20" fill="#0a0a0b" stroke="var(--accent)" strokeWidth="1.8" />
      <circle cx="310" cy="88" r="20" fill="#0a0a0b" stroke="var(--accent)" strokeWidth="1.8" />
      <ellipse cx="200" cy="112" rx="170" ry="5" fill="var(--accent)" opacity="0.15" />
    </svg>
  )
}

function TrackLines() {
  return (
    <svg viewBox="0 0 240 480" preserveAspectRatio="none" className="absolute inset-x-0 bottom-0 h-[55%] w-full opacity-60">
      <path d="M108 0 L0 480 M132 0 L240 480" stroke="#2a2a2e" strokeWidth="2" />
      <path d="M120 10 L120 40 M120 80 L120 140 M120 200 L120 300 M120 360 L120 480" stroke="var(--accent)" strokeWidth="3" />
    </svg>
  )
}

export function GarageBackdrop({ scene }: { scene: Scene }) {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 overflow-hidden"
      style={{ background: 'radial-gradient(ellipse 70% 50% at 50% 30%, #1f1f22 0%, #0a0a0c 60%, #050506 100%)' }}
    >
      {scene === 'track' ? <TrackLines /> : <CarSilhouette />}
    </div>
  )
}
