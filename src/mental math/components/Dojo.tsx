import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import type { LevelDef, WorldDef } from '../types'
import { Mascot } from './Mascot'

/** The pre-level tutorial: goal, rule, animated color-coded example, big READY button. */
export function Dojo({ level, world, onReady, onBack }: {
  level: LevelDef
  world: WorldDef
  onReady: () => void
  onBack: () => void
}) {
  const [revealed, setRevealed] = useState(0)
  const totalSteps = world.example.steps.length + 1 // steps + answer

  useEffect(() => {
    if (revealed >= totalSteps) return
    const t = setTimeout(() => setRevealed((r) => r + 1), 900)
    return () => clearTimeout(t)
  }, [revealed, totalSteps])

  return (
    <div className="dojo-scrim">
      <motion.div
        className="dojo"
        style={{ '--world-color': world.color } as React.CSSProperties}
        initial={{ y: 60, opacity: 0, scale: 0.92 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 22 }}
      >
        <button className="dojo-back" onClick={onBack} aria-label="Back to map">✕</button>
        <div className="dojo-emoji">{world.emoji}</div>
        <h1 className="dojo-goal">{world.name}</h1>
        <div className="dojo-level-chip">{level.name} · {level.desc}</div>
        <p className="dojo-rule">{world.rule}</p>

        <div className="dojo-example">
          <div className="dojo-prompt">{world.example.prompt}</div>
          {world.example.steps.map((s, i) => (
            <motion.div
              key={i}
              className={`dojo-step dojo-step-${i % 3}`}
              initial={{ opacity: 0, x: -18 }}
              animate={revealed > i ? { opacity: 1, x: 0 } : {}}
              transition={{ type: 'spring', stiffness: 300, damping: 24 }}
            >
              {s}
            </motion.div>
          ))}
          <motion.div
            className="dojo-answer"
            initial={{ opacity: 0, scale: 0.5 }}
            animate={revealed >= totalSteps ? { opacity: 1, scale: 1 } : {}}
            transition={{ type: 'spring', stiffness: 320, damping: 14 }}
          >
            = {world.example.answer}
          </motion.div>
        </div>

        <div className="dojo-mission">
          🎯 {level.streak} in a row{level.timeLimit ? ` · ⏱ ${level.timeLimit}s each` : ' · no timer'}
        </div>

        <motion.button
          className="ready-btn"
          onClick={onReady}
          whileTap={{ scale: 0.92 }}
          animate={{ scale: [1, 1.04, 1] }}
          transition={{ repeat: Infinity, duration: 1.4, ease: 'easeInOut' }}
        >
          I’M READY!
        </motion.button>

        <div className="dojo-mascot"><Mascot size={60} /></div>
      </motion.div>
    </div>
  )
}
