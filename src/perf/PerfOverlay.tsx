import { useEffect, useState } from 'react'
import { perfMarks, perfState, programTimings } from './perf'

const REFRESH_MS = 500
const TOP_PROGRAMS = 10
const TOP_FILES = 8

function parallelCompile(): string {
  const gl = document.createElement('canvas').getContext('webgl2')
  const supported = gl?.getExtension('KHR_parallel_shader_compile') != null
  gl?.getExtension('WEBGL_lose_context')?.loseContext()
  return gl ? (supported ? '有' : '无') : '无 WebGL2'
}

const ms = (value: number) => `${Math.round(value)}ms`
const kb = (bytes: number) => `${Math.round(bytes / 1024)}KB`

export function PerfOverlay() {
  const [, setTick] = useState(0)
  const [parallel] = useState(parallelCompile)

  useEffect(() => {
    const id = window.setInterval(() => setTick((tick) => tick + 1), REFRESH_MS)
    return () => window.clearInterval(id)
  }, [])

  const browser = /MicroMessenger/i.test(navigator.userAgent) ? '微信' : /CriOS|Chrome/i.test(navigator.userAgent) ? 'Chrome' : 'Safari/其他'
  const files = (performance.getEntriesByType('resource') as PerformanceResourceTiming[])
    .filter((entry) => /\.(glb|webp|js|mp3)(\?|$)/.test(entry.name))
    .sort((a, b) => b.duration - a.duration)
  const programs = [...programTimings].sort((a, b) => b.ms - a.ms)
  const compileTotal = programs.reduce((sum, program) => sum + program.ms, 0)

  return (
    <pre
      aria-hidden
      className="pointer-events-none fixed left-1 top-10 z-[60] max-h-[80dvh] max-w-[95vw] overflow-hidden whitespace-pre-wrap bg-black/80 p-2 font-mono text-[10px] leading-tight text-lime-300"
    >
      {[
        `${browser} · 并行编译扩展：${parallel} · dpr ${window.devicePixelRatio}`,
        `画质：${perfState.quality || '—'}`,
        '— 时间点（自页面打开）',
        ...perfMarks.map((mark) => `${mark.name}  ${ms(mark.at)}`),
        `— 着色器 ${programs.length} 个，阻塞合计 ${ms(compileTotal)}`,
        ...programs.slice(0, TOP_PROGRAMS).map((program) => `${ms(program.ms).padStart(7)}  ${program.name}`),
        `— 下载（共 ${files.length} 个，耗时前 ${TOP_FILES}）`,
        ...files
          .slice(0, TOP_FILES)
          .map((entry) => `${ms(entry.duration).padStart(7)}  ${kb(entry.transferSize).padStart(6)}  ${entry.name.split('/').pop()?.split('?')[0]}`),
      ].join('\n')}
    </pre>
  )
}
