# 🖋️ Inkwell

A beautiful, organizable writing hub with built-in vocabulary mastery.

Three souls in one app:

1. **The Notebook** — a distraction-free, warmly animated writing surface with notebooks, search, pinning, per-note password locks, version history, and Markdown/PDF export.
2. **The Vocabulary Engine** — an SM-2 spaced-repetition system (Anki-style) for words, phrases, slang, sentence structures, and quotes — graded automatically by whether you *actually use them* in your writing.
3. **The Reading & Capture Hub** — a PDF / EPUB / web reader where selecting any passage sends it straight into your notebook or your vocabulary engine.

## Features

### Writing & vocabulary
- **Constellation strip** — today's due vocabulary shown as pills above the page; they light up the moment you use one naturally in your writing
- **Permanent gold "used" mark** — when you use a due word, it gets a quiet gold ink-stamp in your text with a hover tooltip showing where you learned it and when
- **Flip-card ("Ink Card") viewer** — tap any pill for meaning, example, and source
- **Automatic SM-2 grading** — used in writing → interval grows; surfaced but skipped → resurfaces sooner; repeatedly skipped → resets
- **Bulk import** in a simple `type / term / meaning / example / tags / source` format separated by `---`
- **Active WPM** — typing speed measured only during active bursts (pauses over 5s excluded)
- **Writing Health dashboard** — daily words, streak, GitHub-style consistency heatmap, WPM trend, vocabulary maturity garden (🌱→🌳)

### Reading & capture
- **Library** — import PDFs and EPUBs (stored in IndexedDB), Books-app-style cover grid with shelves, per-book reading progress, auto-generated covers
- **Readers** — PDF.js (continuous scroll, fit-width/page, selectable text layer, outline nav) and epub.js (true chapters, adjustable font/size, paper/sepia/dark/black themes)
- **Web reader** — paste any URL to read it inside the app in a clean reader view (via a tiny serverless proxy + Mozilla Readability), saved as a permanent snapshot
- **Multi-color highlighting** via the CSS Custom Highlight API (and epub.js annotations)
- **Select → Note or Learn** — any selected passage can be saved to a *Notes from Reading* gallery, or additionally pushed into the vocabulary engine (auto-classified by type, source preserved)

### Everywhere
- **Themes** — paper/ink (light/dark), three accent colors, five fonts, four paper textures, focus mode, typewriter mode, optional typing sounds
- **Fully responsive** — works on desktop, tablet, and phone
- **Local-first** — notes/vocab in localStorage, book files in IndexedDB; nothing leaves your device except a URL you explicitly ask the reader to fetch

## Development

```sh
npm install
npm run dev
```

## Deploy

Zero-config on [Vercel](https://vercel.com): import the repo, framework preset **Vite**, done. The one serverless function in [`api/read.js`](api/read.js) (the web-reader fetch proxy) is picked up automatically.

> The web reader's URL fetch needs the serverless proxy, so it works on the deployed Vercel site (or under `vercel dev`). On a plain `npm run dev` you can still paste a page's HTML directly. Everything else runs fully client-side.

Built with React + TypeScript + Vite, PDF.js, epub.js, and Mozilla Readability.
