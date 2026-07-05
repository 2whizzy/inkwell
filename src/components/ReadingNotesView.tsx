import { useMemo, useState } from 'react'
import type { ReadingNote } from '../types'

interface Props {
  notes: ReadingNote[]
  onDelete: (id: string) => void
  onOpenBook: (bookId: string) => void
}

type Sort = 'date' | 'source'

export function ReadingNotesView({ notes, onDelete, onOpenBook }: Props) {
  const [sort, setSort] = useState<Sort>('date')
  const [filter, setFilter] = useState<'all' | 'learned'>('all')
  const [query, setQuery] = useState('')

  const shown = useMemo(() => {
    let list = filter === 'learned' ? notes.filter((n) => n.learned) : notes
    if (query.trim()) {
      const q = query.toLowerCase()
      list = list.filter((n) => n.passage.toLowerCase().includes(q) || n.bookTitle.toLowerCase().includes(q))
    }
    return [...list].sort((a, b) =>
      sort === 'source' ? a.bookTitle.localeCompare(b.bookTitle) || b.createdAt - a.createdAt : b.createdAt - a.createdAt,
    )
  }, [notes, filter, query, sort])

  return (
    <div className="reading-notes-view">
      <div className="rn-header">
        <div>
          <h2>Notes from Reading</h2>
          <p className="rn-sub">{notes.length} captured passages · {notes.filter((n) => n.learned).length} sent to your vocabulary</p>
        </div>
      </div>

      <div className="rn-controls">
        <input className="rn-search" placeholder="Search passages…" value={query} onChange={(e) => setQuery(e.target.value)} />
        <div className="rn-chips">
          <button className={filter === 'all' ? 'chip-active' : ''} onClick={() => setFilter('all')}>All</button>
          <button className={filter === 'learned' ? 'chip-active' : ''} onClick={() => setFilter('learned')}>Learned ✦</button>
        </div>
        <select value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
          <option value="date">Newest</option>
          <option value="source">By source</option>
        </select>
      </div>

      {shown.length === 0 ? (
        <div className="rn-empty">
          <p>No reading notes yet.</p>
          <p className="hint">Open a book or article in your Library, select a passage, and choose <b>Note</b> or <b>Learn</b> — captured passages land here as index cards.</p>
        </div>
      ) : (
        <div className="rn-grid">
          {shown.map((n) => (
            <div key={n.id} className={`rn-card ${n.learned ? 'rn-learned' : ''}`}>
              <blockquote className="rn-passage">“{n.passage}”</blockquote>
              {n.note && <p className="rn-annotation">{n.note}</p>}
              <div className="rn-foot">
                <button
                  className="rn-source"
                  disabled={!n.bookId}
                  onClick={() => n.bookId && onOpenBook(n.bookId)}
                  title={n.bookId ? 'Open source' : ''}
                >
                  {n.bookTitle}{n.author ? ` · ${n.author}` : ''}{n.locator ? ` · ${n.locator}` : ''}
                </button>
                <span className="rn-date">{new Date(n.createdAt).toLocaleDateString()}</span>
              </div>
              {n.learned && <span className="rn-badge">✦ Learning</span>}
              <button className="rn-del" title="Delete" onClick={() => onDelete(n.id)}>✕</button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
