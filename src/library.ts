import type { BookMeta } from './types'
import { uid } from './types'
import { putFile } from './idb'
import { getPdfjs, sanitizeFullPage } from './reader'

// A generated fallback cover: warm paper card with the title set in a serif.
export function makeTitleCover(title: string, author: string, tint = '#3b5b8c'): string {
  const c = document.createElement('canvas')
  c.width = 400
  c.height = 560
  const ctx = c.getContext('2d')!
  const grad = ctx.createLinearGradient(0, 0, 0, 560)
  grad.addColorStop(0, tint)
  grad.addColorStop(1, shade(tint, -30))
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, 400, 560)
  ctx.fillStyle = 'rgba(255,255,255,0.08)'
  ctx.fillRect(24, 24, 352, 512)
  ctx.fillStyle = '#fdfaf3'
  ctx.textAlign = 'center'
  ctx.font = '600 34px Georgia, serif'
  wrap(ctx, title || 'Untitled', 200, 240, 320, 42)
  if (author) {
    ctx.font = 'italic 20px Georgia, serif'
    ctx.fillStyle = 'rgba(253,250,243,0.8)'
    ctx.fillText(author.slice(0, 40), 200, 460)
  }
  return c.toDataURL('image/jpeg', 0.85)
}

function wrap(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, max: number, lh: number) {
  const words = text.split(/\s+/)
  let line = ''
  const lines: string[] = []
  for (const w of words) {
    if (ctx.measureText(line + w).width > max && line) {
      lines.push(line.trim())
      line = ''
    }
    line += w + ' '
  }
  lines.push(line.trim())
  const start = y - ((lines.length - 1) * lh) / 2
  lines.slice(0, 6).forEach((l, i) => ctx.fillText(l, x, start + i * lh))
}

function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16)
  const r = Math.max(0, Math.min(255, (n >> 16) + amt))
  const g = Math.max(0, Math.min(255, ((n >> 8) & 255) + amt))
  const b = Math.max(0, Math.min(255, (n & 255) + amt))
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`
}

export async function importPdf(file: File, tint: string): Promise<BookMeta> {
  const bytes = await file.arrayBuffer()
  const id = uid()
  await putFile(id, bytes.slice(0))
  let cover: string | null = null
  let title = file.name.replace(/\.pdf$/i, '')
  try {
    const pdfjs = await getPdfjs()
    const pdf = await pdfjs.getDocument({ data: bytes.slice(0) }).promise
    const meta = await pdf.getMetadata().catch(() => null)
    // @ts-expect-error info is loosely typed
    if (meta?.info?.Title) title = meta.info.Title
    const page = await pdf.getPage(1)
    const viewport = page.getViewport({ scale: 0.5 })
    const canvas = document.createElement('canvas')
    canvas.width = viewport.width
    canvas.height = viewport.height
    await page.render({ canvas, canvasContext: canvas.getContext('2d')!, viewport }).promise
    cover = canvas.toDataURL('image/jpeg', 0.7)
  } catch {
    cover = makeTitleCover(title, '', tint)
  }
  return baseMeta(id, 'pdf', title, '', cover)
}

export async function importEpub(file: File, tint: string): Promise<BookMeta> {
  const bytes = await file.arrayBuffer()
  const id = uid()
  await putFile(id, bytes.slice(0))
  let title = file.name.replace(/\.epub$/i, '')
  let author = ''
  let cover: string | null = null
  try {
    const ePub = (await import('epubjs')).default
    const book = ePub(bytes.slice(0))
    await book.ready
    const md = book.packaging?.metadata
    if (md?.title) title = md.title
    if (md?.creator) author = md.creator
    const coverUrl = await book.coverUrl().catch(() => null)
    if (coverUrl) {
      const blob = await (await fetch(coverUrl)).blob()
      cover = await blobToDataUrl(blob)
    }
    book.destroy()
  } catch {
    /* fall through to generated cover */
  }
  if (!cover) cover = makeTitleCover(title, author, tint)
  return baseMeta(id, 'epub', title, author, cover)
}

// Store the full page (scripts stripped, base href injected) for the live
// iframe viewer. `rawHtml` is the untouched page source from the proxy/paste.
export async function saveWebSnapshot(
  fallbackTitle: string,
  url: string,
  rawHtml: string,
  tint: string,
): Promise<BookMeta> {
  const id = uid()
  const { html, title } = sanitizeFullPage(rawHtml, url)
  await putFile(id, html)
  const finalTitle = title || fallbackTitle || url || 'Web page'
  const meta = baseMeta(id, 'web', finalTitle, hostOf(url), makeTitleCover(finalTitle, hostOf(url), tint))
  meta.sourceUrl = url
  return meta
}

function hostOf(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, '') } catch { return '' }
}

function baseMeta(id: string, kind: BookMeta['kind'], title: string, author: string, cover: string | null): BookMeta {
  return {
    id,
    kind,
    title,
    author,
    cover,
    shelf: 'Library',
    addedAt: Date.now(),
    openedAt: Date.now(),
    progress: 0,
    locator: '',
  }
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result as string)
    r.readAsDataURL(blob)
  })
}
