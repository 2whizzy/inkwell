import { useMemo, useState } from 'react'
import type { Note, Notebook } from '../types'
import { countWords, htmlToText } from '../store'

interface Props {
  notebooks: Notebook[]
  notes: Note[]
  activeNoteId: string | null
  onSelect: (id: string) => void
  onNewNote: (notebookId: string) => void
  onNewNotebook: () => void
  onDeleteNote: (id: string) => void
  onTogglePin: (id: string) => void
  onRenameNotebook: (id: string, name: string) => void
  lockedIds: Set<string>
}

export function Sidebar({
  notebooks, notes, activeNoteId, onSelect, onNewNote, onNewNotebook,
  onDeleteNote, onTogglePin, onRenameNotebook, lockedIds,
}: Props) {
  const [query, setQuery] = useState('')
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

  const filtered = useMemo(() => {
    if (!query.trim()) return null
    const q = query.toLowerCase()
    return notes.filter(
      (n) =>
        n.title.toLowerCase().includes(q) ||
        (!n.locked && htmlToText(n.content).toLowerCase().includes(q)) ||
        n.tags.some((t) => t.toLowerCase().includes(q)),
    )
  }, [query, notes])

  function noteRow(n: Note) {
    const locked = n.locked && lockedIds.has(n.id)
    const preview = locked ? '••••••••••••' : htmlToText(n.content).slice(0, 64)
    return (
      <div
        key={n.id}
        className={`note-row ${n.id === activeNoteId ? 'note-row-active' : ''} ${locked ? 'note-row-locked' : ''}`}
        onClick={() => onSelect(n.id)}
      >
        <div className="note-row-top">
          <span className="note-row-title">
            {n.pinned && <span className="pin-icon">📌</span>}
            {n.locked && <span className="pin-icon">🔒</span>}
            {n.title || 'Untitled'}
          </span>
          <span className="note-row-actions">
            <button title={n.pinned ? 'Unpin' : 'Pin'} onClick={(e) => { e.stopPropagation(); onTogglePin(n.id) }}>📌</button>
            <button title="Move to trash" onClick={(e) => { e.stopPropagation(); onDeleteNote(n.id) }}>🗑</button>
          </span>
        </div>
        <span className={`note-row-preview ${locked ? 'blurred' : ''}`}>{preview || 'Empty note'}</span>
        <span className="note-row-meta">
          {new Date(n.updatedAt).toLocaleDateString()} · {locked ? '—' : countWords(htmlToText(n.content)) + ' words'}
        </span>
      </div>
    )
  }

  const sortNotes = (list: Note[]) =>
    [...list].sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt - a.updatedAt)

  return (
    <div className="sidebar-inner">
      <div className="sidebar-search">
        <input
          placeholder="Search notes…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      {filtered ? (
        <div className="notebook-section">
          <div className="notebook-header"><span>Results ({filtered.length})</span></div>
          {sortNotes(filtered).map(noteRow)}
        </div>
      ) : (
        notebooks.map((nb) => {
          const nbNotes = sortNotes(notes.filter((n) => n.notebookId === nb.id))
          const isCollapsed = collapsed.has(nb.id)
          return (
            <div key={nb.id} className="notebook-section">
              <div className="notebook-header" style={{ borderLeftColor: nb.color }}>
                <button
                  className="notebook-name"
                  onClick={() =>
                    setCollapsed((s) => {
                      const next = new Set(s)
                      if (next.has(nb.id)) next.delete(nb.id)
                      else next.add(nb.id)
                      return next
                    })
                  }
                >
                  <span className={`chevron ${isCollapsed ? '' : 'chevron-open'}`}>›</span>
                  {nb.icon} {nb.name}
                </button>
                <span className="notebook-actions">
                  <button title="Rename" onClick={() => {
                    const name = prompt('Notebook name', nb.name)
                    if (name?.trim()) onRenameNotebook(nb.id, name.trim())
                  }}>✏️</button>
                  <button title="New note" onClick={() => onNewNote(nb.id)}>＋</button>
                </span>
              </div>
              {!isCollapsed && nbNotes.map(noteRow)}
              {!isCollapsed && nbNotes.length === 0 && (
                <div className="empty-hint">No notes yet</div>
              )}
            </div>
          )
        })
      )}
      <button className="new-notebook-btn" onClick={onNewNotebook}>＋ New notebook</button>
    </div>
  )
}
