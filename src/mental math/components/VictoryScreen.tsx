import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import Confetti from 'react-confetti'
import type { LevelDef, WorldDef } from '../types'
import type { ArenaStats } from './GameplayArena'
import { sfxFanfare } from '../audio'
import { Mascot } from './Mascot'

export function VictoryScreen({ level, world, stats, starsEarned, coinsEarned, hasNext, onReplay, onNext, onMap }: {
  level: LevelDef
  world: WorldDef
  stats: ArenaStats
  starsEarned: number
  coinsEarned: number
  hasNext: boolean
  onReplay: () => void
  onNext: () => void
  onMap: () => void
}) {
  const [size, setSize] = useState({ w: window.innerWidth, h: window.innerHeight })
  const [coinsShown, setCoinsShown] = useState(0)

  useEffect(() => {
    sfxFanfare()
    const onResize = () => setSize({ w: window.innerWidth, h: window.innerHeight })
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // Coins tick up into the piggy bank one by one.
  useEffect(() => {
    if (coinsShown >= coinsEarned) return
    const t = setTimeout(() => setCoinsShown((c) => c + 1), 120)
    return () => clearTimeout(t)
  }, [coinsShown, coinsEarned])

  const accuracyPct = Math.round(stats.accuracy * 100)
  const avgSec = (stats.avgMs / 1000).toFixed(1)
  const cheer = useMemo(() => {
    if (starsEarned === 3) return 'PERFECT! You’re a legend!'
    if (starsEarned === 2) return 'Awesome speed!'
    return 'Level cleared — nice work!'
  }, [starsEarned])

  return (
    <div className="victory">
      <Confetti width={size.w} height={size.h} numberOfPieces={280} recycle={false} gravity={0.25} />
      <motion.div
        className="victory-badge"
        style={{ '--world-color': world.color } as React.CSSProperties}
        initial={{ y: -400, rotate: -8 }}
        animate={{ y: 0, rotate: 0 }}
        transition={{ type: 'spring', stiffness: 210, damping: 13 }}
      >
        LEVEL CLEARED!
      </motion.div>

      <div className="victory-stars">
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className={i < starsEarned ? 'star-on' : 'star-off'}
            initial={{ scale: 0, rotate: -90 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ delay: 0.5 + i * 0.25, type: 'spring', stiffness: 300, damping: 12 }}
          >
            ★
          </motion.span>
        ))}
      </div>

      <div className="victory-sub">{world.emoji} {level.name}</div>

      <div className="victory-stats">
        <div className="stat-card">
          <div className="stat-value">{accuracyPct}%</div>
          <div className="stat-label">Accuracy</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{avgSec}s</div>
          <div className="stat-label">Average speed</div>
        </div>
      </div>

      <motion.div className="piggy" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.9, type: 'spring', stiffness: 260, damping: 14 }}>
        <motion.span
          key={coinsShown}
          className="piggy-icon"
          animate={coinsShown < coinsEarned ? { scale: [1, 1.12, 1] } : {}}
          transition={{ duration: 0.12 }}
        >
          🐷
        </motion.span>
        <span className="piggy-count">+{coinsShown} 🪙</span>
      </motion.div>

      <div className="victory-mascot"><Mascot message={cheer} mood="wow" /></div>

      <div className="victory-btns">
        <motion.button className="btn-secondary" whileTap={{ scale: 0.92 }} onClick={onReplay}>
          🔁 Replay (beat your time!)
        </motion.button>
        {hasNext ? (
          <motion.button className="btn-primary" whileTap={{ scale: 0.92 }} onClick={onNext}>
            Next Level ➡️
          </motion.button>
        ) : (
          <motion.button className="btn-primary" whileTap={{ scale: 0.92 }} onClick={onMap}>
            🗺 Back to Map
          </motion.button>
        )}
      </div>
      <button className="victory-map-link" onClick={onMap}>🗺 Journey map</button>
    </div>
  )
}
