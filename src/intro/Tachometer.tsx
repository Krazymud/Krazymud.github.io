const SWEEP_DEG = 240
const START_DEG = -120
const MAX_RPM = 8
const REDLINE = 7

function polar(deg: number, radius: number): [number, number] {
  const rad = ((deg - 90) * Math.PI) / 180
  return [100 + radius * Math.cos(rad), 100 + radius * Math.sin(rad)]
}

function arc(fromDeg: number, toDeg: number, radius: number): string {
  const [x1, y1] = polar(fromDeg, radius)
  const [x2, y2] = polar(toDeg, radius)
  return `M ${x1} ${y1} A ${radius} ${radius} 0 ${toDeg - fromDeg > 180 ? 1 : 0} 1 ${x2} ${y2}`
}

interface TachometerProps {
  value: number
  animate: boolean
}

export function Tachometer({ value, animate }: TachometerProps) {
  const clamped = Math.min(Math.max(value, 0), 1)
  const redFrom = START_DEG + (SWEEP_DEG * REDLINE) / MAX_RPM
  return (
    <svg viewBox="0 0 200 200" className="h-56 w-56" aria-hidden>
      <path d={arc(START_DEG, redFrom, 80)} fill="none" stroke="var(--color-line)" strokeWidth="6" />
      <path d={arc(redFrom, START_DEG + SWEEP_DEG, 80)} fill="none" stroke="var(--accent-hi)" strokeWidth="6" />
      {Array.from({ length: MAX_RPM + 1 }, (_, rpm) => {
        const deg = START_DEG + (SWEEP_DEG * rpm) / MAX_RPM
        const [x1, y1] = polar(deg, 68)
        const [x2, y2] = polar(deg, 76)
        const [tx, ty] = polar(deg, 56)
        return (
          <g key={rpm}>
            <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="currentColor" strokeWidth="2" />
            <text x={tx} y={ty} textAnchor="middle" dominantBaseline="central" className="fill-current font-display text-[11px]">
              {rpm}
            </text>
          </g>
        )
      })}
      <g
        style={{
          transform: `rotate(${START_DEG + SWEEP_DEG * clamped}deg)`,
          transformOrigin: '100px 100px',
          transition: animate ? 'transform 300ms ease-out' : 'none',
        }}
      >
        <line x1="100" y1="100" x2="100" y2="34" stroke="var(--accent-hi)" strokeWidth="3" strokeLinecap="round" />
      </g>
      <circle cx="100" cy="100" r="6" fill="var(--accent-hi)" />
      <text x="100" y="150" textAnchor="middle" className="fill-current font-display text-[10px] tracking-[0.3em]">
        ×1000 RPM
      </text>
    </svg>
  )
}
