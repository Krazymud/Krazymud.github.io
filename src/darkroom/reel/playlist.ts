export type PlaylistTrack = { src: string; title: string }

/**
 * Public-domain / CC0 piano recordings under public/darkroom/music.
 * See LICENSE.txt for source attribution. Do not ship proprietary gift-site audio.
 */
export const DEFAULT_PLAYLIST: PlaylistTrack[] = [
  { src: '/darkroom/music/satie-gymnopedie-1.mp3', title: 'Satie · Gymnopédie No.1' },
  { src: '/darkroom/music/chopin-nocturne-op37-1.mp3', title: 'Chopin · Nocturne Op.37 No.1' },
  { src: '/darkroom/music/debussy-clair-de-lune.mp3', title: 'Debussy · Clair de lune' },
]
