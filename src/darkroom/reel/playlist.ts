export type PlaylistTrack = { src: string; title: string }

export const SHELL_SONG_TITLES = {
  satie: '《吉诺佩蒂》第一首 · 萨蒂',
  debussy: '《月光》· 德彪西',
  chopin: '《夜曲》作品 37 之 1 · 肖邦',
} as const

/**
 * Public-domain / CC0 piano recordings under public/darkroom/music.
 * See LICENSE.txt for source attribution. Do not ship proprietary gift-site audio.
 */
export const DEFAULT_PLAYLIST: PlaylistTrack[] = [
  { src: '/darkroom/music/satie-gymnopedie-1.mp3', title: SHELL_SONG_TITLES.satie },
  { src: '/darkroom/music/chopin-nocturne-op37-1.mp3', title: SHELL_SONG_TITLES.chopin },
  { src: '/darkroom/music/debussy-clair-de-lune.mp3', title: SHELL_SONG_TITLES.debussy },
]
