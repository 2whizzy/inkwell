import type { DayStats, VocabEntry } from '../types'
import { maturity } from '../types'

interface Props {
  stats: DayStats[]
  vocab: VocabEntry[]
  dailyGoal: number
}

function activeWpm(d: DayStats): number {
  if (d.activeMs < 5000) return 0
  return Math.round(d.chars / 5 / (d.activeMs / 60000))
}

function streak(stats: DayStats[]): number {
  const days = new Set(stats.filter((d) => d.words > 0).map((d) => d.date))
  let count = 0
  const cur = new Date()
  // today counts if written; otherwise start from yesterday
  if (!days.has(cur.toISOString().slice(0, 10))) cur.setDate(cur.getDate() - 1)
  while (days.has(cur.toISOString().slice(0, 10))) {
    count++
    cur.setDate(cur.getDate() - 1)
  }
  return count
}

export function StatsView({ stats, vocab, dailyGoal }: Props) {
  const todayStr = new Date().toISOString().slice(0, 10)
  const todayStats = stats.find((d) => d.date === todayStr)
  const totalWords = stats.reduce((s, d) => s + d.words, 0)
  const recentWpm = stats
    .filter((d) => d.activeMs > 10000)
    .slice(-14)
    .map(activeWpm)
  const avgWpm = recentWpm.length
    ? Math.round(recentWpm.reduce((a, b) => a + b, 0) / recentWpm.length)
    : 0
  const mature = vocab.filter((e) => maturity(e) === 'Mature').length
  const goalPct = Math.min(100, Math.round(((todayStats?.words || 0) / dailyGoal) * 100))

  // heatmap: last 17 weeks
  const weeks: { date: string; words: number }[][] = []
  const start = new Date()
  start.setDate(start.getDate() - (16 * 7 + start.getDay()))
  const byDate = new Map(stats.map((d) => [d.date, d.words]))
  for (let w = 0; w < 17; w++) {
    const col: { date: string; words: number }[] = []
    for (let d = 0; d < 7; d++) {
      const dt = new Date(start)
      dt.setDate(start.getDate() + w * 7 + d)
      if (dt > new Date()) break
      const ds = dt.toISOString().slice(0, 10)
      col.push({ date: ds, words: byDate.get(ds) || 0 })
    }
    weeks.push(col)
  }
  const maxWords = Math.max(100, ...stats.map((d) => d.words))

  // last-14-day bars
  const bars: { date: string; words: number; wpm: number }[] = []
  for (let i = 13; i >= 0; i--) {
    const dt = new Date()
    dt.setDate(dt.getDate() - i)
    const ds = dt.toISOString().slice(0, 10)
    const st = stats.find((d) => d.date === ds)
    bars.push({ date: ds, words: st?.words || 0, wpm: st ? activeWpm(st) : 0 })
  }
  const maxBar = Math.max(50, ...bars.map((b) => b.words))
  const wpmPoints = bars
    .map((b, i) => ({ x: (i / 13) * 100, y: b.wpm }))
    .filter((p) => p.y > 0)
  const maxWpm = Math.max(40, ...wpmPoints.map((p) => p.y))

  return (
    <div className="stats-view">
      <h2>Writing Health</h2>
      <div className="stat-cards">
        <div className="stat-card">
          <span className="stat-value">{todayStats?.words || 0}</span>
          <span className="stat-label">words today</span>
          <div className="goal-ring">
            <div className="goal-bar" style={{ width: `${goalPct}%` }} />
          </div>
          <span className="stat-sub">{goalPct}% of {dailyGoal}-word goal</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{todayStats ? activeWpm(todayStats) : 0}</span>
          <span className="stat-label">active WPM today</span>
          <span className="stat-sub">{avgWpm} avg last 14 days — pauses over 5s excluded</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{streak(stats)}🔥</span>
          <span className="stat-label">day streak</span>
          <span className="stat-sub">{totalWords.toLocaleString()} words all-time</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{mature}🌳</span>
          <span className="stat-label">mature vocabulary</span>
          <span className="stat-sub">of {vocab.length} entries in your garden</span>
        </div>
      </div>

      <h3>Consistency</h3>
      <div className="heatmap-scroll">
        <div className="heatmap">
          {weeks.map((col, i) => (
            <div key={i} className="heatmap-col">
              {col.map((c) => (
                <div
                  key={c.date}
                  className="heatmap-cell"
                  title={`${c.date}: ${c.words} words`}
                  style={{ opacity: c.words === 0 ? undefined : 0.25 + 0.75 * Math.min(1, c.words / maxWords) }}
                  data-filled={c.words > 0}
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      <h3>Last 14 days</h3>
      <div className="bars-chart">
        {bars.map((b) => (
          <div key={b.date} className="bar-col" title={`${b.date}: ${b.words} words${b.wpm ? `, ${b.wpm} WPM` : ''}`}>
            <div className="bar" style={{ height: `${(b.words / maxBar) * 100}%` }} />
            <span className="bar-label">{b.date.slice(8)}</span>
          </div>
        ))}
      </div>

      {wpmPoints.length > 1 && (
        <>
          <h3>Active WPM trend</h3>
          <svg className="wpm-chart" viewBox="0 0 100 40" preserveAspectRatio="none">
            <polyline
              fill="none"
              strokeWidth="1"
              points={wpmPoints.map((p) => `${p.x},${38 - (p.y / maxWpm) * 34}`).join(' ')}
            />
            {wpmPoints.map((p, i) => (
              <circle key={i} cx={p.x} cy={38 - (p.y / maxWpm) * 34} r="1.4" />
            ))}
          </svg>
        </>
      )}
    </div>
  )
}
