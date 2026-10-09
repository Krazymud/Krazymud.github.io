import type { Question } from '../question'
import { SpeakButton } from './SpeakButton'

type OptionState = 'idle' | 'right' | 'wrong' | 'dim'

const OPTION_CLASS: Record<OptionState, string> = {
  idle: 'border-line bg-panel/90 hover:border-accent',
  right: 'border-accent-hi bg-accent/25 text-white',
  wrong: 'border-line bg-panel/90 line-through opacity-60',
  dim: 'border-line bg-panel/90 opacity-40',
}

interface QuestionCardProps {
  question: Question
  picked: number | null
  onPick: (index: number) => void
}

export function QuestionCard({ question, picked, onPick }: QuestionCardProps) {
  const { word, direction, options, answerIndex } = question
  const revealed = picked !== null
  const showWord = direction === 'en2zh' || revealed

  return (
    <div className="w-full">
      <div className="min-h-28 text-center">
        {direction === 'zh2en' && <p className="text-lg leading-relaxed">{word.m}</p>}
        {showWord && (
          <>
            <div className="mt-2 flex items-center justify-center gap-2">
              <h2 className="font-display text-4xl font-bold tracking-wide">{word.w}</h2>
              <SpeakButton text={word.w} />
            </div>
            {word.p && <p className="mt-1 text-sm text-muted">/{word.p}/</p>}
          </>
        )}
      </div>
      <ol className="mt-6 grid gap-2">
        {options.map((option, i) => {
          const state: OptionState = !revealed ? 'idle' : i === answerIndex ? 'right' : i === picked ? 'wrong' : 'dim'
          return (
            <li key={option.w}>
              <button
                type="button"
                disabled={revealed}
                onClick={() => onPick(i)}
                className={`w-full border px-4 py-3 text-left text-sm transition-colors ${OPTION_CLASS[state]}`}
              >
                <span className="mr-3 font-display text-muted">{i + 1}</span>
                {direction === 'en2zh' ? option.m : option.w}
              </button>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
