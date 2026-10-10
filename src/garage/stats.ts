import type { ProgressData } from '../progress/store'
import { addDays } from '../trial/day'
import { dueOn, masteredCount } from '../trial/engine'

export interface GarageStats {
  streak: number
  week: boolean[]
  todayDone: boolean
  mastered: number
  due: number
}

export function garageStats(data: ProgressData, today: string): GarageStats {
  const done = new Set(data.history.map((stat) => stat.day))
  const todayDone = done.has(today)
  let streak = 0
  for (let day = todayDone ? today : addDays(today, -1); done.has(day); day = addDays(day, -1)) streak++
  const week = Array.from({ length: 7 }, (_, i) => done.has(addDays(today, i - 6)))
  return { streak, week, todayDone, mastered: masteredCount(data.words), due: dueOn(data.words, today) }
}
