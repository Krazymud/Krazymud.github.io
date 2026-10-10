export interface Swatch {
  id: string
  name: string
  hex: string
  chip?: string
  surface?: { metalness: number; roughness: number }
}

export type ModPart = 'paint' | 'rim' | 'caliper'

export interface Mods {
  paint: Swatch
  rim: Swatch
  caliper: Swatch
}

export const PAINTS: readonly Swatch[] = [
  { id: 'midnight', name: '午夜黑', hex: '#090909' },
  { id: 'red', name: '赛道红', hex: '#8e1018' },
  { id: 'blue', name: '宝石蓝', hex: '#0e2a6b' },
  { id: 'green', name: '墨绿', hex: '#0f3326' },
  { id: 'champagne', name: '香槟金', hex: '#8a7448' },
  { id: 'pearl', name: '珍珠白', hex: '#cfcfca' },
  { id: 'titanium', name: '钛银', hex: '#6b6e73' },
  { id: 'sunset', name: '落日橙', hex: '#b4410f' },
]

// 原厂轮毂是全金属粗糙面，在暗车库里几乎不显色；其余配色换成半金属的亮面才看得出颜色。
const BRIGHT_RIM = { metalness: 0.5, roughness: 0.45 }

// 轮毂颜色乘在贴图上，hex 是系数，chip 才是看上去的颜色。
export const RIMS: readonly Swatch[] = [
  { id: 'gunmetal', name: '枪灰', hex: '#b3b3b8', chip: '#5a5a60' },
  { id: 'silver', name: '亮银', hex: '#ffffff', chip: '#c4c6ca', surface: BRIGHT_RIM },
  { id: 'black', name: '哑黑', hex: '#2a2a2e', chip: '#1d1d20', surface: BRIGHT_RIM },
  { id: 'bronze', name: '古铜', hex: '#b07a48', chip: '#7a5530', surface: BRIGHT_RIM },
  { id: 'gold', name: '香槟金', hex: '#d8b878', chip: '#a88a52', surface: BRIGHT_RIM },
  { id: 'blue', name: '电光蓝', hex: '#6f8fd8', chip: '#34508c', surface: BRIGHT_RIM },
]

export const CALIPERS: readonly Swatch[] = [
  { id: 'red', name: '赛道红', hex: '#9e1c22' },
  { id: 'yellow', name: '黄', hex: '#d8a400' },
  { id: 'blue', name: '蓝', hex: '#1b4fa8' },
  { id: 'black', name: '黑', hex: '#16161a' },
  { id: 'orange', name: '橙', hex: '#d2560f' },
  { id: 'gold', name: '金', hex: '#b08a3e' },
]

export const PALETTES: Record<ModPart, readonly Swatch[]> = { paint: PAINTS, rim: RIMS, caliper: CALIPERS }

export function isSwatchId(part: ModPart, id: unknown): id is string {
  return typeof id === 'string' && PALETTES[part].some((swatch) => swatch.id === id)
}

const pick = (part: ModPart, id: string): Swatch => PALETTES[part].find((swatch) => swatch.id === id) ?? PALETTES[part][0]

export function modsFor(choice: Record<ModPart, string>): Mods {
  return { paint: pick('paint', choice.paint), rim: pick('rim', choice.rim), caliper: pick('caliper', choice.caliper) }
}
