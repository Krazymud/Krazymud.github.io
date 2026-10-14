import type { Scene } from './types'

export function sceneFor(pathname: string): Scene {
  const segment = pathname.split('/')[1]
  if (segment === 'vault') return 'vault'
  if (segment === 'trial') return 'track'
  if (segment === 'settings') return 'settings'
  return 'garage'
}
