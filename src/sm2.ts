import type { VocabEntry } from './types'
import { today } from './types'

// Standard SM-2. quality: 5 = used naturally, 4 = used (manual), 3 = shown but
// not used ("Hard"), 2 = repeatedly skipped ("Again", resets).
export function gradeEntry(e: VocabEntry, quality: 2 | 3 | 4 | 5): VocabEntry {
  let { ease, interval, reps } = e
  if (quality < 3) {
    reps = 0
    interval = 1
  } else {
    if (reps === 0) interval = 1
    else if (reps === 1) interval = 6
    else interval = Math.round(interval * ease)
    reps += 1
  }
  ease = Math.max(1.3, ease + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)))
  const due = new Date()
  due.setDate(due.getDate() + interval)
  return { ...e, ease, interval, reps, due: due.toISOString().slice(0, 10) }
}

export function isDue(e: VocabEntry): boolean {
  return e.due <= today()
}

// Today's queue: due reviews first (oldest due date first, lowest ease first),
// then a handful of new entries — same balancing philosophy as Anki.
export function dueQueue(vocab: VocabEntry[], newPerDay = 4, max = 10): VocabEntry[] {
  const reviews = vocab
    .filter((e) => e.reps > 0 && isDue(e))
    .sort((a, b) => a.due.localeCompare(b.due) || a.ease - b.ease)
  const fresh = vocab
    .filter((e) => e.reps === 0)
    .sort((a, b) => b.skips - a.skips)
    .slice(0, newPerDay)
  return [...reviews, ...fresh].slice(0, max)
}

// Settle yesterday's book-keeping: anything surfaced on a previous day that
// was never used gets graded down. Called once on load.
export function settleSkips(vocab: VocabEntry[]): VocabEntry[] {
  const t = today()
  return vocab.map((e) => {
    if (!e.surfacedOn || e.surfacedOn >= t) return e
    if (e.usedOn === e.surfacedOn) return e
    const skips = e.skips + 1
    const graded = gradeEntry({ ...e, skips }, skips >= 3 ? 2 : 3)
    return {
      ...graded,
      skips,
      surfacedOn: null,
      history: [...e.history, { date: e.surfacedOn, used: false }],
    }
  })
}
