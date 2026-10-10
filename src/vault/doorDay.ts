export const DOOR_DAY_KEY = 'midnight-garage/vault-door-day'

export function doorPlayedOn(day: string): boolean {
  try {
    return window.localStorage.getItem(DOOR_DAY_KEY) === day
  } catch {
    return false
  }
}

export function markDoorPlayed(day: string): void {
  try {
    window.localStorage.setItem(DOOR_DAY_KEY, day)
  } catch {
    // 存不下时下次进入会再播一次
  }
}
