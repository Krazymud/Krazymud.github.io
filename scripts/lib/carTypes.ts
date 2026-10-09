export class CarError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'CarError'
  }
}

export type Role = 'body' | 'wheel' | 'caliper' | 'glass' | 'tire' | 'shadow'

export interface RoleRule {
  role: Role
  mesh: RegExp
}

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

export interface AtlasConfig {
  diffuse: string
  specularGlossiness: string
  occlusion: string
  paintSpecular: [number, number, number]
  paintTolerance: number
  plate: Rect
  plateText: string
  taillights: Rect
  outputSize: [number, number]
}

export interface CarConfig {
  remove: RegExp[]
  roles: RoleRule[]
  wheels: Record<'FL' | 'FR' | 'BL' | 'BR', string>
  atlas: AtlasConfig
  tireNormal: string
  tireOcclusion: string
  shadowTexture: string
  textureMaxSize: number
  targetLength: number
  maxBytes: number
}
