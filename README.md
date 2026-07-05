# 🖋️ Inkwell

A beautiful, organizable writing hub with built-in vocabulary mastery.

Two souls in one app:

1. **The Notebook** — a distraction-free, warmly animated writing surface with notebooks, search, pinning, per-note password locks, version history, and Markdown/PDF export.
2. **The Vocabulary Engine** — an SM-2 spaced-repetition system (Anki-style) for words, phrases, slang, sentence structures, and quotes — graded automatically by whether you *actually use them* in your writing.

## Features

- **Constellation strip** — today's due vocabulary shown as pills above the page; they light up the moment you use one naturally in your writing
- **Flip-card ("Ink Card") viewer** — tap any pill for meaning, example, and source
- **Automatic SM-2 grading** — used in writing → interval grows; surfaced but skipped → resurfaces sooner; repeatedly skipped → resets
- **Bulk import** in a simple `type / term / meaning / example / tags / source` format separated by `---`
- **Active WPM** — typing speed measured only during active bursts (pauses over 5s excluded)
- **Writing Health dashboard** — daily words, streak, GitHub-style consistency heatmap, WPM trend, vocabulary maturity garden (🌱→🌳)
- **Themes** — paper/ink (light/dark), three accent colors, five fonts, four paper textures, focus mode, typewriter mode, optional typing sounds
- **Fully responsive** — works on desktop, tablet, and phone
- **Local-first** — everything stored in your browser (localStorage); nothing leaves your device

## Development

```sh
npm install
npm run dev
```

## Deploy

Zero-config on [Vercel](https://vercel.com): import the repo, framework preset **Vite**, done.

Built with React + TypeScript + Vite. No backend, no external services.
