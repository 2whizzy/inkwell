import { useMemo, useState } from 'react'
import type { VocabEntry, VocabType } from '../types'
import { maturity, today } from '../types'
import { parseBulk } from '../matcher'
import { newVocab } from '../store'

interface Props {
  vocab: VocabEntry[]
  onAdd: (entries: VocabEntry[]) => void
  onDelete: (id: string) => void
}

const TYPES: VocabType[] = ['word', 'phrase', 'slang', 'sentence_structure', 'quote']
const BUCKETS = ['New', 'Learning', 'Young', 'Mature'] as const

const BULK_PLACEHOLDER = `type: word
term: ephemeral
meaning: lasting for a very short time
example: Fame like his is ephemeral, gone by next season.
tags: descriptive, literary
---
type: quote
term: "The unexamined life is not worth living."
source: Socrates`

export function VocabView({ vocab, onAdd, onDelete }: Props) {
  const [filter, setFilter] = useState<VocabType | 'all'>('all')
  const [bucket, setBucket] = useState<string>('all')
  const [quick, setQuick] = useState('')
  const [bulkOpen, setBulkOpen] = useState(false)
  const [bulk, setBulk] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)

  const filtered = useMemo(
    () =>
      vocab.filter(
        (e) =>
          (filter === 'all' || e.type === filter) &&
          (bucket === 'all' || maturity(e) === bucket),
      ),
    [vocab, filter, bucket],
  )

  function addQuick() {
    const parsed = parseBulk(quick)
    if (parsed.length) {
      onAdd(parsed.map(newVocab))
      setQuick('')
    } else if (quick.trim()) {
      onAdd([newVocab({ term: quick.trim() })])
      setQuick('')
    }
  }

  function importBulk() {
    const parsed = parseBulk(bulk)
    if (parsed.length) {
      onAdd(parsed.map(newVocab))
      setBulk('')
      setBulkOpen(false)
    }
  }

  const t = today()

  return (
    <div className="vocab-view">
      <div className="vocab-header">
        <h2>Vocabulary Library</h2>
        <p className="vocab-sub">
          {vocab.length} entries · {vocab.filter((e) => e.due <= t).length} due today
        </p>
      </div>

      <div className="quick-add">
        <input
          placeholder="Quick add a word or phrase — press Enter"
          value={quick}
          onChange={(e) => setQuick(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addQuick()}
        />
        <button onClick={addQuick}>Add</button>
        <button className="ghost" onClick={() => setBulkOpen(!bulkOpen)}>
          Bulk import
        </button>
      </div>

      {bulkOpen && (
        <div className="bulk-import">
          <textarea
            rows={10}
            placeholder={BULK_PLACEHOLDER}
            value={bulk}
            onChange={(e) => setBulk(e.target.value)}
          />
          <button onClick={importBulk}>Import {parseBulk(bulk).length || ''} entries</button>
        </div>
      )}

      <div className="vocab-filters">
        <select value={filter} onChange={(e) => setFilter(e.target.value as VocabType | 'all')}>
          <option value="all">All types</option>
          {TYPES.map((ty) => (
            <option key={ty} value={ty}>{ty.replace('_', ' ')}</option>
          ))}
        </select>
        <div className="bucket-chips">
          <button className={bucket === 'all' ? 'chip-active' : ''} onClick={() => setBucket('all')}>All</button>
          {BUCKETS.map((b) => (
            <button key={b} className={bucket === b ? 'chip-active' : ''} onClick={() => setBucket(b)}>
              {b} ({vocab.filter((e) => maturity(e) === b).length})
            </button>
          ))}
        </div>
      </div>

      <div className="vocab-list">
        {filtered.map((e) => {
          const m = maturity(e)
          const due = e.due <= t
          const growth = m === 'New' ? '🌱' : m === 'Learning' ? '🌿' : m === 'Young' ? '🪴' : '🌳'
          return (
            <div
              key={e.id}
              className={`vocab-card ${due ? 'vocab-due' : ''}`}
              onClick={() => setExpanded(expanded === e.id ? null : e.id)}
            >
              <div className="vocab-card-top">
                <span className="vocab-growth" title={m}>{growth}</span>
                <span className="vocab-term">{e.term}</span>
                <span className={`vocab-type-badge badge-${e.type}`}>{e.type.replace('_', ' ')}</span>
                <span className="vocab-due-label">{due ? 'due' : `in ${Math.max(0, Math.ceil((new Date(e.due).getTime() - Date.now()) / 86400000))}d`}</span>
              </div>
              {e.meaning && <p className="vocab-meaning">{e.meaning}</p>}
              {expanded === e.id && (
                <div className="vocab-detail">
                  {e.example && <p className="vocab-example">“{e.example}”</p>}
                  {e.source && <p className="vocab-source">— {e.source}</p>}
                  {e.tags.length > 0 && (
                    <p className="vocab-tags">{e.tags.map((tag) => <span key={tag}>#{tag}</span>)}</p>
                  )}
                  <p className="vocab-sm2">
                    ease {e.ease.toFixed(2)} · interval {e.interval}d · {e.reps} reps · {m}
                  </p>
                  {e.history.length > 0 && (
                    <div className="vocab-history">
                      {e.history.slice(-8).map((h, i) => (
                        <span key={i} className={h.used ? 'hist-used' : 'hist-skip'} title={`${h.date}: ${h.used ? 'used' : 'not used'}`}>
                          {h.used ? '●' : '○'}
                        </span>
                      ))}
                    </div>
                  )}
                  <button className="danger" onClick={(ev) => { ev.stopPropagation(); onDelete(e.id) }}>
                    Delete
                  </button>
                </div>
              )}
            </div>
          )
        })}
        {filtered.length === 0 && <div className="empty-hint">Nothing here yet — add your first entry above.</div>}
      </div>
    </div>
  )
}
