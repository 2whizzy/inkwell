import { useCallback, useEffect, useRef, useState } from 'react'
import type { Book, Rendition } from 'epubjs'
import type { BookMeta, Highlight, Settings } from '../types'
import { HIGHLIGHT_COLORS } from '../types'
import { getFile } from '../idb'
import { getPdfjs, extractReadable } from '../reader'
import { paintHighlights } from '../highlight'

// ::highlight rules injected into the web-viewer iframe (its own document).
const IFRAME_HL_CSS = `
::highlight(ink-hl-0){background:rgba(240,205,70,.42)}
::highlight(ink-hl-1){background:rgba(240,150,120,.42)}
::highlight(ink-hl-2){background:rgba(90,200,165,.42)}
::highlight(ink-hl-3){background:rgba(120,165,235,.42)}
::highlight(ink-hl-4){background:rgba(190,130,230,.42)}
::selection{background:rgba(120,160,210,.4)}`

interface Chapter { label: string; goto: () => void; active?: boolean }
interface Selected { text: string; locator: string; x: number; y: number; cfi?: string }
type Spread = 1 | 2

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
  const rootRef = useRef<HTMLDivElement>(null)
  const [chapters, setChapters] = useState<Chapter[]>([])
  const [sidebar, setSidebar] = useState<'toc' | 'marks'>('toc')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sel, setSel] = useState<Selected | null>(null)
  const [spread, setSpread] = useState<Spread>(1)
  const [immersive, setImmersive] = useState(false)
  const bg = BG[settings.readerBg]
  const canSpread = book.kind === 'pdf' || book.kind === 'epub'

  // Leaving browser fullscreen (Esc) should also drop immersive chrome-hiding.
  useEffect(() => {
    const onFs = () => { if (!document.fullscreenElement) setImmersive(false) }
    document.addEventListener('fullscreenchange', onFs)
    return () => document.removeEventListener('fullscreenchange', onFs)
  }, [])

  async function enterImmersive() {
    setImmersive(true)
    try { await rootRef.current?.requestFullscreen?.() } catch { /* fullscreen may be blocked; chrome still hides */ }
  }
  function exitImmersive() {
    setImmersive(false)
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {})
  }

  function act(kind: 'hl' | 'note' | 'learn', color?: string) {
    if (!sel) return
    if (kind === 'hl' && color) props.onHighlight(sel.text, color, sel.locator, sel.cfi)
    if (kind === 'note') props.onNote(sel.text, sel.locator)
    if (kind === 'learn') props.onLearn(sel.text, sel.locator)
    setSel(null)
    window.getSelection()?.removeAllRanges()
  }

  return (
    <div ref={rootRef} className={`reader ${immersive ? 'reader-immersive' : ''}`} style={{ background: bg.bg, color: bg.fg }}>
      {immersive && (
        <button className="immersive-exit" onClick={exitImmersive} title="Exit focus (Esc)">✕ Exit focus</button>
      )}
      <div className="reader-topbar">
        <button className="reader-back" onClick={onClose}>‹ Library</button>
        <button className="reader-menu" onClick={() => setSidebarOpen(!sidebarOpen)}>☰</button>
        <span className="reader-title">{book.title}</span>
        <div className="reader-tools">
          {canSpread && (
            <div className="spread-toggle" role="group" title="Page layout">
              <button className={spread === 1 ? 'active' : ''} onClick={() => setSpread(1)} title="Single page">▯</button>
              <button className={spread === 2 ? 'active' : ''} onClick={() => setSpread(2)} title="Two pages">▯▯</button>
            </div>
          )}
          <select value={settings.readerBg} onChange={(e) => onReaderSetting('readerBg', e.target.value as Settings['readerBg'])} title="Background">
            <option value="paper">Paper</option>
            <option value="sepia">Sepia</option>
            <option value="dark">Dark</option>
            <option value="black">Black (OLED)</option>
          </select>
          {book.kind !== 'pdf' && (
            <select value={settings.readerFont} onChange={(e) => onReaderSetting('readerFont', e.target.value as Settings['readerFont'])} title="Font">
              {(['Lora', 'Fraunces', 'Inter', 'JetBrains Mono'] as const).map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
          )}
          {book.kind !== 'pdf' && (
            <>
              <button onClick={() => onReaderSetting('readerFontSize', Math.max(14, settings.readerFontSize - 1))} title="Smaller">A−</button>
              <button onClick={() => onReaderSetting('readerFontSize', Math.min(30, settings.readerFontSize + 1))} title="Larger">A+</button>
            </>
          )}
          <button className="reader-full" onClick={enterImmersive} title="Focused fullscreen — hides everything but the book">⛶ Focus</button>
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
          {book.kind === 'pdf' && <PdfReader {...props} spread={spread} setChapters={setChapters} onSelect={setSel} />}
          {book.kind === 'epub' && <EpubReader {...props} spread={spread} setChapters={setChapters} onSelect={setSel} />}
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
function PdfReader({ book, highlights, onProgress, onSelect, setChapters, spread }: Props & {
  onSelect: (s: Selected | null) => void
  setChapters: (c: Chapter[]) => void
  spread: Spread
}) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const maxPage = useRef(1)

  useEffect(() => {
    let cancelled = false
    const observers: IntersectionObserver[] = []
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
              scroller.querySelector(`[data-page="${pageIndex + 1}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
            }
          },
        })))
      } else setChapters([])

      // Available width for one page, accounting for the gutter between a spread.
      const gap = 20
      const pad = 32
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const usable = scroller.clientWidth - pad
      const pageW = spread === 2 ? (usable - gap) / 2 : Math.min(usable, 900)

      for (let p = 1; p <= pdf.numPages; p++) {
        const holder = document.createElement('div')
        holder.className = 'pdf-page'
        holder.dataset.page = String(p)
        scroller.appendChild(holder)
        const io = new IntersectionObserver(async (entries) => {
          if (!entries[0].isIntersecting || holder.dataset.rendered) return
          holder.dataset.rendered = '1'
          io.disconnect()
          const page = await pdf.getPage(p)
          const base = page.getViewport({ scale: 1 })
          const scale = pageW / base.width
          const viewport = page.getViewport({ scale })
          const cssW = Math.floor(viewport.width)
          const cssH = Math.floor(viewport.height)
          holder.style.width = `${cssW}px`
          holder.style.height = `${cssH}px`

          const canvas = document.createElement('canvas')
          canvas.width = Math.floor(cssW * dpr)
          canvas.height = Math.floor(cssH * dpr)
          canvas.style.width = `${cssW}px`
          canvas.style.height = `${cssH}px`
          holder.appendChild(canvas)
          await page.render({
            canvas,
            viewport,
            transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : undefined,
          }).promise

          try {
            const textLayerDiv = document.createElement('div')
            textLayerDiv.className = 'textLayer'
            textLayerDiv.style.setProperty('--scale-factor', String(scale))
            textLayerDiv.style.width = `${cssW}px`
            textLayerDiv.style.height = `${cssH}px`
            holder.appendChild(textLayerDiv)
            const tl = new pdfjs.TextLayer({ textContentSource: page.streamTextContent(), container: textLayerDiv, viewport })
            await tl.render()
          } catch { /* selection unavailable for this page */ }

          if (p > maxPage.current) {
            maxPage.current = p
            onProgress(p / pdf.numPages, String(p))
          }
          paintHighlights(scroller, highlights.map((h) => ({ text: h.text, color: h.color })))
        }, { root: scroller, rootMargin: '800px' })
        observers.push(io)
        io.observe(holder)
      }
    })()
    return () => { cancelled = true; observers.forEach((o) => o.disconnect()) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [book.id, spread])

  useEffect(() => {
    if (scrollRef.current) paintHighlights(scrollRef.current, highlights.map((h) => ({ text: h.text, color: h.color })))
  }, [highlights])

  const onMouseUp = useDomSelection(scrollRef, () => String(maxPage.current), onSelect)

  return (
    <div className="pdf-wrap">
      <div ref={scrollRef} className={`pdf-scroll ${spread === 2 ? 'pdf-spread' : ''}`} onMouseUp={onMouseUp} onScroll={() => onSelect(null)} />
    </div>
  )
}

/* ---------------- EPUB ---------------- */
function EpubReader({ book, settings, highlights, onProgress, onHighlight, onSelect, setChapters, spread }: Props & {
  onSelect: (s: Selected | null) => void
  setChapters: (c: Chapter[]) => void
  spread: Spread
}) {
  const hostRef = useRef<HTMLDivElement>(null)
  const rendition = useRef<Rendition | null>(null)
  const bookRef = useRef<Book | null>(null)
  const locRef = useRef<string>(book.locator || '')
  const bg = BG[settings.readerBg]

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const data = await getFile<ArrayBuffer>(book.id)
      if (!data || cancelled || !hostRef.current) return
      const ePub = (await import('epubjs')).default
      const epubBook = ePub(data.slice(0))
      bookRef.current = epubBook
      const rend = epubBook.renderTo(hostRef.current, {
        width: '100%', height: '100%', flow: 'paginated',
        spread: spread === 2 ? 'always' : 'none',
      })
      rendition.current = rend
      applyTheme(rend, bg, settings)
      await rend.display(locRef.current || undefined)
      if (cancelled) return

      const nav = await epubBook.loaded.navigation
      setChapters(nav.toc.map((item) => ({ label: item.label.trim(), goto: () => rend.display(item.href) })))

      rend.on('relocated', (loc: { start: { cfi: string; percentage: number } }) => {
        locRef.current = loc.start.cfi
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
          x: rect ? host.left + rect.left + rect.width / 2 - 90 : host.left + host.width / 2,
          y: rect ? host.top + rect.bottom + 8 : 120,
        })
      })
      for (const h of highlights) {
        if (h.cfi) try { rend.annotations.highlight(h.cfi, {}, () => {}, '', { fill: h.color, 'fill-opacity': '0.35' }) } catch { /* noop */ }
      }
    })()
    return () => { cancelled = true; bookRef.current?.destroy(); rendition.current = null }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [book.id, spread])

  useEffect(() => {
    if (rendition.current) applyTheme(rendition.current, bg, settings)
  }, [settings.readerBg, settings.readerFontSize, settings.readerFont, bg])

  useEffect(() => {
    const rend = rendition.current
    if (!rend) return
    for (const h of highlights) {
      if (h.cfi) try { rend.annotations.highlight(h.cfi, {}, () => {}, '', { fill: h.color, 'fill-opacity': '0.35' }) } catch { /* already drawn */ }
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

function applyTheme(rend: Rendition, bg: { bg: string; fg: string }, settings: Settings) {
  rend.themes.override('color', bg.fg)
  rend.themes.override('background', bg.bg)
  rend.themes.override('font-size', `${settings.readerFontSize}px`)
  rend.themes.override('font-family', `'${settings.readerFont}', serif`)
}

/* ---------------- Web page snapshot ---------------- */
function HtmlReader({ book, settings, highlights, onSelect }: Props & {
  onSelect: (s: Selected | null) => void
}) {
  const [raw, setRaw] = useState<string | null>(null)
  const [mode, setMode] = useState<'live' | 'reader'>('live')

  useEffect(() => {
    getFile<string>(book.id).then((h) => setRaw(h || '<p>Snapshot unavailable.</p>'))
  }, [book.id])

  return (
    <div className="web-wrap">
      <div className="web-modebar">
        <button className={mode === 'live' ? 'active' : ''} onClick={() => setMode('live')}>Live page</button>
        <button className={mode === 'reader' ? 'active' : ''} onClick={() => setMode('reader')}>Reader</button>
        {book.sourceUrl && <a className="web-open" href={book.sourceUrl} target="_blank" rel="noreferrer">Open original ↗</a>}
      </div>
      {raw === null ? (
        <div className="html-reader"><p className="hint">Loading…</p></div>
      ) : mode === 'live' ? (
        <LiveFrame html={raw} highlights={highlights} onSelect={onSelect} />
      ) : (
        <ReaderMode raw={raw} url={book.sourceUrl || ''} settings={settings} highlights={highlights} onSelect={onSelect} />
      )}
    </div>
  )
}

// Same-origin srcdoc iframe: renders the captured page as-is, and because it
// shares our origin we can still read its selection and paint highlights.
function LiveFrame({ html, highlights, onSelect }: {
  html: string
  highlights: Highlight[]
  onSelect: (s: Selected | null) => void
}) {
  const frameRef = useRef<HTMLIFrameElement>(null)
  const [ready, setReady] = useState(false)

  const repaint = useCallback(() => {
    const doc = frameRef.current?.contentDocument
    const win = frameRef.current?.contentWindow
    if (doc?.body && win) paintHighlights(doc.body, highlights.map((h) => ({ text: h.text, color: h.color })), win)
  }, [highlights])

  function onLoad() {
    const frame = frameRef.current
    const doc = frame?.contentDocument
    if (!frame || !doc) return
    if (!doc.getElementById('ink-hl-style')) {
      const style = doc.createElement('style')
      style.id = 'ink-hl-style'
      style.textContent = IFRAME_HL_CSS
      doc.head?.appendChild(style)
    }
    doc.addEventListener('mouseup', () => {
      const sel = doc.getSelection()
      const text = sel?.toString().trim() || ''
      if (!text || text.length < 2 || sel!.rangeCount === 0) { onSelect(null); return }
      const r = sel!.getRangeAt(0).getBoundingClientRect()
      const fr = frame.getBoundingClientRect()
      onSelect({ text, locator: 'web', x: Math.max(12, fr.left + r.left + r.width / 2 - 90), y: fr.top + r.bottom + 8 })
    })
    doc.addEventListener('scroll', () => onSelect(null), true)
    setReady(true)
    repaint()
  }

  useEffect(() => { if (ready) repaint() }, [ready, repaint])

  return <iframe ref={frameRef} className="web-frame" srcDoc={html} onLoad={onLoad} title="Web page" sandbox="allow-same-origin allow-popups" />
}

function ReaderMode({ raw, url, settings, highlights, onSelect }: {
  raw: string
  url: string
  settings: Settings
  highlights: Highlight[]
  onSelect: (s: Selected | null) => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [html, setHtml] = useState('<p class="hint">Extracting…</p>')

  useEffect(() => {
    extractReadable(raw, url || location.href).then((a) =>
      setHtml(a ? `<h1>${a.title}</h1>${a.byline ? `<p class="rm-byline">${a.byline}</p>` : ''}${a.contentHtml}` : '<p class="hint">Could not extract a clean article — try Live page.</p>'),
    )
  }, [raw, url])

  useEffect(() => {
    if (ref.current) paintHighlights(ref.current, highlights.map((h) => ({ text: h.text, color: h.color })))
  }, [highlights, html])

  const onMouseUp = useDomSelection(ref, () => 'web', onSelect)

  return (
    <div
      ref={ref}
      className="html-reader"
      onMouseUp={onMouseUp}
      onScroll={() => onSelect(null)}
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
