export interface PerfMark {
  name: string
  at: number
}

export interface ProgramTiming {
  name: string
  ms: number
}

export function isPerfEnabled(search: string): boolean {
  return new URLSearchParams(search).has('perf')
}

export const perfEnabled = typeof window !== 'undefined' && isPerfEnabled(window.location.search)

export const perfMarks: PerfMark[] = []
export const programTimings: ProgramTiming[] = []

export function perfMark(name: string, enabled = perfEnabled): void {
  if (!enabled || perfMarks.some((mark) => mark.name === name)) return
  perfMarks.push({ name, at: performance.now() })
}

type GL = WebGL2RenderingContext

const BUILT_IN_UNIFORMS = new Set(['modelMatrix', 'modelViewMatrix', 'projectionMatrix', 'viewMatrix', 'normalMatrix', 'cameraPosition', 'isOrthographic'])

export function shaderLabel(source: string): string {
  const named = /#define SHADER_NAME (.+)/.exec(source)
  if (named) return named[1].trim()
  for (const [, name] of source.matchAll(/uniform\s+\w+\s+(\w+)/g)) {
    if (!BUILT_IN_UNIFORMS.has(name)) return `?${name}`
  }
  return '?'
}

// 着色器编译在驱动里异步进行，真正卡住主线程的是之后第一次查询链接状态，所以把这几个调用的耗时都记到对应的程序上。
export function instrumentWebGL(proto: GL = WebGL2RenderingContext.prototype): void {
  const shaderNames = new WeakMap<WebGLShader, string>()
  const timings = new WeakMap<WebGLProgram, ProgramTiming>()
  const { shaderSource, attachShader, linkProgram, getProgramParameter } = proto

  proto.shaderSource = function (this: GL, shader: WebGLShader, source: string) {
    shaderNames.set(shader, shaderLabel(source))
    return shaderSource.call(this, shader, source)
  }
  proto.attachShader = function (this: GL, program: WebGLProgram, shader: WebGLShader) {
    const label = shaderNames.get(shader) ?? '?'
    const timing = timings.get(program)
    if (!timing) {
      const created = { name: label, ms: 0 }
      timings.set(program, created)
      programTimings.push(created)
    } else if (timing.name.startsWith('?') && label !== '?') {
      timing.name = label
    }
    return attachShader.call(this, program, shader)
  }
  const timed = <A extends unknown[], R>(call: (this: GL, program: WebGLProgram, ...rest: A) => R) =>
    function (this: GL, program: WebGLProgram, ...rest: A): R {
      const start = performance.now()
      const result = call.call(this, program, ...rest)
      const timing = timings.get(program)
      if (timing) timing.ms += performance.now() - start
      return result
    }
  proto.linkProgram = timed(linkProgram)
  proto.getProgramParameter = timed(getProgramParameter)
}
