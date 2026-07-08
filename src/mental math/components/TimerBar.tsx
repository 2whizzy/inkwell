import { useEffect, useRef, useState } from 'react'

/**
 * requestAnimationFrame-driven countdown bar so it stays butter-smooth on mobile.
 * Green → yellow at 50% → pulsing red at 20%.
 */
export function TimerBar({ seconds, running, resetKey, onTimeout }: {
  seconds: number
  running: boolean
  resetKey: number | string
  onTimeout: () => void
}) {
  const [frac, setFrac] = useState(1)
  const raf = useRef(0)
  const timeoutFired = useRef(false)
  const onTimeoutRef = useRef(onTimeout)
  onTimeoutRef.current = onTimeout

  useEffect(() => {
    setFrac(1)
    timeoutFired.current = false
    if (!running) return
    const start = performance.now()
    const tick = (now: number) => {
      const remaining = 1 - (now - start) / (seconds * 1000)
      if (remaining <= 0) {
        setFrac(0)
        if (!timeoutFired.current) {
          timeoutFired.current = true
          onTimeoutRef.current()
        }
        return
      }
      setFrac(remaining)
      raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf.current)
  }, [seconds, running, resetKey])

  const state = frac > 0.5 ? 'ok' : frac > 0.2 ? 'warn' : 'danger'
  return (
    <div className="timerbar-track" role="timer">
      <div className={`timerbar-fill timerbar-${state}`} style={{ width: `${frac * 100}%` }} />
    </div>
  )
}
