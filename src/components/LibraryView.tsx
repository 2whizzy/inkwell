import { useMemo, useRef, useState } from 'react'
import type { BookMeta } from '../types'
import { uid } from '../types'
import { importEpub, importPdf, saveWebSnapshot } from '../library'
import { fetchViaProxy } from '../reader'

interface Props {
  books: BookMeta[]
  accentHex: string
  onAdd: (b: BookMeta) => void
  onOpen: (id: string) => void
  onDelete: (id: string) => void
  onMoveShelf: (id: string, shelf: string) => void
}

type Sort = 'recent' | 'title' | 'author'

export function LibraryView({ books, accentHex, onAdd, onOpen, onDelete, onMoveShelf }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState('')
  const [sort, setSort] = useState<Sort>('recent')
  const [shelf, setShelf] = useState('All')
  const [query, setQuery] = useState('')
  const [webOpen, setWebOpen] = useState(false)
  const [url, setUrl] = useState('')
  const [pasteHtml, setPasteHtml] = useState('')
  const [webErr, setWebErr] = useState('')

  const shelves = useMemo(
    () => ['All', ...Array.from(new Set(books.map((b) => b.shelf)))],
    [books],
  )

  const shown = useMemo(() => {
    let list = books.filter((b) => shelf === 'All' || b.shelf === shelf)
    if (query.trim()) {
      const q = query.toLowerCase()
      list = list.filter((b) => b.title.toLowerCase().includes(q) || b.author.toLowerCase().includes(q))
    }
    return [...list].sort((a, b) =>
      sort === 'title' ? a.title.localeCompare(b.title)
      : sort === 'author' ? a.author.localeCompare(b.author)
      : b.openedAt - a.openedAt,
    )
  }, [books, shelf, query, sort])

  async function handleFiles(files: FileList | null) {
    if (!files) return
    for (const file of Array.from(files)) {
      setBusy(`Importing ${file.name}…`)
      try {
        const isEpub = /\.epub$/i.test(file.name)
        const meta = isEpub ? await importEpub(file, accentHex) : await importPdf(file, accentHex)
        onAdd(meta)
      } catch {
        setBusy(`Couldn't import ${file.name}`)
        await new Promise((r) => setTimeout(r, 1500))
      }
    }
    setBusy('')
    if (fileRef.current) fileRef.current.value = ''
  }

  async function addWeb() {
    setWebErr('')
    let html = pasteHtml.trim()
    let sourceUrl = url.trim()
    if (!html && !sourceUrl) return
    setBusy('Fetching article…')
    try {
      if (!html) {
        try {
          html = await fetchViaProxy(sourceUrl)
        } catch {
          setBusy('')
          setWebErr(
            "Couldn't fetch that URL directly (this needs the deployed version, or the site blocks it). Paste the page's HTML below instead.",
          )
          return
        }
      }
      // Store the whole page for the live viewer; Reader mode extracts on demand.
      const meta = await saveWebSnapshot(sourceUrl, sourceUrl, html, accentHex)
      onAdd(meta)
      setWebOpen(false)
      setUrl('')
      setPasteHtml('')
    } finally {
      setBusy('')
    }
  }

  return (
    <div className="library-view">
      <div className="library-header">
        <div>
          <h2>Library</h2>
          <p className="library-sub">{books.length} items · read, highlight, and pull language into your notebook</p>
        </div>
        <div className="library-actions">
          <button className="primary" onClick={() => fileRef.current?.click()}>＋ Import PDF / EPUB</button>
          <button className="ghost" onClick={() => setWebOpen(!webOpen)}>🔗 Add web page</button>
          <input ref={fileRef} type="file" accept=".pdf,.epub" multiple hidden onChange={(e) => handleFiles(e.target.files)} />
        </div>
      </div>

      {busy && <div className="library-busy">{busy}</div>}

      {webOpen && (
        <div className="web-add">
          <input placeholder="Paste an article URL…" value={url} onChange={(e) => setUrl(e.target.value)} />
          <details>
            <summary>Site blocked? Paste page HTML instead</summary>
            <textarea rows={4} placeholder="Paste raw page HTML…" value={pasteHtml} onChange={(e) => setPasteHtml(e.target.value)} />
          </details>
          {webErr && <p className="web-err">{webErr}</p>}
          <button className="primary" onClick={addWeb}>Save to Library</button>
        </div>
      )}

      <div className="library-controls">
        <div className="shelf-tabs">
          {shelves.map((s) => (
            <button key={s} className={shelf === s ? 'chip-active' : ''} onClick={() => setShelf(s)}>{s}</button>
          ))}
        </div>
        <div className="library-right">
          <input className="library-search" placeholder="Search…" value={query} onChange={(e) => setQuery(e.target.value)} />
          <select value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
            <option value="recent">Recently opened</option>
            <option value="title">Title</option>
            <option value="author">Author</option>
          </select>
        </div>
      </div>

      {shown.length === 0 ? (
        <div className="library-empty">
          <p>Your shelf is empty.</p>
          <p className="hint">Import a PDF or EPUB, or save a web article — then select any passage while reading to send it straight into your vocabulary engine.</p>
        </div>
      ) : (
        <div className="shelf-grid">
          {shown.map((b) => (
            <div key={b.id} className="book-card">
              <button className="book-cover" onClick={() => onOpen(b.id)} title={`Open ${b.title}`}>
                {b.cover ? <img src={b.cover} alt={b.title} /> : <div className="cover-fallback">{b.title}</div>}
                <span className={`kind-badge kind-${b.kind}`}>{b.kind.toUpperCase()}</span>
                {b.progress > 0 && (
                  <span className="progress-ring" style={{ background: `conic-gradient(var(--accent) ${b.progress * 360}deg, rgba(255,255,255,0.25) 0)` }}>
                    <span>{Math.round(b.progress * 100)}%</span>
                  </span>
                )}
              </button>
              <div className="book-meta">
                <span className="book-title" title={b.title}>{b.title}</span>
                {b.author && <span className="book-author">{b.author}</span>}
              </div>
              <div className="book-hover-actions">
                <select value={b.shelf} onChange={(e) => onMoveShelf(b.id, e.target.value)} title="Shelf" onClick={(e) => e.stopPropagation()}>
                  {Array.from(new Set([b.shelf, 'Library', 'Craft', 'Research', 'Novels'])).map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                  <option value={`__new_${uid()}`}>New shelf…</option>
                </select>
                <button title="Remove" onClick={() => { if (confirm(`Remove "${b.title}" from your library?`)) onDelete(b.id) }}>🗑</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
