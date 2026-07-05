import { useState } from 'react'
import type { VocabEntry } from '../types'

interface Props {
  queue: VocabEntry[]
  usedIds: Set<string>
}

// The ambient "words for today" strip. Used entries light up.
export function Constellation({ queue, usedIds }: Props) {
  const [open, setOpen] = useState<string | null>(null)
  if (queue.length === 0) return null
  const used = queue.filter((e) => usedIds.has(e.id)).length
  return (
    <div className="constellation">
      <div className="constellation-pills">
        {queue.map((e) => {
          const isUsed = usedIds.has(e.id)
          return (
            <button
              key={e.id}
              className={`pill ${isUsed ? 'pill-used' : ''} ${open === e.id ? 'pill-open' : ''}`}
              onClick={() => setOpen(open === e.id ? null : e.id)}
            >
              {isUsed && <span className="pill-check">✓</span>}
              <span className="pill-term">{e.term}</span>
            </button>
          )
        })}
      </div>
      <span className="constellation-count">
        {used}/{queue.length}
      </span>
      {open && (
        <InkCard entry={queue.find((e) => e.id === open)!} onClose={() => setOpen(null)} />
      )}
    </div>
  )
}

function InkCard({ entry, onClose }: { entry: VocabEntry; onClose: () => void }) {
  const [flipped, setFlipped] = useState(false)
  return (
    <div className="ink-card-backdrop" onClick={onClose}>
      <div
        className={`ink-card ${flipped ? 'flipped' : ''}`}
        onClick={(ev) => {
          ev.stopPropagation()
          setFlipped(!flipped)
        }}
      >
        <div className="ink-card-inner">
          <div className="ink-card-face ink-card-front">
            <span className="ink-card-type">{entry.type.replace('_', ' ')}</span>
            <span className="ink-card-term">{entry.term}</span>
            <span className="ink-card-hint">tap to flip</span>
          </div>
          <div className="ink-card-face ink-card-back">
            {entry.meaning && <p className="ink-card-meaning">{entry.meaning}</p>}
            {entry.example && <p className="ink-card-example">“{entry.example}”</p>}
            {entry.source && <p className="ink-card-source">— {entry.source}</p>}
          </div>
        </div>
      </div>
    </div>
  )
}
