export type PlaylistTrack = { src: string; title: string }

/** Placeholder tones under public/darkroom/music — replace with PD recordings per LICENSE. */
export const DEFAULT_PLAYLIST: PlaylistTrack[] = [
  { src: '/darkroom/music/tone-a.mp3', title: '测试曲 A' },
  { src: '/darkroom/music/tone-b.mp3', title: '测试曲 B' },
  { src: '/darkroom/music/tone-c.mp3', title: '测试曲 C' },
]
