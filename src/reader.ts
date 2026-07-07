import type { VocabType } from './types'

// Auto-classify a captured passage into a vocab entry type (best-effort).
export function classifyPassage(text: string): VocabType {
  const t = text.trim()
  const words = t.split(/\s+/).filter(Boolean)
  const quoted = /^["'“].*["'”]$/.test(t)
  if (t.includes('...') || t.includes('…')) return 'sentence_structure'
  if (words.length === 1) return 'word'
  if (quoted || words.length > 12) return 'quote'
  if (/\b(gonna|wanna|lit|vibe|slay|bet|lowkey|highkey|sus)\b/i.test(t)) return 'slang'
  if (words.length <= 4) return 'phrase'
  return words.length > 8 ? 'quote' : 'phrase'
}

export interface ReadableArticle {
  title: string
  byline: string
  contentHtml: string
  textLength: number
}

// Extract a clean reader-mode article from raw HTML using Mozilla Readability.
export async function extractReadable(html: string, baseUrl: string): Promise<ReadableArticle | null> {
  try {
    const { Readability } = await import('@mozilla/readability')
    const doc = new DOMParser().parseFromString(html, 'text/html')
    // Resolve relative URLs against the source so images/links still work.
    const base = doc.createElement('base')
    base.href = baseUrl
    doc.head.appendChild(base)
    const article = new Readability(doc).parse()
    if (!article || !article.content) return null
    return {
      title: article.title || 'Untitled',
      byline: article.byline || '',
      contentHtml: sanitize(article.content),
      textLength: article.textContent?.length || 0,
    }
  } catch {
    return null
  }
}

// Prepare a full page for the live iframe: drop scripts, neutralize inline
// handlers, inject a <base> so relative CSS/images/links resolve to the origin,
// and force links to open in a new tab. Keeps styles + images for fidelity.
export function sanitizeFullPage(html: string, baseUrl: string): { html: string; title: string } {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  doc.querySelectorAll('script, noscript, iframe, object, embed').forEach((el) => el.remove())
  doc.querySelectorAll('*').forEach((el) => {
    for (const attr of Array.from(el.attributes)) {
      if (/^on/i.test(attr.name)) el.removeAttribute(attr.name)
    }
  })
  if (baseUrl) {
    const head = doc.head || doc.documentElement
    let base = doc.querySelector('base')
    if (!base) { base = doc.createElement('base'); head.prepend(base) }
    base.setAttribute('href', baseUrl)
  }
  doc.querySelectorAll('a[href]').forEach((a) => {
    a.setAttribute('target', '_blank')
    a.setAttribute('rel', 'noreferrer')
  })
  const title = doc.querySelector('title')?.textContent?.trim() || ''
  return { html: '<!doctype html>' + doc.documentElement.outerHTML, title }
}

// Strip scripts/handlers so injected reader HTML is safe to render.
export function sanitize(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  doc.querySelectorAll('script, style, iframe, object, embed, link').forEach((el) => el.remove())
  doc.querySelectorAll('*').forEach((el) => {
    for (const attr of Array.from(el.attributes)) {
      if (/^on/i.test(attr.name) || (attr.name === 'href' && /^javascript:/i.test(attr.value))) {
        el.removeAttribute(attr.name)
      }
    }
  })
  return doc.body.innerHTML
}

let pdfjs: typeof import('pdfjs-dist') | null = null
export async function getPdfjs() {
  if (pdfjs) return pdfjs
  const lib = await import('pdfjs-dist')
  const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default
  lib.GlobalWorkerOptions.workerSrc = workerUrl
  pdfjs = lib
  return lib
}

// Try the serverless proxy; if unavailable (e.g. local `npm run dev`), signal fallback.
export async function fetchViaProxy(url: string): Promise<string> {
  const res = await fetch(`/api/read?url=${encodeURIComponent(url)}`)
  if (!res.ok) throw new Error(`proxy ${res.status}`)
  return res.text()
}
