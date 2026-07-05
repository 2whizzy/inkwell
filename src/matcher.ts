import type { VocabEntry } from './types'

// Lightweight stemmer: lowercase + strip common English suffixes.
export function stem(w: string): string {
  let s = w.toLowerCase()
  for (const suf of ['ingly', 'edly', 'ing', 'ies', 'ied', 'ly', 'ed', 'es', 's']) {
    if (s.length > suf.length + 2 && s.endsWith(suf)) {
      s = s.slice(0, -suf.length)
      break
    }
  }
  return s
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/<[^>]+>/g, ' ')
    .replace(/[^a-z'’\- ]+/gi, ' ')
    .split(/\s+/)
    .filter(Boolean)
}

// Does the note text contain this entry's term (or a close inflected variant)?
export function detectUsage(noteText: string, entry: VocabEntry): boolean {
  const tokens = tokenize(noteText)
  const stems = new Set(tokens.map(stem))
  const term = entry.term.replace(/^["'“]+|["'”]+$/g, '')

  if (entry.type === 'sentence_structure') {
    // "Not only... but also..." — every fragment must appear, in order.
    const parts = term
      .split(/\.{3}|…/)
      .map((p) => p.trim().toLowerCase())
      .filter((p) => p.length > 1)
    if (parts.length === 0) return false
    const text = tokenize(noteText).join(' ')
    let idx = 0
    for (const part of parts) {
      const found = text.indexOf(part, idx)
      if (found === -1) return false
      idx = found + part.length
    }
    return true
  }

  if (entry.type === 'quote') {
    // A quote counts if a distinctive chunk of it appears.
    const words = tokenize(term)
    if (words.length <= 3) return tokenize(noteText).join(' ').includes(words.join(' '))
    const text = tokenize(noteText).join(' ')
    for (let i = 0; i + 4 <= words.length; i++) {
      if (text.includes(words.slice(i, i + 4).join(' '))) return true
    }
    return false
  }

  const termWords = tokenize(term)
  if (termWords.length === 1) {
    return stems.has(stem(termWords[0]))
  }
  // Multi-word phrase/slang: stemmed sequence match.
  const stemmedTokens = tokens.map(stem)
  const stemmedTerm = termWords.map(stem)
  for (let i = 0; i + stemmedTerm.length <= stemmedTokens.length; i++) {
    if (stemmedTerm.every((w, j) => stemmedTokens[i + j] === w)) return true
  }
  return false
}

// Parse the bulk "---"-separated entry format from the spec.
export function parseBulk(input: string): Partial<VocabEntry>[] {
  return input
    .split(/\n\s*---\s*\n?/)
    .map((block) => {
      const entry: Record<string, string> = {}
      for (const line of block.split('\n')) {
        const m = line.match(/^\s*(type|term|meaning|example|tags|source)\s*:\s*(.+)$/i)
        if (m) entry[m[1].toLowerCase()] = m[2].trim()
      }
      if (!entry.term) {
        const bare = block.trim()
        if (bare && !bare.includes(':') && bare.length < 120) entry.term = bare
      }
      if (!entry.term) return null
      const type = (entry.type || 'word').toLowerCase().replace(/\s+/g, '_')
      return {
        type: (['word', 'phrase', 'slang', 'sentence_structure', 'quote'].includes(type)
          ? type
          : 'word') as VocabEntry['type'],
        term: entry.term.replace(/^["']|["']$/g, ''),
        meaning: entry.meaning || '',
        example: entry.example || '',
        source: entry.source || '',
        tags: entry.tags ? entry.tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
      }
    })
    .filter((e): e is NonNullable<typeof e> => e !== null)
}
