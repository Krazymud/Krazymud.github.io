import { describe, expect, it, vi } from 'vitest'
import { instrumentWebGL, isPerfEnabled, perfMark, perfMarks, perfQuality, perfState, programTimings, shaderLabel } from './perf'

describe('perf diagnostics', () => {
  it('turns on only with ?perf in the address', () => {
    expect(isPerfEnabled('?perf')).toBe(true)
    expect(isPerfEnabled('?a=1&perf=1')).toBe(true)
    expect(isPerfEnabled('')).toBe(false)
  })

  it('labels a shader by its name, or else by its first own uniform', () => {
    expect(shaderLabel('#define SHADER_NAME wheel\nvoid main() {}')).toBe('wheel')
    expect(shaderLabel('uniform mat4 modelMatrix;\nuniform sampler2D tDiffuse;')).toBe('?tDiffuse')
    expect(shaderLabel('void main() {}')).toBe('?')
  })

  it('records each mark once, and nothing when switched off', () => {
    perfMark('ignored', false)
    perfMark('first-frame', true)
    perfMark('first-frame', true)
    expect(perfMarks.map((mark) => mark.name)).toEqual(['first-frame'])
  })

  it('charges link and status-query time to the program named by its shader', () => {
    const now = vi.spyOn(performance, 'now')
    let clock = 0
    now.mockImplementation(() => clock)
    const proto = {
      shaderSource: vi.fn(),
      attachShader: vi.fn(),
      linkProgram: vi.fn(() => {
        clock += 5
      }),
      getProgramParameter: vi.fn(() => {
        clock += 30
        return true
      }),
    } as unknown as WebGL2RenderingContext
    instrumentWebGL(proto)
    const shader = {} as WebGLShader
    const program = {} as WebGLProgram
    proto.shaderSource(shader, '#version 300 es\n#define SHADER_NAME body\nvoid main() {}')
    proto.attachShader(program, shader)
    proto.attachShader(program, {} as WebGLShader)
    proto.linkProgram(program)
    expect(proto.getProgramParameter(program, 0x8b82)).toBe(true)
    expect(programTimings).toEqual([{ name: 'body', ms: 35 }])
    now.mockRestore()
  })
})

describe('perfQuality', () => {
  it('shows the current quality and marks every change', () => {
    perfQuality(1, true)
    perfQuality(0, true)
    expect(perfState.quality).toBe('高')
    expect(perfMarks.map((mark) => mark.name).filter((name) => name.startsWith('画质'))).toEqual(['画质：中（1）', '画质：高（2）'])
  })
})
