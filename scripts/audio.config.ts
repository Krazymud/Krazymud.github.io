import type { AudioClip } from './lib/audio.ts'

// assets-src/audio 里的源文件（Freesound，均为 CC0）：
// ignition.mp3 = #659560 EwanPenman11「Ferrari start up and drive off」
// rev.mp3 = #478756 richwise「Supercar rev」
// unlock.mp3 = #396448 hz37「Car Lock」
export const audioConfig: AudioClip[] = [
  { name: 'ignition', source: 'ignition.mp3', start: 20.3, end: 28.6, fadeIn: 0.05, fadeOut: 0.6, loudness: -16 },
  { name: 'rev', source: 'rev.mp3', start: 6.0, end: 8.9, fadeIn: 0.03, fadeOut: 0.4, loudness: -16 },
  { name: 'blip', source: 'rev.mp3', start: 10.0, end: 11.2, fadeIn: 0.03, fadeOut: 0.3, loudness: -18 },
  { name: 'unlock', source: 'unlock.mp3', start: 0, end: 0.6, fadeIn: 0, fadeOut: 0.05, loudness: -20 },
]
