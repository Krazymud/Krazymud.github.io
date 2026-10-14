import type { AudioClip } from './lib/audio.ts'

// 青庐轻触音：源文件放在 assets-src/audio，由 `npm run audio` 编码进 public/audio。
// 当前线上文件由 ffmpeg 合成写入；有纸木录制时可覆盖同源名源文件再跑脚本。
export const audioConfig: AudioClip[] = [
  { name: 'tap', source: 'tap.mp3', start: 0, end: 0.08, fadeIn: 0, fadeOut: 0.02, loudness: -22 },
  { name: 'confirm', source: 'confirm.mp3', start: 0, end: 0.2, fadeIn: 0, fadeOut: 0.04, loudness: -20 },
  { name: 'unseal', source: 'unseal.mp3', start: 0, end: 0.4, fadeIn: 0.02, fadeOut: 0.08, loudness: -20 },
]
