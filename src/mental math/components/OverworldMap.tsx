import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { WORLDS } from '../curriculum'
import { useMathStore, isUnlocked, activeLevelId } from '../store'
import { Mascot } from './Mascot'
import { AdminGate } from './SettingsPanel'

const CHEERS = [
  'Ready to train that brain?',
  'This one looks fun!',
  'You’re getting so fast!',
  'Let’s gooo! 🚀',
  'Math powers: charging…',
]

export function OverworldMap({ onPick }: { onPick: (levelId: string) => void }) {
  const stars = useMathStore((s) => s.stars)
  const coins = useMathStore((s) => s.coins)
  const theme = useMathStore((s) => s.theme)
  const sound = useMathStore((s) => s.sound)
  const toggleTheme = useMathStore((s) => s.toggleTheme)
  const toggleSound = useMathStore((s) => s.toggleSound)
  const active = activeLevelId(stars)
  const cheer = CHEERS[Math.floor(Date.now() / 60000) % CHEERS.length]
  const [adminOpen, setAdminOpen] = useState(() => new URLSearchParams(window.location.search).get('admin') === '1')

  return (
    <div className="overworld">
      <header className="ow-header">
        <div className="ow-title">🧠 Number Ninja</div>
        <div className="ow-header-right">
          <div className="coin-pill">🪙 {coins}</div>
          <button className="icon-btn" onClick={toggleSound} aria-label="Toggle sound">{sound ? '🔊' : '🔇'}</button>
          <button className="icon-btn" onClick={toggleTheme} aria-label="Toggle theme">{theme === 'day' ? '🌙' : '☀️'}</button>
          <button className="icon-btn" onClick={() => setAdminOpen(true)} aria-label="Level editor">⚙️</button>
        </div>
      </header>

      <AnimatePresence>
        {adminOpen && <AdminGate key="admin" onClose={() => setAdminOpen(false)} />}
      </AnimatePresence>

      <div className="path">
        {WORLDS.map((world, wi) => (
          <section key={world.id} className="world" style={{ '--world-color': world.color } as React.CSSProperties}>
            <div className="world-banner">
              <span className="world-emoji">{world.emoji}</span>
              <div>
                <div className="world-name">{world.name}</div>
                <div className="world-rule">{world.rule}</div>
              </div>
            </div>
            <div className="world-nodes">
              {world.levels.map((level, li) => {
                const unlocked = isUnlocked(level.id, stars)
                const result = stars[level.id]
                const isActive = level.id === active
                const side = (wi * 3 + li) % 4 // gentle winding path
                return (
                  <div key={level.id} className={`node-slot node-side-${side}`}>
                    {isActive && (
                      <div className="node-mascot">
                        <Mascot message={cheer} size={64} />
                      </div>
                    )}
                    <motion.button
                      className={`node ${!unlocked ? 'node-locked' : ''} ${result ? 'node-done' : ''} ${isActive ? 'node-active' : ''}`}
                      disabled={!unlocked}
                      onClick={() => onPick(level.id)}
                      whileTap={unlocked ? { scale: 0.88 } : undefined}
                      animate={isActive ? { scale: [1, 1.08, 1] } : {}}
                      transition={isActive ? { repeat: Infinity, duration: 1.6, ease: 'easeInOut' } : { type: 'spring', stiffness: 400, damping: 18 }}
                    >
                      <span className="node-icon">{!unlocked ? '🔒' : result ? world.emoji : li + 1}</span>
                      {result && (
                        <span className="node-stars">
                          {'★'.repeat(result.stars)}{'☆'.repeat(3 - result.stars)}
                        </span>
                      )}
                    </motion.button>
                    <div className={`node-label ${!unlocked ? 'node-label-locked' : ''}`}>{level.name}</div>
                  </div>
                )
              })}
            </div>
          </section>
        ))}
        <div className="path-end">🏆 More worlds coming soon!</div>
      </div>
    </div>
  )
}
