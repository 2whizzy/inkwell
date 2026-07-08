import { motion, AnimatePresence } from 'framer-motion'

/** Pip — a cute geometric floating robot who cheers you on. */
export function Mascot({ message, mood = 'happy', size = 72 }: {
  message?: string
  mood?: 'happy' | 'oops' | 'wow'
  size?: number
}) {
  return (
    <div className="mascot-wrap">
      <AnimatePresence>
        {message && (
          <motion.div
            key={message}
            className="mascot-bubble"
            initial={{ opacity: 0, y: 8, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ type: 'spring', stiffness: 400, damping: 22 }}
          >
            {message}
          </motion.div>
        )}
      </AnimatePresence>
      <motion.svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        animate={{ y: [0, -7, 0] }}
        transition={{ repeat: Infinity, duration: 2.4, ease: 'easeInOut' }}
        aria-label="Pip the robot"
      >
        {/* antenna */}
        <line x1="50" y1="16" x2="50" y2="28" stroke="var(--mm-mascot-line)" strokeWidth="4" strokeLinecap="round" />
        <circle cx="50" cy="12" r="6" fill="#ffd166" />
        {/* head */}
        <rect x="22" y="28" width="56" height="48" rx="18" fill="var(--mm-mascot-body)" />
        {/* face */}
        {mood === 'oops' ? (
          <>
            <line x1="36" y1="44" x2="44" y2="52" stroke="#2b2d42" strokeWidth="4" strokeLinecap="round" />
            <line x1="44" y1="44" x2="36" y2="52" stroke="#2b2d42" strokeWidth="4" strokeLinecap="round" />
            <line x1="56" y1="44" x2="64" y2="52" stroke="#2b2d42" strokeWidth="4" strokeLinecap="round" />
            <line x1="64" y1="44" x2="56" y2="52" stroke="#2b2d42" strokeWidth="4" strokeLinecap="round" />
            <ellipse cx="50" cy="63" rx="6" ry="4" fill="#2b2d42" />
          </>
        ) : (
          <>
            <circle cx="40" cy="48" r={mood === 'wow' ? 7 : 5} fill="#2b2d42" />
            <circle cx="60" cy="48" r={mood === 'wow' ? 7 : 5} fill="#2b2d42" />
            <circle cx="42" cy="46" r="1.8" fill="#fff" />
            <circle cx="62" cy="46" r="1.8" fill="#fff" />
            {mood === 'wow'
              ? <ellipse cx="50" cy="64" rx="7" ry="8" fill="#2b2d42" />
              : <path d="M40 61 Q50 70 60 61" stroke="#2b2d42" strokeWidth="4" fill="none" strokeLinecap="round" />}
          </>
        )}
        {/* cheeks */}
        <circle cx="30" cy="58" r="4" fill="#ff9ec7" opacity="0.7" />
        <circle cx="70" cy="58" r="4" fill="#ff9ec7" opacity="0.7" />
        {/* feet */}
        <circle cx="38" cy="82" r="6" fill="var(--mm-mascot-body)" />
        <circle cx="62" cy="82" r="6" fill="var(--mm-mascot-body)" />
      </motion.svg>
    </div>
  )
}
