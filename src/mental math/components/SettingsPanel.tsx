import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import type { LevelDef } from '../types'
import { WORLDS, applyOverride } from '../curriculum'
import { useMathStore } from '../store'
import { Numpad } from './Numpad'
import { sfxChime, sfxBuzz } from '../audio'

const PASSCODE = '099302'

/** Passcode gate → level editor. Rendered as a full-screen overlay from the overworld. */
export function AdminGate({ onClose }: { onClose: () => void }) {
  const [code, setCode] = useState('')
  const [unlocked, setUnlocked] = useState(false)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (code.length < PASSCODE.length) return
    if (code === PASSCODE) { sfxChime(6); setUnlocked(true) }
    else { sfxBuzz(); setError(true); setTimeout(() => { setError(false); setCode('') }, 500) }
  }, [code])

  if (unlocked) return <SettingsPanel onClose={onClose} />

  return (
    <div className="admin-scrim">
      <motion.div
        className="passcode-modal"
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1, x: error ? [0, -12, 10, -6, 0] : 0 }}
        transition={{ duration: error ? 0.4 : 0.25 }}
      >
        <button className="dojo-back" onClick={onClose} aria-label="Close">✕</button>
        <div className="passcode-lock">🔒</div>
        <h2 className="passcode-title">Grown-ups only</h2>
        <p className="passcode-sub">Enter the passcode to edit levels</p>
        <div className="passcode-dots">
          {Array.from({ length: PASSCODE.length }, (_, i) => (
            <div key={i} className={`passcode-dot ${i < code.length ? 'passcode-dot-on' : ''} ${error ? 'passcode-dot-err' : ''}`} />
          ))}
        </div>
        <Numpad
          onDigit={(d) => setCode((c) => (c.length < PASSCODE.length ? c + d : c))}
          onBackspace={() => setCode((c) => c.slice(0, -1))}
          onEnter={() => {}}
        />
      </motion.div>
    </div>
  )
}

function SettingsPanel({ onClose }: { onClose: () => void }) {
  const overrides = useMathStore((s) => s.overrides)
  const resetAll = useMathStore((s) => s.resetAllOverrides)
  const modifiedCount = Object.keys(overrides).length

  return (
    <div className="admin-scrim admin-scrim-panel">
      <motion.div
        className="settings-panel"
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 26 }}
      >
        <header className="settings-head">
          <div>
            <h2 className="settings-title">⚙️ Level Editor</h2>
            <p className="settings-hint">Tune the streak, timer, and flash speed for any level. Changes save instantly.</p>
          </div>
          <div className="settings-head-btns">
            {modifiedCount > 0 && (
              <button className="settings-resetall" onClick={() => confirm('Reset ALL levels back to their defaults?') && resetAll()}>
                Reset all ({modifiedCount})
              </button>
            )}
            <button className="settings-close" onClick={onClose} aria-label="Done">Done</button>
          </div>
        </header>

        <div className="settings-body">
          {WORLDS.map((world) => (
            <section key={world.id} className="set-world" style={{ '--world-color': world.color } as React.CSSProperties}>
              <div className="set-world-head">
                <span className="set-world-emoji">{world.emoji}</span>
                <span className="set-world-name">{world.name}</span>
              </div>
              {world.levels.map((level) => (
                <LevelEditor key={level.id} level={level} />
              ))}
            </section>
          ))}
        </div>
      </motion.div>
    </div>
  )
}

function LevelEditor({ level }: { level: LevelDef }) {
  const override = useMathStore((s) => s.overrides[level.id])
  const setOverride = useMathStore((s) => s.setOverride)
  const resetOverride = useMathStore((s) => s.resetOverride)
  const eff = applyOverride(level, override)
  const modified = !!override && Object.keys(override).length > 0
  const timed = eff.timeLimit != null

  return (
    <div className={`set-level ${modified ? 'set-level-mod' : ''}`}>
      <div className="set-level-top">
        <div className="set-level-name">
          {level.name}
          <span className="set-level-mode">{level.mode}</span>
          {modified && <span className="set-level-badge">edited</span>}
        </div>
        {modified && <button className="set-level-reset" onClick={() => resetOverride(level.id)}>↺ Default</button>}
      </div>

      <div className="set-fields">
        {/* Streak */}
        <label className="set-field">
          <span className="set-field-label">🔥 In a row</span>
          <div className="set-stepper">
            <button onClick={() => setOverride(level.id, { streak: Math.max(1, eff.streak - 1) })}>−</button>
            <input
              type="number" min={1} max={99} value={eff.streak}
              onChange={(e) => setOverride(level.id, { streak: clamp(+e.target.value, 1, 99) })}
            />
            <button onClick={() => setOverride(level.id, { streak: Math.min(99, eff.streak + 1) })}>+</button>
          </div>
        </label>

        {/* Timer */}
        <label className="set-field">
          <span className="set-field-label">⏱ Timer</span>
          <div className="set-timer-row">
            <button
              className={`set-toggle ${timed ? 'set-toggle-on' : ''}`}
              onClick={() => setOverride(level.id, { timeLimit: timed ? null : (level.timeLimit ?? 4) })}
            >
              {timed ? 'On' : 'Off'}
            </button>
            {timed && (
              <div className="set-stepper">
                <button onClick={() => setOverride(level.id, { timeLimit: round1(Math.max(0.5, (eff.timeLimit ?? 4) - 0.5)) })}>−</button>
                <input
                  type="number" min={0.5} step={0.5} value={eff.timeLimit ?? 4}
                  onChange={(e) => setOverride(level.id, { timeLimit: clamp(+e.target.value, 0.5, 60) })}
                />
                <span className="set-unit">s</span>
                <button onClick={() => setOverride(level.id, { timeLimit: round1(Math.min(60, (eff.timeLimit ?? 4) + 0.5)) })}>+</button>
              </div>
            )}
          </div>
        </label>

        {/* Flash duration — only relevant when the equation flashes then fades */}
        {level.mode === 'flash' && (
          <label className="set-field">
            <span className="set-field-label">⚡ Flash time</span>
            <div className="set-stepper">
              <button onClick={() => setOverride(level.id, { flashSeconds: round1(Math.max(0.5, (eff.flashSeconds ?? 1.5) - 0.5)) })}>−</button>
              <input
                type="number" min={0.5} step={0.5} value={eff.flashSeconds ?? 1.5}
                onChange={(e) => setOverride(level.id, { flashSeconds: clamp(+e.target.value, 0.5, 10) })}
              />
              <span className="set-unit">s</span>
              <button onClick={() => setOverride(level.id, { flashSeconds: round1(Math.min(10, (eff.flashSeconds ?? 1.5) + 0.5)) })}>+</button>
            </div>
          </label>
        )}
      </div>
    </div>
  )
}

const clamp = (n: number, lo: number, hi: number) => (isNaN(n) ? lo : Math.min(hi, Math.max(lo, n)))
const round1 = (n: number) => Math.round(n * 2) / 2
