import { motion } from 'framer-motion'
import { sfxPop } from '../audio'

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '⌫', '0', '✓'] as const

export function Numpad({ onDigit, onBackspace, onEnter, disabled }: {
  onDigit: (d: string) => void
  onBackspace: () => void
  onEnter: () => void
  disabled?: boolean
}) {
  function press(k: string) {
    if (disabled) return
    sfxPop()
    if (k === '⌫') onBackspace()
    else if (k === '✓') onEnter()
    else onDigit(k)
  }

  return (
    <div className="numpad">
      {KEYS.map((k) => (
        <motion.button
          key={k}
          className={`numkey ${k === '✓' ? 'numkey-enter' : ''} ${k === '⌫' ? 'numkey-back' : ''}`}
          whileTap={{ scale: 0.9 }}
          transition={{ type: 'spring', stiffness: 500, damping: 20 }}
          onPointerDown={() => press(k)}
          aria-label={k === '⌫' ? 'Backspace' : k === '✓' ? 'Enter' : k}
        >
          {k}
        </motion.button>
      ))}
    </div>
  )
}
