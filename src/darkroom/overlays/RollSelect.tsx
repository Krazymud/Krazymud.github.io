import type { FilmRoll } from '../rolls'

export function RollSelect({ rolls, activeRollId, onSelect }: { rolls: FilmRoll[]; activeRollId: string | null; onSelect: (id: string) => void }) {
  return (
    <ul className="flex flex-wrap gap-2 text-xs">
      {rolls.map((roll) => (
        <li key={roll.id}>
          <button
            type="button"
            aria-pressed={roll.id === activeRollId}
            onClick={() => onSelect(roll.id)}
            className="border border-line px-3 py-1 text-fg aria-pressed:bg-accent/30"
          >
            {roll.title}
          </button>
        </li>
      ))}
    </ul>
  )
}
