export type VocabType = 'word' | 'phrase' | 'slang' | 'sentence_structure' | 'quote'

export interface Notebook {
  id: string
  name: string
  color: string
  icon: string
}

export interface NoteVersion {
  savedAt: number
  content: string
}

export interface Note {
  id: string
  notebookId: string
  title: string
  content: string // HTML
  tags: string[]
  pinned: boolean
  locked: boolean
  passwordHash?: string
  createdAt: number
  updatedAt: number
  versions: NoteVersion[]
}

export interface VocabEntry {
  id: string
  type: VocabType
  term: string
  meaning: string
  example: string
  source: string
  tags: string[]
  // SM-2 state
  ease: number
  interval: number // days
  reps: number
  due: string // YYYY-MM-DD
  skips: number // consecutive sessions surfaced-but-unused
  surfacedOn: string | null // date last shown in a writing session
  usedOn: string | null // date last detected in writing
  history: { date: string; used: boolean; note?: string }[]
}

export interface DayStats {
  date: string
  words: number
  chars: number
  activeMs: number
}

export interface Settings {
  theme: 'paper' | 'ink'
  accent: 'ink-blue' | 'burgundy' | 'forest'
  font: 'Lora' | 'Fraunces' | 'Inter' | 'Caveat' | 'JetBrains Mono'
  fontSize: number
  lineHeight: number
  focusMode: boolean
  typewriterMode: boolean
  typingSound: boolean
  paperTexture: 'plain' | 'ruled' | 'dotted' | 'linen'
  dailyGoal: number
}

export interface AppState {
  notebooks: Notebook[]
  notes: Note[]
  vocab: VocabEntry[]
  stats: DayStats[]
  settings: Settings
  trash: Note[]
}

export type MaturityBucket = 'New' | 'Learning' | 'Young' | 'Mature'

export function maturity(e: VocabEntry): MaturityBucket {
  if (e.reps === 0) return 'New'
  if (e.interval < 7) return 'Learning'
  if (e.interval < 21) return 'Young'
  return 'Mature'
}

export function today(): string {
  return new Date().toISOString().slice(0, 10)
}

export function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
}
