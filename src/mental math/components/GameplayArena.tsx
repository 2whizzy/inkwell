import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { LevelDef, Problem, WorldDef } from '../types'
import { sfxBuzz, sfxChime, sfxSwoosh, speak, stopSpeech } from '../audio'
import { Numpad } from './Numpad'
import { TimerBar } from './TimerBar'
import { Mascot } from './Mascot'

export interface ArenaStats {
  accuracy: number
  avgMs: number
}

type Phase = 'showing' | 'input' | 'correct' | 'wrong'

const OOPS = [
  'Whoops! Let’s build that streak again!',
  'So close! You’ve got this!',
  'Shake it off — next one’s yours!',
  'Even robots miss sometimes. Go again!',
]

export function GameplayArena({ level, world, onWin, onQuit }: {
  level: LevelDef
  world: WorldDef
  onWin: (stats: ArenaStats) => void
  onQuit: () => void
}) {
  const [streak, setStreak] = useState(0)
  const [qKey, setQKey] = useState(0)
  const [problem, setProblem] = useState<Problem>(() => level.gen())
  const [phase, setPhase] = useState<Phase>('input')
  const [input, setInput] = useState('')
  const [stepIdx, setStepIdx] = useState(0)
  const [mascotMsg, setMascotMsg] = useState<string>()
  const [burst, setBurst] = useState(0)

  const times = useRef<number[]>([])
  const misses = useRef(0)
  const inputStart = useRef(performance.now())
  const won = useRef(false)
  const streakRef = useRef(0)
  streakRef.current = streak

  const timed = level.timeLimit != null
  const isScaffold = level.mode === 'scaffold'
  const steps = problem.steps

  // ----- question lifecycle -----

  const nextQuestion = useCallback(() => {
    setProblem(level.gen())
    setQKey((k) => k + 1)
    setInput('')
    setStepIdx(0)
    const needsIntro = level.mode === 'flash' || level.mode === 'audio'
    setPhase(needsIntro ? 'showing' : 'input')
    if (!needsIntro) inputStart.current = performance.now()
  }, [level])

  // Flash: reveal, then fade away and start the clock.
  useEffect(() => {
    if (level.mode !== 'flash' || phase !== 'showing') return
    const t = setTimeout(() => {
      sfxSwoosh()
      setPhase('input')
      inputStart.current = performance.now()
    }, (level.flashSeconds ?? 1.5) * 1000)
    return () => clearTimeout(t)
  }, [level, phase, qKey])

  // Audio: speak the problem; the clock starts the moment speech ends.
  useEffect(() => {
    if (level.mode !== 'audio' || phase !== 'showing') return
    let live = true
    speak(problem.speech ?? problem.display).then(() => {
      if (!live) return
      setPhase('input')
      inputStart.current = performance.now()
    })
    return () => { live = false; stopSpeech() }
  }, [level, phase, qKey, problem])

  useEffect(() => () => stopSpeech(), [])

  // ----- outcomes -----

  const fail = useCallback(() => {
    if (won.current) return
    misses.current += 1
    sfxBuzz()
    setStreak(0)
    setInput('')
    setPhase('wrong')
    setMascotMsg(OOPS[Math.floor(Math.random() * OOPS.length)])
    setTimeout(() => {
      setMascotMsg(undefined)
      nextQuestion()
    }, 900)
  }, [nextQuestion])

  const succeed = useCallback(() => {
    if (won.current) return
    times.current.push(performance.now() - inputStart.current)
    const s = streakRef.current + 1
    sfxChime(s)
    setStreak(s)
    setBurst((b) => b + 1)
    setPhase('correct')
    if (s >= level.streak) {
      won.current = true
      const total = times.current.length + misses.current
      const avg = times.current.reduce((a, b) => a + b, 0) / Math.max(times.current.length, 1)
      setTimeout(() => onWin({ accuracy: times.current.length / Math.max(total, 1), avgMs: avg }), 500)
      return
    }
    setTimeout(nextQuestion, 400)
  }, [level.streak, nextQuestion, onWin])

  const submit = useCallback(() => {
    if (phase !== 'input' || !input) return
    if (isScaffold && steps) {
      if (input === steps[stepIdx].answer) {
        if (stepIdx === steps.length - 1) { succeed(); return }
        sfxChime(streakRef.current)
        setStepIdx((i) => i + 1)
        setInput('')
      } else fail()
      return
    }
    if (level.mode === 'split' && problem.split) {
      if (input === problem.split.middle) succeed()
      else fail()
      return
    }
    if (input === problem.answer) succeed()
    else fail()
  }, [phase, input, isScaffold, steps, stepIdx, level.mode, problem, succeed, fail])

  const swipe = useCallback((saysValid: boolean) => {
    if (phase !== 'input') return
    if (saysValid === problem.valid) succeed()
    else fail()
  }, [phase, problem.valid, succeed, fail])

  // Physical keyboard works too (nice on desktop), but the numpad is the star.
  useEffect(() => {
    if (level.mode === 'swipe') return
    const h = (e: KeyboardEvent) => {
      if (/^[0-9]$/.test(e.key)) setInput((v) => (v.length < 8 ? v + e.key : v))
      else if (e.key === 'Backspace') setInput((v) => v.slice(0, -1))
      else if (e.key === 'Enter') submit()
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [level.mode, submit])

  const timerRunning = timed && phase === 'input'

  // ----- render helpers -----

  const equation = useMemo(() => {
    if (level.mode === 'highlight' && problem.parts) {
      return problem.parts.map((p, i) => (
        <span key={i} className={p.color ? `hl-${p.color}` : ''}>{p.text}</span>
      ))
    }
    return problem.display
  }, [level.mode, problem])

  const fireScale = 1 + Math.min(streak / level.streak, 1) * 0.6

  return (
    <motion.div
      className="arena"
      key={level.id}
      style={{ '--world-color': world.color } as React.CSSProperties}
      animate={phase === 'wrong' ? { x: [0, -14, 12, -8, 6, 0] } : { x: 0 }}
      transition={{ duration: 0.45 }}
    >
      {/* HUD */}
      <div className="hud">
        <div className="hud-left">
          <button className="hud-quit" onClick={onQuit} aria-label="Quit level">✕</button>
          <AnimatePresence mode="popLayout">
            <motion.div
              key={streak}
              className={`streak-meter ${streak > 0 ? 'streak-hot' : ''}`}
              initial={streak > 0 ? { scale: 1.6 } : { scale: 1 }}
              animate={{ scale: 1 }}
              style={{ fontSize: `${fireScale}em` }}
            >
              🔥 <b>{streak}</b>
            </motion.div>
          </AnimatePresence>
        </div>
        <div className="hud-goal">Get <b>{level.streak}</b> in a row!</div>
        <div className="hud-right">
          {timed
            ? <TimerBar seconds={level.timeLimit!} running={timerRunning} resetKey={qKey} onTimeout={fail} />
            : <span className="hud-untimed">∞ no timer</span>}
        </div>
      </div>

      {/* progress dots */}
      <div className="streak-dots">
        {Array.from({ length: level.streak }, (_, i) => (
          <div key={i} className={`dot ${i < streak ? 'dot-on' : ''}`} />
        ))}
      </div>

      {/* Equation canvas */}
      <div className="canvas">
        {level.mode === 'audio' ? (
          <div className="soundwave" aria-label="Listen!">
            {Array.from({ length: 7 }, (_, i) => (
              <motion.span
                key={i}
                className="wave-bar"
                animate={phase === 'showing' ? { scaleY: [0.3, 1, 0.3] } : { scaleY: 0.3 }}
                transition={{ repeat: Infinity, duration: 0.9, delay: i * 0.1 }}
              />
            ))}
            <div className="wave-hint">{phase === 'showing' ? 'Listen…' : 'Type what you heard!'}</div>
          </div>
        ) : level.mode === 'flash' ? (
          <AnimatePresence mode="wait">
            {phase === 'showing' ? (
              <motion.div key={`f${qKey}`} className="equation" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
                {problem.display}
              </motion.div>
            ) : (
              <motion.div key={`b${qKey}`} className="equation equation-gone" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                🧠 …
              </motion.div>
            )}
          </AnimatePresence>
        ) : level.mode === 'swipe' ? (
          <SwipeCard key={qKey} display={problem.display} onSwipe={swipe} phase={phase} />
        ) : (
          <div className="equation">{equation}</div>
        )}

        {/* split mode: 2 [ ] 3 */}
        {level.mode === 'split' && problem.split && (
          <div className="split-row">
            {phase === 'correct' ? (
              <motion.div className="equation split-snap" initial={{ scale: 1.15 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 300, damping: 12 }}>
                {problem.answer}
              </motion.div>
            ) : (
              <>
                <span className="split-digit">{problem.split.lead}</span>
                <InputBox value={input} phase={phase} small />
                <span className="split-digit">{problem.split.tail}</span>
              </>
            )}
          </div>
        )}

        {/* scaffold steps */}
        {isScaffold && steps && (
          <div className="scaffold">
            {steps.map((s, i) => (
              <div key={i} className={`scaffold-row ${i === stepIdx ? 'scaffold-active' : i < stepIdx ? 'scaffold-done' : 'scaffold-todo'}`}>
                <span className="scaffold-label">{s.label} =</span>
                {i < stepIdx
                  ? <span className="scaffold-answer">{s.answer}</span>
                  : i === stepIdx
                    ? <InputBox value={input} phase={phase} small />
                    : <span className="scaffold-blank">?</span>}
              </div>
            ))}
          </div>
        )}

        {/* main input box */}
        {!isScaffold && level.mode !== 'swipe' && level.mode !== 'split' && (
          <InputBox value={input} phase={phase} />
        )}

        {/* gold particle burst */}
        <AnimatePresence>
          {phase === 'correct' && <Particles key={burst} />}
        </AnimatePresence>
      </div>

      {/* mascot pops in on mistakes */}
      <AnimatePresence>
        {mascotMsg && (
          <motion.div className="arena-mascot" initial={{ y: 120 }} animate={{ y: 0 }} exit={{ y: 140 }} transition={{ type: 'spring', stiffness: 300, damping: 22 }}>
            <Mascot message={mascotMsg} mood="oops" />
          </motion.div>
        )}
      </AnimatePresence>

      {level.mode === 'swipe' ? (
        <div className="swipe-btns">
          <motion.button className="swipe-btn swipe-no" whileTap={{ scale: 0.9 }} onClick={() => swipe(false)}>⬅️ No trick</motion.button>
          <motion.button className="swipe-btn swipe-yes" whileTap={{ scale: 0.9 }} onClick={() => swipe(true)}>Trick works! ➡️</motion.button>
        </div>
      ) : (
        <Numpad
          onDigit={(d) => phase === 'input' && setInput((v) => (v.length < 8 ? v + d : v))}
          onBackspace={() => setInput((v) => v.slice(0, -1))}
          onEnter={submit}
          disabled={phase !== 'input'}
        />
      )}
    </motion.div>
  )
}

function InputBox({ value, phase, small }: { value: string; phase: Phase; small?: boolean }) {
  return (
    <div className={`inputbox ${small ? 'inputbox-small' : ''} ${phase === 'correct' ? 'inputbox-good' : ''} ${phase === 'wrong' ? 'inputbox-bad' : ''}`}>
      {value || <span className="inputbox-caret">|</span>}
    </div>
  )
}

function Particles() {
  const dots = useMemo(() => Array.from({ length: 14 }, () => ({
    x: (Math.random() - 0.5) * 260,
    y: -40 - Math.random() * 160,
    s: 0.5 + Math.random(),
  })), [])
  return (
    <div className="particles">
      {dots.map((d, i) => (
        <motion.span
          key={i}
          className="particle"
          initial={{ x: 0, y: 0, opacity: 1, scale: d.s }}
          animate={{ x: d.x, y: d.y, opacity: 0, scale: 0 }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
        />
      ))}
    </div>
  )
}

function SwipeCard({ display, onSwipe, phase }: { display: string; onSwipe: (valid: boolean) => void; phase: Phase }) {
  return (
    <motion.div
      className={`swipe-card ${phase === 'correct' ? 'inputbox-good' : ''} ${phase === 'wrong' ? 'inputbox-bad' : ''}`}
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.8}
      onDragEnd={(_, info) => {
        if (info.offset.x > 90) onSwipe(true)
        else if (info.offset.x < -90) onSwipe(false)
      }}
      whileDrag={{ rotate: 3 }}
      initial={{ scale: 0.7, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
    >
      {display}
    </motion.div>
  )
}
