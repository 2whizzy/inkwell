import { HIGHLIGHT_COLORS } from './types'

// Persist-and-repaint highlights over DOM content (PDF text layer / web reader)
// using the CSS Custom Highlight API — no DOM mutation, survives re-render.
// Falls back to a no-op where the API is unavailable.
type HL = { text: string; color: string }

// `win` lets us paint into an iframe's own document (same-origin srcdoc).
export function paintHighlights(container: HTMLElement, highlights: HL[], win: Window = window) {
  const w = win as unknown as {
    CSS?: { highlights?: Map<string, unknown> }
    Highlight?: new (...ranges: Range[]) => unknown
  }
  const registry = w.CSS?.highlights
  if (!registry || typeof w.Highlight === 'undefined') return
  for (let i = 0; i < HIGHLIGHT_COLORS.length; i++) registry.delete(`ink-hl-${i}`)

  const byColor = new Map<number, Range[]>()
  for (const hl of highlights) {
    const ci = HIGHLIGHT_COLORS.indexOf(hl.color)
    if (ci < 0 || !hl.text.trim()) continue
    for (const range of findRanges(container, hl.text)) {
      const arr = byColor.get(ci) || []
      arr.push(range)
      byColor.set(ci, arr)
    }
  }
  const Ctor = w.Highlight!
  for (const [ci, ranges] of byColor) {
    registry.set(`ink-hl-${ci}`, new Ctor(...ranges))
  }
}

// Find ranges of `needle` across text nodes (handles spans splitting the text).
function findRanges(root: HTMLElement, needle: string): Range[] {
  const doc = root.ownerDocument || document
  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  const nodes: Text[] = []
  let full = ''
  const starts: number[] = []
  let n: Node | null
  while ((n = walker.nextNode())) {
    starts.push(full.length)
    nodes.push(n as Text)
    full += (n as Text).data
  }
  const hay = full.toLowerCase()
  const nee = needle.toLowerCase().replace(/\s+/g, ' ').trim()
  const ranges: Range[] = []
  let from = 0
  // collapse whitespace in haystack search by scanning normalized text
  const normHay = hay.replace(/\s+/g, ' ')
  let idx = normHay.indexOf(nee, from)
  let guard = 0
  while (idx !== -1 && guard++ < 50) {
    // Map normalized index back approximately to raw offsets.
    const rawStart = mapNormToRaw(hay, idx)
    const rawEnd = mapNormToRaw(hay, idx + nee.length)
    const r = makeRange(nodes, starts, rawStart, rawEnd)
    if (r) ranges.push(r)
    from = idx + nee.length
    idx = normHay.indexOf(nee, from)
  }
  return ranges
}

function mapNormToRaw(raw: string, normIdx: number): number {
  let count = 0
  for (let i = 0; i < raw.length; i++) {
    const isWs = /\s/.test(raw[i])
    const prevWs = i > 0 && /\s/.test(raw[i - 1])
    if (isWs && prevWs) continue // collapsed
    if (count === normIdx) return i
    count++
  }
  return raw.length
}

function makeRange(nodes: Text[], starts: number[], start: number, end: number): Range | null {
  const find = (pos: number): [Text, number] | null => {
    for (let i = nodes.length - 1; i >= 0; i--) {
      if (starts[i] <= pos) return [nodes[i], pos - starts[i]]
    }
    return null
  }
  const s = find(start)
  const e = find(end)
  if (!s || !e) return null
  try {
    const r = (nodes[0].ownerDocument || document).createRange()
    r.setStart(s[0], Math.min(s[1], s[0].length))
    r.setEnd(e[0], Math.min(e[1], e[0].length))
    return r
  } catch {
    return null
  }
}
