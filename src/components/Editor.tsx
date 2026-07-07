import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import type { Note, Settings } from '../types'

interface Props {
  note: Note
  settings: Settings
  onChange: (content: string, title: string) => void
  onTyping: (chars: number, deltaMs: number) => void
}

export interface EditorHandle {
  markUsed: (term: string, source: string, date: string) => boolean
  reload: (html: string) => void
}

const PAUSE_THRESHOLD = 5000

let audioCtx: AudioContext | null = null
function clickSound() {
  try {
    audioCtx ||= new AudioContext()
    const osc = audioCtx.createOscillator()
    const gain = audioCtx.createGain()
    osc.type = 'sine'
    osc.frequency.value = 2400 + Math.random() * 800
    gain.gain.setValueAtTime(0.025, audioCtx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.04)
    osc.connect(gain).connect(audioCtx.destination)
    osc.start()
    osc.stop(audioCtx.currentTime + 0.05)
  } catch {
    /* audio unavailable */
  }
}

const FORMATS: { cmd: string; label: string; title: string; arg?: string }[] = [
  { cmd: 'bold', label: 'B', title: 'Bold (⌘B)' },
  { cmd: 'italic', label: 'I', title: 'Italic (⌘I)' },
  { cmd: 'underline', label: 'U', title: 'Underline (⌘U)' },
  { cmd: 'strikeThrough', label: 'S', title: 'Strikethrough' },
  { cmd: 'hiliteColor', label: '✎', title: 'Highlight', arg: '#f5e6a3' },
  { cmd: 'formatBlock', label: 'H1', title: 'Heading 1', arg: 'h1' },
  { cmd: 'formatBlock', label: 'H2', title: 'Heading 2', arg: 'h2' },
  { cmd: 'formatBlock', label: '❝', title: 'Blockquote', arg: 'blockquote' },
  { cmd: 'insertUnorderedList', label: '•', title: 'Bullet list' },
  { cmd: 'insertOrderedList', label: '1.', title: 'Numbered list' },
  { cmd: 'formatBlock', label: '¶', title: 'Paragraph', arg: 'p' },
]

export const Editor = forwardRef<EditorHandle, Props>(function Editor(
  { note, settings, onChange, onTyping },
  handleRef,
) {
  const ref = useRef<HTMLDivElement>(null)
  const titleRef = useRef<HTMLInputElement>(null)
  const lastKey = useRef(0)
  const [saving, setSaving] = useState(false)
  const saveTimer = useRef<number | undefined>(undefined)

  // Load content only when switching notes — never on our own updates.
  useEffect(() => {
    if (ref.current) ref.current.innerHTML = note.content
    if (titleRef.current) titleRef.current.value = note.title
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [note.id])

  // Autocorrect / spell-check are DOM attributes; keep them in sync with the setting.
  useEffect(() => {
    const val = settings.autocorrect ? 'on' : 'off'
    for (const el of [ref.current, titleRef.current]) {
      if (!el) continue
      el.setAttribute('autocorrect', val)
      el.setAttribute('autocapitalize', settings.autocorrect ? 'sentences' : 'off')
    }
  }, [settings.autocorrect])

  function emit() {
    setSaving(true)
    window.clearTimeout(saveTimer.current)
    saveTimer.current = window.setTimeout(() => setSaving(false), 900)
    onChange(ref.current?.innerHTML || '', titleRef.current?.value || '')
  }

  // Stamp the first unmarked occurrence of `term` with a permanent gold mark,
  // preserving the caret. Returns true if a mark was placed.
  useImperativeHandle(handleRef, () => ({
    reload(html: string) {
      if (ref.current) ref.current.innerHTML = html
    },
    markUsed(term, source, date) {
      const root = ref.current
      if (!root || !term) return false
      const caret = saveCaret(root)
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
      const lower = term.toLowerCase()
      let node: Node | null
      while ((node = walker.nextNode())) {
        const text = (node as Text).data
        const idx = text.toLowerCase().indexOf(lower)
        if (idx < 0) continue
        if ((node.parentElement as HTMLElement)?.closest('.used-mark')) continue
        const range = document.createRange()
        range.setStart(node, idx)
        range.setEnd(node, idx + term.length)
        const mark = document.createElement('span')
        mark.className = 'used-mark used-mark-fresh'
        mark.dataset.source = source || 'your vocabulary'
        mark.dataset.date = date
        mark.title = `Learned from ${source || 'your vocabulary'} · used ${date}`
        try {
          range.surroundContents(mark)
        } catch {
          return false // spans a formatting boundary — skip gracefully
        }
        window.setTimeout(() => mark.classList.remove('used-mark-fresh'), 1600)
        if (caret) restoreCaret(root, caret)
        emit()
        return true
      }
      return false
    },
  }))

  function handleKeyDown(e: React.KeyboardEvent) {
    const now = Date.now()
    if (e.key.length === 1 || e.key === 'Backspace' || e.key === 'Enter') {
      const delta = lastKey.current ? now - lastKey.current : 0
      onTyping(e.key.length === 1 ? 1 : 0, delta > 0 && delta < PAUSE_THRESHOLD ? delta : 0)
      lastKey.current = now
      if (settings.typingSound && e.key.length === 1) clickSound()
    }
    if ((e.metaKey || e.ctrlKey) && e.key === 'b') { e.preventDefault(); document.execCommand('bold') }
    if ((e.metaKey || e.ctrlKey) && e.key === 'i') { e.preventDefault(); document.execCommand('italic') }
    if ((e.metaKey || e.ctrlKey) && e.key === 'u') { e.preventDefault(); document.execCommand('underline') }
  }

  function centerCaret() {
    if (!settings.typewriterMode) return
    const sel = window.getSelection()
    if (!sel || sel.rangeCount === 0) return
    const range = sel.getRangeAt(0).cloneRange()
    range.collapse(true)
    const rect = range.getBoundingClientRect()
    if (rect.top === 0 && rect.bottom === 0) return
    const scroller = document.querySelector('.editor-scroll')
    if (!scroller) return
    const target = rect.top - scroller.getBoundingClientRect().top - scroller.clientHeight / 2
    if (Math.abs(target) > 40) scroller.scrollBy({ top: target, behavior: 'smooth' })
  }

  return (
    <div className={`editor-wrap ${settings.focusMode ? 'focus-mode' : ''}`}>
      <div className="editor-toolbar">
        {FORMATS.map((f, i) => (
          <button
            key={i}
            className={`fmt-btn fmt-${f.cmd}${f.arg ? '-' + f.arg : ''}`}
            title={f.title}
            onMouseDown={(e) => {
              e.preventDefault()
              document.execCommand(f.cmd, false, f.arg)
              emit()
            }}
          >
            {f.label}
          </button>
        ))}
        <span className={`save-dot ${saving ? 'save-dot-active' : ''}`} title="Autosaved">
          🖋
        </span>
      </div>
      <div className="editor-scroll">
        <div className={`page texture-${settings.paperTexture}`} key={note.id}>
          <input
            ref={titleRef}
            className="note-title"
            placeholder="Untitled"
            defaultValue={note.title}
            onInput={emit}
            style={{ fontFamily: settings.font }}
          />
          <div
            ref={ref}
            className="note-body"
            contentEditable
            suppressContentEditableWarning
            spellCheck={settings.autocorrect}
            data-placeholder="Begin writing…"
            style={{
              fontFamily: settings.font,
              fontSize: settings.fontSize,
              lineHeight: settings.lineHeight,
            }}
            onInput={() => {
              emit()
              centerCaret()
            }}
            onKeyDown={handleKeyDown}
          />
        </div>
      </div>
    </div>
  )
})

// Caret as an absolute character offset within the editable root.
function saveCaret(root: HTMLElement): number | null {
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0 || !root.contains(sel.anchorNode)) return null
  const range = sel.getRangeAt(0)
  const pre = range.cloneRange()
  pre.selectNodeContents(root)
  pre.setEnd(range.endContainer, range.endOffset)
  return pre.toString().length
}

function restoreCaret(root: HTMLElement, offset: number) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  let remaining = offset
  let node: Node | null
  while ((node = walker.nextNode())) {
    const len = (node as Text).data.length
    if (remaining <= len) {
      const sel = window.getSelection()
      const range = document.createRange()
      range.setStart(node, Math.max(0, remaining))
      range.collapse(true)
      sel?.removeAllRanges()
      sel?.addRange(range)
      return
    }
    remaining -= len
  }
}
