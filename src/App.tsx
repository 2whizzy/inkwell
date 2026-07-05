import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { today, uid } from './types'
import { dueQueue, gradeEntry } from './sm2'
import { detectUsage } from './matcher'
import {
  countWords, download, htmlToMarkdown, htmlToText, newNote, sha256, useAppState,
} from './store'
import { Editor } from './components/Editor'
import { Sidebar } from './components/Sidebar'
import { Constellation } from './components/Constellation'
import { VocabView } from './components/VocabView'
import { StatsView } from './components/StatsView'
import { Toggle } from './components/Toggle'

type View = 'write' | 'vocab' | 'stats'

const NB_COLORS = ['#3b5b8c', '#7a2f3f', '#2f5d3f', '#8c6a3b', '#5d3b8c']
const NB_ICONS = ['📓', '📔', '📕', '📗', '📘', '📙']

export default function App() {
  const [state, setState] = useAppState()
  const [view, setView] = useState<View>('write')
  const [activeId, setActiveId] = useState<string | null>(state.notes[0]?.id || null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [unlockedIds, setUnlockedIds] = useState<Set<string>>(new Set())
  const wordsBefore = useRef<Map<string, number>>(new Map())

  const { settings } = state
  const activeNote = state.notes.find((n) => n.id === activeId) || null
  const noteIsLocked = !!activeNote?.locked && !unlockedIds.has(activeNote.id)

  const queue = useMemo(() => dueQueue(state.vocab), [state.vocab])
  const t = today()
  const usedIds = useMemo(
    () => new Set(state.vocab.filter((e) => e.usedOn === t).map((e) => e.id)),
    [state.vocab, t],
  )

  // Mark queue entries as surfaced today.
  useEffect(() => {
    const ids = new Set(queue.filter((e) => e.surfacedOn !== t && e.usedOn !== t).map((e) => e.id))
    if (ids.size === 0) return
    setState((s) => ({
      ...s,
      vocab: s.vocab.map((e) => (ids.has(e.id) ? { ...e, surfacedOn: t } : e)),
    }))
  }, [queue, t, setState])

  useEffect(() => {
    document.documentElement.dataset.theme = settings.theme
    document.documentElement.dataset.accent = settings.accent
  }, [settings.theme, settings.accent])

  // Usage detection, debounced against the current note text.
  const detectTimer = useRef<number | undefined>(undefined)
  const runDetection = useCallback(
    (noteText: string, noteTitle: string) => {
      window.clearTimeout(detectTimer.current)
      detectTimer.current = window.setTimeout(() => {
        setState((s) => {
          const due = dueQueue(s.vocab)
          let changed = false
          const vocab = s.vocab.map((e) => {
            if (!due.some((d) => d.id === e.id)) return e
            if (e.usedOn === t) return e
            if (!detectUsage(noteText, e)) return e
            changed = true
            const graded = gradeEntry(e, 5)
            return {
              ...graded,
              usedOn: t,
              skips: 0,
              surfacedOn: null,
              history: [...e.history, { date: t, used: true, note: noteTitle || 'Untitled' }],
            }
          })
          return changed ? { ...s, vocab } : s
        })
      }, 1200)
    },
    [setState, t],
  )

  type Day = (typeof state.stats)[0]
  function upsertDay(stats: Day[], date: string, fn: (d: Day) => Day): Day[] {
    const existing = stats.find((d) => d.date === date)
    if (existing) return stats.map((d) => (d.date === date ? fn(d) : d))
    return [...stats, fn({ date, words: 0, chars: 0, activeMs: 0 })]
  }

  function updateNote(content: string, title: string) {
    if (!activeNote) return
    const text = htmlToText(content)
    const words = countWords(text)
    const prev = wordsBefore.current.get(activeNote.id) ?? countWords(htmlToText(activeNote.content))
    const delta = words - prev
    wordsBefore.current.set(activeNote.id, words)
    setState((s) => ({
      ...s,
      notes: s.notes.map((n) =>
        n.id === activeNote.id ? { ...n, content, title, updatedAt: Date.now() } : n,
      ),
      stats: delta > 0 ? upsertDay(s.stats, t, (d) => ({ ...d, words: d.words + delta })) : s.stats,
    }))
    runDetection(text + ' ' + title, title)
  }

  function onTyping(chars: number, deltaMs: number) {
    setState((s) => ({
      ...s,
      stats: upsertDay(s.stats, t, (d) => ({
        ...d,
        chars: d.chars + chars,
        activeMs: d.activeMs + deltaMs,
      })),
    }))
  }

  // Version snapshot when leaving a note (if meaningfully changed).
  function snapshotVersion() {
    if (!activeNote) return
    setState((s) => ({
      ...s,
      notes: s.notes.map((n) => {
        if (n.id !== activeNote.id) return n
        const last = n.versions[n.versions.length - 1]
        if ((last && last.content === n.content) || !n.content.trim()) return n
        return {
          ...n,
          versions: [...n.versions, { savedAt: Date.now(), content: n.content }].slice(-15),
        }
      }),
    }))
  }

  function selectNote(id: string) {
    snapshotVersion()
    setActiveId(id)
    setView('write')
    setSidebarOpen(false)
  }

  function addNote(notebookId: string) {
    const n = newNote(notebookId)
    setState((s) => ({ ...s, notes: [...s.notes, n] }))
    snapshotVersion()
    setActiveId(n.id)
    setView('write')
    setSidebarOpen(false)
  }

  function addNotebook() {
    const name = prompt('Notebook name')
    if (!name?.trim()) return
    const i = state.notebooks.length
    setState((s) => ({
      ...s,
      notebooks: [
        ...s.notebooks,
        { id: uid(), name: name.trim(), color: NB_COLORS[i % NB_COLORS.length], icon: NB_ICONS[i % NB_ICONS.length] },
      ],
    }))
  }

  function deleteNote(id: string) {
    setState((s) => {
      const note = s.notes.find((n) => n.id === id)
      return {
        ...s,
        notes: s.notes.filter((n) => n.id !== id),
        trash: note ? [...s.trash, { ...note, updatedAt: Date.now() }] : s.trash,
      }
    })
    if (activeId === id) setActiveId(state.notes.find((n) => n.id !== id)?.id || null)
  }

  async function toggleLock() {
    if (!activeNote) return
    if (activeNote.locked) {
      const pw = prompt('Enter password to remove lock')
      if (pw === null) return
      if ((await sha256(pw)) !== activeNote.passwordHash) { alert('Wrong password'); return }
      setState((s) => ({
        ...s,
        notes: s.notes.map((n) => (n.id === activeNote.id ? { ...n, locked: false, passwordHash: undefined } : n)),
      }))
    } else {
      const pw = prompt('Set a password for this note')
      if (!pw) return
      const hash = await sha256(pw)
      setState((s) => ({
        ...s,
        notes: s.notes.map((n) => (n.id === activeNote.id ? { ...n, locked: true, passwordHash: hash } : n)),
      }))
      setUnlockedIds((ids) => new Set([...ids, activeNote.id]))
    }
  }

  async function unlock() {
    if (!activeNote) return
    const pw = prompt('Password')
    if (pw === null) return
    if ((await sha256(pw)) === activeNote.passwordHash) {
      setUnlockedIds((ids) => new Set([...ids, activeNote.id]))
    } else alert('Wrong password')
  }

  const quoteOfDay = useMemo(() => {
    const quotes = state.vocab.filter((e) => e.type === 'quote')
    if (!quotes.length) return null
    return quotes[Math.floor(Date.now() / 86400000) % quotes.length]
  }, [state.vocab])

  const lockedIds = useMemo(
    () => new Set(state.notes.filter((n) => n.locked && !unlockedIds.has(n.id)).map((n) => n.id)),
    [state.notes, unlockedIds],
  )

  const set = <K extends keyof typeof settings>(key: K, value: (typeof settings)[K]) =>
    setState((s) => ({ ...s, settings: { ...s.settings, [key]: value } }))

  return (
    <div className="app">
      <header className="topbar">
        <button className="hamburger" onClick={() => setSidebarOpen(!sidebarOpen)} aria-label="Toggle sidebar">☰</button>
        <span className="logo">🖋️ Inkwell</span>
        <nav className="view-tabs">
          {(['write', 'vocab', 'stats'] as View[]).map((v) => (
            <button key={v} className={view === v ? 'tab-active' : ''} onClick={() => setView(v)}>
              {v === 'write' ? 'Write' : v === 'vocab' ? 'Vocabulary' : 'Progress'}
            </button>
          ))}
        </nav>
        <button className="settings-btn" onClick={() => setSettingsOpen(!settingsOpen)} aria-label="Settings">⚙︎</button>
      </header>

      {view === 'write' && <Constellation queue={queue} usedIds={usedIds} />}

      <div className="main">
        {view === 'write' && (
          <>
            <aside className={`sidebar ${sidebarOpen ? 'sidebar-open' : ''}`}>
              <Sidebar
                notebooks={state.notebooks}
                notes={state.notes}
                activeNoteId={activeId}
                onSelect={selectNote}
                onNewNote={addNote}
                onNewNotebook={addNotebook}
                onDeleteNote={deleteNote}
                onTogglePin={(id) =>
                  setState((s) => ({
                    ...s,
                    notes: s.notes.map((n) => (n.id === id ? { ...n, pinned: !n.pinned } : n)),
                  }))
                }
                onRenameNotebook={(id, name) =>
                  setState((s) => ({
                    ...s,
                    notebooks: s.notebooks.map((nb) => (nb.id === id ? { ...nb, name } : nb)),
                  }))
                }
                lockedIds={lockedIds}
              />
            </aside>
            {sidebarOpen && <div className="sidebar-scrim" onClick={() => setSidebarOpen(false)} />}
            <section className="content">
              {activeNote ? (
                noteIsLocked ? (
                  <div className="locked-view">
                    <div className="locked-blur">{'Aa '.repeat(180)}</div>
                    <button className="unlock-btn" onClick={unlock}>🔒 Unlock note</button>
                  </div>
                ) : (
                  <>
                    <div className="note-actions">
                      <button onClick={toggleLock}>{activeNote.locked ? '🔓 Remove lock' : '🔒 Lock'}</button>
                      <button onClick={() => download((activeNote.title || 'note') + '.md', `# ${activeNote.title || 'Untitled'}\n\n${htmlToMarkdown(activeNote.content)}`, 'text/markdown')}>
                        ⬇ Markdown
                      </button>
                      <button onClick={() => window.print()}>⬇ PDF</button>
                      {activeNote.versions.length > 0 && (
                        <select
                          className="version-select"
                          value=""
                          onChange={(e) => {
                            const v = activeNote.versions[Number(e.target.value)]
                            if (v && confirm('Restore this version? Your current text will be snapshotted first.')) {
                              snapshotVersion()
                              setState((s) => ({
                                ...s,
                                notes: s.notes.map((n) => (n.id === activeNote.id ? { ...n, content: v.content, updatedAt: Date.now() } : n)),
                              }))
                              const id = activeNote.id
                              setActiveId(null)
                              setTimeout(() => setActiveId(id), 0)
                            }
                          }}
                        >
                          <option value="" disabled>⏱ History ({activeNote.versions.length})</option>
                          {activeNote.versions.map((v, i) => (
                            <option key={i} value={i}>{new Date(v.savedAt).toLocaleString()}</option>
                          ))}
                        </select>
                      )}
                    </div>
                    <Editor note={activeNote} settings={settings} onChange={updateNote} onTyping={onTyping} />
                  </>
                )
              ) : (
                <div className="empty-state">
                  {quoteOfDay && (
                    <blockquote className="quote-of-day">
                      “{quoteOfDay.term}”
                      {quoteOfDay.source && <cite> — {quoteOfDay.source}</cite>}
                    </blockquote>
                  )}
                  <button className="big-new-note" onClick={() => state.notebooks[0] && addNote(state.notebooks[0].id)}>
                    ＋ Start writing
                  </button>
                </div>
              )}
            </section>
          </>
        )}

        {view === 'vocab' && (
          <section className="content content-full">
            <VocabView
              vocab={state.vocab}
              onAdd={(entries) => setState((s) => ({ ...s, vocab: [...s.vocab, ...entries] }))}
              onDelete={(id) => setState((s) => ({ ...s, vocab: s.vocab.filter((e) => e.id !== id) }))}
            />
          </section>
        )}

        {view === 'stats' && (
          <section className="content content-full">
            <StatsView stats={state.stats} vocab={state.vocab} dailyGoal={settings.dailyGoal} />
          </section>
        )}
      </div>

      {settingsOpen && (
        <>
          <div className="settings-scrim" onClick={() => setSettingsOpen(false)} />
          <div className="settings-panel">
            <div className="settings-header">
              <h3>Preferences</h3>
              <button onClick={() => setSettingsOpen(false)}>✕</button>
            </div>
            <div className="settings-group">
              <Toggle on={settings.theme === 'ink'} onChange={(v) => set('theme', v ? 'ink' : 'paper')} label="Dark (Ink) mode" icon="🌙" />
              <Toggle on={settings.focusMode} onChange={(v) => set('focusMode', v)} label="Focus mode" icon="🎯" />
              <Toggle on={settings.typewriterMode} onChange={(v) => set('typewriterMode', v)} label="Typewriter mode" icon="⌨️" />
              <Toggle on={settings.typingSound} onChange={(v) => set('typingSound', v)} label="Typing sound" icon="🔊" />
            </div>
            <div className="settings-group">
              <label>Accent
                <select value={settings.accent} onChange={(e) => set('accent', e.target.value as typeof settings.accent)}>
                  <option value="ink-blue">Ink blue</option>
                  <option value="burgundy">Burgundy</option>
                  <option value="forest">Forest green</option>
                </select>
              </label>
              <label>Font
                <select value={settings.font} onChange={(e) => set('font', e.target.value as typeof settings.font)}>
                  {(['Lora', 'Fraunces', 'Inter', 'Caveat', 'JetBrains Mono'] as const).map((f) => (
                    <option key={f} value={f} style={{ fontFamily: f }}>{f}</option>
                  ))}
                </select>
              </label>
              <label>Paper
                <select value={settings.paperTexture} onChange={(e) => set('paperTexture', e.target.value as typeof settings.paperTexture)}>
                  <option value="plain">Plain</option>
                  <option value="ruled">Ruled</option>
                  <option value="dotted">Dotted grid</option>
                  <option value="linen">Linen</option>
                </select>
              </label>
              <label>Font size <span className="range-val">{settings.fontSize}px</span>
                <input type="range" min={14} max={26} value={settings.fontSize} onChange={(e) => set('fontSize', Number(e.target.value))} />
              </label>
              <label>Line height <span className="range-val">{settings.lineHeight}</span>
                <input type="range" min={1.3} max={2.4} step={0.05} value={settings.lineHeight} onChange={(e) => set('lineHeight', Number(e.target.value))} />
              </label>
              <label>Daily goal (words)
                <input type="number" min={50} step={50} value={settings.dailyGoal} onChange={(e) => set('dailyGoal', Number(e.target.value) || 500)} />
              </label>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
