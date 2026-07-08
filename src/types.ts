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
  // Provenance when captured via the reader's "Learn" action
  learnedFrom?: { bookId: string; title: string; locator: string } | null
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

export type BookKind = 'pdf' | 'epub' | 'web'

// Metadata lives in localStorage; the raw file bytes live in IndexedDB keyed by id.
export interface BookMeta {
  id: string
  kind: BookKind
  title: string
  author: string
  cover: string | null // data URL
  shelf: string
  addedAt: number
  openedAt: number
  progress: number // 0..1
  locator: string // last position (page number, epub CFI, or scroll %)
  sourceUrl?: string // for web snapshots
}

export interface Highlight {
  id: string
  bookId: string
  color: string
  text: string
  locator: string // page or scroll position
  cfi?: string // epub content fragment identifier, when applicable
  createdAt: number
}

export interface ReadingNote {
  id: string
  bookId: string | null
  bookTitle: string
  author: string
  locator: string
  passage: string
  note: string
  tags: string[]
  learned: boolean // also pushed into the vocab engine
  createdAt: number
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
  font: string
  fontSize: number
  lineHeight: number
  editorZoom: number
  focusMode: boolean
  typewriterMode: boolean
  typingSound: boolean
  autocorrect: boolean
  paperTexture: 'plain' | 'ruled' | 'dotted' | 'linen'
  dailyGoal: number
  // Reader
  readerFont: string
  readerFontSize: number
  readerBg: 'paper' | 'sepia' | 'dark' | 'black'
  readerZoom: number
}

// Curated font library, shared by the writing surface and the reader.
export const FONTS = [
  'Lora', 'Fraunces', 'EB Garamond', 'Merriweather', 'Playfair Display',
  'Source Serif 4', 'Libre Baskerville', 'Crimson Text', 'Inter',
  'Nunito Sans', 'Atkinson Hyperlegible', 'Caveat', 'JetBrains Mono', 'Space Mono',
] as const

export interface AppState {
  notebooks: Notebook[]
  notes: Note[]
  vocab: VocabEntry[]
  stats: DayStats[]
  settings: Settings
  trash: Note[]
  books: BookMeta[]
  highlights: Highlight[]
  readingNotes: ReadingNote[]
}

export const HIGHLIGHT_COLORS = ['#f5e6a3', '#f7c8b8', '#b8e0d2', '#c8d8f0', '#e2c8f0']

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
