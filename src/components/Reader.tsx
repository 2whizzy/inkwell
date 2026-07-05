import { useCallback, useEffect, useRef, useState } from 'react'
import type { Book, Rendition } from 'epubjs'
import type { BookMeta, Highlight, Settings } from '../types'
import { HIGHLIGHT_COLORS } from '../types'
import { getFile } from '../idb'
import { getPdfjs } from '../reader'
import { paintHighlights } from '../highlight'

interface Chapter { label: string; goto: () => void; active?: boolean }
interface Selected { text: string; locator: string; x: number; y: number; cfi?: string }

interface Props {
  book: BookMeta
  settings: Settings
  highlights: Highlight[]
  onClose: () => void
  onProgress: (progress: number, locator: string) => void
  onHighlight: (text: string, color: string, locator: string, cfi?: string) => void
  onNote: (passage: string, locator: string) => void
  onLearn: (passage: string, locator: string) => void
  onReaderSetting: <K extends keyof Settings>(key: K, value: Settings[K]) => void
}

const BG: Record<Settings['readerBg'], { bg: string; fg: string }> = {
  paper: { bg: '#fdfaf3', fg: '#2c2620' },
  sepia: { bg: '#f4ecd8', fg: '#4a3f2f' },
  dark: { bg: '#262219', fg: '#e8e0d2' },
  black: { bg: '#000000', fg: '#c8c2b6' },
}

export function Reader(props: Props) {
  const { book, settings, highlights, onClose, onReaderSetting } = props
  const [chapters, setChapters] = useState<Chapter[]>([])
  const [sidebar, setSidebar] = useState<'toc' | 'marks'>('toc')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sel, setSel] = useState<Selected | null>(null)
  const bg = BG[settings.readerBg]

  function act(kind: 'hl' | 'note' | 'learn', color?: string) {
    if (!sel) return
    if (kind === 'hl' && color) props.onHighlight(sel.text, color, sel.locator, sel.cfi)
    if (kind === 'note') props.onNote(sel.text, sel.locator)
    if (kind === 'learn') props.onLearn(sel.text, sel.locator)
    setSel(null)
    window.getSelection()?.removeAllRanges()
  }

  return (
    <div className="reader" style={{ background: bg.bg, color: bg.fg }}>
      <div className="reader-topbar">
        <button className="reader-back" onClick={onClose}>‹ Library</button>
        <button className="reader-menu" onClick={() => setSidebarOpen(!sidebarOpen)}>☰</button>
        <span className="reader-title">{book.title}</span>
        <div className="reader-tools">
          <select value={settings.readerBg} onChange={(e) => onReaderSetting('readerBg', e.target.value as Settings['readerBg'])} title="Background">
            <option value="paper">Paper</option>
            <option value="sepia">Sepia</option>
            <option value="dark">Dark</option>
            <option value="black">Black (OLED)</option>
          </select>
          <select value={settings.readerFont} onChange={(e) => onReaderSetting('readerFont', e.target.value as Settings['readerFont'])} title="Font">
            {(['Lora', 'Fraunces', 'Inter', 'JetBrains Mono'] as const).map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
          <button onClick={() => onReaderSetting('readerFontSize', Math.max(14, settings.readerFontSize - 1))} title="Smaller">A−</button>
          <button onClick={() => onReaderSetting('readerFontSize', Math.min(30, settings.readerFontSize + 1))} title="Larger">A+</button>
        </div>
      </div>

      <div className="reader-body">
        <aside className={`reader-sidebar ${sidebarOpen ? 'open' : ''}`}>
          <div className="reader-sidebar-tabs">
            <button className={sidebar === 'toc' ? 'active' : ''} onClick={() => setSidebar('toc')}>Contents</button>
            <button className={sidebar === 'marks' ? 'active' : ''} onClick={() => setSidebar('marks')}>Highlights</button>
          </div>
          {sidebar === 'toc' ? (
            <div className="reader-toc">
              {chapters.length === 0 && <p className="hint">No chapter structure.</p>}
              {chapters.map((c, i) => (
                <button key={i} className={`toc-item ${c.active ? 'toc-active' : ''}`} onClick={() => { c.goto(); setSidebarOpen(false) }}>{c.label}</button>
              ))}
            </div>
          ) : (
            <div className="reader-marks">
              {highlights.length === 0 && <p className="hint">Select text and tap a color to highlight.</p>}
              {highlights.map((h) => (
                <div key={h.id} className="mark-item">
                  <span className="mark-swatch" style={{ background: h.color }} />
                  <span className="mark-text">{h.text.slice(0, 90)}</span>
                </div>
              ))}
            </div>
          )}
        </aside>
        {sidebarOpen && <div className="reader-scrim" onClick={() => setSidebarOpen(false)} />}

        <div className="reader-main">
          {book.kind === 'pdf' && <PdfReader {...props} setChapters={setChapters} onSelect={setSel} />}
          {book.kind === 'epub' && <EpubReader {...props} setChapters={setChapters} onSelect={setSel} />}
          {book.kind === 'web' && <HtmlReader {...props} onSelect={setSel} />}
        </div>
      </div>

      {sel && (
        <div className="sel-popup" style={{ left: sel.x, top: sel.y }} onMouseDown={(e) => e.preventDefault()}>
          <div className="sel-colors">
            {HIGHLIGHT_COLORS.map((c) => (
              <button key={c} className="sel-color" style={{ background: c }} title="Highlight" onClick={() => act('hl', c)} />
            ))}
          </div>
          <button className="sel-btn" onClick={() => act('note')}>✎ Note</button>
          <button className="sel-btn sel-learn" onClick={() => act('learn')}>✦ Learn</button>
        </div>
      )}
    </div>
  )
}

/* ---------------- PDF ---------------- */
function PdfReader({ book, highlights, onProgress, onSelect, setChapters }: Props & {
  onSelect: (s: Selected | null) => void
  setChapters: (c: Chapter[]) => void
}) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [fit, setFit] = useState<'width' | 'page'>('width')
  const maxPage = useRef(1)

  useEffect(() => {
    let cancelled = false
    const scroller = scrollRef.current
    if (!scroller) return
    scroller.innerHTML = ''
    ;(async () => {
      const data = await getFile<ArrayBuffer>(book.id)
      if (!data || cancelled) return
      const pdfjs = await getPdfjs()
      const pdf = await pdfjs.getDocument({ data: data.slice(0) }).promise
      if (cancelled) return

      const outline = await pdf.getOutline().catch(() => null)
      if (outline?.length) {
        setChapters(outline.map((o) => ({
          label: o.title,
          goto: async () => {
            const dest = typeof o.dest === 'string' ? await pdf.getDestination(o.dest) : o.dest
            const ref = dest?.[0]
            if (ref) {
              const pageIndex = await pdf.getPageIndex(ref).catch(() => 0)
              scroller.querySelector(`[data-page="${pageIndex + 1}"]`)?.scrollIntoView({ behavior: 'smooth' })
            }
          },
        })))
      } else setChapters([])

      const containerW = scroller.clientWidth - 48
      for (let p = 1; p <= pdf.numPages; p++) {
        const holder = document.createElement('div')
        holder.className = 'pdf-page'
        holder.dataset.page = String(p)
        scroller.appendChild(holder)
        // Lazy-render as pages approach the viewport.
        const io = new IntersectionObserver(async (entries) => {
          if (!entries[0].isIntersecting || holder.dataset.rendered) return
          holder.dataset.rendered = '1'
          io.disconnect()
          const page = await pdf.getPage(p)
          const base = page.getViewport({ scale: 1 })
          const scale = fit === 'width' ? containerW / base.width : (scroller.clientHeight - 60) / base.height
          const viewport = page.getViewport({ scale })
          const canvas = document.createElement('canvas')
          canvas.width = viewport.width
          canvas.height = viewport.height
          holder.style.width = `${viewport.width}px`
          holder.style.height = `${viewport.height}px`
          holder.appendChild(canvas)
          await page.render({ canvas, canvasContext: canvas.getContext('2d')!, viewport }).promise
          try {
            const textLayerDiv = document.createElement('div')
            textLayerDiv.className = 'pdf-text-layer'
            holder.appendChild(textLayerDiv)
            const tl = new pdfjs.TextLayer({ textContentSource: page.streamTextContent(), container: textLayerDiv, viewport })
            await tl.render()
          } catch { /* selection unavailable for this page */ }
          if (p > maxPage.current) {
            maxPage.current = p
            onProgress(p / pdf.numPages, String(p))
          }
          paintHighlights(scroller, highlights.map((h) => ({ text: h.text, color: h.color })))
        }, { root: scroller, rootMargin: '600px' })
        io.observe(holder)
      }
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [book.id, fit])

  useEffect(() => {
    if (scrollRef.current) paintHighlights(scrollRef.current, highlights.map((h) => ({ text: h.text, color: h.color })))
  }, [highlights])

  const onMouseUp = useDomSelection(scrollRef, () => String(maxPage.current), onSelect)

  return (
    <div className="pdf-wrap">
      <div className="pdf-fit">
        <button className={fit === 'width' ? 'active' : ''} onClick={() => setFit('width')}>Fit width</button>
        <button className={fit === 'page' ? 'active' : ''} onClick={() => setFit('page')}>Fit page</button>
      </div>
      <div ref={scrollRef} className="pdf-scroll" onMouseUp={onMouseUp} onScroll={() => onSelect(null)} />
    </div>
  )
}

/* ---------------- EPUB ---------------- */
function EpubReader({ book, settings, highlights, onProgress, onHighlight, onSelect, setChapters }: Props & {
  onSelect: (s: Selected | null) => void
  setChapters: (c: Chapter[]) => void
}) {
  const hostRef = useRef<HTMLDivElement>(null)
  const rendition = useRef<Rendition | null>(null)
  const bookRef = useRef<Book | null>(null)
  const bg = BG[settings.readerBg]

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const data = await getFile<ArrayBuffer>(book.id)
      if (!data || cancelled || !hostRef.current) return
      const ePub = (await import('epubjs')).default
      const epubBook = ePub(data.slice(0))
      bookRef.current = epubBook
      const rend = epubBook.renderTo(hostRef.current, { width: '100%', height: '100%', flow: 'paginated', spread: 'auto' })
      rendition.current = rend
      await rend.display(book.locator || undefined)
      if (cancelled) return

      const nav = await epubBook.loaded.navigation
      setChapters(nav.toc.map((item) => ({ label: item.label.trim(), goto: () => rend.display(item.href) })))

      rend.on('relocated', (loc: { start: { cfi: string; percentage: number } }) => {
        onProgress(loc.start.percentage || 0, loc.start.cfi)
      })
      rend.on('selected', (cfiRange: string, contents: { window: Window }) => {
        const text = contents.window.getSelection()?.toString().trim() || ''
        if (!text) return
        const range = rend.getRange(cfiRange)
        const rect = range?.getBoundingClientRect()
        const host = hostRef.current!.getBoundingClientRect()
        onSelect({
          text, locator: cfiRange, cfi: cfiRange,
          x: (rect ? rect.left : host.width / 2),
          y: (rect ? rect.bottom + 40 : 120),
        })
      })
      for (const h of highlights) {
        if (h.cfi) try { rend.annotations.highlight(h.cfi, {}, () => {}, '', { fill: h.color }) } catch { /* noop */ }
      }
    })()
    return () => { cancelled = true; bookRef.current?.destroy() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [book.id])

  useEffect(() => {
    const rend = rendition.current
    if (!rend) return
    rend.themes.override('color', bg.fg)
    rend.themes.override('background', bg.bg)
    rend.themes.override('font-size', `${settings.readerFontSize}px`)
    rend.themes.override('font-family', `'${settings.readerFont}', serif`)
  }, [settings.readerBg, settings.readerFontSize, settings.readerFont, bg.bg, bg.fg])

  // Re-apply any highlight that isn't yet drawn (e.g. just added).
  useEffect(() => {
    const rend = rendition.current
    if (!rend) return
    for (const h of highlights) {
      if (h.cfi) try { rend.annotations.highlight(h.cfi, {}, () => {}, '', { fill: h.color }) } catch { /* already drawn */ }
    }
  }, [highlights, onHighlight])

  return (
    <div className="epub-wrap">
      <button className="epub-nav epub-prev" onClick={() => rendition.current?.prev()}>‹</button>
      <div ref={hostRef} className="epub-host" />
      <button className="epub-nav epub-next" onClick={() => rendition.current?.next()}>›</button>
    </div>
  )
}

/* ---------------- Web / HTML snapshot ---------------- */
function HtmlReader({ book, settings, highlights, onProgress, onSelect }: Props & {
  onSelect: (s: Selected | null) => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [html, setHtml] = useState('<p class="hint">Loading…</p>')

  useEffect(() => {
    getFile<string>(book.id).then((h) => setHtml(h || '<p>Snapshot unavailable.</p>'))
  }, [book.id])

  useEffect(() => {
    if (ref.current) paintHighlights(ref.current, highlights.map((h) => ({ text: h.text, color: h.color })))
  }, [highlights, html])

  const onMouseUp = useDomSelection(ref, () => {
    const el = ref.current
    return el ? String(Math.round((el.scrollTop / (el.scrollHeight - el.clientHeight || 1)) * 100)) : '0'
  }, onSelect)

  function trackScroll() {
    onSelect(null)
    const el = ref.current
    if (el) onProgress(el.scrollTop / (el.scrollHeight - el.clientHeight || 1), '0')
  }

  return (
    <div
      ref={ref}
      className="html-reader"
      onMouseUp={onMouseUp}
      onScroll={trackScroll}
      style={{ fontFamily: `'${settings.readerFont}', serif`, fontSize: settings.readerFontSize, lineHeight: 1.7 }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}

/* Shared: capture a selection inside a DOM container and report its rect. */
function useDomSelection(
  ref: React.RefObject<HTMLElement | null>,
  getLocator: () => string,
  onSelect: (s: Selected | null) => void,
) {
  return useCallback(() => {
    const selection = window.getSelection()
    const text = selection?.toString().trim() || ''
    if (!text || text.length < 2 || !ref.current) { onSelect(null); return }
    const rect = selection!.getRangeAt(0).getBoundingClientRect()
    onSelect({ text, locator: getLocator(), x: Math.max(12, rect.left + rect.width / 2 - 90), y: rect.bottom + 8 })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ref, getLocator, onSelect])
}
