import { useEffect, useRef, useState } from 'react'
import type { AppState, Note, Notebook, Settings, VocabEntry, VocabType } from './types'
import { today, uid } from './types'
import { settleSkips } from './sm2'

const KEY = 'inkwell-state-v1'

export const defaultSettings: Settings = {
  theme: 'paper',
  accent: 'ink-blue',
  font: 'Lora',
  fontSize: 19,
  lineHeight: 1.75,
  editorZoom: 1,
  focusMode: false,
  typewriterMode: false,
  typingSound: false,
  autocorrect: true,
  paperTexture: 'plain',
  dailyGoal: 500,
  readerFont: 'Lora',
  readerFontSize: 20,
  readerBg: 'paper',
  readerZoom: 1,
}

export function newVocab(partial: Partial<VocabEntry>): VocabEntry {
  return {
    id: uid(),
    type: (partial.type || 'word') as VocabType,
    term: partial.term || '',
    meaning: partial.meaning || '',
    example: partial.example || '',
    source: partial.source || '',
    tags: partial.tags || [],
    learnedFrom: partial.learnedFrom ?? null,
    ease: 2.5,
    interval: 0,
    reps: 0,
    due: today(),
    skips: 0,
    surfacedOn: null,
    usedOn: null,
    history: [],
  }
}

export function newNote(notebookId: string): Note {
  return {
    id: uid(),
    notebookId,
    title: '',
    content: '',
    tags: [],
    pinned: false,
    locked: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    versions: [],
  }
}

function seed(): AppState {
  const nb: Notebook = { id: uid(), name: 'My Notebook', color: '#3b5b8c', icon: '📓' }
  const welcome: Note = {
    ...newNote(nb.id),
    title: 'Welcome to Inkwell',
    content:
      '<p>This is your writing hub. Everything lives on your device.</p><p><b>The vocabulary constellation</b> along the top shows words due today — use one naturally in your writing and watch it light up. The spaced-repetition engine (SM-2, Anki-style) grades you on <i>real usage</i>, not flashcard taps.</p><p>Add words in the <b>Vocabulary</b> tab — one at a time, or bulk-paste in the <code>type / term / meaning</code> format separated by <code>---</code>.</p><p>Try the toggles in the top bar: Focus mode, Typewriter mode, themes, fonts. Happy writing. 🖋️</p>',
  }
  const vocab = [
    newVocab({ type: 'word', term: 'ephemeral', meaning: 'lasting for a very short time', example: 'Fame like his is ephemeral, gone by next season.', tags: ['descriptive', 'literary'] }),
    newVocab({ type: 'sentence_structure', term: 'Not only... but also...', meaning: 'emphasizes two connected points, the second one stronger', example: 'Not only did she finish the marathon, but also set a personal record.', tags: ['structure', 'emphasis'] }),
    newVocab({ type: 'quote', term: 'The unexamined life is not worth living.', meaning: 'reflection and self-awareness give life meaning', source: 'Socrates', example: '' }),
    newVocab({ type: 'word', term: 'luminous', meaning: 'full of or shedding light; bright, shining', example: 'The luminous prose carried the chapter.', tags: ['descriptive'] }),
    newVocab({ type: 'phrase', term: 'in light of', meaning: 'taking something into consideration', example: 'In light of the new evidence, the theory needed revision.', tags: ['transition'] }),
  ]
  return {
    notebooks: [nb],
    notes: [welcome],
    vocab,
    stats: [],
    settings: defaultSettings,
    trash: [],
    books: [],
    highlights: [],
    readingNotes: [],
  }
}

export function loadState(): AppState {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return seed()
    const s = JSON.parse(raw) as AppState
    s.settings = { ...defaultSettings, ...s.settings }
    s.trash = s.trash || []
    s.books = s.books || []
    s.highlights = s.highlights || []
    s.readingNotes = s.readingNotes || []
    // purge trash older than 30 days
    const cutoff = Date.now() - 30 * 24 * 3600 * 1000
    s.trash = s.trash.filter((n) => n.updatedAt > cutoff)
    s.vocab = settleSkips(s.vocab)
    return s
  } catch {
    return seed()
  }
}

export function useAppState() {
  const [state, setState] = useState<AppState>(loadState)
  const timer = useRef<number | undefined>(undefined)
  useEffect(() => {
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => {
      try {
        localStorage.setItem(KEY, JSON.stringify(state))
      } catch {
        /* storage full — skip */
      }
    }, 400)
    return () => window.clearTimeout(timer.current)
  }, [state])
  return [state, setState] as const
}

export async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export function htmlToText(html: string): string {
  const div = document.createElement('div')
  div.innerHTML = html
  return div.innerText || ''
}

export function countWords(text: string): number {
  return text.split(/\s+/).filter((w) => /\w/.test(w)).length
}

export function htmlToMarkdown(html: string): string {
  let md = html
    .replace(/<h1[^>]*>(.*?)<\/h1>/gi, '\n# $1\n')
    .replace(/<h2[^>]*>(.*?)<\/h2>/gi, '\n## $1\n')
    .replace(/<h3[^>]*>(.*?)<\/h3>/gi, '\n### $1\n')
    .replace(/<(b|strong)[^>]*>(.*?)<\/\1>/gi, '**$2**')
    .replace(/<(i|em)[^>]*>(.*?)<\/\1>/gi, '*$2*')
    .replace(/<(s|strike)[^>]*>(.*?)<\/\1>/gi, '~~$2~~')
    .replace(/<code[^>]*>(.*?)<\/code>/gi, '`$1`')
    .replace(/<blockquote[^>]*>(.*?)<\/blockquote>/gis, (_, c) => '\n> ' + c.replace(/<[^>]+>/g, '') + '\n')
    .replace(/<li[^>]*>(.*?)<\/li>/gi, '\n- $1')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|ul|ol)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
  const ta = document.createElement('textarea')
  ta.innerHTML = md
  md = ta.value
  return md.replace(/\n{3,}/g, '\n\n').trim()
}

export function download(filename: string, content: string, mime = 'text/plain') {
  const blob = new Blob([content], { type: mime })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
  URL.revokeObjectURL(a.href)
}
