import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useProgress } from '../progress/ProgressProvider'
import { addDays, studyDay } from './day'
import { currentItem, dueOn, ensureSession, isFinished, masteredCount, recordAnswer } from './engine'
import { buildQuestion } from './question'
import type { Grade } from './srs'
import type { ResolvedWord, WordSource } from './wordsRepo'
import { NitroFlash, TrackStreak } from './components/Effects'
import { Gauge } from './components/Gauge'
import { GradeBar } from './components/GradeBar'
import { LoadError } from './components/LoadError'
import { QuestionCard } from './components/QuestionCard'
import { ResultPanel } from './components/ResultPanel'

export const WRONG_DELAY_MS = 1500
export const GRADE_TIMEOUT_MS = 4000
export const NITRO_COMBOS = [5, 10]

interface TrialScreenProps {
  source: WordSource
  now?: () => Date
}

export function TrialScreen({ source, now = () => new Date() }: TrialScreenProps) {
  const { data, update } = useProgress()
  const [today] = useState(() => studyDay(now()))
  const [resolved, setResolved] = useState<Map<string, ResolvedWord> | null>(null)
  const [lookupFailed, setLookupFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [picked, setPicked] = useState<number | null>(null)
  const committedCursor = useRef(-1)

  useEffect(() => {
    update((d) => ensureSession(d, today, source.order, Date.now()))
  }, [update, today, source])

  const session = data.session?.day === today ? data.session : undefined
  const items = session?.items
  const words = useMemo(() => items?.map((item) => item.word) ?? [], [items])

  useEffect(() => {
    if (words.length === 0) return
    let alive = true
    source.lookup(words).then(
      (map) => {
        if (!alive) return
        setResolved(map)
        setLookupFailed(false)
      },
      () => alive && setLookupFailed(true),
    )
    return () => {
      alive = false
    }
  }, [source, words, attempt])

  const item = currentItem(session)
  const cursor = session?.cursor ?? 0
  const question = useMemo(() => {
    const entry = item && resolved?.get(item.word)
    return item && entry ? buildQuestion(entry.word, item.kind, entry.pool, Math.random) : null
  }, [item, resolved])

  const wordMissing = item !== undefined && resolved !== null && !resolved.has(item.word)
  const correct = picked !== null && question !== null && picked === question.answerIndex

  const commit = useCallback(
    (grade: Grade) => {
      if (committedCursor.current === cursor) return
      committedCursor.current = cursor
      update((d) => recordAnswer(d, grade, Date.now()))
      setPicked(null)
    },
    [cursor, update],
  )

  useEffect(() => {
    if (picked === null) return
    const timer = setTimeout(() => commit(correct ? 'ok' : 'again'), correct ? GRADE_TIMEOUT_MS : WRONG_DELAY_MS)
    return () => clearTimeout(timer)
  }, [picked, correct, commit])

  useLayoutEffect(() => {
    if (!question || picked !== null) return
    const onKey = (event: KeyboardEvent) => {
      const n = Number(event.key)
      if (Number.isInteger(n) && n >= 1 && n <= question.options.length) setPicked(n - 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [question, picked])

  if (lookupFailed || wordMissing) {
    return (
      <LoadError
        onRetry={() => {
          setLookupFailed(false)
          setAttempt((n) => n + 1)
        }}
      />
    )
  }
  if (!session) return <p className="text-center text-sm text-muted">正在进站…</p>
  if (isFinished(session)) {
    return (
      <ResultPanel session={session} dueTomorrow={dueOn(data.words, addDays(today, 1))} mastered={masteredCount(data.words)} />
    )
  }
  if (!question) return <p className="text-center text-sm text-muted">正在加载词库…</p>

  const nextCombo = session.combo + 1
  return (
    <section className="flex flex-col items-center">
      {correct && <TrackStreak key={`streak-${cursor}`} />}
      {correct && NITRO_COMBOS.includes(nextCombo) && <NitroFlash key={`nitro-${cursor}`} />}
      <Gauge value={cursor} total={session.items.length} combo={correct ? nextCombo : session.combo} boost={correct} />
      <div className="mt-6 w-full">
        <QuestionCard question={question} picked={picked} onPick={setPicked} />
        {correct && <GradeBar timeoutMs={GRADE_TIMEOUT_MS} onGrade={commit} />}
      </div>
    </section>
  )
}
