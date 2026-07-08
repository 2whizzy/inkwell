import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ALL_LEVELS, applyOverride, findLevel, LEVEL_ORDER } from './curriculum'
import { useMathStore } from './store'
import { setMuted } from './audio'
import { OverworldMap } from './components/OverworldMap'
import { Dojo } from './components/Dojo'
import { GameplayArena, type ArenaStats } from './components/GameplayArena'
import { VictoryScreen } from './components/VictoryScreen'

type Screen =
  | { name: 'map' }
  | { name: 'dojo'; levelId: string }
  | { name: 'play'; levelId: string; runKey: number }
  | { name: 'victory'; levelId: string; stats: ArenaStats; stars: number; coins: number }

function computeStars(level: { timeLimit: number | null }, stats: ArenaStats): number {
  const budget = level.timeLimit != null ? level.timeLimit * 1000 : 8000
  let s = stats.avgMs <= budget * 0.5 ? 3 : stats.avgMs <= budget * 0.8 ? 2 : 1
  if (stats.accuracy < 0.85 && s > 1) s -= 1 // sloppy runs cost a star
  return s
}

function initialScreen(): Screen {
  // Deep link: ?level=<id>&go=play jumps straight into a level (handy for testing).
  const q = new URLSearchParams(window.location.search)
  const id = q.get('level')
  if (id && findLevel(id)) {
    return q.get('go') === 'play'
      ? { name: 'play', levelId: id, runKey: Date.now() }
      : { name: 'dojo', levelId: id }
  }
  return { name: 'map' }
}

export default function App() {
  const [screen, setScreen] = useState<Screen>(initialScreen)
  const theme = useMathStore((s) => s.theme)
  const sound = useMathStore((s) => s.sound)
  const overrides = useMathStore((s) => s.overrides)
  const completeLevel = useMathStore((s) => s.completeLevel)

  useEffect(() => { document.documentElement.dataset.mmTheme = theme }, [theme])
  useEffect(() => { setMuted(!sound) }, [sound])

  const baseLevel = 'levelId' in screen ? findLevel(screen.levelId) : undefined
  const level = baseLevel ? applyOverride(baseLevel, overrides[baseLevel.id]) : undefined

  function win(levelId: string, stats: ArenaStats) {
    const lv = applyOverride(findLevel(levelId)!, overrides[levelId])
    const stars = computeStars(lv, stats)
    const coins = 10 + stars * 5
    completeLevel(levelId, stars, stats.avgMs, coins)
    setScreen({ name: 'victory', levelId, stats, stars, coins })
  }

  const nextId = level ? LEVEL_ORDER[LEVEL_ORDER.indexOf(level.id) + 1] : undefined

  return (
    <div className="mm-app">
      <AnimatePresence mode="wait">
        {screen.name === 'map' && (
          <motion.div key="map" className="screen" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, scale: 0.98 }} transition={{ duration: 0.25 }}>
            <OverworldMap onPick={(levelId) => setScreen({ name: 'dojo', levelId })} />
          </motion.div>
        )}

        {screen.name === 'dojo' && level && (
          <motion.div key={`dojo-${level.id}`} className="screen" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
            <Dojo
              level={level}
              world={level.world}
              onReady={() => setScreen({ name: 'play', levelId: level.id, runKey: Date.now() })}
              onBack={() => setScreen({ name: 'map' })}
            />
          </motion.div>
        )}

        {screen.name === 'play' && level && (
          <motion.div key={`play-${level.id}-${screen.runKey}`} className="screen" initial={{ opacity: 0, scale: 1.03 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
            <GameplayArena
              level={level}
              world={level.world}
              onWin={(stats) => win(level.id, stats)}
              onQuit={() => setScreen({ name: 'map' })}
            />
          </motion.div>
        )}

        {screen.name === 'victory' && level && (
          <motion.div key={`win-${level.id}`} className="screen" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
            <VictoryScreen
              level={level}
              world={level.world}
              stats={(screen as Extract<Screen, { name: 'victory' }>).stats}
              starsEarned={(screen as Extract<Screen, { name: 'victory' }>).stars}
              coinsEarned={(screen as Extract<Screen, { name: 'victory' }>).coins}
              hasNext={!!nextId}
              onReplay={() => setScreen({ name: 'play', levelId: level.id, runKey: Date.now() })}
              onNext={() => nextId && setScreen({ name: 'dojo', levelId: nextId })}
              onMap={() => setScreen({ name: 'map' })}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// Sanity: every level referenced in LEVEL_ORDER resolves.
if (ALL_LEVELS.length !== LEVEL_ORDER.length) throw new Error('curriculum mismatch')
