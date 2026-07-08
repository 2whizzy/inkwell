export type Mode = 'standard' | 'scaffold' | 'split' | 'flash' | 'audio' | 'highlight' | 'swipe'

export interface Step {
  label: string
  answer: string
}

export interface Problem {
  display: string
  /** Colored segments for 'highlight' mode; falls back to display. */
  parts?: { text: string; color?: 'blue' | 'green' }[]
  /** Text read aloud in 'audio' mode. */
  speech?: string
  answer: string
  /** Sequential sub-inputs for 'scaffold' mode; the last step completes the question. */
  steps?: Step[]
  /** 'split' mode: [lead, middle-answer, tail] e.g. 2 [5] 3 for 23×11. */
  split?: { lead: string; middle: string; tail: string }
  /** 'swipe' mode: whether the shortcut applies (swipe right = yes). */
  valid?: boolean
}

export interface LevelDef {
  id: string
  name: string
  desc: string
  mode: Mode
  /** Consecutive correct answers required to clear the level. */
  streak: number
  /** Seconds per question; null = untimed. In 'audio' mode the clock starts when speech ends. */
  timeLimit: number | null
  /** 'flash' mode: how long the equation stays visible before fading. */
  flashSeconds?: number
  gen: () => Problem
}

/** Parent-editable per-level tuning. Any field left undefined falls back to the built-in value. */
export interface LevelOverride {
  streak?: number
  timeLimit?: number | null
  flashSeconds?: number
}

export interface WorldDef {
  id: string
  name: string
  emoji: string
  color: string
  rule: string
  example: { prompt: string; steps: string[]; answer: string }
  levels: LevelDef[]
}
