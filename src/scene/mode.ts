export type SceneMode = '3d' | 'still'

export interface ModeInputs {
  reducedMotion: boolean
  webgl2: boolean
  enabled: boolean
  failed: boolean
}

export function sceneMode({ reducedMotion, webgl2, enabled, failed }: ModeInputs): SceneMode {
  return !reducedMotion && webgl2 && enabled && !failed ? '3d' : 'still'
}

let webgl2: boolean | null = null

function detectWebGL2(): boolean {
  if (typeof WebGL2RenderingContext === 'undefined') return false
  try {
    const gl = document.createElement('canvas').getContext('webgl2')
    if (!gl) return false
    gl.getExtension('WEBGL_lose_context')?.loseContext()
    return true
  } catch {
    return false
  }
}

export function supportsWebGL2(): boolean {
  webgl2 ??= detectWebGL2()
  return webgl2
}

export function resetWebGL2Cache(): void {
  webgl2 = null
}

let failed = false

export function markSceneFailed(): void {
  failed = true
}

export function sceneFailed(): boolean {
  return failed
}

export function resetSceneFailure(): void {
  failed = false
}
